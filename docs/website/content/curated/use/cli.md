---
title: CLI
nav: use
weight: 21
parent: use
description: Install and run Innsigle — keygen, claim, sign, verify.
---

# CLI

**Innsigle** ships as a Node 20+ command-line tool (`innsigle`). It implements
CONTRACT-001: colophon examples, claim build, Ed25519 sign/verify, and session
provenance helpers.

## Install

Not on the npm registry yet. Install from GitHub or a clone.

### From GitHub

```bash
npm install github:DocumentDrivenDX/innsigle
npx innsigle
# or: ./node_modules/.bin/innsigle
```

Global (optional):

```bash
npm install -g github:DocumentDrivenDX/innsigle
innsigle
```

### From a clone

```bash
git clone https://github.com/DocumentDrivenDX/innsigle.git
cd innsigle
npm install -g .    # or: npm link
innsigle
```

Without installing the bin, from the repo root:

```bash
node src/cli.mjs
```

Usage with no arguments prints the command list (exit code 1).

## Seal a page (happy path)

```bash
innsigle keygen --out-dir ./keys
innsigle keys template \
  --issuer-id my-house --issuer-name "My House" \
  --public-key "$(cat keys/ed25519.pub.raw.b64url)" \
  --key-id "$(cat keys/key-id.txt)" \
  --out keys.json
# host keys.json at an absolute HTTPS URL

innsigle colo example --kind model-primary > colo.json
innsigle claim build --content ./page.html --colo colo.json \
  --issuer-id my-house --issuer-name "My House" \
  --key-id "$(cat keys/key-id.txt)" \
  --key-url https://example.com/.well-known/innsigle/keys.json \
  --out claim.json
innsigle sign --claim claim.json --key keys/ed25519.priv.pem --out att.json
innsigle verify --attestation att.json --content ./page.html --keys keys.json
```

`key_url` must be an **absolute** URL (ADR-003). Keep the private key offline.

## Other verbs

| Command | Role |
|---------|------|
| `innsigle colo example --kind …` | Print example colophon JSON |
| `innsigle provenance build …` | Journal → L2 session provenance |
| `innsigle provenance propose-colo …` | L2 → draft colophon |

## Next

- [Seal a docs page](../walkthrough-docs/) — full UC-AI-docs walkthrough  
- [Issuer](../issuer/) — keys without a server  
- [Verify](../verify/) — what VALID means  
- [CONTRACT-001](../../reference/artifacts/contracts/contract-001-claim-and-cli/) — flags and exit codes  
