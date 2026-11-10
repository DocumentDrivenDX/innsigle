---
ddx:
  id: innsigle.contract.001
  type: contract
  links:
    - target: innsigle.adr.001
      kind: informed_by
    - target: innsigle.design.claim-system
      kind: informed_by
    - target: innsigle.prd
      kind: informed_by
    - target: innsigle.adr.005
      kind: informed_by
status: draft
activity: 02-design
created: 2026-07-22
---

# Contract

**Contract ID:** CONTRACT-001  
**Type:** schema + CLI  
**Version:** v1.2  
**Status:** draft (normative for implementers; bump version on breaking field changes)  
**Related:** ADR-001; ADR-003; ADR-005; claim-system.md; PRD FR-1–4a, FR-8–12, FR-18–25

## Purpose

Define the colophon claim document, attestation envelope, public key document,
content hashing rules for v1, and CLI commands that produce and verify them.

## Scope and Boundaries

- **In scope:** JSON claim payload; attestation envelope; `keys.json`; SHA-256
  content digests; Ed25519 sign/verify; CLI verbs listed below.
- **Out of scope:** C2PA embed; DSSE/in-toto wire format (MAY export later);
  multi-tenant accounts; social platform APIs; HTML DOM normalization beyond
  "hash the file bytes given."
- **Sibling type (FEAT-005):** maker profiles (`innsigle_profile`) and plain
  colophon claims (`https://innsigle.dev/claim/plain-colophon/v1`) are unsigned
  declarations with no content digest. They are **not** this contract's claim
  payload. `innsigle verify` MUST reject them (exit 5) and MUST NOT print
  `VALID`.
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
| `id` | string | yes | Display slug (e.g. `azgaard`); **not** globally unique; not a crypto identifier (ADR-003) |
| `name` | string | yes | Display name |
| `key_id` | string | yes | MUST match a key in the issuer document; format `ed25519:<fingerprint>` |
| `key_url` | string | yes | **Absolute** URL of the issuer document (ADR-003). Production MUST use `https:`. Relative URLs are invalid. `http:` only for loopback/tests. `file:` only for offline tests. **Covered by the claim signature** via ADR-001 JCS of the full payload. |

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
| `human_input` | object | no | Declared human-input measure (v1.1); when present MUST satisfy the human_input rules below. MUST be omitted (never null) when journal evidence is absent |

#### ingredient object

| Element | Type | Required | Rules |
|---------|------|----------|-------|
| `kind` | string | yes | MUST be one of `model`, `tool`, `human`, `other` |
| `name` | string | yes | Non-empty |
| `role` | string | no | e.g. `draft`, `edit`, `rewrite` |
| `version` | string or null | no | Model/tool version when known |
| `uri` | string | no | Link to tool/model docs |

#### human_input object (v1.1)

| Element | Type | Required | Rules |
|---------|------|----------|-------|
| `method` | string | yes | MUST be `"hi1"` in this contract version |
| `basis` | string | yes | MUST be `"session-journal"` |
| `percent` | integer | yes | 0–100. MUST equal the round-half-up recomputation from the component raw counts and `weights` over non-null components (exact rationals, not floats) |
| `weights` | object | yes | Integer weights per component; MUST match the method's published weights (`hi1`: direction 25, contribution 40, review 35) |
| `direction` | object or null | yes | `{percent, user_prompts, model_write_bursts}`, all integers ≥ 0 |
| `contribution` | object or null | yes | `{percent, human_chars, model_chars, human_write_events, coverage}`; `coverage` MUST be `full` or `partial` |
| `review` | object or null | yes | `{percent, post_output_prompts, review_events}`, all integers ≥ 0 |

All numeric fields MUST be integers (JCS float hazards, ADR-001).
`contribution` MUST be non-null — char evidence is the required core of the
measure; a headline computed from direction/review alone would overstate human
input on works with no char evidence. `direction` and `review` MUST be null
when and only when there are no model write bursts. The measure is a **maker declaration derived from
the maker's own session journal** (see session-provenance.md "Human-input
measure (hi1)") — implementations MUST NOT present it as an AI-detection
verdict about the text (PRD FR-20a), and MUST NOT alter component counts to
reach a target percent.

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

### Attestation file with reviews (v1.2, ADR-005)

A per-document attestation file MAY carry additional independently signed
attestations beside the authorship claim:

