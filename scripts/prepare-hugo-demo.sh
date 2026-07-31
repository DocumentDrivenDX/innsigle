#!/usr/bin/env bash
# Prepare /tmp/innsigle-hugo-demo for the VHS walkthrough (init + hugo, no seal).
# Seal/verify run live in the tape so viewers see the short commands.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${INNSIGLE_HUGO_DEMO_DIR:-/tmp/innsigle-hugo-demo}"
CLI="$ROOT/src/cli.mjs"
FAKE_OP="$ROOT/tests/fixtures/fake-op.mjs"
NODE="$(command -v node)"

rm -rf "$WORK"
mkdir -p "$WORK/op-store" "$WORK/bin"
WRAPPER="$WORK/op-wrapper"
cat >"$WRAPPER" <<EOF
#!/bin/sh
export INNSIGLE_FAKE_OP_STORE="$WORK/op-store"
exec "$NODE" "$FAKE_OP" "\$@"
EOF
chmod 755 "$WRAPPER"

export WORK
"$NODE" --input-type=module <<'JS'
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const d = process.env.WORK;
mkdirSync(join(d, "content"), { recursive: true });
mkdirSync(join(d, "layouts/_default"), { recursive: true });
mkdirSync(join(d, "static"), { recursive: true });
writeFileSync(
  join(d, "hugo.toml"),
  "baseURL = 'https://hugo-demo.example/'\nlanguageCode = 'en-us'\ntitle = 'Innsigle Hugo Demo'\n",
);
writeFileSync(
  join(d, "content/_index.md"),
  "---\ntitle: Home\n---\n\n# Hugo × Innsigle\n\nSealed homepage demo.\n",
);
writeFileSync(
  join(d, "layouts/_default/baseof.html"),
  `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>{{ .Site.Title }}</title>
<style>body{font:18px/1.5 system-ui;max-width:40rem;margin:2rem auto;padding:0 1rem}
footer{margin-top:2rem;padding-top:1rem;border-top:1px solid #ccc;font-size:14px}</style>
</head>
<body>
<main>{{ block "main" . }}{{ end }}</main>
<footer class="innsigle-footer">
  <a href="{{ "/.well-known/innsigle/claims/index.attestation.json" | relURL }}">Innsigle · signed</a>
</footer>
</body></html>
`,
);
writeFileSync(
  join(d, "layouts/index.html"),
  `{{ define "main" }}
<article>{{ .Content }}</article>
{{ end }}
`,
);
JS

export INNSIGLE_OP_BIN="$WRAPPER"
"$NODE" "$CLI" init --onepassword \
  --dir "$WORK" \
  --site-url https://hugo-demo.example \
  --issuer-id hugo-demo \
  --issuer-name "Hugo Demo" \
  --vault Private \
  --force

mkdir -p "$WORK/static/.well-known/innsigle"
cp -a "$WORK/.innsigle/public/." "$WORK/static/.well-known/innsigle/"
(cd "$WORK" && hugo --minify -d public)

cat >"$WORK/bin/innsigle" <<EOF
#!/bin/sh
export INNSIGLE_OP_BIN="$WRAPPER"
exec "$NODE" "$CLI" "\$@"
EOF
chmod 755 "$WORK/bin/innsigle"

echo "ok: prepared $WORK (init + hugo; not sealed yet)"
