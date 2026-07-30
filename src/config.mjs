import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

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
