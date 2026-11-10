---
ddx:
  id: innsigle.feat.006
  type: feature-specification
  links:
    - target: innsigle.prd
      kind: informed_by
    - target: innsigle.feat.001
      kind: informed_by
    - target: innsigle.feat.004
      kind: informed_by
    - target: innsigle.adr.004
      kind: informed_by
    - target: innsigle.adr.005
      kind: informed_by
    - target: innsigle.contract.001
      kind: informs
status: draft
activity: 01-frame
created: 2026-11-10
---

# Feature Specification: FEAT-006 — Human review and derivation

**Feature ID**: FEAT-006
**Status**: Specified and implemented (0.7.0)
**Priority**: P1
**Covered PRD Requirements**: FR-21–FR-25 (added with this feature); FR-4a, FR-10, FR-12; PROV-05
**Design**: ADR-005; CONTRACT-001 v1.2

## Overview

A seal says how content was made. A reader, or a CI gate, also needs to know
whether an identified human read it. Today a `model-primary` page sealed by a
build key verifies `VALID` with no human involved. FEAT-006 adds a signed
**review** claim, distinct from composition, that survives a build step via a
signed **derivation** claim.

## Ideal Future State

A publisher of machine-authored briefs commits seals next to the content. A
person runs `innsigle review --stale`, reads the changed documents, and signs.
CI runs `innsigle verify --all --require-review` and fails the build if any
document lacks a valid, unexpired human review. After the site build, CI's build
key signs a derivation per output; `innsigle verify --derived site/` proves that
each published file was built from a document a human reviewed, using only the
published `.well-known/innsigle/` files.

## Requirements

- **FR-21** A review claim binds one human-role key to one content digest, with
  optional name, scope and expiry. It is a separate claim type and never alters
  a declared composition (FR-4a). Build-role keys cannot produce one.
- **FR-22** Any edit to the content makes its review stale; an elapsed
  `expires_at` makes it expired. `status` reports REVIEWED / UNREVIEWED /
  REVIEW-STALE / REVIEW-EXPIRED (and REVIEW-INVALID with a reason).
- **FR-23** `verify --all --require-review` exits nonzero when any in-scope
  claim lacks a valid, unexpired human review. Existing commands, exit codes
  and attestation files keep working unchanged.
- **FR-24** A derivation claim, signed by an endorsed build key, states that
  output digest O was built from source digest(s) D, embedding the human
  review(s) of D verbatim. Verification fails if any link is missing, stale,
  expired, or signed by the wrong role. A bundle requires every source reviewed;
  one claim may cover several outputs.
- **FR-25** Authorship and review live in one attestation file per document,
  each claim signed by its own key; sealing never drops a review. Documents may
  be keyed by a stable front-matter id so a rename does not orphan the seal.
- **PROV-05 (extended)** Signing a review requires explicit operator
  confirmation.

## Acceptance

| Case | Expected |
|------|----------|
| Review a model-primary doc | Accepted; authorship payload and signature byte-identical; composition still `model-primary` |
| Edit reviewed doc | `REVIEW-STALE`; `--require-review` exits 6 |
| Build-role reseal after edit | `reviews[]` retained, stale |
| Review forged with build key | `REVIEW-INVALID(wrong_role)` |
| Review past `expires_at` | `REVIEW-EXPIRED`; gate exits 6 |
| Output built from reviewed source | `verify --derived` exits 0 |
| Output edited / derivation re-signed by human key / review missing, stale, expired or build-signed / build key unendorsed | exits 3 / 4 / 6 / 6 / 6 / 4 |
| Bundle with one unreviewed source | exits 6 |
| `git mv` of an id-keyed document | seal and review still found |
