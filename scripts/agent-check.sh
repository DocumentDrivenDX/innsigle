#!/usr/bin/env bash
# Local agent gate — run before push so Deploy microsite does not fail on stale
# Playwright baselines or unit regressions.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

UPDATE_SNAPSHOTS=0
if [[ "${1:-}" == "--update-snapshots" ]] || [[ "${UPDATE_SNAPSHOTS:-}" == "1" ]]; then
  UPDATE_SNAPSHOTS=1
fi

# Force Playwright webServer rebuild (reuseExistingServer is off when CI is set).
export CI=true

# Fixed port 4173 (serve --no-port-switching). Fail clearly if busy — do not kill PIDs.
if command -v ss >/dev/null 2>&1; then
  if ss -ltn 2>/dev/null | grep -qE ':4173\b'; then
    echo "error: port 4173 is in use; free it before agent e2e (Playwright webServer)." >&2
    exit 1
  fi
elif command -v lsof >/dev/null 2>&1; then
  if lsof -iTCP:4173 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "error: port 4173 is in use; free it before agent e2e (Playwright webServer)." >&2
    exit 1
  fi
fi

echo "==> unit + provenance tests"
npm test

if [[ "$UPDATE_SNAPSHOTS" == "1" ]]; then
  echo "==> Playwright e2e (update baselines, CI=true)"
  npm run test:e2e:update
else
  echo "==> Playwright e2e (CI-mode, no snapshot write)"
  npm run test:e2e
fi

echo "==> agent checks green"
