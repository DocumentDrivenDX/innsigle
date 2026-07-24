/**
 * Journal → session provenance (L2).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { sha256Hex } from "../crypto.mjs";
import { redactEvents } from "./redact.mjs";

/**
 * @param {object[]} events validated journal events
 * @param {object} opts
 * @param {string} opts.generatedAt ISO timestamp
 * @param {string} [opts.sessionId]
 * @param {string[]} [opts.artifactPaths] files to hash for digests if not in journal
 * @param {string} [opts.cwd]
 * @param {object} [opts.generator]
 */
export function buildProvenance(events, opts) {
  if (!events.length) throw new Error("empty journal");
  const redacted = redactEvents(events);
  const sessionId = opts.sessionId || redacted[0].session_id;
  const scoped = redacted.filter((e) => e.session_id === sessionId || !opts.sessionId);
  const use = opts.sessionId ? scoped : redacted;

  const userPrompts = use.filter((e) => e.type === "user_prompt");
  const assistantTurns = use.filter((e) => e.type === "assistant_turn");
  const toolCalls = use.filter((e) => e.type === "tool_call");
  const skillCalls = use.filter((e) => e.type === "skill_call");
  const fileWrites = use.filter((e) => e.type === "file_write");

  const models = new Map();
  for (const e of use) {
    if (e.model) {
      models.set(e.model, {
        name: e.model,
        version: null,
        role: models.has(e.model) ? models.get(e.model).role : "primary",
        uri: null,
      });
    }
    if (e.type === "model_switch" && e.model) {
      models.set(e.model, { name: e.model, version: null, role: "primary", uri: null });
    }
  }

  const skills = new Map();
  for (const e of skillCalls) {
    const name = e.skill || e.actor?.name || "skill";
    skills.set(name, {
      name,
      version: null,
      role: e.role || "capture",
      uri: null,
    });
  }

  const tools = new Map();
  for (const e of toolCalls) {
    const name = e.tool || e.actor?.name || "tool";
    tools.set(name, { name, role: e.role || "tool", uri: null });
  }

  const humans = [
    {
      name: "operator",
      role: "prompter",
      prompt_count: userPrompts.length,
    },
  ];

  const cwd = opts.cwd || process.cwd();
  const artifacts = [];
  const seenPaths = new Set();

  for (const e of fileWrites) {
    if (seenPaths.has(e.path)) continue;
    seenPaths.add(e.path);
    let digestVal = e.content_sha256 || null;
    if (!digestVal) {
      const abs = resolve(cwd, e.path);
      if (existsSync(abs)) {
        digestVal = sha256Hex(readFileSync(abs));
      }
    }
    if (!digestVal) {
      // Deterministic placeholder when file missing (fixture-only path)
      digestVal = sha256Hex(`missing:${e.path}`);
    }
    artifacts.push({
      path: e.path,
      digest: { alg: "sha256", value: digestVal },
      role: e.role || "primary-output",
      by: e.by || "unknown",
    });
  }

  if (opts.artifactPaths) {
    for (const p of opts.artifactPaths) {
      const base = p.split(/[/\\]/).pop();
      const already = [...seenPaths].some(
        (sp) => sp === p || sp.endsWith("/" + base) || sp.endsWith("\\" + base),
      );
      if (already || seenPaths.has(p)) continue;
      seenPaths.add(p);
      const abs = resolve(cwd, p);
      const digestVal = existsSync(abs) ? sha256Hex(readFileSync(abs)) : sha256Hex(`missing:${p}`);
      artifacts.push({
        path: p,
        digest: { alg: "sha256", value: digestVal },
        role: "primary-output",
        by: "unknown",
      });
    }
  }

  if (!artifacts.length) {
    throw new Error("no artifacts: journal needs file_write or --artifact");
  }

  const starts = use.filter((e) => e.type === "session_start");
  const ends = use.filter((e) => e.type === "session_end");
  const times = use.map((e) => e.t).sort();

  const timeline = use
    .filter((e) =>
      ["user_prompt", "assistant_turn", "tool_call", "skill_call", "file_write", "note"].includes(
        e.type,
      ),
    )
    .slice(0, 50)
    .map((e) => ({
      t: e.t,
      type: e.type,
      summary: e.summary || e.path || e.tool || e.skill || e.type,
      ...(e.path ? { path: e.path } : {}),
      ...(e.model ? { model: e.model } : {}),
      ...(e.agent_id || e.actor?.agent_id
        ? { agent_id: e.agent_id || e.actor.agent_id }
        : {}),
    }));

  const modelWrote = fileWrites.some((e) => e.by === "model" || e.by === "mixed");
  const humanWrote = fileWrites.some((e) => e.by === "human");
  let composition_suggestion = "model-primary";
  if (modelWrote && humanWrote) composition_suggestion = "mixed";
  else if (modelWrote && !humanWrote) composition_suggestion = "model-primary";
  else if (!modelWrote && userPrompts.length === 0) composition_suggestion = "human-authored";
  else if (!modelWrote && models.size === 0) composition_suggestion = "human-authored";
  else if (!modelWrote && models.size > 0) composition_suggestion = "mixed";
  else composition_suggestion = "model-primary";

  // FR-4a: never suggest human-authored if model wrote bytes
  if (modelWrote && composition_suggestion === "human-authored") {
    composition_suggestion = "model-primary";
  }

  return {
    innsigle_provenance: "1",
    kind: "session",
    schema_version: "1",
    generated_at: opts.generatedAt,
    generator: opts.generator || {
      name: "innsigle-provenance",
      version: "0.1.0",
      uri: null,
    },
    session: {
      id: sessionId,
      started_at: starts[0]?.t || times[0],
      ended_at: ends[ends.length - 1]?.t || times[times.length - 1],
      harness: opts.harness || { name: "unknown", version: null },
    },
    composition_suggestion,
    metrics: {
      user_prompts: userPrompts.length,
      assistant_turns: assistantTurns.length,
      tool_calls: toolCalls.length,
      skill_invocations: skillCalls.length,
      files_touched: seenPaths.size,
      approx_input_tokens: null,
      approx_output_tokens: null,
    },
    models: [...models.values()],
    skills: [...skills.values()],
    tools: [...tools.values()],
    humans,
    artifacts,
    timeline,
    transcript: null,
    privacy: {
      redacted: true,
      raw_retained_locally: true,
      notes: "Summaries only; full transcript not included",
    },
  };
}
