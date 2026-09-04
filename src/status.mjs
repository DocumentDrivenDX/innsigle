import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { b64urlDecode, sha256Hex, verifyPayload } from "./crypto.mjs";
import { attestationSlug, loadProject } from "./config.mjs";

/** Directories never scanned for content sources. */
const SKIP_DIRS = new Set([".git", "node_modules", ".innsigle"]);

/**
 * Verify an attestation document against an issuer keys document and
 * (optionally) content bytes. Pure check — no exits, no I/O.
 * @param {{ attestation: object, keysDoc: object, contentBytes?: Buffer }} p
 * @returns {{ ok: boolean, reason?: string }}
 */
export function checkAttestation({ attestation, keysDoc, contentBytes }) {
  const payload = attestation?.payload;
  if (!payload?.innsigle || !attestation?.signatures?.length) {
    return { ok: false, reason: "schema" };
  }
  const sigBlock = attestation.signatures[0];
  const key = keysDoc?.keys?.find((k) => k.key_id === sigBlock.key_id);
  if (!key) return { ok: false, reason: "unknown_key" };
  if (key.revoked_at) return { ok: false, reason: "revoked_key" };
  if (contentBytes !== undefined) {
    const digest = sha256Hex(contentBytes);
    const subject = payload.subjects?.[0];
    if (!subject?.digest?.value || subject.digest.value !== digest) {
      return { ok: false, reason: "content_mismatch" };
    }
  }
  let ok = false;
  try {
    ok = verifyPayload(payload, b64urlDecode(sigBlock.sig), b64urlDecode(key.public_key));
  } catch {
    ok = false;
  }
  return ok ? { ok: true } : { ok: false, reason: "bad_signature" };
}

/**
 * All regular files under repoRoot as posix-relative paths, skipping
 * .git/node_modules/.innsigle.
 * @param {string} repoRoot
 * @returns {string[]}
 */
export function listRepoFiles(repoRoot) {
  const out = [];
  const walk = (dir, relDir) => {
    let names;
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (SKIP_DIRS.has(name)) continue;
      const p = join(dir, name);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      const rel = relDir ? `${relDir}/${name}` : name;
      if (st.isDirectory()) walk(p, rel);
      else if (st.isFile()) out.push(rel);
    }
  };
  walk(repoRoot, "");
  return out.sort();
}

