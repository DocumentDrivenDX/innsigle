/**
 * Derivation claim (ADR-005 D3-D4, CONTRACT-001 v1.2).
 *
 * "Output digest O was built from source digest D", signed by the build key,
 * carrying the human's review of D embedded verbatim (never re-signed). A
 * verifier walks: output file → derivation claim → build key (build role,
 * endorsed by a human key) → input digest → embedded human review (human role,
 * same digest, unexpired).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { b64url, b64urlDecode, sha256Hex, signPayload, verifyPayload } from "./crypto.mjs";
import {
  PATHS,
  defaultAttestationPath,
  loadProject,
  slugOpts,
  validateConfig,
} from "./config.mjs";
import { docIdOf } from "./frontmatter.mjs";
import { loadPrivateKeyForRole } from "./keys.mjs";
import {
  checkReview,
  loadEndorsements,
  makeRoles,
  reviewStateOf,
  rolesForProject,
  writeJsonAtomic,
} from "./review.mjs";
import { globToRegExp } from "./status.mjs";

export const DERIVATION_TYPE = "https://innsigle.dev/claim/derivation/v1";
const RFC3339_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const KEY_ID = /^ed25519:[0-9a-f]{32}$/;
const HEX64 = /^[0-9a-f]{64}$/;
export const WELL_KNOWN = ".well-known/innsigle";

function arg(args, name) {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}
function multi(args, name) {
  const out = [];
  for (let i = 0; i < args.length; i++) if (args[i] === name && args[i + 1]) out.push(args[++i]);
  return out;
}
function nowIsoDefault() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
const posix = (p) => p.split(sep).join("/");

/** @returns {string | null} */
export function validateDerivationPayload(p) {
  if (!p || typeof p !== "object") return "payload not an object";
  if (p.innsigle !== "1") return "innsigle must be \"1\"";
  if (p.type !== DERIVATION_TYPE) return "type must be the derivation claim type";
  if (typeof p.issued_at !== "string" || !RFC3339_UTC.test(p.issued_at)) return "issued_at must be RFC 3339 UTC";
  const i = p.issuer;
  if (!i || !i.id || !i.name || !KEY_ID.test(i.key_id || "") || !i.key_url) return "issuer incomplete";
  if ("colophon" in p) return "derivation claims must not carry a colophon (FR-4a)";
  if (!Array.isArray(p.subjects) || !p.subjects.length) return "at least one output subject required";
  for (const s of p.subjects) {
    if (typeof s?.path !== "string" || !s.path || s.path.startsWith("/") || s.path.split("/").includes("..")) {
      return "subject.path must be a tree-relative posix path";
    }
    if (s.digest?.alg !== "sha256" || !HEX64.test(s.digest?.value || "")) return "subject digest must be sha256 hex";
  }
  const d = p.derivation;
  if (!d || d.schema_version !== "1") return "derivation.schema_version must be \"1\"";
  if (d.transform !== undefined && (typeof d.transform?.name !== "string" || !d.transform.name)) {
    return "derivation.transform.name must be a non-empty string";
  }
  if (!Array.isArray(d.inputs) || !d.inputs.length) return "at least one input required";
  for (const inp of d.inputs) {
    if (typeof inp?.path !== "string" || !inp.path) return "input.path required";
    if (inp.digest?.alg !== "sha256" || !HEX64.test(inp.digest?.value || "")) return "input digest must be sha256 hex";
    if (!Array.isArray(inp.reviews)) return "input.reviews must be an array (possibly empty)";
  }
  return null;
}

/**
 * Check one derivation attestation's chain, independent of any output file.
 * @returns {{ ok: boolean, code?: number, reason?: string, inputs: Array<{path: string, state: string, reason?: string}> }}
 *   code uses the verify exit table: 2 bad signature, 4 key/role, 5 schema, 6 review chain
 */
