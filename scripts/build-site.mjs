#!/usr/bin/env node
/**
 * Build deployable HTML under site/ from:
 *   - curated: docs/website/content/curated/
 *   - generated: docs/website/content/generated/  (run publish-artifacts first)
 *   - static: marks, captures, dogfood claims
 *
 * site/ is output-only for content pages (CSS/layout live in templates here).
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { mdToHtml, splitFrontmatter } from "./md.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "site");
const CURATED = join(ROOT, "docs/website/content/curated");
const GENERATED = join(ROOT, "docs/website/content/generated");
const BASE = process.env.SITE_BASE ?? "/innsigle"; // project pages

const NAV = [
  { title: "What it is", href: `${BASE}/` },
  { title: "Why", href: `${BASE}/why/` },
  { title: "Use", href: `${BASE}/use/` },
  { title: "Reference", href: `${BASE}/reference/` },
  { title: "Dogfood", href: `${BASE}/dogfood/` },
];

function walkMd(dir, base = dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkMd(p, base, acc);
    else if (name.endsWith(".md")) acc.push(p);
  }
  return acc;
}

/** Map content file → site URL path (no domain). */
function urlFor(file, root) {
  const rel = relative(root, file).split(sep).join("/");
  if (rel === "index.md") return `${BASE}/`;
  if (rel.endsWith("/index.md")) {
    return `${BASE}/${rel.slice(0, -"/index.md".length)}/`;
  }
  return `${BASE}/${rel.replace(/\.md$/, "")}/`;
}

function hrefActive(pageUrl, navHref) {
  if (navHref === `${BASE}/`) return pageUrl === `${BASE}/`;
  return pageUrl === navHref || pageUrl.startsWith(navHref);
}

