import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJournal, loadJournal, buildProvenance, proposeColo } from "../src/provenance/index.mjs";
import {
  transformTranscriptText,
  journalToJsonl,
  cmdProvenanceImport,
  SUMMARY_MAX,
} from "../src/provenance/import-claude-code.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = join(root, "tests/fixtures/provenance/claude-code-transcript.jsonl");
const FIXED = "2026-09-03T12:00:00Z";

const fixtureText = readFileSync(fixture, "utf8");

describe("claude-code transcript importer (PLAN-001 B1)", () => {
  it("maps transcript lines to valid journal v1 events (round-trip)", () => {
    const events = transformTranscriptText(fixtureText);
    // parseJournal validates every event; round-trip must be lossless.
    const parsed = parseJournal(journalToJsonl(events));
    assert.equal(parsed.length, events.length);
    assert.deepEqual(parsed, events);

    assert.equal(events[0].type, "session_start");
    assert.equal(events[events.length - 1].type, "session_end");
    events.forEach((e, i) => assert.equal(e.sequence, i));
    for (const e of events) {
      assert.equal(e.session_id, "0f0f0f0f-1111-4222-8333-444455556666");
      assert.ok(e.t);
    }

    const byType = (t) => events.filter((e) => e.type === t);
    assert.equal(byType("user_prompt").length, 3); // meta + command wrapper + tool_result lines excluded
    assert.equal(byType("assistant_turn").length, 5); // streamed records sharing message.id collapse to one turn
    assert.equal(byType("file_write").length, 3); // Write, Edit, Write
    assert.equal(byType("tool_call").length, 1); // Bash
    assert.equal(byType("skill_call").length, 1); // Skill → sloptimizer
    assert.equal(byType("note").length, 1); // unparseable line degrades, never fails

    for (const w of byType("file_write")) {
      assert.equal(w.path, "posts/demo/index.qmd");
      assert.equal(w.by, "model");
      assert.equal(w.actor.kind, "model");
      assert.equal(w.model, "claude-opus-5");
    }
    assert.equal(byType("skill_call")[0].skill, "sloptimizer");
    assert.equal(byType("tool_call")[0].tool, "Bash");
    for (const p of byType("user_prompt")) assert.equal(p.actor.kind, "human");
  });

  it("emits summaries/counts only, truncated (PROV-09)", () => {
    const events = transformTranscriptText(fixtureText);
    for (const e of events) {
      if (e.summary) assert.ok(e.summary.length <= SUMMARY_MAX, `summary too long: ${e.summary}`);
    }
    const serialized = journalToJsonl(events);
    // Bodies, tool inputs/outputs, meta content never cross into the journal.
    assert.ok(!serialized.includes("must never appear in the journal"));
    // Prompt bodies never enter the journal at all (F6/F11): user_prompt
    // events carry derived metadata only — not even a truncated prefix, and
    // short prompts never land verbatim either.
    assert.ok(!serialized.includes("Draft a short demo post"));
    assert.ok(!serialized.includes("Tighten the intro paragraph"));
    assert.ok(!serialized.includes("Continue and finalize the demo post"));
    for (const e of events.filter((ev) => ev.type === "user_prompt")) {
      assert.match(e.summary, /^user prompt \(\d+ chars\)$/);
    }
  });

  it("user prompts with secrets never leak into the journal (F6/F11)", () => {
    const secretPrompt =
      "use password hunter2 for the staging db, then draft the post";
    const line = JSON.stringify({
      type: "user",
      sessionId: "0f0f0f0f-1111-4222-8333-444455556666",
      message: { role: "user", content: secretPrompt },
      timestamp: "2026-09-03T10:00:00.000Z",
    });
    const events = transformTranscriptText(line + "\n");
    const prompts = events.filter((e) => e.type === "user_prompt");
    assert.equal(prompts.length, 1);
    assert.equal(prompts[0].summary, `user prompt (${secretPrompt.length} chars)`);
    assert.ok(!journalToJsonl(events).includes("hunter2"));
  });

  it("golden: buildProvenance on imported events reports the session facts", () => {
    const events = transformTranscriptText(fixtureText);
    const l2 = buildProvenance(events, {
      generatedAt: FIXED,
      cwd: root,
      generator: { name: "innsigle-provenance", version: "0.1.0", uri: null },
    });
    assert.equal(l2.metrics.user_prompts, 3);
    assert.equal(l2.metrics.assistant_turns, 5);
    assert.equal(l2.metrics.tool_calls, 1);
    assert.equal(l2.metrics.skill_invocations, 1);
    assert.equal(l2.metrics.files_touched, 1);
    assert.deepEqual(
      l2.models.map((m) => m.name),
      ["claude-opus-5"],
    );
    assert.equal(l2.artifacts.length, 1);
    assert.equal(l2.artifacts[0].path, "posts/demo/index.qmd");
    assert.equal(l2.artifacts[0].by, "model");
    assert.equal(l2.composition_suggestion, "model-primary");
    assert.equal(l2.session.id, "0f0f0f0f-1111-4222-8333-444455556666");
  });

  it("proposeColo on the imported L2 names the model, tool, and skill", () => {
    const events = transformTranscriptText(fixtureText);
    const l2 = buildProvenance(events, { generatedAt: FIXED, cwd: root });
    const colo = proposeColo(l2, { provenanceDigestHex: "c".repeat(64) });
    assert.equal(colo.composition, "model-primary");
    assert.ok(colo.ingredients.some((i) => i.kind === "model" && i.name === "claude-opus-5"));
    assert.ok(colo.ingredients.some((i) => i.kind === "tool" && i.name === "sloptimizer"));
    assert.ok(colo.ingredients.some((i) => i.kind === "tool" && i.name === "Bash"));
    assert.ok(colo.ingredients.some((i) => i.kind === "human"));
    assert.match(colo.notes, /user_prompts=3/);
  });

  it("never hard-fails on drifted or garbage input", () => {
    const events = transformTranscriptText('{"type":"mystery-record"}\nnot json at all\n');
    assert.equal(events[0].type, "session_start");
    assert.equal(events[events.length - 1].type, "session_end");
    assert.ok(events.some((e) => e.type === "note"));
    // Still a valid journal even with no recognizable messages.
    parseJournal(journalToJsonl(events));
  });

  it("cmdProvenanceImport writes a loadable journal with --out", () => {
    const tmp = join(root, ".tmp-test-import");
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
    const out = join(tmp, "journal.jsonl");
    const exits = [];
    const errs = [];
    cmdProvenanceImport(["claude-code", fixture, "--out", out], {
      exit: (code) => exits.push(code),
      error: (m) => errs.push(m),
    });
    assert.deepEqual(exits, [0]);
    const events = loadJournal(out);
    assert.equal(events[0].type, "session_start");
    assert.equal(events.filter((e) => e.type === "user_prompt").length, 3);
    assert.ok(errs.some((m) => /imported \d+ events/.test(m)));
    rmSync(tmp, { recursive: true, force: true });
  });

  it("cmdProvenanceImport rejects unknown harness with usage exit", () => {
    const exits = [];
    const errs = [];
    cmdProvenanceImport(["codex", "whatever.jsonl"], {
      exit: (code) => exits.push(code),
      error: (m) => errs.push(m),
    });
    assert.deepEqual(exits, [1]);
    assert.ok(errs.length >= 1);
  });
});
