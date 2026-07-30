---
title: Reference
nav: reference
weight: 30
description: Generated specs, design docs, and glossary from the docs tree.
---

# Reference

This is the **exact-behavior** shelf: contracts, design notes, and a glossary.
Most pages here are **generated** from `docs/helix/` so implementers and
auditors can read the same text as the source tree.

If you want the friendly product path first, start at [Home](../) or
[Use](../use/). Come here when you need flags, schemas, or ADR decisions.

## Core catalogs

| Catalog | What you get |
|---------|----------------|
| [Artifacts](artifacts/) | Product vision, PRD, ADRs, contracts, feature notes |
| [Glossary](glossary/) | Seal, colophon, claim, maker, signet, and related terms |
| Contracts & ADRs | Nested under Artifacts → Design |

## Curated vs generated

| Kind | Lives in | Rebuild |
|------|----------|---------|
| Curated product copy | `docs/website/content/curated/` | Hand-edited |
| Generated reference | `docs/website/content/generated/` | `npm run site:publish` |
| Deployable HTML | `site/` | `npm run site:build` |

Edit sources under `docs/`, not the generated HTML under `site/`.

## Proof of the product path

Friendly docs can drift; these stay checkable:

- Live [sample](../sample/) — sealed page, re-verify with the CLI  
- [CLAIM-MAP](https://github.com/DocumentDrivenDX/innsigle/blob/main/docs/website/CLAIM-MAP.md) — public claims and proofs  
- Golden vectors in `tests/vectors/` on GitHub  

Walkthroughs and screenshots live under Use (`docs/website/static/captures/`) so
they do not mix into the generated reference tree.
