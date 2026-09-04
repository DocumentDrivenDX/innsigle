import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "src/cli.mjs");
const fakeOp = join(root, "tests/fixtures/fake-op.mjs");
const echoOp = join(root, "tests/fixtures/echo-op.mjs");

function run(args, opts = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    ...opts,
  });
}

/** init'd repo with fake 1Password; op wrapper logs each argv line to opLog. */
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
      "https://seal.example",
      "--issuer-id",
      "seal-test",
      "--issuer-name",
      "Seal Test",
      "--vault",
      "Private",
    ],
    { env },
  );
  assert.equal(r.status, 0, r.stderr + r.stdout);
  return { repo, env, opLog };
}

function walkFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkFiles(p, acc);
    else acc.push(p);
  }
  return acc;
}

describe("seal canonical attestation naming (PLAN-001 A1)", () => {
  it("two sibling index.qmd files seal to distinct slug paths", () => {
    const { repo, env } = setupRepo("a1");
    mkdirSync(join(repo, "posts/a"), { recursive: true });
    mkdirSync(join(repo, "posts/b"), { recursive: true });
    writeFileSync(join(repo, "posts/a/index.qmd"), "# post a\n");
    writeFileSync(join(repo, "posts/b/index.qmd"), "# post b\n");

    let r = run(["seal", "posts/a/index.qmd", "--kind", "model-primary"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr);
    r = run(["seal", "posts/b/index.qmd", "--kind", "model-primary"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr);

    const claims = join(repo, ".innsigle/public/claims");
    assert.ok(existsSync(join(claims, "posts-a-index-qmd.attestation.json")));
    assert.ok(existsSync(join(claims, "posts-b-index-qmd.attestation.json")));
    const a = JSON.parse(
      readFileSync(join(claims, "posts-a-index-qmd.attestation.json"), "utf8"),
    );
    const b = JSON.parse(
      readFileSync(join(claims, "posts-b-index-qmd.attestation.json"), "utf8"),
    );
    assert.notEqual(a.payload.subjects[0].digest.value, b.payload.subjects[0].digest.value);
    rmSync(repo, { recursive: true, force: true });
  });

  it("legacy basename-named attestation still verifies (fallback)", () => {
    const { repo, env } = setupRepo("a1legacy");
    writeFileSync(join(repo, "note.html"), "<html>note</html>\n");
    let r = run(["seal", "note.html", "--kind", "human-authored"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr);
    const claims = join(repo, ".innsigle/public/claims");
    renameSync(
      join(claims, "note-html.attestation.json"),
      join(claims, "note.attestation.json"),
    );
    r = run(["verify", "note.html"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /VALID/);
    rmSync(repo, { recursive: true, force: true });
  });
});

describe("seal idempotence + self-verify (PLAN-001 A2)", () => {
  it("seal → seal is a no-op; --force re-seals", () => {
    const { repo, env, opLog } = setupRepo("a2");
    writeFileSync(join(repo, "page.html"), "<html>stable</html>\n");
    let r = run(["seal", "page.html", "--kind", "human-authored"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /ok: sealed/);

    writeFileSync(opLog, ""); // second seal must not even read the key
    r = run(["seal", "page.html", "--kind", "human-authored"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /up to date: /);
    assert.doesNotMatch(r.stderr, /ok: sealed/);
    assert.doesNotMatch(readFileSync(opLog, "utf8"), /read op:\/\//);

    r = run(["seal", "page.html", "--kind", "human-authored", "--force"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /ok: sealed/);
    rmSync(repo, { recursive: true, force: true });
  });

  it("corrupted issuer key → INVALID, no attestation file kept", () => {
    const { repo, env } = setupRepo("a2bad");
    const keysPath = join(repo, ".innsigle/public/keys.json");
    const keys = JSON.parse(readFileSync(keysPath, "utf8"));
    keys.keys[0].public_key = Buffer.alloc(32, 1).toString("base64url");
    writeFileSync(keysPath, JSON.stringify(keys, null, 2) + "\n");

    writeFileSync(join(repo, "other.html"), "<html>other</html>\n");
    const r = run(["seal", "other.html", "--kind", "human-authored"], { cwd: repo, env });
    assert.notEqual(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stderr, /INVALID: seal self-verify failed/);
    assert.equal(
      existsSync(join(repo, ".innsigle/public/claims/other-html.attestation.json")),
      false,
    );
    rmSync(repo, { recursive: true, force: true });
  });
});

describe("1Password bridging (PLAN-001 A3)", () => {
  it("INNSIGLE_OP_BIN with arguments is split and prepended", async () => {
    const dir = mkdtempSync(join(tmpdir(), "innsigle-a3-"));
    const log = join(dir, "argv.log");
    writeFileSync(log, "");
    const prevBin = process.env.INNSIGLE_OP_BIN;
    const prevLog = process.env.INNSIGLE_ECHO_OP_LOG;
    process.env.INNSIGLE_OP_BIN = `${process.execPath} ${echoOp} --flavor mac`;
    process.env.INNSIGLE_ECHO_OP_LOG = log;
    try {
      const { opCommand, runOp } = await import("../src/onepassword.mjs");
      const cmd = opCommand();
      assert.equal(cmd.bin, process.execPath);
      assert.deepEqual(cmd.preArgs, [echoOp, "--flavor", "mac"]);
      const r = runOp(["--version"]);
      assert.equal(r.status, 0, r.stderr);
      const lines = readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l));
      assert.deepEqual(lines.at(-1), ["--flavor", "mac", "--version"]);
    } finally {
      if (prevBin === undefined) delete process.env.INNSIGLE_OP_BIN;
      else process.env.INNSIGLE_OP_BIN = prevBin;
      if (prevLog === undefined) delete process.env.INNSIGLE_ECHO_OP_LOG;
      else process.env.INNSIGLE_ECHO_OP_LOG = prevLog;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("op read honors --op-account opt and OP_ACCOUNT env", async () => {
    const dir = mkdtempSync(join(tmpdir(), "innsigle-a3acct-"));
    const log = join(dir, "argv.log");
    writeFileSync(log, "");
    const prevBin = process.env.INNSIGLE_OP_BIN;
    const prevLog = process.env.INNSIGLE_ECHO_OP_LOG;
    const prevAcct = process.env.OP_ACCOUNT;
    process.env.INNSIGLE_OP_BIN = `${process.execPath} ${echoOp}`;
    process.env.INNSIGLE_ECHO_OP_LOG = log;
    try {
      const { readPrivateKeyPem } = await import("../src/onepassword.mjs");
      const ref = "op://Vault/Item/private key";

      process.env.OP_ACCOUNT = "env-acct";
      let pem = readPrivateKeyPem(ref, { account: "flag-acct" });
      assert.match(pem, /PRIVATE KEY/);
      let lines = readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l));
      assert.deepEqual(lines.at(-1), ["read", ref, "--account", "flag-acct"]);

      pem = readPrivateKeyPem(ref);
      assert.match(pem, /PRIVATE KEY/);
      lines = readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l));
      assert.deepEqual(lines.at(-1), ["read", ref, "--account", "env-acct"]);

      delete process.env.OP_ACCOUNT;
      pem = readPrivateKeyPem(ref);
      assert.match(pem, /PRIVATE KEY/);
      lines = readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l));
      assert.deepEqual(lines.at(-1), ["read", ref]);
    } finally {
      if (prevBin === undefined) delete process.env.INNSIGLE_OP_BIN;
      else process.env.INNSIGLE_OP_BIN = prevBin;
      if (prevLog === undefined) delete process.env.INNSIGLE_ECHO_OP_LOG;
      else process.env.INNSIGLE_ECHO_OP_LOG = prevLog;
      if (prevAcct === undefined) delete process.env.OP_ACCOUNT;
      else process.env.OP_ACCOUNT = prevAcct;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("seal --op-account passes --account to op read", () => {
    const { repo, env, opLog } = setupRepo("a3seal");
    writeFileSync(join(repo, "acct.html"), "<html>acct</html>\n");
    writeFileSync(opLog, "");
    const r = run(
      ["seal", "acct.html", "--kind", "human-authored", "--op-account", "team-x"],
      { cwd: repo, env },
    );
    assert.equal(r.status, 0, r.stderr);
    assert.match(readFileSync(opLog, "utf8"), /read op:\/\/.* --account team-x/);
    rmSync(repo, { recursive: true, force: true });
  });
});

describe("debug sidecar (PLAN-001 A4)", () => {
  it("default seal writes exactly one file under public/claims/, no .claim.json", () => {
    const { repo, env } = setupRepo("a4");
    writeFileSync(join(repo, "page.html"), "<html>a4</html>\n");
    const r = run(["seal", "page.html", "--kind", "human-authored"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr);
    const publicFiles = walkFiles(join(repo, ".innsigle/public"));
    assert.equal(publicFiles.some((p) => p.endsWith(".claim.json")), false);
    const claims = readdirSync(join(repo, ".innsigle/public/claims"));
    assert.deepEqual(claims, ["page-html.attestation.json"]);
    assert.equal(existsSync(join(repo, ".innsigle/debug")), false);
    rmSync(repo, { recursive: true, force: true });
  });

  it("--debug-claim writes the sidecar to .innsigle/debug/", () => {
    const { repo, env } = setupRepo("a4dbg");
    writeFileSync(join(repo, "page.html"), "<html>a4 debug</html>\n");
    const r = run(
      ["seal", "page.html", "--kind", "human-authored", "--debug-claim"],
      { cwd: repo, env },
    );
    assert.equal(r.status, 0, r.stderr);
    const side = join(repo, ".innsigle/debug/page-html.claim.json");
    assert.ok(existsSync(side));
    const claim = JSON.parse(readFileSync(side, "utf8"));
    assert.equal(claim.innsigle, "1");
    const publicFiles = walkFiles(join(repo, ".innsigle/public"));
    assert.equal(publicFiles.some((p) => p.endsWith(".claim.json")), false);
    rmSync(repo, { recursive: true, force: true });
  });
});

describe("content-adjacent colophons (PLAN-001 A6)", () => {
  it("<content-dir>/colo.json wins over .innsigle/colo.json; project colo still used elsewhere", () => {
    const { repo, env } = setupRepo("a6");
    // project-level default colo: mixed
    writeFileSync(
      join(repo, ".innsigle/colo.json"),
      JSON.stringify(
        {
          schema_version: "1",
          composition: "mixed",
          ingredients: [
            { kind: "human", name: "operator", role: "outline" },
            { kind: "model", name: "Claude", role: "expand" },
          ],
          notes: null,
        },
        null,
        2,
      ) + "\n",
    );
    // content-adjacent sidecar: human-authored
    mkdirSync(join(repo, "posts/c"), { recursive: true });
    writeFileSync(join(repo, "posts/c/index.qmd"), "# handwritten\n");
    writeFileSync(
      join(repo, "posts/c/colo.json"),
      JSON.stringify(
        {
          schema_version: "1",
          composition: "human-authored",
          ingredients: [{ kind: "human", name: "operator", role: "author" }],
          notes: null,
        },
        null,
        2,
      ) + "\n",
    );

    let r = run(["seal", "posts/c/index.qmd"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr);
    const att = JSON.parse(
      readFileSync(
        join(repo, ".innsigle/public/claims/posts-c-index-qmd.attestation.json"),
        "utf8",
      ),
    );
    assert.equal(att.payload.colophon.composition, "human-authored");

    // no sidecar next to root file → falls back to .innsigle/colo.json
    writeFileSync(join(repo, "page.html"), "<html>root</html>\n");
    r = run(["seal", "page.html"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr);
    const att2 = JSON.parse(
      readFileSync(join(repo, ".innsigle/public/claims/page-html.attestation.json"), "utf8"),
    );
    assert.equal(att2.payload.colophon.composition, "mixed");
    rmSync(repo, { recursive: true, force: true });
  });
});