| Element | Type | Required | Rules |
|---------|------|----------|-------|
| `payload`, `payload_encoding`, `signatures` | | yes | The authorship (colophon) attestation, exactly as above. Earlier verifiers read only these |
| `reviews` | array | no | Zero or more complete review attestations (envelope = `payload`, `payload_encoding`, `signatures`). Each is signed by its own key |

Producers that rewrite an attestation file (any `seal` path) MUST carry
`reviews` over unchanged. The authorship signature MUST NOT cover `reviews`.
Verifiers that do not know `reviews` ignore it.

### Review claim (v1.2)

**Type** MUST be `https://innsigle.dev/claim/review/v1`. Schema:
`schemas/review-claim.schema.json`; example: `examples/review-claim.json`.

| Element | Type | Required | Rules |
|---------|------|----------|-------|
| `innsigle` | string | yes | `"1"` |
| `type` | string | yes | Review type URI |
| `issued_at` | string | yes | RFC 3339 UTC; the review date |
| `issuer` | object | yes | As colophon claims; `key_id` is the reviewer's signing key |
| `subjects` | array | yes | Exactly one subject; `digest` is the SHA-256 of the same bytes the colophon seal covers; `uri` optional |
| `review` | object | yes | See below |
| `colophon` | — | MUST NOT | A review claim MUST NOT carry a colophon (FR-4a) |

`review` object:

| Element | Type | Required | Rules |
|---------|------|----------|-------|
| `schema_version` | string | yes | `"1"` |
| `reviewer` | object | yes | `{key_id, name?}`; `key_id` MUST equal `issuer.key_id`; `name` optional non-empty — deployments MAY publish key ids only |
| `scope` | `"full"` or array | no | Omitted means `full`; otherwise a non-empty array of unique, non-empty opaque claim ids |
| `expires_at` | string | no | RFC 3339 UTC, MUST be after `issued_at` |
| `composition`, `human_input` | — | MUST NOT | A review never states or alters composition |

**Validity.** A review is `REVIEWED` for content with digest `X` at time `t`
iff: schema valid; `signatures[0].key_id == issuer.key_id`; the key exists, is
not revoked, and the signature verifies over JCS(payload) (ADR-001); the key is
**human-role** (ADR-005 D2); `subjects[0].digest.value == X`; and `expires_at`
is absent or `> t`. Otherwise the state is `REVIEW-INVALID(reason)` (reasons:
`schema`, `key_mismatch`, `unknown_key`, `revoked_key`, `bad_signature`,
`wrong_role`), `REVIEW-STALE` (digest differs), or `REVIEW-EXPIRED`. Authenticity
is decided before freshness. A key that is build-role by any rule MUST NOT be
accepted as a reviewer.

Roles: **human** = `config.keys.human` (plus `review.reviewer_key_ids`) when
pinned, otherwise `keys.json` `role: "human"`, the signer of a valid
`build-signing` endorsement, or the sole active key of a house with no build
key. **build** = `config.keys.build`, `keys.json` `role: "build"`, or the
subject of a valid human-signed `build-signing` endorsement.

### Derivation claim (v1.2)

**Type** MUST be `https://innsigle.dev/claim/derivation/v1`. Schema:
`schemas/derivation-claim.schema.json`; example: `examples/derivation-claim.json`.
Stored in a built tree at
`<tree>/.well-known/innsigle/derivations/<slug>.derivation.json`.

| Element | Type | Required | Rules |
|---------|------|----------|-------|
| `innsigle`, `type`, `issued_at`, `issuer` | | yes | As above; `issuer.key_id` MUST be a build-role key endorsed (`build-signing`) by a human key |
| `subjects` | array | yes | ≥1 output: `{path, digest{alg,value}, uri?}`; `path` tree-relative posix, no leading `/`, no `..` |
| `derivation.schema_version` | string | yes | `"1"` |
| `derivation.transform` | object | no | `{name, version?}` |
| `derivation.inputs` | array | yes | ≥1 source: `{path, id?, digest, reviews[]}`; `reviews` holds human review attestations **verbatim** (never re-signed); MAY be empty (which verifies as `review_missing`) |
| `colophon` | — | MUST NOT | A derivation transfers review, not authorship |

