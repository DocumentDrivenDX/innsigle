---
title: "Prior Art Research: Content Origin Labeling & Attributable Provenance"
slug: prior-art-research
activity: "Discover"
source: "00-discover/prior-art-research.md"
generated: true
supporting: true
---

> **Generated from HELIX docs.** Source: `docs/helix/00-discover/prior-art-research.md`. Edit the source, not this file or `site/` HTML.

<details><summary>Source frontmatter</summary>

```yaml
ddx:
  id: aibadge.research.prior-art
  type: research-note
status: draft
activity: 00-discover
created: 2026-07-22
```

</details>

# Prior Art Research: Content Origin Labeling & Attributable Provenance

**Research disposition:** done (time-boxed survey for genesis / vision)  
**Decisions this research enables:** product gap, non-goals, and differentiation before PRD  
**Product name (locked):** Innsigle (etymon *innsigli*; repo slug still `aibadge`)

## Research questions

1. What already exists for *labeling* AI vs human content (brand and UI)?
2. What already exists for *verifiable provenance* (crypto, standards, pipelines)?
3. Where does a **brand-first** product with **DKIM-like individual attribution** fit without colliding with C2PA or pure badge movements?
4. What market/regulatory pressure makes “why now” concrete?

## Findings summary

| Layer | Incumbents | What they optimize for | Weakness for our intent |
|-------|------------|------------------------|-------------------------|
| Brand / social signal | Not By AI | Human-only advocacy badge; project pages; self-asserted 90% rule | No dual AI/human system; no cryptographic binding to a person; explicitly not a verifier |
| Media provenance standard | C2PA / Content Credentials (CAI) | Tamper-evident manifests for media origin & edit history; industry coalition | Heavy pipeline; metadata often stripped; identity optional; “nutrition label,” not a simple personal claim UX |
| Model-side watermark | SynthID (Google); adopted in places by OpenAI for images | Robust signal when metadata dies | Vendor/model infrastructure; low semantic claim surface; not individual authorship branding |
| Platform labels | Meta and peers | Platform-controlled “Made with AI” etc. | Not portable; creator does not own the mark or the identity bond |
| Regulatory disclosure | EU AI Act Art. 50 (obligations apply from 2 Aug 2026) | Machine-readable marking + human-facing disclosure for synthetic content / deepfakes / some public-interest text | Creates demand for clear disclosure; does not define a creator brand or personal signing model |

**Gap this project can own:** a **recognizable brand system** for origin states (at least human / AI / mixed) **plus** optional **portable assertions** that bind a claim to a **person or organization** the way DKIM binds a message to a domain—without becoming an AI detector or a full C2PA camera/edit stack.

## Competitive detail

### Not By AI (notbyai.fyi)

- **Offer:** Downloadable badges (“Written/Painted/Produced by human, not by AI”); membership project pages; free non-commercial use.
- **Trust model:** Voluntary self-assertion under a “90% human” rule. Site states it is **not** an AI detection tool; accountability stays with the badge user.
- **Strength:** Clear brand, media recognition, low friction for humans who want to signal craft.
- **Implication for us:** Owning “human-only decorative badge” alone is a crowded, already-branded niche. Differentiation requires **multi-state labeling** and/or **verifiable attribution**, not a second human-only sticker.

### C2PA and Content Credentials (CAI)

- **Offer:** Open technical standard (C2PA) + CAI tooling for cryptographically signed manifests (“nutrition labels”) covering creation, edits, generative AI, and publishing. Hardware (e.g. cameras, chips) and major vendors participate.
- **Trust model:** Hash + sign; tamper-evident; optional identity; inspection via verify UIs. Explicitly **does not** declare whether content is “real”—it records process claims that tools and creators choose to attach.
- **Strength:** Correct industrial answer for media supply chains and interoperability.
- **Implication for us:** Do **not** compete as “C2PA but smaller.” Align, interoperate later if needed, and own a **simpler brand + personal assertion** layer for web/text/publishing UX where C2PA is overkill or absent.

### SynthID and multi-layer vendor provenance

- OpenAI and Google public materials (2024–2026) push **stacked** approaches: Content Credentials for detailed context + SynthID when metadata does not survive.
- **Implication for us:** Model vendors will keep closing “this file came from our model.” They will not own **creator-facing brand language** or **“I personally attest this piece is human / AI-assisted / AI-generated”** for arbitrary publishers.

### Platform and policy layer

