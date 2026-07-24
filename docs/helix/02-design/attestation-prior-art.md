---
ddx:
  id: aibadge.design.attestation-prior-art
  type: research-note
  links:
    - target: aibadge.competitive-analysis
      kind: informed_by
    - target: aibadge.prd
      kind: informs
status: draft
activity: 02-design
created: 2026-07-22
---

# Attestation and Trust Prior Art

**Purpose:** Ground Innsigle signing, key discovery, and trust posture in open
systems that already solve related jobs. Not a product competitor list (see
`competitive-analysis.md`); a design inventory for claim envelopes, trust
graphs, and storage.

## Summary for design

| Source | Steal | Do not copy wholesale |
|--------|-------|------------------------|
| **PGP web of trust** | User-chosen trust; key signs key (identity vouch); no single CA required | Full global strongset UX; keysigning-party friction as the only path |
| **OpenPGP / GnuPG** | Detached signatures over content; fingerprint as identity handle | Email-era keyserver spam and UX collapse |
| **DKIM** | Domain publishes pubkey; signature over message; receivers verify "domain authorized this" | Domain-only identity (we need person/house too) |
| **in-toto attestations** | Subject (artifact) + predicate (claim type) + signed envelope | Software-build layout complexity as v1 |
| **SLSA provenance** | Provenance = how it was built, not "true content" | CI builder levels as product surface |
| **Sigstore / cosign** | Optional keyless path later; transparency log ideas; cosign-style verify UX | Mandatory OIDC/cloud for v1 house keys |
| **C2PA** | Signed assertions about content; tamper-evident; optional identity | Media-file embedding as only store; CA-heavy trust |
| **Keyoxide / Keybase-class** | Proofs that bind keys to public profiles (domain, social) | Centralized identity product as v1 dependency |
| **SBOM (SPDX/CycloneDX)** | Bill-of-materials metaphor and field discipline | Software-component graph as the only colophon shape |

**Innsigle v1 posture:** local long-lived keys (PGP/DKIM spirit) + claim shaped
like a small in-toto predicate about *composition* + storage that works for
HTML docs without media embedding + trust that starts as "I fetched this house
pubkey from a URL I chose" (not full WoT). WoT-style cross-signatures are a
later optional graph, not launch blockers.

## PGP web of trust

### What it is

