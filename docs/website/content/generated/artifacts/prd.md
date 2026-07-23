---
title: "Product Requirements Document"
slug: prd
activity: "Frame"
source: "01-frame/prd.md"
generated: true
supporting: false
---

> **Generated from HELIX docs.** Source: `docs/helix/01-frame/prd.md`. Edit the source, not this file or `site/` HTML.

<details><summary>Source frontmatter</summary>

```yaml
ddx:
  id: aibadge.prd
  type: prd
  kind: product
  links:
    - target: aibadge.product-vision
      kind: informed_by
    - target: aibadge.competitive-analysis
      kind: informed_by
    - target: aibadge.research.prior-art
      kind: informed_by
    - target: aibadge.research.naming
      kind: informed_by
    - target: aibadge.principles
      kind: informs
    - target: aibadge.concerns
      kind: informs
status: draft
product_name: Innsigle
activity: 01-frame
created: 2026-07-22
updated: 2026-07-22
```

</details>

# Product Requirements Document

## Summary

**Innsigle** is a content-origin seal for makers who publish in two channels:

1. **UC-AI-docs:** Owned documentation (e.g. HELIX microsite): model-primary
   content with a **signed colophon** that can proudly name tools (e.g. Claude)
   and a house/person signer.
2. **UC-human-social:** Short posts on X/Twitter and similar: a **human-authored**
   mark that stays visible when platforms strip file metadata.

Same seal family; different colophons. Optional DKIM-style signing for durable
content. Not an AI detector. Not a C2PA replacement (C2PA/SynthID serve media
pipelines and vendor watermarks; social text and proud model BOM are the gap).

**v1:** Mark system + colophon model + docs sign/verify CLI + social placement
pattern (image/link). Dogfood on operator docs and social first. Editorial
tooling such as **sloptimizer** (easel-skills) is a complementary pipeline step:
list it on the bill when used; it does not change composition to human-authored.

**Name:** Innsigle (**INN-siggle**, rhymes with *single*).

## Problem and Goals

### Problem

Two concrete failures for the same operator:

| Use case | Failure today | Why substitutes fail |
|----------|---------------|----------------------|
| Model-heavy docs site | No signed, portable BOM that *credits* models by name under a house seal | C2PA is media-file heavy; SynthID is vendor signal without maker bill; footers are unsigned and easy to ignore |
| Human posts on X/etc. | No maker-controlled human mark that survives the channel | Not By AI is human-only product culture, not dual system; C2PA metadata dies on upload; platform labels are not portable |

Competitive layer map (see `competitive-analysis.md`): badges, C2PA, watermarks,
IPTC codes, platform labels, and detectors each cover a slice; none cover both
UCs as one brand + claim system.

### Goals

1. **UC-AI-docs:** Operator can publish docs with an Innsigle whose colophon
   names generative tools and is optionally signed so readers verify house/person
   sealed that bill for those content bytes.
2. **UC-human-social:** Operator can mark a short social post as human-authored
   with the same seal family, without depending on embedded file manifests.
3. Product copy never markets detection or treats AI composition as a lesser
   class of seal.

### Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| UC-AI-docs dogfood | ≥1 real docs property (e.g. HELIX or Azgaard docs) shows Innsigle + colophon with named model; signed path works for at least one canonical page | Checklist + verify CLI against live URL or published artifact |
| UC-human-social dogfood | ≥1 real X (or equivalent) post or profile asset uses human-authored Innsigle pattern | Screenshot + placement checklist |
| Docs sign/verify | 100% P0 fixtures verify; mutation and wrong key fail closed | Automated CLI/crypto tests |
| Unsigned social place | Human mark pack placeable in ≤15 minutes without account | Timed task n≥3 |
| Composition literacy | ≥50% surveyed readers describe mark as how-made / composition | Survey at launch; separate docs vs social samples if possible |
| Category integrity | Zero public detection-accuracy claims | Release checklist |

### Non-Goals

- AI content detection or decoding SynthID/Video Seal.
- Replacing C2PA/CAI as the media industry standard or camera capture chain.
- Guaranteeing colophon factual truth (only declaration + optional signature).
- Multi-tenant accounts, marketplace, or social network in v1.
- Native X API integration or platform partnership as P0.
- EU AI Act certification product.
- Requiring signed claims on ephemeral social posts.
- Treating prose de-AI-ifying (e.g. sloptimizer rewrite) as proof of
  `human-authored` composition or as an authorship detector.
- Absorbing sloptimizer into Innsigle; they remain separate tools that can run
  in sequence.

## Users and Scope

### Primary Persona: Dual-channel operator (Erik / Azgaard)

