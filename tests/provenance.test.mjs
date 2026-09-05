import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { sha256Hex } from "../src/crypto.mjs";
import {
  loadJournal,
  buildProvenance,
  proposeColo,
  redactText,
  computeHumanInput,
  validateHumanInput,
  roundHalfUpPercent,
} from "../src/provenance/index.mjs";

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
    // F7: home paths are redacted anywhere in a string, not only at the start
    assert.equal(redactText("/home/erik/x.md"), "/home/[REDACTED]/x.md");
    assert.equal(
      redactText("Write /home/erik/private/notes.md"),
      "Write /home/[REDACTED]/private/notes.md",
    );
    assert.equal(
      redactText("see /Users/erik/notes and /home/erik/x"),
      "see /Users/[REDACTED]/notes and /home/[REDACTED]/x",
    );
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

describe("human-input measure hi1 (FR-20 / PROV-11)", () => {
  const load = (name) => loadJournal(join(fixtures, name));
  const A = "notes/post.md";

  it("mixed session: worked example from session-provenance.md → 48", () => {
    const hi = computeHumanInput(load("session-hi-mixed.jsonl"), A);
    assert.deepEqual(hi, {
      method: "hi1",
      basis: "session-journal",
      percent: 48,
      weights: { direction: 25, contribution: 40, review: 35 },
      direction: { percent: 100, user_prompts: 3, model_write_bursts: 3 },
      contribution: {
        percent: 0,
        human_chars: 0,
        model_chars: 812,
        human_write_events: 0,
        coverage: "full",
      },
      review: { percent: 67, post_output_prompts: 2, review_events: 0 },
    });
    validateHumanInput(hi); // computed objects always validate
  });

  it("human-only chars → 100, direction/review null (B = 0)", () => {
    const hi = computeHumanInput(load("session-hi-human-only.jsonl"), A);
    assert.equal(hi.percent, 100);
    assert.equal(hi.direction, null);
    assert.equal(hi.review, null);
    assert.equal(hi.contribution.human_chars, 500);
    assert.equal(hi.contribution.human_write_events, 1);
    validateHumanInput(hi);
  });

  it("unprompted, unreviewed model output → 0", () => {
    const hi = computeHumanInput(load("session-hi-unattended.jsonl"), A);
    assert.equal(hi.percent, 0);
    assert.equal(hi.direction.percent, 0);
    assert.equal(hi.direction.model_write_bursts, 1); // one uninterrupted burst
    assert.equal(hi.review.percent, 0);
    validateHumanInput(hi);
  });

  it("rounding is half-up on exact rationals (25.5 → 26, not 25)", () => {
    const hi = computeHumanInput(load("session-hi-rounding.jsonl"), A);
    // D = 1 (3 prompts, 1 burst), C = 1/80, R = 0 → 25 + 0.5 + 0 = 25.5
    assert.equal(hi.percent, 26);
    assert.equal(roundHalfUpPercent(1, 200), 1); // 0.5 → 1
    assert.equal(roundHalfUpPercent(1, 300), 0);
    assert.equal(roundHalfUpPercent(1, 2), 50);
    validateHumanInput(hi);
  });

  it("explicit human review event lifts the review component", () => {
    const hi = computeHumanInput(load("session-hi-review.jsonl"), A);
    // D = 1, C = 0, R = 1 (one review event per one burst) → 25 + 0 + 35 = 60
    assert.equal(hi.percent, 60);
    assert.equal(hi.review.review_events, 1);
    assert.equal(hi.review.post_output_prompts, 0);
    validateHumanInput(hi);
  });

  it("no char evidence → null; never invented (FR-20a)", () => {
    const events = load("session-claude.jsonl"); // legacy journal, no chars
    assert.equal(
      computeHumanInput(events, "tests/fixtures/provenance/out/sealed-notes-claude.md"),
      null,
    );
    const l2 = buildProvenance(events, { generatedAt: FIXED, cwd: root });
    assert.equal(l2.human_input, null);
  });

  it("buildProvenance attaches hi1 for the primary artifact", () => {
    const l2 = buildProvenance(load("session-hi-mixed.jsonl"), {
      generatedAt: FIXED,
      cwd: root,
    });
    assert.equal(l2.human_input.percent, 48);
    validateHumanInput(l2.human_input);
  });

  it("validateHumanInput rejects fudged arithmetic and bad shapes", () => {
    const good = computeHumanInput(load("session-hi-mixed.jsonl"), A);
    assert.throws(() => validateHumanInput({ ...good, percent: 75 }), /does not recompute/);
    assert.throws(
      () =>
        validateHumanInput({
          ...good,
          review: { ...good.review, review_events: 3 },
        }),
      /does not recompute/,
    );
    assert.throws(() => validateHumanInput({ ...good, method: "hi2" }), /method/);
    assert.throws(
      () => validateHumanInput({ ...good, weights: { direction: 90, contribution: 5, review: 5 } }),
      /weights/,
    );
    assert.throws(() => validateHumanInput({ ...good, contribution: null }), /contribution/);
    assert.throws(() => validateHumanInput({ ...good, direction: null }), /both/);
    const floaty = JSON.parse(JSON.stringify(good));
    floaty.contribution.human_chars = 0.5;
    assert.throws(() => validateHumanInput(floaty), /non-negative integer/);
  });
});
