import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  PLAIN_TYPE,
  UNSIGNED_LABEL,
  INTEGRITY_LINE,
  ProfileError,
  addWork,
  bioCard,
  emptyProfile,
  footerLine,
  renderProfileHtml,
  slugify,
  validateProfile,
  workToPlainClaim,
} from "../src/profile.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "src/cli.mjs");
const fixture = join(root, "docs/website/static/examples/profile/profile.json");

function run(args, opts = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    ...opts,
  });
}

const NOW = "2026-09-15T12:00:00Z";

describe("plain seals + maker profile (FEAT-005)", () => {
  it("src/profile.mjs has no node: imports (browser builder)", () => {
    const src = readFileSync(join(root, "src/profile.mjs"), "utf8");
    assert.equal(/\bfrom ["']node:/.test(src), false);
    assert.equal(/\brequire\(["']node:/.test(src), false);
  });

  it("validates the shipped sample profile", () => {
    const p = validateProfile(JSON.parse(readFileSync(fixture, "utf8")));
    assert.equal(p.id, "sample-maker");
    assert.equal(p.works.length, 3);
    assert.equal(p.works[0].colophon.composition, "mixed");
    assert.equal(p.works[2].colophon.composition, "human-authored");
  });

  it("slugify and unique slugs", () => {
    assert.equal(slugify("Q3 strategy memo"), "q3-strategy-memo");
    let p = emptyProfile({ id: "ada", name: "Ada", now: NOW });
    p = addWork(p, { title: "Note", composition: "human-authored" }, { now: NOW });
    p = addWork(p, { title: "Note", composition: "human-authored" }, { now: NOW });
    assert.equal(p.works[0].slug, "note");
    assert.equal(p.works[1].slug, "note-2");
  });

  it("refuses human-authored with a model ingredient (FR-4a)", () => {
    const p = emptyProfile({ id: "ada", name: "Ada", now: NOW });
    assert.throws(
      () =>
        addWork(p, {
          title: "Laundered",
          composition: "human-authored",
          model: "Claude",
        }),
      ProfileError,
    );
    assert.throws(
      () =>
        addWork(p, {
          title: "Laundered",
          colophon: {
            composition: "human-authored",
            ingredients: [{ kind: "model", name: "Claude", role: "draft" }],
          },
        }),
      /human-authored cannot list a model/,
    );
  });

  it("refuses a digest on a plain work", () => {
    const p = emptyProfile({ id: "ada", name: "Ada", now: NOW });
    assert.throws(
      () =>
        addWork(p, {
          title: "Hashed",
          composition: "mixed",
          digest: { alg: "sha256", value: "abc" },
        }),
      /no content digest/,
    );
  });

  it("footer line and bio card", () => {
    let p = emptyProfile({
      id: "ada",
      name: "Ada Maker",
      profile_url: "https://ada.github.io/innsigle/",
      now: NOW,
    });
    p = addWork(
      p,
      { title: "Q3 memo", url: "https://example.com/memo", composition: "mixed", model: "Claude" },
      { now: NOW },
    );
    assert.equal(footerLine(p, "q3-memo"), "Innsigle · mixed · ada.github.io/innsigle#q3-memo");
    assert.equal(bioCard(p), "Innsigle · Ada Maker\nhttps://ada.github.io/innsigle/");
  });

  it("plain claim has no digest and the plain type URI", () => {
    let p = emptyProfile({ id: "ada", name: "Ada", now: NOW });
    p = addWork(p, { title: "Memo", composition: "mixed", model: "Claude" }, { now: NOW });
    const claim = workToPlainClaim(p, "memo");
    assert.equal(claim.type, PLAIN_TYPE);
    assert.equal(claim.subject.digest, undefined);
    assert.equal(claim.issuer, undefined);
    assert.equal(claim.colophon.composition, "mixed");
  });

  it("rendered HTML is unsigned, never VALID", () => {
    const p = validateProfile(JSON.parse(readFileSync(fixture, "utf8")));
    const html = renderProfileHtml(p, { markHrefPrefix: "marks/" });
    assert.match(html, new RegExp(UNSIGNED_LABEL));
    assert.match(html, /Q3 strategy memo/);
    assert.match(html, /Board note/);
    assert.match(html, /id="q3-strategy-memo"/);
    assert.match(html, /The maker's seal for published work/);
    assert.match(html, new RegExp(INTEGRITY_LINE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(/\bVALID\b/.test(html), false);
    assert.equal(/verified authentic/i.test(html), false);
    assert.match(html, /marks\/innsigle-mixed\.svg/);
    assert.match(html, /marks\/innsigle-base\.svg/);
  });

  it("CLI profile init → add → validate → footer → bio → render", () => {
    const dir = mkdtempSync(join(tmpdir(), "innsigle-profile-"));
    try {
      let r = run([
        "profile",
        "init",
        "--id",
        "ada",
        "--name",
        "Ada Maker",
        "--url",
        "https://ada.example/innsigle/",
        "--out-dir",
        dir,
      ]);
      assert.equal(r.status, 0, r.stderr);
      assert.ok(existsSync(join(dir, "profile.json")));
      assert.ok(existsSync(join(dir, "index.html")));

      r = run(
        [
          "profile",
          "add",
          "--profile",
          join(dir, "profile.json"),
          "--title",
          "Q3 strategy memo",
          "--url",
          "https://example.com/memo",
          "--kind",
          "mixed",
          "--model",
          "Claude",
        ],
        { env: { ...process.env } },
      );
      assert.equal(r.status, 0, r.stderr);
      assert.match(r.stdout, /Innsigle · mixed · ada\.example\/innsigle#q3-strategy-memo/);

      r = run(["profile", "validate", "--profile", join(dir, "profile.json")]);
      assert.equal(r.status, 0, r.stderr);
      assert.match(r.stdout, /OK/);
      assert.match(r.stdout, /works=1/);

      r = run(["profile", "bio", "--profile", join(dir, "profile.json")]);
      assert.equal(r.status, 0, r.stderr);
      assert.match(r.stdout, /Ada Maker/);

      r = run([
        "profile",
        "footer",
        "--profile",
        join(dir, "profile.json"),
        "--slug",
        "q3-strategy-memo",
      ]);
      assert.equal(r.status, 0, r.stderr);
      assert.match(r.stdout, /q3-strategy-memo/);

      const html = readFileSync(join(dir, "index.html"), "utf8");
      assert.match(html, /Q3 strategy memo/);
      assert.match(html, new RegExp(UNSIGNED_LABEL));
      assert.equal(/\bVALID\b/.test(html), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("CLI add refuses human-authored + --model", () => {
    const dir = mkdtempSync(join(tmpdir(), "innsigle-profile-launder-"));
    try {
      let r = run(["profile", "init", "--id", "ada", "--name", "Ada", "--out-dir", dir]);
      assert.equal(r.status, 0, r.stderr);
      r = run([
        "profile",
        "add",
        "--profile",
        join(dir, "profile.json"),
        "--title",
        "Nope",
        "--kind",
        "human-authored",
        "--model",
        "Claude",
      ]);
      assert.equal(r.status, 5, r.stderr);
      assert.match(r.stderr, /human-authored cannot list a model/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("verify refuses a maker profile and a plain claim (no VALID)", () => {
    const r = run([
      "verify",
      "--attestation",
      fixture,
      "--content",
      fixture,
      "--keys",
      fixture,
    ]);
    assert.equal(r.status, 5, r.stderr);
    assert.match(r.stderr, /unsigned declaration/i);
    assert.equal(/\bVALID\b/.test(r.stdout), false);

    const dir = mkdtempSync(join(tmpdir(), "innsigle-plain-claim-"));
    try {
      run(["profile", "init", "--id", "ada", "--name", "Ada", "--out-dir", dir]);
      run([
        "profile",
        "add",
        "--profile",
        join(dir, "profile.json"),
        "--title",
        "Memo",
        "--kind",
        "mixed",
        "--model",
        "Claude",
      ]);
      const claimPath = join(dir, "plain.json");
      const c = run([
        "profile",
        "claim",
        "--profile",
        join(dir, "profile.json"),
        "--slug",
        "memo",
        "--out",
        claimPath,
      ]);
      assert.equal(c.status, 0, c.stderr);
      const claim = JSON.parse(readFileSync(claimPath, "utf8"));
      assert.equal(claim.type, PLAIN_TYPE);
      const v = run([
        "verify",
        "--attestation",
        claimPath,
        "--content",
        claimPath,
        "--keys",
        claimPath,
      ]);
      assert.equal(v.status, 5, v.stderr);
      assert.equal(/\bVALID\b/.test(v.stdout), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("init refuses overwrite without --force", () => {
    const dir = mkdtempSync(join(tmpdir(), "innsigle-profile-force-"));
    try {
      let r = run(["profile", "init", "--id", "ada", "--name", "Ada", "--out-dir", dir]);
      assert.equal(r.status, 0, r.stderr);
      r = run(["profile", "init", "--id", "ada", "--name", "Ada", "--out-dir", dir]);
      assert.equal(r.status, 5, r.stderr);
      r = run(["profile", "init", "--id", "ada", "--name", "Ada Two", "--out-dir", dir, "--force"]);
      assert.equal(r.status, 0, r.stderr);
      const p = JSON.parse(readFileSync(join(dir, "profile.json"), "utf8"));
      assert.equal(p.name, "Ada Two");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
