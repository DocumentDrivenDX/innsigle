---
title: "Competitive Analysis: Content Origin Labeling and Provenance"
slug: competitive-analysis
activity: "Discover"
source: "00-discover/competitive-analysis.md"
generated: true
supporting: false
---

> **Generated from HELIX docs.** Source: `docs/helix/00-discover/competitive-analysis.md`. Edit the source, not this file or `site/` HTML.

<details><summary>Source frontmatter</summary>

```yaml
ddx:
  id: aibadge.competitive-analysis
  type: competitive-analysis
  links:
    - target: aibadge.research.prior-art
      kind: informed_by
    - target: aibadge.product-vision
      kind: informs
    - target: aibadge.prd
      kind: informs
status: draft
activity: 00-discover
created: 2026-07-22
```

</details>

# Competitive Analysis: Content Origin Labeling and Provenance

**Scope:** Technologies and products that label, watermark, or cryptographically
attest how digital content was made, or who stands behind a claim about it.  
**Operator use cases under test:**

1. **UC-AI-docs:** Long-lived documentation sites (e.g. HELIX microsite): mostly
   model-generated; maker wants a signed colophon that *proudly* names tools
   (e.g. Claude) and binds the claim to a house or person.
2. **UC-human-social:** Short posts on X/Twitter and similar: maker wants it
   clear the words are human-authored, under their control, not a platform
   "Made with AI" stamp or a purity cult badge alone.

## Market Landscape

| Attribute | Assessment |
|-----------|------------|
| Market Maturity | Emerging / fragmenting: industrial standards, vendor watermarks, and DIY badges coexist; no single consumer mental model |
| Key Trends | Layered AI-image labeling (C2PA + SynthID); EU AI Act Art. 50 transparency (from 2 Aug 2026); human-only badge movements; platform-side labels |
| Entry Barriers | Low for badges and claim formats; high for becoming the media-industry default (C2PA coalition + camera OEMs) |
| Buyer Power | High for individual makers (many free substitutes); low influence over platform strip of metadata |

## Layer map (what competes for the same job)

| Layer | Job | Examples | Fits UC-AI-docs? | Fits UC-human-social? |
|-------|-----|----------|------------------|------------------------|
| A. Craft / social badge | Visible origin story the maker chooses | Not By AI, ad-hoc footers | Partial (no proud-AI peer) | Partial (human-only, no crypto) |
| B. Signed media provenance | Tamper-evident file history | C2PA Content Credentials, CAI SDK | Partial (docs/images if file-bound; heavy) | Weak (uploads strip metadata; text posts lack files) |
| C. Model-side watermark | Survive distribution without rich payload | SynthID, Meta Video Seal | Weak (vendor, not maker BOM) | Weak (no human-authored path) |
| D. Metadata taxonomy | Structured source codes in EXIF/IPTC/XMP | IPTC `digitalSourceType` | Partial (vocabulary only) | Weak (stripped on social) |
| E. Platform disclosure | Site labels AI media | Meta, others | N/A | Platform-owned, not portable |
| F. Detectors | Guess AI vs human | Various classifiers | No (wrong job) | No (wrong job) |
| G. Prose quality / AI-tell edit | Detect or rewrite AI-shaped writing patterns | **Sloptimizer** (`easel-skills`) | Complementary (edit step, not origin seal) | Complementary (does not declare human authorship) |

**Thesis implication:** UC-AI-docs needs A+B-like *maker* signing with a rich
BOM (not only vendor watermark). UC-human-social needs A that survives
metadata death (visible mark + outlink), with human composition first-class.
No incumbent owns both as one brand system.

### Adjacent: Sloptimizer (complement, not rival)

Source: `/home/erik/Projects/easel-skills/skills/sloptimizer` (Easel skill;
Vale-backed detect / rewrite / validate). Shared house context with HELIX/DDx
sample.

| Dimension | Sloptimizer | Innsigle |
|-----------|-------------|----------|
| Job | Remove AI-isms, filler, unsupported claims; harden specs | Declare colophon; optional sign who sealed it |
| Authorship score | Explicitly **does not** claim text was written by AI | Explicitly **is not** a detector |
| Output | Cleaner prose / executable work items | Mark + bill + optional signature |
| UC-AI-docs fit | Post-generate edit pass before publish | Seal names models (e.g. Claude) **and** can list editorial tools |
| UC-human-social fit | Optional polish if human draft has AI-tell patterns | Human-authored mark only when composition is actually human |

