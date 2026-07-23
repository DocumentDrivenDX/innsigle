import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as nodeSign,
  verify as nodeVerify,
} from "node:crypto";
import { jcs } from "./canonical.mjs";

export function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

export function sha256Raw(data) {
  return createHash("sha256").update(data).digest();
}

export function publicKeyToRaw(spkiOrRaw) {
  if (spkiOrRaw.length === 32) return spkiOrRaw;
  if (spkiOrRaw.length >= 32) return spkiOrRaw.subarray(spkiOrRaw.length - 32);
  throw new Error("invalid public key length");
}

export function keyIdFromPublicKey(publicKeyRaw) {
  const raw = publicKeyToRaw(publicKeyRaw);
  return `ed25519:${sha256Hex(raw).slice(0, 32)}`;
}

export function rawToSpkiPublic(raw) {
  if (raw.length !== 32) throw new Error("raw public key must be 32 bytes");
  const prefix = Buffer.from("302a300506032b6570032100", "hex");
  return Buffer.concat([prefix, raw]);
}

export function generateEd25519() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const spki = publicKey.export({ type: "spki", format: "der" });
  const publicKeyRaw = publicKeyToRaw(spki);
  const keyId = keyIdFromPublicKey(publicKeyRaw);
  return { publicKeyRaw, privateKeyPem, publicKeyPem, keyId };
}

export function b64url(buf) {
  return buf.toString("base64url");
}

export function b64urlDecode(s) {
  return Buffer.from(s, "base64url");
}

export function signPayload(payload, privateKeyPem) {
  const digest = sha256Raw(jcs(payload));
  const key = createPrivateKey(privateKeyPem);
  return nodeSign(null, digest, key);
}

export function verifyPayload(payload, signature, publicKeyRaw) {
  const digest = sha256Raw(jcs(payload));
  const spki = rawToSpkiPublic(publicKeyRaw);
  const key = createPublicKey({ key: spki, format: "der", type: "spki" });
  return nodeVerify(null, digest, key, signature);
}
