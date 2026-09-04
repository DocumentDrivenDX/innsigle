/**
 * Session discovery + accumulation (PLAN-001 B2).
 *
 * `innsigle provenance sync <content-file> [--transcript-dir <dir>] [--out <l2.json>]`
 *
 * Finds the Claude Code transcripts for this repo (default:
 * ~/.claude/projects/<cwd with every non-alphanumeric character replaced by
 * "-">/), imports every session (*.jsonl) whose file_write events touch the
 * content file (matched exactly: the repo-relative path, or the absolute path
 * under the repo root), merges them via mergeJournals, builds L2 via
 * buildProvenance, and writes .innsigle/provenance/<slug>.l2.json.
 *
 * Re-running after more conversation folds new sessions/turns into the same
 * L2 — the provenance accumulates. Auto-publish stays off (PROV-08): the
 * L2 lives under .innsigle/provenance/, never under public/.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { sha256Hex } from "../crypto.mjs";
import { attestationSlug, DIR_NAME, loadProject } from "../config.mjs";
import { transformTranscriptText } from "./import-claude-code.mjs";
import { redactText } from "./redact.mjs";
import { mergeJournals } from "./journal.mjs";
import { buildProvenance } from "./build.mjs";

/**
 * Default Claude Code transcript directory for a working directory:
 * ~/.claude/projects/<cwd with every non-alphanumeric character replaced by "-">/
 * (Claude Code's own escaping rule — dots, underscores, spaces, and slashes
 * all become "-"). e.g. /home/erik/Projects/aibadge →
 * -home-erik-Projects-aibadge, /home/erik/my.site → -home-erik-my-site
 * @param {string} [cwd]
 */
export function defaultTranscriptDir(cwd = process.cwd()) {
  return join(
    homedir(),
    ".claude",
    "projects",
    resolve(cwd).replace(/[^a-zA-Z0-9]/g, "-"),
  );
}

/**
 * Repo-relative content path, posix separators. Content outside the repo root
 * cannot be attributed (event paths are redacted and matching would be
 * meaningless) — refuse it with a clear error (F4).
 */
function contentRelPath(repoRoot, contentPath) {
  const rel = relative(repoRoot, resolve(contentPath));
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(
      `content must be inside the repository: ${resolve(contentPath)} ` +
        `(repo root: ${resolve(repoRoot)})`,
    );
  }
  return rel.split(sep).join("/");
}

/**
 * Does an event path match the repo-relative content path? Exact matches only
 * (F2): the event path must equal relPath, or be the absolute path of relPath
 * under the repo root (also in its home-redacted form, since imported events
 * pass through redactEvents). Suffix matching would attribute mirror-tree
 * writes (site/docs/index.md) to the source file (docs/index.md).
 */
function pathMatches(eventPath, relPath, repoRoot) {
  const p = String(eventPath).replace(/\\/g, "/");
  if (p === relPath) return true;
  const root = resolve(repoRoot).replace(/\\/g, "/").replace(/\/+$/, "");
  if (p === `${root}/${relPath}`) return true;
  const redactedRoot = redactText(root);
  if (redactedRoot !== root && p === `${redactedRoot}/${relPath}`) return true;
  return false;
}

/** Does this journal contain a file_write touching the content file? */
export function sessionTouchesFile(events, relPath, repoRoot) {
  return events.some(
    (e) => e.type === "file_write" && e.path && pathMatches(e.path, relPath, repoRoot),
  );
}

/**
 * Discover + import + merge + build + write the L2 for one content file.
 *
 * @param {object} opts
 * @param {string} opts.contentPath content file the L2 describes
 * @param {string} [opts.transcriptDir] override the default transcript dir
 * @param {string} [opts.outPath] override .innsigle/provenance/<slug>.l2.json
 * @param {string} [opts.repoRoot] project root (defaults to .innsigle lookup, then cwd)
 * @param {string} [opts.cwd]
 * @param {string} opts.generatedAt ISO timestamp for the L2
 * @returns {{ l2: object, outPath: string, body: string, digestHex: string,
 *             sessions: string[], rel: string }}
 */
