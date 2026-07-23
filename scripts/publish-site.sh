#!/usr/bin/env bash
# Build site from docs/ (curated + generated) and push gh-pages.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE_BASE="${SITE_BASE:-/innsigle}"
npm test
npm run site:build
TMP="${TMPDIR:-/tmp}/innsigle-pages-$$"
rm -rf "$TMP"
mkdir -p "$TMP"
cp -a site/. "$TMP/"
cd "$TMP"
git init -b gh-pages
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add -A
git commit -m "Publish Innsigle microsite (docs-driven build)"
git remote add origin "https://github.com/DocumentDrivenDX/innsigle.git"
git push -f origin gh-pages
echo "Pushed gh-pages. Site: https://documentdrivendx.github.io/innsigle/"
rm -rf "$TMP"
