---
title: Verify
nav: use
weight: 23
parent: use
description: What Innsigle verification checks — and what it does not.
---

# Verify

Verification checks crypto and content binding—not truth, purity, or detection
scores.

## Hierarchy on a verify view

1. **Primary:** Signature valid or invalid; issuer id when valid. Or “unsigned declaration.”
2. **Secondary:** Composition and ingredient list (mash bill).
3. **Tertiary:** Content fingerprint, timestamps, raw claim download.

## CLI checks

1. Load attestation + keys  
2. Issuer public key present and not revoked  
3. SHA-256 of content matches subject digest  
4. Ed25519 over SHA-256(JCS(payload))  

Trust policy (whether you accept the issuer) is separate from crypto validity
(SLSA / PGP lesson). See
[ADR-001](../../reference/artifacts/adrs/adr-001-signing-and-canonicalization/).
