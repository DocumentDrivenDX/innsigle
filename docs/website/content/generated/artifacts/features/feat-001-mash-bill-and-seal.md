---
title: "Feature Specification: FEAT-001 — Mash bill and seal mark"
slug: FEAT-001-mash-bill-and-seal
activity: "Frame"
source: "01-frame/features/FEAT-001-mash-bill-and-seal.md"
generated: true
supporting: false
collection: "features"
---

> **Generated from HELIX docs.** Source: `docs/helix/01-frame/features/FEAT-001-mash-bill-and-seal.md`. Edit the source, not this file or `site/` HTML.

<details><summary>Source frontmatter</summary>

```yaml
ddx:
  id: aibadge.feat.001
  type: feature-specification
  links:
    - target: aibadge.prd
      kind: informed_by
    - target: aibadge.design-system
      kind: informs
status: draft
activity: 01-frame
created: 2026-07-23
```

</details>

# Feature Specification: FEAT-001 — Mash bill and seal mark

**Feature ID**: FEAT-001  
**Status**: Specified  
**Priority**: P0  
**Owner**: Operator  
**Covered PRD Subsystem(s)**: Mash Bill Model; Visual Seal System  
**Covered PRD Requirements**: FR-1, FR-2, FR-3, FR-4, FR-4a, FR-5, FR-6, FR-7  
**Cross-Subsystem Rationale**: Composition language and mark family are one capability; the mark is the visual projection of the bill.

## Overview

Makers need one composition vocabulary and one seal family for human-authored,
mixed, and model-primary work—without purity coding or detector language.

## Ideal Future State

A reader sees an Innsigle mark, opens the mash bill, and understands how the work
was made (ingredients and roles). Model names can appear as credit. Editorial
tools appear as tools, not as proof of human authorship.

## Problem Statement

- **Current situation**: Human-only badges and industrial media labels exist; dual composition under one brand does not.
- **Pain points**: Mixed and model-primary work lack a peer mark language.
- **Desired outcome**: Stable composition enum + ingredient list + H/M/A seal family ship with guidelines.

## Requirements

### Functional

**BILL-01.** System defines composition values `human-authored`, `mixed`, `model-primary`.  
**BILL-02.** Mash bill lists ingredients with `kind` in `model|tool|human|other` and required `name`.  
**BILL-03.** Guidelines forbid ranking compositions as better/worse in required fields.  
**BILL-04.** Editorial rewrite alone MUST NOT change composition to `human-authored` (FR-4a).  
**SEAL-01.** SVG seal family ships with base + H + M + A cues.  
**SEAL-02.** Placement guidance covers docs footer and social mark/link patterns.  
**SEAL-03.** Mark chrome forbids verified-true / purity traffic-light motifs.

### Non-Functional

- Marks readable at 24–32px monochrome.
- State not communicated by color alone (a11y).

## Acceptance sketches

| ID | Scenario | Expect |
|----|----------|--------|
| BILL-04 | Model draft + sloptimizer | Composition stays `model-primary`; tool listed |
| SEAL-01 | Open mark pack | Four SVGs same family, distinct cues |

## Dependencies

- CONTRACT-001 schema fields for mash_bill
- DESIGN.md mark anatomy
