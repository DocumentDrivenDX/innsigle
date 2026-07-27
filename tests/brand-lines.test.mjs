/**
 * Source-surface brand line conformance (A1/B4 locks).
 * No second site build — site-build.test.mjs owns rendered site/ asserts.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND, includesA1Phrase } from "../scripts/brand-lines.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

/** Text before first ## heading, skipping fenced code blocks when scanning. */
function readmeLead(md) {
  let i = 0;
  let inFence = false;
  const lines = md.split("\n");
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && line.startsWith("## ")) break;
  }
  return lines.slice(0, i).join("\n");
}

describe("brand lines (A1/B4 source lint)", () => {
  it("build-site imports brand-lines and uses BRAND.B4", () => {
    const src = read("scripts/build-site.mjs");
    assert.match(src, /from ["']\.\/brand-lines\.mjs["']/);
    assert.match(src, /BRAND\.B4/);
  });

  it("e2e imports brand-lines; no raw B4/SAMPLE/WALKTHROUGH literals; anti-vacuity markers", () => {
    const src = read("e2e/design-voice.spec.ts");
    assert.match(src, /brand-lines\.mjs/);
    assert.ok(!src.includes(BRAND.B4), "e2e must not hardcode B4 string");
    assert.ok(!src.includes(BRAND.SAMPLE_CUE), "e2e must not hardcode SAMPLE_CUE");
    assert.ok(!src.includes(BRAND.WALKTHROUGH_CUE), "e2e must not hardcode WALKTHROUGH_CUE");
    assert.match(src, /toBeGreaterThanOrEqual\(1\)/);
    assert.match(src, /BRAND\.SAMPLE_CUE/);
  });

  it("home curated H1 and description", () => {
    const md = read("docs/website/content/curated/index.md");
    assert.ok(md.includes(`# ${BRAND.B4}`));
    assert.ok(md.includes(BRAND.B4));
    assert.ok(includesA1Phrase(md));
  });

  it("non-goals contains A1 phrase", () => {
    assert.ok(includesA1Phrase(read("docs/website/content/curated/non-goals.md")));
  });

  it("sample snippet contains B4", () => {
    assert.ok(read("docs/sample/snippets/footer.html").includes(BRAND.B4));
  });

  it("sample page contains SAMPLE_CUE", () => {
    assert.ok(read("docs/sample/index.html").includes(BRAND.SAMPLE_CUE));
  });

  it("walkthrough contains WALKTHROUGH_CUE", () => {
    assert.ok(
      read("docs/website/content/curated/use/walkthrough-provenance.md").includes(
        BRAND.WALKTHROUGH_CUE,
      ),
    );
  });

  it("VOICE documents A1/B4 and brand-lines SSoT", () => {
    const voice = read("docs/website/VOICE.md");
    assert.ok(voice.includes(BRAND.B4));
    assert.ok(voice.includes(BRAND.A1));
    assert.match(voice, /brand-lines\.mjs/);
    assert.match(voice, /case-insensitive/i);
  });

  it("README lead is job-first with B4 and A1", () => {
    const lead = readmeLead(read("README.md"));
    assert.ok(lead.includes(BRAND.B4), "README lead must include B4");
    assert.ok(includesA1Phrase(lead), "README lead must include A1 phrase");
    const det = "Not an AI detector";
    if (lead.includes(det)) {
      assert.ok(
        lead.indexOf(BRAND.B4) < lead.indexOf(det),
        "B4 must appear before detector phrase in lead",
      );
    }
  });
});
