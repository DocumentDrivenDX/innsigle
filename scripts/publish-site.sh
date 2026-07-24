#!/usr/bin/env bash
# EMERGENCY ONLY — normal deploys use GitHub Actions (.github/workflows/pages.yml).
#
# Prefer: push to main, or Actions → "Deploy microsite" → Run workflow.
# This script force-pushes the legacy gh-pages branch. It does not work once
# the repo Pages source is "GitHub Actions" only (workflow artifact deploy).
# Kept for break-glass if Actions is unavailable and Pages is temporarily
# switched back to branch deploy.
set -euo pipefail

echo "WARNING: scripts/publish-site.sh is emergency-only." >&2
echo "Primary path: git push origin main → workflow Deploy microsite" >&2
echo "Or: gh workflow run 'Deploy microsite' --repo DocumentDrivenDX/innsigle" >&2
echo "" >&2

if [[ "${FORCE_LEGACY_GH_PAGES:-}" != "1" ]]; then
  echo "Refusing to force-push gh-pages." >&2
  echo "Set FORCE_LEGACY_GH_PAGES=1 if you intentionally need the legacy branch path." >&2
  exit 2
fi

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
git commit -m "Publish Innsigle microsite (legacy gh-pages break-glass)"
git remote add origin "https://github.com/DocumentDrivenDX/innsigle.git"
git push -f origin gh-pages
echo "Pushed gh-pages (legacy). Prefer Actions workflow deploy next time."
echo "Site: https://documentdrivendx.github.io/innsigle/"
rm -rf "$TMP"
