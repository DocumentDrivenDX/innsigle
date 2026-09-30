/**
 * `innsigle doctor --hugo` — check that a Hugo site's wiring actually works.
 *
 * The failure this exists for is silent: if the assets/innsigle or
 * assets/content-src mount is wrong, `resources.Get` returns nil, the
 * colophon partial renders nothing, `hugo` exits 0, and the site ships with
 * no seals on it and no indication anything is missing. Nothing in a normal
 * build catches that. Doctor does.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadProject, validateConfig } from "./config.mjs";
import { findHugoConfig, hasMounts, mountsYaml } from "./hugo.mjs";
import { collectStatus } from "./status.mjs";
import { kindFromFrontmatter } from "./site-pages.mjs";

const REQUIRED_MOUNTS = [
  { target: "static/.well-known/innsigle", why: "publishes keys.json and claims at the signed key_url" },
  { target: "assets/innsigle", why: "lets the partial read claims at build time" },
  { target: "assets/content-src", why: "lets the partial re-hash source bytes" },
];

export function runDoctor(args, deps = {}) {
  const out = deps.log || ((s) => console.log(s));
  const err = deps.err || ((s) => console.error(s));
  const siteDir = args.find((a) => !a.startsWith("-")) || process.cwd();

  let fails = 0;
  let warns = 0;
  const ok = (m) => out(`ok    ${m}`);
  const warn = (m) => {
    warns += 1;
    out(`warn  ${m}`);
  };
  const fail = (m) => {
    fails += 1;
    out(`FAIL  ${m}`);
  };

  // --- project -------------------------------------------------------------
  const project = loadProject(siteDir);
  if (!project?.config?.issuer) {
    err("FAIL  no .innsigle/config.json — run: innsigle init --onepassword --hugo");
    return 1;
  }
  ok(`config .innsigle/config.json (issuer ${project.config.issuer.id})`);

  const problems = validateConfig(project.config);
  for (const p of problems) fail(`config: ${p}`);
  if (!problems.length) ok("config validates");

  const keyUrl = project.config.issuer.key_url || "";
  if (keyUrl.includes("example.invalid")) {
    fail(`issuer.key_url is still the placeholder ${keyUrl} — claims will point nowhere`);
  } else if (!/^https:\/\//.test(keyUrl)) {
    warn(`issuer.key_url is not https: ${keyUrl}`);
  } else {
    ok(`issuer.key_url ${keyUrl}`);
  }

  // --- Hugo config and mounts ---------------------------------------------
  const configPath = findHugoConfig(siteDir);
  if (!configPath) {
    fail(`no Hugo config found under ${siteDir}`);
  } else {
    ok(`hugo config ${configPath}`);
    if (!hasMounts(configPath)) {
      fail(`${configPath} declares no module.mounts — the partial cannot read claims. Add:\n\n${mountsYaml(project.config.content_root || "content")}`);
    } else {
      const text = readFileSync(configPath, "utf8");
      for (const { target, why } of REQUIRED_MOUNTS) {
        if (text.includes(target)) ok(`mount ${target}`);
        else fail(`mount ${target} missing — ${why}`);
      }
      for (const dflt of ["target: content", "target: assets", "target: layouts", "target: static"]) {
        if (!text.includes(dflt)) {
          warn(`${dflt.replace("target: ", "")} is not re-declared as a mount; declaring any mount replaces Hugo's defaults`);
        }
      }
    }
  }

  if (!existsSync(join(siteDir, "static"))) {
    warn("static/ does not exist; the static mount will warn on build");
  }

  // --- partial present and called -----------------------------------------
  const partialPaths = [
    "layouts/_partials/innsigle-colophon.html",
    "layouts/partials/innsigle-colophon.html",
  ].filter((p) => existsSync(join(siteDir, p)));
  if (!partialPaths.length) {
    fail("innsigle-colophon.html not found in layouts/ — run: innsigle init --hugo");
  } else {
    ok(`partial ${partialPaths[0]}`);
    // Match the invocation, not the bare name: the shipped partials mention
    // each other in their comments, which a name-only grep counts as a call.
    const called = spawnSync(
      "grep",
      ["-rlE", 'partial[[:space:]]+"innsigle-colophon', join(siteDir, "layouts")],
      { encoding: "utf8" },
    );
    const callers = (called.stdout || "")
      .split("\n")
      .filter((f) => f && !/\/innsigle-[a-z]+\.html$/.test(f));
    if (!callers.length) {
      fail('nothing calls the partial — add {{ partial "innsigle-colophon.html" . }} to your page template');
    } else {
      ok(`called from ${callers.length} template(s)`);
    }
  }

  // --- claims --------------------------------------------------------------
  try {
    const { entries, unsealed } = collectStatus(project);
    const count = (state) => entries.filter((e) => e.state === state).length;
    const stale = count("STALE");
    const orphan = count("ORPHAN");
    const ambiguous = count("AMBIGUOUS");
    const line =
      `valid=${count("VALID")} stale=${stale} orphan=${orphan} ` +
      `unsealed=${unsealed.length} ambiguous=${ambiguous}`;
    if (stale || ambiguous) {
      fail(`claims: ${line} — run: innsigle seal --all`);
      for (const e of entries.filter((x) => x.state === "STALE")) {
        out(`        stale: ${e.source || e.fname}`);
      }
    } else if (unsealed.length || orphan) {
      warn(`claims: ${line}`);
      for (const rel of unsealed.slice(0, 5)) out(`        unsealed: ${rel}`);
    } else {
      ok(`claims: ${line}`);
    }
  } catch (e) {
    warn(`claims: could not be collected (${e.message})`);
  }

  // A page can declare one composition in frontmatter while its claim says
  // another — most easily by leaving kind_from_frontmatter in legacy mode
  // while the content (and the badge partial) uses a composition: field.
  // The badge would then contradict the seal on the same page.
  const kff = project.config.kind_from_frontmatter;
  const field = kff && typeof kff === "object" ? kff.field : null;
  if (field) {
    let drift = 0;
    try {
      const { entries } = collectStatus(project);
      for (const e of entries.filter((x) => x.state === "VALID" && x.source)) {
        const src = join(project.repoRoot, e.source);
        if (!existsSync(src)) continue;
        const declared = kindFromFrontmatter(readFileSync(src, "utf8"), { field, fallback: null });
        if (!declared) continue;
        const claim = JSON.parse(readFileSync(join(project.claimsDir, e.fname), "utf8"));
        const sealed = claim?.payload?.colophon?.composition;
        if (sealed && declared !== sealed) {
          fail(`${e.source}: frontmatter says ${declared}, seal says ${sealed} — re-seal`);
          drift += 1;
        }
      }
      if (!drift) ok(`frontmatter ${field}: agrees with every seal`);
    } catch (e) {
      warn(`could not compare frontmatter to seals (${e.message})`);
    }
  } else if (kff !== false) {
    warn(
      'kind_from_frontmatter is in legacy mode (generated: true only); the badge partial reads a composition: field by default, so the two can disagree. Set { "field": "composition" }.',
    );
  }

  if (existsSync(join(siteDir, ".innsigle/public/keys.json"))) ok("issuer document present");
  else fail(".innsigle/public/keys.json missing");

  // --- resolved mounts, from Hugo itself -----------------------------------
  const hugo = spawnSync("hugo", ["config", "mounts", "--source", siteDir], { encoding: "utf8" });
  if (hugo.error || hugo.status !== 0) {
    warn("hugo not runnable here; skipped the resolved-mount check");
  } else {
    for (const { target } of REQUIRED_MOUNTS) {
      if (hugo.stdout.includes(target)) ok(`hugo resolves ${target}`);
      else fail(`hugo does not resolve ${target} — the config says one thing, Hugo sees another`);
    }
  }

  out(`\n${fails} failing, ${warns} warning(s)`);
  return fails ? 1 : 0;
}
