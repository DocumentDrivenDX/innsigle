import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { b64url, sha256Hex, signPayload } from "./crypto.mjs";
import {
  defaultAttestationPath,
  guessContentUri,
  loadProject,
  PATHS,
} from "./config.mjs";
import { readPrivateKeyPem } from "./onepassword.mjs";

const EXAMPLE_COLO = {
  "model-primary": {
    schema_version: "1",
    composition: "model-primary",
    ingredients: [
      { kind: "model", name: "Claude", role: "draft" },
      { kind: "tool", name: "sloptimizer", role: "rewrite" },
      { kind: "human", name: "operator", role: "structure-edit" },
    ],
    notes: null,
  },
  "human-authored": {
    schema_version: "1",
    composition: "human-authored",
    ingredients: [{ kind: "human", name: "operator", role: "author" }],
    notes: null,
  },
  mixed: {
    schema_version: "1",
    composition: "mixed",
    ingredients: [
      { kind: "human", name: "operator", role: "outline" },
      { kind: "model", name: "Claude", role: "expand" },
      { kind: "human", name: "operator", role: "final-edit" },
    ],
    notes: null,
  },
};

function arg(args, name) {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1];
}

function positionalContent(args) {
  // first non-flag token
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("-")) {
      if (a === "--colo" || a === "--bill" || a === "--kind" || a === "--uri" || a === "--out" || a === "--key" || a === "--op-ref") {
        i++; // skip value
      }
      continue;
    }
    return a;
  }
  return undefined;
}

/**
 * Resolve colophon object for seal.
 * Order: --colo file → .innsigle/colo.json → --kind / user default_composition → model-primary
 */
function resolveColophon(args, project) {
  const coloFile = arg(args, "--colo") ?? arg(args, "--bill");
  if (coloFile) {
    if (!existsSync(coloFile)) throw new Error(`colo file missing: ${coloFile}`);
    return JSON.parse(readFileSync(coloFile, "utf8"));
  }
  if (project && existsSync(project.coloPath)) {
    return JSON.parse(readFileSync(project.coloPath, "utf8"));
  }
  const kind =
    arg(args, "--kind") ||
    project?.user?.default_composition ||
    project?.config?.default_composition ||
    "model-primary";
  if (!EXAMPLE_COLO[kind]) {
    throw new Error(`kind must be model-primary|human-authored|mixed (got ${kind})`);
  }
  return structuredClone(EXAMPLE_COLO[kind]);
}

function loadPrivateKey(args, project) {
  const keyPath = arg(args, "--key");
  if (keyPath) return readFileSync(keyPath, "utf8");
  const ref = arg(args, "--op-ref") || project?.config?.onepassword?.private_key_ref;
  if (!ref) {
    throw new Error(
      "no signing key: run innsigle init --onepassword, or pass --key / --op-ref",
    );
  }
  return readPrivateKeyPem(ref);
}

/**
 * innsigle seal <content> [--kind …] [--colo …] [--uri …] [--out att.json]
 *
 * Uses .innsigle/config.json + 1Password. Writes attestation under
 * .innsigle/public/claims/ by default.
 *
 * @returns {number} exit code
 */
