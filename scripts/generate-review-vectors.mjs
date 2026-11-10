#!/usr/bin/env node
/**
 * Golden vectors for the review and derivation claims (CONTRACT-001 v1.2,
 * ADR-005). Reuses the existing test human key (tests/vectors/ed25519.priv.pem)
 * and a persisted test-only build key, so re-running is deterministic: Ed25519
 * is deterministic and every timestamp is fixed. Safe to re-run; it never
 * touches the v1.0/v1.1 vectors.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { jcs } from "../src/canonical.mjs";
import { b64url, generateEd25519, publicKeyToRaw, sha256Hex, signPayload } from "../src/crypto.mjs";
import { createPrivateKey, createPublicKey } from "node:crypto";

const vec = join(dirname(fileURLToPath(import.meta.url)), "..", "tests", "vectors");
const root = join(vec, "review");
mkdirSync(join(root, "content"), { recursive: true });
mkdirSync(join(root, "built/.well-known/innsigle/derivations"), { recursive: true });

const humanPem = readFileSync(join(vec, "ed25519.priv.pem"), "utf8");
const buildPath = join(root, "build.priv.pem");
if (!existsSync(buildPath)) writeFileSync(buildPath, generateEd25519().privateKeyPem);
const buildPem = readFileSync(buildPath, "utf8");

function pub(pem) {
  const spki = createPublicKey(createPrivateKey(pem)).export({ type: "spki", format: "der" });
  const raw = publicKeyToRaw(spki);
  return { raw, keyId: `ed25519:${sha256Hex(raw).slice(0, 32)}` };
}
const human = pub(humanPem);
const build = pub(buildPem);
const KEY_URL = "https://example.com/.well-known/innsigle/keys.json";
const issuer = (keyId) => ({ id: "azgaard-test", name: "Azgaard Test", key_id: keyId, key_url: KEY_URL });
const T0 = "2026-11-01T09:00:00Z";
const att = (payload, pem, keyId, at) => ({
  payload,
  payload_encoding: "json",
  signatures: [{ key_id: keyId, alg: "ed25519", sig: b64url(signPayload(payload, pem)), signed_at: at }],
});
const w = (name, obj) => writeFileSync(join(root, name), typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) + "\n");

const keys = {
  innsigle_issuer: "1",
  issuer_id: "azgaard-test",
  issuer_name: "Azgaard Test",
  keys: [
    { key_id: human.keyId, alg: "ed25519", public_key: b64url(human.raw), created_at: "2026-07-22T00:00:00Z", revoked_at: null, role: "human" },
    { key_id: build.keyId, alg: "ed25519", public_key: b64url(build.raw), created_at: "2026-07-22T00:00:00Z", revoked_at: null, role: "build" },
  ],
  endorsements: [],
};
w("keys.json", keys);

// Endorsement of the build key by the human key (ADR-003 / ADR-004 D2).
const endorsePayload = {
  innsigle: "1",
  type: "https://innsigle.dev/claim/key-endorsement/v1",
  issued_at: T0,
  issuer: issuer(human.keyId),
  endorsement: { subject_key_id: build.keyId, subject_key_url: KEY_URL, subject_issuer_id: "azgaard-test", level: "full", purpose: "build-signing" },
};
const endorsement = att(endorsePayload, humanPem, human.keyId, T0);
w("endorsement.attestation.json", endorsement);
writeFileSync(join(root, "built/.well-known/innsigle/keys.json"), JSON.stringify(keys, null, 2) + "\n");
mkdirSync(join(root, "built/.well-known/innsigle/endorsements"), { recursive: true });
writeFileSync(join(root, "built/.well-known/innsigle/endorsements/endorsement.attestation.json"), JSON.stringify(endorsement, null, 2) + "\n");

const md = `---
ddx:
  id: vectors.brief.sample
---

# Sample brief

Golden vector source. Do not edit without regenerating.
`;
w("content/sample.md", md);
const D = sha256Hex(md);

// Review of the source by the human key.
const reviewPayload = {
  innsigle: "1",
  type: "https://innsigle.dev/claim/review/v1",
  issued_at: "2026-11-01T10:00:00Z",
  issuer: issuer(human.keyId),
  subjects: [{ uri: "https://example.com/briefs/sample/", digest: { alg: "sha256", value: D } }],
  review: {
    schema_version: "1",
    reviewer: { key_id: human.keyId },
    scope: "full",
    expires_at: "2027-11-01T10:00:00Z",
  },
};
w("review.json", reviewPayload);
const reviewCanon = jcs(reviewPayload);
w("review.jcs.txt", reviewCanon + "\n");
w("review.jcs.sha256", sha256Hex(reviewCanon) + "\n");
const review = att(reviewPayload, humanPem, human.keyId, "2026-11-01T10:00:01Z");

// One attestation file: authorship (build key, model-primary) + human review.
const authorPayload = {
  innsigle: "1",
  type: "https://innsigle.dev/claim/colophon/v1",
  issued_at: T0,
  issuer: issuer(build.keyId),
  subjects: [{ uri: "https://example.com/briefs/sample/", digest: { alg: "sha256", value: D } }],
  colophon: {
    schema_version: "1",
    composition: "model-primary",
    ingredients: [{ kind: "model", name: "Claude", role: "draft" }],
    notes: null,
  },
};
w("document.attestation.json", { ...att(authorPayload, buildPem, build.keyId, T0), reviews: [review] });

// Derivation: rendered output O built from D, review embedded verbatim.
const html = "<!doctype html><title>Sample brief</title><h1>Sample brief</h1>\n";
writeFileSync(join(root, "built/sample.html"), html);
const O = sha256Hex(html);
const derivPayload = {
  innsigle: "1",
  type: "https://innsigle.dev/claim/derivation/v1",
  issued_at: "2026-11-01T11:00:00Z",
  issuer: issuer(build.keyId),
  subjects: [{ path: "sample.html", digest: { alg: "sha256", value: O } }],
  derivation: {
    schema_version: "1",
    transform: { name: "markdown-render", version: "1.0.0" },
    inputs: [{ path: "content/sample.md", id: "vectors.brief.sample", digest: { alg: "sha256", value: D }, reviews: [review] }],
  },
};
w("derivation.json", derivPayload);
const derivCanon = jcs(derivPayload);
w("derivation.jcs.txt", derivCanon + "\n");
w("derivation.jcs.sha256", sha256Hex(derivCanon) + "\n");
const derivation = att(derivPayload, buildPem, build.keyId, "2026-11-01T11:00:01Z");
w("derivation.attestation.json", derivation);
writeFileSync(join(root, "built/.well-known/innsigle/derivations/sample-html.derivation.json"), JSON.stringify(derivation, null, 2) + "\n");

w("expected.json", {
  source_sha256: D,
  output_sha256: O,
  human_key_id: human.keyId,
  build_key_id: build.keyId,
  review_jcs_sha256: sha256Hex(reviewCanon),
  derivation_jcs_sha256: sha256Hex(derivCanon),
  verify_at: "2026-12-01T00:00:00Z",
});
console.error("review vectors written to", root);
