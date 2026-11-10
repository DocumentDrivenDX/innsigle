/**
 * Minimal front-matter reader for stable document ids (ADR-005 D5).
 *
 * Only what keying needs: pull one scalar out of the leading `---` block by
 * dotted path (`ddx.id` matches nested `ddx:\n  id: x` and flat `ddx.id: x`).
 * It is not a YAML parser — lists, anchors and multi-line scalars are ignored,
 * which is fine for an id and keeps the dependency count at zero.
 *
 * Reading the id never changes the content digest: the digest stays SHA-256
 * of the exact file bytes (CONTRACT-001 "Content hashing"), front matter
 * included.
 */
import { closeSync, openSync, readSync } from "node:fs";

const BLOCK = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/** Ids become filenames: lowercase, dotted, injective (no slug collisions). */
export const DOC_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/;

function unquote(v) {
  const t = v.trim();
  const m = t.match(/^(["'])(.*)\1\s*(?:#.*)?$/);
  if (m) return m[2];
  return t.replace(/\s+#.*$/, "").trim();
}

/**
 * @param {string} text file text
 * @param {string} dottedPath e.g. "ddx.id"
 * @returns {string | undefined}
 */
export function frontmatterValue(text, dottedPath) {
  const m = String(text || "").match(BLOCK);
  if (!m) return undefined;
  const want = dottedPath.split(".");
  const stack = []; // [{indent, key}]
  for (const raw of m[1].split(/\r?\n/)) {
    if (!raw.trim() || /^\s*#/.test(raw)) continue;
    const km = raw.match(/^(\s*)([A-Za-z0-9_.-]+):(?:\s+(.*)|\s*)$/);
    if (!km) continue;
    const indent = km[1].length;
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const path = [...stack.map((s) => s.key), km[2]].join(".").split(".");
    const value = km[3];
    if (value === undefined || value === "") {
      stack.push({ indent, key: km[2] });
      continue;
    }
    if (path.length === want.length && path.every((p, i) => p === want[i])) {
      return unquote(value);
    }
  }
  return undefined;
}

/** Read at most the first 16 KiB — front matter is at the top. */
export function readHead(absPath, bytes = 16384) {
  let fd;
  try {
    fd = openSync(absPath, "r");
    const buf = Buffer.alloc(bytes);
    const n = readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, n).toString("utf8");
  } catch {
    return "";
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/**
 * Stable document id of a file, or undefined.
 * @param {string} absPath
 * @param {string} dottedPath
 */
export function docIdOf(absPath, dottedPath) {
  if (!/\.(md|markdown|mdx|qmd)$/i.test(absPath)) return undefined;
  return frontmatterValue(readHead(absPath), dottedPath);
}