**Pipeline (sample target for methodology docs):**

```text
model draft (Claude, …) → sloptimizer detect|rewrite|validate → Innsigle colophon
  (model-primary + named tools + human roles + optional "sloptimizer" tool line)
  → house sign → publish site
```

**Hard boundary (product integrity):** A sloptimizer rewrite does **not** turn
model-primary text into `human-authored` for Innsigle. Sounding less AI is a
prose outcome; composition state tracks **how the words were produced**, not how
human they read after edit. Mislabeling AI→sloptimizer text as human is a
category violation (same class as detector theater).

**Why this matters competitively:** Not By AI and detectors both push toward a
binary human/AI *appearance* test. Operators can run both in sequence: use
models, clean the prose, **disclose** the bill, sign it. That is a different
category story than "make it look human so no one notices."

## Competitive Forces

| Force | Pressure | Evidence | Implication |
|-------|----------|----------|-------------|
| Direct rivalry (badges) | Med | Not By AI has recognition and media coverage | Do not compete as human-only sticker clone |
| Direct rivalry (standards) | High in media | C2PA / CAI backed by Adobe, camera OEMs, major AI labs | Do not position as C2PA replacement; optional bridge later |
| Substitutes | High | Footnotes, README lines, platform labels, silence | Product must be faster/clearer than a sentence in a footer *or* add verify depth footnotes lack |
| New entrants | High | Low cost to ship SVG + docs | Defensibility = mark recognition + claim format + sample on real properties |
| Buyer power | High | Makers switch costs near zero | Sample (Azgaard, HELIX docs, social) is the adoption path |

## Competitor Profiles

| Competitor | Type | Positioning | Strengths | Weaknesses vs Innsigle UCs | Confidence |
|------------|------|-------------|-----------|----------------------------|------------|
| **Not By AI** | Direct (brand badge) | Human-made pride badge; 90% rule; project pages | Clear mark; low friction; cultural recognition | Human-only; self-asserted; no crypto; no proud-AI BOM for UC-AI-docs | High (product site) |
| **C2PA / Content Credentials (CAI)** | Indirect (standard + tools) | Nutrition label for media origin and edits; signed manifests | Open standard; industry adoption; CAI open-source SDK; verify UIs | File/media-centric; fragile when metadata stripped; identity optional; not a dual craft brand; weak for plain text social | High |
| **SynthID (Google; also OpenAI images)** | Substitute (vendor watermark) | Invisible model-origin signal in media | Survives some transforms; pairs with C2PA in vendor stacks | Not maker-authored BOM; little payload; no human path; not text-post native | High |
| **Meta Video Seal** | Substitute | Open-source video watermark research/product line | Open direction for video durability | Video-focused; not dual human/AI craft seal for docs+social | Med |
| **IPTC digitalSourceType** | Indirect (taxonomy) | Codes for trained algorithmic media, composites, etc. | Shared vocabulary for news/media metadata | Not a brand; not a signer UX; rides on metadata that social strips | High (IPTC docs) |
| **Platform labels** | Substitute | "Made with AI" style UI | Audience already sees them | Not maker-controlled; not portable; no personal key | High |
| **AI detectors** | False substitute | Score content as AI/human | Buyer demand for certainty | Arms race; wrong product category; liability | High |
| **DIY footer / README disclosure** | Substitute | Free text declaration | Zero cost | No mark system; no verify; easy to ignore | High |
| **Sloptimizer** (easel-skills) | **Complement** | Audit/rewrite AI-shaped prose; does not claim authorship | Vale rules; HELIX/DDx adapters; house-aligned | Not an origin seal; no social mark; no DKIM-like bind | High (skill contract + repo) |
| **Bare Sigli / consultancies** | Name collision only | AI software shops | SEO noise | Not provenance products | High (sigli.com) |

## Feature Comparison

| Capability | Innsigle (target) | Not By AI | C2PA/CAI | SynthID | IPTC DST | Platform label |
|------------|-------------------|-----------|----------|---------|----------|----------------|
| Visible maker mark | Full | Full | Partial (pin UI) | None | None | Platform UI |
| Human-authored state | Full | Full | Partial (if asserted) | None | Partial codes | Rare |
| Proud AI / model-named BOM | Full | None | Partial (tool in manifest) | Weak signal | Partial codes | Weak |
| Same system for human + AI | Full | None | Yes (neutral) | No | Yes (codes) | No |
| Maker-controlled crypto sign | Full (DKIM-like) | None | Full (cert chain) | N/A | None | None |
| Survives social metadata strip | Partial (visible mark + URL) | Partial (image badge) | Weak | Strong for media | Weak | N/A |
| Text / HTML docs site | Full | Partial | Partial | Weak | Weak | None |
| Text post on X/Twitter | Partial (badge/link pattern) | Partial | None native | None | None | Platform only |
| Not a detector | Full | Full | Full | Detection-side | Full | Full |

