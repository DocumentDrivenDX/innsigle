#!/usr/bin/env bash
# Terminal demo for VHS screencast: Hugo + Innsigle init → publish → seal → VALID.
# Uses fake 1Password CLI so recording does not need a real vault.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$ROOT/node_modules/.bin:$PATH"

# Fixed work dir under /tmp for stable VHS tape paths
WORK="${INNSIGLE_HUGO_DEMO_DIR:-/tmp/innsigle-hugo-demo}"
rm -rf "$WORK"
mkdir -p "$WORK"

echo "==> Innsigle × Hugo (demo)"
echo "    workdir: $WORK"
echo

# Show help surface briefly
node "$ROOT/src/cli.mjs" 2>&1 | head -20 || true
echo

node "$ROOT/scripts/hugo-innsigle-workflow.mjs" --out-dir "$WORK" --keep
echo
echo "==> Tree (public well-known)"
find "$WORK/public/.well-known" -type f 2>/dev/null | head -20
echo
echo "==> Done. See .innsigle/AGENTS.md for wiring any other static site."