OpenPGP binds a public key to an identity string. Other users **sign keys** to
vouch for that binding. Each user sets **ownertrust** (how much they trust a
key's owner to introduce others). Validity of a key for you is computed from
signatures and your trust settings. Alternative to hierarchical PKI/CAs: every
user can be a mini-CA for people they actually know.

### Mechanics that matter

- **Certification signature:** Alice signs Bob's key → "I believe this key is Bob's."
- **Ownertrust:** Alice marks Bob fully/marginally trusted as an introducer.
- **Validity:** Calculated from intro path length and trust levels (classic model:
  one full trust path or multiple marginal paths).
- **Keysigning parties / out-of-band check:** Fingerprint verification before
  signing (in person or careful remote).
- **Multiple webs:** No single global trust root; overlapping webs.

### Failures (design lessons)

- UX and key management burden limited mainstream use.
- Keyservers and spam eroded trust in discovery.
- Indirect trust paths are hard for non-experts to interpret.
- "Valid key" ≠ "this email content is true."

### Apply to Innsigle

| PGP idea | Innsigle mapping (v1 / later) |
|----------|--------------------------------|
| Key fingerprint | House/person key id shown on verify |
| Detached sig over data | Sign claim envelope + content hash |
| Ownertrust | Verifier pin set (local policy) |
| Key certification | **ADR-003:** house A signs key-endorsement of house B; listed at A's issuer URL |
| No claim of content truth | Same: seal is declaration + crypto, not oracle |

v1 **requires** absolute `key_url` inside every signed claim (ADR-003). v1
**allows** optional key-endorsement lists for transitive recognition. v1 does
**not** require a global keyserver or that every verifier enable WoT. WoT is for
*identity of signers*, not for colophon field honesty.

## DKIM (email)

Already in product thesis. Domain publishes selector pubkey (DNS TXT); signature
headers bind body hash to domain. Receivers verify authorization, not honesty of
the email body.

**Apply:** Content hash + claim + signer key; discovery via HTTPS URL or
well-known path first; DNS TXT as optional later discovery (DKIM-like for
domains that want it).

## in-toto attestations

### Model

- **Subject:** artifact(s) identified by digest.
- **Predicate:** typed claim (`predicateType` URI) with structured body.
- **Statement:** subject + predicate.
- **Attestation:** statement inside a signed envelope (often DSSE).

SLSA provenance is one predicate type: how software was built (source, builder,
materials). Explicitly *not* "the binary is free of vulnerabilities."

### Apply to Innsigle

Colophon + composition fits a **custom predicate type**, e.g.:

`https://innsigle.dev/attestation/colophon/v1`

Subject = content digest(s). Predicate = colophon fields. Envelope = signature
by house/person key.

Reuse the *shape* (subject/predicate/envelope) even if v1 ships a simpler JSON
file before full DSSE/in-toto tooling.

## SLSA

Framework of levels and provenance expectations for supply chains. Teaches:
separate **provenance** (how produced) from **trust policy** (what the verifier
accepts). Innsigle should keep the same split: crypto validity vs policy
("do I trust Azgaard's key for docs?").

## Sigstore

Cosign, Fulcio (OIDC short-lived certs), Rekor (transparency log). Strength:
low key-management friction for CI. Risk for v1 craft house: dependency on
public infrastructure and OIDC.

**Apply:** Document as P2 path for CI-signed releases of the Innsigle CLI or
for users who refuse long-lived keys. Not the only path; long-lived house keys
remain first-class (PGP/DKIM spirit).

## C2PA (trust model note)

Signed manifests; trust often via certificate chains and trust lists, not PGP
WoT. Assertions are richer than our colophon. Privacy reviews stress identity
and tracking risks.

**Apply:** Optional export bridge later; do not make CA membership a v1
requirement for a personal house seal.

## Profile-bound keys (Keyoxide and kin)

Projects that prove control of domain/social accounts and bind them to OpenPGP
or similar keys. Useful mental model for "this key is Azgaard" without a CA.

**Apply:** v1 pubkey at `https://…/.well-known/innsigle/keys.json` or profile
URL; later optional proofs that the same key controls a domain or forge.

## SBOM

SPDX / CycloneDX list components of software. Colophon is the narrative cousin:
components of *making* (models, tools, human roles), not package graph.

**Apply:** Field discipline (typed ingredients, versions when known); do not
require full SBOM tooling for content seals.

## Trust model spectrum (design choice)

```text
CA hierarchy (X.509)     Web of trust (PGP)     Trust-on-first-use / pin
        |                        |                        |
   industrial C2PA          later Innsigle           Innsigle v1 default
   enterprise PKI           optional graph           "I trust this URL's key"
```

**v1 default:** TOFU / explicit pin of house pubkey URL.  
**Later:** optional cross-signatures between houses (WoT light).  
**Avoid for craft makers:** mandatory commercial CA for every personal seal.

## Open questions from prior art

- Envelope: custom JSON + Ed25519 vs DSSE + in-toto from day one?
- Key format: raw Ed25519, JWK, or OpenPGP packets?
- Transparency log: none in v1, optional Rekor-like later?
- Cross-sign vocabulary: only keys, or also "I trust their colophons"?

## References (anchors)

- OpenPGP web of trust concepts (PGP/GnuPG; Wikipedia "Web of trust"; Zimmermann lineage)
- in-toto attestation framework; SLSA provenance as predicate
- Sigstore (cosign, keyless, transparency)
- C2PA / CAI (signed content credentials)
- DKIM (domain-authorized mail signatures)
- SBOM formats (SPDX, CycloneDX) as BOM discipline analogues
