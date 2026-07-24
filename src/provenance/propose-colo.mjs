/**
 * L2 session provenance → colophon draft (L1).
 */

/**
 * @param {object} l2 session provenance
 * @param {object} [opts]
 * @param {string} [opts.provenanceUri]
 * @param {string} [opts.provenanceDigestHex] SHA-256 of L2 file bytes
 * @param {boolean} [opts.forceComposition]
 * @param {string} [opts.composition] override
 * @param {string} [opts.notes]
 */
export function proposeColo(l2, opts = {}) {
  if (!l2 || l2.kind !== "session") {
    throw new Error("expected session provenance document");
  }

  const modelWrote = (l2.artifacts || []).some(
    (a) => a.by === "model" || a.by === "mixed",
  );

  let composition = opts.composition || l2.composition_suggestion || "model-primary";

  if (modelWrote && composition === "human-authored" && !opts.forceComposition) {
    throw new Error(
      "FR-4a: refuse human-authored when model wrote artifact bytes (use --force-composition)",
    );
  }

  if (modelWrote && composition === "human-authored" && opts.forceComposition) {
    // allowed only with force + notes
    if (!opts.notes) {
      throw new Error("force human-authored requires --notes");
    }
  }

  const ingredients = [];
  const seen = new Set();

  for (const m of l2.models || []) {
    const k = `model:${m.name}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const ing = {
      kind: "model",
      name: m.name,
      role: m.role || "primary",
    };
    if (m.version != null) ing.version = m.version;
    if (m.uri) ing.uri = m.uri;
    ingredients.push(ing);
  }

  for (const s of l2.skills || []) {
    const k = `tool:skill:${s.name}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const ing = {
      kind: "tool",
      name: s.name,
      role: s.role || "skill",
    };
    if (s.version != null) ing.version = s.version;
    if (s.uri) ing.uri = s.uri;
    ingredients.push(ing);
  }

  for (const t of l2.tools || []) {
    const k = `tool:${t.name}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const ing = {
      kind: "tool",
      name: t.name,
      role: t.role || "tool",
    };
    if (t.uri) ing.uri = t.uri;
    ingredients.push(ing);
  }

  for (const h of l2.humans || []) {
    const k = `human:${h.name}`;
    if (seen.has(k)) continue;
    seen.add(k);
    ingredients.push({
      kind: "human",
      name: h.name,
      role: h.role || "prompter",
    });
  }

  if (!ingredients.length) {
    ingredients.push({ kind: "human", name: "operator", role: "author" });
  }

  const metrics = l2.metrics || {};
  let notes = opts.notes ?? null;
  const autoNote = `session metrics: user_prompts=${metrics.user_prompts ?? "?"}; assistant_turns=${metrics.assistant_turns ?? "?"}`;
  if (!notes) notes = autoNote;
  else notes = `${notes}; ${autoNote}`;

  const colo = {
    schema_version: "1",
    composition,
    ingredients,
    notes,
  };

  if (opts.provenanceDigestHex) {
    colo.provenance = {
      kind: "session",
      digest: { alg: "sha256", value: opts.provenanceDigestHex },
    };
    if (opts.provenanceUri) colo.provenance.uri = opts.provenanceUri;
  }

  return colo;
}
