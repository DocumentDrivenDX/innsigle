# Innsigle

Craft seal for content colophons: declare how work was made (human / mixed /
model-primary), optionally sign with a house or person key (DKIM-like), and
verify. Not an AI detector. Not a C2PA replacement.

**Say:** INN-siggle (rhymes with *single*).

**Site:** [documentdrivendx.github.io/innsigle](https://documentdrivendx.github.io/innsigle/)
(GitHub Pages via **Actions** — workflow `Deploy microsite`).

Content pipeline (HELIX **product-microsite-ia**):

| Layer | Path |
|-------|------|
| Curated copy | `docs/website/content/curated/` |
| Generated from HELIX | `docs/website/content/generated/` ← `docs/helix/` |
| Build output | `site/` (artifact; CI deploys it) |

```bash
npm run site:build          # publish artifacts + HTML (local)
npm run test:e2e            # Playwright: links + design-voice screenshots
git push origin main        # primary publish: Actions tests + deploys Pages
# gh workflow run "Deploy microsite"   # manual re-run
```

Do **not** use `scripts/publish-site.sh` for normal deploys (emergency legacy
`gh-pages` only; requires `FORCE_LEGACY_GH_PAGES=1`).

## CLI (v0)

Requires Node 20+.

```bash
node src/cli.mjs keygen --out-dir ./keys
# create keys.json via: keys template …
node src/cli.mjs colo example --kind model-primary > colo.json
node src/cli.mjs claim build --content ./page.html --colo colo.json \
  --issuer-id azgaard --issuer-name Azgaard \
  --key-id "$(cat keys/key-id.txt)" \
  --key-url https://example.com/.well-known/innsigle/keys.json \
  --out claim.json
node src/cli.mjs sign --claim claim.json --key keys/ed25519.priv.pem --out att.json
node src/cli.mjs verify --attestation att.json --content ./page.html --keys keys.json
```

```bash
npm test
```

## Dogfood

Static sample page with footer seal and signed claim:

- Page: [`docs/dogfood/index.html`](docs/dogfood/index.html)
- Attestation: `docs/dogfood/.well-known/innsigle/claims/index.attestation.json`
- Marks: `docs/dogfood/assets/marks/`
- Footer snippet: `docs/dogfood/snippets/footer.html`

```bash
node src/cli.mjs verify \
  --attestation docs/dogfood/.well-known/innsigle/claims/index.attestation.json \
  --content docs/dogfood/index.html \
  --keys docs/dogfood/.well-known/innsigle/keys.json
```

## Golden vectors

See [`tests/vectors/README.md`](tests/vectors/README.md). Regenerate only when
crypto/schema changes: `npm run vectors`.

## Specs

HELIX docs under `docs/helix/`. Normative claim/CLI surface:
`docs/helix/02-design/contracts/CONTRACT-001-claim-and-cli.md`. Signing:
`docs/helix/02-design/adrs/ADR-001-signing-and-canonicalization.md`.