- Platforms apply their own labels; policy and media literacy remain separate from creator-owned marks.
- **EU AI Act Article 50:** transparency duties for certain AI interactions and synthetic content; provider machine-readable marking; deployer disclosure for deepfakes and some AI text informing the public on matters of public interest (with human-review/editorial-responsibility exceptions). Code of Practice on transparency of AI-generated content supports compliance; obligations are legal even when the code is voluntary.
- **Implication for us:** “Why now” is regulatory + social demand for **clear origin language**, not only enterprise media tooling. Opportunity: help publishers and individuals **speak origin clearly** and **stand behind claims**, without claiming to be a compliance product of record (assumption to validate in frame).

## DKIM analogy (design constraint for later tooling)

| DKIM concept | Mapping for this product |
|--------------|---------------------------|
| Domain publishes a public key (DNS TXT) | Person/org publishes a verification key (profile URL, DNS, or key directory) |
| Signature covers canonicalized message content | Signature covers content hash + claim payload (origin state, timestamp, optional scope) |
| Receiver verifies “this domain authorized this mail” | Viewer verifies “this identity authorized this provenance claim” |
| Does **not** prove the mail’s factual truth | Does **not** prove the content is human or AI—only that a **named principal signed that claim** |
| Spoof resistance via key control | Same: security is key custody + discovery, not badge graphics |

**Claim vs fact (critical product honesty):**  
Signed badges assert **who said what about origin**, not **what an oracle detected**. That keeps us out of the AI-detector arms race and aligned with C2PA’s “nutrition label, not reality oracle” posture.

## Positioning options supported by evidence

| Option | Evidence fit | Risk |
|--------|--------------|------|
| A. Brand-only multi-state badges (human / AI / mixed) | Complements Not By AI’s human-only gap | Easy to copy; weak lock-in |
| B. Brand + self-serve assert/verify (DKIM-like) | Unique vs Not By AI; lighter than C2PA for text/web | Crypto UX and key discovery are hard |
| C. Full C2PA implementer / CA product | Crowded; wrong “branding first” priority | Dilutes brand mission; long pipeline |
| D. AI detector + badge | Market demand exists | Arms race; false confidence; brand liability |

**Research recommendation for vision:** lead with **A+B** (brand first, tooling that makes assertions attributable). Explicitly reject **C** and **D** as primary identity for v1.

## Assumptions to validate in `frame` (not treated as facts)

1. Creators will care about **signed** claims, not only graphics—worth testing with 5–10 target users.
2. “Mixed / AI-assisted” is a useful public state, not just a legal hedge.
3. Individual key discovery can be simple enough (profile URL or DNS) without a heavy identity provider in v0.
4. Interop with C2PA is a later bridge, not a launch dependency.
5. Regulatory disclosure demand increases badge adoption even if we are not a compliance suite.

## Open research (parked; not blocking vision draft)

- Trademark / naming collisions for short marks (“Badge,” “Mark,” “Seal,” “Credentials”).
- Whether publishers want **AI** badges as pride/compliance signal or only **human** badges as craft signal.
- Threat model: badge stripping, claim replay, key compromise (belongs in threat model + security requirements later).
- Text vs image vs audio first surface (assumption in vision UX: start where brand is visible—sites, posts, bylines).

## Sources (survey anchors)

- Not By AI product site and 90% rule framing — https://notbyai.fyi/
- Content Authenticity Initiative / Content Credentials how-it-works — https://contentauthenticity.org/how-it-works
- C2PA coalition context (via CAI materials)
- OpenAI content provenance / SynthID + Content Credentials public posts (2026)
- Google DeepMind SynthID announcements
- EU AI Act Article 50 summaries and Code of Practice on transparency of AI-generated content (obligations from 2 Aug 2026)

## Decision log

| Decision | Status | Notes |
|----------|--------|-------|
| Primary gap = brand-first multi-state label + optional attributable claims | **Proposed** | Backed by prior-art gap table |
| Not an AI detector | **Proposed non-goal** | Confirmed in vision; formalize in PRD |
| Not a C2PA replacement | **Proposed non-goal** | Interop later |
| Product name | **Locked: Innsigle** | See `naming-exploration.md`; visual seal is primary recognition surface |
| Competitive depth | **Done (this pass)** | See `competitive-analysis.md`; dual UCs (AI docs BOM + human social) drive thesis |
| Primary use cases | **Locked** | UC-AI-docs (signed model-named BOM); UC-human-social (human mark, metadata-safe) |
