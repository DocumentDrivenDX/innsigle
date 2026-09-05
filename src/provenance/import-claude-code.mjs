/**
 * Claude Code transcript importer (PLAN-001 B1).
 *
 * Maps a Claude Code session transcript (JSONL, internal format that drifts
 * across versions) to journal v1 events. Privacy is a hard requirement
 * (PROV-09): emitted events carry counts and derived metadata only — never
 * message bodies, tool arguments, tool outputs, or file contents. User prompts
 * emit only a character count; tool/file summaries carry the tool name and
 * path only. Summaries are capped at SUMMARY_MAX chars and the whole event
 * stream passes through redactEvents.
 * Unknown or unparseable lines degrade to "note" events or are skipped —
 * never a hard failure.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { redactEvents } from "./redact.mjs";

export const SUMMARY_MAX = 120;

const FILE_WRITE_TOOLS = new Set(["Write", "Edit", "NotebookEdit"]);

/**
 * Bash heredoc file writes. Agents running in shell-first modes write whole
 * files as `cat > path <<'EOF' … EOF` (or `cat <<EOF > path`, `tee path <<EOF`,
 * `>>` append, `<<-`) instead of calling Write/Edit. The heredoc body is
 * model-written text and counts toward contribution exactly like a Write.
 * Only the byte count is measured; bodies never leave the transcript
 * (PROV-09). Unterminated heredocs and scripts that write files indirectly
 * (a python3 heredoc calling open().write) are not measurable and stay
 * ordinary tool_call events.
 */
const HEREDOC_REDIRECT_FIRST =
  /(?:^|[\s;&|(])(?:cat\s*(>>?)\s*|tee(?:\s+(-a))?\s+)(?:"([^"\n]+)"|'([^'\n]+)'|([^\s<>|&;'"]+))\s*<<(-)?\s*(?:"(\w+)"|'(\w+)'|(\w+))[^\n]*\n/gm;
const HEREDOC_REDIRECT_LAST =
  /(?:^|[\s;&|(])cat\s*<<(-)?\s*(?:"(\w+)"|'(\w+)'|(\w+))\s*(>>?)\s*(?:"([^"\n]+)"|'([^'\n]+)'|([^\s<>|&;'"]+))[^\n]*\n/gm;

function heredocBody(rest, delim, dash) {
  let bodyLen = 0;
  let consumed = 0;
  for (const line of rest.split("\n")) {
    consumed += line.length + 1;
    const probe = dash ? line.replace(/^\t+/, "") : line;
    if (probe === delim) {
      return { chars: Math.max(0, bodyLen - 1), consumed };
    }
    bodyLen += line.length + 1;
  }
  return null; // unterminated: not a write we can measure
}