**Role:** Builds methodology docs with models; posts human writing on social  
**Goals:** Proud model BOM on docs; clear human mark on social; one system  
**Pain:** Tools force either human-only badge culture or industrial media provenance

### Secondary Persona: Docs reader

**Role:** Developer or practitioner reading sealed documentation  
**Goals:** See which models/tools produced the page; optional verify signer  
**Pain:** Unclear whether docs are human, model, or mixed; no trust anchor

### Tertiary Persona: Social viewer

**Role:** Follower on X/similar  
**Goals:** Tell human-authored posts from unlabeled AI sludge at a glance  
**Pain:** Platform labels incomplete; metadata invisible

## Requirements

### Must Have (P0)

1. Colophon model: at least human-authored, model-primary (AI-generated), and
   mixed; tools/models nameable (e.g. `Claude`).
2. Visual seal family usable for both composition poles (not separate good/bad logos).
3. **UC-AI-docs:** Embed mark + colophon on a static/HTML docs page; optional
   sign and verify for canonical content.
4. **UC-human-social:** Placement pattern for human-authored posts when file
   metadata cannot be trusted (mark image and/or short verify/profile link).
5. Public "what this is not" (not detector; not C2PA replacement).
6. Runnable sign/verify tooling for the docs path (CLI or equivalent).

### Should Have (P1)

1. Brand/docs site teaching both use cases in ≤5 minutes.
2. House signer profile (Azgaard) as default dogfood issuer.
3. Site-generator notes (e.g. Hugo/static footer partial).
4. Social asset pack (avatar-adjacent mark, post image template, caption templates).
5. Documented dogfood recipe: model draft → sloptimizer → Innsigle bill/sign for
   methodology docs (links to easel-skills sloptimizer; no merge of codebases).

### Nice to Have (P2)

1. C2PA export/bridge for image assets.
2. IPTC `digitalSourceType` mapping from colophon fields.
3. Hosted key directory.
4. Native platform integrations.
5. Quantitative percentages in colophon.
6. Optional agent/skill hook that proposes a colophon after a sloptimizer pass
   (still human-confirmed composition state).

## Functional Requirements

### Subsystem: Colophon Model

- **FR-1** Colophon includes composition states at least: `human-authored`,
  `model-primary` (AI-generated), `mixed`.
- **FR-2** Colophon can list named tools/models (e.g. Claude, other LLMs,
  image models), editorial tools (e.g. sloptimizer), and human roles (edit,
  structure, review).
- **FR-3** No required ranking of states as better/worse; AI-named bills are
  valid first-class seals (model credit is an allowed primary use).
- **FR-4** Product defaults and mark variants do not encode human = good /
  AI = bad.
- **FR-4a** Composition state is independent of prose "AI-tell" cleanliness:
  an editorial rewrite (including sloptimizer) must not, by itself, flip
  `model-primary` or `mixed` to `human-authored`. Guidelines state this boundary.

### Subsystem: Visual Seal System

- **FR-5** Seal assets form one visual family across composition states; variants
  may signal state without purity/shame coding.
- **FR-6** Placement guidelines cover (a) docs site footer / about, (b) social
  mark image or link pattern.
- **FR-7** Guidelines forbid "verified real content" / oracle-truth motifs.

### Subsystem: UC-AI-docs (documentation)

- **FR-8** Maker can publish an Innsigle on an HTML/static docs page with colo
  inline or one link away, including named models.
- **FR-9** Maker can sign a claim over a defined canonical content unit (page or
  artifact) binding: content fingerprint, colophon, issuer, time.
- **FR-10** Third party verifies claim + content + issuer public key; fails
  closed on mutation or key mismatch.
- **FR-11** v1 signing uses maker-controlled local keys; no hosted account required.
- **FR-12** Verify output reports validity and signer, not a detection verdict.

### Subsystem: UC-human-social

- **FR-13** Maker can mark a short social post as `human-authored` using assets
  or patterns that do not require surviving C2PA/EXIF on the platform.
- **FR-14** Social pattern includes a path for viewers to learn mark meaning
  (profile link, site, or short URL); unsigned is allowed.
- **FR-15** Social human mark uses the same seal family as docs (not a separate
  human-only brand product).

### Subsystem: Brand Site and Education

- **FR-16** Public explainer documents both UCs, colophon examples (Claude-named
  docs, optionally with sloptimizer on the bill; human social), verify when
  signed, non-goals, and the sloptimizer complement (edit vs seal; no authorship
  laundering).
- **FR-17** Pronunciation documented once: **INN-siggle** (rhymes with *single*).

### Subsystem: Tooling Distribution

- **FR-18** Assert/sign/verify tooling ships documented and runnable for UC-AI-docs
  P0 without a GUI.
