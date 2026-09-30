import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const cli = join(here, "..", "src", "cli.mjs");
const fakeOp = join(here, "fixtures", "fake-op.mjs");

/** Build a wrapper that points innsigle at the fake op with its own store. */
function stubOp(extraEnv = "") {
  const dir = mkdtempSync(join(tmpdir(), "innsigle-opacct-"));
  const store = join(dir, "store");
  const wrapper = join(dir, "op");
  writeFileSync(
    wrapper,
    `#!/bin/sh\nexport INNSIGLE_FAKE_OP_STORE="${store}"\n${extraEnv}exec "${process.execPath}" "${fakeOp}" "$@"\n`,
  );
  chmodSync(wrapper, 0o755);
  return { dir, store, wrapper };
}

function runInit(repo, wrapper, env, extraArgs = []) {
  return spawnSync(
    process.execPath,
    [
      cli,
      "init",
      "--onepassword",
      "--dir",
      repo,
      "--site-url",
      "https://blog.example.com",
      "--issuer-id",
      "acct-test",
      "--vault",
      "Private",
      ...extraArgs,
    ],
    { encoding: "utf8", env: { ...process.env, INNSIGLE_OP_BIN: wrapper, ...env } },
  );
}

test("init creates the key in the account OP_ACCOUNT names", () => {
  const { dir, store, wrapper } = stubOp();
  const repo = mkdtempSync(join(tmpdir(), "innsigle-repo-"));
  const r = runInit(repo, wrapper, { OP_ACCOUNT: "personal.1password.com" });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const last = JSON.parse(readFileSync(join(store, "last.json"), "utf8"));
  assert.equal(
    last.account,
    "personal.1password.com",
    "item create must pass --account, or the key lands in the default account while reads look elsewhere",
  );
});

