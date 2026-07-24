#!/usr/bin/env node
/**
 * Multi-agent provenance test driver.
 *
 * Default (CI-safe): uses recorded journals for claude + codex from scripted
 * human inputs, then runs innsigle provenance build + propose-colo.
 *
 * Live mode (optional): INNSIGLE_LIVE_AGENTS=1 feeds human-inputs.json prompts
 * to `claude` and `codex` CLIs, records a best-effort journal, writes outputs,
 * then generates colo. Live mode is non-deterministic and not used in npm test.
 *
 * Usage:
 *   node scripts/agent-provenance-driver.mjs
 *   node scripts/agent-provenance-driver.mjs --live
 *   node scripts/agent-provenance-driver.mjs --out-dir .tmp-prov-run
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { sha256Hex } from "../src/crypto.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "src/cli.mjs");
const fixtures = join(root, "tests/fixtures/provenance");
const live = process.argv.includes("--live") || process.env.INNSIGLE_LIVE_AGENTS === "1";
const outDir =
  process.argv.includes("--out-dir")
    ? process.argv[process.argv.indexOf("--out-dir") + 1]
    : join(root, ".tmp-prov-run");

mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, "artifacts"), { recursive: true });

function runCli(args) {
  const r = spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    cwd: root,
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(r.status || 1);
  }
  return r;
}

function loadHumanInputs() {
  return JSON.parse(readFileSync(join(fixtures, "human-inputs.json"), "utf8"));
}

/**
 * Best-effort live agent run: one combined prompt per agent, write artifact.
 * Records a simplified journal (not full tool fidelity).
 */
function runLiveAgent(agent, inputs, artifactRel) {
  const prompt = [
    "You are helping produce a short markdown document for an Innsigle provenance test.",
    "Respond with ONLY the final markdown file contents (no code fences).",
    "",
    ...inputs.map((h, i) => `Human instruction ${i + 1}: ${h.text}`),
  ].join("\n");

  const bin = agent === "claude" ? "claude" : "codex";
  const args =
    agent === "claude"
      ? ["-p", prompt, "--output-format", "text"]
      : ["exec", prompt];

  console.error(`live: invoking ${bin}…`);
  const r = spawnSync(bin, args, {
    encoding: "utf8",
    cwd: root,
    timeout: 180_000,
    env: { ...process.env, NO_COLOR: "1" },
  });

  const body =
    r.status === 0 && r.stdout?.trim()
      ? r.stdout.trim() + "\n"
      : `# Fallback ${agent}\n\nAgent failed or empty (status ${r.status}).\n\n${inputs.map((h) => `- ${h.text}`).join("\n")}\n`;

  const abs = join(outDir, "artifacts", artifactRel);
  writeFileSync(abs, body);

  const t0 = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const events = [];
  let seq = 0;
  const sid = `live-${agent}`;
  const push = (obj) => {
    events.push({
      v: 1,
      session_id: sid,
      event_id: `${agent}-${seq}`,
      sequence: seq++,
      t: t0,
      ...obj,
    });
  };
  push({ type: "session_start", actor: { kind: "system", name: "driver", agent_id: agent } });
  for (const h of inputs) {
    push({
      type: "user_prompt",
      actor: { kind: "human", name: "operator" },
      summary: h.text.slice(0, 200),
    });
  }
  const modelName = agent === "claude" ? "Claude" : "Codex";
  push({
    type: "assistant_turn",
    actor: { kind: "model", name: modelName, agent_id: agent },
    model: modelName,
    summary: "Produced markdown artifact",
  });
  push({
    type: "skill_call",
    actor: { kind: "skill", name: "innsigle-session" },
    skill: "innsigle-session",
    role: "provenance-capture",
    summary: "Driver capture",
    status: "ok",
  });
  push({
    type: "file_write",
    actor: { kind: "model", name: modelName, agent_id: agent },
    model: modelName,
    path: join("artifacts", artifactRel),
    by: "model",
    role: "primary-output",
    summary: "Wrote artifact",
    content_sha256: sha256Hex(body),
  });
  push({ type: "session_end", actor: { kind: "system", name: "driver", agent_id: agent } });

  const journalPath = join(outDir, `session-${agent}.jsonl`);
  writeFileSync(journalPath, events.map((e) => JSON.stringify(e)).join("\n") + "\n");
  return { journalPath, artifactPath: abs };
}