export function syncProvenance(opts) {
  const cwd = opts.cwd || process.cwd();
  const repoRoot = opts.repoRoot || loadProject(cwd)?.repoRoot || resolve(cwd);
  const contentPath = opts.contentPath;
  if (!contentPath || !existsSync(contentPath)) {
    throw new Error(`content missing: ${contentPath}`);
  }
  const transcriptDir = opts.transcriptDir || defaultTranscriptDir(cwd);
  if (!existsSync(transcriptDir)) {
    throw new Error(
      `no Claude Code transcript dir: ${transcriptDir} (pass --transcript-dir)`,
    );
  }
  const rel = contentRelPath(repoRoot, contentPath);

  const files = readdirSync(transcriptDir)
    .filter((f) => f.endsWith(".jsonl"))
    .sort();
  const lists = [];
  const sessions = [];
  for (const f of files) {
    let events;
    try {
      events = transformTranscriptText(readFileSync(join(transcriptDir, f), "utf8"));
    } catch {
      continue; // unreadable/drifted transcript never blocks the sync
    }
    if (!sessionTouchesFile(events, rel, repoRoot)) continue;
    lists.push(events);
    sessions.push(f);
  }
  if (!lists.length) {
    throw new Error(
      `no Claude Code sessions touching ${rel} under ${transcriptDir}`,
    );
  }

  // Normalize matching file_write paths (absolute or relative) to the
  // repo-relative path so one content file is one artifact across sessions.
  const normalized = lists.map((events) =>
    events.map((e) =>
      e.type === "file_write" && e.path && pathMatches(e.path, rel, repoRoot)
        ? { ...e, path: rel }
        : e,
    ),
  );
  const merged = mergeJournals(normalized);
  const l2 = buildProvenance(merged, {
    generatedAt: opts.generatedAt,
    cwd: repoRoot,
    generator: { name: "innsigle-provenance", version: "0.1.0", uri: null },
    harness: { name: "claude-code", version: null },
  });
  const outPath =
    opts.outPath ||
    join(
      repoRoot,
      DIR_NAME,
      "provenance",
      `${attestationSlug(repoRoot, contentPath)}.l2.json`,
    );
  const body = JSON.stringify(l2, null, 2) + "\n";
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, body);
  return { l2, outPath, body, digestHex: sha256Hex(body), sessions, rel };
}

/**
 * `innsigle provenance sync <content-file> [--transcript-dir <dir>] [--out <l2.json>]`
 * @param {string[]} args argv slice after `sync`
 * @param {object} [deps]
 * @returns {number} exit code
 */
export function runProvenanceSync(args, deps = {}) {
  const log = deps.log || ((s) => console.error(s));
  const err = deps.err || ((s) => console.error(s));
  const nowIso =
    deps.nowIso || (() => new Date().toISOString().replace(/\.\d{3}Z$/, "Z"));

  let contentPath;
  let transcriptDir;
  let outPath;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--transcript-dir") transcriptDir = args[++i];
    else if (a === "--out") outPath = args[++i];
    else if (a.startsWith("-")) {
      err(`unknown flag: ${a}`);
      return 1;
    } else if (!contentPath) contentPath = a;
    else {
      err(`unexpected argument: ${a}`);
      return 1;
    }
  }
  if (!contentPath) {
    err(
      "Usage: innsigle provenance sync <content-file> [--transcript-dir <dir>] [--out <l2.json>]",
    );
    return 1;
  }

  let res;
  try {
    res = syncProvenance({ contentPath, transcriptDir, outPath, generatedAt: nowIso() });
  } catch (e) {
    err(`INVALID: ${e.message}`);
    return 1;
  }
  log(`ok: synced ${res.sessions.length} session(s) for ${res.rel}`);
  log(`provenance=${res.outPath}`);
  log(`models=${res.l2.models.map((m) => m.name).join(",")}`);
  log(`user_prompts=${res.l2.metrics.user_prompts}`);
  log(`sha256=${res.digestHex}`);
  return 0;
}
