---
title: "Claim System: Mash Bill, Storage, Signing"
slug: claim-system
activity: "Design"
source: "02-design/claim-system.md"
generated: true
supporting: false
---

> **Generated from HELIX docs.** Source: `docs/helix/02-design/claim-system.md`. Edit the source, not this file or `site/` HTML.

<details><summary>Source frontmatter</summary>

```yaml
ddx:
  id: aibadge.design.claim-system
  type: solution-design
  links:
    - target: aibadge.prd
      kind: informed_by
    - target: aibadge.design.attestation-prior-art
      kind: informed_by
    - target: aibadge.design-system
      kind: informed_by
status: draft
activity: 02-design
created: 2026-07-22
```

</details>

# Claim System: Mash Bill, Storage, Signing

Solution-level design for composition declaration and optional attestation.
Normative field names here are design intent; freeze in a Contract before
implementing the CLI.

**Prior art stance:** in-toto-shaped subject/predicate; PGP/DKIM-shaped
long-lived keys; TOFU key discovery for v1; optional later WoT cross-signs.
Details: `attestation-prior-art.md`.

## Goals

| Goal | Source |
|------|--------|
| Typed mash bill with named tools (Claude, sloptimizer, …) | PRD FR-1–4, FR-4a |
| Sign content hash + bill + issuer | PRD FR-9–12 |
| Docs-friendly storage (no media embed required) | UC-AI-docs |
| Social-safe mark without claim-in-file | UC-human-social |
| Not a detector; edit ≠ human-authored | Principles, FR-4a |

## Naming

| Term | Meaning |
|------|---------|
| **Mash bill** | Declared recipe of how the work was made (composition + ingredients) |
| **Composition** | Coarse state: `human-authored` \| `mixed` \| `model-primary` |
| **Ingredient** | One tool, model, or human role line item |
| **Claim** | JSON document: subjects + mash bill + metadata (unsigned or to-be-signed body) |
| **Attestation** | Claim body + signature by an issuer key |
| **Issuer** | Person or house key that signs |
| **Subject** | Content unit identified by digest (and optional URI) |
| **Seal / mark** | Visual Innsigle badge (see DESIGN.md) |
| **Signet** | Act of signing; optional depth |

Avoid public "credentials" for the product object (C2PA collision). Internal
type URIs may still say `attestation`.

## Mash bill schema (draft v1)

### Conceptual model

```text
MashBill
  composition: enum
  ingredients[]: Ingredient
  notes?: string          # short free text; not a loophole for hiding models
  schema_version: "1"

Ingredient
  kind: model | tool | human | other
  name: string            # "Claude", "sloptimizer", "Erik LaBianca"
  role?: string           # "draft", "edit", "structure", "rewrite"
  version?: string        # model id or tool version when known
  uri?: string            # optional link to product/docs
```

### Composition enum

| Value | When to use |
|-------|-------------|
| `human-authored` | Substantive prose/media produced by humans; models not primary authors |
| `mixed` | Material human and model authorship both present |
| `model-primary` | Model(s) produced most of the substantive content; humans may edit/structure |

**Rule (FR-4a):** Running sloptimizer (or similar) on model output does not by
itself change `model-primary` → `human-authored`. List sloptimizer as
`kind: tool`, `role: rewrite` (or similar).

### Claim document (unsigned body)

```json
{
  "innsigle": "1",
  "type": "https://innsigle.dev/claim/mash-bill/v1",
  "issued_at": "2026-07-22T18:00:00Z",
  "issuer": {
    "id": "azgaard",
    "name": "Azgaard",
    "key_id": "ed25519:BASE64URL_FINGERPRINT",
    "key_url": "https://azgaard.net/.well-known/innsigle/keys.json"
  },
  "subjects": [
    {
      "uri": "https://example.com/docs/page/",
      "digest": {
        "alg": "sha256",
        "value": "hex-or-base64url"
      }
    }
  ],
  "mash_bill": {
    "schema_version": "1",
    "composition": "model-primary",
    "ingredients": [
      {
        "kind": "model",
        "name": "Claude",
        "role": "draft",
        "version": null
      },
      {
        "kind": "tool",
        "name": "sloptimizer",
        "role": "rewrite",
        "uri": "https://github.com/easel/easel-skills"
      },
      {
        "kind": "human",
        "name": "Erik",
        "role": "structure-edit"
      }
    ],
    "notes": null
  }
}
```

Aligns with in-toto mentally: `subjects` ≈ subject digests; `mash_bill` ≈
predicate; `type` ≈ predicateType. v1 may ship this JSON without full DSSE.

### Canonical content hashing

| Content | v1 approach |
|---------|-------------|
| Single file | SHA-256 of raw bytes |
| HTML page | SHA-256 of **canonical bytes** defined by CLI (document exact rules in Contract): prefer raw file as published, or normalized UTF-8 without volatile fields |
| Multi-page site | Per-page claims, or one claim with multiple subjects (release set) |

Open: strip HTML comments / CDN query strings? Prefer: hash the artifact the
operator points at; document foot-guns.

## Storage mechanisms

### Design constraints

- Docs sites: static hosting, no required DB.
- Social: no reliance on platform-preserved metadata.
- Verify: offline possible given claim + content + pubkey.

### v1 stores

| Store | What lives there | Channel |
|-------|------------------|---------|
| **A. Sidecar file** | `page.innsigle.json` next to content or in `/.well-known/innsigle/claims/…` | Docs |
| **B. Embedded link** | Footer mark links to claim URL or `#innsigle` fragment page | Docs |
| **C. Inline unsigned bill** | Human-readable bill in HTML (optional duplicate of JSON fields) | Docs |
| **D. Mark asset only** | SVG/PNG + link to profile/bill explainer; no per-post signature | Social |
| **E. Key document** | `keys.json` (public keys, key_id, optional revoke) | Discovery |

