/**
 * Curated-site claim hygiene: P0 pages link sample or verify; no empty boosters.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const curated = join(root, "docs/website/content/curated");

function walkMd(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkMd(p, acc);
    else if (name.endsWith(".md")) acc.push(p);
  }
  return acc;
}

const BOOSTERS = [/\bseamless\b/i, /\bempower(?:s|ing)?\b/i, /\bunlock(?:s|ing)?\b/i, /\brevolutionary\b/i];

const P0 = [
  "index.md",
  "why/index.md",
  "use/cli.md",
  "use/verify.md",
];

/** P2: scene or Check it + concrete proof word */
const P2 = [
  "use/issuer.md",
  "use/marks.md",
  "use/provenance.md",
  "use/walkthrough-docs.md",
  "use/walkthrough-social.md",
  "use/walkthrough-provenance.md",
  "reference/index.md",
];

describe("curated voice + proof spine", () => {
  it("CLAIM-MAP and VOICE exist", () => {
    assert.match(readFileSync(join(root, "docs/website/CLAIM-MAP.md"), "utf8"), /Public claim map/);
    assert.match(readFileSync(join(root, "docs/website/VOICE.md"), "utf8"), /Proof boxes/);
    assert.match(readFileSync(join(root, "docs/website/VOICE.md"), "utf8"), /CLAIM-MAP/);
  });

  it("P0 pages include sample or verify proof affordance", () => {
    for (const rel of P0) {
      const text = readFileSync(join(curated, rel), "utf8");
      const hasProof =
        /sample/i.test(text) &&
        (/Check it/i.test(text) || /innsigle verify/i.test(text) || /npx innsigle verify/i.test(text));
      assert.ok(hasProof, `${rel} needs Check it / sample verify path`);
    }
  });

  it("curated pages avoid empty boosters", () => {
    for (const file of walkMd(curated)) {
      const text = readFileSync(file, "utf8");
      for (const re of BOOSTERS) {
        assert.ok(!re.test(text), `${file} matches booster ${re}`);
      }
    }
  });

  it("home keeps B4 H1 and dual UC + sigil bound", () => {
    const home = readFileSync(join(curated, "index.md"), "utf8");
    assert.match(home, /^# The maker's seal for published work/m);
    assert.match(home, /model-primary/i);
    assert.match(home, /human social|human-authored/i);
    const sigilCount = (home.match(/\bsigil\b/gi) || []).length;
    assert.ok(sigilCount <= 1, `sigil count ${sigilCount}`);
  });

  it("P2 pages stay concrete (sample, check, or you/)", () => {
    for (const rel of P2) {
      const text = readFileSync(join(curated, rel), "utf8");
      const ok =
        /Check it/i.test(text) ||
        /sample/i.test(text) ||
        /\bYou\b/.test(text) ||
        /install/i.test(text);
      assert.ok(ok, `${rel} should open with scene or proof (got dry catalog?)`);
      assert.ok(!/^# .*\n\n\*\*Reader mode:\*\*/m.test(text), `${rel} still uses Reader mode header`);
    }
  });

  it("issuer documents absolute key_url", () => {
    const text = readFileSync(join(curated, "use/issuer.md"), "utf8");
    assert.match(text, /absolute/i);
    assert.match(text, /key_url/);
    assert.match(text, /innsigle (keygen|claim)/i);
  });
});
