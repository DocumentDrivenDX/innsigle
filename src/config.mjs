import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

/** Directory under the repo that owns all Innsigle project state. */
export const DIR_NAME = ".innsigle";
/** Config filename inside DIR_NAME. */
export const CONFIG_BASENAME = "config.json";
export const CONFIG_SCHEMA = "1";

/** Relative paths written by init (posix-style in config). */
export const PATHS = {
  config: `${DIR_NAME}/${CONFIG_BASENAME}`,
  /** Staging tree: copy contents to site `/.well-known/innsigle/`. */
  public: `${DIR_NAME}/public`,
  keys: `${DIR_NAME}/public/keys.json`,
  claims_dir: `${DIR_NAME}/public/claims`,
  /** Optional default colophon for `innsigle seal`. */
  colo: `${DIR_NAME}/colo.json`,
  readme: `${DIR_NAME}/README.md`,
  agents: `${DIR_NAME}/AGENTS.md`,
};

/**
 * Walk up from startDir looking for .innsigle/config.json.
 * @param {string} startDir
 * @returns {string | null} absolute path to config.json
 */
export function findConfigPath(startDir = process.cwd()) {
  let dir = resolve(startDir);
  for (;;) {
    const candidate = join(dir, DIR_NAME, CONFIG_BASENAME);
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, "..");
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Repo root that contains `.innsigle/` (parent of config file's directory).
 * @param {string} [configPath]
 * @returns {string | null}
 */
export function findRepoRoot(configPath) {
  const p = configPath || findConfigPath();
  if (!p) return null;
  return resolve(p, "..", "..");
}

/**
 * @param {string} [path]
 * @returns {object | null}
 */
export function loadConfig(path) {
  const p = path || findConfigPath();
  if (!p || !existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

/**
 * @param {string} path
 * @param {object} config
 */
export function writeConfig(path, config) {
  const body = JSON.stringify(config, null, 2) + "\n";
  writeFileSync(path, body);
}

/**
 * Per-user config: ~/.config/innsigle/config.json
 * Optional fields: default_composition, onepassword.vault, site_url defaults for init.
 * @returns {{ path: string, config: object | null }}
 */
export function userConfigPath() {
  const base =
    process.env.INNSIGLE_CONFIG_HOME ||
    process.env.XDG_CONFIG_HOME ||
    join(homedir(), ".config");
  return join(base, "innsigle", "config.json");
}

/**
 * @returns {object}
 */
export function loadUserConfig() {
  const p = userConfigPath();
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

/**
 * Ensure user config directory exists; merge-write shallow keys.
 * @param {object} patch
 */
export function updateUserConfig(patch) {
  const p = userConfigPath();
  mkdirSync(dirname(p), { recursive: true });
  const cur = loadUserConfig();
  const next = { ...cur, ...patch };
  if (patch.onepassword || cur.onepassword) {
    next.onepassword = { ...(cur.onepassword || {}), ...(patch.onepassword || {}) };
  }
  writeFileSync(p, JSON.stringify(next, null, 2) + "\n");
  return next;
}

/**
 * Resolved project context for short commands.
 * @param {string} [startDir]
 */
export function loadProject(startDir = process.cwd()) {
  const configPath = findConfigPath(startDir);
  if (!configPath) return null;
  const repoRoot = findRepoRoot(configPath);
  const config = loadConfig(configPath);
  const user = loadUserConfig();
  return {
    configPath,
    repoRoot,
    config,
    user,
    keysPath: join(repoRoot, PATHS.keys),
    claimsDir: join(repoRoot, PATHS.claims_dir),
    coloPath: join(repoRoot, PATHS.colo),
    publicDir: join(repoRoot, PATHS.public),
  };
}

/**
 * Canonical attestation slug (PLAN-001 A1): project-relative content path,
 * every non-alphanumeric run collapsed to "-", trimmed.
 * e.g. posts/x/index.qmd → posts-x-index-qmd
 * @param {string} repoRoot
 * @param {string} contentPath
 */
export function attestationSlug(repoRoot, contentPath) {
  let rel = relative(repoRoot, resolve(contentPath));
  if (!rel || rel.startsWith("..")) rel = basename(contentPath);
  const slug = rel
    .split(sep)
    .join("/")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "content";
}

/**
 * Legacy (pre-A1) attestation filename: basename minus extension.
 * Kept for verify fallback so existing sites keep verifying.
 * @param {string} contentPath
 */
export function legacyAttestationName(contentPath) {
  const base = basename(contentPath).replace(/\.[^.]+$/, "") || "content";
  return `${base}.attestation.json`;
}

/**
 * Default attestation path for a content file under .innsigle/public/claims/.
 * Uses the canonical slug (project-relative path).
 * @param {string} repoRoot
 * @param {string} contentPath
 */
export function defaultAttestationPath(repoRoot, contentPath) {
  return join(
    repoRoot,
    PATHS.claims_dir,
    `${attestationSlug(repoRoot, contentPath)}.attestation.json`,
  );
}

/**
 * Guess content URI from issuer key_url origin + relative path from repo root.
 * @param {object} config repo config
 * @param {string} repoRoot
 * @param {string} contentPath
 * @returns {string | undefined}
 */
export function guessContentUri(config, repoRoot, contentPath) {
  const keyUrl = config?.issuer?.key_url;
  if (!keyUrl) return undefined;
  try {
    const origin = new URL(keyUrl).origin;
    let rel = relative(repoRoot, resolve(contentPath)).split(sep).join("/");
    // common publish trees: public/, _site/, dist/ strip for site URL
    rel = rel.replace(/^(public|_site|dist|site)\//, "");
    if (rel === "index.html") return `${origin}/`;
    if (rel.endsWith("/index.html")) {
      return `${origin}/${rel.slice(0, -"index.html".length)}`;
    }
    return `${origin}/${rel}`;
  } catch {
    return undefined;
  }
}

/**
 * @param {string} repoRoot
 * @returns {string}
 */
export function defaultIssuerId(repoRoot) {
  const base = repoRoot.replace(/[/\\]+$/, "").split(/[/\\]/).pop() || "issuer";
  return (
    base
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "issuer"
  );
}
