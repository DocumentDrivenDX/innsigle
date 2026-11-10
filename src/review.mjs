/**
 * Review claim (ADR-005, CONTRACT-001 v1.2): "a human read this exact content".
 *
 * A review is its own signed attestation, stored in the `reviews[]` array of
 * the document's attestation file next to the authorship claim. It binds to the
 * same SHA-256 content digest as the seal, so any edit makes it STALE; it is
 * valid only when signed by a human-role key; and it carries no colophon, so
 * it can never change a declared composition (FR-4a).
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { jcs } from "./canonical.mjs";
import { b64url, b64urlDecode, sha256Hex, signPayload, verifyPayload } from "./crypto.mjs";
import {
  PATHS,
  defaultAttestationPath,
  loadProject,
  slugOpts,
  validateConfig,
} from "./config.mjs";
import { loadPrivateKeyForRole } from "./keys.mjs";
import { filesMatchingGlobs, globToRegExp } from "./status.mjs";

export const REVIEW_TYPE = "https://innsigle.dev/claim/review/v1";
export const ENDORSEMENT_TYPE = "https://innsigle.dev/claim/key-endorsement/v1";
const RFC3339_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const KEY_ID = /^ed25519:[0-9a-f]{32}$/;
const HEX64 = /^[0-9a-f]{64}$/;

function nowIsoDefault() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function arg(args, name) {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

function isoMs(s) {
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

// ─── schema ────────────────────────────────────────────────────────────────

/** @returns {string | null} problem, or null when the payload is well formed */
export function validateReviewPayload(p) {
  if (!p || typeof p !== "object") return "payload not an object";
  if (p.innsigle !== "1") return "innsigle must be \"1\"";
  if (p.type !== REVIEW_TYPE) return "type must be the review claim type";
  if (typeof p.issued_at !== "string" || !RFC3339_UTC.test(p.issued_at)) return "issued_at must be RFC 3339 UTC";
  const i = p.issuer;
  if (!i || !i.id || !i.name || !KEY_ID.test(i.key_id || "") || !i.key_url) return "issuer incomplete";
  try {
    new URL(i.key_url);
  } catch {
    return "issuer.key_url must be absolute";
  }
  if (!Array.isArray(p.subjects) || p.subjects.length !== 1) return "exactly one subject required";
  const d = p.subjects[0]?.digest;
  if (d?.alg !== "sha256" || !HEX64.test(d?.value || "")) return "subject digest must be sha256 hex";
  // FR-4a: a review is not a composition statement.
  if ("colophon" in p) return "review claims must not carry a colophon (FR-4a)";
  const r = p.review;
  if (!r || typeof r !== "object") return "review object missing";
  if (r.schema_version !== "1") return "review.schema_version must be \"1\"";
  if ("composition" in r || "human_input" in r) return "review must not carry composition or human_input (FR-4a)";
  if (!r.reviewer || r.reviewer.key_id !== i.key_id) return "review.reviewer.key_id must equal issuer.key_id";
  if (r.reviewer.name !== undefined && (typeof r.reviewer.name !== "string" || !r.reviewer.name.trim())) {
    return "review.reviewer.name must be a non-empty string when present";
  }
  if (r.scope !== undefined && r.scope !== "full") {
    if (
      !Array.isArray(r.scope) ||
      !r.scope.length ||
      r.scope.some((c) => typeof c !== "string" || !c.trim()) ||
      new Set(r.scope).size !== r.scope.length
    ) {
      return "review.scope must be \"full\" or a non-empty list of unique claim ids";
    }
  }
  if (r.expires_at !== undefined) {
    if (typeof r.expires_at !== "string" || !RFC3339_UTC.test(r.expires_at)) return "expires_at must be RFC 3339 UTC";
    if (isoMs(r.expires_at) <= isoMs(p.issued_at)) return "expires_at must be after issued_at";
  }
  return null;
}

// ─── roles ─────────────────────────────────────────────────────────────────

