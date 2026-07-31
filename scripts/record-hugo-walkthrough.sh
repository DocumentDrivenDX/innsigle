#!/usr/bin/env bash
# Record narrated Hugo × Innsigle walkthrough → docs/website/static/captures/
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
chmod +x scripts/prepare-hugo-demo.sh scripts/demo-hugo-innsigle.sh

echo "==> prepare demo site (init + hugo; seal runs in the tape)"
bash scripts/prepare-hugo-demo.sh

echo "==> vhs record"
vhs scripts/tapes/hugo-innsigle.tape

# Ship into site/ as well when present
if [[ -d site/captures ]]; then
  cp -a docs/website/static/captures/walkthrough-hugo.gif \
        docs/website/static/captures/walkthrough-hugo.mp4 \
        site/captures/
fi

echo "==> outputs"
ls -la docs/website/static/captures/walkthrough-hugo.* 2>/dev/null || true
if command -v ffprobe >/dev/null 2>&1; then
  ffprobe -v error -show_entries format=duration \
    -of default=noprint_wrappers=1:nokey=1 \
    docs/website/static/captures/walkthrough-hugo.mp4 2>/dev/null \
    | awk '{printf "mp4 duration: %.1fs\n", $1}'
fi
echo "ok: screencast under docs/website/static/captures/"