### Not v1 (parked)

| Store | Why park |
|-------|----------|
| C2PA embed in JPEG/PNG | Social strip; media-first |
| Central claim database | Scope |
| DNS TXT for full claim | Size; use for key selectors later (DKIM-like) |
| Blockchain / always-on transparency log | Optional later (Sigstore Rekor-class) |

### Recommended layouts

**Docs (signed page):**

```text
site/
  docs/foo/index.html          # footer → seal + link
  .well-known/innsigle/
    keys.json
    claims/docs-foo.json       # attestation (claim + sig)
```

**Social:**

```text
mark: innsigle-human.svg (or PNG)
bio: https://azgaard.net/innsigle
# no per-tweet claim file required in v1
```

## Signing and attestation

### Algorithms (v1 proposal)

| Choice | Proposal | Rationale |
|--------|----------|-----------|
| Sign | Ed25519 | Small keys, modern default, wide support |
| Hash | SHA-256 | Universal |
| Key encode | JWK or raw base64url in `keys.json` | Simple; OpenPGP packets optional later |

ADR to freeze.

### Attestation envelope (v1 simple)

```json
{
  "payload": { /* claim body as above */ },
  "payload_encoding": "json",
  "signatures": [
    {
      "key_id": "ed25519:…",
      "alg": "ed25519",
      "sig": "base64url",
      "signed_at": "2026-07-22T18:00:01Z"
    }
  ]
}
```

**Signed bytes:** canonical JSON of `payload` (rules in Contract: key sort,
UTF-8, no insignificant whitespace) or hash of payload then sign hash.
Pick one in Contract; prefer sign-over-hash of canonical payload.

**Later (P2):** DSSE envelope + in-toto statement for cosign/SLSA ecosystem
alignment.

### Verify algorithm

1. Fetch attestation JSON.
2. Load issuer key by `key_id` from `key_url` or local pin.
3. Verify signature over payload (canonical).
4. Recompute digest of local/canonical content; match `subjects[].digest`.
5. Report: `valid` | `bad_signature` | `content_mismatch` | `unknown_key` | `revoked`.
6. Display mash bill fields regardless of validity, with clear banner if invalid.

Never report "this is 80% AI."

### Key lifecycle (v1)

| Operation | Behavior |
|-----------|----------|
| Generate | CLI creates Ed25519 keypair; private key local file; never log |
| Publish | Public key in `keys.json` at HTTPS URL |
| Rotate | New key_id; old optional `revoked_at`; new claims use new key |
| Discover | HTTPS `key_url` on claim; TOFU warn on first change of key material |
| WoT | Not required; optional later cross-sign of keys (PGP inspiration) |

### Trust policy (verifier)

| Level | Meaning |
|-------|---------|
| Crypto valid | Signature + content match |
| Issuer recognized | key_url / key_id in user's trust list or first-seen pin |
| Policy accept | User/org chooses to treat issuer as trusted for this class of content |

SLSA lesson: separate crypto success from policy trust.

## CLI surface (intent only; Contract later)

| Command intent | Result |
|----------------|--------|
| `bill init` / edit | Write mash bill fields |
| `claim build` | Bind subjects + bill → claim payload |
| `sign` | Attach signature with local key |
| `verify` | Path or URL to attestation + content |
| `keygen` / `key publish-template` | Key material + sample keys.json |

Exact flags belong in Contract, not here.

## Alignment matrix

| Prior art | Innsigle v1 choice |
|-----------|-------------------|
| PGP WoT | Deferred graph; steal fingerprint + user trust concept |
| DKIM | Steal domain/URL-published pubkey + sig over content |
| in-toto | Steal subject + predicate typing |
| SLSA | Steal provenance ≠ truth; policy separate |
| Sigstore | Optional later keyless/transparency |
| C2PA | Optional export; not primary store |
| SBOM | Steal typed ingredients discipline |
| Sloptimizer | Ingredient `tool`, not composition flip |

## Security notes

- Private keys never in claims or site static files.
- `key_url` must be HTTPS in production guidance.
- Treat claim `notes` as untrusted display text (escape HTML).
- Unsigned bills are allowed; UI must not look "more true" than signed ones
  without labeling signed/unsigned clearly.

## Open questions

- [x] Freeze Ed25519 + canonicalization in ADR → **ADR-001 accepted**
- [x] Claim/CLI normative surface → **CONTRACT-001** (+ JSON Schema)
- [ ] Type URI host (`innsigle.dev` vs azgaard.net path) when domain bought
- [ ] Multi-subject release claims for whole site versions (schema allows array)
- [ ] Whether `mixed` needs sub-ratios (human-led vs model-led)
- [ ] P2: map ingredients to IPTC digitalSourceType / C2PA assertions

## Implementation sequence (suggested)

1. ~~Schema JSON Schema + examples~~
2. ~~ADR + Contract freeze~~ (ADR-001, CONTRACT-001)
3. ~~Keygen + hash + sign + verify CLI~~ (`src/cli.mjs`, `npm test`)
4. ~~Golden test vectors~~ (`tests/vectors/`, `tests/vectors.test.mjs`)
5. ~~Docs footer + dogfood claim~~ (`docs/dogfood/`)
6. ~~Mark exploration pack~~ (`docs/dogfood/assets/marks/`)
7. Brand explainer / public site polish
8. Optional: in-toto/DSSE export; WoT cross-sign experiment
