/**
 * Claude Code transcript importer (PLAN-001 B1).
 *
 * Maps a Claude Code session transcript (JSONL, internal format that drifts
 * across versions) to journal v1 events. Privacy is a hard requirement
 * (PROV-09): emitted events carry counts and short summaries only — never
 * message bodies, tool outputs, or file contents. Summaries are truncated to
 * SUMMARY_MAX chars and the whole event stream passes through redactEvents.
 * Unknown or unparseable lines degrade to "note" events or are skipped —
 * never a hard failure.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { redactEvents } from "./redact.mjs";

export const SUMMARY_MAX = 120;

const FILE_WRITE_TOOLS = new Set(["Write", "Edit", "NotebookEdit"]);
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
      const trimmed = text.trim();
      if (!trimmed) continue;
      push({
        type: "user_prompt",
        actor: { kind: "human", name: "operator" },
        summary: summarize(trimmed),
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
          push({
            type: "file_write",
            actor: { kind: "model", name: model, agent_id: "claude" },
            model,
            path,
            by: "model",
            role: "primary-output",
            summary: summarize(`${block.name} ${path}`),
          });
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
