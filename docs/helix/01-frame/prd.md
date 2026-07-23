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
---

# Product Requirements Document

## Summary

**Innsigle** is a craft **seal** for digital work: a visual mark plus a **mash bill**
(composition of how the work was made—human, AI, tools, blend—not a moral grade),
with optional **DKIM-like signing** so a maker or house can bind that claim to a
verifiable identity.

**Who:** Independent makers, small publishers, and craft-led brands (including
house brands like Azgaard) who publish on the open web.

**Problem:** Origin talk is either shame/purity badges, opaque platform labels, or
heavy media-pipeline provenance—none of which give a proud, portable composition
mark with optional personal standing.

**Approach (v1):** Brand-first seal system + declaration of mash bill + embeddable
mark assets + CLI (or equivalent tooling) to assert and optionally sign/verify
claims. Not an AI detector. Not a C2PA replacement.

**Top success metrics:** (1) readers interpret the mark as *composition*, not purity;
(2) makers can place an Innsigle without a key; (3) signed seals verify to a named
principal when keys are used.

**Say the name:** **INN-siggle** (rhymes with *single*).

## Problem and Goals

### Problem

Makers who use any mix of human craft and AI tools lack a **single proud mark** that:

1. States **how the work was made** without moralizing ingredients, and  
2. Optionally lets a **person or house stand behind** that statement with something
   stronger than a decorative SVG.

Today they improvise with human-only stickers (e.g. Not By AI), buried footnotes,
platform “Made with AI” labels they do not control, or industrial provenance
(C2PA) that does not feel like a craft brand. Audiences either get no signal or the
wrong signal (shame, purity, or undetectable “AI score” theater).

### Goals

1. Makers can declare a **mash bill** and show an **Innsigle** mark that readers
   learn to read as composition of making.
2. Makers can **optionally sign** a claim over content so others can verify
   *who sealed this bill for this work*.
3. The public brand stays **craft-first** and never markets detection or purity.

### Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Composition literacy | ≥ 50% of surveyed readers in two launch niches describe the mark as how-it-was-made / composition (not “AI bad” / “human pure”) within 12–24 months of public launch | Structured reader survey (annual or post-campaign) |
| Unsigned adoption friction | A new maker can obtain and place an unsigned Innsigle (mark + mash bill statement) in ≤ 15 minutes without creating an account | Timed task in dogfood / usability sessions (n≥5) |
| Signed verify path | 100% of P0 signed fixtures verify successfully with published public key; forged or mutated content fails closed | Automated CLI/crypto test suite + one manual verify-page check |
| Category integrity | Zero public pages claim AI detection accuracy | Checklist review of site, README, and mark guidelines each release |

### Non-Goals

- AI content **detection** or watermark decoding (SynthID-class).
- Replacing **C2PA / Content Credentials** media pipelines or camera capture.
- Multi-tenant **accounts**, social network, or marketplace of seals in v1.
- Legal **compliance certification** product for EU AI Act (may inform copy; not a certification service).
- Guaranteeing that a mash bill is “true”—only that it was **declared** and optionally **signed**.
- Human-only purity branding as the primary product (multi-state composition is first-class).

Deferred items may be tracked later in `docs/helix/01-frame/parking-lot.md`.

## Users and Scope

### Primary Persona: Craft Maker (Alex)

**Role**: Independent writer, designer, or small-studio publisher  
**Goals**: Show honest making process; keep craft pride; own the mark on their site  
**Pain Points**: Human-only badges exclude mixed work; footnotes get ignored; do not want enterprise provenance tools or detector drama

### Secondary Persona: House Steward (Azgaard-class)

**Role**: Personal or small brand owner curating multiple works under one house  
**Goals**: Consistent seal across properties; optional house key for signed claims  
**Pain Points**: Platform labels are inconsistent; want Norse/craft identity without Marvel cosplay or compliance voice

### Tertiary Persona: Curious Reader

