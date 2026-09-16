/**
 * Map microsite markdown sources to published URL paths, pick composition
 * from frontmatter, and render the Helix-style page colophon.
 *
 * Helix seals source bytes (not built HTML) and shows a colophon only when
 * the committed claim digest still matches. Same rule here.
 */
import { join, relative, sep } from "node:path";

const COMPOSITION_MARK = {
  "human-authored": "innsigle-human.svg",
  mixed: "innsigle-mixed.svg",
  "model-primary": "innsigle-model.svg",
};

/**
 * Frontmatter `generated: true` → model-primary (Helix); otherwise mixed.
 * @param {string} text
 * @param {string} [fallback]
 */
export function kindFromFrontmatter(text, fallback = "mixed") {
  const m = String(text || "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return fallback;
  if (/^generated:\s*"?true"?\s*$/m.test(m[1])) return "model-primary";
  return fallback;
}

/**
 * Content-relative markdown path → site pathname (no origin, no SITE_BASE).
 * `curated/` is the public tree; `generated/` is published under /reference/.
 * @param {string} rel posix path under content_root
 */
export function contentRelToPath(rel) {
  const posix = String(rel || "").split(sep).join("/");
  if (posix.startsWith("curated/")) {
    return curatedToPath(posix.slice("curated/".length));
  }
  if (posix.startsWith("generated/")) {
    return generatedToPath(posix.slice("generated/".length));
  }
  return curatedToPath(posix);
}

function curatedToPath(rel) {
  if (!rel || rel === "index.md") return "/";
  if (rel.endsWith("/index.md")) return `/${rel.slice(0, -"/index.md".length)}/`;
  return `/${rel.replace(/\.md$/, "")}/`;
}

function generatedToPath(rel) {
  if (rel === "artifacts/index.md") return "/reference/artifacts/";
  if (rel === "glossary.md") return "/reference/glossary/";
  if (rel.startsWith("artifacts/")) {
    return `/reference/artifacts/${rel
      .slice("artifacts/".length)
      .replace(/\.md$/, "")
      .toLowerCase()}/`;
  }
  return `/reference/${rel.replace(/\.md$/, "")}/`;
}

/**
 * Absolute published URL for a source file, using issuer.key_url origin +
 * the path prefix of that URL (e.g. /innsigle).
 * @param {object} config
 * @param {string} repoRoot
 * @param {string} contentPath absolute or repo-relative
 */
export function publishedContentUri(config, repoRoot, contentPath) {
  const keyUrl = config?.issuer?.key_url;
  if (!keyUrl) return undefined;
  let origin;
  let prefix = "";
  try {
    const u = new URL(keyUrl);
    origin = u.origin;
    prefix = u.pathname.replace(/\/\.well-known\/innsigle\/keys\.json$/, "") || "";
  } catch {
    return undefined;
  }
  const root = config.content_root ? join(repoRoot, config.content_root) : repoRoot;
  let rel = relative(root, contentPath).split(sep).join("/");
  if (!rel || rel.startsWith("..")) {
    rel = relative(repoRoot, contentPath).split(sep).join("/");
  }
  const path = contentRelToPath(rel);
  if (path === "/") return `${origin}${prefix}/`;
  return `${origin}${prefix}${path}`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortDigest(value) {
  const v = String(value || "");
  if (v.length <= 16) return v;
  return `${v.slice(0, 8)}…${v.slice(-8)}`;
}

/**
 * Helix-shaped colophon HTML. Caller supplies already-verified attestation.
 * @param {{ attestation: object, slug: string, assetBase: string, attHref: string, keysHref: string }} p
 */
export function renderColophonHtml({
  attestation,
  slug,
  assetBase,
  attHref,
  keysHref,
  keysDoc,
  sourceRel,
}) {
  const payload = attestation?.payload;
  const colo = payload?.colophon || {};
  const issuer = payload?.issuer || {};
  const subject = payload?.subjects?.[0] || {};
  const sig = attestation?.signatures?.[0] || {};
  const composition = colo.composition || "unknown";
  const mark = COMPOSITION_MARK[composition] || "innsigle-base.svg";
  const markSrc = `${assetBase.replace(/\/$/, "")}/${mark}`;
  const signed = sig.signed_at || payload?.issued_at || "unknown";
  const digest = subject.digest?.value || "";
  const alg = subject.digest?.alg || "sha256";
  const raw = JSON.stringify(attestation, null, 2);
  const jsonSafe = raw.replace(/</g, "\\u003c");
  const keyMeta = (keysDoc?.keys || []).find((k) => k.key_id === issuer.key_id);
  const role = keyMeta?.role || "";
  const endo = (keysDoc?.endorsements || []).find((e) => e.subject_key_id === issuer.key_id);
  const roleLabel = role === "build" ? "build key" : role === "human" ? "human key" : "signing key";
  const trust = endo
    ? `Endorsed by the human key for ${escapeHtml(endo.purpose || "seal recognition")} (ADR-003).`
    : role === "human"
      ? "Human-controlled key. Signature is not a detector and not a truth guarantee."
      : "Signature is not a detector and not a truth guarantee.";
  const sourceLine = sourceRel
    ? `<dt>Signed source</dt><dd><code>${escapeHtml(sourceRel)}</code></dd>`
    : "";
  return `<div class="innsigle-colophon" data-innsigle-slug="${escapeHtml(slug)}" data-innsigle-role="${escapeHtml(role)}">
  <script type="application/innsigle+json">${jsonSafe}</script>
  <details class="innsigle-seal">
    <summary title="View Innsigle attestation">
      <img class="innsigle-glyph" src="${escapeHtml(markSrc)}" width="16" height="16" alt="" />
      <span>Innsigle seal: <strong>${escapeHtml(composition)}</strong> by ${escapeHtml(issuer.name || "unknown issuer")} (${escapeHtml(roleLabel)})</span>
    </summary>
    <div class="innsigle-viewer">
      <p class="innsigle-covers">Signature covers the markdown source of this page, not these HTML bytes. This render quotes that seal.</p>
      <dl>
        <dt>Composition</dt><dd>${escapeHtml(composition)}</dd>
        <dt>Issuer</dt><dd>${escapeHtml(issuer.name || "")} <code>${escapeHtml(issuer.id || "")}</code></dd>
        <dt>Signing key</dt><dd><a href="${escapeHtml(issuer.key_url || keysHref)}"><code>${escapeHtml(issuer.key_id || "")}</code></a> (${escapeHtml(roleLabel)})</dd>
        ${sourceLine}
        <dt>Signed</dt><dd>${escapeHtml(signed)}</dd>
        <dt>Content digest</dt><dd><code>${escapeHtml(alg)}:${escapeHtml(shortDigest(digest))}</code></dd>
      </dl>
      <p class="innsigle-trust">${trust}</p>
      <details class="innsigle-raw"><summary>Raw attestation JSON</summary>
      <pre>${escapeHtml(raw)}</pre></details>
      <p class="innsigle-links"><a href="${escapeHtml(attHref)}">attestation file</a> · <a href="${escapeHtml(keysHref)}">issuer keys</a></p>
    </div>
  </details>
</div>`;
}
