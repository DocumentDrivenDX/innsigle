---
ddx:
  id: aibadge.feat.003
  type: feature-specification
  links:
    - target: aibadge.prd
      kind: informed_by
    - target: aibadge.feat.001
      kind: informed_by
status: draft
activity: 01-frame
created: 2026-07-23
---

# Feature Specification: FEAT-003 — Human social mark pattern

**Feature ID**: FEAT-003  
**Status**: Specified  
**Priority**: P0  
**Owner**: Operator  
**Covered PRD Subsystem(s)**: UC-human-social  
**Covered PRD Requirements**: FR-13, FR-14, FR-15  
**Cross-Subsystem Rationale**: None — single subsystem.

## Overview

Makers mark short social posts as human-authored using the same seal family as
docs, without depending on platform-preserved file metadata.

## Ideal Future State

Operator attaches or includes the H-cue Innsigle mark (image and/or link). Viewers
can open a short explanation URL. Unsigned is valid. Mark is not a separate
“purity brand.”

## Problem Statement

- **Current situation**: Mark SVGs exist; social placement pattern needs productized guidance and walkthrough.
- **Pain points**: C2PA/EXIF die on X-class platforms; human posts need a visible maker-controlled cue.
- **Desired outcome**: Documented social pack + caption pattern + same-family rule.

## Requirements

### Functional

**SOC-01.** Human-authored mark asset (H cue) available as SVG/PNG path.  
**SOC-02.** Placement pattern does not require surviving C2PA/EXIF on the platform.  
**SOC-03.** Pattern includes viewer path to meaning (profile/site/short URL).  
**SOC-04.** Per-post signature is optional; unsigned human marks allowed.  
**SOC-05.** Social mark uses same seal family as docs (not a fork brand).

### Non-Functional

- Caption/template text stays under ~280 chars for X when including URL.

## Acceptance sketches

| ID | Scenario | Expect |
|----|----------|--------|
| SOC-02 | Platform strips metadata | Mark still visible as image/link |
| SOC-05 | Compare H and A assets | Shared outer geometry; cue differs |

## Dependencies

- FEAT-001 seal family
