# Innsigle

**The maker's seal for published work.** Content provenance for the AI era:
declare how work was made (human / mixed / model-primary) with a short colophon,
optionally sign with a house or person key, and verify.

Same seal family for model-primary docs and human social posts. Not an AI
detector. Not a C2PA replacement — see the site Non-goals page.

**Say:** INN-siggle (rhymes with *single*).

**Site:** [documentdrivendx.github.io/innsigle](https://documentdrivendx.github.io/innsigle/)

## Install

Requires **Node 20+**. The CLI is not published to the npm registry yet (`private:
true`); the planned npm name is `innsigle`. Install from this GitHub repo or a
local clone, or run one-off without installing:

```bash
npx --package=github:DocumentDrivenDX/innsigle innsigle
```

### From GitHub (recommended for users)

```bash
# project-local
npm install github:DocumentDrivenDX/innsigle

# then run via npx or the local bin
npx innsigle
./node_modules/.bin/innsigle
```

```bash
# global (optional)
npm install -g github:DocumentDrivenDX/innsigle
innsigle
```

### From a clone (contributors / offline)

```bash
git clone https://github.com/DocumentDrivenDX/innsigle.git
cd innsigle
npm install -g .          # or: npm link
innsigle
# without installing the bin:
node src/cli.mjs
```

Check the tool:

```bash
innsigle                  # prints usage (exit 1)
innsigle colo example --kind model-primary
```

## Quick start (repo house key + 1Password)

One-time per repo. Requires the [1Password CLI](https://developer.1password.com/docs/cli/get-started/) (`op`) signed in.

```bash
cd your-site-repo
innsigle init --onepassword --site-url https://example.com
```

This writes **only** under **`.innsigle/`** (Innsigle does not guess Quarto/Hugo/etc.):

1. Ed25519 house key → **private** half in 1Password (Secure Note)
2. **`.innsigle/config.json`** — fingerprint, `key_url`, `op://…` ref (commit-safe)
3. **`.innsigle/public/keys.json`** — public issuer document to publish
4. **`.innsigle/AGENTS.md`** — how agents should copy that tree into a site build

**Your** build (or an agent following `AGENTS.md`) must publish:

```text
.innsigle/public/  →  <site-root>/.well-known/innsigle/
```

Then seal content (issuer + 1Password from `.innsigle/config.json`):

```bash
innsigle seal ./page.html          # claim+sign → .innsigle/public/claims/
innsigle verify ./page.html        # finds att + keys from .innsigle/
```

### Manual keygen (no 1Password)

```bash
innsigle keygen --out-dir ./keys
innsigle keys template \
  --issuer-id my-house --issuer-name "My House" \
  --public-key "$(cat keys/ed25519.pub.raw.b64url)" \
  --key-id "$(cat keys/key-id.txt)" \
  --out keys.json
# publish keys.json at an absolute HTTPS URL (key_url below)

innsigle colo example --kind model-primary > colo.json
innsigle claim build \
  --content ./page.html \
  --colo colo.json \
  --issuer-id my-house --issuer-name "My House" \
  --key-id "$(cat keys/key-id.txt)" \
  --key-url https://example.com/.well-known/innsigle/keys.json \
  --out claim.json

innsigle sign --claim claim.json --key keys/ed25519.priv.pem --out att.json
innsigle verify --attestation att.json --content ./page.html --keys keys.json
```

Keep private keys offline (1Password or local PEM). Full walkthrough:
[Seal a docs page](https://documentdrivendx.github.io/innsigle/use/walkthrough-docs/).

### 1Password across a VM boundary

When `op` lives on the host (e.g. sealing from a Linux VM with keys on the
Mac side):

```bash
export INNSIGLE_OP_BIN="mac op"   # command to reach the host op (split on whitespace)
export OP_ACCOUNT=<account>       # or: innsigle seal … --op-account <account>
```

## Everyday commands

```bash
innsigle status                        # each claim: VALID / STALE / ORPHAN / AMBIGUOUS / UNSEALED
innsigle verify --all                  # CI gate: exits nonzero on any non-VALID
innsigle seal --stale                  # re-seal only drifted claims
innsigle seal ./post/index.qmd --auto  # colophon proposed from agent transcripts, review, seal
innsigle seal ./post/index.qmd --auto --save-colo   # write proposal to colo.json, don't seal
innsigle provenance sync ./post/index.qmd           # transcripts → .innsigle/provenance/<slug>.l2.json
innsigle provenance import claude-code session.jsonl --out journal.jsonl  # one transcript → journal
```

`seal` also honors a content-adjacent `colo.json`: `--colo` →
`<content-dir>/colo.json` → `.innsigle/colo.json` → `--kind`.

## Automatic colophons from agent sessions

Your Claude Code transcripts already record who wrote what.
`innsigle provenance sync <content-file>` finds the repo's transcripts
(`~/.claude/projects/<cwd with every non-alphanumeric character → "-">/`,
e.g. `/home/erik/my.site` → `-home-erik-my-site`), imports every session whose file
writes touched the content file — summaries and counts only, never message
bodies — merges them, and writes `.innsigle/provenance/<slug>.l2.json`.
Re-running after more conversation folds in new sessions; the provenance
accumulates.

`innsigle seal <file> --auto` runs that sync, prints the proposed colophon
(composition, ingredients, prompt count, and — when transcripts carry char
evidence — the declared `human_input` percent), and seals only after you confirm
(`--yes` skips the prompt; `--save-colo` writes the proposal to
`<content-dir>/colo.json` for editing instead of sealing). The review gate and
the no-laundering refusal stay on: `--force-composition` will not turn model
work into `human-authored`. The L2 is never auto-published; once you publish
it yourself, `--provenance-uri <uri>` embeds the link and digest in the claim.

### Human-input percent (optional, CONTRACT-001 v1.1)

A colophon MAY carry `human_input`: an integer percent of human input computed
from the maker's own session journal by method `hi1` (direction 25 ·
contribution 40 · review 35). The raw counts ride along, so the headline is
recomputable — `seal`/`claim build` refuse a percent that does not recompute
from its own counts (exit 5), and `verify` prints
`human_input=NN% (declared, method hi1)`. No journal char evidence → no
percent (omitted, never invented). It is a maker declaration, not an AI
detection score. See the shape:

```bash
innsigle colo example --kind model-primary --human-input
```

Spec: `docs/helix/02-design/session-provenance.md` ("Human-input measure
(hi1)") and CONTRACT-001 v1.1. Quarto footers render it as
"model-primary · **48% human input**" (`integrations/quarto/README.md`).

Agent-side: install the `innsigle-seal` Claude Code skill from
[`skills/innsigle-seal/`](skills/innsigle-seal/README.md).

## Verify the live sample

```bash
# with CLI installed
curl -sL -o page.html https://documentdrivendx.github.io/innsigle/sample/
curl -sL -o att.json https://documentdrivendx.github.io/innsigle/sample/.well-known/innsigle/claims/index.attestation.json
curl -sL -o keys.json https://documentdrivendx.github.io/innsigle/sample/.well-known/innsigle/keys.json
innsigle verify --attestation att.json --content page.html --keys keys.json
```

From a clone without install:

```bash
node src/cli.mjs verify \
  --attestation docs/sample/.well-known/innsigle/claims/index.attestation.json \
  --content docs/sample/index.html \
  --keys docs/sample/.well-known/innsigle/keys.json
```

## Docs

| Topic | Where |
|-------|--------|
| Install + CLI | [Use → CLI](https://documentdrivendx.github.io/innsigle/use/cli/) |
| Walkthroughs | [Use](https://documentdrivendx.github.io/innsigle/use/) |
| Claim/CLI contract | [CONTRACT-001](https://documentdrivendx.github.io/innsigle/reference/artifacts/contracts/contract-001-claim-and-cli/) |
| Quarto integration | [`integrations/quarto/README.md`](integrations/quarto/README.md) |
| Agent sealing skill | [`skills/innsigle-seal/`](skills/innsigle-seal/README.md) |
| Golden crypto vectors | [`tests/vectors/`](tests/vectors/) |

## Contributor notes

Content pipeline (HELIX **product-microsite-ia**):

| Layer | Path |
|-------|------|
| Curated copy | `docs/website/content/curated/` |
| Generated from HELIX | `docs/website/content/generated/` ← `docs/helix/` |
| Build output | `site/` (CI deploys it) |

```bash
npm test                    # unit + install/CLI smoke (+ Hugo workflow if hugo on PATH)
npm run test:hugo           # Hugo × Innsigle e2e only
npm run test:agent          # unit + Playwright e2e (set CI=true)
npm run test:agent:update   # refresh screenshot baselines after UI changes
npm run record:hugo-walkthrough  # VHS screencast → docs/website/static/captures/
npm run site:build:local    # build site with BASE=
git push origin main        # Actions tests + Deploy microsite
```

Do **not** use `scripts/publish-site.sh` for normal deploys (legacy `gh-pages`
only; requires `FORCE_LEGACY_GH_PAGES=1`).

Specs: `docs/helix/`. Signing: ADR-001. Issuer URL: ADR-003.
