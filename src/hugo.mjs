/**
 * Hugo integration scaffolding for `innsigle init --hugo`.
 *
 * Wiring innsigle into Hugo by hand has three sharp edges, and this module
 * exists to blunt all three:
 *
 *   1. Declaring `module.mounts` REPLACES Hugo's defaults. Adding three
 *      innsigle mounts without re-declaring content/assets/layouts/static
 *      silently breaks the site.
 *   2. The partial renders nothing when a mount is wrong — `resources.Get`
 *      returns nil, the build succeeds, and the site just has no seals.
 *   3. Which partial a theme calls per page is theme-specific, so a single
 *      canonical filename is not enough on its own.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Partials + CSS that ship in the package. Null when running from a tarball
 *  that excluded them, which `files` in package.json should never do. */
export function packagedHugoDir() {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = join(here, "../integrations/hugo");
  return existsSync(dir) ? dir : null;
}

/** Root config filenames Hugo accepts, in the order it prefers them. */
const ROOT_CONFIGS = [
  "hugo.toml", "hugo.yaml", "hugo.yml", "hugo.json",
  "config.toml", "config.yaml", "config.yml", "config.json",
];

/** @returns {string | null} the site's root config file, if there is one */
export function findHugoConfig(siteDir) {
  for (const name of ROOT_CONFIGS) {
    const p = join(siteDir, name);
    if (existsSync(p)) return p;
  }
  for (const name of ROOT_CONFIGS) {
    const p = join(siteDir, "config/_default", name);
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Does this site already declare mounts? Textual, deliberately: parsing three
 * config formats would mean taking a dependency, and a false positive here
 * only means we print the block instead of writing it.
 */
export function hasMounts(configPath) {
  if (!configPath || !existsSync(configPath)) return false;
  const text = readFileSync(configPath, "utf8");
  return /^\s*mounts\s*:/m.test(text) || /\[\[module\.mounts\]\]/.test(text);
}

/**
 * The complete mounts block, including Hugo's defaults.
 *
 * The defaults must be restated: Hugo replaces all of them the moment any
 * mount is declared, so a block containing only the innsigle entries would
 * leave the site with no content, assets, layouts or static files.
 */
export function mountsYaml(contentRoot = "content") {
  return `module:
  mounts:
    # Hugo's defaults. Declaring any mount replaces all of them, so these must
    # be restated or the site loses its content, assets, layouts and static.
    - source: ${contentRoot}
      target: content
    - source: assets
      target: assets
    - source: layouts
      target: layouts
    - source: static
      target: static
    # Innsigle: publish the issuer document and claims at the signed key_url.
    - source: .innsigle/public
      target: static/.well-known/innsigle
    # Innsigle: same tree, readable at build time by the colophon partial.
    - source: .innsigle/public
      target: assets/innsigle
    # Innsigle: source bytes, so the partial can re-hash them and refuse to
    # render a seal for a page edited since it was sealed.
    - source: ${contentRoot}
      target: assets/content-src
`;
}

/** Themes whose per-page hook we know. */
const THEME_HOOKS = {
  papermod: {
    hook: "layouts/partials/comments.html",
    note: 'PaperMod calls comments.html only when params.comments is true — set it.',
  },
  hextra: {
    hook: "layouts/_partials/components/comments.html",
    note: "Hextra renders components/comments.html at the end of every page.",
  },
};

/** @returns {{name: string, hook: string, note: string} | null} */
export function detectThemeHook(siteDir, configPath) {
  let theme = "";
  if (configPath && existsSync(configPath)) {
    const m = readFileSync(configPath, "utf8").match(/^\s*theme\s*[:=]\s*["']?([\w.-]+)/m);
    if (m) theme = m[1];
  }
  if (!theme) {
    const themesDir = join(siteDir, "themes");
    if (existsSync(themesDir)) {
      const entries = readdirSync(themesDir).filter((e) => !e.startsWith("."));
      if (entries.length === 1) theme = entries[0];
    }
  }
  const key = theme.toLowerCase().replace(/[^a-z]/g, "");
  return THEME_HOOKS[key] ? { name: theme, ...THEME_HOOKS[key] } : null;
}

/** Hugo >= 0.146 prefers layouts/_partials; older layouts use layouts/partials. */
function partialsDir(siteDir) {
  return existsSync(join(siteDir, "layouts/_partials")) ? "layouts/_partials" : "layouts/partials";
}

/**
 * Copy partials + CSS into the site and wire the mounts.
 *
 * Idempotent: re-running overwrites the shipped files (so an upgrade is a
 * re-run) but never rewrites the theme adapter or the config if they exist.
 *
 * @returns {{ wrote: string[], skipped: string[], manual: string[] }}
 */
export function scaffoldHugo({ siteDir, contentRoot = "content", log = () => {} }) {
  const pkg = packagedHugoDir();
  if (!pkg) throw new Error("packaged integrations/hugo is missing from this install");

  const wrote = [];
  const skipped = [];
  const manual = [];
  const pDir = partialsDir(siteDir);

  for (const name of ["innsigle-colophon.html", "innsigle-badge.html", "innsigle-glyph.html"]) {
    const dest = join(siteDir, pDir, name);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(pkg, "layouts/_partials", name), dest);
    wrote.push(join(pDir, name));
  }

  const css = join(siteDir, "assets/css/innsigle.css");
  mkdirSync(dirname(css), { recursive: true });
  cpSync(join(pkg, "assets/css/innsigle.css"), css);
  wrote.push("assets/css/innsigle.css");

  // static/ must exist or the mount warns, and a warning fails strict builds.
  const staticDir = join(siteDir, "static");
  if (!existsSync(staticDir)) {
    mkdirSync(staticDir, { recursive: true });
    writeFileSync(join(staticDir, ".gitkeep"), "");
    wrote.push("static/.gitkeep");
  }

  // Theme adapter: one line at whatever path this theme calls per page.
  const configPath = findHugoConfig(siteDir);
  const theme = detectThemeHook(siteDir, configPath);
  if (theme) {
    const dest = join(siteDir, theme.hook);
    if (existsSync(dest)) {
      skipped.push(`${theme.hook} (exists — add {{ partial "innsigle-colophon.html" . }} yourself)`);
    } else {
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(
        dest,
        `{{- /* Innsigle seal. ${theme.note} */ -}}\n{{ partial "innsigle-colophon.html" . }}\n`,
      );
      wrote.push(theme.hook);
    }
    if (theme.note.includes("params.comments")) manual.push("set params.comments: true");
  } else {
    manual.push(
      'call {{ partial "innsigle-colophon.html" . }} from your single-page template',
    );
  }

  // Mounts. Append only to a root YAML config with no module block: that is
  // valid YAML without parsing. Anything else gets printed for review.
  const yamlRoot =
    configPath && /hugo\.ya?ml$|config\.ya?ml$/.test(configPath) && !configPath.includes("_default");
  if (configPath && hasMounts(configPath)) {
    manual.push(`merge these mounts into ${configPath} (it already declares some):\n\n${mountsYaml(contentRoot)}`);
  } else if (yamlRoot) {
    const text = readFileSync(configPath, "utf8");
    if (/^module\s*:/m.test(text)) {
      manual.push(`add the innsigle mounts under the existing module: block in ${configPath}`);
    } else {
      writeFileSync(configPath, `${text.replace(/\n*$/, "\n")}\n${mountsYaml(contentRoot)}`);
      wrote.push(`${configPath} (module.mounts appended)`);
    }
  } else {
    manual.push(`add to your Hugo config:\n\n${mountsYaml(contentRoot)}`);
  }

  return { wrote, skipped, manual };
}
