#!/usr/bin/env bash
# Record Hugo × Innsigle walkthrough screencast into docs/website/static/captures/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v vhs >/dev/null 2>&1; then
  echo "error: vhs not found (https://github.com/charmbracelet/vhs)" >&2
  exit 1
fi
if ! command -v hugo >/dev/null 2>&1; then
  echo "error: hugo not found" >&2
  exit 1
fi

mkdir -p docs/website/static/captures
chmod +x scripts/demo-hugo-innsigle.sh

# Warm the workflow once so the tape's long Sleep is enough
echo "==> warm workflow"
bash scripts/demo-hugo-innsigle.sh >/tmp/innsigle-hugo-warm.log 2>&1 || {
  echo "warm failed:" >&2
  cat /tmp/innsigle-hugo-warm.log >&2
  exit 1
}

echo "==> vhs record"
vhs scripts/tapes/hugo-innsigle.tape

echo "==> outputs"
ls -la docs/website/static/captures/walkthrough-hugo.* 2>/dev/null || true
echo "ok: screencast assets under docs/website/static/captures/"