export function checkDerivation({ att, keysDoc, roles, now }) {
  const fail = (code, reason, inputs = []) => ({ ok: false, code, reason, inputs });
  const pl = att?.payload;
  if (!att?.signatures?.length) return fail(5, "schema");
  const problem = validateDerivationPayload(pl);
  if (problem) return fail(5, `schema: ${problem}`);
  const sb = att.signatures[0];
  if (sb.key_id !== pl.issuer.key_id) return fail(5, "key_mismatch");
  const key = keysDoc?.keys?.find((k) => k.key_id === sb.key_id);
  if (!key) return fail(4, "unknown_key");
  if (key.revoked_at) return fail(4, "revoked_key");
  let ok = false;
  try {
    ok = verifyPayload(pl, b64urlDecode(sb.sig), b64urlDecode(key.public_key));
  } catch {
    ok = false;
  }
  if (!ok) return fail(2, "bad_signature");
  if (!roles.isBuild(sb.key_id)) return fail(4, "wrong_role");
  if (!roles.endorserOf(sb.key_id)) return fail(4, "build_key_unendorsed");

  const inputs = [];
  let first = null;
  for (const inp of pl.derivation.inputs) {
    const st = reviewStateOf(
      { reviews: inp.reviews },
      { contentDigest: inp.digest.value, keysDoc, roles, now },
    );
    const reason =
      st.state === "REVIEWED"
        ? undefined
        : st.state === "UNREVIEWED"
          ? "review_missing"
          : st.state === "REVIEW-STALE"
            ? "review_stale"
            : st.state === "REVIEW-EXPIRED"
              ? "review_expired"
              : `review_invalid(${st.reason})`;
    inputs.push({ path: inp.path, state: st.state, reason });
    if (reason && !first) first = `${inp.path}: ${reason}`;
  }
  if (first) return { ok: false, code: 6, reason: first, inputs };
  return { ok: true, inputs };
}

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function walkFiles(dir, base = dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) walkFiles(p, base, out);
    else if (st.isFile()) out.push(posix(relative(base, p)));
  }
  return out.sort();
}

// ─── innsigle derive ───────────────────────────────────────────────────────

/**
 * innsigle derive --tree <dir> --from <source>… --output <tree-relative>…
 *   [--transform name[@version]] [--require-review] [--out file]
 *
 * One claim: M inputs → N outputs. Build role only.
 * @returns {number}
 */
