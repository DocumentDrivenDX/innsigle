/**
 * Human vs build signing material (ADR-004).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readPrivateKeyPem } from "./onepassword.mjs";

function arg(args, name) {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1];
}

/** mixed / human-authored → human; model-primary → build */
export function roleForComposition(composition) {
  return composition === "model-primary" ? "build" : "human";
}

/**
 * @returns {{ pem: string, keyId: string }}
 */
export function loadPrivateKeyForRole(args, project, role) {
  const cfg = project?.config || {};
  const slot = cfg.keys?.[role] || {};
  const envName = role === "build" ? "INNSIGLE_BUILD_KEY" : "INNSIGLE_HUMAN_KEY";
  const envVal = process.env[envName];
  let pem;
  const keyFlag = arg(args, "--key");
  const flagRole = arg(args, "--role") || "human";
  if (keyFlag && flagRole === role) {
    pem = readFileSync(resolve(project.repoRoot, keyFlag), "utf8");
  } else if (envVal && String(envVal).includes("BEGIN")) {
    pem = String(envVal);
  } else if (slot.signing_key) {
    const abs = resolve(project.repoRoot, slot.signing_key);
    if (!existsSync(abs)) throw new Error(`${role} signing key missing: ${slot.signing_key}`);
    pem = readFileSync(abs, "utf8");
  } else if (role === "human" && cfg.signing_key) {
    const abs = resolve(project.repoRoot, cfg.signing_key);
    if (!existsSync(abs)) throw new Error(`signing key missing: ${cfg.signing_key}`);
    pem = readFileSync(abs, "utf8");
  } else if (role === "human") {
    const ref = arg(args, "--op-ref") || slot.onepassword || cfg.onepassword?.private_key_ref;
    if (ref) pem = readPrivateKeyPem(ref, { account: arg(args, "--op-account") });
  }
  if (!pem && role === "build" && !cfg.keys?.build) {
    // Legacy single-key houses: the human key still seals model-primary.
    return loadPrivateKeyForRole(args, project, "human");
  }
  if (!pem) {
    throw new Error(
      role === "build"
        ? "no build key: set INNSIGLE_BUILD_KEY or keys.build.signing_key"
        : "no human key: keys.human.signing_key, signing_key, or innsigle init --onepassword",
    );
  }
  const keyId =
    slot.key_id ||
    (role === "human" ? cfg.issuer?.key_id : undefined);
  if (!keyId) {
    throw new Error(`keys.${role}.key_id missing in .innsigle/config.json`);
  }
  return { pem, keyId };
}

export function tryLoadPrivateKeyForRole(args, project, role) {
  try {
    return loadPrivateKeyForRole(args, project, role);
  } catch {
    return null;
  }
}

export function issuerForKey(project, keyId) {
  const iss = project.config.issuer;
  return {
    id: iss.id,
    name: iss.name,
    key_id: keyId,
    key_url: iss.key_url,
  };
}

/** One-hop: does keys.json list an endorsement of this key? */
export function endorsementIndexEntry(keysDoc, subjectKeyId) {
  const list = keysDoc?.endorsements;
  if (!Array.isArray(list)) return null;
  return list.find((e) => e.subject_key_id === subjectKeyId) || null;
}
