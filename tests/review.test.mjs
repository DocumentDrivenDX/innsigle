import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { generateEd25519, b64url, sha256Hex, signPayload } from "../src/crypto.mjs";
import { jcs } from "../src/canonical.mjs";
import { runSeal } from "../src/seal.mjs";
import { runEndorse } from "../src/endorse.mjs";
import { runReview, makeRoles, checkReview, REVIEW_TYPE } from "../src/review.mjs";
import { runDerive, runVerifyDerived, checkDerivation, DERIVATION_TYPE } from "../src/derive.mjs";
import { runStatus, runVerifyAll } from "../src/status.mjs";
import { frontmatterValue } from "../src/frontmatter.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "src/cli.mjs");
const T0 = "2026-11-01T00:00:00Z";
const clock = (iso) => () => iso;
const origCwd = process.cwd();
afterEach(() => process.chdir(origCwd));

/** Fresh repo: human + build key (build endorsed), cwd switched into it. */
function setup({ attestationKey = true, extraConfig = {} } = {}) {
  const repo = mkdtempSync(join(tmpdir(), "innsigle-review-"));
  const human = generateEd25519();
  const build = generateEd25519();
  mkdirSync(join(repo, ".innsigle/public/claims"), { recursive: true });
  mkdirSync(join(repo, ".innsigle/keys"), { recursive: true });
  writeFileSync(join(repo, ".innsigle/keys/human.pem"), human.privateKeyPem);
  writeFileSync(join(repo, ".innsigle/keys/build.pem"), build.privateKeyPem);
  const keyUrl = "https://example.com/.well-known/innsigle/keys.json";
  const k = (kp, role) => ({
    key_id: kp.keyId, alg: "ed25519", public_key: b64url(kp.publicKeyRaw),
    created_at: "2026-10-01T00:00:00Z", revoked_at: null, role,
  });
  writeFileSync(
    join(repo, ".innsigle/public/keys.json"),
    JSON.stringify({
      innsigle_issuer: "1", issuer_id: "t", issuer_name: "T",
      keys: [k(human, "human"), k(build, "build")], endorsements: [],
    }, null, 2),
  );
  writeFileSync(
    join(repo, ".innsigle/config.json"),
    JSON.stringify({
      schema_version: "1",
      issuer: { id: "t", name: "T", key_id: human.keyId, key_url: keyUrl },
      content_globs: ["docs/**/*.md"],
      kind_from_frontmatter: { field: "composition" },
      ...(attestationKey ? { attestation_key: { frontmatter: "ddx.id" } } : {}),
      keys: {
        human: { key_id: human.keyId, role: "human", signing_key: ".innsigle/keys/human.pem" },
        build: { key_id: build.keyId, role: "build", signing_key: ".innsigle/keys/build.pem" },
      },
      ...extraConfig,
    }, null, 2),
  );
  mkdirSync(join(repo, "docs"), { recursive: true });
  process.chdir(repo);
  const quiet = { log() {}, err() {}, out() {} };
  assert.equal(
    runEndorse(["--subject-key-id", build.keyId], { nowIso: clock(T0) }),
    0,
  );
  return { repo, human, build, quiet, keyUrl };
}

function doc(repo, name, id, composition = "model-primary", body) {
  const p = join(repo, "docs", name);
  writeFileSync(p, `---\ncomposition: ${composition}\nddx:\n  id: ${id}\n---\n\n# ${id}\n\n${body ?? "Body one."}\n`);
  return p;
}

const attOf = (repo, id) =>
  JSON.parse(readFileSync(join(repo, `.innsigle/public/claims/id-${id}.attestation.json`), "utf8"));
const sealAll = (q, role = "build") => runSeal(["--all", "--role", role], { nowIso: clock(T0), ...q });
const review = (args, q, iso = "2026-11-02T00:00:00Z") =>
  runReview([...args, "--yes"], { nowIso: clock(iso), ...q });
