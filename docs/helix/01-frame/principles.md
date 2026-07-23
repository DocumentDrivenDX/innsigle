---
ddx:
  id: aibadge.principles
  type: principles
  links:
    - target: aibadge.product-vision
      kind: informed_by
    - target: aibadge.prd
      kind: informed_by
status: draft
activity: 01-frame
created: 2026-07-22
---

# Project Principles

These principles guide judgment calls for **Innsigle**. They are not requirements,
concerns, ADRs, or process rules. They are lenses when two valid options compete.

## Principles

1. **Composition, not verdict** — Origin language describes *how the work was made*
   (colophon), never moral grades of human vs AI. This changes decisions when
   copy, UI, or defaults would shame one ingredient or saint another.

2. **Claim is not oracle** — A sealed colophon asserts what a maker declared and
   (when signed) who sealed it. It does not detect, score, or prove cosmic truth.
   This changes decisions when marketing or UX would imply AI detection.

2a. **Edit is not origin** — Prose cleanup (including sloptimizer or similar) changes
   how text *reads*, not how it was *produced*. Composition state and tool list must
   still name models and roles honestly. This changes decisions when "sounds human"
   would tempt a `human-authored` mark on model-primary work.

3. **Mark first, string second** — Recognition lives in the Innsigle visual seal.
   Names, URLs, and CLI strings support the mark; they do not replace it. This
   changes decisions when wordmark polish crowds out glyph system work.

4. **Craft pride before compliance theater** — Lead with maker dignity and house
   stamp; civic transparency is a consequence, not the primary voice. This changes
   decisions when legal-disclaimer tone would flatten brand.

5. **Signet is optional depth** — Unsigned composition marks are valid Innsigles.
   Cryptographic standing is opt-in power, not a tax on using the mark. This changes
   decisions when flows would force key setup before a maker can show a seal.

6. **Design for simplicity** — Start with the minimal viable approach. Extra
   complexity (C2PA pipelines, identity providers, multi-tenant accounts) needs a
   current requirement. This changes decisions when industry “full stack provenance”
   would bloat v1.

7. **Prefer reversible decisions** — When uncertain, choose what is easiest to undo.
   This changes decisions when confidence is low on crypto formats, domains, or stack.

8. **Spec is the contract** — The governing artifact stack is the source of truth;
   code is a projection of it. Keep traceability bidirectional.

9. **Validate your work** — Verify changes with the strongest appropriate evidence
   (tests, type checks, visual review, manual verify path).

10. **Make intent explicit** — Docs, copy, and code should show *why*, especially
    where claim vs fact and composition vs purity could be misread.

## Tension Resolution

| Tension | When it shows up | Resolution |
|---------|------------------|------------|
| Craft pride vs civic transparency | Compliance-heavy copy vs maker voice | Lead with craft; put legal/civic detail one layer deeper (footer, verify page, docs)—not in the seal’s first read |
| Mark first vs claim not oracle | Beautiful mark that looks like a “verified true” badge | Mark design must not use checkmark/shield-of-truth tropes; composition layout over authenticity theater |
| Edit is not origin vs craft pride | Desire to look fully human after model draft | Keep model on the bill; pride is honest BOM + optional house seal, not laundering |
| Signet optional vs attribution goals | Pushing signed verify rates vs low friction | Never block unsigned seals; measure signed share as secondary success, not launch gate |
| Simplicity vs industry interop | C2PA / platform demands | Stay portable and simple in v1; interop is a later bridge with an explicit FR, not a silent scope expand |
