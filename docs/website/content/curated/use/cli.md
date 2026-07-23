---
title: CLI
nav: use
weight: 21
parent: use
description: Innsigle command-line surface for keygen, claim, sign, and verify.
---

# CLI

Runnable distribution for the signed docs path (CONTRACT-001). Requires Node 20+.

```bash
node src/cli.mjs keygen --out-dir ./keys
node src/cli.mjs bill example --kind model-primary > bill.json
node src/cli.mjs claim build --content ./page.html --bill bill.json \
  --issuer-id azgaard --issuer-name Azgaard \
  --key-id "$(cat keys/key-id.txt)" \
  --key-url https://example.com/.well-known/innsigle/keys.json \
  --out claim.json
node src/cli.mjs sign --claim claim.json --key keys/ed25519.priv.pem --out att.json
node src/cli.mjs verify --attestation att.json --content ./page.html --keys keys.json
```

Exact flags and exit codes:
[CONTRACT-001](../../reference/artifacts/contracts/contract-001-claim-and-cli/)
(generated from the HELIX design tree).
