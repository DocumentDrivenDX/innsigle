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

echo "==> unit + provenance tests"
npm test

if [[ "$UPDATE_SNAPSHOTS" == "1" ]]; then
  echo "==> Playwright e2e (update baselines)"
  npm run test:e2e:update
else
  echo "==> Playwright e2e (CI-mode, no snapshot write)"
  CI=true npm run test:e2e
fi

echo "==> agent checks green"
