/**
 * Canonical Innsigle brand lines (A1/B4 locks).
 * VOICE.md documents usage; this module is the byte-exact SSoT for code/tests.
 */

export const BRAND = {
  A1: "Content provenance for the AI era",
  B4: "The maker's seal for published work",
  SAMPLE_CUE: "The maker's seal · model-primary · signed",
  WALKTHROUGH_CUE: "The maker's seal · model-primary · Claude + Codex",
};

/** Collapse all whitespace (incl. newlines) to single spaces. */
export function normalizeWs(s) {
  return String(s).replace(/\s+/g, " ").trim();
}

/** A1 phrase match: case-insensitive + whitespace-normalized whole string. */
export function includesA1Phrase(text) {
  const hay = normalizeWs(text).toLowerCase();
  const needle = normalizeWs(BRAND.A1).toLowerCase();
  return hay.includes(needle);
}

export function isExactB4(s) {
  return String(s).trim() === BRAND.B4;
}

/** Escape a string for use as a RegExp source. */
export function brandRe(s, flags = "") {
  const escaped = String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, flags);
}
