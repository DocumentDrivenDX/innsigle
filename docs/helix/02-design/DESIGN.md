---
ddx:
  id: aibadge.design-system
  type: design-system
  links:
    - target: aibadge.product-vision
      kind: informed_by
    - target: aibadge.prd
      kind: informed_by
    - target: aibadge.design.claim-system
      kind: informs
status: draft
activity: 02-design
created: 2026-07-22
---

# DESIGN.md — Innsigle

Per-project interface and brand system for the seal, verify surfaces, and public
mark language. Complements claim schema and signing in
`claim-system.md`. Governing product docs: vision, PRD, principles.

## Design voice

| Axis | Choice |
|------|--------|
| Tone | Craft stamp, not compliance form; not panic "AI warning" |
| Register | Short nouns; colophon / colo / seal / signet; avoid "credentials," "authentic real," "verified true content" |
| Dual composition | Human and model-primary use the **same seal family**; state is in the colo and optional mark variant, never shame color |
| Pride | Model names (e.g. Claude) and human roles both allowed as credit |
| Trust copy | "Who sealed this colo for these bytes," not "this content is true" |
| Spoken name | **INN-siggle** (rhymes with *single*) |

**Do not use in UI or mark chrome:** green check "verified authentic," red "AI
danger," detector percentages, Not By AI clone language as the only path.

**Pairing with sloptimizer:** Editorial cleanup may be listed on the colophon; it
must not be presented as converting model-primary work into human-authored.

## Brand architecture

| Layer | Role |
|-------|------|
| House | Azgaard (or other issuer) — signer identity |
| Product | Innsigle — seal system |
| Mark | Visual seal glyph + optional state cue |
| Colophon | Colo — declared composition recipe |
| Signet | Optional cryptographic bind |

## The badge (seal mark)

### Job

1. Recognizable at small size (footer ~40–48px; social avatar-adjacent ~48–96px).
2. One family for all composition states.
3. Opens or links to colophon (and verify when signed).
4. Works as SVG/PNG without embedded C2PA (social-safe).
5. **Solid stamp matrix** (opaque fill + light impression)—not a transparent wireframe.
   Inspiration: ancient stamp seals, medieval merchant/guild marks, pottery cartouches,
   hallmark countermarks (`docs/sample/assets/marks/RESEARCH.md`).

### Anatomy

```text
┌─────────────────────────────┐
│  [glyph]  Innsigle          │  optional wordmark at larger sizes
│           [state cue]       │  human | mixed | model (not purity)
└─────────────────────────────┘
```

| Part | Spec |
|------|------|
| Glyph | Closed stamp matrix; beaded rim; angular monogram (stave + thryst + lozenge); high contrast; readable at 16–24px |
| Wordmark | "Innsigle" only when width allows; glyph alone on social and tiny footers |
| State cue | Hallmark-style **countermark** punch: `H` / `M` / `A`; never traffic-light moral coding |
| Link target | Bill page or fragment; signed claims add verify affordance |

### State variants (provisional)

| Composition | Glyph family | Cue | Notes |
|-------------|--------------|-----|--------|
| `human-authored` | Same disk | H or solid inner mark | UC-human-social default |
| `mixed` | Same disk | M or split inner | Human + model |
| `model-primary` | Same disk | A or ring inner | UC-AI-docs default; proud, not scarlet |

Geometry locked in `docs/sample/assets/marks/` (craft-matrix exploration). Constraint:
**one family**, three countermarks max for v1 states. No copied historic house marks.

### Placement

| Surface | Pattern |
|---------|---------|
| Docs footer | Glyph (+ wordmark) left or right; link "Colo" / open panel |
| Docs about | Larger seal + full colophon table |
| Social image | Glyph baked into image or attached still; caption optional short URL |
| Social profile | Link in bio to house keys + "how to read Innsigle" |
| Verify page | Glyph + validity line + colo + signer fingerprint |

### Interaction states (web)

| State | Convention |
|-------|------------|
| Default | High contrast glyph; focus ring on link/button wrapper |
| Hover / `:focus-visible` | Slight lift or ring; no color-only state change |
| Open colo | Inline expand or dedicated `/use/colophon/` / hash route |
| Verify OK | Text: "Signature valid for this content" + signer id; not a green truth badge alone |
| Verify fail | Text: fail reason (mismatch, bad key, mutated content); no detector language |

### Accessibility

- State not by color alone (cue letter or pattern + text on colophon).
- Link text not "click here"; prefer "Innsigle colo" / "Verify seal".
- Contrast WCAG AA for glyph on light and dark footers (provide mono variants).

## Visual hierarchy (verify and colophon pages)

- **Primary:** Validity + signer (if signed), or "Unsigned declaration" if not.
- **Secondary:** Composition state and tool list (colophon).
- **Tertiary:** Content fingerprint, timestamps, raw claim download.

Layout: single column, dense craft manual, not dashboard chrome.

## Tokens (initial)

### Color (draft)

| Token | Role | Draft direction |
|-------|------|-----------------|
| `--seal-ink` | Glyph and primary type | Near-black / near-white pair for themes |
| `--seal-paper` | Page/footer surface | Neutral paper, not pure startup blue |
| `--seal-accent` | Focus ring, links | Single accent; not green=good red=AI |
| `--seal-mute` | Secondary meta | 60% ink |

No semantic "success = human / danger = AI" mapping.

### Type

| Step | Use |
|------|-----|
| Display | Rare; brand site only |
| Title | Bill page heading |
| Body | Bill rows, verify prose |
| Caption / mono | Fingerprints, digests, timestamps |

Prefer a readable grotesque + mono for digests. Final faces open.

### Spacing

4px base rhythm; footer seal padded to not collide with license links.

## Navigation (brand site)

| Surface | Model |
|---------|-------|
| Marketing / docs site | Top links: What it is, Colophon, Verify, Mark pack, Non-goals, Sample |
| Active state | Underline or weight + `aria-current="page"` |

**Live microsite:** `site/` deployed by `.github/workflows/pages.yml` to
GitHub Pages (`https://documentdrivendx.github.io/innsigle/`).

## Design deliverables checklist

- [x] Glyph SVG (solid stamp matrix + monogram + countermarks) — `docs/sample/assets/marks/`
- [x] State cue variants H/M/A — human / mixed / model SVGs
- [x] Footer embed snippet — `docs/sample/snippets/footer.html`
- [ ] Social still template (PNG export pipeline)
- [x] Bill + verify sample page — `docs/sample/index.html`
- [x] Do/don't sheet — marks README

## Mark exploration (2026-07-23)

**Direction chosen for exploration pack:** geometric double-ring stamp with a
simple vertical stem (letter-I / post mark), not a figurative Nordic cosplay
mark. State is a **caption letter** under the disk (H/M/A), not a color code.

| Asset | Path |
|-------|------|
| Base | `docs/sample/assets/marks/innsigle-base.svg` |
| Human | `docs/sample/assets/marks/innsigle-human.svg` |
| Mixed | `docs/sample/assets/marks/innsigle-mixed.svg` |
| Model | `docs/sample/assets/marks/innsigle-model.svg` |

**Still open for brand polish:** custom wordmark, Azgaard palette accent, PNG
renders, whether state letters stay Latin H/M/A or move to inner geometry only.

## Open design decisions

- [ ] Final glyph polish (stroke weights, optical balance at 16px)
- [ ] State cue: keep letters vs inner geometry only
- [ ] Wordmark custom lettering vs system font
- [ ] Accent color family under Azgaard house palette
