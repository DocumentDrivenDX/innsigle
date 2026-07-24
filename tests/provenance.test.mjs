import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { sha256Hex } from "../src/crypto.mjs";
import { loadJournal, buildProvenance, proposeColo, redactText } from "../src/provenance/index.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "src/cli.mjs");
const fixtures = join(root, "tests/fixtures/provenance");
const FIXED = "2026-07-24T18:00:00Z";

function run(args, cwd = root) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", cwd });
}

describe("session provenance (FEAT-004 P1)", () => {
  it("redacts secrets deterministically", () => {
    assert.match(redactText("key sk-abcdefghijklmnopqrst"), /REDACTED/);
    assert.equal(redactText("hello"), "hello");
  });

  it("build + propose-colo from claude fixture (PROV-04)", () => {
    const events = loadJournal(join(fixtures, "session-claude.jsonl"));
    const l2 = buildProvenance(events, {
      generatedAt: FIXED,
      cwd: root,
      generator: { name: "innsigle-provenance", version: "0.1.0", uri: null },
    });
    assert.equal(l2.metrics.user_prompts, 3);
    assert.ok(l2.models.some((m) => m.name === "Claude"));
    assert.equal(l2.composition_suggestion, "model-primary");
    const colo = proposeColo(l2, {
      provenanceDigestHex: "a".repeat(64),
      provenanceUri: "https://example.com/p.json",
    });
    assert.equal(colo.composition, "model-primary");
    assert.ok(colo.ingredients.some((i) => i.kind === "model" && i.name === "Claude"));
    assert.ok(colo.ingredients.some((i) => i.name === "innsigle-session"));
    assert.ok(colo.ingredients.some((i) => i.name === "sloptimizer"));
    assert.equal(colo.provenance.kind, "session");
  });

  it("sloptimizer-only does not become human-authored (PROV-10)", () => {
    const events = loadJournal(join(fixtures, "session-sloptimizer-only.jsonl"));
    const l2 = buildProvenance(events, { generatedAt: FIXED, cwd: root });
    assert.notEqual(l2.composition_suggestion, "human-authored");
    const colo = proposeColo(l2, { provenanceDigestHex: "b".repeat(64) });
    assert.notEqual(colo.composition, "human-authored");
    assert.throws(
      () =>
        proposeColo(l2, {
          composition: "human-authored",
          provenanceDigestHex: "b".repeat(64),
        }),
      /FR-4a/,
    );
  });

  it("CLI provenance build is digest-stable with fixed generated-at", () => {
    const tmp = join(root, ".tmp-test-prov");
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
    const out1 = join(tmp, "l2a.json");
    const out2 = join(tmp, "l2b.json");
    for (const out of [out1, out2]) {
      const r = run([
        "provenance",
        "build",
        "--journal",
        join(fixtures, "session-claude.jsonl"),
        "--generated-at",
        FIXED,
        "--out",
        out,
      ]);
      assert.equal(r.status, 0, r.stderr);
    }
    assert.equal(sha256Hex(readFileSync(out1)), sha256Hex(readFileSync(out2)));
  });

  it("CLI propose-colo attaches file-byte digest of L2", () => {
    const tmp = join(root, ".tmp-test-prov2");
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
    const l2p = join(tmp, "l2.json");
    const coloP = join(tmp, "colo.json");
    let r = run([
      "provenance",
      "build",
      "--journal",
      join(fixtures, "session-claude.jsonl"),
      "--generated-at",
      FIXED,
      "--out",
      l2p,
    ]);
    assert.equal(r.status, 0, r.stderr);
    r = run([
      "provenance",
      "propose-colo",
      "--provenance",
      l2p,
      "--uri",
      "https://example.com/l2.json",
      "--out",
      coloP,
    ]);
    assert.equal(r.status, 0, r.stderr);
    const colo = JSON.parse(readFileSync(coloP, "utf8"));
    assert.equal(colo.provenance.digest.value, sha256Hex(readFileSync(l2p)));
  });

  it("agent-provenance-driver fixture mode produces multi-agent colo", () => {
    const driver = join(root, "scripts/agent-provenance-driver.mjs");
    const outDir = join(root, ".tmp-test-driver");
    rmSync(outDir, { recursive: true, force: true });
    const r = spawnSync(process.execPath, [driver, "--out-dir", outDir], {
      encoding: "utf8",
      cwd: root,
    });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const summary = JSON.parse(readFileSync(join(outDir, "summary.json"), "utf8"));
    assert.equal(summary.mode, "fixture");
    assert.deepEqual(summary.agents, ["claude", "codex"]);
    assert.equal(summary.user_prompts, 6);
    assert.notEqual(summary.composition, "human-authored");
    assert.ok(summary.models.includes("Claude"));
    assert.ok(summary.models.includes("Codex"));
    const colo = JSON.parse(readFileSync(join(outDir, "colo.json"), "utf8"));
    assert.ok(colo.ingredients.length >= 3);
  });
});