test("init --op-account overrides OP_ACCOUNT", () => {
  const { store, wrapper } = stubOp();
  const repo = mkdtempSync(join(tmpdir(), "innsigle-repo-"));
  const r = runInit(repo, wrapper, { OP_ACCOUNT: "ignored.1password.com" }, [
    "--op-account",
    "chosen.1password.com",
  ]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const last = JSON.parse(readFileSync(join(store, "last.json"), "utf8"));
  assert.equal(last.account, "chosen.1password.com");
});

test("init omits --account when no account is configured", () => {
  const { store, wrapper } = stubOp();
  const repo = mkdtempSync(join(tmpdir(), "innsigle-repo-"));
  const env = { ...process.env };
  delete env.OP_ACCOUNT;
  const r = spawnSync(
    process.execPath,
    [cli, "init", "--onepassword", "--dir", repo, "--site-url",
     "https://blog.example.com", "--issuer-id", "acct-test", "--vault", "Private"],
    { encoding: "utf8", env: { ...env, INNSIGLE_OP_BIN: wrapper } },
  );
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const last = JSON.parse(readFileSync(join(store, "last.json"), "utf8"));
  assert.equal(last.account, null);
});

test("the sign-in probe does not use `op whoami`", async () => {
  // Under 1Password desktop-app integration `whoami` fails for every account
  // even though reads and writes succeed, so a whoami-based probe blocks init.
  const { assertOpSignedIn } = await import("../src/onepassword.mjs");
  const dir = mkdtempSync(join(tmpdir(), "innsigle-whoami-"));
  const wrapper = join(dir, "op");
  writeFileSync(
    wrapper,
    `#!/bin/sh
case "$1" in
  --version) echo 2.0.0-fake; exit 0 ;;
  whoami) echo "[ERROR] account is not signed in" >&2; exit 1 ;;
  vault) echo '[{"id":"v1","name":"Private"}]'; exit 0 ;;
esac
exit 1
`,
  );
  chmodSync(wrapper, 0o755);
  const prev = process.env.INNSIGLE_OP_BIN;
  process.env.INNSIGLE_OP_BIN = wrapper;
  try {
    assert.doesNotThrow(() => assertOpSignedIn());
  } finally {
    if (prev === undefined) delete process.env.INNSIGLE_OP_BIN;
    else process.env.INNSIGLE_OP_BIN = prev;
  }
});

test("--content-glob is repeatable (a two-section site seals both)", () => {
  const { wrapper } = stubOp();
  const repo = mkdtempSync(join(tmpdir(), "innsigle-globs-"));
  const r = spawnSync(
    process.execPath,
    [cli, "init", "--onepassword", "--dir", repo, "--site-url",
     "https://blog.example.com", "--issuer-id", "glob-test", "--vault", "Private",
     "--content-root", "content",
     "--content-glob", "content/posts/**/*.md",
     "--content-glob", "content/agent/**/*.md"],
    { encoding: "utf8", env: { ...process.env, INNSIGLE_OP_BIN: wrapper } },
  );
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const cfg = JSON.parse(readFileSync(join(repo, ".innsigle", "config.json"), "utf8"));
  assert.deepEqual(cfg.content_globs, [
    "content/posts/**/*.md",
    "content/agent/**/*.md",
  ]);
});

test("--content-root alone still derives one glob", () => {
  const { wrapper } = stubOp();
  const repo = mkdtempSync(join(tmpdir(), "innsigle-glob1-"));
  const r = spawnSync(
    process.execPath,
    [cli, "init", "--onepassword", "--dir", repo, "--site-url",
     "https://blog.example.com", "--issuer-id", "glob-test", "--vault", "Private",
     "--content-root", "content"],
    { encoding: "utf8", env: { ...process.env, INNSIGLE_OP_BIN: wrapper } },
  );
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const cfg = JSON.parse(readFileSync(join(repo, ".innsigle", "config.json"), "utf8"));
  assert.deepEqual(cfg.content_globs, ["content/**/*.md"]);
});

test("refSegment falls back to the uuid when the title is not reference-safe", async () => {
  const { refSegment } = await import("../src/onepassword.mjs");
  assert.equal(refSegment("Innsigle blog", "uuid1"), "Innsigle blog");
  // innsigle's own default title contains U+00B7; op rejects it outright.
  assert.equal(refSegment("Innsigle · my-blog", "uuid1"), "uuid1");
  assert.equal(refSegment("has/slash", "uuid1"), "uuid1");
  assert.throws(() => refSegment("Innsigle · x", undefined), /reference-safe/);
});

test("init's default title yields a readable, valid private_key_ref", () => {
  const { wrapper } = stubOp();
  const repo = mkdtempSync(join(tmpdir(), "innsigle-ref-"));
  const r = spawnSync(
    process.execPath,
    [cli, "init", "--onepassword", "--dir", repo, "--site-url",
     "https://blog.example.com", "--issuer-id", "ref-test", "--vault", "Private"],
    { encoding: "utf8", env: { ...process.env, INNSIGLE_OP_BIN: wrapper } },
  );
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const cfg = JSON.parse(readFileSync(join(repo, ".innsigle", "config.json"), "utf8"));
  const ref = cfg.onepassword.private_key_ref;
  assert.match(ref, /^op:\/\//);
  assert.doesNotMatch(ref, /[^\x20-\x7E]/, `private_key_ref must be ASCII, got ${ref}`);
  // default title is "Innsigle · <id>", so the item segment must be the uuid
  assert.match(ref, /^op:\/\/Private\/fake-item-[a-z0-9]+\/private key$/);
});

test("init records a role on the minted key so the colophon can label it", () => {
  const { wrapper } = stubOp();
  const repo = mkdtempSync(join(tmpdir(), "innsigle-role-"));
  const r = spawnSync(
    process.execPath,
    [cli, "init", "--onepassword", "--dir", repo, "--site-url",
     "https://blog.example.com", "--issuer-id", "role-test", "--vault", "Private"],
    { encoding: "utf8", env: { ...process.env, INNSIGLE_OP_BIN: wrapper } },
  );
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const doc = JSON.parse(
    readFileSync(join(repo, ".innsigle", "public", "keys.json"), "utf8"),
  );
  assert.equal(doc.keys.length, 1);
  assert.equal(doc.keys[0].role, "human");
});