function capture(fn) {
  const lines = [];
  const code = fn((s) => lines.push(s));
  return { code, lines };
}
const verifyAll = (extra, iso) =>
  capture((out) => runVerifyAll(extra, { out, err() {}, nowIso: clock(iso || "2026-11-03T00:00:00Z") }));
const statusOf = (extra, iso) => {
  const lines = [];
  runStatus(extra, { out: (s) => lines.push(s), err() {}, nowIso: clock(iso || "2026-11-03T00:00:00Z") });
  return lines;
};

describe("review claim", () => {
  it("review of a model-primary doc is accepted and leaves composition and authorship untouched", () => {
    const { repo, quiet } = setup();
    doc(repo, "a.md", "t.a");
    assert.equal(sealAll(quiet), 0);
    const before = attOf(repo, "t.a");
    assert.equal(before.payload.colophon.composition, "model-primary");
    assert.equal(review(["docs/a.md"], quiet), 0);
    const after = attOf(repo, "t.a");
    assert.equal(jcs(after.payload), jcs(before.payload), "authorship payload unchanged");
    assert.deepEqual(after.signatures, before.signatures, "authorship signature unchanged");
    assert.equal(after.payload.colophon.composition, "model-primary");
    assert.equal(after.reviews.length, 1);
    const r = after.reviews[0].payload;
    assert.equal(r.type, REVIEW_TYPE);
    assert.equal("colophon" in r, false, "review carries no colophon (FR-4a)");
    assert.equal(r.review.scope, "full");
    assert.equal(r.review.reviewer.name, undefined, "key-id only by default");
    assert.match(statusOf([]).join("\n"), /REVIEWED/);
    assert.equal(verifyAll(["--require-review"]).code, 0);
  });

  it("reviewer name is optional and omitted with --anonymous", () => {
    const { repo, quiet } = setup({ extraConfig: { review: { reviewer_name: "Pat Example" } } });
    doc(repo, "a.md", "t.a");
    sealAll(quiet);
    review(["docs/a.md"], quiet);
    assert.equal(attOf(repo, "t.a").reviews[0].payload.review.reviewer.name, "Pat Example");
    review(["docs/a.md", "--anonymous", "--force"], quiet);
    assert.equal(attOf(repo, "t.a").reviews[0].payload.review.reviewer.name, undefined);
    assert.equal(attOf(repo, "t.a").reviews.length, 1, "same reviewer/digest/scope is replaced");
  });

  it("an edit after review makes it REVIEW-STALE and a build-role reseal keeps the human review", () => {
    const { repo, quiet } = setup();
    const p = doc(repo, "a.md", "t.a");
    sealAll(quiet);
    review(["docs/a.md"], quiet);
    const reviewBefore = attOf(repo, "t.a").reviews[0];
    writeFileSync(p, readFileSync(p, "utf8") + "\nAn edit.\n");
    // authorship is STALE too until resealed; review column already says so
    assert.match(statusOf(["--reviews"]).join("\n"), /STALE .*REVIEW-STALE/);
    assert.equal(runSeal(["--all", "--role", "build"], { nowIso: clock("2026-11-04T00:00:00Z"), ...quiet }), 0);
    const merged = attOf(repo, "t.a");
    assert.equal(merged.reviews.length, 1, "merge did not drop the human review");
    assert.deepEqual(merged.reviews[0], reviewBefore, "review kept verbatim");
    const lines = statusOf([], "2026-11-05T00:00:00Z");
    assert.match(lines.join("\n"), /VALID docs\/a\.md .*REVIEW-STALE/);
    assert.equal(verifyAll(["--require-review"], "2026-11-05T00:00:00Z").code, 6);
    // re-review supersedes the stale entry
    assert.equal(review(["--stale"], quiet, "2026-11-06T00:00:00Z"), 0);
    assert.equal(attOf(repo, "t.a").reviews.length, 1);
    assert.equal(verifyAll(["--require-review"], "2026-11-07T00:00:00Z").code, 0);
  });

  it("a build-role key cannot review", () => {
    const { repo, build, quiet } = setup();
    doc(repo, "a.md", "t.a");
    sealAll(quiet);
    // 1. the command refuses the build role outright
    assert.equal(review(["docs/a.md", "--role", "build"], quiet), 1);
    // 2. a build pem smuggled in as the human key fails the self-verify, writes nothing
    process.env.INNSIGLE_HUMAN_KEY = build.privateKeyPem;
    try {
      assert.notEqual(review(["docs/a.md"], quiet), 0);
    } finally {
      delete process.env.INNSIGLE_HUMAN_KEY;
    }
    assert.equal(attOf(repo, "t.a").reviews, undefined);
    // 3. a review forged offline with the build key is REVIEW-INVALID(wrong_role)
    const att = attOf(repo, "t.a");
    const payload = {
      innsigle: "1", type: REVIEW_TYPE, issued_at: T0,
      issuer: { id: "t", name: "T", key_id: build.keyId, key_url: "https://example.com/k.json" },
      subjects: [{ digest: att.payload.subjects[0].digest }],
      review: { schema_version: "1", reviewer: { key_id: build.keyId }, scope: "full" },
    };
    att.reviews = [{
      payload, payload_encoding: "json",
      signatures: [{ key_id: build.keyId, alg: "ed25519", sig: b64url(signPayload(payload, build.privateKeyPem)), signed_at: T0 }],
    }];
    writeFileSync(join(repo, ".innsigle/public/claims/id-t.a.attestation.json"), JSON.stringify(att));
    assert.match(statusOf(["--reviews"]).join("\n"), /REVIEW-INVALID\(wrong_role\)/);
    assert.equal(verifyAll(["--require-review"]).code, 6);
  });

  it("an expired review fails the gate; no review fails it; without the flag verify --all is unchanged", () => {
    const { repo, quiet } = setup();
    doc(repo, "a.md", "t.a");
    doc(repo, "b.md", "t.b");
    sealAll(quiet);
    assert.equal(verifyAll([]).code, 0, "plain verify --all ignores reviews");
    assert.equal(verifyAll(["--require-review"]).code, 6, "unreviewed");
    review(["docs/a.md", "--expires", "2026-11-10"], quiet);
    review(["docs/b.md"], quiet);
    assert.equal(verifyAll(["--require-review"], "2026-11-09T00:00:00Z").code, 0);
    const late = verifyAll(["--require-review"], "2026-11-11T00:00:00Z");
    assert.equal(late.code, 6);
    assert.match(late.lines.join("\n"), /REVIEW-EXPIRED/);
    assert.equal(verifyAll([], "2026-11-11T00:00:00Z").code, 0, "authorship still VALID");
  });

  it("review.paths narrows the gate; --require-full-scope rejects partial scope", () => {
    const { repo, quiet } = setup({ extraConfig: { review: { paths: ["docs/a.md"] } } });
    doc(repo, "a.md", "t.a");
    doc(repo, "b.md", "t.b");
    sealAll(quiet);
    review(["docs/a.md", "--scope", "claim-1,claim-2"], quiet);
    assert.equal(verifyAll(["--require-review"]).code, 0, "b.md is out of scope");
    assert.equal(verifyAll(["--require-review", "--require-full-scope"]).code, 6);
  });

  it("refuses to review without a current authorship seal; bulk needs confirmation", () => {
    const { repo, quiet } = setup();
    const p = doc(repo, "a.md", "t.a");
    assert.equal(runReview(["docs/a.md", "--yes"], { nowIso: clock(T0), ...quiet }), 1, "unsealed");
    sealAll(quiet);
    assert.equal(runReview(["docs/a.md"], { nowIso: clock(T0), ...quiet }), 1, "no --yes, not a TTY");
    assert.equal(runReview(["docs/a.md"], { nowIso: clock(T0), confirm: () => false, ...quiet }), 1);
    writeFileSync(p, readFileSync(p, "utf8") + "x\n");
    assert.equal(runReview(["docs/a.md", "--yes"], { nowIso: clock(T0), ...quiet }), 1, "authorship stale");
  });

  it("validation rejects a review carrying a colophon or composition", () => {
    const { repo, human, quiet } = setup();
    doc(repo, "a.md", "t.a");
    sealAll(quiet);
    review(["docs/a.md"], quiet);
    const att = attOf(repo, "t.a");
    const keysDoc = JSON.parse(readFileSync(join(repo, ".innsigle/public/keys.json"), "utf8"));
    const roles = makeRoles({ keysDoc });
    const digest = att.payload.subjects[0].digest.value;
    const mk = (mut) => {
      const payload = structuredClone(att.reviews[0].payload);
      mut(payload);
      return {
        payload, payload_encoding: "json",
        signatures: [{ key_id: human.keyId, alg: "ed25519", sig: b64url(signPayload(payload, human.privateKeyPem)), signed_at: T0 }],
      };
    };
    const now = Date.parse("2026-11-03T00:00:00Z");
    const ok = (r) => checkReview({ review: r, keysDoc, roles, contentDigest: digest, now });
    assert.equal(ok(att.reviews[0]).state, "REVIEWED");
    assert.match(ok(mk((p) => { p.colophon = { composition: "human-authored" }; })).reason, /colophon/);
    assert.match(ok(mk((p) => { p.review.composition = "human-authored"; })).reason, /composition/);
    assert.match(ok(mk((p) => { p.review.scope = []; })).reason, /scope/);
    assert.match(ok(mk((p) => { p.review.expires_at = "2020-01-01T00:00:00Z"; })).reason, /expires_at/);
    // tampering with a signed review breaks the signature
    const t = structuredClone(att.reviews[0]);
    t.payload.review.scope = "full ";
    assert.equal(ok(t).state, "REVIEW-INVALID");
  });

  it("status output is unchanged for projects that do not use reviews", () => {
    const { repo, quiet } = setup();
    doc(repo, "a.md", "t.a");
    sealAll(quiet);
    const text = statusOf([]).join("\n");
    assert.doesNotMatch(text, /REVIEW|review/);
  });
});

