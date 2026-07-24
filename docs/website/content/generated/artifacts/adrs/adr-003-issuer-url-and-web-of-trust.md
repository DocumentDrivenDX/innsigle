---
title: "ADR-003: Issuer URL binding and web of trust"
slug: ADR-003-issuer-url-and-web-of-trust
activity: "Design"
source: "02-design/adrs/ADR-003-issuer-url-and-web-of-trust.md"
generated: true
supporting: false
collection: "adrs"
---

> **Generated from HELIX docs.** Source: `docs/helix/02-design/adrs/ADR-003-issuer-url-and-web-of-trust.md`. Edit the source, not this file or `site/` HTML.

<details><summary>Source frontmatter</summary>

```yaml
ddx:
  id: aibadge.adr.003
  type: adr
  links:
    - target: aibadge.adr.001
      kind: informed_by
    - target: aibadge.design.claim-system
      kind: informed_by
    - target: aibadge.design.attestation-prior-art
      kind: informed_by
    - target: aibadge.contract.001
      kind: informs
    - target: aibadge.prd
      kind: informed_by
status: accepted
activity: 02-design
created: 2026-07-24
```

</details>

# ADR-003: Issuer URL binding and web of trust

| Date | Status | Deciders | Related | Confidence |
|------|--------|----------|---------|------------|
| 2026-07-24 | Accepted | Operator | ADR-001; CONTRACT-001; claim-system; prior-art (PGP/DKIM) | High |

## Context

| Aspect | Description |
|--------|-------------|
| Problem | Seals need a clear issuer identity story: every signature must permanently record **where** the verifier should fetch the issuer’s public keys; peers need a way to **endorse** each other’s keys without a central CA |
| Current State | Claims include `issuer.key_url`, but rules for absolute URL, signature binding, and trust beyond crypto-valid were underspecified; `keys.json` had no endorsement list; WoT was “later” in prior art |
| Requirements | Offline-capable verify; no mandatory CA; DKIM-like publish channel; optional transitive trust; fail closed on key mismatch; do not claim content truth |
| Decision Drivers | Hijacked host must not rewrite history for pinned keys; slug collisions must not be security; endorsements must themselves be signed; discovery URL must be inside the signed payload |

### Threats this ADR addresses

| Threat | Without this decision | With this decision |
|--------|----------------------|--------------------|
| Claim omits or uses relative `key_url` | Verifier guesses discovery; easy to strip or swap channel | **Full absolute `key_url` is inside signed bytes** |
| Verifier uses attacker-supplied key file while claim pointed elsewhere | Confused deputy | Verifier **MUST** use `issuer.key_url` from the **signed** claim (or a pin derived from it) |
| Webserver hijack replaces `keys.json` | Live fetchers trust new key | Pins / prior endorsements still bind old `key_id`; new key needs new trust path |
| Duplicate `issuer.id` slugs | Users think slug is unique identity | Identity is **`key_id` + published document URL**, not the slug |
| “I trust Bob” is unsigned blog text | No crypto weight | **Key-endorsement attestations** signed by endorser’s key, listed at endorser’s issuer URL |

## Decision

### D1 — Full issuer URL in every signature

1. Every **signed** claim payload MUST include `issuer.key_url` as an **absolute** URL with scheme `https:` (production) or `http:` only for loopback/test.
2. Relative paths, bare hostnames, and missing `key_url` are **invalid** for signed claims.
3. Because the claim payload is what ADR-001 signs (JCS → SHA-256 → Ed25519), **`key_url` is covered by the signature**. A verifier that checks the signature has integrity over the discovery URL the signer asserted at seal time.
4. `issuer.id` remains a **non-unique display slug**. Cryptographic identity is `issuer.key_id`. Discovery channel is `issuer.key_url`.

### D2 — How verifiers load keys

1. Default discovery: fetch the issuer document from the **signed** `issuer.key_url`.
2. Match `issuer.key_id` to a non-revoked key in that document; `issuer_id` in the document SHOULD equal `issuer.id` (warn if not; do not treat slug alone as trust).
3. Implementations MAY accept a local file only when it is a **pin** of a previously observed document for that `key_url` / `key_id`, or for offline tests.
4. Implementations MUST NOT silently substitute an unrelated keys file without recording that policy override.

### D3 — Issuer document at `key_url`

The resource at `key_url` is an **issuer document** (evolved from minimal `keys.json`):

| Field | Required | Meaning |
|-------|----------|---------|
| `innsigle_issuer` | yes (v1 doc) | `"1"` — document type version |
| `issuer_id` | yes | Display slug (may collide globally) |
| `issuer_name` | yes | Human label |
| `keys` | yes | Public keys (`key_id`, `alg`, `public_key`, `created_at`, `revoked_at`) |
| `endorsements` | no (default `[]`) | Index of **key-endorsement** attestations this issuer has published |

**Backward compatibility:** Documents that only set `innsigle_keys: "1"` (pre-ADR-003) remain valid as a **keys-only** issuer document with empty endorsements. New producers SHOULD emit `innsigle_issuer: "1"`.

### D4 — Key-endorsement attestations (web of trust edges)

An issuer may publish **key-endorsement** claims: signed statements that **this key trusts another Innsigle key** for **identity / seal recognition**, not for content truth.

1. **Type URI:** `https://innsigle.dev/claim/key-endorsement/v1`
2. **Signed payload** MUST include the endorser’s full `issuer` object (**including absolute `key_url`**), same as colophon claims.
3. **Subject of endorsement** MUST include the endorsee’s absolute `key_url` and `key_id` (and MAY include `issuer_id` as display only).
4. Each endorsement is a normal Innsigle **attestation envelope** (ADR-001 crypto).
5. The endorser’s issuer document lists endorsements in `endorsements[]` with at least:
   - `attestation_url` — absolute URL of the endorsement attestation JSON  
   - `subject_key_id`  
   - `subject_key_url` — absolute  
   - `issued_at` (optional cache hint; the attestation is authoritative)

