---
title: Walkthrough: seal a docs page
nav: use
weight: 25
parent: use
description: Step-by-step path from colophon to verify for a docs page.
---

# Walkthrough: seal a docs page

You have a static HTML page (often model-drafted). You want a **model-primary**
colophon, a footer seal, and a claim someone can verify from local copies of the
page, attestation, and keys.

## Prerequisites

- Node 20+
- Innsigle CLI installed ([CLI](../cli/)):
 `npm install github:DocumentDrivenDX/innsigle` then `npx innsigle`,
 or clone and `npm install -g .` / `node src/cli.mjs`

Commands below use `innsigle`. From a clone without install, substitute
`node src/cli.mjs`.

## Steps

### 1. Draft and edit

Produce the page content (often a model draft). Optionally run **sloptimizer** on
prose. Do **not** change composition to human-authored because of that rewrite.

### 2. Write the colophon

```bash
innsigle colo example --kind model-primary > colo.json
# edit ingredients: name Claude, sloptimizer, human roles
```

### 3. Generate issuer keys (once)

```bash
innsigle keygen --out-dir ./keys
innsigle keys template \
 --issuer-id my-house --issuer-name "My House" \
 --public-key "$(cat keys/ed25519.pub.raw.b64url)" \
 --key-id "$(cat keys/key-id.txt)" \
 --out keys.json
```

Publish `keys.json` over HTTPS (or ship beside content for local demos). See
[Issuer](../issuer/).

### 4. Build claim and sign

```bash
innsigle claim build \
 --content ./page.html \
 --uri https://example.com/page/ \
 --colo colo.json \
 --issuer-id my-house --issuer-name "My House" \
 --key-id "$(cat keys/key-id.txt)" \
 --key-url https://example.com/.well-known/innsigle/keys.json \
 --out claim.json

innsigle sign \
 --claim claim.json \
 --key keys/ed25519.priv.pem \
 --out claim.attestation.json
```

Keep the private key offline (not in the site tree). `--key-url` must be
**absolute** `https://…`.

### 5. Place the seal

Footer (see `docs/sample/snippets/footer.html`): glyph + link to the attestation
or a colophon page. Use the **A** mark for model-primary ([Marks](../marks/)).

### 6. Verify

```bash
innsigle verify \
 --attestation claim.attestation.json \
 --content ./page.html \
 --keys keys.json
# expect VALID
```

Mutate the HTML and re-run: expect content mismatch (exit **3**).

### Check it (this site)

What we claim: the published sample is already sealed this way.

Live: [Sample](../../sample/) · curl recipe on [CLI](../cli/). Expect: `VALID`.

## Proof in this repo

- Sample page + attestation under `docs/sample/`
- Vectors: `tests/vectors/` on GitHub

## Spec

Feature note: [signed docs claims](../../reference/artifacts/features/feat-002-signed-docs-claims/)