describe("stable document id keying", () => {
  it("a renamed file keeps its seal and review", () => {
    const { repo, quiet } = setup();
    doc(repo, "a.md", "t.a");
    sealAll(quiet);
    review(["docs/a.md"], quiet);
    mkdirSync(join(repo, "docs/moved"), { recursive: true });
    renameSync(join(repo, "docs/a.md"), join(repo, "docs/moved/renamed.md"));
    const text = statusOf(["--reviews"]).join("\n");
    assert.match(text, /VALID docs\/moved\/renamed\.md \(id-t\.a\.attestation\.json\) REVIEWED/);
    assert.equal(verifyAll(["--require-review"]).code, 0);
    assert.equal(runSeal(["--all", "--role", "build"], { nowIso: clock(T0), ...quiet }), 0);
    assert.equal(existsSync(join(repo, ".innsigle/public/claims/docs-a-md.attestation.json")), false);
  });

  it("path keying still orphans on rename (default, unchanged)", () => {
    const { repo, quiet } = setup({ attestationKey: false });
    doc(repo, "a.md", "t.a");
    sealAll(quiet);
    renameSync(join(repo, "docs/a.md"), join(repo, "docs/b.md"));
    assert.match(statusOf([]).join("\n"), /ORPHAN/);
  });

  it("seal fails when the id is missing, malformed or duplicated", () => {
    const { repo, quiet } = setup();
    writeFileSync(join(repo, "docs/noid.md"), "---\ncomposition: mixed\n---\n\nhi\n");
    assert.equal(sealAll(quiet), 5);
    writeFileSync(join(repo, "docs/noid.md"), "---\ncomposition: mixed\nddx:\n  id: Not Valid\n---\n\nhi\n");
    assert.equal(sealAll(quiet), 5);
    writeFileSync(join(repo, "docs/noid.md"), "---\ncomposition: mixed\nddx:\n  id: t.same\n---\n\nhi\n");
    writeFileSync(join(repo, "docs/two.md"), "---\ncomposition: mixed\nddx:\n  id: t.same\n---\n\nho\n");
    assert.equal(sealAll(quiet), 5);
  });

  it("content digest is the SHA-256 of the exact bytes, front matter included", () => {
    const { repo, quiet } = setup();
    const p = doc(repo, "a.md", "t.a");
    sealAll(quiet);
    assert.equal(
      attOf(repo, "t.a").payload.subjects[0].digest.value,
      sha256Hex(readFileSync(p)),
    );
    // front matter is part of the content: touching it stales the seal
    writeFileSync(p, readFileSync(p, "utf8").replace("composition: model-primary", "composition: model-primary\nstatus: draft"));
    assert.match(statusOf([]).join("\n"), /STALE docs\/a\.md/);
  });

  it("frontmatterValue reads nested, flat and quoted ids", () => {
    assert.equal(frontmatterValue("---\nddx:\n  id: x.y\n---\n", "ddx.id"), "x.y");
    assert.equal(frontmatterValue("---\nddx.id: \"x.z\"  # c\n---\n", "ddx.id"), "x.z");
    assert.equal(frontmatterValue("---\nother:\n  id: no\nddx:\n  type: t\n---\n", "ddx.id"), undefined);
    assert.equal(frontmatterValue("no front matter", "ddx.id"), undefined);
    assert.equal(frontmatterValue("﻿---\r\nddx:\r\n  id: crlf\r\n---\r\n", "ddx.id"), "crlf");
  });
});

