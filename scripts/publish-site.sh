#!/usr/bin/env bash
# Manually publish site/ to gh-pages (when Actions runners are unavailable).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="${TMPDIR:-/tmp}/innsigle-pages-$$"
rm -rf "$TMP"
mkdir -p "$TMP"
cp -a "$ROOT/site/." "$TMP/"
mkdir -p "$TMP/assets/marks" "$TMP/dogfood/.well-known/innsigle/claims"
cp "$ROOT"/docs/dogfood/assets/marks/*.svg "$TMP/assets/marks/"
cp "$ROOT"/docs/dogfood/.well-known/innsigle/keys.json "$TMP/dogfood/.well-known/innsigle/"
cp "$ROOT"/docs/dogfood/.well-known/innsigle/claims/*.json "$TMP/dogfood/.well-known/innsigle/claims/"
cp "$ROOT/docs/dogfood/index.html" "$TMP/dogfood/index.html"
sed -i 's|src="assets/marks/|src="../assets/marks/|g' "$TMP/dogfood/index.html"
touch "$TMP/.nojekyll"
cd "$TMP"
git init -b gh-pages
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add -A
git commit -m "Publish Innsigle microsite"
git remote add origin "https://github.com/DocumentDrivenDX/innsigle.git"
git push -f origin gh-pages
echo "Pushed gh-pages. Site: https://documentdrivendx.github.io/innsigle/"
rm -rf "$TMP"
