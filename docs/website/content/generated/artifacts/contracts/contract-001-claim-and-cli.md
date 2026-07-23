---
title: "Contract"
slug: CONTRACT-001-claim-and-cli
activity: "Design"
source: "02-design/contracts/CONTRACT-001-claim-and-cli.md"
generated: true
supporting: false
collection: "contracts"
---

> **Generated from HELIX docs.** Source: `docs/helix/02-design/contracts/CONTRACT-001-claim-and-cli.md`. Edit the source, not this file or `site/` HTML.

<details><summary>Source frontmatter</summary>

```yaml
ddx:
  id: aibadge.contract.001
  type: contract
  links:
    - target: aibadge.adr.001
      kind: informed_by
    - target: aibadge.design.claim-system
      kind: informed_by
    - target: aibadge.prd
      kind: informed_by
status: draft
activity: 02-design
created: 2026-07-22
```

</details>

# Contract

**Contract ID:** CONTRACT-001  
**Type:** schema + CLI  
**Version:** v1  
**Status:** draft (normative for implementers; bump version on breaking field changes)  
**Related:** ADR-001; claim-system.md; PRD FR-1–4a, FR-8–12, FR-18–19

## Purpose

Define the colophon claim document, attestation envelope, public key document,
content hashing rules for v1, and CLI commands that produce and verify them.

## Scope and Boundaries

- **In scope:** JSON claim payload; attestation envelope; `keys.json`; SHA-256
  content digests; Ed25519 sign/verify; CLI verbs listed below.
- **Out of scope:** C2PA embed; DSSE/in-toto wire format (MAY export later);
  multi-tenant accounts; social platform APIs; HTML DOM normalization beyond
  "hash the file bytes given."
- **Owning system:** Innsigle CLI / library (TypeScript + Bun assumed).

## Normative Surface

Use MUST / MUST NOT / SHOULD / MAY as written.

### Claim payload

A claim payload MUST be a JSON object with:

| Element | Type | Required | Rules |
|---------|------|----------|-------|
| `innsigle` | string | yes | MUST be `"1"` for this version |
| `type` | string (URI) | yes | MUST be `https://innsigle.dev/claim/colophon/v1` until domain freeze changes it via version bump |
| `issued_at` | string | yes | MUST be RFC 3339 UTC timestamp |
| `issuer` | object | yes | See issuer object |
| `subjects` | array | yes | MUST contain ≥1 subject |
| `colophon` | object | yes | See colophon object |

#### issuer object

| Element | Type | Required | Rules |
|---------|------|----------|-------|
| `id` | string | yes | Stable issuer slug (e.g. `azgaard`) |
| `name` | string | yes | Display name |
| `key_id` | string | yes | MUST match a key in the issuer key document; format `ed25519:<fingerprint>` |
| `key_url` | string | yes | HTTPS URL of `keys.json` (or local `file:` only for tests) |

#### subject object

| Element | Type | Required | Rules |
|---------|------|----------|-------|
| `uri` | string | no | Content locator when known |
| `digest` | object | yes | `alg` MUST be `"sha256"`; `value` MUST be lowercase hex of SHA-256 |

#### colophon object

| Element | Type | Required | Rules |
|---------|------|----------|-------|
| `schema_version` | string | yes | MUST be `"1"` |
| `composition` | string | yes | MUST be one of `human-authored`, `mixed`, `model-primary` |
| `ingredients` | array | yes | MAY be empty only if composition is `human-authored` and notes explain; SHOULD list tools/models when used |
| `notes` | string or null | no | Free text; MUST NOT replace required composition honesty |

#### ingredient object

| Element | Type | Required | Rules |
|---------|------|----------|-------|
| `kind` | string | yes | MUST be one of `model`, `tool`, `human`, `other` |
| `name` | string | yes | Non-empty |
| `role` | string | no | e.g. `draft`, `edit`, `rewrite` |
| `version` | string or null | no | Model/tool version when known |
| `uri` | string | no | Link to tool/model docs |

**Composition integrity:** Implementations MUST NOT offer a mode that sets
`composition` to `human-authored` solely because an editorial tool (including
sloptimizer) rewrote model-primary text. Tools MUST be listable as
`kind: "tool"`.

### Attestation envelope

| Element | Type | Required | Rules |
|---------|------|----------|-------|
| `payload` | object | yes | MUST be a claim payload as above |
| `payload_encoding` | string | yes | MUST be `"json"` |
| `signatures` | array | yes | MUST contain ≥1 signature object for signed attestations |

#### signature object

| Element | Type | Required | Rules |
|---------|------|----------|-------|
| `key_id` | string | yes | MUST match `payload.issuer.key_id` for the primary signature |
| `alg` | string | yes | MUST be `"ed25519"` |
| `sig` | string | yes | base64url (no padding) raw Ed25519 signature |
| `signed_at` | string | yes | RFC 3339 UTC |

