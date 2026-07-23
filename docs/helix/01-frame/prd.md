---
ddx:
  id: aibadge.prd
  type: prd
  kind: product
  links:
    - target: aibadge.product-vision
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
---

# Product Requirements Document

## Summary

**Innsigle** is a content-origin seal: a visual mark, a **mash bill** (how the work
was made: human, AI, mixed, tools; not a moral grade), and optional **DKIM-style
signing** that binds that declaration to a maker or house.

**Who:** Writers, designers, small publishers, and house brands (e.g. Azgaard) on
the open web.

**Problem:** Origin signals today are human-only stickers, ignored footnotes,
platform labels the maker does not control, or media-pipeline provenance (C2PA).
None combine a portable composition mark with optional personal signing.

**v1 approach:** Seal assets + mash bill model + unsigned placement + CLI (or
equivalent) to sign and verify claims. Not an AI detector. Not a C2PA replacement.

**Success bar (top):** (1) readers read the mark as composition, not purity;
(2) unsigned place in ≤15 minutes, no account; (3) signed claims verify or fail
closed with a named principal.

**Name:** Innsigle, said **INN-siggle** (rhymes with *single*).

## Problem and Goals

### Problem

Makers who combine human work and AI tools lack one mark that:

1. States how the work was made without ranking ingredients, and
2. Optionally lets a person or house cryptographically bind that statement to the
   content (stronger than a decorative SVG alone).

Workarounds: Not By AI-style human-only badges, footnotes, platform "Made with AI"
labels, or C2PA stacks aimed at media supply chains. Readers get no signal, a
purity signal, or an implied detection score.

### Goals

1. Makers can declare a mash bill and display an Innsigle that readers treat as
   composition of making.
2. Makers can optionally sign a claim so others can verify who sealed that bill
   for that content.
3. Public product copy never markets AI detection or human-only purity as the
   product.

### Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Composition literacy | ≥50% of surveyed readers in two launch niches (independent blogs; small agency sites) describe the mark as how-made / composition (not "AI bad" / "human pure"), 12–24 months after public launch | Named survey instrument at launch; annual or post-campaign |
| Unsigned placement | New maker places unsigned Innsigle (mark + mash bill) in ≤15 minutes without an account | Timed task, dogfood/usability, n≥5 |
| Sign/verify | 100% of P0 signed fixtures verify with published pubkey; mutated content and wrong key fail closed | Automated CLI/crypto tests + one manual verify-page check |
| Category integrity | Zero public pages claim AI detection accuracy | Release checklist: site, README, mark guidelines |

### Non-Goals

- AI content detection or watermark decoding (e.g. SynthID).
- Replacing C2PA / Content Credentials pipelines or camera capture.
- Multi-tenant accounts, social network, or seal marketplace in v1.
- EU AI Act (or other) compliance certification as a product.
- Guaranteeing a mash bill is factually true; product guarantees declaration and,
  if used, signature validity only.
- Human-only purity branding as the primary product.

Deferred items: `docs/helix/01-frame/parking-lot.md` when filed.

## Users and Scope

### Primary Persona: Craft Maker (Alex)

**Role:** Independent writer, designer, or small-studio publisher  
**Goals:** Declare how work was made; own the mark on their site  
**Pain:** Human-only badges exclude mixed work; footnotes ignored; no interest in
enterprise provenance stacks or detector products

### Secondary Persona: House Steward

**Role:** Operator of a small house brand (e.g. Azgaard) across multiple works  
**Goals:** One seal system across properties; optional house key for signed claims  
**Pain:** Platform labels inconsistent; wants house identity without superhero
branding or legal-disclaimer voice

### Tertiary Persona: Curious Reader

**Role:** Client, peer, or visitor who notices the mark  
**Goals:** Read composition in one glance; optionally check who sealed a claim  
**Pain:** Unclear badge meanings; distrust of "verified authentic content" badges

## Requirements

### Must Have (P0)

1. Mash bill model: human, AI-generated, mixed/AI-assisted, plus tools/roles at
   product-defined depth.
2. Visual Innsigle seal system (assets + placement guidance).
3. Publish unsigned Innsigle with mash bill on a web page or document.
4. Sign a claim over identified content; third party verifies signature + content
   binding offline or via a simple verify view.
5. Public materials state what Innsigle is not (not detection; not purity product).

### Should Have (P1)

1. Brand/docs site: mark, mash bill, and verify teachable in ≤5 minutes of reading.
2. House signer profile pattern (e.g. Azgaard as issuer).
3. Embed snippets or static assets for common site generators.

### Nice to Have (P2)

1. C2PA interop bridge.
2. Hosted key directory or account-based key recovery.
3. Social-platform card integrations.
4. Quantitative mash bill (percentages) beyond categories.

## Functional Requirements

### Subsystem: Mash Bill Model

- **FR-1** Makers can represent origin as composition with at least human-made,
  AI-generated, and mixed/AI-assisted states, without a required better/worse
  ranking among those states.
- **FR-2** A mash bill can name tools or roles (e.g. drafting model, image model,
  human edit) at a product-defined detail level a reader can use as a recipe.
- **FR-3** Required fields and primary mark variants do not encode human = good
  or AI = bad.

### Subsystem: Visual Seal System

- **FR-4** Seal mark assets form one family across composition states (not separate
  good/bad logos).
- **FR-5** Placement guidelines show how to present the seal with a readable mash
  bill (or one link to it) on a typical web page.
