---
title: Walkthrough — seal a docs page
nav: use
weight: 25
parent: use
description: Step-by-step UC-AI-docs path from colophon to verify.
---

# Walkthrough: seal a docs page

**Reader mode:** Start. **Feature:** FEAT-002. **Use case:** UC-AI-docs.

## Goal

Publish a static HTML page with a model-primary colophon and a signed claim a
third party can verify offline.

## Prerequisites

- Node 20+
- Clone of [DocumentDrivenDX/innsigle](https://github.com/DocumentDrivenDX/innsigle)

## Steps

### 1. Draft and edit

Produce the page content (often model draft). Optionally run **sloptimizer** on
prose. Do **not** change composition to human-authored because of that rewrite.

### 2. Write the colophon (colo)

```bash
node src/cli.mjs colo example --kind model-primary > colo.json
# edit ingredients: name Claude, sloptimizer, human roles
```

### 3. Generate issuer keys (once)

```bash
node src/cli.mjs keygen --out-dir ./keys
node src/cli.mjs keys template \
  --issuer-id my-house --issuer-name "My House" \
  --public-key "$(cat keys/ed25519.pub.raw.b64url)" \
  --key-id "$(cat keys/key-id.txt)" \
  --out keys.json
```

Publish `keys.json` over HTTPS (or ship beside content for the sample).

### 4. Build claim and sign

```bash
node src/cli.mjs claim build \
  --content ./page.html \
  --uri https://example.com/page/ \
  --colo colo.json \
  --issuer-id my-house --issuer-name "My House" \
  --key-id "$(cat keys/key-id.txt)" \
  --key-url https://example.com/.well-known/innsigle/keys.json \
  --out claim.json

node src/cli.mjs sign \
  --claim claim.json \
  --key keys/ed25519.priv.pem \
  --out claim.attestation.json
```

Keep the private key offline (not in the site tree).

### 5. Place the seal

Footer (see `docs/sample/snippets/footer.html`): glyph + link to the attestation
or a colophon page. Use the **A** mark for model-primary.

### 6. Verify

```bash
node src/cli.mjs verify \
  --attestation claim.attestation.json \
  --content ./page.html \
  --keys keys.json
# expect VALID
```

Mutate the HTML and re-run: expect content mismatch (exit 3).

## Proof in this repo

- Sample: [Sample](../../sample/)
- Vectors: `tests/vectors/` on GitHub

## Captures

Drop screenshots into `docs/website/static/captures/` (e.g.
`walkthrough-docs-verify.png`) and link them here when recorded.