- **FR-19** Tooling accepts a colophon that includes named generative tools.

## Acceptance Test Sketches

| Requirement | Scenario | Input | Expected Output |
|-------------|----------|-------|-----------------|
| FR-1–4, FR-4a, FR-8, FR-19 | HELIX-like docs page, model-primary | Colophon: Claude draft, sloptimizer rewrite, human edit; footer seal | Reader sees named model and editorial tool; state remains model-primary |
| FR-9–12, FR-18 | Sign docs page | Canonical HTML or content bytes + house key | Verify succeeds; bit-flip fails; wrong key fails |
| FR-5–7, FR-13–15 | Human X post | Human-authored mark asset or link pattern | Viewer can see human composition without file metadata |
| FR-16–17 | New visitor | Brand site only | Explains both UCs; sloptimizer ≠ human authorship; not a detector; INN-siggle once |

## Technical Context

Assumptions until ADRs:

| Area | Choice |
|------|--------|
| Language/runtime | TypeScript + Bun for CLI |
| Crypto | Sign content hash + claim payload (algorithm in ADR) |
| Key discovery v1 | Public key URL / well-known path; no IdP |
| Docs channel | Static HTML sites (Hugo-class); footer + claim URL |
| Social channel | Visible mark image + optional URL; no dependency on platform preserving manifests |
| Out of v1 | Central claim DB, multi-tenant auth, X API bot |

## Constraints, Assumptions, Dependencies

### Constraints

| Kind | Constraint |
|------|------------|
| Channel | Social platforms strip or ignore signed media metadata; design UC-human-social accordingly |
| Technical | Docs verify offline given claim + content + pubkey |
| Business | Operator dogfood first (Azgaard / HELIX docs + social) |
| Brand | Visual seal primary |
| Competitive | Do not market as C2PA or SynthID replacement |
| Integrity | Editorial tools that reduce AI-tell patterns do not redefine composition state |

### Assumptions

- Naming models (Claude, etc.) in a public bill is desirable for UC-AI-docs.
- Naming editorial tools (sloptimizer) on the bill is desirable when used.
- Human social often stays unsigned; in v1, visible mark placement matters more than per-post signatures.
- Local keys acceptable for house signing of docs.
- Sloptimizer remains in easel-skills; Innsigle does not reimplement Vale prose rules.
- Competitive analysis in `docs/helix/00-discover/competitive-analysis.md` remains the rivalry baseline until next research pass.

### Dependencies

- Competitive analysis and vision (this pass)
- Seal mark design (open)
- Claim format ADR/contract (open)
- Domain for verify URLs (open)
- Optional: easel-skills sloptimizer available in operator agent environment for dogfood recipe

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Docs path collapses into "just use C2PA" | Med | High | Scope: maker BOM + house sign for HTML; C2PA bridge is P2 |
| Social mark ignored as random SVG | Med | High | Strong mark design; profile/about education; dogfood consistency |
| Proud AI bill read as greenwashing | Med | Med | Exact tool names + human roles in bill; no "authentic" oracle language |
| Human mark forks into Not By AI clone | Med | Med | Dual-UC brand rules; same family as model-primary seals |
| Scope creep to detectors or platform deals | Med | High | Non-goals; P0 = dogfood UCs only |
| "Sloptimized = human" laundering | Med | High | FR-4a; guidelines; brand explainer; non-goal |

## Open Questions

Design drafts: `docs/helix/02-design/` (DESIGN.md, claim-system.md, attestation-prior-art.md). Remaining freezes:

- [ ] Canonical content unit for multi-page docs (per-page vs release set)
- [ ] HTML canonicalization for hashing (Contract)
- [ ] Signature algorithm + envelope freeze (ADR; draft proposes Ed25519)
- [ ] Seal glyph geometry and state cues (DESIGN.md open list)
- [ ] Product domain vs `*.azgaard.net` for type URIs and key_url
- [ ] Model version pins in colophon v1
- [ ] Claim URL shape for social (profile well-known vs per-post)

## Success Criteria

- UC-AI-docs live on at least one operator docs property with named-model colophon;
  signed verify path green on one canonical artifact.
- UC-human-social live as at least one real human-authored social placement.
- Automated sign/verify tests green; no detection claims in public materials.
- Competitive non-goals held: not C2PA replacement, not detector.

## Review Checklist

- [x] Summary is a 1-pager including both UCs
- [x] Problem tied to competitive gaps
- [x] Goals map to UC-AI-docs and UC-human-social
- [x] Metrics cover dogfood both channels
- [x] FR-n cover colophon, docs sign, social pattern
- [x] Non-goals exclude C2PA war and detectors
- [x] Acceptance sketches cover both UCs