- **FR-6** Mark design and guidelines forbid "verified real content" / platform-truth
  motifs that imply oracle authenticity of the file.

### Subsystem: Unsigned Declaration

- **FR-7** A maker can attach an Innsigle without generating keys or creating an
  account.
- **FR-8** An unsigned Innsigle exposes the mash bill inline or one link away
  without verification tooling.

### Subsystem: Sign and Verify (Signet)

- **FR-9** A maker can produce a signed claim binding: content fingerprint,
  mash bill, issuer identity reference, and timestamp (or equivalent freshness).
- **FR-10** A third party with claim, content, and issuer public key can verify
  integrity and content match; mutation or key mismatch fails closed.
- **FR-11** v1 private keys stay under maker control (local keys); signing does
  not require a hosted account.
- **FR-12** Verify output reports claim validity and signer identity, not a
  detection verdict on human vs AI content.

### Subsystem: Brand Site and Education

- **FR-13** Public explainer covers: what Innsigle is, mash bill, how to use the
  mark, how to verify when signed, and non-goals (detection, C2PA replacement).
- **FR-14** Pronunciation documented once: **INN-siggle** (rhymes with *single*).

### Subsystem: Tooling Distribution

- **FR-15** Assert/sign/verify tooling ships as a documented runnable distribution
  (CLI or equivalent) for the P0 signed path without requiring a GUI.

## Acceptance Test Sketches

| Requirement | Scenario | Input | Expected Output |
|-------------|----------|-------|-----------------|
| FR-1–3, FR-7–8 | Maker publishes mixed essay | Mash bill: human draft+edit, model outline; seal in footer | Reader sees Innsigle + composition; no account or keys |
| FR-4–6 | Design review of mark set | Human / AI / mixed variants | One seal family; no purity color coding; no truth-shield motif |
| FR-9–12, FR-15 | Sign then verify | Canonical file + keypair + mash bill | Verify succeeds; bit-flip fails; wrong key fails; no detection copy |
| FR-13–14 | New visitor skim | Brand site only | Explains composition seal + optional sign; "not a detector"; INN-siggle once |

## Technical Context

Assumptions until ADRs exist:

| Area | Choice |
|------|--------|
| Language/runtime | TypeScript + Bun for CLI/tooling (HELIX default) |
| Crypto | Signatures over content hash + claim payload (algorithm in ADR/contract) |
| Key discovery (v1) | Public key URL or well-known path; no mandatory IdP |
| Brand assets | SVG/PNG (or similar) seal pack + guidelines |
| Site | Static-first brand/docs (framework ADR if needed) |
| Platforms | Maker: macOS/Linux primary; readers: current browsers |
| Out of v1 | Central claim database, multi-tenant auth |

## Constraints, Assumptions, Dependencies

### Constraints

| Kind | Constraint |
|------|------------|
| Technical | Offline verify given claim + content + pubkey |
| Business | Small operator capacity; first adoption on Azgaard properties |
| Brand | Visual seal primary; name secondary |
| Legal | No regulatory certification claims; disclosure law is adoption context only |

### Assumptions

- Makers will learn one pronunciation if the mark is strong
- Local key management is acceptable for early signed users
- Categorical mash bills (no percentages) suffice for v1
- azgaard.net or a product domain can host keys and brand pages

### Dependencies

- Product vision and naming (locked)
- Seal mark design (open)
- Crypto/claim ADRs and contracts before signed implementation
- Product domain choice (open)

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Mark read as purity or truth badge | Med | High | Design rules (FR-6); composition literacy metric; guidelines forbid truth tropes |
| Name hard to say; mark ignored | Med | Med | Fixed pronunciation; invest in visual system; Azgaard co-brand |
| Key UX blocks adoption | Med | Med | Unsigned P0; signing optional; key-gen docs |
| Scope creep to C2PA or detector | Med | High | Non-goals; `scope-discipline` concern; parking lot for interop |
| Confusion with sigli.com AI firm | Low–Med | Med | Public name **Innsigle** only; never bare Sigli |
| Claim treated as legal proof of facts | Med | Med | Verify and site copy: declaration and signature validity, not content truth |

## Open Questions

- [ ] Product domain vs house (`innsigle.*` vs `*.azgaard.net`): blocks public URLs; operator
- [ ] Canonical content for HTML (which bytes hash): blocks FR-9 precision; design
- [ ] Signature algorithm and claim envelope: blocks implementation; ADR/contract
- [ ] Seal mark design direction: blocks brand launch; operator + design
- [ ] Percentages in mash bill v1 vs P2: default P2 in this PRD; operator if change
- [ ] Local folder rename `aibadge` → `innsigle`: non-blocking (remote is already `innsigle`)

## Success Criteria

- P0 mash bill, visual seal, and unsigned placement documented and used on at least
  one real property (e.g. Azgaard).
- P0 sign/verify works on fixtures and one dogfood work; fail-closed checks green.
- Brand site or README+pages teach composition seal and non-goals; no detection claims.
- Reader-facing materials use **Innsigle** / **INN-siggle** and mash-bill language.

## Review Checklist

- [x] Summary works as a 1-pager
- [x] Problem names a concrete failure mode
- [x] Goals are outcomes
- [x] Metrics have targets and methods
- [x] Non-goals exclude likely false assumptions
- [x] Personas are specific
- [x] P0 is launch-necessary
- [x] FR-n under subsystems
- [x] Acceptance sketches cover P0
- [x] No detector or C2PA-replacement scope
- [x] Open questions name blockers
