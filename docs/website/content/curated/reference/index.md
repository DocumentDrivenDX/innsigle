---
title: Reference
nav: reference
weight: 30
description: Generated specs, design docs, and glossary from the docs tree.
---

# Reference

Exact behavior and governing documents. Most pages here are **generated** from
`docs/helix/` (and related docs sources). Edit the source files under `docs/`,
not the generated HTML under `site/`.

## Core catalogs

| Catalog | Source |
|---------|--------|
| [Artifacts](artifacts/) | `docs/helix/**` HELIX activity tree |
| [Glossary](glossary/) | Terms from claim system + DESIGN |
| Contracts & ADRs | Nested under Artifacts → Design |

## Curated vs generated

| Kind | Lives in | Rebuild |
|------|----------|---------|
| Curated product copy | `docs/website/content/curated/` | Hand-edited |
| Generated reference | `docs/website/content/generated/` | `npm run site:publish` |
| Deployable HTML | `site/` | `npm run site:build` |

Walkthroughs, captures, and design screenshots land in
`docs/website/static/captures/` and link from Use pages without mixing into
HELIX artifact sources.
