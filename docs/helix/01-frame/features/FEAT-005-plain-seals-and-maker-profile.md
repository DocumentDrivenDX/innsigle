---
ddx:
  id: innsigle.feat.005
  type: feature-specification
  links:
    - target: innsigle.prd
      kind: informed_by
    - target: innsigle.feat.001
      kind: informed_by
    - target: innsigle.feat.003
      kind: informed_by
    - target: innsigle.adr.003
      kind: informed_by
    - target: innsigle.contract.001
      kind: informs
status: draft
activity: 01-frame
created: 2026-09-15
---

# Feature Specification: FEAT-005 — Plain seals and maker profile

**Feature ID**: FEAT-005
**Status**: Specified (implemented: profile schema, CLI, site builder, sample page, tests)
**Priority**: P1
**Owner**: Operator
**Covered PRD Subsystem(s)**: UC-human-social (generalized to email / Docs / slides); Visual Seal System; Tooling
**Covered PRD Requirements**: FR-1–7, FR-13–16, FR-18; principle 5 (signet optional)
**Cross-Subsystem Rationale**: Daily surfaces have no stable bytes. Plain seals reuse the colophon vocabulary without CONTRACT-001 digest/sign. The maker profile is the one bio URL.

## Overview

Makers need to declare how a Google Doc, slide deck, or email was made without
running `keygen` or hashing a file that will mutate. They also need **one URL**
for X, LinkedIn, and Slack bios.

## Ideal Future State

A maker opens the profile builder (or `innsigle profile`), names themselves,
adds a work (title, URL, H/M/A), copies a footer line into the Doc, and
publishes a static page. Bios point at that page. Keys and `innsigle seal`
remain a later ladder, not a prerequisite. Verify never prints VALID for a
plain seal.

## Problem Statement

- **Current situation**: CLI and issuer card assume keys, a gist of `keys.json`, and byte-stable subjects.
- **Pain points**: Office/email/Docs users cannot start; bios have room for one link; signed claims do not fit living documents.
- **Desired outcome**: Unsigned plain seals + a Linktree-style profile page + builder, with tests and CI so the path stays honest (unsigned ≠ VALID, no authorship laundering).

## Requirements

### Functional

**PLAIN-01.** A plain seal carries composition + ingredients + subject title/URI. It MUST NOT require a content digest or issuer key.
**PLAIN-02.** Type URI `https://innsigle.dev/claim/plain-colophon/v1`. Distinct from CONTRACT-001 colophon claims.
**PLAIN-03.** `innsigle verify` MUST refuse plain seals and maker profiles (exit 5). It MUST NOT print `VALID` for them.
**PLAIN-04.** `human-authored` MUST NOT list a `kind: model` ingredient (FR-4a).
**PLAIN-05.** Product copy on the profile MUST label rows **Unsigned declaration**, never VALID / verified authentic.

**PROF-01.** A maker profile (`innsigle_profile: "1"`) lists identity, optional social links, optional issuer discovery, and `works[]` of plain seals.
**PROF-02.** CLI: `profile init|add|render|footer|bio|validate`. No 1Password. No `.innsigle/` required.
**PROF-03.** Site builder on `/use/profile/` produces `profile.json` and standalone `index.html` in the browser (same renderer as CLI).
**PROF-04.** Sample profile ships at `/examples/profile/` and is regenerated at site build from fixture JSON.
**PROF-05.** Bio card is name + profile URL. Issuer fingerprint is optional discovery on the same page, not a substitute for verify.
**PROF-06.** Footer line for a work: `Innsigle · {composition} · {host}#{slug}`.

### Non-Functional

- Profile HTML is self-contained (inline CSS; marks via href or inline SVG).
- `src/profile.mjs` has no `node:` imports so the browser builder can load it.
- Unsigned path completes without Node when using the site builder.

## Acceptance sketches

| ID | Scenario | Expect |
|----|----------|--------|
| PLAIN-03 | `innsigle verify --attestation plain.json ...` | exit 5; no VALID |
| PLAIN-04 | add work human-authored + model ingredient | refused |
| PROF-02 | `profile init` then `add` then `render` | index.html contains Unsigned declaration and the work title |
| PROF-03 | Playwright fills the builder | preview shows name + unsigned; download JSON validates |
| PROF-04 | site build | `/examples/profile/` exists; no `\bVALID\b` |

## Dependencies

- FEAT-001 composition language and mark pack
- FEAT-003 social discovery (profile URL replaces raw keys.json in bios)
- ADR-003 D7 (profile is discovery; crypto still lives in signed claims)