**Role**: Client, fan, or peer who notices the mark  
**Goals**: Understand composition quickly; optionally check who sealed a claim  
**Pain Points**: Cannot tell what badges mean; distrust “verified authentic” theater

## Requirements

### Must Have (P0)

1. Defined **mash bill** model (composition ingredients / states for human, AI, mixed, and tools at a product level).
2. **Visual Innsigle seal system** usable as a public mark (assets + placement guidance).
3. Ability for a maker to **publish an unsigned** Innsigle with a mash bill on a web page or document.
4. Ability for a maker to **sign** a claim over identified content and for a third party to **verify** signature + content binding offline or via a simple verify view.
5. Public materials that state **what Innsigle is not** (not detection, not purity).

### Should Have (P1)

1. Brand / docs site that teaches mark + mash bill + verify in under five minutes of reading.
2. House-level identity (e.g. Azgaard) as a first-class signer profile pattern.
3. Embed snippets or static assets for common site generators.

### Nice to Have (P2)

1. C2PA interop bridge.
2. Hosted key directory or account-based key recovery.
3. Social-platform-specific card integrations.
4. Quantitative mash bill (percentages) beyond categorical composition.

## Functional Requirements

### Subsystem: Mash Bill Model

- **FR-1** — Makers can represent a work’s origin as a **composition** including at least: human-made, AI-generated, and mixed / AI-assisted states, without ranking those states as better or worse.
- **FR-2** — A mash bill can name **tools or roles** involved in making (e.g. drafting model, image model, human edit) at a product-declared level of detail sufficient for a reader to understand the recipe.
- **FR-3** — Product language and defaults never encode human = good or AI = bad in required fields or primary mark variants.

### Subsystem: Visual Seal System

- **FR-4** — Innsigle provides a **visual seal mark** system that remains recognizable across composition states (one family, not separate “good/bad” logos).
- **FR-5** — Placement guidelines describe how to present the seal with a readable mash bill (or link to one) on a typical web page.
- **FR-6** — Mark design and guidelines avoid “platform truth / verified real content” tropes that imply oracle authenticity.

### Subsystem: Unsigned Declaration

- **FR-7** — A maker can attach an Innsigle to a work **without** generating keys or creating an account.
- **FR-8** — An unsigned Innsigle still exposes the mash bill (inline or one link away) so readers can read composition without verification tooling.

### Subsystem: Sign and Verify (Signet)

- **FR-9** — A maker can produce a **signed claim** that binds: content identity (fingerprint of canonical content), mash bill, issuer identity reference, and timestamp (or equivalent freshness signal).
- **FR-10** — A third party with the signed claim, content, and issuer public key can **verify** that the claim is intact and matches the content; verification fails closed on mutation or key mismatch.
- **FR-11** — Private signing material stays under maker control in v1 (local keys); the product does not require a hosted account to sign.
- **FR-12** — Verify results communicate **claim validity and signer**, not “this content is human/AI as detected.”

### Subsystem: Brand Site and Education

- **FR-13** — A public explainer states mission, mash bill idea, how to use the mark, how to verify when signed, and explicit non-goals (detection, C2PA replacement).
- **FR-14** — Name pronunciation is documented once: **INN-siggle** (rhymes with *single*).

### Subsystem: Tooling Distribution

- **FR-15** — Makers can obtain assert/sign/verify tooling as a documented, runnable distribution (CLI or equivalent) for P0 signed path without depending on a GUI.

## Acceptance Test Sketches

| Requirement | Scenario | Input | Expected Output |
|-------------|----------|-------|-----------------|
| FR-1–3, FR-7–8 | Maker publishes mixed essay | Mash bill: human draft+edit, model outline; seal in footer | Reader sees Innsigle + composition; no account/keys required |
| FR-4–6 | Design review of mark set | Human / AI / mixed variants | Same seal family; no shame/purity coding; no truth-shield motif |
| FR-9–12, FR-15 | Sign then verify | Canonical file + keypair + mash bill | Verify succeeds; bit-flip in file fails; wrong key fails; UI/CLI text does not claim detection |
| FR-13–14 | New visitor skim | Brand site only | Can explain composition seal + optional sign; sees “not a detector”; hears/sees INN-siggle once |

