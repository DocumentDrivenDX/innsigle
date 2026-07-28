/**
 * Install + use: exercise a real package install (not repo-local node src/cli.mjs).
 *
 * 1. npm pack  → tarball as a consumer would get
 * 2. npm install <tgz> into a temp project
 * 3. Run full CONTRACT-001 path via node_modules/.bin/innsigle
 * 4. Verify packaged sample claim with the installed bin
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const npmEnv = {
  ...process.env,
  npm_config_audit: "false",
  npm_config_fund: "false",
  npm_config_update_notifier: "false",
};

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    encoding: "utf8",
    env: npmEnv,
    ...opts,
  });
}

/** Resolve the innsigle bin after npm install (symlink or .cmd on Windows). */
function resolveBin(proj) {
  const unix = join(proj, "node_modules", ".bin", "innsigle");
  if (existsSync(unix)) return unix;
  const win = join(proj, "node_modules", ".bin", "innsigle.cmd");
  if (existsSync(win)) return win;
  // Fallback: package entry
  const cli = join(proj, "node_modules", "innsigle", "src", "cli.mjs");
  if (existsSync(cli)) return { node: true, cli };
  return null;
}

function innsigle(proj, args, opts = {}) {
  const bin = resolveBin(proj);
  assert.ok(bin, "innsigle bin missing after install");
  if (typeof bin === "object" && bin.node) {
    return run(process.execPath, [bin.cli, ...args], { cwd: proj, ...opts });
  }
  return run(bin, args, { cwd: proj, ...opts });
}