/**
 * Who counts as human / build. Pure data in, predicates out.
 *
 * Human: the pinned `config.keys.human` (plus `review.reviewer_key_ids`) when
 * the verifier has a config; otherwise keys.json `role: "human"`, the signer of
 * a valid build-signing endorsement, or — for single-key houses with no build
 * key at all — the only active key. Build: config pin, keys.json `role:
 * "build"`, or the subject of a valid human-signed build-signing endorsement.
 * A key that is build by any route is never human.
 *
 * @param {{ config?: object, keysDoc: object, endorsements?: object[] }} p
 */
export function makeRoles({ config, keysDoc, endorsements = [], pin }) {
  const keys = keysDoc?.keys || [];
  const active = keys.filter((k) => !k.revoked_at);
  // An external pin (flag/env, see resolveHumanPin) replaces the config pin
  // entirely: a same-PR edit of config.json must not be able to move it.
  const pinnedHuman = new Set();
  if (pin && pin.length) {
    for (const id of pin) pinnedHuman.add(id);
  } else {
    if (config?.keys?.human?.key_id) pinnedHuman.add(config.keys.human.key_id);
    for (const id of config?.review?.reviewer_key_ids || []) pinnedHuman.add(id);
  }
  const hasPin = pinnedHuman.size > 0;

  const build = new Set();
  if (config?.keys?.build?.key_id) build.add(config.keys.build.key_id);
  for (const k of keys) if (k.role === "build") build.add(k.key_id);

  // Endorsements: valid only when they verify under keysDoc (signature, not
  // role — role of the endorser is settled below without circularity because
  // endorser ids only ever *add* to `endorsers`, which is gated by pins).
  const endorsers = new Set();
  const endorsed = new Map(); // subject_key_id -> endorser key_id
  for (const att of endorsements) {
    const pl = att?.payload;
    if (pl?.type !== ENDORSEMENT_TYPE) continue;
    const sb = att.signatures?.[0];
    const key = keys.find((k) => k.key_id === sb?.key_id);
    if (!key || key.revoked_at || pl.issuer?.key_id !== sb.key_id) continue;
    let ok = false;
    try {
      ok = verifyPayload(pl, b64urlDecode(sb.sig), b64urlDecode(key.public_key));
    } catch {
      ok = false;
    }
    if (!ok) continue;
    if (pl.endorsement?.purpose !== "build-signing" || pl.endorsement?.level === "unknown") continue;
    endorsers.add(sb.key_id);
    endorsed.set(pl.endorsement.subject_key_id, sb.key_id);
  }
  for (const id of endorsed.keys()) build.add(id);

  const human = new Set();
  if (hasPin) {
    for (const id of pinnedHuman) human.add(id);
  } else {
    for (const k of keys) if (k.role === "human") human.add(k.key_id);
    for (const id of endorsers) human.add(id);
    if (!human.size && !build.size && active.length === 1) human.add(active[0].key_id);
  }
  for (const id of build) human.delete(id);

  return {
    /** true only when human keys come from a pin, not from repo-declared roles */
    pinned: hasPin,
    isHuman: (id) => human.has(id),
    isBuild: (id) => build.has(id) && !human.has(id),
    /** the human key that endorsed this build key, or null */
    endorserOf: (id) => {
      const e = endorsed.get(id);
      return e && human.has(e) ? e : null;
    },
  };
}

/** Load endorsement attestations from directories (missing dirs ignored). */
export function loadEndorsements(dirs) {
  const out = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const n of readdirSync(dir)) {
      if (!n.endsWith(".attestation.json")) continue;
      try {
        out.push(JSON.parse(readFileSync(join(dir, n), "utf8")));
      } catch {
        /* skip */
      }
    }
  }
  return out;
}

/**
 * Human-key pin supplied from outside the repo: `--human-key-id <id[,id]>`, then
 * INNSIGLE_HUMAN_KEY_ID. Returns null when none is given (config pin applies).
 * @returns {string[] | null}
 */
export function resolveHumanPin(args = [], env = process.env) {
  const raw = arg(args, "--human-key-id") ?? env.INNSIGLE_HUMAN_KEY_ID;
  if (raw === undefined || raw === "") return null;
  const ids = String(raw).split(",").map((s) => s.trim()).filter(Boolean);
  if (!ids.length || ids.some((id) => !KEY_ID.test(id))) {
    throw new Error("--human-key-id / INNSIGLE_HUMAN_KEY_ID must be ed25519:<32 hex> id(s), comma separated");
  }
  return ids;
}

