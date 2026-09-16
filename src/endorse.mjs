/**
 * ADR-003 D4 / ADR-004: human key endorses another Innsigle key
 * (typically the build key) for seal recognition, not content truth.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { b64url, signPayload } from "./crypto.mjs";
import { loadProject, PATHS } from "./config.mjs";
import { checkAttestation } from "./status.mjs";
import { loadPrivateKeyForRole } from "./keys.mjs";

const TYPE = "https://innsigle.dev/claim/key-endorsement/v1";
const EXIT = { ok: 0, usage: 1, badSchema: 5 };

function arg(args, name) {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1];
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function endorsementFname(keyId) {
  return `${String(keyId).replace(/[^a-zA-Z0-9]+/g, "-")}.attestation.json`;
}

/**
 * @param {string[]} args
 * @param {{ nowIso?: () => string, loadKey?: Function }} deps
 */
export function runEndorse(args, deps = {}) {
  const err = (s) => console.error(s);
  const log = (s) => console.error(s);
  const ts = deps.nowIso || nowIso;
  const project = loadProject();
  if (!project?.config?.issuer) {
    err("INVALID: no .innsigle/config.json");
    return EXIT.usage;
  }
  const subjectKeyId = arg(args, "--subject-key-id");
  const subjectKeyUrl = arg(args, "--subject-key-url") || project.config.issuer.key_url;
  if (!subjectKeyId) {
    err("Usage: innsigle endorse --subject-key-id <ed25519:…> [--subject-key-url <url>]");
    err("                     [--purpose build-signing] [--level full] [--key <pem>]");
    return EXIT.usage;
  }
  if (!/^ed25519:[0-9a-f]{32}$/.test(subjectKeyId)) {
    err("INVALID: --subject-key-id must look like ed25519:<32 hex chars>");
    return EXIT.badSchema;
  }
  try {
    const u = new URL(subjectKeyUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:" && u.protocol !== "file:") {
      err("INVALID: --subject-key-url must be absolute");
      return EXIT.badSchema;
    }
  } catch {
    err("INVALID: --subject-key-url must be an absolute URL");
    return EXIT.badSchema;
  }

  const human = project.config.keys?.human;
  const issuer = {
    id: project.config.issuer.id,
    name: project.config.issuer.name,
    key_id: human?.key_id || project.config.issuer.key_id,
    key_url: project.config.issuer.key_url,
  };
  const payload = {
    innsigle: "1",
    type: TYPE,
    issued_at: ts(),
    issuer,
    endorsement: {
      subject_key_id: subjectKeyId,
      subject_key_url: subjectKeyUrl,
      subject_issuer_id: project.config.issuer.id,
      level: arg(args, "--level") || "full",
      purpose: arg(args, "--purpose") || "build-signing",
    },
  };

  let pem;
  try {
    pem = (deps.loadKey || ((a, p) => loadPrivateKeyForRole(a, p, "human").pem))(
      args,
      project,
    );
  } catch (e) {
    err(`INVALID: ${e.message}`);
    return EXIT.usage;
  }
  const sig = signPayload(payload, pem);
  const attestation = {
    payload,
    payload_encoding: "json",
    signatures: [
      {
        key_id: issuer.key_id,
        alg: "ed25519",
        sig: b64url(sig),
        signed_at: ts(),
      },
    ],
  };

  let keysDoc;
  try {
    keysDoc = JSON.parse(readFileSync(project.keysPath, "utf8"));
  } catch (e) {
    err(`INVALID: cannot read ${PATHS.keys}: ${e.message}`);
    return EXIT.badSchema;
  }
  const check = checkAttestation({ attestation, keysDoc });
  if (!check.ok) {
    err(`INVALID: endorsement self-verify failed (${check.reason})`);
    return EXIT.badSchema;
  }

  const dir = join(project.repoRoot, PATHS.public, "endorsements");
  mkdirSync(dir, { recursive: true });
  const fname = endorsementFname(subjectKeyId);
  const rel = `${PATHS.public}/endorsements/${fname}`;
  writeFileSync(join(project.repoRoot, rel), JSON.stringify(attestation, null, 2) + "\n");

  const origin = issuer.key_url.replace(/\/keys\.json$/, "");
  const attestationUrl = `${origin}/endorsements/${fname}`;
  const index = Array.isArray(keysDoc.endorsements) ? keysDoc.endorsements : [];
  const next = index.filter((e) => e.subject_key_id !== subjectKeyId);
  next.push({
    attestation_url: attestationUrl,
    subject_key_id: subjectKeyId,
    subject_key_url: subjectKeyUrl,
    issued_at: payload.issued_at,
  });
  keysDoc.endorsements = next;
  writeFileSync(project.keysPath, JSON.stringify(keysDoc, null, 2) + "\n");
  log(`ok: endorsed ${subjectKeyId}`);
  log(`endorsement=${rel}`);
  return EXIT.ok;
}


