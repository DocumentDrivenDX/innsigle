---
ddx:
  id: innsigle.adr.004
  type: adr
  links:
    - target: innsigle.adr.003
      kind: informed_by
    - target: innsigle.contract.001
      kind: informs
status: accepted
activity: 02-design
created: 2026-09-16
---

# ADR-004: Human key, build key, and derived pages

| Date | Status | Deciders | Related | Confidence |
|------|--------|----------|---------|------------|
| 2026-09-16 | Accepted | Operator | ADR-003 D4–D5; Helix microsite seals | High |

## Context

HELIX (and this microsite) seal documentation with Innsigle. One house key
was signing **curated mixed/human pages** and **generated reference pages**.
That collapses key provenance: a GitHub Actions secret that can seal
model-primary output can also seal a page that claims to be mixed. PGP-style
web of trust already exists in ADR-003 (key-endorsement) but was unused.

Rendered HTML is a **deterministic function** of sealed markdown. Signing the
HTML with the human key would put that key in CI and go stale on every
layout tweak. The HTML must **carry** the source signature, not replace it.

## Decision

### D1 — Two roles, one issuer document

| Role | Custody | Seals |
|------|---------|--------|
| **human** | Operator (1Password / local PEM, never GitHub) | `human-authored` and `mixed` sources in git |
| **build** | CI (`INNSIGLE_BUILD_KEY`) or a gitignored local PEM | `model-primary` / `generated: true` sources; optional later derivation receipts |

Both public keys live in the same issuer document (`keys.json`). Identity is
still `key_id` + `key_url` (ADR-003). Optional `role` on a key object is
display only.

### D2 — Human key endorses the build key

The human key publishes a **key-endorsement** (ADR-003 D4) over the build
`key_id` / `key_url`, purpose `build-signing`. Verifiers who pin the human
key **recognize** build-key seals transitively (D5, depth 1 is enough here).

The build key MUST NOT endorse the human key. CI compromise must not mint
human-role seals.

### D3 — Seal policy (`innsigle seal --all`)

- `--role human` — only mixed / human-authored; requires the human private key
- `--role build` — only model-primary; requires `INNSIGLE_BUILD_KEY` or
  `keys.build.signing_key`
- `--all` with no role — each file uses the matching key; skip (do not fail)
  when that key is absent

A digest match does **not** skip if the existing claim was signed by the
wrong role (migration).

### D4 — Derived pages quote the source seal

The published HTML is not the subject of the human signature. The colophon
**embeds** the source attestation (bytes + `application/innsigle+json`) and
MUST say the signature covers the **markdown source**, not the HTML bytes.

A viewer who verifies that attestation against the source file (or a
byte-identical checkout) has the same guarantee Helix wanted from a page
seal, without putting the human key in GitHub.

## Consequences

- Curated claims are committed; they change only when a human reseals.
- Generated claims may be committed (local build key) or refreshed in CI
  with `INNSIGLE_BUILD_KEY`.
- `innsigle verify --all` still checks crypto-VALID. Recognition
  (human pin → build via endorsement) is extra chrome, not a new VALID
  meaning.
- Signing HTML with the human key remains a non-goal.
