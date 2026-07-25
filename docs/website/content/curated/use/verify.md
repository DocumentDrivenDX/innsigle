---
title: Verify
nav: use
weight: 23
parent: use
description: What Innsigle verification checks — and what it does not.
---

# Verify

Verification checks crypto and content binding. It does not score truth or
detect AI.

## Hierarchy on a verify view

1. **Primary:** Signature valid or invalid; issuer id when valid. Or “unsigned declaration.”
2. **Secondary:** Composition and ingredient list (colophon).
3. **Tertiary:** Content fingerprint, timestamps, raw claim download.

## CLI checks

1. Load attestation + keys  
2. Issuer public key present and not revoked  
3. SHA-256 of content matches subject digest  
4. Ed25519 over SHA-256(JCS(payload))  

| Layer | What it answers |
|-------|-----------------|
| Crypto valid | Did this `key_id` seal this colophon for these bytes? |
| Discovery | Absolute `key_url` is inside the signed claim (ADR-003) |
| Recognized | Pin that fingerprint, and/or follow key-endorsements (transitive WoT) |

`issuer.id` is a display slug and may collide. Share and pin **fingerprints**.

Issuer documents live at any durable HTTPS URL (gist, Pages, free host). Social
bios can embed an **issuer card** for discovery; that is not a signature. See
[Issuer identity](../issuer/).

See [ADR-001](../../reference/artifacts/adrs/adr-001-signing-and-canonicalization/)
(crypto) and [ADR-003](../../reference/artifacts/adrs/adr-003-issuer-url-and-web-of-trust/)
(issuer URL and web of trust).
