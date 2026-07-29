---
title: Verify
nav: use
weight: 23
parent: use
description: What Innsigle verification checks — and what it does not.
---

# Verify

Think of a signed Innsigle like a careful postage mark: it ties **who sealed**,
**what they declared about production**, and **which exact file** they sealed.
It is not a fact-checker and not an AI detector.

## What VALID means

When `innsigle verify` prints **VALID**:

1. The signature checks out for the issuer key  
2. The content SHA-256 matches the subject in the claim  
3. You can read the colophon (composition + ingredients) that was sealed  

When the page is only marked and **not** signed, treat it as a **declaration**—
still a valid use of the seal family, without cryptographic standing.

## What it does not mean

- The prose is true or complete  
- A platform or government certified the content  
- Models were or were not used beyond what the colophon declares  

### Check it

```bash
curl -sL -o page.html https://documentdrivendx.github.io/innsigle/sample/
curl -sL -o att.json https://documentdrivendx.github.io/innsigle/sample/.well-known/innsigle/claims/index.attestation.json
curl -sL -o keys.json https://documentdrivendx.github.io/innsigle/sample/.well-known/innsigle/keys.json
npx innsigle verify --attestation att.json --content page.html --keys keys.json
```

Expect: `VALID`. Live: [Sample](../../sample/).

## Hierarchy on a verify view

1. **Primary:** Signature valid or invalid; issuer when valid. Or “unsigned declaration.”  
2. **Secondary:** Composition and ingredient list (colophon).  
3. **Tertiary:** Content fingerprint, timestamps, raw claim download.  

## What the CLI checks

1. Load attestation + keys  
2. Issuer public key present and not revoked  
3. SHA-256 of content matches subject digest  
4. Ed25519 over the canonical claim payload  

| Layer | What it answers |
|-------|-----------------|
| Crypto valid | Did this key seal this colophon for these bytes? |
| Discovery | Absolute keys URL is inside the signed claim |
| Recognized | You pin that fingerprint, and/or follow key-endorsements |

`issuer.id` is a display slug and may collide. Prefer **fingerprints**.

Issuer documents can live on any durable HTTPS URL (gist, Pages, free host). A
social bio **issuer card** is discovery only—not a signature. See
[Issuer](../issuer/).

## Spec

Crypto: [ADR-001](../../reference/artifacts/adrs/adr-001-signing-and-canonicalization/).  
Issuer URL and web of trust: [ADR-003](../../reference/artifacts/adrs/adr-003-issuer-url-and-web-of-trust/).