## Technical Context

Stack decisions below are **assumptions** until ADRs land.

- **Language/Runtime**: TypeScript + Bun (HELIX shipped default) for CLI/tooling
- **Crypto**: Standard signatures over content hash + claim payload (algorithm choice in design/ADR)
- **Key discovery (v1)**: Public key URL or well-known document path; no mandatory IdP
- **Brand assets**: SVG/PNG (or similar) seal pack + guidelines markdown/HTML
- **Site**: Static-first brand/docs site (framework ADR later if needed)
- **Platform Targets**: Maker machines (macOS/Linux primary); readers on modern browsers
- **Not in v1 platform**: Central claim database, multi-tenant auth

## Constraints, Assumptions, Dependencies

### Constraints

- **Technical**: v1 signing must work offline for verify given claim + content + pubkey
- **Business**: Operator capacity is small; dogfood on Azgaard properties is the first adoption path
- **Brand**: Visual seal is primary recognition; name is secondary
- **Legal/Compliance**: Do not claim regulatory certification; disclosure laws may motivate adoption only

### Assumptions

- Makers will accept teaching one pronunciation and a foreign-looking name if the **mark** is strong
- Local key management is acceptable for early signed users
- Composition without percentages is enough for v1 mash bills
- azgaard.net (or product domain later) can host keys and brand pages

### Dependencies

- Product vision and naming lock (done)
- Design work for seal mark (not yet)
- Crypto/design ADRs before implement signed path
- Domain choice for long-term product URL (open)

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Mark read as “AI bad” or “truth badge” | Med | High | Design principles + reader survey metric; guidelines forbid purity/truth tropes |
| Name hard to say; mark ignored | Med | Med | Fixed pronunciation **INN-siggle**; invest in visual system; house co-brand Azgaard |
| Key UX blocks adoption | Med | Med | Unsigned path P0; signing optional; docs for key gen |
| Scope creep to C2PA/detector | Med | High | Non-goals + scope-discipline concern; parking lot for interop |
| Sigli.com AI firm confusion | Low–Med | Med | Public name is **Innsigle**, never bare Sigli |
| Claim misused as legal proof | Med | Med | Explicit “declaration not oracle” on verify and site |

## Open Questions

- [ ] Final **domain** for product vs house (`innsigle.*` vs `*.azgaard.net`) — blocks public URLs; ask operator
- [ ] **Canonical content** rules for HTML pages (what bytes get hashed) — blocks FR-9 precision; resolve in design
- [ ] **Signature algorithm** and claim envelope format — blocks implementation; resolve in ADR/contract
- [ ] **Seal mark** design direction (runic/craft/minimal) — blocks brand launch; ask operator + design pass
- [ ] Whether **percentages** enter mash bill in v1 or stay P2 — product call; default P2 per this PRD
- [ ] Repo rename `aibadge` → `innsigle` timing — non-blocking

## Success Criteria

- P0 mash bill + visual seal + unsigned placement documented and usable on at least one real property (e.g. Azgaard).
- P0 sign/verify path works on fixtures and one dogfood work with fail-closed checks.
- Brand site (or equivalent README+pages) teaches composition seal and non-goals without detection claims.
- Reader-facing materials consistently use **Innsigle** / **INN-siggle** and mash-bill language.

## Review Checklist

- [x] Summary works as a standalone 1-pager
- [x] Problem states a specific failure mode
- [x] Goals are outcomes
- [x] Success metrics have targets and methods
- [x] Non-goals exclude reasonable false assumptions
- [x] Personas are specific
- [x] P0 requirements are launch-necessary
- [x] FR-n IDs under subsystems
- [x] Acceptance sketches cover P0 themes
- [x] No detector or C2PA-replacement scope
- [x] Open questions name blockers