export function runSeal(args, deps) {
  const log = deps.log || ((s) => console.error(s));
  const err = deps.err || ((s) => console.error(s));
  const nowIso = deps.nowIso;

  const contentPath = positionalContent(args);
  if (!contentPath) {
    err("Usage: innsigle seal <content-file> [--kind model-primary|human-authored|mixed]");
    err("                              [--colo colo.json] [--uri https://…] [--out att.json]");
    err("Requires .innsigle/config.json (innsigle init --onepassword). Key from 1Password.");
    return 1;
  }
  if (!existsSync(contentPath)) {
    err(`INVALID: content missing: ${contentPath}`);
    return 1;
  }

  const project = loadProject();
  if (!project?.config?.issuer) {
    err("INVALID: no .innsigle/config.json — run: innsigle init --onepassword --site-url https://…");
    return 1;
  }

  const issuer = project.config.issuer;
  if (!issuer.id || !issuer.name || !issuer.key_id || !issuer.key_url) {
    err("INVALID: .innsigle/config.json issuer incomplete");
    return 5;
  }

  let colophon;
  try {
    colophon = resolveColophon(args, project);
  } catch (e) {
    err(`INVALID: ${e.message}`);
    return 5;
  }
  if (!colophon.composition || !Array.isArray(colophon.ingredients)) {
    err("INVALID: colophon schema");
    return 5;
  }
  colophon.schema_version = "1";

  const uri =
    arg(args, "--uri") || guessContentUri(project.config, project.repoRoot, contentPath);

  const claim = {
    innsigle: "1",
    type: "https://innsigle.dev/claim/colophon/v1",
    issued_at: nowIso(),
    issuer: {
      id: issuer.id,
      name: issuer.name,
      key_id: issuer.key_id,
      key_url: issuer.key_url,
    },
    subjects: [
      {
        ...(uri ? { uri } : {}),
        digest: { alg: "sha256", value: sha256Hex(readFileSync(contentPath)) },
      },
    ],
    colophon,
  };

  let privateKeyPem;
  try {
    privateKeyPem = loadPrivateKey(args, project);
  } catch (e) {
    err(`INVALID: ${e.message}`);
    return 1;
  }

  const sig = signPayload(claim, privateKeyPem);
  const attestation = {
    payload: claim,
    payload_encoding: "json",
    signatures: [
      {
        key_id: claim.issuer.key_id,
        alg: "ed25519",
        sig: b64url(sig),
        signed_at: nowIso(),
      },
    ],
  };

  const outPath =
    arg(args, "--out") || defaultAttestationPath(project.repoRoot, contentPath);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(attestation, null, 2) + "\n");

  // Keep a claim snapshot next to att for debugging (optional, small)
  const claimSide = outPath.replace(/\.attestation\.json$/i, ".claim.json");
  if (claimSide !== outPath) {
    writeFileSync(claimSide, JSON.stringify(claim, null, 2) + "\n");
  }

  log(`ok: sealed ${contentPath}`);
  log(`attestation=${outPath}`);
  log(`composition=${colophon.composition}`);
  log(`key_id=${issuer.key_id}`);
  if (uri) log(`uri=${uri}`);
  log(`next: copy ${PATHS.public}/ into site /.well-known/innsigle/ (see ${PATHS.agents})`);
  return 0;
}

/**
 * Resolve attestation + keys paths for short verify.
 * Prefers paths next to the content file, then .innsigle/ for the project that
 * owns that file (walk up from content), then cwd project.
 * @param {string[]} args
 */
export function resolveVerifyPaths(args) {
  const content =
    arg(args, "--content") ||
    (() => {
      for (const a of args) {
        if (!a.startsWith("-")) return a;
      }
      return undefined;
    })();

  let att = arg(args, "--attestation");
  let keys = arg(args, "--keys");

  // Project for the content file (may differ from cwd)
  const contentAbs = content ? resolve(content) : null;
  const project =
    (contentAbs && loadProject(dirname(contentAbs))) || loadProject();

  const base = content
    ? basename(content).replace(/\.[^.]+$/, "") || "index"
    : "index";

  if (content && !att) {
    // 1) published well-known beside the content file (public/.well-known/…)
    const near = resolve(
      dirname(contentAbs),
      ".well-known/innsigle/claims",
      `${base}.attestation.json`,
    );
    if (existsSync(near)) att = near;

    // 2) staging claims for that project
    if ((!att || !existsSync(att)) && project) {
      const staged = defaultAttestationPath(project.repoRoot, contentAbs);
      if (existsSync(staged)) att = staged;
      const pubIdx = resolve(
        project.repoRoot,
        "public/.well-known/innsigle/claims",
        `${base}.attestation.json`,
      );
      if ((!att || !existsSync(att)) && existsSync(pubIdx)) att = pubIdx;
    }
  }

  if (!keys) {
    if (contentAbs) {
      const nearKeys = resolve(dirname(contentAbs), ".well-known/innsigle/keys.json");
      if (existsSync(nearKeys)) keys = nearKeys;
    }
    if ((!keys || !existsSync(keys)) && project && existsSync(project.keysPath)) {
      keys = project.keysPath;
    }
    if ((!keys || !existsSync(keys)) && project) {
      const pubKeys = resolve(project.repoRoot, "public/.well-known/innsigle/keys.json");
      if (existsSync(pubKeys)) keys = pubKeys;
    }
  }

  return { content: contentAbs || content, att, keys, project };
}
