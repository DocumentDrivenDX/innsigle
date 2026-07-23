#!/usr/bin/env node
/**
 * Regenerate tests/vectors golden files.
 * WARNING: overwrites the test private key and all derived signatures.
 * Run only when ADR-001 crypto or claim schema changes.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { jcs } from "../src/canonical.mjs";
import {
  b64url,
  generateEd25519,
  sha256Hex,
  signPayload,
} from "../src/crypto.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "tests", "vectors");
mkdirSync(join(root, "content"), { recursive: true });

const { publicKeyRaw, privateKeyPem, publicKeyPem, keyId } = generateEd25519();
writeFileSync(join(root, "ed25519.priv.pem"), privateKeyPem);
writeFileSync(join(root, "ed25519.pub.pem"), publicKeyPem);
writeFileSync(join(root, "ed25519.pub.raw.b64url"), b64url(publicKeyRaw) + "\n");
writeFileSync(join(root, "key-id.txt"), keyId + "\n");

const content = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Innsigle vector sample</title></head>
<body>
<p>Golden vector content for Innsigle claim hashing. Do not edit without regenerating vectors.</p>
</body>
</html>
`;
writeFileSync(join(root, "content/sample.html"), content);
const digest = sha256Hex(content);

const bill = {
  schema_version: "1",
  composition: "model-primary",
  ingredients: [
    { kind: "model", name: "Claude", role: "draft" },
    { kind: "tool", name: "sloptimizer", role: "rewrite" },
    { kind: "human", name: "operator", role: "structure-edit" },
  ],
  notes: null,
};
writeFileSync(join(root, "bill-model-primary.json"), JSON.stringify(bill, null, 2) + "\n");

const keys = {
  innsigle_keys: "1",
  issuer_id: "azgaard-test",
  issuer_name: "Azgaard Test",
  keys: [
    {
      key_id: keyId,
      alg: "ed25519",
      public_key: b64url(publicKeyRaw),
      created_at: "2026-07-22T00:00:00Z",
      revoked_at: null,
    },
  ],
};
writeFileSync(join(root, "keys.json"), JSON.stringify(keys, null, 2) + "\n");

const payload = {
  innsigle: "1",
  type: "https://innsigle.dev/claim/mash-bill/v1",
  issued_at: "2026-07-22T12:00:00Z",
  issuer: {
    id: "azgaard-test",
    name: "Azgaard Test",
    key_id: keyId,
    key_url: "https://example.com/.well-known/innsigle/keys.json",
  },
  subjects: [
    {
      uri: "https://example.com/vectors/sample.html",
      digest: { alg: "sha256", value: digest },
    },
  ],
  mash_bill: bill,
};
writeFileSync(join(root, "claim.json"), JSON.stringify(payload, null, 2) + "\n");

const canonical = jcs(payload);
writeFileSync(join(root, "claim.jcs.txt"), canonical + "\n");
writeFileSync(join(root, "claim.jcs.sha256"), sha256Hex(canonical) + "\n");

const sig = signPayload(payload, privateKeyPem);
const attestation = {
  payload,
  payload_encoding: "json",
  signatures: [
    {
      key_id: keyId,
      alg: "ed25519",
      sig: b64url(sig),
      signed_at: "2026-07-22T12:00:01Z",
    },
  ],
};
writeFileSync(join(root, "attestation.json"), JSON.stringify(attestation, null, 2) + "\n");

writeFileSync(
  join(root, "expected.json"),
  JSON.stringify(
    {
      content_sha256: digest,
      key_id: keyId,
      public_key_b64url: b64url(publicKeyRaw),
      claim_jcs_sha256: sha256Hex(canonical),
      signature_b64url: b64url(sig),
      note: "TEST KEY ONLY — regenerate with node scripts/generate-vectors.mjs if crypto changes",
    },
    null,
    2,
  ) + "\n",
);

console.error(`wrote ${root}`);
console.error(`key_id=${keyId}`);
console.error(`content_sha256=${digest}`);
