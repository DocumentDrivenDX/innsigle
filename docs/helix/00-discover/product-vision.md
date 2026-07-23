---
ddx:
  id: aibadge.product-vision
  type: product-vision
  links:
    - target: aibadge.research.prior-art
      kind: informed_by
    - target: aibadge.research.naming
      kind: informed_by
status: draft
naming: locked
product_name: Innsigle
etymon: innsigli
concept: signet
composition_metaphor: mash-bill
house_affinity: azgaard
repo_slug: aibadge
activity: 00-discover
created: 2026-07-22
updated: 2026-07-22
---

# Product Vision

> **Innsigle** (say **INN-siggle**, rhymes with *single*). Etymon ON/Icelandic
> *innsigli* (document seal). House: Azgaard. Repo slug: `aibadge` (rename optional).
>
> **Decisions locked:** visual seal is the primary brand surface; origin is a
> **mash bill** (how the work was made: human / AI / mixed / tools), not a moral
> grade; cryptographic **signet** (hash + sign + who sealed it) is optional depth.
> Not an AI detector. Not a C2PA replacement.

## Mission Statement

Give makers a seal that states how a work was made and, when they choose, who
signed that statement.

## Positioning

For writers, designers, and small publishers who need readers to see *how* a
work was made without trusting platform labels or AI detectors, Innsigle is a
content-origin seal: a visible mark for a mash bill, plus optional DKIM-style
signing. Unlike Not By AI (human-only, self-asserted stickers) and unlike C2PA
Content Credentials (media-pipeline manifests), Innsigle is brand-first and
composition-first: human, AI, and mixed work use the same seal family; signing
answers who sealed the claim, not whether a detector scored the file.

## Vision

Sites and posts carry a small Innsigle people learn by sight. The mark points to
a short mash bill (ingredients of making). If signed, one step shows content
fingerprint match and the signer. Unsigned marks still show the bill. Readers
do not get purity scores or detection percentages.

**North Star:** Within 24 months of public launch, ≥50% of surveyed readers in
two launch niches (independent blogs; small agency sites) describe the mark as
how-the-work-was-made / composition, not as "AI bad" or "human pure"; and ≥25%
of public Innsigles expose a working verify path to a named maker or house
(aligns with PRD metrics; survey instrument TBD).

## User Experience

Alex publishes an essay. They record a mash bill: human draft and edit, model
outline, one image-model figure. They put the Innsigle in the footer. For the
canonical URL they may sign: tooling hashes the text, attaches bill and time,
signs with Alex's key (or an Azgaard house key). A reader opens the seal: bill,
fingerprint match if signed, who sealed it. No account required for an unsigned
mark.

## Target Market

| Attribute | Description |
|-----------|-------------|
| Who | Writers, designers, studios, and publishers roughly solo to ~50 people who publish on the open web and care how work is made (including house brands such as Azgaard) |
| Pain | Origin signals are human-only stickers, ignored footnotes, platform labels, or heavy media provenance; mixed work has no peer craft mark |
| Current Solution | Not By AI-style badges, disclaimers, platform labels, silence, occasional C2PA on images |
| Why They Switch | Need a portable composition mark they control; disclosure pressure is rising (e.g. EU AI Act Art. 50 from 2 Aug 2026) without adopting detector products |

## Key Value Propositions

| Value Proposition | Customer Benefit |
|-------------------|------------------|
| Mash bill (composition states + tools) | One frame for human, AI, and mixed work; no required purity hierarchy |
| Optional signed claim (content hash + bill + signer) | Reader can check who sealed the claim; fails closed if content or key does not match |
| Visual seal + portable assets | Recognition on the maker's site, not only inside one platform UI |

## Success Definition

| Metric | Target |
|--------|--------|
| Primary KPI | ≥50% of surveyed readers in two named niches (independent blogs; small agency sites) describe the mark as composition / how-made, 12–24 months after public brand launch; survey method named at launch |
| Attribution depth | ≥25% of public Innsigles in year one offer a working verify path to a named maker or house |
| Category integrity | Zero public product claims of AI detection accuracy; copy separates declared bill and signed seal from detected fact |
| Adoption | Dense use on operator properties plus a small craft cohort in year one, *or* ≥1,000 distinct publishing origins; PRD may tighten |

## Why Now

Model vendors and C2PA ship file-level provenance (Content Credentials, SynthID).
Platforms apply their own labels. EU AI Act Article 50 transparency duties apply
from 2 August 2026. Human-only badge culture showed demand for a visible mark but
left mixed and AI-using work without a peer language. Distilling already names
recipe without moralizing (mash bill). Digital makers still lack a craft seal that
does that job and optionally binds the claim to a person or house.
