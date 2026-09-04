import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "src/cli.mjs");
const fakeOp = join(root, "tests/fixtures/fake-op.mjs");

function run(args, opts = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    ...opts,
  });
}

function setupRepo(name) {
  const repo = mkdtempSync(join(tmpdir(), `innsigle-${name}-`));
  const store = join(repo, "op-store");
  mkdirSync(store, { recursive: true });
  const opLog = join(repo, "op-argv.log");
  writeFileSync(opLog, "");
  const wrapper = join(repo, "op-wrapper");
  writeFileSync(
    wrapper,
    `#!/bin/sh\nexport INNSIGLE_FAKE_OP_STORE="${store}"\nprintf '%s\\n' "$*" >> "${opLog}"\nexec "${process.execPath}" "${fakeOp}" "$@"\n`,
  );
  chmodSync(wrapper, 0o755);
  const env = { ...process.env, INNSIGLE_OP_BIN: wrapper };
  delete env.OP_ACCOUNT;
  const r = run(
    [
      "init",
      "--onepassword",
      "--dir",
      repo,
      "--site-url",
      "https://status.example",
      "--issuer-id",
      "status-test",
      "--issuer-name",
      "Status Test",
      "--vault",
      "Private",
    ],
    { env },
  );
  assert.equal(r.status, 0, r.stderr + r.stdout);
  return { repo, env, opLog };
}

function seal(repo, env, file) {
  const r = run(["seal", file, "--kind", "human-authored"], { cwd: repo, env });
  assert.equal(r.status, 0, r.stderr);
}

