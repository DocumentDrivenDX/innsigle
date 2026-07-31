#!/usr/bin/env node
/**
 * End-to-end: trivial Hugo site + innsigle init (1Password via fake op) +
 * publish wiring per .innsigle/AGENTS.md + claim/sign/verify.
 *
 * Usage:
 *   node scripts/hugo-innsigle-workflow.mjs [--out-dir <dir>] [--keep]
 *
 * Exit 0 on success; prints JSON summary on stdout last line (summary=...).
 */
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
// dirname still used for FAKE_OP / ROOT paths

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "src/cli.mjs");
const FAKE_OP = join(ROOT, "tests/fixtures/fake-op.mjs");

function arg(argv, name) {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    ...opts,
  });
  return r;
}

function mustOk(r, label) {
  if (r.status !== 0) {
    console.error(`FAIL: ${label}`);
    console.error(r.stderr || r.stdout || "");
    process.exit(r.status ?? 1);
  }
}

function requireHugo() {
  const r = run("hugo", ["version"]);
  if (r.error?.code === "ENOENT" || r.status === null) {
    console.error("SKIP: hugo not on PATH (install: https://gohugo.io/installation/)");
    process.exit(0);
  }
  if (r.status !== 0) {
    console.error("FAIL: hugo version failed");
    process.exit(1);
  }
  return (r.stdout || r.stderr || "").trim();
}

