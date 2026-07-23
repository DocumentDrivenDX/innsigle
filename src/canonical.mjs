/** RFC 8785 JSON Canonicalization Scheme (JCS) subset. */

function escapeString(s) {
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x22 || c === 0x5c) out += "\\" + s[i];
    else if (c === 0x08) out += "\\b";
    else if (c === 0x0c) out += "\\f";
    else if (c === 0x0a) out += "\\n";
    else if (c === 0x0d) out += "\\r";
    else if (c === 0x09) out += "\\t";
    else if (c < 0x20) out += "\\u" + c.toString(16).padStart(4, "0");
    else out += s[i];
  }
  return out + '"';
}

export function jcs(value) {
  if (value === null) return "null";
  if (value === true) return "true";
  if (value === false) return "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("JCS: non-finite numbers");
    return String(value);
  }
  if (typeof value === "string") return escapeString(value);
  if (Array.isArray(value)) {
    return "[" + value.map((v) => jcs(v)).join(",") + "]";
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    const parts = [];
    for (const k of keys) {
      if (value[k] === undefined) continue;
      parts.push(escapeString(k) + ":" + jcs(value[k]));
    }
    return "{" + parts.join(",") + "}";
  }
  throw new Error(`JCS: unsupported type ${typeof value}`);
}
