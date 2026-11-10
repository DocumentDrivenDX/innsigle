---
ddx:
  id: innsigle.adr.005
  type: adr
  links:
    - target: innsigle.adr.001
      kind: informed_by
    - target: innsigle.adr.003
      kind: informed_by
    - target: innsigle.adr.004
      kind: informed_by
    - target: innsigle.feat.006
      kind: informs
    - target: innsigle.contract.001
      kind: informs
status: accepted
activity: 02-design
created: 2026-11-10
---

# ADR-005: Review claim, derivation claim, multi-claim attestation files

| Date | Status | Deciders | Related | Confidence |
|------|--------|----------|---------|------------|
| 2026-11-10 | Accepted | Operator | ADR-001, ADR-003, ADR-004; FR-4a; PROV-05; FEAT-006 | High |

## Context

A seal attests **how content was made** (the colophon). It says nothing about
whether anyone read it. A `model-primary` document sealed by a build key
verifies `VALID`; the composition is honest and still no human looked at it.
`human_input` (hi1) has a "review" weighting, but that is a maker-declared
measure derived from a session journal, not a signed statement by an identified
key that a person reviewed these exact bytes. `endorse` is explicitly "seal
recognition, not content truth".

Publishers of machine-authored content need a gate: **refuse to publish any
document that has no valid human review**, enforceable in CI, with the build
key allowed to seal and to *carry* reviews but never to originate one. Two
practical constraints shape the design:

1. The published artifact is usually not the reviewed file (markdown → HTML,
   many sources → one JSON bundle), so its digest differs from the one the human
   reviewed.
2. Seals live in the content repo and are public. Reviewer identity must not
   have to be a published name.

## Decision

### D1 — Review is a separate claim type, not a colophon field

`https://innsigle.dev/claim/review/v1`, a payload with `subjects[0].digest` (the
**same SHA-256 content digest** the seal uses) and a `review` object:

```json
"review": {
  "schema_version": "1",
  "reviewer": { "name": "optional", "key_id": "ed25519:…" },
  "scope": "full",
  "expires_at": "2027-01-01T00:00:00Z"
}
```

`issued_at` is the review date. `scope` is `"full"` (default) or a non-empty
list of opaque claim ids (checklists live in the consuming repo; Innsigle only
carries and compares them). `expires_at` is optional.

**Why not a colophon field or a new composition value.** FR-4a: composition is
independent of editorial effort. A review that lived in the colophon would be
one edit away from "reviewed ⇒ human-authored" laundering, and signing it would
change the authorship payload and invalidate the build key's signature on every
review. A review claim carries **no `colophon`, no `composition`, no
`human_input`**; the schema rejects all three. Reviewing a `model-primary`
document therefore cannot change its declared composition — the authorship
payload and signature are byte-identical before and after.

**PROV-05.** Review precedes sign. `innsigle review` signs only after an
explicit confirmation (TTY prompt, or `--yes` when non-interactive; bulk modes
list every document and digest first). The tool cannot prove reading; it makes
the signature a deliberate act of a human-role key and records nothing more
than it knows.

**Reviewer identity.** `reviewer.key_id` is mandatory and must equal
`issuer.key_id`; `reviewer.name` is optional and omitted unless supplied
(`--reviewer-name`, `review.reviewer_name`) so a deployment can publish key ids
only (`--anonymous` forces it). Note `issuer.name` is the house name from
`keys.json`, not a person.

### D2 — Roles are enforced by signature, not by file path

A review is valid only if its signing key is **human-role** and not build-role.
Role resolution (`makeRoles`):

| Role | Source |
|------|--------|
| human | `config.keys.human` + `review.reviewer_key_ids` when pinned; otherwise `keys.json` `role: "human"`, the signer of a valid `build-signing` endorsement, or the only active key of a single-key house with no build key |
| build | `config.keys.build`, `keys.json` `role: "build"`, or the subject of a valid human-signed `build-signing` endorsement |

A key that is build by any route is never human. Consequences:

- `innsigle review` loads only the human key, refuses `--role build`, and
  verifies its own signature before writing; a build pem substituted for the
  human key fails the self-check and writes nothing.
- A review forged offline with the build key verifies as
  `REVIEW-INVALID(wrong_role)`.
- Pin `keys.human` in `.innsigle/config.json`: `keys.json` is repo content, so
  anyone who can edit it can relabel a role. The pin plus protected review of
  changes to `config.json`/`keys.json` (CODEOWNERS) is the trust root.

### D3 — One attestation file, several independently signed claims

The envelope stays `{payload, payload_encoding, signatures}` for the authorship
claim, **unchanged and still readable by every earlier verifier**, and gains an
optional top-level `reviews: [attestation, …]`, each element a complete
envelope with its own payload and signature. Per document:

```
<key>.attestation.json
  payload / signatures   authorship (build key for model-primary)
  reviews[]              human review attestations (human key)
```

Why this and not a `claims: [...]` array replacing the top-level payload: files
produced by 0.1–0.6 are valid unchanged, `checkAttestation`, short `verify`,
`doctor` and the Hugo/site code keep reading `payload`/`signatures[0]`, and the
authorship signature never covers review bytes, so adding a review never
touches it.

