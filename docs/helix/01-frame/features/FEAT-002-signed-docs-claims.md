---
ddx:
  id: aibadge.feat.002
  type: feature-specification
  links:
    - target: aibadge.prd
      kind: informed_by
    - target: aibadge.contract.001
      kind: informed_by
    - target: aibadge.adr.001
      kind: informed_by
status: draft
activity: 01-frame
created: 2026-07-23
---

# Feature Specification: FEAT-002 — Signed documentation claims

**Feature ID**: FEAT-002  
**Status**: Specified  
**Priority**: P0  
**Owner**: Operator  
**Covered PRD Subsystem(s)**: UC-AI-docs; Sign and Verify; Tooling Distribution  
**Covered PRD Requirements**: FR-8–12, FR-18–19  
**Cross-Subsystem Rationale**: Docs placement, claim binding, and CLI verify are one vertical for UC-AI-docs.

## Overview

Operators publish static/HTML docs with an Innsigle, optional signed claim over
file bytes, and offline verify (CONTRACT-001 / ADR-001).

## Ideal Future State

Maker records mash bill (named models/tools), places footer seal, signs with a
local house key, publishes claim next to content. Third party verifies without
an account. Tamper fails closed.

## Problem Statement

- **Current situation**: CLI v0 + dogfood sample exist; need feature-level acceptance and walkthrough as product surface.
- **Pain points**: Docs lack portable signed BOM under maker control.
- **Desired outcome**: Documented happy path and automated tests for valid + mismatch.

## Requirements

### Functional

**DOC-01.** Maker publishes seal + bill on HTML/static page (inline or linked).  
**DOC-02.** Maker builds claim with content SHA-256 subject and mash bill including named tools.  
**DOC-03.** Maker signs with local Ed25519 key; private key never published.  
**DOC-04.** Verify succeeds when sig valid, key active, content digest matches.  
**DOC-05.** Verify fails closed on content mutation (exit 3) and bad signature (exit 2).  
**DOC-06.** Verify output never includes detection scores.

### Non-Functional

- Offline verify given claim + content + pubkey file.
- Golden vectors remain stable under ADR-001.

## Acceptance sketches

| ID | Scenario | Expect |
|----|----------|--------|
| DOC-04 | Golden vectors CLI verify | exit 0, VALID |
| DOC-05 | Wrong content file | exit 3 |
| DOC-01 | Dogfood page footer | Links to attestation; model-primary bill visible |

## Dependencies

- FEAT-001 composition language
- CONTRACT-001 CLI surface