describe("innsigle status / verify --all / seal --stale (PLAN-001 A5)", () => {
  it("reports VALID/STALE/ORPHAN/UNSEALED, gates CI, reseals only stale", () => {
    const { repo, env, opLog } = setupRepo("status");
    writeFileSync(join(repo, "a.html"), "<html>a</html>\n");
    writeFileSync(join(repo, "b.html"), "<html>b</html>\n");
    writeFileSync(join(repo, "c.html"), "<html>c</html>\n");
    seal(repo, env, "a.html");
    seal(repo, env, "b.html");
    seal(repo, env, "c.html");

    // drift b, orphan c, leave d unsealed but tracked via content_globs
    writeFileSync(join(repo, "b.html"), "<html>b changed</html>\n");
    unlinkSync(join(repo, "c.html"));
    writeFileSync(join(repo, "d.html"), "<html>d unsealed</html>\n");
    const cfgPath = join(repo, ".innsigle/config.json");
    const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
    cfg.content_globs = ["*.html"];
    writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");

    // status: one line per claim + unsealed
    let r = run(["status"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /^VALID a\.html \(a-html\.attestation\.json\)$/m);
    assert.match(r.stdout, /^STALE b\.html \(b-html\.attestation\.json\)$/m);
    assert.match(r.stdout, /^ORPHAN - \(c-html\.attestation\.json\)$/m);
    assert.match(r.stdout, /^UNSEALED d\.html$/m);
    assert.match(r.stdout, /total=3 valid=1 stale=1 orphan=1 unsealed=1/);

    // verify --all: CI gate, nonzero on any non-VALID
    r = run(["verify", "--all"], { cwd: repo, env });
    assert.notEqual(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stderr, /INVALID/);

    // seal --stale: fixes only b, one op read for the whole run
    writeFileSync(opLog, "");
    r = run(["seal", "--stale"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stderr, /ok: resealed b\.html/);
    assert.doesNotMatch(r.stderr, /a\.html/);
    const reads = readFileSync(opLog, "utf8")
      .split("\n")
      .filter((l) => /(^|\s)read op:\/\//.test(l));
    assert.equal(reads.length, 1, `expected one op read, got: ${reads.join(" | ")}`);

    r = run(["status"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /^VALID b\.html \(b-html\.attestation\.json\)$/m);
    assert.match(r.stdout, /total=3 valid=2 stale=0 orphan=1 unsealed=1/);

    // second --stale run is a no-op
    r = run(["seal", "--stale"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /up to date: no stale claims/);

    // clean up orphan + seal d → verify --all goes green
    unlinkSync(join(repo, ".innsigle/public/claims/c-html.attestation.json"));
    seal(repo, env, "d.html");
    r = run(["verify", "--all"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /VALID all \(3 claim\(s\)\)/);

    rmSync(repo, { recursive: true, force: true });
  });

  it("seal --stale migrates a legacy-named claim to the canonical slug", () => {
    const { repo, env } = setupRepo("legacy");
    writeFileSync(join(repo, "x.html"), "<html>x</html>\n");
    seal(repo, env, "x.html");
    const claims = join(repo, ".innsigle/public/claims");
    renameSync(
      join(claims, "x-html.attestation.json"),
      join(claims, "x.attestation.json"),
    );

    // legacy name still resolves to its source
    let r = run(["status"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /^VALID x\.html \(x\.attestation\.json\)$/m);

    // drift → stale under the legacy name; reseal writes canonical + drops legacy
    writeFileSync(join(repo, "x.html"), "<html>x2</html>\n");
    r = run(["seal", "--stale"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /ok: resealed x\.html/);
    assert.ok(existsSync(join(claims, "x-html.attestation.json")));
    assert.equal(existsSync(join(claims, "x.attestation.json")), false);

    r = run(["verify", "--all"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr + r.stdout);

    rmSync(repo, { recursive: true, force: true });
  });

  it("verify --all fails on a tampered signature even when digests match", () => {
    const { repo, env } = setupRepo("sig");
    writeFileSync(join(repo, "s.html"), "<html>s</html>\n");
    seal(repo, env, "s.html");
    const attPath = join(repo, ".innsigle/public/claims/s-html.attestation.json");
    const att = JSON.parse(readFileSync(attPath, "utf8"));
    att.payload.colophon.notes = "laundered"; // payload edit → sig breaks
    writeFileSync(attPath, JSON.stringify(att, null, 2) + "\n");
    // keep digest matching: content untouched → status says VALID…
    let r = run(["status"], { cwd: repo, env });
    assert.match(r.stdout, /^VALID s\.html/m);
    // …but verify --all signature-checks and fails
    r = run(["verify", "--all"], { cwd: repo, env });
    assert.notEqual(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /INVALID\(bad_signature\) s\.html/);
    rmSync(repo, { recursive: true, force: true });
  });
});

describe("claim→source inversion safety (F1)", () => {
  /** Repo with a uri-less legacy claim over blog/post.md plus a colliding
   *  assets/post.txt that sorts alphabetically first. */
  function setupCollision(name) {
    const { repo, env } = setupRepo(name);
    mkdirSync(join(repo, "blog"), { recursive: true });
    mkdirSync(join(repo, "assets"), { recursive: true });
    writeFileSync(join(repo, "blog/post.md"), "# the real post\n");
    writeFileSync(join(repo, "assets/post.txt"), "unrelated bytes that sort first\n");
    seal(repo, env, "blog/post.md");
    const claims = join(repo, ".innsigle/public/claims");
    renameSync(
      join(claims, "blog-post-md.attestation.json"),
      join(claims, "post.attestation.json"),
    );
    // uri-less legacy claim: buildClaim can produce these, and the legacy
    // fallback exists to support them
    const attPath = join(claims, "post.attestation.json");
    const att = JSON.parse(readFileSync(attPath, "utf8"));
    delete att.payload.subjects[0].uri;
    writeFileSync(attPath, JSON.stringify(att, null, 2) + "\n");
    return { repo, env, claims, attPath };
  }

  it("digest disambiguates colliding legacy names; --stale never touches the wrong file", () => {
    const { repo, env, claims, attPath } = setupCollision("f1valid");

    // resolves to blog/post.md by digest, never to the first-sorted collider
    let r = run(["status"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /^VALID blog\/post\.md \(post\.attestation\.json\)$/m);
    assert.doesNotMatch(r.stdout, /assets\/post\.txt/);

    // nothing stale → seal --stale must not sign or delete anything
    r = run(["seal", "--stale"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /up to date: no stale claims/);
    assert.ok(existsSync(attPath), "original claim survives");
    assert.equal(existsSync(join(claims, "assets-post-txt.attestation.json")), false);
    rmSync(repo, { recursive: true, force: true });
  });

  it("colliding candidates with no digest match → AMBIGUOUS; verify fails, --stale skips", () => {
    const { repo, env, claims, attPath } = setupCollision("f1ambig");
    writeFileSync(join(repo, "blog/post.md"), "# drifted content\n");

    let r = run(["status"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /^AMBIGUOUS - \(post\.attestation\.json\)$/m);
    assert.match(r.stdout, /ambiguous=1/);
    // never resolved by guess to either candidate
    assert.doesNotMatch(r.stdout, /STALE (assets|blog)\//);

    // CI gate treats AMBIGUOUS as failure
    r = run(["verify", "--all"], { cwd: repo, env });
    assert.notEqual(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /AMBIGUOUS/);

    // seal --stale skips it with a warning: never signs wrong bytes, never
    // deletes the claim (the verifier's F1 end-to-end scenario)
    r = run(["seal", "--stale"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stderr, /warn: skipping AMBIGUOUS claim post\.attestation\.json/);
    assert.match(r.stderr, /up to date: no stale claims/);
    assert.doesNotMatch(r.stderr, /ok: resealed/);
    assert.ok(existsSync(attPath), "original claim survives");
    assert.deepEqual(
      readdirSync(claims).sort(),
      ["post.attestation.json"],
      "no attestation signed for either candidate",
    );
    rmSync(repo, { recursive: true, force: true });
  });
});