**Merge, never overwrite.** Every seal path (`seal`, `seal --all`,
`seal --stale`) re-reads the file it replaces and carries `reviews[]` over.
Sealing by the build role therefore cannot drop a human review. An edit makes
the review `REVIEW-STALE` by digest, which is the correct way for it to stop
counting; a later `innsigle review` supersedes that reviewer's stale entry
(other reviewers' entries are never touched).

### D4 — Derivation claim carries the review across a build

`https://innsigle.dev/claim/derivation/v1`, **signed by the build key**:

```json
"subjects": [ { "path": "a/index.html", "digest": { "alg": "sha256", "value": "<O>" } } ],
"derivation": {
  "schema_version": "1",
  "transform": { "name": "markdown-render", "version": "1.2.0" },
  "inputs": [ { "path": "briefs/a.md", "id": "x.brief.a",
                "digest": { "alg": "sha256", "value": "<D>" },
                "reviews": [ "<human review attestation, verbatim>" ] } ]
}
```

The review is **embedded verbatim and never re-signed**; the derivation
signature covers it (JCS) but its authenticity rests on the human signature
inside. A verifier, for each output (`verify --derived <tree>`):

1. output file digest equals `subjects[].digest` (else `output_mismatch`, exit 3);
2. derivation signature valid, key not revoked (exit 2 / 4);
3. signer is **build-role** and **endorsed by a human key** (ADR-004 D2)
   (`wrong_role`, `build_key_unendorsed`, exit 4);
4. for every input, at least one embedded review passes D1/D2 against
   `inputs[].digest`: human-role, valid signature, same digest, unexpired
   (`review_missing | review_stale | review_expired | review_invalid(…)`, exit 6);
5. optionally (`--source-root`) the current source digest still equals the one
   built (`source_changed`, exit 6).

A derivation carries no colophon: the output's composition is whatever the
inputs' authorship claims say. The derivation transfers *review*, not authorship.

**Bundles (M sources, one output).** One claim lists every source in
`inputs[]`; verification is **all-of**: every input needs its own valid review.
One unreviewed or stale source fails the whole output.

**Fan-out (one build, N outputs).** One claim lists N `subjects`; it is
equivalent to N claims with identical inputs. Different inputs per output means
separate claims. A tree is verified claim by claim; `--cover <glob>` requires
every matching file in the tree to be an output of some valid derivation, so an
output cannot slip through by having no claim at all.

**Trust assumption (explicit).** The claim says the build key built O from
D₁…Dₙ. A verifier cannot recompute the transform. The human endorses the build
key *as a builder* (ADR-004 D2, purpose `build-signing`); a compromised build
key can mis-attribute outputs but still cannot mint a review. Where the
transform is deterministic the build can be reproduced and checked
independently; that is out of scope here.

### D5 — Keying: stable document id, not rename detection

Attestations are keyed by path slug (`attestationSlug`), so `git mv` orphans
the seal. Two options: (a) key by a stable id in the file; (b) make `status`
detect renames.

**Chosen: (a), opt-in** — `attestation_key: { "frontmatter": "ddx.id" }` in
config. The key becomes `id-<id>`; ids must match `[a-z0-9][a-z0-9._-]*`
(lowercase, so the mapping is injective and safe on case-insensitive disks) and
be unique among `content_globs`. `seal` fails (exit 5) on a missing, malformed
or duplicate id rather than silently falling back to the path.

Why not (b): digest-based rename detection works only if the bytes did not
change, but the common case is *rename and edit*, which is exactly when a stale
seal or review must be found to be stale rather than orphaned. Git-based
detection needs history (absent in a shallow CI clone or an unpacked tarball).
Provenance sync's `git mv` handling serves a local single-writer workflow, not a
public verification gate. An id is explicit, reviewable in the diff, and
survives both. Path keying remains the default; nothing changes for existing
sites.

**Digest of a markdown file with front matter** is unchanged and well defined:
SHA-256 of the exact file bytes (CONTRACT-001 "Content hashing"), front matter
included, no normalization of line endings or BOM. Reading the id never alters
the digest. Editing any front matter byte (including `status:`) therefore stales
the seal and review; that is conservative by design. Changing the id re-keys the
document and orphans the old file (reseal removes it).

### D6 — Gate semantics and compatibility

- `status` / `verify --all` add a review column **only** when `--reviews` or
  `--require-review` is passed, the config has a `review` object, or any claim
  file already carries reviews. Existing output and exit codes are unchanged for
  existing sites.
- `verify --all --require-review` exits **6** when every claim is otherwise
  `VALID` but some in-scope claim lacks a valid, unexpired human review; exit 1
  (as before) if any seal is broken. `review.paths` limits the in-scope set;
  `--require-full-scope` rejects partial-scope reviews.
- Exit code 6 is additive to the verify table.
- Transitive checks along a pin graph, expiry policy beyond `expires_at`, and
  per-claim checklists are consumer concerns; they use `scope` ids and
  `reviews[]` as data.

## Consequences

- CI can enforce "no document without a human review" with one command, and the
  build key can be given to CI without being able to forge the gate.
- Public seals expose a reviewer key id and review date for every reviewed
  document; names are opt-in.
- A repo writer can still relabel roles in `keys.json` unless the human key is
  pinned in config and those files are protected (D2).
- The derivation proves *who vouches for the transform*, not that the transform
  is faithful.
- Generated website copies of the docs are not regenerated in this change (the
  build key reseals them); they pick this ADR up on the next `site:publish`.
