#!/usr/bin/env bash
# Terminal demo for VHS screencast: paced, narrated Hugo + Innsigle path.
# Uses fake 1Password CLI so recording does not need a real vault.
#
# Env:
#   INNSIGLE_DEMO_PACE=1   sleep between steps (default when stdout is a TTY)
#   INNSIGLE_HUGO_DEMO_DIR work dir (default /tmp/innsigle-hugo-demo)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$ROOT/node_modules/.bin:$PATH"

WORK="${INNSIGLE_HUGO_DEMO_DIR:-/tmp/innsigle-hugo-demo}"
CLI=(node "$ROOT/src/cli.mjs")
WORKFLOW=(node "$ROOT/scripts/hugo-innsigle-workflow.mjs")

pace() {
  local sec="${1:-1.2}"
  if [[ "${INNSIGLE_DEMO_PACE:-}" == "1" ]] || [[ "${INNSIGLE_DEMO_PACE:-}" == "true" ]]; then
    sleep "$sec"
  elif [[ -t 1 && -z "${INNSIGLE_DEMO_PACE:-}" ]]; then
    # interactive terminal: gentle default pace
    sleep "$sec"
  fi
}

banner() {
  echo
  echo "────────────────────────────────────────────────────────"
  echo "  $*"
  echo "────────────────────────────────────────────────────────"
  echo
}

narrate() {
  # Spoken-style lines for the screencast (not shell comments alone).
  echo "  → $*"
}

# ── open ──────────────────────────────────────────────────────────
clear 2>/dev/null || true
banner "Innsigle × Hugo"
narrate "Seal a trivial Hugo homepage with a 1Password house key."
narrate "Innsigle writes only under .innsigle/ — your build copies public files."
narrate "This recording uses a stub op; real runs need: op signin"
pace 2.5

# ── step 1 ────────────────────────────────────────────────────────
banner "Step 1 of 4 — Bootstrap Hugo + init --onepassword"
narrate "Generate an Ed25519 house key (private half stays in 1Password)."
narrate "Write .innsigle/config.json, public keys staging, and AGENTS.md."
pace 2.0

rm -rf "$WORK"
mkdir -p "$WORK"
narrate "Running the automated workflow into $WORK …"
pace 1.0
"${WORKFLOW[@]}" --out-dir "$WORK" --keep
pace 2.0

# ── step 2 ────────────────────────────────────────────────────────
banner "Step 2 of 4 — What landed in .innsigle/"
narrate "config.json holds key_id, key_url, and the op:// private-key ref."
narrate "public/ is the only tree you must publish."
pace 1.5
echo "\$ ls -la $WORK/.innsigle/"
ls -la "$WORK/.innsigle/"
pace 2.0
echo
echo "\$ ls -la $WORK/.innsigle/public/"
ls -la "$WORK/.innsigle/public/"
pace 2.0
echo
narrate "Issuer fingerprint and publish copy rule from config:"
echo "\$ node -e '…print key_id and publish.copy…'"
node -e "
const c=require('$WORK/.innsigle/config.json');
console.log('  key_id:     ', c.issuer.key_id);
console.log('  key_url:    ', c.issuer.key_url);
console.log('  op ref:     ', c.onepassword.private_key_ref);
console.log('  copy from:  ', c.publish.copy.from);
console.log('  copy to:    ', c.publish.copy.to);
"
pace 3.0

# ── step 3 ────────────────────────────────────────────────────────
banner "Step 3 of 4 — Hugo has the well-known tree"
narrate "The workflow copied .innsigle/public → static/.well-known/innsigle/"
narrate "After hugo, keys and claims sit under public/.well-known/innsigle/"
pace 2.0
echo "\$ find $WORK/public/.well-known -type f"
find "$WORK/public/.well-known" -type f | sort
pace 2.5

# ── step 4 ────────────────────────────────────────────────────────
banner "Step 4 of 4 — Seal + verify (short commands)"
narrate "After init, everyday ops are two words plus a path."
narrate "seal reads .innsigle/config.json and the 1Password key ref."
pace 2.0
echo "\$ innsigle seal public/index.html"
echo "\$ innsigle verify public/index.html"
# Already sealed by the workflow; re-check with short verify:
"${CLI[@]}" verify "$WORK/public/index.html"
pace 2.5

# ── close ─────────────────────────────────────────────────────────
banner "Agent rule (any static site)"
narrate "After init, follow .innsigle/AGENTS.md — do not teach Innsigle about Hugo."
pace 1.2
echo "\$ head -16 $WORK/.innsigle/AGENTS.md"
head -16 "$WORK/.innsigle/AGENTS.md"
pace 3.5

echo
narrate "Done. Live walkthrough: documentdrivendx.github.io/innsigle/use/walkthrough-hugo/"
echo
pace 2.0
