---
title: CLI
nav: use
weight: 21
parent: use
description: Install and run Innsigle — keygen, claim, sign, verify.
---

# CLI

Get a small tool that can **declare how a file was made**, optionally **sign**
that declaration to the file bytes, and **verify** someone else’s seal. Node 20+.

## Install

Not on the public npm registry yet. Install from GitHub or a clone.

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

Running with no arguments prints the command list (exit code 1).

## Seal a page

```bash
innsigle keygen --out-dir ./keys
innsigle keys template \
  --issuer-id my-house --issuer-name "My House" \
  --public-key "$(cat keys/ed25519.pub.raw.b64url)" \
  --key-id "$(cat keys/key-id.txt)" \
  --out keys.json
# host keys.json at an absolute HTTPS URL (required in the claim)

innsigle colo example --kind model-primary > colo.json
# edit ingredients: name models, tools, human roles honestly

innsigle claim build --content ./page.html --colo colo.json \
  --issuer-id my-house --issuer-name "My House" \
  --key-id "$(cat keys/key-id.txt)" \
  --key-url https://example.com/.well-known/innsigle/keys.json \
  --out claim.json
innsigle sign --claim claim.json --key keys/ed25519.priv.pem --out att.json
innsigle verify --attestation att.json --content ./page.html --keys keys.json
```

Keep the private key offline. `key_url` must be an **absolute** URL—relative
paths are rejected.

### Check it (live sample)

What we claim: the microsite sample still verifies after install.

```bash
curl -sL -o page.html https://documentdrivendx.github.io/innsigle/sample/
curl -sL -o att.json https://documentdrivendx.github.io/innsigle/sample/.well-known/innsigle/claims/index.attestation.json
curl -sL -o keys.json https://documentdrivendx.github.io/innsigle/sample/.well-known/innsigle/keys.json
npx innsigle verify --attestation att.json --content page.html --keys keys.json
```

Expect: `VALID`.

## Other commands

| Command | Role |
|---------|------|
| `innsigle colo example --kind …` | Print example colophon JSON |
| `innsigle provenance build …` | Journal → detailed session provenance |
| `innsigle provenance propose-colo …` | Session record → draft colophon |

## Next

- [Seal a docs page](../walkthrough-docs/) — full walkthrough  
- [Issuer](../issuer/) — keys without a server  
- [Verify](../verify/) — what VALID means (and does not)  

Spec detail (flags, exit codes):  
[claim and CLI contract](../../reference/artifacts/contracts/contract-001-claim-and-cli/).