export const UNPINNED_MSG =
  "no human key is pinned: set keys.human in .innsigle/config.json, or pass --human-key-id / INNSIGLE_HUMAN_KEY_ID. " +
  "Without a pin a role declared in keys.json (repo-controlled) would decide who counts as a reviewer";

/** Roles for a project (repo form): pin (external, else config) + keys.json + local endorsements. */
export function rolesForProject(project, keysDoc, pin) {
  return makeRoles({
    config: project.config,
    keysDoc,
    endorsements: loadEndorsements([join(project.repoRoot, PATHS.public, "endorsements")]),
    pin,
  });
}

/** Full scope required unless the review is scope "full"/absent. */
export function scopeIsFull(reviewAtt) {
  const sc = reviewAtt?.payload?.review?.scope;
  return sc === undefined || sc === "full";
}

// ─── checking ──────────────────────────────────────────────────────────────

/**
 * Check one review attestation against content.
 * Order matters: authenticity (schema, key, signature, role) is settled before
 * freshness, so a forged review never reports as merely STALE.
 *
 * @returns {{ state: "REVIEWED"|"REVIEW-STALE"|"REVIEW-EXPIRED"|"REVIEW-INVALID",
 *   reason?: string, review?: object }}
 */
export function checkReview({ review, keysDoc, roles, contentDigest, now }) {
  const bad = (reason) => ({ state: "REVIEW-INVALID", reason });
  const pl = review?.payload;
  if (!review?.signatures?.length) return bad("schema");
  const problem = validateReviewPayload(pl);
  if (problem) return bad(`schema: ${problem}`);
  const sb = review.signatures[0];
  if (sb.key_id !== pl.issuer.key_id) return bad("key_mismatch");
  const key = keysDoc?.keys?.find((k) => k.key_id === sb.key_id);
  if (!key) return bad("unknown_key");
  if (key.revoked_at) return bad("revoked_key");
  let ok = false;
  try {
    ok = verifyPayload(pl, b64urlDecode(sb.sig), b64urlDecode(key.public_key));
  } catch {
    ok = false;
  }
  if (!ok) return bad("bad_signature");
  if (!roles.isHuman(sb.key_id)) return bad("wrong_role");
  const info = { review: pl.review, issued_at: pl.issued_at, key_id: sb.key_id };
  if (pl.subjects[0].digest.value !== contentDigest) return { state: "REVIEW-STALE", ...info };
  const exp = pl.review.expires_at;
  if (exp && isoMs(exp) <= now) return { state: "REVIEW-EXPIRED", ...info };
  return { state: "REVIEWED", ...info };
}

const RANK = ["REVIEWED", "REVIEW-EXPIRED", "REVIEW-STALE", "REVIEW-INVALID"];

/**
 * Overall review state of a document's attestation file at its current digest.
 * REVIEWED if any review is good; else the "closest" failure (expired, then
 * stale, then invalid); UNREVIEWED when there are no reviews at all.
 */
export function reviewStateOf(att, { contentDigest, keysDoc, roles, now, fullScope = false }) {
  const list = Array.isArray(att?.reviews) ? att.reviews : [];
  const results = list.map((review) => checkReview({ review, keysDoc, roles, contentDigest, now }));
  if (fullScope) {
    for (const r of results) {
      if (r.state === "REVIEWED" && r.review.scope !== undefined && r.review.scope !== "full") {
        r.state = "REVIEW-INVALID";
        r.reason = "scope_not_full";
      }
    }
  }
  if (!results.length) return { state: "UNREVIEWED", results };
  for (const s of RANK) {
    const hit = results.find((r) => r.state === s);
    if (hit) return { state: s, reason: hit.reason, results, best: hit };
  }
  return { state: "UNREVIEWED", results };
}

// ─── file helpers ──────────────────────────────────────────────────────────

/** Atomic JSON write (tmp + rename). */
export function writeJsonAtomic(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = join(dirname(path), `.${basename(path)}.tmp-${process.pid}-${Date.now()}`);
  try {
    writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n");
    renameSync(tmp, path);
  } catch (e) {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw e;
  }
}

