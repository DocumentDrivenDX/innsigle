import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { b64url, sha256Hex, signPayload } from "./crypto.mjs";
import {
  attestationSlug,
  defaultAttestationPath,
  DIR_NAME,
  guessContentUri,
  legacyAttestationName,
  loadProject,
  PATHS,
} from "./config.mjs";
import { readPrivateKeyPem } from "./onepassword.mjs";
import { checkAttestation, collectStatus } from "./status.mjs";

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
      if (
        a === "--colo" ||
        a === "--bill" ||
        a === "--kind" ||
        a === "--uri" ||
        a === "--out" ||
        a === "--key" ||
        a === "--op-ref" ||
        a === "--op-account"
      ) {
        i++; // skip value
      }
      continue;
    }
    return a;
  }
  return undefined;
}

/**
 * Resolve colophon object for seal (PLAN-001 A6).
 * Order: --colo file → <content-dir>/colo.json → .innsigle/colo.json →
 * --kind / user default_composition → model-primary
 */
function resolveColophon(args, project, contentPath) {
  const coloFile = arg(args, "--colo") ?? arg(args, "--bill");
  if (coloFile) {
    if (!existsSync(coloFile)) throw new Error(`colo file missing: ${coloFile}`);
    return JSON.parse(readFileSync(coloFile, "utf8"));
  }
  if (contentPath) {
    const sidecar = join(dirname(resolve(contentPath)), "colo.json");
    if (existsSync(sidecar)) {
      return JSON.parse(readFileSync(sidecar, "utf8"));
    }
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
  return readPrivateKeyPem(ref, { account: arg(args, "--op-account") });
}

function issuerFromProject(project, err) {
  const issuer = project?.config?.issuer;
  if (!issuer) {
    err("INVALID: no .innsigle/config.json — run: innsigle init --onepassword --site-url https://…");
    return null;
  }
  if (!issuer.id || !issuer.name || !issuer.key_id || !issuer.key_url) {
    err("INVALID: .innsigle/config.json issuer incomplete");
    return null;
  }
  return issuer;
}

function buildClaim({ issuer, uri, digestHex, colophon, nowIso }) {
  return {
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
        digest: { alg: "sha256", value: digestHex },
      },
    ],
    colophon,
  };
}

function signAttestation(claim, privateKeyPem, nowIso) {
  const sig = signPayload(claim, privateKeyPem);
  return {
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
}

function loadKeysDoc(project) {
  return JSON.parse(readFileSync(project.keysPath, "utf8"));
}

/**
 * Write attestation, then verify it against the project keys file.
 * On failure delete the written attestation.
 * @returns {{ ok: boolean, reason?: string }}
 */
function writeVerified({ outPath, attestation, project, contentBytes }) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(attestation, null, 2) + "\n");
  let keysDoc;
  try {
    keysDoc = loadKeysDoc(project);
  } catch {
    try {
      unlinkSync(outPath);
    } catch {
      /* ignore */
    }
    return { ok: false, reason: `cannot read ${PATHS.keys}` };
  }
  const check = checkAttestation({ attestation, keysDoc, contentBytes });
  if (!check.ok) {
    try {
      unlinkSync(outPath);
    } catch {
      /* ignore */
    }
    return check;
  }
  return { ok: true };
}

/**
 * innsigle seal --stale — re-seal every STALE claim, reusing each claim's
 * existing colophon and uri; reads the private key once (PLAN-001 A5).
 * @returns {number} exit code
 */
function runSealStale(args, deps) {
  const log = deps.log || ((s) => console.error(s));
  const err = deps.err || ((s) => console.error(s));
  const nowIso = deps.nowIso;

  const project = loadProject();
  if (!project?.config?.issuer) {
    err("INVALID: no .innsigle/config.json — run: innsigle init --onepassword --site-url https://…");
    return 1;
  }
  const issuer = issuerFromProject(project, err);
  if (!issuer) return 5;

  const { entries } = collectStatus(project);
  const stale = entries.filter((e) => e.state === "STALE");
  if (!stale.length) {
    log("up to date: no stale claims");
    return 0;
  }

  let privateKeyPem;
  try {
    privateKeyPem = loadPrivateKey(args, project); // once, for the whole loop
  } catch (e) {
    err(`INVALID: ${e.message}`);
    return 1;
  }

  let failures = 0;
  for (const e of stale) {
    const srcAbs = join(project.repoRoot, e.source);
    const contentBytes = readFileSync(srcAbs);
    const old = e.attestation.payload;
    const claim = buildClaim({
      issuer,
      uri: old.subjects?.[0]?.uri,
      digestHex: sha256Hex(contentBytes),
      colophon: old.colophon,
      nowIso,
    });
    const attestation = signAttestation(claim, privateKeyPem, nowIso);
    const outPath = defaultAttestationPath(project.repoRoot, srcAbs);
    const res = writeVerified({ outPath, attestation, project, contentBytes });
    if (!res.ok) {
      err(`INVALID: reseal self-verify failed for ${e.source} (${res.reason})`);
      failures++;
      continue;
    }
    if (outPath !== e.claimPath && existsSync(e.claimPath)) {
      unlinkSync(e.claimPath); // migrate legacy-named claim to canonical slug
    }
    log(`ok: resealed ${e.source}`);
    log(`attestation=${outPath}`);
  }
  return failures ? 2 : 0;
}