function layout({ title, description, pageUrl, bodyHtml, crumbs }) {
  const navHtml = NAV.map((n) => {
    const cur = hrefActive(pageUrl, n.href);
    return `<a href="${n.href}"${cur ? ' aria-current="page"' : ""}>${n.title}</a>`;
  }).join("\n        ");

  const crumbHtml = (crumbs || [])
    .map((c, i, a) =>
      i === a.length - 1
        ? `<span>${c.title}</span>`
        : `<a href="${c.href}">${c.title}</a>`,
    )
    .join(" <span aria-hidden=\"true\">/</span> ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — Innsigle</title>
  <meta name="description" content="${escapeHtml(description || title)}" />
  <link rel="stylesheet" href="${BASE}/assets/css/site.css" />
  <link rel="icon" href="${BASE}/assets/marks/innsigle-base.svg" type="image/svg+xml" />
</head>
<body>
  <header class="site-header">
    <div class="wrap">
      <a class="brand" href="${BASE}/">
        <img src="${BASE}/assets/marks/innsigle-base.svg" width="32" height="32" alt="" />
        Innsigle
      </a>
      <nav class="nav" aria-label="Primary">
        ${navHtml}
      </nav>
    </div>
  </header>
  <div class="wrap layout-docs">
    ${crumbHtml ? `<p class="crumbs" aria-label="Breadcrumb">${crumbHtml}</p>` : ""}
    <div class="docs-grid">
      <aside class="docs-side" aria-label="Section">
        ${sidebar(pageUrl)}
      </aside>
      <main class="docs-main prose">
        ${bodyHtml}
      </main>
    </div>
  </div>
  <footer class="site-footer">
    <div class="wrap">
      <a class="innsigle-footer-seal" href="${BASE}/use/mash-bill/">
        <img src="${BASE}/assets/marks/innsigle-base.svg" width="28" height="28" alt="" />
        <span>
          <strong>Innsigle</strong>
          <span class="cue">Mash bill · not a detector</span>
        </span>
      </a>
      <p>
        <a href="https://github.com/DocumentDrivenDX/innsigle">Source</a>
        · curated in <code>docs/website/</code>
        · specs from <code>docs/helix/</code>
      </p>
    </div>
  </footer>
</body>
</html>
`;
}

function sidebar(pageUrl) {
  const sections = [
    {
      title: "Evaluate",
      links: [
        { t: "Home", h: `${BASE}/` },
        { t: "Why", h: `${BASE}/why/` },
        { t: "Dogfood", h: `${BASE}/dogfood/` },
        { t: "Non-goals", h: `${BASE}/non-goals/` },
      ],
    },
    {
      title: "Use",
      links: [
        { t: "Use overview", h: `${BASE}/use/` },
        { t: "CLI", h: `${BASE}/use/cli/` },
        { t: "Mash bill", h: `${BASE}/use/mash-bill/` },
        { t: "Verify", h: `${BASE}/use/verify/` },
        { t: "Marks", h: `${BASE}/use/marks/` },
      ],
    },
    {
      title: "Reference",
      links: [
        { t: "Reference home", h: `${BASE}/reference/` },
        { t: "Artifacts", h: `${BASE}/reference/artifacts/` },
        { t: "Glossary", h: `${BASE}/reference/glossary/` },
      ],
    },
  ];
  return sections
    .map((s) => {
      const items = s.links
        .map((l) => {
          const cur = pageUrl === l.h || (l.h !== `${BASE}/` && pageUrl.startsWith(l.h));
          return `<li><a href="${l.h}"${cur ? ' aria-current="page"' : ""}>${l.t}</a></li>`;
        })
        .join("");
      return `<p class="side-label">${s.title}</p><ul class="side-list">${items}</ul>`;
    })
    .join("");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rewriteMdLinks(html, pageUrl) {
  // Convert relative .md links in curated content to site paths under BASE
  return html.replace(/href="([^"]+)"/g, (full, href) => {
    if (/^(https?:|mailto:|#|\/)/.test(href)) {
      if (href.startsWith("/") && !href.startsWith(BASE) && !href.startsWith("//")) {
        return `href="${BASE}${href}"`;
      }
      return full;
    }
    // relative
    let path = href;
    let frag = "";
    if (path.includes("#")) {
      const i = path.indexOf("#");
      frag = path.slice(i);
      path = path.slice(0, i);
    }
    if (path.endsWith(".md")) path = path.slice(0, -3);
    if (path.endsWith("/index")) path = path.slice(0, -"/index".length);
    // resolve roughly from page dir
    const baseDir = pageUrl.endsWith("/") ? pageUrl : pageUrl.replace(/\/[^/]*$/, "/");
    // naive join
    const stack = baseDir.replace(BASE, "").split("/").filter(Boolean);
    for (const part of path.split("/")) {
      if (part === "..") stack.pop();
      else if (part && part !== ".") stack.push(part);
    }
    let resolved = `${BASE}/${stack.join("/")}/`;
    if (path === "" || path === "./") resolved = pageUrl;
    return `href="${resolved}${frag}"`;
  });
}

function writePage(urlPath, html) {
  // urlPath like /innsigle/why/ or /innsigle/
  let rel = urlPath;
  if (rel.startsWith(BASE)) rel = rel.slice(BASE.length) || "/";
  const file =
    rel === "/" || rel === ""
      ? join(OUT, "index.html")
      : join(OUT, rel.replace(/^\//, "").replace(/\/$/, ""), "index.html");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

function renderMdFile(file, contentRoot, kind) {
  const raw = readFileSync(file, "utf8");
  const { data, body } = splitFrontmatter(raw);
  const title = data.title || extractH1(body) || file;
  const description = data.description || title;
  let pageUrl = urlFor(file, contentRoot);
  // Map generated paths under /reference/
  if (kind === "generated") {
    const rel = relative(contentRoot, file).split(sep).join("/");
    if (rel === "artifacts/index.md") pageUrl = `${BASE}/reference/artifacts/`;
    else if (rel === "glossary.md") pageUrl = `${BASE}/reference/glossary/`;
    else if (rel.startsWith("artifacts/")) {
      pageUrl = `${BASE}/reference/artifacts/${rel
        .slice("artifacts/".length)
        .replace(/\.md$/, "")
        .toLowerCase()}/`;
    }
  }
  let bodyHtml = mdToHtml(body);
  bodyHtml = rewriteMdLinks(bodyHtml, pageUrl);
  if (data.generated === "true" || kind === "generated") {
    bodyHtml =
      `<p class="gen-banner note">Generated reference — edit sources under <code>docs/helix/</code>, then <code>npm run site:build</code>.</p>\n` +
      bodyHtml;
  }
  const crumbs = [{ title: "Innsigle", href: `${BASE}/` }];
  if (pageUrl.includes("/why/")) crumbs.push({ title: "Why", href: `${BASE}/why/` });
  if (pageUrl.includes("/use/")) crumbs.push({ title: "Use", href: `${BASE}/use/` });
  if (pageUrl.includes("/reference/"))
    crumbs.push({ title: "Reference", href: `${BASE}/reference/` });
  crumbs.push({ title, href: pageUrl });

  const html = layout({
    title,
    description,
    pageUrl,
    bodyHtml,
    crumbs,
  });
  writePage(pageUrl, html);
  return pageUrl;
}

function extractH1(body) {
  const m = body.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function copyStatic() {
  mkdirSync(join(OUT, "assets/css"), { recursive: true });
  mkdirSync(join(OUT, "assets/marks"), { recursive: true });
  // CSS from previous site design (canonical in site/assets until moved)
  const cssSrc = join(ROOT, "docs/website/static/site.css");
  const cssLegacy = join(ROOT, "site/assets/css/site.css");
  if (existsSync(cssSrc)) cpSync(cssSrc, join(OUT, "assets/css/site.css"));
  else if (existsSync(cssLegacy)) {
    // keep design CSS; will re-copy after wipe carefully
  }
  cpSync(join(ROOT, "docs/dogfood/assets/marks"), join(OUT, "assets/marks"), {
    recursive: true,
  });
  // captures
  const cap = join(ROOT, "docs/website/static/captures");
  if (existsSync(cap)) {
    mkdirSync(join(OUT, "captures"), { recursive: true });
    cpSync(cap, join(OUT, "captures"), { recursive: true });
  }
  // dogfood HTML + claims
  mkdirSync(join(OUT, "dogfood/.well-known/innsigle/claims"), { recursive: true });
  cpSync(
    join(ROOT, "docs/dogfood/.well-known/innsigle/keys.json"),
    join(OUT, "dogfood/.well-known/innsigle/keys.json"),
  );
  cpSync(
    join(ROOT, "docs/dogfood/.well-known/innsigle/claims"),
    join(OUT, "dogfood/.well-known/innsigle/claims"),
    { recursive: true },
  );
  // dogfood page: wrap or copy with path fix — use dedicated built page from curated note
  // Keep a static dogfood index that matches UC sample
  let dog = readFileSync(join(ROOT, "docs/dogfood/index.html"), "utf8");
  dog = dog
    .replace(/href="\.well-known\//g, `href="${BASE}/dogfood/.well-known/`)
    .replace(/src="assets\/marks\//g, `src="${BASE}/assets/marks/`)
    .replace(/src="\.\.\/assets\/marks\//g, `src="${BASE}/assets/marks/`);
  // inject base-aware styles link if missing absolute base
  if (!dog.includes("site.css")) {
    dog = dog.replace(
      "</head>",
      `  <link rel="stylesheet" href="${BASE}/assets/css/site.css" />\n</head>`,
    );
  }
  writeFileSync(join(OUT, "dogfood/index.html"), dog);

  writeFileSync(
    join(OUT, "404.html"),
    layout({
      title: "Not found",
      description: "Page not found",
      pageUrl: `${BASE}/404`,
      bodyHtml: `<h1>Page not found</h1><p><a href="${BASE}/">Back to Innsigle</a></p>`,
      crumbs: [],
    }),
  );
  writeFileSync(join(OUT, ".nojekyll"), "");
}

function ensureCss() {
  const cssPath = join(OUT, "assets/css/site.css");
  mkdirSync(dirname(cssPath), { recursive: true });
  const websiteCss = join(ROOT, "docs/website/static/site.css");
  const existing = join(ROOT, "site/assets/css/site.css");
  if (existsSync(websiteCss)) {
    cpSync(websiteCss, cssPath);
  } else if (existsSync(existing)) {
    // Read before wipe — build-site wipes OUT first so we stash
    // Actually we wipe then need source. Prefer docs/website/static/site.css
  }
}

function main() {
  // publish first
  const pub = spawnSync(process.execPath, [join(ROOT, "scripts/publish-artifacts.mjs")], {
    stdio: "inherit",
  });
  if (pub.status !== 0) process.exit(pub.status ?? 1);

  // Preserve CSS: load into memory before wipe
  let css = "";
  const cssCandidates = [
    join(ROOT, "docs/website/static/site.css"),
    join(OUT, "assets/css/site.css"),
  ];
  for (const c of cssCandidates) {
    if (existsSync(c)) {
      css = readFileSync(c, "utf8");
      break;
    }
  }

  // Wipe HTML outputs but rebuild fully
  for (const name of readdirSync(OUT)) {
    if (name === ".git") continue;
    rmSync(join(OUT, name), { recursive: true, force: true });
  }

  mkdirSync(join(OUT, "assets/css"), { recursive: true });
  if (css) {
    // extend with docs layout
    css += `

/* Docs layout (product-microsite-ia sidebar) */
.layout-docs { padding-bottom: 2rem; }
.crumbs { font-family: var(--sans); font-size: 0.8rem; color: var(--ink-mute); margin: 1rem 0 0.5rem; }
.crumbs a { color: var(--ink-mute); }
.docs-grid { display: grid; gap: 1.75rem; margin-top: 0.5rem; }
@media (min-width: 860px) {
  .docs-grid { grid-template-columns: 12.5rem minmax(0, 1fr); gap: 2.5rem; align-items: start; }
}
.docs-side { font-family: var(--sans); font-size: 0.85rem; }
.side-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-mute); margin: 1rem 0 0.35rem; font-weight: 650; }
.side-list { list-style: none; padding: 0; margin: 0 0 0.5rem; }
.side-list a { display: block; padding: 0.2rem 0; color: var(--ink-mute); text-decoration: none; border-bottom: 2px solid transparent; }
.side-list a:hover { color: var(--ink); }
.side-list a[aria-current="page"] { color: var(--ink); font-weight: 650; border-bottom-color: var(--ink); }
.prose > h1:first-child { margin-top: 0; }
.gen-banner { border-left: 3px solid var(--line); padding-left: 0.75rem; margin-bottom: 1.25rem; }
.prose table { font-size: 0.92rem; }
.prose blockquote { margin: 1rem 0; padding: 0.5rem 0 0.5rem 1rem; border-left: 3px solid var(--line); color: var(--ink-mute); }
`;
    writeFileSync(join(OUT, "assets/css/site.css"), css);
  }

  copyStatic();

  // curated pages
  for (const file of walkMd(CURATED)) {
    renderMdFile(file, CURATED, "curated");
  }
  // generated
  for (const file of walkMd(GENERATED)) {
    renderMdFile(file, GENERATED, "generated");
  }

  console.error(`build-site: wrote ${OUT} (BASE=${BASE})`);
}

main();
