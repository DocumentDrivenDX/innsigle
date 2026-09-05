import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  chmodSync,
  copyFileSync,
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
import { createHash } from "node:crypto";
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

  it("re-seal over identical bytes with a different colophon lands the new colophon (F5)", () => {
    const { repo, env } = setupRepo("f5colo");
    writeFileSync(join(repo, "page.html"), "<html>same bytes</html>\n");
    let r = run(["seal", "page.html", "--kind", "model-primary"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr);
    const attPath = join(repo, ".innsigle/public/claims/page-html.attestation.json");
    assert.equal(
      JSON.parse(readFileSync(attPath, "utf8")).payload.colophon.composition,
      "model-primary",
    );

    // same bytes, different colophon → must re-seal, not "up to date"
    r = run(["seal", "page.html", "--kind", "mixed"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /ok: sealed/);
    assert.doesNotMatch(r.stderr, /up to date/);
    assert.equal(
      JSON.parse(readFileSync(attPath, "utf8")).payload.colophon.composition,
      "mixed",
    );

    // the --save-colo review flow: an edited sidecar colo.json must land on
    // the instructed plain re-run, even over identical bytes
    writeFileSync(
      join(repo, "colo.json"),
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
    r = run(["seal", "page.html"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /ok: sealed/);
    assert.equal(
      JSON.parse(readFileSync(attPath, "utf8")).payload.colophon.composition,
      "human-authored",
    );

    // identical bytes AND identical colophon → still idempotent
    r = run(["seal", "page.html"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /up to date/);
    rmSync(repo, { recursive: true, force: true });
  });

  it("failed self-verify preserves the pre-existing attestation (F9)", () => {
    const { repo, env } = setupRepo("f9keep");
    writeFileSync(join(repo, "doc.html"), "<html>v1</html>\n");
    let r = run(["seal", "doc.html", "--kind", "human-authored"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr);
    const attPath = join(repo, ".innsigle/public/claims/doc-html.attestation.json");
    const original = readFileSync(attPath, "utf8");

    // drift the content, then rotate keys.json out of sync → reseal must fail…
    writeFileSync(join(repo, "doc.html"), "<html>v2</html>\n");
    const keysPath = join(repo, ".innsigle/public/keys.json");
    const goodKeys = readFileSync(keysPath, "utf8");
    const bad = JSON.parse(goodKeys);
    bad.keys[0].key_id = "rotated-out-of-sync";
    writeFileSync(keysPath, JSON.stringify(bad, null, 2) + "\n");

    r = run(["seal", "doc.html", "--kind", "human-authored"], { cwd: repo, env });
    assert.notEqual(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stderr, /self-verify failed/);
    // …and the previously good attestation survives, byte for byte
    assert.equal(readFileSync(attPath, "utf8"), original);

    // seal --stale hits the same failure and also never destroys the claim
    r = run(["seal", "--stale"], { cwd: repo, env });
    assert.equal(r.status, 2, r.stderr + r.stdout);
    assert.match(r.stderr, /reseal self-verify failed/);
    assert.equal(readFileSync(attPath, "utf8"), original);

    // no temp files left behind in the claims dir
    const leftovers = readdirSync(join(repo, ".innsigle/public/claims")).filter((n) =>
      n.includes(".tmp-"),
    );
    assert.deepEqual(leftovers, []);

    // restoring keys.json recovers — the claim (colophon, uri) was never lost
    writeFileSync(keysPath, goodKeys);
    r = run(["seal", "--stale"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stderr, /ok: resealed doc\.html/);
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

describe("seal --auto (PLAN-001 B3)", () => {
  const transcriptFixture = join(
    root,
    "tests/fixtures/provenance/claude-code-transcript.jsonl",
  );

  /** Content file at the fixture's file_write path + a transcript dir. */
  function addAutoFixtures(repo) {
    mkdirSync(join(repo, "posts/demo"), { recursive: true });
    writeFileSync(join(repo, "posts/demo/index.qmd"), "# demo post\n\nsealed by test\n");
    const tdir = join(repo, "transcripts");
    mkdirSync(tdir);
    copyFileSync(transcriptFixture, join(tdir, "session-one.jsonl"));
    return tdir;
  }

  it("seal --auto --yes produces a VALID attestation naming the transcript model", () => {
    const { repo, env } = setupRepo("b3yes");
    const tdir = addAutoFixtures(repo);
    const r = run(
      ["seal", "posts/demo/index.qmd", "--auto", "--yes", "--transcript-dir", tdir],
      { cwd: repo, env },
    );
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stderr, /proposed colophon:/);
    assert.match(r.stderr, /composition=model-primary/);
    assert.match(r.stderr, /user_prompts=3/);

    // L2 accumulates under .innsigle/provenance/, never under public/ (PROV-08)
    const l2Path = join(repo, ".innsigle/provenance/posts-demo-index-qmd.l2.json");
    assert.ok(existsSync(l2Path));
    const publicFiles = walkFiles(join(repo, ".innsigle/public"));
    assert.equal(publicFiles.some((p) => p.endsWith(".l2.json")), false);

    const attPath = join(
      repo,
      ".innsigle/public/claims/posts-demo-index-qmd.attestation.json",
    );
    assert.ok(existsSync(attPath));
    const att = JSON.parse(readFileSync(attPath, "utf8"));
    const colo = att.payload.colophon;
    assert.equal(colo.composition, "model-primary");
    const names = colo.ingredients.map((i) => `${i.kind}:${i.name}`);
    assert.ok(names.includes("model:claude-opus-5"), names.join(","));
    assert.ok(names.includes("tool:sloptimizer"), names.join(","));
    assert.ok(names.includes("human:operator"), names.join(","));

    const v = run(["verify", "posts/demo/index.qmd"], { cwd: repo, env });
    assert.equal(v.status, 0, v.stderr + v.stdout);
    assert.match(v.stdout, /VALID/);
    rmSync(repo, { recursive: true, force: true });
  });

  it("--auto without --yes in a non-TTY signs nothing and exits nonzero", () => {
    const { repo, env, opLog } = setupRepo("b3notty");
    const tdir = addAutoFixtures(repo);
    writeFileSync(opLog, "");
    const r = run(["seal", "posts/demo/index.qmd", "--auto", "--transcript-dir", tdir], {
      cwd: repo,
      env,
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /proposed colophon:/); // review still printed (PROV-05)
    assert.match(r.stderr, /re-run with --yes/);
    assert.equal(
      existsSync(
        join(repo, ".innsigle/public/claims/posts-demo-index-qmd.attestation.json"),
      ),
      false,
    );
    assert.doesNotMatch(readFileSync(opLog, "utf8"), /read op:\/\//); // key never read
    rmSync(repo, { recursive: true, force: true });
  });

  it("--save-colo writes <content-dir>/colo.json and seals nothing", () => {
    const { repo, env } = setupRepo("b3save");
    const tdir = addAutoFixtures(repo);
    const r = run(
      ["seal", "posts/demo/index.qmd", "--auto", "--save-colo", "--transcript-dir", tdir],
      { cwd: repo, env },
    );
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const sidecar = join(repo, "posts/demo/colo.json");
    assert.ok(existsSync(sidecar));
    const colo = JSON.parse(readFileSync(sidecar, "utf8"));
    assert.equal(colo.composition, "model-primary");
    assert.ok(colo.ingredients.some((i) => i.kind === "model" && i.name === "claude-opus-5"));
    assert.equal(
      existsSync(
        join(repo, ".innsigle/public/claims/posts-demo-index-qmd.attestation.json"),
      ),
      false,
    );

    // the saved sidecar then drives a plain seal (A6 resolution order)
    const r2 = run(["seal", "posts/demo/index.qmd"], { cwd: repo, env });
    assert.equal(r2.status, 0, r2.stderr);
    const att = JSON.parse(
      readFileSync(
        join(repo, ".innsigle/public/claims/posts-demo-index-qmd.attestation.json"),
        "utf8",
      ),
    );
    assert.equal(att.payload.colophon.composition, "model-primary");
    rmSync(repo, { recursive: true, force: true });
  });

  it("--provenance-uri embeds provenance.uri + digest of the L2 (PROV-06)", () => {
    const { repo, env } = setupRepo("b3prov");
    const tdir = addAutoFixtures(repo);
    const uri = "https://seal.example/provenance/posts-demo-index-qmd.l2.json";
    const r = run(
      [
        "seal",
        "posts/demo/index.qmd",
        "--auto",
        "--yes",
        "--transcript-dir",
        tdir,
        "--provenance-uri",
        uri,
      ],
      { cwd: repo, env },
    );
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const att = JSON.parse(
      readFileSync(
        join(repo, ".innsigle/public/claims/posts-demo-index-qmd.attestation.json"),
        "utf8",
      ),
    );
    const prov = att.payload.colophon.provenance;
    assert.ok(prov, "colophon.provenance embedded");
    assert.equal(prov.uri, uri);
    const l2Bytes = readFileSync(
      join(repo, ".innsigle/provenance/posts-demo-index-qmd.l2.json"),
    );
    assert.equal(prov.digest.value, createHash("sha256").update(l2Bytes).digest("hex"));
    rmSync(repo, { recursive: true, force: true });
  });
});

describe("seal human_input (FR-20 / CONTRACT-001 v1.1)", () => {
  const transcriptFixture = join(
    root,
    "tests/fixtures/provenance/claude-code-transcript.jsonl",
  );

  function addAutoFixtures(repo) {
    mkdirSync(join(repo, "posts/demo"), { recursive: true });
    writeFileSync(join(repo, "posts/demo/index.qmd"), "# demo post\n\nsealed by test\n");
    const tdir = join(repo, "transcripts");
    mkdirSync(tdir);
    copyFileSync(transcriptFixture, join(tdir, "session-one.jsonl"));
    return tdir;
  }

  it("--auto --yes seals a consistent human_input and prints it at review + success + verify", async () => {
    const { repo, env } = setupRepo("hiauto");
    const tdir = addAutoFixtures(repo);
    const r = run(
      ["seal", "posts/demo/index.qmd", "--auto", "--yes", "--transcript-dir", tdir],
      { cwd: repo, env },
    );
    assert.equal(r.status, 0, r.stderr + r.stdout);
    // PROV-05: the measure is part of what the operator reviews.
    assert.match(r.stderr, /human_input=\d+% \(method hi1\)/);
    assert.match(r.stderr, /human_input=\d+% \(declared, method hi1\)/);

    const att = JSON.parse(
      readFileSync(
        join(repo, ".innsigle/public/claims/posts-demo-index-qmd.attestation.json"),
        "utf8",
      ),
    );
    const hi = att.payload.colophon.human_input;
    assert.ok(hi, "colophon carries human_input");
    assert.equal(hi.method, "hi1");
    assert.ok(Number.isInteger(hi.percent) && hi.percent >= 0 && hi.percent <= 100);
    const { validateHumanInput } = await import("../src/provenance/index.mjs");
    validateHumanInput(hi); // signed object recomputes from its own counts

    const v = run(["verify", "posts/demo/index.qmd"], { cwd: repo, env });
    assert.equal(v.status, 0, v.stderr + v.stdout);
    assert.match(v.stdout, new RegExp(`human_input=${hi.percent}% \\(declared, method hi1\\)`));
    rmSync(repo, { recursive: true, force: true });
  });

  it("hand-written colo with fudged human_input percent is refused (exit 5)", () => {
    const { repo, env } = setupRepo("hifudge");
    writeFileSync(join(repo, "page.html"), "<html>page</html>\n");
    const badColo = {
      schema_version: "1",
      composition: "model-primary",
      ingredients: [{ kind: "model", name: "Claude", role: "draft" }],
      notes: null,
      human_input: {
        method: "hi1",
        basis: "session-journal",
        percent: 75, // recomputes to 48 from the counts below
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
      },
    };
    writeFileSync(join(repo, "bad-colo.json"), JSON.stringify(badColo, null, 2) + "\n");
    const r = run(["seal", "page.html", "--colo", "bad-colo.json"], { cwd: repo, env });
    assert.equal(r.status, 5, r.stderr + r.stdout);
    assert.match(r.stderr, /INVALID: colophon human_input percent 75 does not recompute/);
    assert.equal(
      existsSync(join(repo, ".innsigle/public/claims/page-html.attestation.json")),
      false,
    );
    // The honest percent seals fine.
    const goodColo = structuredClone(badColo);
    goodColo.human_input.percent = 48;
    writeFileSync(join(repo, "good-colo.json"), JSON.stringify(goodColo, null, 2) + "\n");
    const r2 = run(["seal", "page.html", "--colo", "good-colo.json"], { cwd: repo, env });
    assert.equal(r2.status, 0, r2.stderr + r2.stdout);
    assert.match(r2.stderr, /human_input=48% \(declared, method hi1\)/);
    rmSync(repo, { recursive: true, force: true });
  });
});