/**
 * innsigle seal <content> [--kind …] [--colo …] [--uri …] [--out att.json]
 *                [--force] [--debug-claim] [--op-account <acct>]
 * innsigle seal --stale
 *
 * Uses .innsigle/config.json + 1Password. Writes attestation under
 * .innsigle/public/claims/ by default; idempotent unless --force; verifies
 * its own output against .innsigle/public/keys.json before reporting ok.
 *
 * @returns {number} exit code
 */
export function runSeal(args, deps) {
  const log = deps.log || ((s) => console.error(s));
  const err = deps.err || ((s) => console.error(s));
  const nowIso = deps.nowIso;

  if (args.includes("--stale")) return runSealStale(args, deps);

  const contentPath = positionalContent(args);
  if (!contentPath) {
    err("Usage: innsigle seal <content-file> [--kind model-primary|human-authored|mixed]");
    err("                              [--colo colo.json] [--uri https://…] [--out att.json]");
    err("                              [--force] [--debug-claim] [--op-account <acct>]");
    err("       innsigle seal --stale   # re-seal drifted claims");
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
  const issuer = issuerFromProject(project, err);
  if (!issuer) return 5;

  let colophon;
  try {
    colophon = resolveColophon(args, project, contentPath);
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

  const contentBytes = readFileSync(contentPath);
  const digestHex = sha256Hex(contentBytes);
  const outPath =
    arg(args, "--out") || defaultAttestationPath(project.repoRoot, contentPath);

  // Idempotence (PLAN-001 A2): existing attestation over identical bytes → no-op.
  if (!args.includes("--force") && existsSync(outPath)) {
    try {
      const prev = JSON.parse(readFileSync(outPath, "utf8"));
      if (prev?.payload?.subjects?.[0]?.digest?.value === digestHex) {
        log(`up to date: ${outPath}`);
        return 0;
      }
    } catch {
      /* unreadable previous attestation — fall through and re-seal */
    }
  }

  const claim = buildClaim({ issuer, uri, digestHex, colophon, nowIso });

  let privateKeyPem;
  try {
    privateKeyPem = loadPrivateKey(args, project);
  } catch (e) {
    err(`INVALID: ${e.message}`);
    return 1;
  }

  const attestation = signAttestation(claim, privateKeyPem, nowIso);
  const res = writeVerified({ outPath, attestation, project, contentBytes });
  if (!res.ok) {
    err(`INVALID: seal self-verify failed (${res.reason}) — attestation not kept`);
    return 2;
  }

  // Debug sidecar (PLAN-001 A4): only with --debug-claim, under .innsigle/debug/.
  if (args.includes("--debug-claim")) {
    const debugDir = join(project.repoRoot, DIR_NAME, "debug");
    mkdirSync(debugDir, { recursive: true });
    const name = basename(outPath).replace(/\.attestation\.json$/i, "");
    const claimSide = join(debugDir, `${name}.claim.json`);
    writeFileSync(claimSide, JSON.stringify(claim, null, 2) + "\n");
    log(`debug claim=${claimSide}`);
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
 * Attestation lookup tries the canonical slug name first (PLAN-001 A1), then
 * the legacy basename-minus-extension name so existing sites keep verifying.
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

  if (content && !att) {
    // Candidate filenames: slug (canonical) first, legacy basename second.
    const names = [];
    if (project) {
      names.push(`${attestationSlug(project.repoRoot, contentAbs)}.attestation.json`);
    }
    names.push(legacyAttestationName(content));
    const candNames = [...new Set(names)];

    // Candidate directories, in preference order:
    // 1) published well-known beside the content file
    // 2) staging claims for that project
    // 3) project publish tree well-known
    const dirs = [resolve(dirname(contentAbs), ".well-known/innsigle/claims")];
    if (project) {
      dirs.push(join(project.repoRoot, PATHS.claims_dir));
      dirs.push(resolve(project.repoRoot, "public/.well-known/innsigle/claims"));
    }
    outer: for (const dir of dirs) {
      for (const name of candNames) {
        const candidate = join(dir, name);
        if (existsSync(candidate)) {
          att = candidate;
          break outer;
        }
      }
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