/**
 * Carry-over merge used by every seal path: the new authorship attestation
 * inherits `reviews[]` (and any other non-authorship envelope fields) from the
 * file it replaces. Reviews are never dropped by sealing; an edit makes them
 * REVIEW-STALE by digest, which is the correct way for them to stop counting.
 */
export function carryOver(prev, next) {
  if (!prev || typeof prev !== "object") return next;
  const out = { ...next };
  if (Array.isArray(prev.reviews) && prev.reviews.length) {
    out.reviews = prev.reviews;
  }
  return out;
}

/** Merge a new review into an existing list: supersede same-reviewer entries. */
export function mergeReview(list, review) {
  const kid = review.signatures[0].key_id;
  const scope = jcs(review.payload.review.scope ?? "full");
  const digest = review.payload.subjects[0].digest.value;
  const keep = (list || []).filter((r) => {
    const rk = r?.signatures?.[0]?.key_id;
    if (rk !== kid) return true; // other reviewers' entries are never touched
    const rd = r?.payload?.subjects?.[0]?.digest?.value;
    if (rd !== digest) return false; // superseded by a fresh review of new bytes
    return jcs(r.payload.review?.scope ?? "full") !== scope; // same digest: replace identical scope only
  });
  keep.push(review);
  return keep;
}

// ─── time ──────────────────────────────────────────────────────────────────

/** "90d" | "YYYY-MM-DD" | RFC 3339 UTC → RFC 3339 UTC, or null if unparsable. */
export function parseExpiry(value, nowIso) {
  const days = String(value).match(/^(\d{1,5})d$/);
  if (days) {
    const t = isoMs(nowIso) + Number(days[1]) * 86400000;
    return new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return isoMs(`${value}T23:59:59Z`) === null ? null : `${value}T23:59:59Z`;
  }
  return RFC3339_UTC.test(value) && isoMs(value) !== null ? value : null;
}

// ─── status / gate column ──────────────────────────────────────────────────

export function reviewColumnWanted(args, project, entries) {
  return (
    args.includes("--reviews") ||
    args.includes("--require-review") ||
    !!project.config?.review ||
    entries.some((e) => Array.isArray(e.attestation?.reviews) && e.attestation.reviews.length)
  );
}

export function inReviewScope(project, source) {
  const paths = project.config?.review?.paths;
  if (!Array.isArray(paths) || !paths.length) return true;
  return paths.some((g) => globToRegExp(g).test(source));
}

/** Annotate entries (mutates) with `.review` = result of reviewStateOf. */
export function annotateReviews(project, entries, { keysDoc, now, fullScope, pin }) {
  const roles = rolesForProject(project, keysDoc, pin);
  for (const e of entries) {
    if (!e.source || !e.attestation) continue;
    let bytes;
    try {
      bytes = readFileSync(join(project.repoRoot, e.source));
    } catch {
      continue;
    }
    e.review = reviewStateOf(e.attestation, {
      contentDigest: sha256Hex(bytes),
      keysDoc,
      roles,
      now,
      fullScope,
    });
    e.reviewInScope = inReviewScope(project, e.source);
    e.unpinned = !roles.pinned;
  }
  return roles;
}

export function reviewLabel(e) {
  if (!e.review) return "";
  const r = e.review;
  if (r.state === "REVIEWED" && e.unpinned) return "REVIEWED(unpinned)";
  return r.reason && r.state === "REVIEW-INVALID" ? `REVIEW-INVALID(${r.reason})` : r.state;
}

/** Blocking y/N prompt on a TTY (line-buffered read of fd 0). */
export function confirmTTY(question) {
  process.stderr.write(question);
  try {
    const buf = Buffer.alloc(256);
    const n = readSync(0, buf, 0, 256, null);
    const ans = buf.toString("utf8", 0, n).trim().toLowerCase();
    return ans === "y" || ans === "yes";
  } catch {
    return false;
  }
}

// ─── CLI: innsigle review ──────────────────────────────────────────────────

const VALUE_FLAGS = new Set([
  "--scope", "--expires", "--reviewer-name", "--key", "--op-ref", "--op-account", "--role", "--human-key-id",
]);

