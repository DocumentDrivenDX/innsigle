---
ddx:
  id: aibadge.adr.001
  type: adr
  links:
    - target: aibadge.design.claim-system
      kind: informed_by
    - target: aibadge.design.attestation-prior-art
      kind: informed_by
    - target: aibadge.prd
      kind: informed_by
status: accepted
activity: 02-design
created: 2026-07-22
---

# ADR-001: Signing algorithm and payload canonicalization

| Date | Status | Deciders | Related | Confidence |
|------|--------|----------|---------|------------|
| 2026-07-22 | Accepted | Operator | PRD FR-9–12; claim-system.md | High |

## Context

| Aspect | Description |
|--------|-------------|
| Problem | Claim attestations need a frozen crypto suite and deterministic bytes to sign so independent verifiers agree |
| Current State | claim-system.md proposed Ed25519 + SHA-256 + simple JSON envelope without a decision record |
| Requirements | Offline verify; local long-lived house keys; no mandatory Sigstore/OIDC in v1 |
| Decision Drivers | Simplicity for craft makers; wide library support; alignment with in-toto/DSSE later without blocking v1 |

## Decision

We will use **Ed25519** signatures over the **SHA-256** digest of a **canonical JSON** claim payload, carried in a simple Innsigle attestation envelope. Content subjects use **SHA-256** digests of the bytes the operator designates as canonical for that subject.

**Key Points:** Ed25519 for issuer keys | SHA-256 for content and payload digests | RFC 8785-style JCS canonicalization for JSON payloads | OpenPGP packets and DSSE/in-toto export deferred

## Alternatives

| Option | Pros | Cons | Evaluation |
|--------|------|------|------------|
| OpenPGP packets + cleartext/detached sig | WoT tooling exists | Heavy UX; variable implementations | Rejected for v1 |
| Sigstore keyless only | No long-lived keys | OIDC dependency; not house craft default | Rejected as sole path; optional later |
| ECDSA P-256 | Common in web PKI | Larger; no advantage for us | Rejected |
| **Ed25519 + SHA-256 + JCS** | Small keys; deterministic; simple | Need careful JSON rules | **Selected** |
| Embed C2PA as only format | Industry media path | Social strip; media-first | Rejected as sole path |

## Consequences

| Type | Impact |
|------|--------|
| Positive | Implementable with sodium/WebCrypto/libsodium; clear verify steps; no CA required |
| Negative | Not natively cosign-compatible until export path; must document JCS carefully |
| Neutral | Type URI host can change without changing crypto |

## Risks

| Risk | Prob | Impact | Mitigation |
|------|------|--------|------------|
| Canonicalization bugs cause false invalid | M | H | Golden test vectors in repo; Contract examples |
| HTML page hashing ambiguity | M | H | Contract: hash exact file bytes operator passes; no silent HTML rewrite in v1 |

## Validation

| Success Metric | Review Trigger |
|----------------|----------------|
| Independent verify of golden attestation succeeds on two runtimes | Any change to alg or canonicalization |
| Mutated content fails closed | Softening of fail-closed behavior |

## Supersession

- **Supersedes:** None
- **Superseded by:** None

## Concern Impact

- **Practice:** Strengthens `key-custody` and crypto testing practices; no slot change.
- Update concerns overrides only if key storage path is standardized later.

## References

- `docs/helix/02-design/claim-system.md`
- `docs/helix/02-design/attestation-prior-art.md`
- RFC 8785 JSON Canonicalization Scheme (JCS)
- PRD FR-9–12
