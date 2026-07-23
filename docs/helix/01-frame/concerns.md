---
ddx:
  id: aibadge.concerns
  type: concerns
  links:
    - target: aibadge.product-vision
      kind: informed_by
    - target: aibadge.prd
      kind: informed_by
status: draft
activity: 01-frame
created: 2026-07-22
---

# Project Concerns

Project Concerns declare active cross-cutting context for **Innsigle**. They are
not principles, requirements, ADRs, test plans, or implementation tasks.

## Active Concerns

| Concern | Source | Areas | Why Active | Key Practices |
|---------|--------|-------|------------|---------------|
| `scope-discipline` | library | `area:brand`, `area:cli`, `area:web`, `area:crypto` | Brand-first product; easy to gold-plate into C2PA, detectors, or full IdP | Ship mark + mash bill + optional sign/verify first; park industrial provenance and multi-tenant identity unless an FR demands them |
| `claim-not-oracle` | project-local | `area:brand`, `area:web`, `area:cli`, `area:docs` | Category integrity: not an AI detector | Copy, UI, and verify results never imply detection scores; always attribute claims to a principal when signed |
| `visual-seal-system` | project-local | `area:brand`, `area:web` | Recognition is mark-first | One seal family for human / AI / mixed composition; readable mash-bill layout; no purity/shame color coding |
| `key-custody` | project-local | `area:cli`, `area:crypto` | DKIM-like signing needs safe keys without enterprise IdP in v1 | Local key generation; never log private keys; clear compromise guidance; public key discovery via URL or well-known path |
| `security-owasp` | library | `area:web`, `area:cli`, `area:crypto` | Verify pages and tooling handle untrusted input and keys | Input validation on claims; safe URL handling; no secret leakage in errors |
| `typescript-bun` | library (shipped-default) | `area:cli`, `area:web` | Language/runtime slot for tooling | Prefer TypeScript + Bun for CLI and any app code unless an ADR overrides |
| `testing` | library | `area:cli`, `area:web`, `area:crypto` | Assertions and verify paths must be falsifiable | Unit tests for hash/sign/verify; fixture mash bills; golden claim payloads |
| `verification` | library | `area:cli`, `area:web` | Claims-vs-reality for product integrity | No phantom “we verify AI content” claims; demos exercise real sign→verify |
| `product-microsite-ia` | library | `area:web`, `area:brand` | Brand site explains seal + mash bill + verify | Clear IA: what it is, how to use the mark, how to verify, what it is not |
| `a11y-wcag-aa` | library | `area:web`, `area:brand` | Seal and verify UI must be readable beyond color | Text labels for composition states; contrast; keyboard access on verify views |

## Slot resolutions

| Slot | Filler | Source |
|------|--------|--------|
| `language-runtime` | `typescript-bun` | shipped-default |
| `frontend-framework` | deferred / static-first | assumption — brand site may be static or light framework; lock in ADR when site builds |
| `e2e-framework` | `e2e-playwright` when UI exists | shipped-default (activate when verify UI ships) |
| `auth-provider` | none in v1 | assumption — no multi-tenant accounts; keys + public discovery only |
| `datastore` | none required in v1 | assumption — claims travel with content or sidecar; no central claim DB required for P0 |
| `deploy-target` | static host + npm/CLI distribute | assumption — lock when packaging |
| `architecture-style` | modular library + CLI + assets | assumption — not a multi-service backend |

## Project Overrides

| Concern | Practice | Override | Authority |
|---------|----------|----------|-----------|
| `auth` / multi-tenancy | Default HELIX account products | **Not selected** for v1 | Vision + PRD non-goals |
| `frontend-framework` | react-nextjs default | May use static site first | Needs ADR before non-static app |

## Area Labels

- `area:brand` — seal mark, visual system, wordmark, placement guidelines
- `area:web` — brand site, verify view, embed snippets
- `area:cli` — assert, sign, verify commands
- `area:crypto` — hashing, keys, signatures, discovery
- `area:docs` — human docs, “what this is not”
- `area:testing` — fixtures, crypto tests, visual regression later

## Concern Conflicts

| Conflict | Resolution |
|----------|------------|
| `visual-seal-system` vs `claim-not-oracle` | Mark may look authoritative as a *maker’s stamp*, not as a platform truth badge—no green check “authentic content” tropes |
| `key-custody` vs low-friction mark use | Unsigned seals require no keys; signing is a second step |
| `scope-discipline` vs future C2PA interop | Document as parking-lot / P2; do not shape v1 APIs solely for C2PA |
