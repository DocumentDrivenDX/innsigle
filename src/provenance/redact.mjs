/**
 * Deterministic redaction for journal summaries before L2 publish.
 */
const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9]{10,}\b/g,
  /\bghp_[A-Za-z0-9]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
];

const PATH_HOME = /^\/home\/[^/\s]+/g;
const PATH_USERS = /^\/Users\/[^/\s]+/g;

export function redactText(s) {
  if (s == null) return s;
  let out = String(s);
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, "[REDACTED]");
  }
  out = out.replace(PATH_HOME, "/home/[REDACTED]");
  out = out.replace(PATH_USERS, "/Users/[REDACTED]");
  return out;
}

export function redactEvent(ev) {
  const copy = { ...ev };
  if (copy.summary) copy.summary = redactText(copy.summary);
  if (copy.path) copy.path = redactText(copy.path);
  return copy;
}

export function redactEvents(events) {
  return events.map(redactEvent);
}