/**
 * Minimal glob → RegExp for content_globs (supports **, *, ?).
 * Matches posix-relative paths.
 * @param {string} glob
 */
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") {
          i++;
          re += "(?:[^/]+/)*";
        } else {
          re += ".*";
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${re}$`);
}

function legacyBase(relPath) {
  return basename(relPath).replace(/\.[^.]+$/, "") || "content";
}

/** Try to invert the slug via the subject uri path (A1). */
function sourceFromUri(repoRoot, uri, claimName, slugOf) {
  if (!uri) return null;
  let path;
  try {
    path = decodeURIComponent(new URL(uri).pathname);
  } catch {
    return null;
  }
  if (path.endsWith("/")) path += "index.html";
  path = path.replace(/^\/+/, "");
  if (!path) return null;
  const candidates = [path, `public/${path}`, `_site/${path}`, `dist/${path}`, `site/${path}`];
  for (const rel of candidates) {
    if (!existsSync(join(repoRoot, rel))) continue;
    if (slugOf(rel) === claimName || legacyBase(rel) === claimName) return rel;
  }
  return null;
}

/**
 * Scan .innsigle/public/claims/*.attestation.json and map each subject back
 * to a source file. States: VALID | STALE | ORPHAN | AMBIGUOUS (plus INVALID
 * for unparsable claim files). AMBIGUOUS means several files share the claim's
 * slug/legacy key and none matches the claim digest — never resolved by guess.
 * Also lists UNSEALED files for config.content_globs.
 *
 * @param {ReturnType<typeof loadProject>} project
 * @returns {{ entries: Array<{ name: string, fname: string, claimPath: string,
 *   attestation: object | null, state: string, source: string | null }>,
 *   unsealed: string[] }}
 */
export function collectStatus(project) {
  const { repoRoot, claimsDir } = project;
  const files = listRepoFiles(repoRoot);
  const slugOf = (rel) => attestationSlug(repoRoot, join(repoRoot, rel));
  // Multi-candidate maps: slugs and legacy basenames can collide across
  // distinct files, so keep every candidate and disambiguate per claim.
  const slugCandidates = new Map();
  const legacyCandidates = new Map();
  for (const rel of files) {
    const slug = slugOf(rel);
    if (!slugCandidates.has(slug)) slugCandidates.set(slug, []);
    slugCandidates.get(slug).push(rel);
    const base = legacyBase(rel);
    if (!legacyCandidates.has(base)) legacyCandidates.set(base, []);
    legacyCandidates.get(base).push(rel);
  }

  const entries = [];
  const fnames = existsSync(claimsDir)
    ? readdirSync(claimsDir)
        .filter((n) => n.endsWith(".attestation.json"))
        .sort()
    : [];
  for (const fname of fnames) {
    const name = fname.slice(0, -".attestation.json".length);
    const claimPath = join(claimsDir, fname);
    let attestation = null;
    try {
      attestation = JSON.parse(readFileSync(claimPath, "utf8"));
    } catch {
      attestation = null;
    }
    if (!attestation?.payload?.subjects?.[0]?.digest?.value) {
      entries.push({ name, fname, claimPath, attestation, state: "INVALID", source: null });
      continue;
    }
    const uri = attestation.payload.subjects[0].uri;
    const claimDigest = attestation.payload.subjects[0].digest.value;
    // Candidate sources, in preference order: explicit uri mapping, then the
    // canonical slug key, then the legacy basename key.
    const uriSource = sourceFromUri(repoRoot, uri, name, slugOf);
    let keyKind = null;
    let candidates = [];
    if (uriSource) {
      keyKind = "uri";
      candidates = [uriSource];
    } else if (slugCandidates.has(name)) {
      keyKind = "slug";
      candidates = slugCandidates.get(name);
    } else if (legacyCandidates.has(name)) {
      keyKind = "legacy";
      candidates = legacyCandidates.get(name);
    }
    if (!candidates.length) {
      entries.push({ name, fname, claimPath, attestation, state: "ORPHAN", source: null });
      continue;
    }
    const digestOf = (rel) => {
      try {
        return sha256Hex(readFileSync(join(repoRoot, rel)));
      } catch {
        return null;
      }
    };
    // A claim resolves to a file only when the digest confirms it, or when
    // the mapping is unambiguous. Never guess among colliding candidates.
    const digestMatches = candidates.filter((rel) => digestOf(rel) === claimDigest);
    if (digestMatches.length) {
      entries.push({
        name, fname, claimPath, attestation, state: "VALID", source: digestMatches[0],
      });
      continue;
    }
    const single = candidates.length === 1 ? candidates[0] : null;
    const staleSource =
      keyKind === "uri"
        ? candidates[0]
        : keyKind === "slug"
          ? single
          : single && slugOf(single) === name // legacy key: require slug confirmation
            ? single
            : null;
    if (staleSource) {
      entries.push({
        name, fname, claimPath, attestation, state: "STALE", source: staleSource,
      });
      continue;
    }
    entries.push({
      name, fname, claimPath, attestation, state: "AMBIGUOUS", source: null,
      candidates: [...candidates],
    });
  }

  const globs = project.config?.content_globs;
  const unsealed = [];
  if (Array.isArray(globs) && globs.length) {
    const sealed = new Set(entries.map((e) => e.source).filter(Boolean));
    const regexes = globs.map((g) => globToRegExp(g));
    for (const rel of files) {
      if (sealed.has(rel)) continue;
      if (regexes.some((re) => re.test(rel))) unsealed.push(rel);
    }
  }
  return { entries, unsealed };
}

function formatLine(e) {
  if (e.source) return `${e.state} ${e.source} (${e.fname})`;
  return `${e.state} - (${e.fname})`;
}

/**
 * innsigle status — report VALID / STALE / ORPHAN / AMBIGUOUS per claim, plus UNSEALED
 * content_globs matches. Reporting only; always exit 0 once the project loads.
 * @returns {number} exit code
 */
export function runStatus(args, deps = {}) {
  const out = deps.out || ((s) => console.log(s));
  const err = deps.err || ((s) => console.error(s));
  const project = loadProject();
  if (!project?.config) {
    err("INVALID: no .innsigle/config.json — run: innsigle init --onepassword");
    return 1;
  }
  const { entries, unsealed } = collectStatus(project);
  for (const e of entries) out(formatLine(e));
  for (const rel of unsealed) out(`UNSEALED ${rel}`);
  const count = (s) => entries.filter((e) => e.state === s).length;
  out(
    `total=${entries.length} valid=${count("VALID")} stale=${count("STALE")} ` +
      `orphan=${count("ORPHAN")} unsealed=${unsealed.length} ` +
      `ambiguous=${count("AMBIGUOUS")}`,
  );
  return 0;
}

/**
 * innsigle verify --all — CI gate. Signature-verifies every VALID claim
 * against .innsigle/public/keys.json; exits nonzero if anything is not VALID
 * (STALE, ORPHAN, INVALID, bad signature, or UNSEALED content).
 * @returns {number} exit code
 */
export function runVerifyAll(args, deps = {}) {
  const out = deps.out || ((s) => console.log(s));
  const err = deps.err || ((s) => console.error(s));
  const project = loadProject();
  if (!project?.config) {
    err("INVALID: no .innsigle/config.json — run: innsigle init --onepassword");
    return 1;
  }
  let keysDoc = null;
  try {
    keysDoc = JSON.parse(readFileSync(project.keysPath, "utf8"));
  } catch {
    err(`INVALID: cannot read issuer keys: ${project.keysPath}`);
    return 4;
  }
  const { entries, unsealed } = collectStatus(project);
  let failures = 0;
  for (const e of entries) {
    let state = e.state;
    if (state === "VALID") {
      const contentBytes = readFileSync(join(project.repoRoot, e.source));
      const check = checkAttestation({ attestation: e.attestation, keysDoc, contentBytes });
      if (!check.ok) state = `INVALID(${check.reason})`;
    }
    if (state !== "VALID") failures++;
    out(e.source ? `${state} ${e.source} (${e.fname})` : `${state} - (${e.fname})`);
  }
  for (const rel of unsealed) {
    failures++;
    out(`UNSEALED ${rel}`);
  }
  if (failures) {
    err(`INVALID: ${failures} claim(s)/file(s) not VALID`);
    return 1;
  }
  out(`VALID all (${entries.length} claim(s))`);
  return 0;
}
