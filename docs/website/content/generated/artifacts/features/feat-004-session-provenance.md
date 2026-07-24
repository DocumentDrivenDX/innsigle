---
title: "Feature Specification: FEAT-004 — Automatic session provenance"
slug: FEAT-004-session-provenance
activity: "Frame"
source: "01-frame/features/FEAT-004-session-provenance.md"
generated: true
supporting: false
collection: "features"
---

> **Generated from HELIX docs.** Source: `docs/helix/01-frame/features/FEAT-004-session-provenance.md`. Edit the source, not this file or `site/` HTML.

<details><summary>Source frontmatter</summary>

```yaml
ddx:
  id: aibadge.feat.004
  type: feature-specification
  links:
    - target: aibadge.prd
      kind: informed_by
    - target: aibadge.feat.002
      kind: informed_by
    - target: aibadge.design.session-provenance
      kind: informed_by
    - target: aibadge.contract.001
      kind: informs
    - target: aibadge.adr.001
      kind: informed_by
    - target: aibadge.adr.003
      kind: informed_by
status: draft
activity: 01-frame
created: 2026-07-24
```

</details>

# Feature Specification: FEAT-004 — Automatic session provenance

**Feature ID**: FEAT-004  
**Status**: Specified (P1 implemented: CLI + fixture multi-agent driver)  
**Priority**: P1 (after FEAT-001–003 core path)  
**Owner**: Operator  
**Covered PRD Subsystem(s)**: UC-AI-docs; Tooling; Sign and Verify  
**Covered PRD Requirements**: FR-1–4a, FR-8–12, FR-18–19 (extends with automation)  
**Cross-Subsystem Rationale**: Agent/skill capture feeds colo + optional signed claim without laundering authorship.

## Overview

When an agent (e.g. Claude) with an Innsigle-aware skill produces a file, the
system can **automatically capture** session metrics and tool/model/skill use,
**propose** a detailed colophon, and **optionally** publish + sign provenance
bound to the content digest.

## Ideal Future State

Operator enables a skill. After a session that writes `page.md`, they run (or
the skill offers) “build provenance → propose colo → review → sign.” Public
claim includes composition, named tools, prompt counts, and a link/digest to a
session provenance document. Verify still fails closed on content tamper.
Transcripts stay local unless explicitly published.

## Problem Statement

- **Current situation**: Colo is hand-authored; sample is static; no harness integration.  
- **Pain points**: Detailed “how many prompts / which skill” is lost; manual bills under-specify agent work.  
- **Desired outcome**: Spec + schemas + phased CLI/skill path for automatic L2 provenance and L1 colo proposal.

## Requirements

### Functional

**PROV-01.** System defines a **session provenance** document (L2) with metrics including at least `user_prompts`, models, skills/tools, and primary artifact digests.  
**PROV-02.** Capturing skill/harness records a local structured journal of session events.  
**PROV-03.** Tooling builds L2 from journal with redaction of secrets before any publish path.  
**PROV-04.** Tooling proposes colo (L1) from L2 including named models/tools and capturing skill; composition suggestion is conservative (FR-4a).  
**PROV-05.** Operator review is required before publish or sign.  
**PROV-06.** Colo MAY reference L2 via `provenance.uri` + `provenance.digest` (JCS+SHA-256).  
**PROV-07.** Claim/sign/verify of content remains ADR-001/CONTRACT-001; L2 optional to verify.  
**PROV-08.** Auto-publish of L2 and auto-sign are **off** by default.  
**PROV-09.** Published L2 MUST NOT require raw transcript bodies; transcript URI is opt-in.  
**PROV-10.** Skill MUST NOT set `human-authored` solely due to rewrite/cleanup tools.

### Non-Functional

- Works without Innsigle-hosted cloud.  
- L2 publish uses same host classes as ADR-003 D7 (gist/Pages/free HTTPS).  
- Golden tests for propose-colo from fixture journal.

## Acceptance sketches

| ID | Scenario | Expect |
|----|----------|--------|
| PROV-04 | Fixture journal: 5 user prompts, Claude, file write | Colo lists model + skill; `user_prompts` reflected in L2; composition ≠ human-authored if model wrote content |
| PROV-05 | Skill offers sign without review | Blocked / requires confirm |
| PROV-06 | L2 bytes changed after claim | Provenance digest mismatch when checked |
| PROV-10 | Journal includes sloptimizer only | Composition not upgraded to human-authored |

## Dependencies

- FEAT-001 colo language  
- FEAT-002 claim/sign/verify  
- ADR-001 / ADR-003  
- `docs/helix/02-design/session-provenance.md`  

## Out of scope (this FEAT)

- Full multi-harness support day one (one reference harness is enough for P2)  
- Real-time streaming provenance UI  
- Court-grade forensic logs  
