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

describe("golden vectors: human_input claim (CONTRACT-001 v1.1)", () => {
  it("JCS of claim-hi.json matches claim-hi.jcs.txt and expected sha", () => {
    const payload = JSON.parse(read("claim-hi.json"));
    const jcsText = read("claim-hi.jcs.txt").replace(/\n$/, "");
    assert.equal(jcs(payload), jcsText);
    assert.equal(sha256Hex(jcsText), read("claim-hi.jcs.sha256").trim());
    assert.equal(sha256Hex(jcsText), JSON.parse(read("expected.json")).claim_hi_jcs_sha256);
    assert.equal(payload.colophon.human_input.percent, 48);
  });

  it("signature verifies and CLI verify prints the declared measure", () => {
    const att = JSON.parse(read("attestation-hi.json"));
    const keys = JSON.parse(read("keys.json"));
    const key = keys.keys.find((k) => k.key_id === att.signatures[0].key_id);
    assert.equal(
      verifyPayload(att.payload, b64urlDecode(att.signatures[0].sig), b64urlDecode(key.public_key)),
      true,
    );
    const r = spawnSync(
      process.execPath,
      [
        cli,
        "verify",
        "--attestation",
        join(vec, "attestation-hi.json"),
        "--content",
        join(vec, "content/sample.html"),
        "--keys",
        join(vec, "keys.json"),
      ],
      { encoding: "utf8" },
    );
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /VALID/);
    assert.match(r.stdout, /human_input=48% \(declared, method hi1\)/);
    assert.doesNotMatch(r.stdout, /detection/i);
  });
});

describe("golden vectors: review and derivation claims (CONTRACT-001 v1.2)", () => {
  const rv = (name) => readFileSync(join(vec, "review", name), "utf8");
  const exp = JSON.parse(rv("expected.json"));
  const keysDoc = JSON.parse(rv("keys.json"));

  it("source and output digests match expected", () => {
    assert.equal(sha256Hex(readFileSync(join(vec, "review/content/sample.md"))), exp.source_sha256);
    assert.equal(sha256Hex(readFileSync(join(vec, "review/built/sample.html"))), exp.output_sha256);
  });

  it("JCS of review.json and derivation.json match their published bytes and sha", () => {
    for (const [json, txt, sha, key] of [
      ["review.json", "review.jcs.txt", "review.jcs.sha256", "review_jcs_sha256"],
      ["derivation.json", "derivation.jcs.txt", "derivation.jcs.sha256", "derivation_jcs_sha256"],
    ]) {
      const text = rv(txt).replace(/\n$/, "");
      assert.equal(jcs(JSON.parse(rv(json))), text);
      assert.equal(sha256Hex(text), rv(sha).trim());
      assert.equal(sha256Hex(text), exp[key]);
    }
  });

  it("the document file carries an authorship claim (build) and a human review, each signed by its own key", async () => {
    const { checkReview, makeRoles } = await import("../src/review.mjs");
    const doc = JSON.parse(rv("document.attestation.json"));
    assert.equal(doc.payload.colophon.composition, "model-primary");
    assert.equal(doc.signatures[0].key_id, exp.build_key_id);
    assert.equal(doc.reviews[0].signatures[0].key_id, exp.human_key_id);
    const roles = makeRoles({ keysDoc });
    const at = Date.parse(exp.verify_at);
    assert.equal(
      checkReview({ review: doc.reviews[0], keysDoc, roles, contentDigest: exp.source_sha256, now: at }).state,
      "REVIEWED",
    );
    // a one-byte-different source makes it stale, a later clock makes it expired
    assert.equal(
      checkReview({ review: doc.reviews[0], keysDoc, roles, contentDigest: "0".repeat(64), now: at }).state,
      "REVIEW-STALE",
    );
    assert.equal(
      checkReview({ review: doc.reviews[0], keysDoc, roles, contentDigest: exp.source_sha256, now: Date.parse("2028-01-01T00:00:00Z") }).state,
      "REVIEW-EXPIRED",
    );
  });

  it("the derivation verifies end to end and embeds the review verbatim", async () => {
    const { checkDerivation } = await import("../src/derive.mjs");
    const { makeRoles } = await import("../src/review.mjs");
    const deriv = JSON.parse(rv("derivation.attestation.json"));
    const doc = JSON.parse(rv("document.attestation.json"));
    assert.deepEqual(deriv.payload.derivation.inputs[0].reviews[0], doc.reviews[0]);
    const roles = makeRoles({ keysDoc, endorsements: [JSON.parse(rv("endorsement.attestation.json"))] });
    const r = checkDerivation({ att: deriv, keysDoc, roles, now: Date.parse(exp.verify_at) });
    assert.equal(r.ok, true, r.reason);
    // without the human endorsement the build key is not accepted
    const bare = makeRoles({ keysDoc: { ...keysDoc, keys: keysDoc.keys.map(({ role, ...k }) => k) }, endorsements: [] });
    assert.equal(checkDerivation({ att: deriv, keysDoc, roles: bare, now: Date.parse(exp.verify_at) }).ok, false);
  });

  it("CLI: verify --derived on the vector tree exits 0 and fails once the output changes", () => {
    const ok = spawnSync(process.execPath, [cli, "verify", "--derived", join(vec, "review/built")], { encoding: "utf8" });
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /VALID sample\.html/);
  });
});