**Verification** (per output, in this order; each failure names its reason):
output digest equals `subjects[].digest` (`output_missing`, `output_mismatch`);
signature valid and key active (`bad_signature`, `unknown_key`, `revoked_key`);
signer is build-role (`wrong_role`) and endorsed by a human key
(`build_key_unendorsed`); every input has at least one embedded review that is
`REVIEWED` for `inputs[].digest` at verification time (`review_missing`,
`review_stale`, `review_expired`, `review_invalid(…)`). With a source tree,
each `inputs[].digest` MUST equal the current source digest (`source_changed`).
**Bundles:** all inputs MUST pass. **Fan-out:** a claim with N subjects is
equivalent to N claims; a verifier indexes by output path and digest.

### Content hashing of markdown with front matter

Unchanged: SHA-256 of the exact file bytes. Front matter is part of the content;
no normalization. A configured document id (below) is read from front matter
without affecting the digest.

### Attestation key (v1.2)

Default attestation filename key is the project-relative path slug. With
`attestation_key: {"frontmatter": "<dotted.path>"}` in `.innsigle/config.json`
the key is `id-<id>` where `<id>` is the front-matter value, which MUST match
`^[a-z0-9][a-z0-9._-]{0,127}$` and be unique among `content_globs`; `seal` MUST
fail (exit 5) on a missing, malformed or duplicate id.

### Issuer document (at `key_url`)

Canonical document for key discovery and optional web-of-trust edges (**ADR-003**).

#### Preferred form (`innsigle_issuer`)

| Element | Type | Required | Rules |
|---------|------|----------|-------|
| `innsigle_issuer` | string | yes | MUST be `"1"` |
| `issuer_id` | string | yes | Display slug; SHOULD match claim `issuer.id` |
| `issuer_name` | string | yes | Display |
| `keys` | array | yes | ≥0 keys (empty means no active keys) |
| `endorsements` | array | no | Default `[]`. Index of key-endorsement attestations published by this issuer |

#### Legacy form (`innsigle_keys`)

| Element | Type | Required | Rules |
|---------|------|----------|-------|
| `innsigle_keys` | string | yes | MUST be `"1"` (pre-ADR-003) |
| `issuer_id` | string | yes | Display slug |
| `issuer_name` | string | yes | Display |
| `keys` | array | yes | Same as preferred form |

Verifiers MUST accept either form. Legacy form implies `endorsements: []`.

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

#### endorsements[] index entry

| Element | Type | Required | Rules |
|---------|------|----------|-------|
| `attestation_url` | string | yes | Absolute URL of a key-endorsement attestation JSON |
| `subject_key_id` | string | yes | Endorsee `key_id` |
| `subject_key_url` | string | yes | Absolute URL of endorsee issuer document |
| `issued_at` | string | no | Hint only; attestation payload is authoritative |

### Key-endorsement claim (ADR-003)

Optional claim type for web-of-trust edges. **Type** MUST be
`https://innsigle.dev/claim/key-endorsement/v1`.

| Element | Type | Required | Rules |
|---------|------|----------|-------|
| `innsigle` | string | yes | `"1"` |
| `type` | string | yes | Key-endorsement type URI above |
| `issued_at` | string | yes | RFC 3339 UTC |
| `issuer` | object | yes | **Endorser** — same rules as colophon claims, including absolute `key_url` |
| `endorsement` | object | yes | See below |

#### endorsement object

| Element | Type | Required | Rules |
|---------|------|----------|-------|
| `subject_key_id` | string | yes | Endorsee key fingerprint id |
| `subject_key_url` | string | yes | Absolute URL of endorsee issuer document |
| `subject_issuer_id` | string | no | Display slug of endorsee (non-unique) |
| `level` | string | no | One of `full`, `marginal`, `unknown` (PGP-inspired; default `full` if omitted) |
| `purpose` | string | no | MUST NOT claim content truth; default `identity` — trust for recognizing seals |

Key-endorsement attestations use the same envelope and ADR-001 crypto as colophon
claims. They do **not** authenticate content honesty.

### Signed `key_url` rules (normative)

