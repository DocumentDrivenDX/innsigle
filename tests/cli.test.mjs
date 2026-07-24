import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "src/cli.mjs");
const tmp = join(root, ".tmp-test");

function run(args, opts = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    ...opts,
  });
}

describe("innsigle CLI CONTRACT-001", () => {
  it("keygen → claim → sign → verify; tamper fails closed", () => {
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
    const keyDir = join(tmp, "keys");
    const content = join(tmp, "page.html");
    writeFileSync(content, "<html><body>hello innsigle</body></html>\n");

    let r = run(["keygen", "--out-dir", keyDir]);
    assert.equal(r.status, 0, r.stderr);
    const keyId = readFileSync(join(keyDir, "key-id.txt"), "utf8").trim();
    const pubRaw = readFileSync(join(keyDir, "ed25519.pub.raw.b64url"), "utf8").trim();

    const keysPath = join(tmp, "keys.json");
    r = run([
      "keys",
      "template",
      "--issuer-id",
      "azgaard",
      "--issuer-name",
      "Azgaard",
      "--public-key",
      pubRaw,
      "--key-id",
      keyId,
      "--out",
      keysPath,
    ]);
    assert.equal(r.status, 0, r.stderr);

    const coloPath = join(tmp, "colo.json");
    r = run(["colo", "example", "--kind", "model-primary"]);
    assert.equal(r.status, 0, r.stderr);
    writeFileSync(coloPath, r.stdout);

    const claimPath = join(tmp, "claim.json");
    r = run([
      "claim",
      "build",
      "--content",
      content,
      "--uri",
      "https://example.com/",
      "--colo",
      coloPath,
      "--issuer-id",
      "azgaard",
      "--issuer-name",
      "Azgaard",
      "--key-id",
      keyId,
      "--key-url",
      "https://azgaard.net/.well-known/innsigle/keys.json",
      "--out",
      claimPath,
    ]);
    assert.equal(r.status, 0, r.stderr);

    const attPath = join(tmp, "attestation.json");
    r = run([
      "sign",
      "--claim",
      claimPath,
      "--key",
      join(keyDir, "ed25519.priv.pem"),
      "--out",
      attPath,
    ]);
    assert.equal(r.status, 0, r.stderr);

    r = run(["verify", "--attestation", attPath, "--content", content, "--keys", keysPath]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /VALID/);

    writeFileSync(content, "<html><body>tampered</body></html>\n");
    r = run(["verify", "--attestation", attPath, "--content", content, "--keys", keysPath]);
    assert.equal(r.status, 3, r.stderr);
  });

  it("claim build rejects relative key_url (ADR-003)", () => {
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
    const content = join(tmp, "page.html");
    writeFileSync(content, "<html>x</html>\n");
    const coloPath = join(tmp, "colo.json");
    let r = run(["colo", "example", "--kind", "human-authored"]);
    assert.equal(r.status, 0, r.stderr);
    writeFileSync(coloPath, r.stdout);
    r = run([
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
});