describe("derivation across a build", () => {
  function built(repo) {
    const tree = join(repo, "site");
    mkdirSync(tree, { recursive: true });
    return tree;
  }
  const out = (repo, tree) => (rel, text) => {
    mkdirSync(dirname(join(tree, rel)), { recursive: true });
    writeFileSync(join(tree, rel), text);
  };
  /** Publish keys + endorsements into the tree like `innsigle publish` does. */
  const publish = (repo, tree) =>
    cpSync(join(repo, ".innsigle/public"), join(tree, ".well-known/innsigle"), { recursive: true });
  const derive = (args, q, iso = "2026-11-03T00:00:00Z") =>
    runDerive(args, { nowIso: clock(iso), ...q });
  const verifyTree = (tree, extra = [], iso = "2026-11-04T00:00:00Z") =>
    capture((o) => runVerifyDerived(["--derived", tree, ...extra], { out: o, err() {}, nowIso: clock(iso) }));

  function chain() {
    const ctx = setup();
    const { repo, quiet } = ctx;
    doc(repo, "a.md", "t.a");
    doc(repo, "b.md", "t.b");
    sealAll(quiet);
    review(["--all"], quiet);
    const tree = built(repo);
    const w = out(repo, tree);
    w("a/index.html", "<h1>a</h1>");
    w("b/index.html", "<h1>b</h1>");
    return { ...ctx, tree, w };
  }

  it("verifies the full chain and embeds the human review verbatim", () => {
    const { repo, tree, quiet } = chain();
    assert.equal(derive(["--tree", tree, "--from", "docs/a.md", "--output", "a/index.html", "--transform", "render@1"], quiet), 0);
    publish(repo, tree);
    const r = verifyTree(tree);
    assert.equal(r.code, 0, r.lines.join("\n"));
    const d = JSON.parse(readFileSync(join(tree, ".well-known/innsigle/derivations/a-index-html.derivation.json"), "utf8"));
    assert.deepEqual(d.payload.derivation.inputs[0].reviews[0], attOf(repo, "t.a").reviews[0]);
    assert.equal(d.signatures[0].key_id, JSON.parse(readFileSync(join(repo, ".innsigle/config.json"), "utf8")).keys.build.key_id);
    assert.equal(d.payload.derivation.transform.version, "1");
  });

  it("each broken link fails with its own reason", () => {
    const { repo, tree, w, human, build, quiet } = chain();
    assert.equal(derive(["--tree", tree, "--from", "docs/a.md", "--output", "a/index.html"], quiet), 0);
    publish(repo, tree);
    const dpath = join(tree, ".well-known/innsigle/derivations/a-index-html.derivation.json");
    const good = readFileSync(dpath, "utf8");
    const reset = () => writeFileSync(dpath, good);

    // output edited
    w("a/index.html", "<h1>tampered</h1>");
    let r = verifyTree(tree);
    assert.equal(r.code, 3);
    assert.match(r.lines.join("\n"), /output_mismatch/);
    w("a/index.html", "<h1>a</h1>");

    // source changed since the build (only when asked)
    const srcPath = join(repo, "docs/a.md");
    const srcGood = readFileSync(srcPath, "utf8");
    writeFileSync(srcPath, srcGood + "late edit\n");
    assert.equal(verifyTree(tree).code, 0, "no --source-root: chain alone");
    r = verifyTree(tree, ["--source-root", repo]);
    assert.equal(r.code, 6);
    assert.match(r.lines.join("\n"), /source_changed/);
    writeFileSync(srcPath, srcGood);

    // wrong role: derivation signed by the human key
    const d = JSON.parse(good);
    const resign = (payload, pem, keyId) => {
      const p = structuredClone(payload);
      p.issuer.key_id = keyId;
      writeFileSync(dpath, JSON.stringify({
        payload: p, payload_encoding: "json",
        signatures: [{ key_id: keyId, alg: "ed25519", sig: b64url(signPayload(p, pem)), signed_at: T0 }],
      }));
    };
    resign(d.payload, human.privateKeyPem, human.keyId);
    r = verifyTree(tree);
    assert.equal(r.code, 4);
    assert.match(r.lines.join("\n"), /wrong_role/);

    // review missing
    const noReview = structuredClone(d.payload);
    noReview.derivation.inputs[0].reviews = [];
    resign(noReview, build.privateKeyPem, build.keyId);
    r = verifyTree(tree);
    assert.equal(r.code, 6);
    assert.match(r.lines.join("\n"), /review_missing/);

    // embedded review signed by the build key (laundering attempt)
    const forged = structuredClone(d.payload);
    const rp = structuredClone(forged.derivation.inputs[0].reviews[0].payload);
    rp.issuer.key_id = build.keyId;
    rp.review.reviewer.key_id = build.keyId;
    forged.derivation.inputs[0].reviews = [{
      payload: rp, payload_encoding: "json",
      signatures: [{ key_id: build.keyId, alg: "ed25519", sig: b64url(signPayload(rp, build.privateKeyPem)), signed_at: T0 }],
    }];
    resign(forged, build.privateKeyPem, build.keyId);
    r = verifyTree(tree);
    assert.equal(r.code, 6);
    assert.match(r.lines.join("\n"), /review_invalid\(wrong_role\)/);

    // embedded review re-signed by build key after edit of digest: stale
    const stale = structuredClone(d.payload);
    stale.derivation.inputs[0].digest.value = "0".repeat(64);
    resign(stale, build.privateKeyPem, build.keyId);
    r = verifyTree(tree);
    assert.equal(r.code, 6);
    assert.match(r.lines.join("\n"), /review_stale/);

    // tampered claim → bad signature
    reset();
    const tampered = JSON.parse(good);
    tampered.payload.derivation.transform = { name: "evil" };
    writeFileSync(dpath, JSON.stringify(tampered));
    assert.equal(verifyTree(tree).code, 2);

    // unendorsed build key: drop the endorsement everywhere
    reset();
    const noEnd = join(repo, "noend");
    mkdirSync(noEnd);
    writeFileSync(join(noEnd, "keys.json"), readFileSync(join(repo, ".innsigle/public/keys.json")));
    rmSync(join(tree, ".well-known/innsigle/endorsements"), { recursive: true });
    r = verifyTree(tree, ["--keys", join(noEnd, "keys.json")]);
    assert.equal(r.code, 4);
    assert.match(r.lines.join("\n"), /build_key_unendorsed/);
  });

  it("an expired embedded review fails the chain", () => {
    const { repo, tree, quiet } = chain();
    review(["docs/a.md", "--force", "--expires", "2026-11-10"], quiet);
    assert.equal(derive(["--tree", tree, "--from", "docs/a.md", "--output", "a/index.html"], quiet), 0);
    publish(repo, tree);
    assert.equal(verifyTree(tree, [], "2026-11-09T00:00:00Z").code, 0);
    const r = verifyTree(tree, [], "2026-11-11T00:00:00Z");
    assert.equal(r.code, 6);
    assert.match(r.lines.join("\n"), /review_expired/);
  });

  it("a bundle needs every source reviewed; --require-review refuses to build otherwise", () => {
    const { repo, tree, w, quiet } = chain();
    doc(repo, "c.md", "t.c");
    sealAll(quiet);
    w("bundle.json", "{}");
    assert.equal(
      derive(["--tree", tree, "--from", "docs/a.md", "--from", "docs/c.md", "--output", "bundle.json", "--require-review"], quiet),
      6,
    );
    assert.equal(derive(["--tree", tree, "--from", "docs/a.md", "--from", "docs/c.md", "--output", "bundle.json"], quiet), 0);
    publish(repo, tree);
    const bad = verifyTree(tree);
    assert.equal(bad.code, 6);
    assert.match(bad.lines.join("\n"), /docs\/c\.md: review_missing/);
    review(["docs/c.md"], quiet);
    assert.equal(derive(["--tree", tree, "--from", "docs/a.md", "--from", "docs/c.md", "--output", "bundle.json"], quiet), 0);
    const ok = verifyTree(tree);
    assert.equal(ok.code, 0, ok.lines.join("\n"));
    assert.match(ok.lines.join("\n"), /inputs=2/);
  });

  it("one derivation may cover several outputs; --cover flags underived files", () => {
    const { repo, tree, w, quiet } = chain();
    assert.equal(
      derive(["--tree", tree, "--from", "docs/a.md", "--output", "a/index.html", "--output", "a/index.json"], quiet),
      1,
      "missing output file",
    );
    w("a/index.json", "{}");
    assert.equal(
      derive(["--tree", tree, "--from", "docs/a.md", "--output", "a/index.html", "--output", "a/index.json"], quiet),
      0,
    );
    publish(repo, tree);
    assert.equal(verifyTree(tree, ["--cover", "a/*"]).code, 0);
    const r = verifyTree(tree, ["--cover", "**/*.html"]);
    assert.equal(r.code, 3, "b/index.html has no derivation");
    assert.match(r.lines.join("\n"), /b\/index\.html: no_derivation/);
  });

  it("derive refuses a non-build or unendorsed key and verify refuses an empty tree", () => {
    const { repo, tree, quiet } = chain();
    // the human key standing in as the build key
    const cfgPath = join(repo, ".innsigle/config.json");
    const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
    cfg.keys.build.key_id = cfg.keys.human.key_id;
    cfg.keys.build.signing_key = cfg.keys.human.signing_key;
    writeFileSync(cfgPath, JSON.stringify(cfg));
    assert.equal(derive(["--tree", tree, "--from", "docs/a.md", "--output", "a/index.html"], quiet), 1);
    assert.equal(verifyTree(tree).code, 3, "no derivation claims in the tree");
  });
});

describe("cli wiring", () => {
  it("review and verify gate run through the real binary", () => {
    const { repo, quiet } = setup();
    doc(repo, "a.md", "t.a");
    sealAll(quiet);
    const run = (...a) => spawnSync(process.execPath, [cli, ...a], { cwd: repo, encoding: "utf8" });
    assert.equal(run("verify", "--all", "--require-review").status, 6);
    assert.equal(run("review", "docs/a.md").status, 1, "needs --yes off a TTY");
    assert.equal(run("review", "docs/a.md", "--yes").status, 0);
    assert.equal(run("verify", "--all", "--require-review").status, 0);
    assert.match(run("status", "--reviews").stdout, /REVIEWED/);
  });
});