1. Producers of **signed** claims MUST set `issuer.key_url` to an absolute URL.
2. The signature (ADR-001) covers the full payload including `issuer.key_url`.
3. Verifiers MUST discover keys using the **signed** `issuer.key_url` unless applying an explicit local pin/override.
4. `issuer.id` MUST NOT be treated as a globally unique or cryptographic identifier.
5. `key_url` MAY be any durable HTTPS origin that serves the issuer document (self-hosted, git forge raw/Pages, static free host, etc.). **Self-operated webserver is not required** (ADR-003 D7).
6. Social profile text and “link in bio” fields MAY embed an **issuer card** (fingerprint + keys URL) for human discovery. Profile embeds are **not** signatures and MUST NOT be treated as cryptographic proof by themselves.

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
| `innsigle init` | `--onepassword` `[--dir]` `[--site-url]` `[--issuer-*]` `[--vault]` `[--force]` | MUST create house key custody outside the repo (1Password when `--onepassword`); MUST write all repo-local state under `.innsigle/` only (no framework web-root detection); MUST stage public issuer document at `.innsigle/public/keys.json` for publish to site `/.well-known/innsigle/keys.json`; MUST write commit-safe `.innsigle/config.json` with `key_id` fingerprint and custody reference; MUST write agent-oriented publish instructions under `.innsigle/`; MUST NOT write private key material into the repo |
| `innsigle seal` | `<content>` `[--kind]` `[--colo]` `[--uri]` `[--out]` `[--role human\|build]` | MUST claim+sign using `.innsigle/config.json` issuer fields and 1Password (or `--key`); MUST write attestation under `.innsigle/public/claims/` by default; MUST NOT require repeating issuer flags. When `keys.human` / `keys.build` are configured (ADR-004), MUST sign `human-authored`/`mixed` with the human key and `model-primary` with the build key unless `--role` overrides |
| `innsigle seal --all` | `[--role human\|build]` `[--force]` | MUST walk `content_globs`; MUST pick composition from frontmatter when `kind_from_frontmatter` is set — with `true`, `generated: true` → `model-primary` else `default_composition` (default `mixed`); with `{"field": "<name>"}`, that frontmatter key MUST hold one of `model-primary`, `human-authored`, `mixed`, and a value outside that set MUST fail rather than coerce; MUST skip up-to-date claims signed by the same `key_id`; MUST skip (not fail) files whose role key is absent unless `--role` was required; MUST remove ORPHAN claims |
| `innsigle endorse` | `--subject-key-id` `[--subject-key-url]` `[--purpose]` `[--level]` | MUST sign a key-endorsement (ADR-003 D4) with the human key; MUST index it on the issuer document `endorsements[]`; MUST NOT let the build key endorse the human key |
| `innsigle review` | `<file>` \| `--all` \| `--stale` `[--scope full\|id,id]` `[--expires Nd\|YYYY-MM-DD\|RFC3339]` `[--reviewer-name N \| --anonymous]` `[--yes]` `[--force]` | MUST sign with the human key only and MUST refuse `--role build`; MUST require a current authorship seal for the file; MUST require confirmation (TTY prompt or `--yes`; PROV-05); MUST merge into `reviews[]` (superseding only the same reviewer's older entries); MUST self-verify before writing; `--all` reviews in-scope files not currently REVIEWED, `--stale` only REVIEW-STALE/EXPIRED |
| `innsigle derive` | `--tree <dir>` `--from <src>`… `--output <path>`… `[--transform name@ver]` `[--require-review]` `[--out file]` | MUST sign with an endorsed build key; MUST embed each source's currently valid reviews verbatim; with `--require-review` MUST refuse (exit 6) if any source has none; writes `<tree>/.well-known/innsigle/derivations/` |
| `innsigle verify` | `--derived <tree>` `[--keys f]` `[--source-root dir]` `[--cover glob]`… | MUST verify every derivation claim in the tree per the derivation rules and always requires a valid human review for every input; exit codes below |
| `innsigle verify --all` | `[--require-review]` `[--require-full-scope]` | As before; with `--require-review` exits 6 when all seals are VALID but an in-scope claim lacks a valid, unexpired human review; exit 1 if any seal is not VALID |
| `innsigle status` | `[--reviews]` | As before; adds REVIEWED / UNREVIEWED / REVIEW-STALE / REVIEW-EXPIRED / REVIEW-INVALID(reason) per claim when `--reviews`, `--require-review`, a `review` config object, or any stored review is present |
| `innsigle publish` | `[site-dir]` | MUST copy `.innsigle/public/` to `<site-dir>/.well-known/innsigle/` |
| `innsigle keygen` | `--out-dir <dir>` | MUST write private key (permissions 0600 when FS supports) and public material; MUST NOT print private key |
| `innsigle keys template` | `--issuer-id` `--issuer-name` `--public-key` `--key-id` | MUST emit issuer document skeleton (`innsigle_issuer` preferred; includes `endorsements: []`) |
| `innsigle claim build` | `--content <file>` `--uri <uri?>` `--colo <colo.json>` `--issuer-*` `--key-url` | MUST emit claim payload JSON; MUST reject non-absolute `key_url` (exit 5); MAY accept `--bill` as alias for `--colo`; MAY default issuer fields from `.innsigle/config.json` |
| `innsigle sign` | `--claim <file>` `--key <private?>` | MUST emit attestation envelope; SHOULD refuse unsigned path if claim lacks absolute `key_url`; MAY load private key from `--key`, `--op-ref`, or `.innsigle/config.json` → 1Password (`op read`) |
| `innsigle verify` | `<content>` **or** `--attestation` `--content` `--keys` | Short form MUST resolve attestation and keys from `.innsigle/` (or published well-known next to content) when possible |
| `innsigle verify` | `--attestation <file>` `--content <file>` `--keys <file\|url>` | MUST exit 0 iff signature valid, key not revoked, and content digest matches; MUST exit non-zero otherwise. Identity/WoT recognition is separate (ADR-003). MUST reject maker profiles and `plain-colophon` documents (exit 5) and MUST NOT print `VALID` for them |
| `innsigle colo example` | `--kind model-primary\|human-authored\|mixed` | MUST print example colophon JSON; MAY accept `bill example` as alias |
| `innsigle profile init` | `--id` `--name` `[--out-dir]` `[--url]` `[--bio]` `[--force]` | MUST write `profile.json` + `index.html` without keys or `.innsigle/` |
| `innsigle profile add` | `--title` `--kind` `[--url]` `[--model]` `[--ingredient]` `[--profile]` | MUST append a `kind=plain` work; MUST refuse `human-authored` plus a model ingredient (FR-4a); MUST print a footer line |
| `innsigle profile render` / `footer` / `bio` / `validate` / `claim` | `[--profile]` | Render standalone HTML; copy bio/footer; schema check; emit a plain-colophon JSON. MUST NOT call the verify success path |

#### verify exit codes

| Code | Meaning |
|------|---------|
| 0 | Valid signature, active key, content match |
| 1 | Usage / IO error |
| 2 | Bad signature |
| 3 | Content digest mismatch |
| 4 | Unknown or revoked key |
| 5 | Invalid schema invalid |
| 6 | (v1.2) Review chain failure: `verify --all --require-review` with an otherwise VALID tree, or `verify --derived` review_missing / review_stale / review_expired / review_invalid / source_changed. For `verify --derived`, 3 also covers output_missing/mismatch and no derivation, and 4 also covers wrong-role and unendorsed build keys |

#### verify stdout (human)

MUST include lines sufficient to see: result keyword (`VALID` / `INVALID`),
issuer id, composition, and failure reason when invalid. MUST NOT print AI
detection scores. The declared `colophon.human_input` measure MAY be printed
with its method tag (it is a maker declaration, not a detection score).

## Precedence and Compatibility

- Versioning: `innsigle` field and `schema_version` / `innsigle_keys` /
  `innsigle_issuer` govern payload and issuer-document compatibility. Breaking
  changes MUST bump these and the contract version.
- Related decision records: **ADR-001** (crypto), **ADR-003** (issuer URL + WoT), **ADR-004** (human vs build keys; derived pages quote source seals).
- Unknown JSON fields in payload: verifiers MUST ignore unknown fields when
  verifying signatures (signature covers canonical form of known payload as
  signed; producers SHOULD avoid unknown fields in v1).
- Deprecation: announce in release notes; keep verify for prior `innsigle: "1"`
  for at least one minor series after a bump.
- v1.2 adds the review and derivation claim types, the optional `reviews[]`
  array on attestation files, `attestation_key`, config `review`, and exit code
  6. Additive: existing attestation files, commands and exit codes are
  unchanged; v1.0/v1.1 verifiers ignore `reviews[]`.
- v1.1 adds the optional `colophon.human_input` object. Additive: colophon
  `schema_version` stays `"1"`; v1 verifiers ignore it under the unknown-field
  rule and existing attestations remain valid.

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
- `docs/helix/02-design/examples/keys.json` (legacy keys-only)
- `docs/helix/02-design/examples/issuer-document.json` (ADR-003 issuer + endorsements index)
- `docs/helix/02-design/examples/key-endorsement-claim.json`
- `docs/helix/02-design/examples/review-claim.json`,
  `document-with-review.attestation.json`, `derivation-claim.json` (golden
  copies in `tests/vectors/review/`)

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