function positional(args) {
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("-")) {
      if (VALUE_FLAGS.has(args[i])) i++;
      continue;
    }
    return args[i];
  }
  return undefined;
}

/**
 * innsigle review <file> | --all | --stale
 *   [--scope full|id1,id2] [--expires 90d|YYYY-MM-DD|RFC3339] [--reviewer-name N | --anonymous]
 *   [--yes] [--force] [--key pem] [--op-account a]
 *
 * Human role only. PROV-05: signing is behind an explicit confirmation —
 * a TTY prompt, or --yes when run non-interactively.
 *
 * @returns {number} exit code
 */
export function runReview(args, deps = {}) {
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
  const role = arg(args, "--role");
  if (role && role !== "human") {
    err("INVALID: a review is signed by a human-role key only; --role build is refused (ADR-005 D2)");
    return 1;
  }
  const all = args.includes("--all");
  const stale = args.includes("--stale");
  const file = positional(args);
  if (!all && !stale && !file) {
    err("Usage: innsigle review <file> [--scope full|<id,id,…>] [--expires 90d|YYYY-MM-DD]");
    err("                             [--reviewer-name <name> | --anonymous] [--yes] [--force]");
    err("       innsigle review --all     # every in-scope doc not currently REVIEWED");
    err("       innsigle review --stale   # docs whose review went stale or expired");
    return 1;
  }

  // Parse options up front so bad input fails before any key is touched.
  const scopeArg = arg(args, "--scope");
  let scope = "full";
  if (scopeArg && scopeArg !== "full") {
    scope = scopeArg.split(",").map((s) => s.trim()).filter(Boolean);
    if (!scope.length || new Set(scope).size !== scope.length) {
      err("INVALID: --scope must be \"full\" or a comma-separated list of unique claim ids");
      return 5;
    }
  }
  const issuedAt = nowIso();
  let expiresAt;
  const expArg = arg(args, "--expires");
  if (expArg) {
    expiresAt = parseExpiry(expArg, issuedAt);
  } else if (project.config.review?.expiry_days) {
    expiresAt = parseExpiry(`${project.config.review.expiry_days}d`, issuedAt);
  }
  if (expArg && !expiresAt) {
    err("INVALID: --expires must be Nd, YYYY-MM-DD, or RFC 3339 UTC");
    return 5;
  }
  if (expiresAt && isoMs(expiresAt) <= isoMs(issuedAt)) {
    err("INVALID: --expires is in the past");
    return 5;
  }
  const reviewerName = args.includes("--anonymous")
    ? undefined
    : arg(args, "--reviewer-name") || project.config.review?.reviewer_name;

  let keysDoc;
  try {
    keysDoc = JSON.parse(readFileSync(project.keysPath, "utf8"));
  } catch {
    err(`INVALID: cannot read ${PATHS.keys}`);
    return 4;
  }
  let material;
  try {
    material = loadPrivateKeyForRole(args, project, "human");
  } catch (e) {
    err(`INVALID: ${e.message}`);
    return 1;
  }
  let pin;
  try {
    pin = resolveHumanPin(args);
  } catch (e) {
    err(`INVALID: ${e.message}`);
    return 5;
  }
  const roles = rolesForProject(project, keysDoc, pin);
  if (!roles.pinned) log(`warn: ${UNPINNED_MSG}; this review will not satisfy a gate until one is`);
  if (!roles.isHuman(material.keyId)) {
    err(`INVALID: key ${material.keyId} is not a human-role key; a review cannot be signed with it`);
    return 1;
  }

  // Targets.
  let rels;
  if (file) {
    if (!existsSync(file)) {
      err(`INVALID: content missing: ${file}`);
      return 1;
    }
    const abs = resolve(file);
    rels = [relative(project.repoRoot, abs).split(sep).join("/")];
  } else {
    const globs = project.config.content_globs;
    if (!Array.isArray(globs) || !globs.length) {
      err("INVALID: review --all/--stale needs content_globs in .innsigle/config.json");
      return 5;
    }
    rels = filesMatchingGlobs(project.repoRoot, globs).filter((r) => inReviewScope(project, r));
  }

  const now = isoMs(issuedAt);
  const force = args.includes("--force");
  const plan = [];
  let failed = 0;
  for (const rel of rels) {
    const abs = file ? resolve(file) : join(project.repoRoot, rel);
    const bytes = readFileSync(abs);
    const digest = sha256Hex(bytes);
    const attPath = defaultAttestationPath(project.repoRoot, abs, slugOpts(project));
    let att;
    try {
      att = JSON.parse(readFileSync(attPath, "utf8"));
    } catch {
      err(`not reviewed: ${rel}: no authorship seal — run innsigle seal first`);
      failed++;
      continue;
    }
    if (att?.payload?.subjects?.[0]?.digest?.value !== digest) {
      err(`not reviewed: ${rel}: authorship seal is STALE — reseal, then review`);
      failed++;
      continue;
    }
    const st = reviewStateOf(att, { contentDigest: digest, keysDoc, roles, now });
    const mine = st.results.some(
      (r) => r.state === "REVIEWED" && r.key_id === material.keyId &&
        jcs(r.review.scope ?? "full") === jcs(scope),
    );
    if (!force && mine) {
      log(`up to date: ${rel}`);
      continue;
    }
    if (!file && !force && st.state === "REVIEWED") continue;
    if (stale && !file && st.state !== "REVIEW-STALE" && st.state !== "REVIEW-EXPIRED") continue;
    plan.push({ rel, attPath, att, digest, bytes, composition: att.payload.colophon?.composition });
  }
  if (!plan.length) {
    log(failed ? "nothing reviewed" : "up to date: nothing to review");
    return failed ? 1 : 0;
  }

  // PROV-05: review precedes sign.
  if (!args.includes("--yes")) {
    if (!process.stdin.isTTY && !deps.confirm) {
      err("not reviewed: signing a review needs confirmation (PROV-05).");
      err("re-run with --yes once you have read the document(s)");
      return 1;
    }
    log(`about to sign a review (${scope === "full" ? "full" : `scope ${scope.join(",")}`}) as ${material.keyId} for:`);
    for (const p of plan) log(`  ${p.rel}  [${p.composition ?? "?"}]  sha256:${p.digest.slice(0, 12)}…`);
    const confirm = deps.confirm || confirmTTY;
    if (!confirm(`I have read ${plan.length === 1 ? "this document" : `these ${plan.length} documents`}. sign? [y/N] `)) {
      err("not reviewed: declined");
      return 1;
    }
  }

  let done = 0;
  for (const p of plan) {
    const payload = {
      innsigle: "1",
      type: REVIEW_TYPE,
      issued_at: issuedAt,
      issuer: {
        id: project.config.issuer.id,
        name: project.config.issuer.name,
        key_id: material.keyId,
        key_url: project.config.issuer.key_url,
      },
      subjects: [{ digest: { alg: "sha256", value: p.digest } }],
      review: {
        schema_version: "1",
        reviewer: { ...(reviewerName ? { name: reviewerName } : {}), key_id: material.keyId },
        scope,
        ...(expiresAt ? { expires_at: expiresAt } : {}),
      },
    };
    const uri = p.att.payload.subjects[0].uri;
    if (uri) payload.subjects[0].uri = uri;
    const review = {
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
    // Self-verify before anything touches disk: catches a pem that does not
    // match the configured key id (e.g. a build pem smuggled in as "human").
    const chk = checkReview({ review, keysDoc, roles, contentDigest: p.digest, now });
    if (chk.state !== "REVIEWED") {
      err(`INVALID: review self-verify failed for ${p.rel} (${chk.reason || chk.state})`);
      failed++;
      continue;
    }
    // Re-read: another process may have resealed since planning.
    let fresh = p.att;
    try {
      fresh = JSON.parse(readFileSync(p.attPath, "utf8"));
    } catch {
      /* keep planned copy */
    }
    const next = { ...fresh, reviews: mergeReview(fresh.reviews, review) };
    writeJsonAtomic(p.attPath, next);
    log(`reviewed: ${p.rel}`);
    done++;
  }
  log(`innsigle-review: ${done} reviewed, ${failed} failed`);
  return failed ? 2 : 0;
}
