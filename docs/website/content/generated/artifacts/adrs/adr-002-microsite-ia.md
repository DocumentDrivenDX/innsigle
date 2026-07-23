---
title: "ADR-002: Microsite information architecture and content pipeline"
slug: ADR-002-microsite-ia
activity: "Design"
source: "02-design/adrs/ADR-002-microsite-ia.md"
generated: true
supporting: false
collection: "adrs"
---

> **Generated from HELIX docs.** Source: `docs/helix/02-design/adrs/ADR-002-microsite-ia.md`. Edit the source, not this file or `site/` HTML.

<details><summary>Source frontmatter</summary>

```yaml
ddx:
  id: aibadge.adr.002
  type: adr
  links:
    - target: aibadge.prd
      kind: informed_by
    - target: aibadge.design-system
      kind: informed_by
status: accepted
activity: 02-design
created: 2026-07-23
```

</details>

# ADR-002: Microsite information architecture and content pipeline

| Date | Status | Deciders | Related | Confidence |
|------|--------|----------|---------|------------|
| 2026-07-23 | Accepted | Operator | product-microsite-ia concern; PRD brand site FRs | High |

## Context

| Aspect | Description |
|--------|-------------|
| Problem | Public site mixed hand HTML with specs; HELIX concern requires reader-mode IA and generated reference from artifact sources |
| Requirements | Auto-publish walkthroughs/specs/design docs/glossary from `docs/`; keep carefully curated copy outside the HELIX source tree (`docs/helix/`) |
| Drivers | product-microsite-ia; DESIGN.md voice; dual UC evaluate/start/operate paths |

## Decision

We will use a **two-layer content model**:

1. **Curated** product copy under `docs/website/content/curated/` (outside
   `docs/helix/`). Hand-authored Why / Use / Non-goals pages for evaluate and
   start reader modes.
2. **Generated** reference under `docs/website/content/generated/`, rebuilt
   deterministically from `docs/helix/` (and glossary sources) by
   `scripts/publish-artifacts.mjs`.
3. **Build** HTML into `site/` via `scripts/build-site.mjs` using DESIGN.md tokens
   and IA from `docs/website/ia.yml`.
4. **Top-level nav** separates: What it is (home) · Why · Use · Reference · Dogfood.

**Key points:** Curated ≠ generated | `site/` is output only | HELIX sources remain
authoritative for specs

## Alternatives

| Option | Pros | Cons | Evaluation |
|--------|------|------|------------|
| Hand-only static HTML in `site/` | Simple | Specs drift; violates microsite concern | Rejected |
| Full Hugo/Hextra like HELIX | Mature | Heavy for v0; dependency burden | Deferred |
| **Curated MD + generate artifacts → static build** | Matches concern; light deps | Custom builder | **Selected** |

## Consequences

| Type | Impact |
|------|--------|
| Positive | Specs stay in `docs/helix/`; site always regenerable; IA named by reader mode |
| Negative | Must run publish+build before deploy |
| Neutral | Dogfood and marks still synced as static assets |

## Risks

| Risk | Prob | Impact | Mitigation |
|------|------|--------|------------|
| Hand-edit generated HTML | M | M | Wipe `site/` content pages on build; README warnings |
| Nav hides core leaves | L | H | `ia.yml` core_leaves + concern quality gates |

## Validation

| Success Metric | Review Trigger |
|----------------|----------------|
| `npm run site:build` produces Why/Use/Reference + artifact pages | IA change |
| Generated artifact index groups by activity | HELIX tree reorg |

## Supersession

- **Supersedes:** None
- **Superseded by:** None

## Concern Impact

- Satisfies **product-microsite-ia** ADR requirement (IA model + content pipeline).
- Updates `concerns.md` practice for generated vs curated roots.

## References

- `docs/website/ia.yml`
- HELIX `workflows/concerns/product-microsite-ia/`
- HELIX `scripts/publish-artifacts.py` (pattern source)