describe("innsigle install + use (pack → install → CLI)", () => {
  /** @type {string} */
  let work;
  /** @type {string} */
  let tgz;
  /** @type {string} */
  let consumer;

  before(() => {
    work = mkdtempSync(join(tmpdir(), "innsigle-pack-"));
    const pack = run("npm", ["pack", "--pack-destination", work], { cwd: root });
    assert.equal(pack.status, 0, pack.stderr + pack.stdout);
    const files = readdirSync(work).filter((f) => f.endsWith(".tgz"));
    assert.equal(files.length, 1, `expected one tarball, got ${files.join(",")}`);
    tgz = join(work, files[0]);

    consumer = join(work, "consumer");
    mkdirSync(consumer);
    writeFileSync(
      join(consumer, "package.json"),
      JSON.stringify({
        name: "innsigle-consumer",
        private: true,
        type: "module",
      }),
    );

    const install = run("npm", ["install", tgz], { cwd: consumer });
    assert.equal(install.status, 0, install.stderr + install.stdout);
    assert.ok(existsSync(join(consumer, "node_modules", "innsigle", "package.json")));
    assert.ok(resolveBin(consumer), "bin after install");
  });

  after(() => {
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it("package.json declares bin and shebang CLI", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    assert.equal(pkg.bin?.innsigle, "./src/cli.mjs");
    const head = readFileSync(join(root, "src/cli.mjs"), "utf8").slice(0, 40);
    assert.match(head, /^#!/);
  });

  it("installed bin prints usage", () => {
    const help = innsigle(consumer, []);
    assert.equal(help.status, 1, help.stderr + help.stdout);
    const out = (help.stdout || "") + (help.stderr || "");
    assert.match(out, /innsigle/i);
    assert.match(out, /keygen/);
    assert.match(out, /claim build|sign|verify/i);
  });

  it("installed bin: keygen → claim → sign → verify; tamper fails", () => {
    const dir = join(consumer, "seal-work");
    mkdirSync(dir, { recursive: true });
    const keyDir = join(dir, "keys");
    const content = join(dir, "page.html");
    writeFileSync(content, "<html><body>installed innsigle use</body></html>\n");

    let r = innsigle(consumer, ["keygen", "--out-dir", keyDir]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const keyId = readFileSync(join(keyDir, "key-id.txt"), "utf8").trim();
    const pubRaw = readFileSync(join(keyDir, "ed25519.pub.raw.b64url"), "utf8").trim();

    const keysPath = join(dir, "keys.json");
    r = innsigle(consumer, [
      "keys",
      "template",
      "--issuer-id",
      "consumer-house",
      "--issuer-name",
      "Consumer House",
      "--public-key",
      pubRaw,
      "--key-id",
      keyId,
      "--out",
      keysPath,
    ]);
    assert.equal(r.status, 0, r.stderr + r.stdout);

    r = innsigle(consumer, ["colo", "example", "--kind", "model-primary"]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const coloPath = join(dir, "colo.json");
    writeFileSync(coloPath, r.stdout);
    const colo = JSON.parse(r.stdout);
    assert.equal(colo.composition, "model-primary");

    const claimPath = join(dir, "claim.json");
    r = innsigle(consumer, [
      "claim",
      "build",
      "--content",
      content,
      "--uri",
      "https://example.com/installed-page/",
      "--colo",
      coloPath,
      "--issuer-id",
      "consumer-house",
      "--issuer-name",
      "Consumer House",
      "--key-id",
      keyId,
      "--key-url",
      "https://example.com/.well-known/innsigle/keys.json",
      "--out",
      claimPath,
    ]);
    assert.equal(r.status, 0, r.stderr + r.stdout);

    const attPath = join(dir, "att.json");
    r = innsigle(consumer, [
      "sign",
      "--claim",
      claimPath,
      "--key",
      join(keyDir, "ed25519.priv.pem"),
      "--out",
      attPath,
    ]);
    assert.equal(r.status, 0, r.stderr + r.stdout);

    r = innsigle(consumer, [
      "verify",
      "--attestation",
      attPath,
      "--content",
      content,
      "--keys",
      keysPath,
    ]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /VALID/);
    assert.match(r.stdout, /consumer-house|model-primary/);

    writeFileSync(content, "<html><body>tampered after install</body></html>\n");
    r = innsigle(consumer, [
      "verify",
      "--attestation",
      attPath,
      "--content",
      content,
      "--keys",
      keysPath,
    ]);
    assert.equal(r.status, 3, r.stderr + r.stdout);
  });

  it("installed bin rejects relative key_url (ADR-003)", () => {
    const dir = join(consumer, "adr003");
    mkdirSync(dir, { recursive: true });
    const content = join(dir, "x.html");
    writeFileSync(content, "<html>x</html>\n");
    let r = innsigle(consumer, ["colo", "example", "--kind", "human-authored"]);
    assert.equal(r.status, 0, r.stderr);
    const coloPath = join(dir, "colo.json");
    writeFileSync(coloPath, r.stdout);
    r = innsigle(consumer, [
      "claim",
      "build",
      "--content",
      content,
      "--colo",
      coloPath,
      "--issuer-id",
      "x",
      "--issuer-name",
      "X",
      "--key-id",
      "ed25519:0123456789abcdef0123456789abcdef",
      "--key-url",
      "/.well-known/innsigle/keys.json",
    ]);
    assert.equal(r.status, 5, r.stderr);
    assert.match(r.stderr, /key_url|absolute/i);
  });

  it("installed bin verifies the packaged sample claim", () => {
    // Sample ships inside the package under docs/sample/
    const pkgRoot = join(consumer, "node_modules", "innsigle");
    const sample = join(pkgRoot, "docs", "sample", "index.html");
    const att = join(
      pkgRoot,
      "docs",
      "sample",
      ".well-known",
      "innsigle",
      "claims",
      "index.attestation.json",
    );
    const keys = join(pkgRoot, "docs", "sample", ".well-known", "innsigle", "keys.json");
    assert.ok(existsSync(sample), "packaged sample page");
    assert.ok(existsSync(att), "packaged attestation");
    assert.ok(existsSync(keys), "packaged keys");

    // Copy out so paths are absolute and clear for the consumer project
    const out = join(consumer, "sample-verify");
    mkdirSync(out, { recursive: true });
    const c = join(out, "page.html");
    const a = join(out, "att.json");
    const k = join(out, "keys.json");
    copyFileSync(sample, c);
    copyFileSync(att, a);
    copyFileSync(keys, k);

    const r = innsigle(consumer, [
      "verify",
      "--attestation",
      a,
      "--content",
      c,
      "--keys",
      k,
    ]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /VALID/);
  });

  it("installed bin runs provenance build + propose-colo", () => {
    const dir = join(consumer, "prov");
    mkdirSync(dir, { recursive: true });
    const journal = join(dir, "session.jsonl");
    const events = [
      {
        v: 1,
        session_id: "s-install",
        event_id: "e1",
        sequence: 1,
        t: "2026-07-27T12:00:00Z",
        type: "user_prompt",
        actor: { kind: "human", name: "operator" },
        summary: "Write a short note",
        turn_id: "t1",
      },
      {
        v: 1,
        session_id: "s-install",
        event_id: "e2",
        sequence: 2,
        t: "2026-07-27T12:00:01Z",
        type: "assistant_turn",
        actor: { kind: "model", name: "Claude" },
        model: "Claude",
        summary: "Drafted note",
        turn_id: "t1",
      },
      {
        v: 1,
        session_id: "s-install",
        event_id: "e3",
        sequence: 3,
        t: "2026-07-27T12:00:02Z",
        type: "file_write",
        actor: { kind: "model", name: "Claude" },
        model: "Claude",
        path: "note.md",
        by: "model",
        turn_id: "t1",
      },
      {
        v: 1,
        session_id: "s-install",
        event_id: "e4",
        sequence: 4,
        t: "2026-07-27T12:00:03Z",
        type: "skill_call",
        actor: { kind: "skill", name: "innsigle-session" },
        skill: "innsigle-session",
        role: "provenance-capture",
        summary: "capture",
        status: "ok",
      },
    ];
    writeFileSync(journal, events.map((e) => JSON.stringify(e)).join("\n") + "\n");

    const l2 = join(dir, "l2.json");
    let r = innsigle(consumer, [
      "provenance",
      "build",
      "--journal",
      journal,
      "--generated-at",
      "2026-07-27T12:01:00Z",
      "--out",
      l2,
    ]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.ok(existsSync(l2));

    const coloOut = join(dir, "colo.json");
    r = innsigle(consumer, [
      "provenance",
      "propose-colo",
      "--provenance",
      l2,
      "--out",
      coloOut,
    ]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const colo = JSON.parse(readFileSync(coloOut, "utf8"));
    assert.ok(
      colo.composition === "model-primary" || colo.composition === "mixed",
      colo.composition,
    );
  });

  it("docs still describe GitHub install", () => {
    const readme = readFileSync(join(root, "README.md"), "utf8");
    assert.match(readme, /npm install github:DocumentDrivenDX\/innsigle/);
    const cliPage = readFileSync(
      join(root, "docs/website/content/curated/use/cli.md"),
      "utf8",
    );
    assert.match(cliPage, /npm install github:DocumentDrivenDX\/innsigle/);
  });
});