export function runDerive(args, deps = {}) {
  const log = deps.log || ((s) => console.error(s));
  const err = deps.err || ((s) => console.error(s));
  const nowIso = deps.nowIso || nowIsoDefault;
  const project = loadProject();
  if (!project?.config?.issuer) {
    err("INVALID: no .innsigle/config.json — run: innsigle init --onepassword --site-url https://…");
    return 1;
  }
  const problems = validateConfig(project.config);
  if (problems.length) {
    for (const p of problems) err(`INVALID: .innsigle/config.json: ${p}`);
    return 5;
  }
  const tree = arg(args, "--tree");
  const froms = multi(args, "--from");
  const outputs = multi(args, "--output");
  if (!tree || !froms.length || !outputs.length) {
    err("Usage: innsigle derive --tree <built-dir> --from <source>… --output <path-in-tree>…");
    err("                       [--transform name[@version]] [--require-review] [--out file]");
    err("  one claim lists every source (bundle) and every output (fan-out) it covers");
    return 1;
  }
  if (arg(args, "--role") && arg(args, "--role") !== "build") {
    err("INVALID: a derivation is signed by the build role only");
    return 1;
  }
  let keysDoc;
  try {
    keysDoc = JSON.parse(readFileSync(project.keysPath, "utf8"));
  } catch {
    err(`INVALID: cannot read ${PATHS.keys}`);
    return 4;
  }
  let material;
  try {
    material = loadPrivateKeyForRole(args, project, "build");
  } catch (e) {
    err(`INVALID: ${e.message}`);
    return 1;
  }
  const roles = rolesForProject(project, keysDoc);
  if (!roles.isBuild(material.keyId)) {
    err(
      `INVALID: key ${material.keyId} is not a build-role key (a derivation needs a build key distinct from the human key — ADR-004)`,
    );
    return 1;
  }
  if (!roles.endorserOf(material.keyId)) {
    err(`INVALID: build key ${material.keyId} is not endorsed by the human key — run: innsigle endorse --subject-key-id ${material.keyId}`);
    return 1;
  }

  const issuedAt = nowIso();
  const now = Date.parse(issuedAt);
  const idKey = project.config.attestation_key?.frontmatter;
  const inputs = [];
  let missing = 0;
  for (const f of froms) {
    const abs = resolve(f);
    if (!existsSync(abs)) {
      err(`INVALID: source missing: ${f}`);
      return 1;
    }
    const digest = sha256Hex(readFileSync(abs));
    const att = readJson(defaultAttestationPath(project.repoRoot, abs, slugOpts(project)));
    const list = Array.isArray(att?.reviews) ? att.reviews : [];
    const good = list.filter(
      (review) => checkReview({ review, keysDoc, roles, contentDigest: digest, now }).state === "REVIEWED",
    );
    const rel = posix(relative(project.repoRoot, abs));
    if (!good.length) {
      missing++;
      log(`warn: ${rel}: no valid current human review to embed`);
    }
    const id = idKey ? docIdOf(abs, idKey) : undefined;
    inputs.push({
      path: rel,
      ...(id ? { id } : {}),
      digest: { alg: "sha256", value: digest },
      reviews: good, // verbatim: the human's signed attestation, untouched
    });
  }
  if (missing && args.includes("--require-review")) {
    err(`not derived: ${missing} source(s) lack a valid human review (--require-review)`);
    return 6;
  }

  const subjects = [];
  for (const o of outputs) {
    const abs = resolve(tree, o);
    const rel = posix(relative(resolve(tree), abs));
    if (rel.startsWith("..") || !existsSync(abs) || !statSync(abs).isFile()) {
      err(`INVALID: output missing or outside tree: ${o}`);
      return 1;
    }
    subjects.push({ path: rel, digest: { alg: "sha256", value: sha256Hex(readFileSync(abs)) } });
  }
  const tf = arg(args, "--transform");
  const [tname, tver] = tf ? tf.split("@") : [];
  const payload = {
    innsigle: "1",
    type: DERIVATION_TYPE,
    issued_at: issuedAt,
    issuer: {
      id: project.config.issuer.id,
      name: project.config.issuer.name,
      key_id: material.keyId,
      key_url: project.config.issuer.key_url,
    },
    subjects,
    derivation: {
      schema_version: "1",
      ...(tname ? { transform: { name: tname, ...(tver ? { version: tver } : {}) } } : {}),
      inputs,
    },
  };
  const att = {
    payload,
    payload_encoding: "json",
    signatures: [
      {
        key_id: material.keyId,
        alg: "ed25519",
        sig: b64url(signPayload(payload, material.pem)),
        signed_at: issuedAt,
      },
    ],
  };
  const chk = checkDerivation({ att, keysDoc, roles, now });
  if (!chk.ok && chk.code !== 6) {
    err(`INVALID: derivation self-verify failed (${chk.reason})`);
    return 2;
  }
  const slug = subjects[0].path.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "output";
  const outPath =
    arg(args, "--out") ||
    join(resolve(tree), WELL_KNOWN, "derivations", `${slug}.derivation.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeJsonAtomic(outPath, att);
  log(`ok: derived ${subjects.length} output(s) from ${inputs.length} source(s)`);
  log(`derivation=${outPath}`);
  return 0;
}

// ─── innsigle verify --derived ─────────────────────────────────────────────

/**
 * innsigle verify --derived <tree> [--keys file] [--source-root dir]
 *   [--cover <glob>]… [--endorsements dir]
 *
 * Every derivation claim under <tree>/.well-known/innsigle/derivations/ is
 * checked end to end; a human review for every input is always required.
 * --cover: every tree file matching the glob must be an output of a valid
 * derivation. --source-root: also fail when a source changed since the build.
 *
 * Exit: 0 ok, 1 usage/IO, 2 bad signature, 3 output missing/changed/not
 * derived, 4 unknown/revoked/wrong-role/unendorsed key, 5 schema, 6 review
 * chain (missing, stale, expired, wrong role, source changed).
 * @returns {number}
 */
export function runVerifyDerived(args, deps = {}) {
  const out = deps.out || ((s) => console.log(s));
  const err = deps.err || ((s) => console.error(s));
  const nowIso = deps.nowIso || nowIsoDefault;
  const tree = arg(args, "--derived");
  if (!tree || !existsSync(tree) || !statSync(tree).isDirectory()) {
    err("Usage: innsigle verify --derived <built-dir> [--keys file] [--source-root dir] [--cover <glob>]…");
    return 1;
  }
  const root = resolve(tree);
  const project = loadProject();
  let keysPath = arg(args, "--keys");
  if (!keysPath) {
    const near = join(root, WELL_KNOWN, "keys.json");
    keysPath = existsSync(near) ? near : project && existsSync(project.keysPath) ? project.keysPath : null;
  }
  const keysDoc = keysPath ? readJson(keysPath) : null;
  if (!keysDoc?.keys) {
    err("INVALID: cannot read issuer keys (pass --keys or publish keys.json into the tree)");
    return 4;
  }
  const endDirs = [
    arg(args, "--endorsements"),
    join(root, WELL_KNOWN, "endorsements"),
    join(dirname(resolve(keysPath)), "endorsements"),
  ].filter(Boolean);
  const usesProjectConfig = project && resolve(keysPath) === resolve(project.keysPath);
  const roles = makeRoles({
    config: usesProjectConfig ? project.config : undefined,
    keysDoc,
    endorsements: loadEndorsements(endDirs),
  });

  const dDir = join(root, WELL_KNOWN, "derivations");
  const names = existsSync(dDir)
    ? readdirSync(dDir).filter((n) => n.endsWith(".derivation.json")).sort()
    : [];
  const now = Date.parse(nowIso());
  const sourceRoot = arg(args, "--source-root");
  const failures = []; // { code, line }
  const covered = new Set();
  let valid = 0;
  if (!names.length) failures.push({ code: 3, line: "INVALID - no derivation claims found (no_derivation)" });

  for (const n of names) {
    const att = readJson(join(dDir, n));
    const chk = checkDerivation({ att, keysDoc, roles, now });
    const subjects = att?.payload?.subjects || [];
    if (!chk.ok) {
      const paths = subjects.map((s) => s.path).filter(Boolean);
      failures.push({ code: chk.code, line: `INVALID ${paths.join(",") || "-"} (${n}): ${chk.reason}` });
      continue;
    }
    let bad = false;
    for (const s of subjects) {
      const abs = join(root, s.path);
      if (!existsSync(abs) || !statSync(abs).isFile()) {
        failures.push({ code: 3, line: `INVALID ${s.path} (${n}): output_missing` });
        bad = true;
      } else if (sha256Hex(readFileSync(abs)) !== s.digest.value) {
        failures.push({ code: 3, line: `INVALID ${s.path} (${n}): output_mismatch` });
        bad = true;
      }
    }
    if (sourceRoot) {
      for (const inp of att.payload.derivation.inputs) {
        const sp = join(resolve(sourceRoot), inp.path);
        if (!existsSync(sp) || sha256Hex(readFileSync(sp)) !== inp.digest.value) {
          failures.push({ code: 6, line: `INVALID ${inp.path} (${n}): source_changed` });
          bad = true;
        }
      }
    }
    if (bad) continue;
    for (const s of subjects) covered.add(s.path);
    valid++;
    out(
      `VALID ${subjects.map((s) => s.path).join(",")} (${n}) inputs=${chk.inputs.length} ` +
        chk.inputs.map((i) => `${i.path}:${i.state}`).join(","),
    );
  }

  const globs = multi(args, "--cover").map(globToRegExp);
  if (globs.length) {
    for (const rel of walkFiles(root)) {
      if (rel.startsWith(`${WELL_KNOWN}/`)) continue;
      if (globs.some((re) => re.test(rel)) && !covered.has(rel)) {
        failures.push({ code: 3, line: `INVALID ${rel}: no_derivation` });
      }
    }
  }

  for (const f of failures) out(f.line);
  if (failures.length) {
    err(`INVALID: ${failures.length} derivation problem(s)`);
    // Most fundamental failure wins: crypto/keys before output before review.
    const order = [2, 4, 5, 3, 6];
    return order.find((c) => failures.some((f) => f.code === c)) ?? 1;
  }
  out(`VALID derived (${valid} claim(s), ${covered.size} output(s))`);
  return 0;
}
