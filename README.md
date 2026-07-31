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
true`). Install from this GitHub repo or a local clone.

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