/** @returns {{path: string, chars: number, append: boolean}[]} */
export function extractHeredocWrites(command) {
  const out = [];
  if (typeof command !== "string" || !command.includes("<<")) return out;
  const forms = [
    { re: HEREDOC_REDIRECT_FIRST, pick: (m) => ({
        append: m[1] === ">>" || Boolean(m[2]),
        path: m[3] ?? m[4] ?? m[5],
        dash: Boolean(m[6]),
        delim: m[7] ?? m[8] ?? m[9],
      }) },
    { re: HEREDOC_REDIRECT_LAST, pick: (m) => ({
        dash: Boolean(m[1]),
        delim: m[2] ?? m[3] ?? m[4],
        append: m[5] === ">>",
        path: m[6] ?? m[7] ?? m[8],
      }) },
  ];
  const found = [];
  for (const { re, pick } of forms) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(command))) {
      const { path, delim, dash, append } = pick(m);
      const start = m.index + m[0].length;
      const body = heredocBody(command.slice(start), delim, dash);
      if (!body) continue;
      // An unexpanded variable or substitution in the path cannot be attributed
      // to a file; measuring it would credit chars to a name that never existed.
      if (/[$`]/.test(path)) continue;
      found.push({ at: m.index, write: { path, chars: body.chars, append } });
      re.lastIndex = start + body.consumed;
    }
  }
  // Two regex passes; report writes in command order.
  found.sort((a, b) => a.at - b.at);
  for (const f of found) out.push(f.write);
  return out;
}
const AGENT_TOOLS = new Set(["Skill", "Agent", "Task"]);

/** Truncate to a short single-line summary (PROV-09: never full bodies). */
function summarize(text, max = SUMMARY_MAX) {
  const oneLine = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (oneLine.length <= max) return oneLine;
  return oneLine.slice(0, max - 1) + "…";
}

/** Extract the concatenated text of user-message text blocks, or null. */
function userText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const texts = content
      .filter((b) => b && b.type === "text" && typeof b.text === "string")
      .map((b) => b.text);
    if (!texts.length) return null; // e.g. tool_result-only message
    return texts.join(" ");
  }
  return null;
}

/**
 * Harness-injected <system-reminder> blocks are not human-typed text; strip
 * them before counting prompt chars (hi1 direction evidence must reflect the
 * operator, not the harness). Unterminated blocks strip to end of string.
 */
function stripSystemReminders(text) {
  return text.replace(/<system-reminder>[\s\S]*?(?:<\/system-reminder>|$)/g, "");
}

/** Slash-command wrappers and injected command output are not human prompts. */
function isCommandWrapper(text) {
  return (
    text.includes("<command-name>") ||
    text.includes("<command-message>") ||
    text.includes("<local-command-stdout>") ||
    text.includes("<local-command-stderr>")
  );
}

/**
 * Pure transform: Claude Code transcript lines → journal v1 events.
 *
 * @param {string[]|object[]} lines raw JSONL lines (strings) or pre-parsed
 *   transcript records; a mix is tolerated.
 * @param {object} [opts]
 * @param {string} [opts.sessionId] override the session id
 * @returns {object[]} redacted journal v1 events
 */
export function transformTranscript(lines, opts = {}) {
  const records = [];
  const noteLines = []; // 1-based indexes of unparseable lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line == null) continue;
    if (typeof line === "object") {
      records.push(line);
      continue;
    }
    const trimmed = String(line).trim();
    if (!trimmed) continue;
    try {
      const rec = JSON.parse(trimmed);
      if (rec && typeof rec === "object" && !Array.isArray(rec)) {
        records.push(rec);
      } else {
        noteLines.push(i + 1);
        records.push({ __unparseable: true, line: i + 1 });
      }
    } catch {
      noteLines.push(i + 1);
      records.push({ __unparseable: true, line: i + 1 });
    }
  }

  const sessionId =
    opts.sessionId ||
    records.find((r) => typeof r.sessionId === "string" && r.sessionId)?.sessionId ||
    "unknown-session";

  const timestamps = records
    .map((r) => r.timestamp)
    .filter((t) => typeof t === "string" && t);
  const firstT = timestamps[0] || "1970-01-01T00:00:00Z";
  const lastT = timestamps[timestamps.length - 1] || firstT;

  const events = [];
  let seq = 0;
  let t = firstT;
  const push = (ev) => {
    events.push({
      v: 1,
      session_id: sessionId,
      event_id: `cc-${seq}`,
      sequence: seq,
      t,
      ...ev,
    });
    seq += 1;
  };

  // First line → session_start.
  push({
    type: "session_start",
    actor: { kind: "system", name: "claude-code", agent_id: "claude" },
  });

  let lastAssistantMsgId = null;
  for (const rec of records) {
    if (typeof rec.timestamp === "string" && rec.timestamp) t = rec.timestamp;

    if (rec.__unparseable) {
      push({
        type: "note",
        actor: { kind: "system", name: "claude-code-import" },
        summary: summarize(`unparseable transcript line ${rec.line}`),
      });
      continue;
    }

    if (rec.type === "user" && rec.message) {
      if (rec.isMeta) continue;
      const text = userText(rec.message.content);
      if (text == null) continue; // tool_result-only line
      if (isCommandWrapper(text)) continue;
      const trimmed = stripSystemReminders(text).trim();
      if (!trimmed) continue; // reminder-only injection, not a human prompt
      // PROV-09: never carry prompt-body text — derived metadata only.
      push({
        type: "user_prompt",
        actor: { kind: "human", name: "operator" },
        chars: trimmed.length,
        summary: `user prompt (${trimmed.length} chars)`,
      });
      continue;
    }

    if (rec.type === "assistant" && rec.message) {
      const model = rec.message.model || "unknown-model";
      const content = Array.isArray(rec.message.content) ? rec.message.content : [];
      const msgId = rec.message.id || null;
      // "<synthetic>" marks harness-injected records (errors, interruptions),
      // not real model output — never count them as assistant turns.
      const synthetic = model === "<synthetic>";
      // Streamed transcripts split one logical turn across several records
      // sharing message.id — emit one assistant_turn per logical turn.
      if (!synthetic && (msgId == null || msgId !== lastAssistantMsgId)) {
        const textBlocks = content.filter((b) => b?.type === "text").length;
        const toolBlocks = content.filter((b) => b?.type === "tool_use").length;
        push({
          type: "assistant_turn",
          actor: { kind: "model", name: model, agent_id: "claude" },
          model,
          summary: summarize(
            `assistant turn: ${textBlocks} text block(s), ${toolBlocks} tool_use block(s)`,
          ),
        });
        lastAssistantMsgId = msgId;
      }
      for (const block of content) {
        if (!block || block.type !== "tool_use" || !block.name) continue;
        const input = block.input || {};
        if (FILE_WRITE_TOOLS.has(block.name)) {
          const path = input.file_path || input.notebook_path;
          if (!path) continue; // drifted shape: no usable path
          // hi1 contribution evidence: char counts only (PROV-09 — never the
          // bodies). Omit fields on drifted shapes rather than guessing.
          // Edit with replace_all still counts one occurrence (documented
          // limitation in session-provenance.md).
          const added =
            typeof input.content === "string" ? input.content.length
            : typeof input.new_string === "string" ? input.new_string.length
            : typeof input.new_source === "string" ? input.new_source.length
            : null;
          const removed =
            typeof input.old_string === "string" ? input.old_string.length : null;
          push({
            type: "file_write",
            actor: { kind: "model", name: model, agent_id: "claude" },
            model,
            path,
            by: "model",
            role: "primary-output",
            ...(added !== null ? { chars_added: added } : {}),
            ...(removed !== null ? { chars_removed: removed } : {}),
            summary: summarize(`${block.name} ${path}`),
          });
        } else if (block.name === "Bash" && extractHeredocWrites(input.command).length) {
          for (const w of extractHeredocWrites(input.command)) {
            push({
              type: "file_write",
              actor: { kind: "model", name: model, agent_id: "claude" },
              model,
              path: w.path,
              by: "model",
              role: "primary-output",
              chars_added: w.chars,
              summary: summarize(`Bash heredoc ${w.append ? ">>" : ">"} ${w.path}`),
            });
          }
        } else if (AGENT_TOOLS.has(block.name)) {
          const skill = input.skill || input.name || block.name;
          push({
            type: "skill_call",
            actor: { kind: "skill", name: skill },
            skill,
            role: "skill",
            summary: summarize(`skill: ${skill}`),
          });
        } else {
          push({
            type: "tool_call",
            actor: { kind: "tool", name: block.name },
            tool: block.name,
            role: "tool",
            summary: summarize(`tool: ${block.name}`),
          });
        }
      }
      continue;
    }

    // Messages the operator typed while the assistant was mid-turn are queued
    // by the harness and land as `queue-operation` records (`enqueue`, then
    // `remove`/`dequeue` on delivery) rather than as `user` messages. They are
    // human-typed direction and review; count each once, on enqueue. Chars
    // only (PROV-09).
    if (rec.type === "queue-operation" && rec.operation === "enqueue") {
      const queued = typeof rec.content === "string" ? stripSystemReminders(rec.content).trim() : "";
      if (!queued) continue;
      push({
        type: "user_prompt",
        actor: { kind: "human", name: "operator" },
        chars: queued.length,
        summary: `user prompt, queued mid-turn (${queued.length} chars)`,
      });
      continue;
    }

    // Non-message record types (mode, file-history-snapshot, attachment, …)
    // carry no provenance facts we emit; skip them tolerantly.
  }

  // End → session_end.
  t = lastT >= t ? lastT : t;
  push({
    type: "session_end",
    actor: { kind: "system", name: "claude-code", agent_id: "claude" },
  });

  return redactEvents(events);
}

/** Convenience: raw transcript text → journal events. */
export function transformTranscriptText(text, opts = {}) {
  return transformTranscript(String(text).replace(/\r\n/g, "\n").split("\n"), opts);
}

export function journalToJsonl(events) {
  return events.map((e) => JSON.stringify(e)).join("\n") + "\n";
}

const EXIT = { ok: 0, usage: 1, badSchema: 5 };

/**
 * `innsigle provenance import claude-code <transcript.jsonl> [--out journal.jsonl]`
 * Same calling convention as cmdProvenanceBuild in src/cli.mjs: args is the
 * argv slice after `import`. deps allows test injection.
 */
export function cmdProvenanceImport(args, deps = {}) {
  const read = deps.readFileSync || readFileSync;
  const write = deps.writeFileSync || writeFileSync;
  const stdout = deps.stdout || ((s) => process.stdout.write(s));
  const error = deps.error || ((m) => console.error(m));
  const exit = deps.exit || ((code) => process.exit(code));

  const harness = args[0];
  if (harness !== "claude-code") {
    error("usage: innsigle provenance import claude-code <transcript.jsonl> [--out journal.jsonl]");
    return exit(EXIT.usage);
  }
  const transcriptPath = args[1];
  if (!transcriptPath || transcriptPath.startsWith("--")) {
    error("missing <transcript.jsonl>");
    return exit(EXIT.usage);
  }
  const outIdx = args.indexOf("--out");
  const out = outIdx === -1 ? undefined : args[outIdx + 1];
  if (outIdx !== -1 && !out) {
    error("missing value for --out");
    return exit(EXIT.usage);
  }
  const sessionIdIdx = args.indexOf("--session-id");
  const sessionId = sessionIdIdx === -1 ? undefined : args[sessionIdIdx + 1];

  let text;
  try {
    text = read(transcriptPath, "utf8");
  } catch (e) {
    error(`INVALID: cannot read transcript: ${e.message}`);
    return exit(EXIT.badSchema);
  }
  const events = transformTranscriptText(text, { sessionId });
  const body = journalToJsonl(events);
  if (out) {
    write(out, body);
    error(`imported ${events.length} events → ${out}`);
  } else {
    stdout(body);
  }
  return exit(EXIT.ok);
}
