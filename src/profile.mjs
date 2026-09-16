/**
 * Maker profile + plain seals (FEAT-005).
 *
 * Isomorphic: no node: imports. CLI, site build, and the browser builder
 * all import this module. Signed CONTRACT-001 claims stay in cli.mjs;
 * this type has no digest and no signature.
 */

export const PLAIN_TYPE = "https://innsigle.dev/claim/plain-colophon/v1";
export const PROFILE_VERSION = "1";
export const COMPOSITIONS = ["human-authored", "mixed", "model-primary"];
export const INGREDIENT_KINDS = ["model", "tool", "human", "other"];
export const UNSIGNED_LABEL = "Unsigned declaration";
export const INTEGRITY_LINE =
  "This page is how the maker says the work was made. It is not a signature and not a detector.";

const ID_RE = /^[a-z][a-z0-9-]{0,63}$/;
const KEY_ID_RE = /^ed25519:[0-9a-f]{32}$/;

const CUE = {
  "human-authored": { letter: "H", file: "human", word: "human-authored" },
  mixed: { letter: "M", file: "mixed", word: "mixed" },
  "model-primary": { letter: "A", file: "model", word: "model-primary" },
};

export class ProfileError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProfileError";
  }
}

export function nowIso(d = new Date()) {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function slugify(title) {
  const s = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return s || "work";
}

export function isAbsoluteHttpUrl(s) {
  if (!s || typeof s !== "string") return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function compositionCue(composition) {
  return CUE[composition] || null;
}

/** FR-4a: a model ingredient must not ride under human-authored. */
export function assertNoLaundering(composition, ingredients) {
  if (composition !== "human-authored") return;
  const models = (ingredients || []).filter((i) => i.kind === "model");
  if (models.length) {
    throw new ProfileError(
      "human-authored cannot list a model ingredient (edit is not origin; use mixed or model-primary)",
    );
  }
}

export function defaultIngredients(composition, makerName, modelName) {
  const name = (makerName || "").trim();
  const model = (modelName || "").trim();
  const human = name
    ? [
        {
          kind: "human",
          name,
          role:
            composition === "human-authored"
              ? "author"
              : composition === "model-primary"
                ? "review"
                : "edit",
        },
      ]
    : [];
  const models = model ? [{ kind: "model", name: model, role: "draft" }] : [];
  if (composition === "human-authored") return human;
  if (composition === "model-primary") return [...models, ...human];
  return [...human, ...models];
}

function requireString(obj, key, label = key) {
  const v = obj?.[key];
  if (typeof v !== "string" || !v.trim()) {
    throw new ProfileError(`missing ${label}`);
  }
  return v.trim();
}

function normalizeIngredient(raw, idx) {
  if (!raw || typeof raw !== "object") {
    throw new ProfileError(`ingredient ${idx} is not an object`);
  }
  const kind = requireString(raw, "kind", `ingredient ${idx} kind`);
  if (!INGREDIENT_KINDS.includes(kind)) {
    throw new ProfileError(`ingredient ${idx} kind must be ${INGREDIENT_KINDS.join("|")}`);
  }
  const name = requireString(raw, "name", `ingredient ${idx} name`);
  const out = { kind, name };
  if (raw.role != null && String(raw.role).trim()) out.role = String(raw.role).trim();
  if (raw.version != null && String(raw.version).trim()) out.version = String(raw.version).trim();
  if (raw.uri != null) {
    if (!isAbsoluteHttpUrl(raw.uri)) {
      throw new ProfileError(`ingredient ${idx} uri must be an absolute http(s) URL`);
    }
    out.uri = raw.uri;
  }
  return out;
}

function normalizeColophon(raw) {
  if (!raw || typeof raw !== "object") {
    throw new ProfileError("work colophon missing");
  }
  const composition = requireString(raw, "composition");
  if (!COMPOSITIONS.includes(composition)) {
    throw new ProfileError("composition must be human-authored|mixed|model-primary");
  }
  if (!Array.isArray(raw.ingredients)) {
    throw new ProfileError("colophon ingredients must be an array");
  }
  const ingredients = raw.ingredients.map((ing, i) => normalizeIngredient(ing, i));
  assertNoLaundering(composition, ingredients);
  const colo = {
    schema_version: "1",
    composition,
    ingredients,
  };
  if (raw.notes != null && String(raw.notes).trim()) colo.notes = String(raw.notes).trim();
  return colo;
}

function uniqueSlug(base, taken) {
  let slug = base;
  let n = 2;
  while (taken.has(slug)) {
    const suffix = `-${n}`;
    slug = `${base.slice(0, Math.max(1, 64 - suffix.length))}${suffix}`;
    n += 1;
  }
  return slug;
}

export function normalizeWork(raw, { takenSlugs = new Set(), now = nowIso() } = {}) {
  if (!raw || typeof raw !== "object") throw new ProfileError("work is not an object");
  if (raw.kind && raw.kind !== "plain") {
    throw new ProfileError("only kind=plain works are supported on a maker profile");
  }
  if (raw.digest || raw.subjects?.[0]?.digest) {
    throw new ProfileError(
      "plain seals have no content digest; export a PDF and use innsigle seal for signed claims",
    );
  }
  const title = requireString(raw, "title");
  const slug = uniqueSlug(slugify(raw.slug || title), takenSlugs);
  if (raw.url != null && String(raw.url).trim()) {
    if (!isAbsoluteHttpUrl(raw.url)) {
      throw new ProfileError(`work ${slug}: url must be an absolute http(s) URL`);
    }
  }
  const colo = normalizeColophon(raw.colophon || { composition: raw.composition, ingredients: raw.ingredients || [] });
  const work = {
    slug,
    title,
    kind: "plain",
    issued_at: raw.issued_at || now,
    colophon: colo,
  };
  if (raw.url && String(raw.url).trim()) work.url = String(raw.url).trim();
  return work;
}

export function emptyProfile({ id, name, bio, profile_url, now = nowIso() } = {}) {
  return validateProfile({
    innsigle_profile: PROFILE_VERSION,
    id,
    name,
    bio: bio || undefined,
    profile_url: profile_url || undefined,
    links: [],
    issuer: null,
    works: [],
    generated_at: now,
  });
}

export function validateProfile(raw) {
  if (!raw || typeof raw !== "object") throw new ProfileError("profile is not an object");
  if (raw.innsigle_profile != null && String(raw.innsigle_profile) !== PROFILE_VERSION) {
    throw new ProfileError(`innsigle_profile must be "${PROFILE_VERSION}"`);
  }
  const id = requireString(raw, "id");
  if (!ID_RE.test(id)) {
    throw new ProfileError("id must be a lowercase slug (start with a letter, then a-z, 0-9, hyphen)");
  }
  const name = requireString(raw, "name");
  const profile = {
    innsigle_profile: PROFILE_VERSION,
    id,
    name,
    links: [],
    issuer: null,
    works: [],
  };
  if (raw.bio != null && String(raw.bio).trim()) profile.bio = String(raw.bio).trim();
  if (raw.profile_url != null && String(raw.profile_url).trim()) {
    if (!isAbsoluteHttpUrl(raw.profile_url)) {
      throw new ProfileError("profile_url must be an absolute http(s) URL");
    }
    profile.profile_url = raw.profile_url.trim();
  }
  if (raw.generated_at) profile.generated_at = raw.generated_at;

  if (raw.issuer != null && raw.issuer !== null) {
    const keyId = requireString(raw.issuer, "key_id", "issuer.key_id");
    if (!KEY_ID_RE.test(keyId)) {
      throw new ProfileError("issuer.key_id must look like ed25519:<32 hex chars>");
    }
    const keyUrl = requireString(raw.issuer, "key_url", "issuer.key_url");
    if (!isAbsoluteHttpUrl(keyUrl)) {
      throw new ProfileError("issuer.key_url must be an absolute http(s) URL");
    }
    profile.issuer = { key_id: keyId, key_url: keyUrl };
  }

  if (raw.links != null) {
    if (!Array.isArray(raw.links)) throw new ProfileError("links must be an array");
    profile.links = raw.links.map((link, i) => {
      const label = requireString(link, "label", `links[${i}].label`);
      const url = requireString(link, "url", `links[${i}].url`);
      if (!isAbsoluteHttpUrl(url)) {
        throw new ProfileError(`links[${i}].url must be an absolute http(s) URL`);
      }
      return { label, url };
    });
  }

  if (raw.works != null) {
    if (!Array.isArray(raw.works)) throw new ProfileError("works must be an array");
    const taken = new Set();
    profile.works = raw.works.map((w) => {
      const work = normalizeWork(w, { takenSlugs: taken, now: raw.generated_at });
      taken.add(work.slug);
      return work;
    });
  }
  return profile;
}

export function addWork(profile, input, { now = nowIso() } = {}) {
  const current = validateProfile(profile);
  const taken = new Set(current.works.map((w) => w.slug));
  const composition = input.colophon?.composition || input.composition || input.kind;
  if (composition === "human-authored" && input.model) {
    throw new ProfileError(
      "human-authored cannot list a model ingredient (edit is not origin; use mixed or model-primary)",
    );
  }
  const workInput = input.colophon
    ? input
    : {
        title: input.title,
        url: input.url,
        slug: input.slug,
        issued_at: input.issued_at || now,
        digest: input.digest,
        subjects: input.subjects,
        colophon: {
          composition: input.composition || input.kind,
          ingredients:
            input.ingredients ||
            defaultIngredients(input.composition || input.kind, current.name, input.model),
          notes: input.notes,
        },
      };
  const work = normalizeWork(workInput, { takenSlugs: taken, now });
  current.works.push(work);
  return current;
}

export function footerLine(profile, slug) {
  const p = validateProfile(profile);
  const work = p.works.find((w) => w.slug === slug);
  if (!work) throw new ProfileError(`no work with slug ${slug}`);
  const cue = work.colophon.composition;
  const host = p.profile_url ? stripProtocol(p.profile_url) : p.id;
  return `Innsigle · ${cue} · ${host}#${work.slug}`;
}

export function bioCard(profile) {
  const p = validateProfile(profile);
  const url = p.profile_url || "(publish this page, then put its URL here)";
  return `Innsigle · ${p.name}\n${url}`;
}

function stripProtocol(url) {
  return String(url).replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function workToPlainClaim(profile, slug) {
  const p = validateProfile(profile);
  const work = p.works.find((w) => w.slug === slug);
  if (!work) throw new ProfileError(`no work with slug ${slug}`);
  const claim = {
    innsigle: "1",
    type: PLAIN_TYPE,
    issued_at: work.issued_at,
    maker: {
      id: p.id,
      name: p.name,
      ...(p.profile_url ? { profile_url: p.profile_url } : {}),
    },
    subject: {
      title: work.title,
      ...(work.url ? { uri: work.url } : {}),
    },
    colophon: work.colophon,
  };
  return claim;
}

function markMarkup(composition, opts) {
  const cue = compositionCue(composition);
  const fileKey = cue ? cue.file : "base";
  const alt = cue ? `Innsigle, ${cue.word}` : "Innsigle";
  const inline = opts.inlineMarks?.[fileKey];
  if (inline) {
    return `<span class="ip-mark" role="img" aria-label="${escapeHtml(alt)}">${inline}</span>`;
  }
  if (opts.markHrefPrefix != null) {
    const href = `${opts.markHrefPrefix}innsigle-${fileKey}.svg`;
    return `<img class="ip-mark" src="${escapeHtml(href)}" width="56" height="56" alt="${escapeHtml(alt)}" />`;
  }
  const letter = cue ? cue.letter : "·";
  return `<span class="ip-cue" aria-label="${escapeHtml(alt)}">${escapeHtml(letter)}</span>`;
}

function profileCss() {
  return `
:root {
  color-scheme: light dark;
  --ink: #141210;
  --ink-mute: #5c564e;
  --paper: #f4f0e8;
  --paper-raised: #faf7f1;
  --line: #d4cdc0;
  --accent: #3d4a3a;
  --focus: #2a5a8a;
  --font: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
  --sans: system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: ui-monospace, "Cascadia Code", "SF Mono", Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --ink: #ebe6dc;
    --ink-mute: #a39c90;
    --paper: #161411;
    --paper-raised: #1e1b17;
    --line: #3a352e;
    --accent: #9aaf96;
    --focus: #7eb0e0;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  font: 1.05rem/1.55 var(--font);
  color: var(--ink);
  background: var(--paper);
}
a { color: var(--accent); text-underline-offset: 0.15em; }
a:focus-visible { outline: 2px solid var(--focus); outline-offset: 3px; }
.ip-wrap { width: min(100% - 2rem, 28rem); margin: 2rem auto 3rem; }
.ip-head { display: flex; gap: 0.85rem; align-items: center; margin-bottom: 1rem; }
.ip-mark, .ip-mark svg, .ip-head img.ip-mark { width: 3.5rem; height: 3.5rem; display: block; flex-shrink: 0; }
.ip-mark svg { width: 100%; height: 100%; }
.ip-cue {
  display: inline-flex; align-items: center; justify-content: center;
  width: 3.5rem; height: 3.5rem; border-radius: 50%;
  background: var(--ink); color: var(--paper); font: 700 1.25rem/1 var(--sans);
}
.ip-name { font-size: 1.45rem; font-weight: 650; margin: 0; line-height: 1.2; }
.ip-cue-line { margin: 0.2rem 0 0; color: var(--ink-mute); font-family: var(--sans); font-size: 0.85rem; }
.ip-bio { margin: 0.75rem 0 1rem; }
.ip-how { font-size: 0.9rem; color: var(--ink-mute); margin: 0 0 1.25rem; }
.ip-list { list-style: none; padding: 0; margin: 0 0 1.25rem; display: grid; gap: 0.5rem; }
.ip-link, .ip-work {
  display: block; padding: 0.7rem 0.85rem; background: var(--paper-raised);
  border: 1px solid var(--line); border-radius: 0.4rem; text-decoration: none; color: inherit;
}
.ip-link { font-family: var(--sans); font-weight: 600; }
.ip-work { display: grid; grid-template-columns: auto 1fr; gap: 0.65rem; align-items: start; }
.ip-work .ip-mark, .ip-work .ip-cue { width: 2.5rem; height: 2.5rem; }
.ip-work .ip-cue { font-size: 1rem; }
.ip-work-title { font-weight: 650; margin: 0; }
.ip-meta { margin: 0.15rem 0 0; font-family: var(--sans); font-size: 0.8rem; color: var(--ink-mute); }
.ip-ing { margin: 0.25rem 0 0; font-size: 0.85rem; }
.ip-label { font-family: var(--sans); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-mute); font-weight: 650; margin: 1.25rem 0 0.4rem; }
.ip-issuer { font-family: var(--mono); font-size: 0.78rem; color: var(--ink-mute); word-break: break-all; }
.ip-foot { margin-top: 1.75rem; padding-top: 1rem; border-top: 1px solid var(--line); font-size: 0.85rem; color: var(--ink-mute); }
.ip-unsigned { font-family: var(--sans); font-weight: 650; color: var(--ink); }
`.trim();
}

export function renderProfileHtml(profile, opts = {}) {
  const p = validateProfile(profile);
  const baseMark = (() => {
    if (opts.inlineMarks?.base) {
      return `<span class="ip-mark" role="img" aria-label="Innsigle">${opts.inlineMarks.base}</span>`;
    }
    if (opts.markHrefPrefix != null) {
      return `<img class="ip-mark" src="${escapeHtml(opts.markHrefPrefix)}innsigle-base.svg" width="56" height="56" alt="Innsigle" />`;
    }
    return `<span class="ip-cue" aria-label="Innsigle">·</span>`;
  })();

  const links = p.links
    .map(
      (l) =>
        `<li><a class="ip-link" href="${escapeHtml(l.url)}">${escapeHtml(l.label)}</a></li>`,
    )
    .join("\n");

  const works = p.works
    .map((w) => {
      const cue = compositionCue(w.colophon.composition);
      const mark = markMarkup(w.colophon.composition, opts);
      const ings = (w.colophon.ingredients || [])
        .map((i) => escapeHtml([i.name, i.role].filter(Boolean).join(", ")))
        .join(" · ");
      const inner = `
        ${mark}
        <span>
          <p class="ip-work-title">${escapeHtml(w.title)}</p>
          <p class="ip-meta">${escapeHtml(cue.word)} · <span class="ip-unsigned">${UNSIGNED_LABEL}</span></p>
          ${ings ? `<p class="ip-ing">${ings}</p>` : ""}
        </span>`;
      const tag = w.url ? "a" : "div";
      const href = w.url ? ` href="${escapeHtml(w.url)}"` : "";
      return `<li><${tag} class="ip-work" id="${escapeHtml(w.slug)}"${href}>${inner}</${tag}></li>`;
    })
    .join("\n");

  const issuer = p.issuer
    ? `<p class="ip-label">Issuer (discovery, not a seal)</p>
<p class="ip-issuer">key ${escapeHtml(p.issuer.key_id)}<br />keys ${escapeHtml(p.issuer.key_url)}</p>`
    : "";

  const how =
    "How to read: H human-authored · M mixed · A model-primary. Rows are unsigned unless a later signed claim says otherwise.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(p.name)}: Innsigle</title>
  <meta name="description" content="Maker profile for ${escapeHtml(p.name)}. ${UNSIGNED_LABEL}." />
  <style>${profileCss()}</style>
</head>
<body>
  <main class="ip-wrap">
    <header class="ip-head">
      ${baseMark}
      <div>
        <h1 class="ip-name">${escapeHtml(p.name)}</h1>
        <p class="ip-cue-line">The maker's seal for published work</p>
      </div>
    </header>
    ${p.bio ? `<p class="ip-bio">${escapeHtml(p.bio)}</p>` : ""}
    <p class="ip-how">${escapeHtml(how)}</p>
    ${
      p.links.length
        ? `<p class="ip-label">Links</p><ul class="ip-list">${links}</ul>`
        : ""
    }
    <p class="ip-label">Work</p>
    ${
      p.works.length
        ? `<ul class="ip-list">${works}</ul>`
        : `<p class="ip-meta">No works yet.</p>`
    }
    ${issuer}
    <footer class="ip-foot">
      <p><span class="ip-unsigned">${UNSIGNED_LABEL}.</span> ${escapeHtml(INTEGRITY_LINE)}</p>
    </footer>
  </main>
</body>
</html>
`;
}