function useFixtures() {
  const destArt = join(outDir, "artifacts");
  mkdirSync(destArt, { recursive: true });
  for (const f of ["sealed-notes-claude.md", "sealed-notes-codex.md"]) {
    cpSync(join(fixtures, "out", f), join(destArt, f));
  }
  // Rewrite journal paths to outDir-relative for hashing
  function adapt(srcName, agent, artName) {
    const lines = readFileSync(join(fixtures, srcName), "utf8")
      .trim()
      .split("\n")
      .map((line) => {
        const ev = JSON.parse(line);
        if (ev.path && ev.path.includes("sealed-notes")) {
          ev.path = join("artifacts", artName);
        }
        return JSON.stringify(ev);
      });
    const p = join(outDir, srcName);
    writeFileSync(p, lines.join("\n") + "\n");
    return p;
  }
  return {
    journals: [
      adapt("session-claude.jsonl", "claude", "sealed-notes-claude.md"),
      adapt("session-codex.jsonl", "codex", "sealed-notes-codex.md"),
    ],
    artifacts: [
      join(outDir, "artifacts/sealed-notes-claude.md"),
      join(outDir, "artifacts/sealed-notes-codex.md"),
    ],
  };
}

const human = loadHumanInputs();
writeFileSync(join(outDir, "human-inputs.json"), JSON.stringify(human, null, 2));

let journals;
let artifacts;

if (live) {
  console.error("mode=live (non-deterministic)");
  const c = runLiveAgent("claude", human.inputs, "sealed-notes-claude.md");
  const x = runLiveAgent("codex", human.inputs, "sealed-notes-codex.md");
  journals = [c.journalPath, x.journalPath];
  artifacts = [c.artifactPath, x.artifactPath];
} else {
  console.error("mode=fixture (CI-safe, multi-agent recorded journals)");
  const f = useFixtures();
  journals = f.journals;
  artifacts = f.artifacts;
}

const generatedAt = "2026-07-24T18:00:00Z";
const l2Path = join(outDir, "session-provenance.json");
const coloPath = join(outDir, "colo.json");

const buildArgs = [
  "provenance",
  "build",
  ...journals.flatMap((j) => ["--journal", j]),
  ...artifacts.flatMap((a) => ["--artifact", a]),
  "--generated-at",
  generatedAt,
  "--cwd",
  outDir,
  "--harness",
  live ? "live-driver" : "fixture-driver",
  "--out",
  l2Path,
];
runCli(buildArgs);

runCli([
  "provenance",
  "propose-colo",
  "--provenance",
  l2Path,
  "--uri",
  `file://${l2Path}`,
  "--out",
  coloPath,
]);

const colo = JSON.parse(readFileSync(coloPath, "utf8"));
const l2 = JSON.parse(readFileSync(l2Path, "utf8"));

const summary = {
  mode: live ? "live" : "fixture",
  agents: ["claude", "codex"],
  human_inputs: human.inputs.length,
  composition: colo.composition,
  user_prompts: l2.metrics.user_prompts,
  models: l2.models.map((m) => m.name),
  ingredients: colo.ingredients.map((i) => `${i.kind}:${i.name}`),
  l2: l2Path,
  colo: coloPath,
  l2_sha256: sha256Hex(readFileSync(l2Path)),
};

writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));

if (colo.composition === "human-authored") {
  console.error("FAIL: multi-agent model writes must not yield human-authored");
  process.exit(1);
}
if (l2.metrics.user_prompts < human.inputs.length) {
  console.error("FAIL: expected user_prompts >= human input count per agent merge");
  // fixture merges two sessions each with 3 prompts → 6
}
if (!live && l2.metrics.user_prompts !== 6) {
  console.error(`FAIL: fixture expected 6 user_prompts, got ${l2.metrics.user_prompts}`);
  process.exit(1);
}
