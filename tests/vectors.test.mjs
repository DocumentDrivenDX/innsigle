import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { jcs } from "../src/canonical.mjs";
import { sha256Hex, verifyPayload, b64urlDecode } from "../src/crypto.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vec = join(root, "tests/vectors");
const cli = join(root, "src/cli.mjs");

function read(name) {
  return readFileSync(join(vec, name), "utf8");
}

describe("golden vectors", () => {
  it("content digest matches expected", () => {
    const content = readFileSync(join(vec, "content/sample.html"));
    const expected = JSON.parse(read("expected.json"));
    assert.equal(sha256Hex(content), expected.content_sha256);
  });

  it("JCS of claim.json matches claim.jcs.txt and its sha256", () => {
    const payload = JSON.parse(read("claim.json"));
    const jcsText = read("claim.jcs.txt").replace(/\n$/, "");
    assert.equal(jcs(payload), jcsText);
    assert.equal(sha256Hex(jcsText), read("claim.jcs.sha256").trim());
    assert.equal(sha256Hex(jcsText), JSON.parse(read("expected.json")).claim_jcs_sha256);
  });

  it("signature verifies with keys.json public key", () => {
    const att = JSON.parse(read("attestation.json"));
    const keys = JSON.parse(read("keys.json"));
    const key = keys.keys.find((k) => k.key_id === att.signatures[0].key_id);
    assert.ok(key);
    assert.equal(
      verifyPayload(att.payload, b64urlDecode(att.signatures[0].sig), b64urlDecode(key.public_key)),
      true,
    );
  });

  it("CLI verify succeeds on golden attestation", () => {
    const r = spawnSync(
      process.execPath,
      [
        cli,
        "verify",
        "--attestation",
        join(vec, "attestation.json"),
        "--content",
        join(vec, "content/sample.html"),
        "--keys",
        join(vec, "keys.json"),
      ],
      { encoding: "utf8" },
    );
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /VALID/);
  });

  it("CLI verify fails when content is wrong", () => {
    const r = spawnSync(
      process.execPath,
      [
        cli,
        "verify",
        "--attestation",
        join(vec, "attestation.json"),
        "--content",
        join(vec, "colo-model-primary.json"),
        "--keys",
        join(vec, "keys.json"),
      ],
      { encoding: "utf8" },
    );
    assert.equal(r.status, 3);
  });
});