function writeHugoSite(siteDir) {
  mkdirSync(join(siteDir, "content"), { recursive: true });
  mkdirSync(join(siteDir, "layouts", "_default"), { recursive: true });
  mkdirSync(join(siteDir, "layouts", "partials"), { recursive: true });
  mkdirSync(join(siteDir, "static"), { recursive: true });
  mkdirSync(join(siteDir, "archetypes"), { recursive: true });

  writeFileSync(
    join(siteDir, "hugo.toml"),
    `baseURL = 'https://hugo-demo.example/'
languageCode = 'en-us'
title = 'Innsigle Hugo Demo'
`,
  );

  writeFileSync(
    join(siteDir, "archetypes/default.md"),
    `---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
date: {{ .Date }}
draft: false
---
`,
  );

  writeFileSync(
    join(siteDir, "content/_index.md"),
    `---
title: Home
---

# Hugo × Innsigle

This page is a **trivial Hugo site** sealed with Innsigle after \`hugo\` render.
`,
  );

  writeFileSync(
    join(siteDir, "layouts/_default/baseof.html"),
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>{{ block "title" . }}{{ .Site.Title }}{{ end }}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font: 18px/1.5 system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; color: #111; }
    footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ccc; font-size: 14px; }
    .seal { display: inline-flex; gap: 0.5rem; align-items: center; color: inherit; text-decoration: none; }
  </style>
</head>
<body>
  <main>{{ block "main" . }}{{ end }}</main>
  {{ partial "innsigle-footer.html" . }}
</body>
</html>
`,
  );

  writeFileSync(
    join(siteDir, "layouts/index.html"),
    `{{ define "title" }}{{ .Title }} · {{ .Site.Title }}{{ end }}
{{ define "main" }}
<article>
  {{ .Content }}
</article>
{{ end }}
`,
  );

  writeFileSync(
    join(siteDir, "layouts/_default/single.html"),
    `{{ define "title" }}{{ .Title }} · {{ .Site.Title }}{{ end }}
{{ define "main" }}
<article>
  <h1>{{ .Title }}</h1>
  {{ .Content }}
</article>
{{ end }}
`,
  );

  // Footer links to published well-known claim (after seal step).
  writeFileSync(
    join(siteDir, "layouts/partials/innsigle-footer.html"),
    `<footer class="innsigle-footer">
  <a class="seal" href="{{ "/.well-known/innsigle/claims/index.attestation.json" | relURL }}">
    <strong>Innsigle</strong>
    <span>The maker's seal · model-primary · signed</span>
  </a>
</footer>
`,
  );
}

/** Agent step from .innsigle/AGENTS.md: stage public → Hugo static well-known. */
function publishToHugoStatic(siteDir) {
  const from = join(siteDir, ".innsigle/public");
  const to = join(siteDir, "static/.well-known/innsigle");
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

function main() {
  const argv = process.argv.slice(2);
  const keep = argv.includes("--keep");
  let outDir = arg(argv, "--out-dir");
  const ephemeral = !outDir;
  if (!outDir) outDir = mkdtempSync(join(tmpdir(), "innsigle-hugo-"));

  const hugoVer = requireHugo();
  console.error(`hugo: ${hugoVer.split("\n")[0]}`);
  console.error(`site: ${outDir}`);

  if (existsSync(outDir) && ephemeral) {
    /* mkdtemp is empty */
  } else if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  // Clean previous demo artifacts if reusing out-dir
  for (const name of [".innsigle", "public", "static/.well-known", "resources", "content", "layouts", "hugo.toml"]) {
    const p = join(outDir, name);
    if (existsSync(p)) rmSync(p, { recursive: true, force: true });
  }

  writeHugoSite(outDir);

  const opStore = join(outDir, ".op-store");
  mkdirSync(opStore, { recursive: true });
  const opWrapper = join(outDir, "op-wrapper");
  writeFileSync(
    opWrapper,
    `#!/bin/sh\nexport INNSIGLE_FAKE_OP_STORE="${opStore}"\nexec "${process.execPath}" "${FAKE_OP}" "$@"\n`,
  );
  chmodSync(opWrapper, 0o755);

  const env = {
    ...process.env,
    INNSIGLE_OP_BIN: opWrapper,
  };

  // 1. init --onepassword (fake op in e2e; real op in production)
  let r = run(
    process.execPath,
    [
      CLI,
      "init",
      "--onepassword",
      "--dir",
      outDir,
      "--site-url",
      "https://hugo-demo.example",
      "--issuer-id",
      "hugo-demo",
      "--issuer-name",
      "Hugo Demo",
      "--vault",
      "Private",
      "--force",
    ],
    { env, cwd: outDir },
  );
  mustOk(r, "innsigle init");
  console.error(r.stderr.trim());

  // 2. Wire publish into Hugo (agent / human step)
  publishToHugoStatic(outDir);
  console.error("ok: copied .innsigle/public → static/.well-known/innsigle");

  // 3. Hugo build
  r = run("hugo", ["--minify", "-d", "public"], { cwd: outDir });
  mustOk(r, "hugo build");
  console.error("ok: hugo public/");

  const page = join(outDir, "public/index.html");
  if (!existsSync(page)) {
    console.error("FAIL: public/index.html missing after hugo");
    process.exit(1);
  }
  if (!existsSync(join(outDir, "public/.well-known/innsigle/keys.json"))) {
    console.error("FAIL: keys.json not published under public/.well-known/innsigle/");
    process.exit(1);
  }

  // 4. Seal built HTML (issuer + 1Password from .innsigle/config.json)
  r = run(
    process.execPath,
    [CLI, "seal", page, "--kind", "model-primary"],
    { cwd: outDir, env },
  );
  mustOk(r, "seal");
  console.error(r.stderr.trim());

  // 5. Re-publish claims + short verify
  publishToHugoStatic(outDir);
  cpSync(join(outDir, "static/.well-known/innsigle"), join(outDir, "public/.well-known/innsigle"), {
    recursive: true,
  });

  r = run(process.execPath, [CLI, "verify", page], { cwd: outDir, env });
  mustOk(r, "verify");
  if (!/VALID/.test(r.stdout)) {
    console.error("FAIL: expected VALID");
    process.exit(1);
  }
  console.error(r.stdout.trim());

  const cfg = JSON.parse(readFileSync(join(outDir, ".innsigle/config.json"), "utf8"));
  const summary = {
    ok: true,
    outDir,
    key_id: cfg.issuer.key_id,
    key_url: cfg.issuer.key_url,
    page,
    attestation: "public/.well-known/innsigle/claims/index.attestation.json",
    agents_md: ".innsigle/AGENTS.md",
  };
  console.log("summary=" + JSON.stringify(summary));

  if (ephemeral && !keep) {
    rmSync(outDir, { recursive: true, force: true });
    console.error("cleaned ephemeral out-dir");
  }
}

main();