**Bytes to sign (ADR-001):**  
Let `canonical = JCS(payload)` per RFC 8785.  
Let `h = SHA-256(canonical)` (raw 32 bytes).  
`sig` MUST be Ed25519 signature of `h` using the issuer private key.

Unsigned claims MAY be distributed as payload-only JSON for display; they MUST
NOT be labeled as signed in UI or CLI success paths.

### Key document (`keys.json`)

| Element | Type | Required | Rules |
|---------|------|----------|-------|
| `innsigle_keys` | string | yes | MUST be `"1"` |
| `issuer_id` | string | yes | Matches claim `issuer.id` |
| `issuer_name` | string | yes | Display |
| `keys` | array | yes | ≥0 keys (empty means no active keys) |

#### key object

| Element | Type | Required | Rules |
|---------|------|----------|-------|
| `key_id` | string | yes | `ed25519:` + fingerprint |
| `alg` | string | yes | `"ed25519"` |
| `public_key` | string | yes | base64url 32-byte public key |
| `created_at` | string | yes | RFC 3339 |
| `revoked_at` | string or null | yes | null if active |

**Fingerprint:** lowercase hex of SHA-256 over the 32-byte public key, truncated
to first 16 bytes (32 hex chars), prefixed as `ed25519:<hex>`.

### Content hashing (v1)

- For a subject that is a **file**, digest MUST be SHA-256 of the exact file
  bytes the operator supplies (no silent transcoding).
- CLI MUST record the path or URI used when building the claim.
- HTML "live page" fetch MAY be supported later; v1 CLI MUST support local file
  subjects.

### CLI

Binary name: `innsigle` (package may ship as such).

| Command | Args (normative intent) | Behavior |
|---------|-------------------------|----------|
| `innsigle keygen` | `--out-dir <dir>` | MUST write private key (permissions 0600 when FS supports) and public material; MUST NOT print private key |
| `innsigle keys template` | `--issuer-id` `--issuer-name` `--public-key` | MUST emit `keys.json` skeleton |
| `innsigle claim build` | `--content <file>` `--uri <uri?>` `--colo <colo.json>` `--issuer <issuer fields>` | MUST emit claim payload JSON on stdout or `--out`; MAY accept `--bill` as alias for `--colo` |
| `innsigle sign` | `--claim <file>` `--key <private>` | MUST emit attestation envelope |
| `innsigle verify` | `--attestation <file>` `--content <file>` `--keys <file\|url>` | MUST exit 0 iff signature valid, key not revoked, and content digest matches; MUST exit non-zero otherwise |
| `innsigle colo example` | `--kind model-primary\|human-authored\|mixed` | MUST print example colophon JSON; MAY accept `bill example` as alias |

#### verify exit codes

| Code | Meaning |
|------|---------|
| 0 | Valid signature, active key, content match |
| 1 | Usage / IO error |
| 2 | Bad signature |
| 3 | Content digest mismatch |
| 4 | Unknown or revoked key |
| 5 | Invalid schema invalid |

#### verify stdout (human)

MUST include lines sufficient to see: result keyword (`VALID` / `INVALID`),
issuer id, composition, and failure reason when invalid. MUST NOT print AI
detection scores.

## Precedence and Compatibility

- Versioning: `innsigle` field and `schema_version` / `innsigle_keys` govern
  payload compatibility. Breaking changes MUST bump these and the contract
  version.
- Unknown JSON fields in payload: verifiers MUST ignore unknown fields when
  verifying signatures (signature covers canonical form of known payload as
  signed; producers SHOULD avoid unknown fields in v1).
- Deprecation: announce in release notes; keep verify for prior `innsigle: "1"`
  for at least one minor series after a bump.

## Error Semantics

| Condition | Outcome | Retry |
|-----------|---------|-------|
| Missing file | exit 1 | no |
| Invalid JSON schema | exit 5 | no |
| Signature fail | exit 2 | no |
| Digest mismatch | exit 3 | no |
| Revoked key | exit 4 | no |

## Examples

See:

- `docs/helix/02-design/examples/claim-model-primary-docs.json`
- `docs/helix/02-design/examples/keys.json`

```text
innsigle keygen --out-dir ~/.config/innsigle/azgaard
innsigle claim build --content ./site/index.html --uri https://example.com/ \
  --colo ./colo.json --out claim.json
innsigle sign --claim claim.json --key ~/.config/innsigle/azgaard/ed25519.priv \
  --out claim.attestation.json
innsigle verify --attestation claim.attestation.json --content ./site/index.html \
  --keys ./keys.json
```

## Non-Normative Notes

- Type URI host `innsigle.dev` is provisional until domain purchase.
- JCS libraries: implement or depend on a reviewed RFC 8785 implementation;
  golden vectors will live under `tests/vectors/` when code lands.
- Social UC often uses mark assets without per-post `sign`.

## Validation Checklist

- [x] Normative fields and rules explicit
- [x] Compatibility rules explicit
- [x] Error / exit codes explicit
- [x] Tests can be derived (golden vectors + CLI exits)
- [x] Non-normative section separated
