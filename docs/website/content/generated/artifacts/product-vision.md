---
title: "Product Vision"
slug: product-vision
activity: "Discover"
source: "00-discover/product-vision.md"
generated: true
supporting: false
---

> **Generated from HELIX docs.** Source: `docs/helix/00-discover/product-vision.md`. Edit the source, not this file or `site/` HTML.

<details><summary>Source frontmatter</summary>

```yaml
ddx:
  id: aibadge.product-vision
  type: product-vision
  links:
    - target: aibadge.research.prior-art
      kind: informed_by
    - target: aibadge.research.naming
      kind: informed_by
    - target: aibadge.competitive-analysis
      kind: informed_by
status: draft
naming: locked
product_name: Innsigle
etymon: innsigli
concept: signet
composition_metaphor: colophon
house_affinity: azgaard
repo_slug: aibadge
activity: 00-discover
created: 2026-07-22
updated: 2026-07-22
```

</details>

# Product Vision

> **Innsigle** (say **INN-siggle**, rhymes with *single*). Etymon ON/Icelandic
> *innsigli* (document seal). House: Azgaard. Repo slug: `aibadge`.
>
> **Thesis:** One seal family for two jobs makers actually have: (1) sign
> long-lived docs with a colophon that can *name models proudly*; (2) mark
> short social posts as human-authored when platforms strip metadata. Not a
> detector. Not a C2PA replacement. Visual seal first; optional house/person
> signature second.

## Mission Statement

Let makers seal how work was made (human, model-heavy, or mixed) and when they
choose, bind that bill to a person or house others can verify.

## Positioning

For operators who ship documentation sites and short social posts and need
origin under *their* control, Innsigle is a content-origin seal: a visible mark
plus a colophon (recipe of making), with optional DKIM-style signing.

Unlike Not By AI, model-generated work is first-class and can credit tools by
name. Unlike C2PA Content Credentials and SynthID, the primary surface is
maker brand and claims for web text and social, not vendor watermarks or
media-pipeline manifests (those may interop later).

## Vision

Docs sites show an Innsigle that opens to a signed colophon: e.g. mostly
Claude (or other named models), human review, house key. Social posts show a
sibling mark that reads as human-authored without implying AI is shameful
elsewhere. Same system, different bills. Readers learn the seal by sight;
verify (when signed) answers who sealed the claim for which content bytes.

**North Star:** Within 24 months of public launch, operator live samples covers both
primary use cases on real properties; ≥50% of surveyed readers in docs and
social-adjacent samples describe the mark as composition / how-made; ≥25% of
public sealed docs expose a working verify path to a named maker or house.

## User Experience

**UC-AI-docs (documentation site).** Erik publishes a HELIX-style microsite
mostly drafted by Claude, with human structure/edit and often a **sloptimizer**
pass (Easel skill: tighten AI-shaped prose; it does not score authorship). He
records a colophon: composition `model-primary`, tools Claude + sloptimizer
(if used) + human edit, then signs with an Azgaard house key over the canonical
page. Footer carries the Innsigle. Reader opens it: named tools, fingerprint
match, Azgaard as signer. No detection score. Prose that *reads* cleaner after
sloptimizer stays model-primary on the bill.

**UC-human-social (X / similar).** Erik posts a short thread he wrote himself.
He attaches or includes the human-authored Innsigle mark (image or compact
link pattern that survives platforms stripping file metadata). Viewers see
human composition; optional verify URL is available but signing may be omitted
when the post is ephemeral. Same seal family as the docs site, not a separate
"purity brand."

## Target Market

| Attribute | Description |
|-----------|-------------|
| Who | Operators and small houses who publish owned docs/sites and public social (starting with the Innsigle/Azgaard operator); then writers and studios with the same dual channel |
| Pain | AI docs have no proud, signed BOM; human social has no portable mark that survives metadata strip; industrial provenance does not fit either channel well |
| Current Solution | Not By AI (human only), footers, platform labels, C2PA/SynthID on some images, silence |
| Why They Switch | One system for both channels; maker-controlled claims; model credit without shame; human credit without abandoning AI docs |

## Key Value Propositions

| Value Proposition | Customer Benefit |
|-------------------|------------------|
| Dual-channel composition seal | Docs (AI-primary) and social (human-primary) share one mark language |
| Colophon with named tools (models and editorial tooling) | "Claude + sloptimizer + human edit" as credit, not confession or laundering |
| Optional house/person signet | Verify who sealed the bill for durable content |
| Social-safe mark pattern | Human claim remains visible when C2PA-style metadata is gone |

## Success Definition

| Metric | Target |
|--------|--------|
| Dual-use live samples | Both UC-AI-docs and UC-human-social live on operator properties within first public release cycle |
| Composition literacy | ≥50% surveyed readers describe mark as how-made / composition (niches: docs visitors; social viewers of marked posts) |
| Docs verify depth | ≥25% of public sealed *documentation* pages offer working verify to a named house or person |
| Category integrity | Zero product claims of AI detection accuracy |

## Why Now

Vendors stack C2PA (rich, fragile) and SynthID (durable, sparse) for *images*.
Platforms label AI media. Human-only badges ignore model-heavy docs. Operators
who build methodology sites with models and still post human writing on X fall
between those stools. EU AI Act Art. 50 (from 2 Aug 2026) increases disclosure
pressure without giving makers a dual-channel craft seal. Innsigle targets that
gap: colophon + mark + optional signature under maker control.