**Legend:** Full / Partial / None / Weak relative to the two operator UCs.

## Durability and channel reality

| Channel | What survives | What dies | UC impact |
|---------|---------------|-----------|-----------|
| Owned docs site (Hugo/static) | HTML, footer mark, linked claim, signed sidecar or well-known URL | Little | **UC-AI-docs:** full signet + rich BOM is viable |
| Downloaded PDF/image with C2PA | Manifest until re-export | Often lost on screenshot/re-encode | Optional later interop, not P0 |
| X/Twitter text post | Visible characters, attached image if any | Embedded file metadata routinely | **UC-human-social:** must be visual + short link or image card; no file-manifest dependency |
| X/Twitter image post | Pixels (watermark may live); badge in image | C2PA often stripped | Prefer mark baked into image or clear caption + verify URL |

Industry practice (2025–2026): vendors stack C2PA (rich, fragile) with SynthID
(sparse, durable) for *images*. That stack does not give a maker a **named
Claude BOM** on a docs site or a **human seal** on a tweet.

## Differentiation Strategy

| Differentiator | Why it matters for UCs | Defensibility |
|----------------|------------------------|---------------|
| Dual composition brand (human and AI equally first-class) | UC-human-social and UC-AI-docs share one mark family | Med (brand + guidelines) |
| Colophon with named tools (e.g. Claude) as pride, not confession | UC-AI-docs needs model credit without shame language | Med (vocabulary + UX) |
| Maker/house signet (DKIM-like), not only vendor watermark | UC-AI-docs: "Azgaard sealed this bill" | Med-High if key discovery is simple |
| Social-safe pattern (mark + outlink; no metadata dependence) | UC-human-social on X | Med (design pattern, not a protocol monopoly) |
| Explicit non-detector, non-C2PA-replacement stance | Avoids arms race and standards war | High (positioning discipline) |

**Positioning (sharpened):** For operators who publish both model-heavy docs and
human social posts, Innsigle is a content-origin seal and colophon: one visual
system for human-authored and AI-generated work, with optional personal/house
signatures. Unlike Not By AI, AI is a first-class bill ingredient. Unlike C2PA
and SynthID, the primary job is maker-facing brand and claim for web text and
social, not industry media pipelines or model-side watermarks.

## Strategic Implications

| Move | Action |
|------|--------|
| Attack | Owned documentation sites with signed AI colophons (sample HELIX / Azgaard docs); optional sloptimizer pass recorded in the bill; human social mark packs for X-class platforms; CLI sign/verify for site content |
| Defend | Category integrity (not detection; not "sloptimized = human"); dual-state mark family; simple key custody for house signers |
| Avoid | Competing as the C2PA implementation of record; building detectors; human-only purity as the only story; requiring C2PA survival on Twitter for P0; treating prose de-AI-ifying as composition change to human-authored |
| Interop (later) | Map colophon fields to IPTC `digitalSourceType` / C2PA assertions when exporting media files; keep Innsigle claim as the maker layer; optional skill/CLI hook after sloptimizer in easel-skills or agent workflows |

## Evidence anchors (survey)

- C2PA: open standard; Content Credentials "nutrition label"; CAI open-source tools
  (contentauthenticity.org, c2pa.org).
- SynthID vs C2PA: metadata-rich vs pixel-durable; OpenAI documents both on images
  (2026 public materials).
- Not By AI: human-centric badge; not a detector (notbyai.fyi).
- IPTC NewsCodes `digitalSourceType`: algorithmic / composite codes for media
  metadata (iptc.org).
- EU AI Act Art. 50: transparency duties for synthetic content (from 2 Aug 2026).
- Channel fact: social re-encoding commonly strips signed metadata (industry
  commentary and CAI durability discussions); treat as design constraint for UC-human-social.

## Open research (non-blocking)

- Exact claim envelope vs C2PA assertion subset (design).
- Whether a tweet-length "claim pointer" URL scheme is enough for social verify.
- Trademark/name collisions beyond Sigli (ongoing).