### D5 — Transitive web of trust (verifier policy)

Trust is a **policy graph**, not a crypto boolean alone.

| Layer | Meaning |
|-------|---------|
| **Crypto valid** | Signature + content/subject rules for that attestation type |
| **Direct trust** | Verifier pins endorsee key, or accepts a **direct** endorsement from a pinned root |
| **Transitive trust** | Path of crypto-valid key-endorsements from a pinned root to the content sealer’s `key_id`, with depth/cycle limits |

**Normative verifier algorithm (WoT path check):**

1. Verify the **content** attestation (colophon claim) under sealer `key_id` / keys from sealer’s **signed** `key_url`.
2. If sealer `key_id` is in the verifier’s **pin set** → identity accepted (for policy).
3. Else, BFS/DFS from pin set over endorsement edges:
   - Load endorser’s issuer document from the **endorsement attestation’s signed** `issuer.key_url`.
   - Verify endorsement attestation signature.
   - Confirm endorsement subject matches next hop `key_id` + `key_url`.
   - Enforce `max_depth` (default **3**), reject cycles, optional `level` policy (e.g. only `full`).
4. If a path exists → **transitively recognized**; else → crypto may still be VALID but **issuer not recognized**.

**Non-goals of the WoT:**

- Does **not** validate colophon honesty or content truth.
- Does **not** replace offline private-key custody.
- Does **not** make `issuer.id` globally unique.
- Does **not** require a global keyserver (each issuer publishes their own edge list).

### D6 — Host compromise (design honesty)

| Event | Effect |
|-------|--------|
| Attacker replaces issuer document at `key_url` | Live-only verifiers may accept **new** keys; **pinned** `key_id`s still define historical identity |
| Attacker lacks private key | Cannot forge under old `key_id` |
| Attacker has private key | Full forge — operational failure |
| Attacker publishes fake endorsements under their key | Only helps if some pin trusts the attacker’s key |

Publishing keys at a URL is **DKIM-class discovery**, not a CA. ADR-003 makes the **asserted discovery URL immutable inside the seal** and adds **signed peer edges** for transitive recognition.

## Alternatives

| Option | Pros | Cons | Evaluation |
|--------|------|------|------------|
| Slug-only identity | Simple | Collisions; no crypto | Rejected |
| CA / mTLS issuer certs | Familiar enterprise | Ops burden; not craft-first | Rejected for v1 |
| Sigstore keyless only | No long-lived keys | OIDC; weak house narrative | Optional later, not sole |
| key_url outside signature | Smaller payload | Channel swap after sign | **Rejected** |
| Central Innsigle trust registry | Easy UX | We become CA; single point | Rejected |
| **Signed absolute key_url + local endorsement lists** | No central party; PGP-like | Path UX complexity | **Selected** |
| Blockchain transparency log | Strong history | Scope / cost | Optional later |

## Consequences

| Type | Impact |
|------|--------|
| Positive | Every seal freezes discovery URL; WoT edges are fetchable from issuer URLs; transitive trust is defineable; aligns with PGP certification + DKIM publish |
| Negative | Issuer documents and endorsement URLs must stay available; verifiers need pin/depth policy; more fetch steps |
| Neutral | `issuer.id` remains cosmetic; fingerprints remain the shareable handle |

## Risks

| Risk | Prob | Impact | Mitigation |
|------|------|--------|------------|
| Broken absolute URL rules in CLI | M | H | Contract + CLI reject relative `key_url` on sign path |
| Infinite / hostile endorsement graphs | M | M | `max_depth`, cycle detection, pin roots only |
| Stale endorsement index vs attestation | M | M | Attestation is source of truth; index is discovery |
| Users trust slug in UI | H | H | Verify UX shows fingerprint + key_url; docs stress pin |
| Host hijack still confuses live-only users | M | H | Document TOFU/pin; optional multi-mirror later |

## Validation

| Success Metric | Review Trigger |
|----------------|----------------|
| Signed golden claim includes absolute `https://…` `key_url` under JCS | Any claim schema change |
| Relative `key_url` rejected by claim build / contract tests | Softening of URL rules |
| Example endorsement attestation verifies; path of length 2 accepted under pin | WoT algorithm change |
| Content seal still fails closed on content mutation | Softening fail-closed |

## Supersession

- **Supersedes:** None (extends ADR-001 envelope usage; does not change algorithms)
- **Superseded by:** None
- **Amends guidance in:** claim-system.md (TOFU/WoT); CONTRACT-001 (issuer URL + endorsements)

## Concern Impact

- Strengthens `key-custody`, issuer discovery, and future `area:crypto` trust policy.
- WoT is **opt-in policy** for verifiers; unsigned seals and keys-only issuers remain valid.

## Normative summary (implementers)

1. **Sign:** payload.issuer.key_url = absolute URL; covered by ADR-001 signature.  
2. **Publish:** issuer document at that URL with keys; optional endorsements index.  
3. **Endorse:** sign key-endorsement attestations; list them on your issuer document.  
4. **Verify content:** crypto under sealer key from signed key_url.  
5. **Verify identity (optional):** pin roots + walk endorsement edges with depth limits.

## References

- ADR-001 Signing and canonicalization  
- CONTRACT-001 Claim and CLI  
- `docs/helix/02-design/claim-system.md`  
- `docs/helix/02-design/attestation-prior-art.md` (PGP WoT, DKIM)  
- RFC 8785 JCS  
- PRD FR-9–12  
