---
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
---

# ADR-003: Issuer URL binding and web of trust

| Date | Status | Deciders | Related | Confidence |
|------|--------|----------|---------|------------|
| 2026-07-24 | Accepted | Operator | ADR-001; CONTRACT-001; claim-system; prior-art (PGP/DKIM); FEAT-003 | High |
| 2026-07-24 | Amended | Operator | **D7** social/profile discovery; no webserver required | High |

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

### D7 — Social and profile discovery (no webserver required)

**Problem:** Requiring every maker to run or configure a webserver excludes UC-human-social and casual house signers.

**Decision:** Self-hosted HTTP is **not** required. What is required is a **durable absolute HTTPS URL** for the issuer document (the signed `key_url`). That URL MAY be hosted by any operator the issuer trusts enough to publish **public** material, including free platforms. Social profiles carry **corroborating embeds** of issuer metadata so humans can bootstrap without knowing DNS or servers.

#### D7.1 — Hosting the issuer document (key_url targets)

Any stable HTTPS origin that serves raw JSON (or HTML with a linked JSON) is valid, including but not limited to:

| Host class | Example | Notes |
|------------|---------|--------|
| Free git forge raw/Pages | GitHub raw/Gist, Codeberg, GitLab Pages | No classic webserver admin |
| Static free hosts | Neocities, Cloudflare Pages, Netlify Drop | Drop folder of public files |
| Project / org site | Existing marketing site path | Optional, not required |
| Self-hosted | `/.well-known/innsigle/issuer.json` | Still fine when available |

**Private keys MUST NOT** be uploaded to these hosts. Only the issuer document (public keys + endorsement index) and public attestations.

#### D7.2 — Social / profile **embeds** (bootstrap, not substitute for key_url)

Platforms that strip file metadata still allow **profile fields** and **posts**. Issuers SHOULD embed a compact **issuer card** so viewers can find keys without already knowing `key_url`.

**Issuer card (profile-safe text):**

```text
Innsigle · {short_name}
key {key_id}
keys {absolute_key_url}
```

Rules:

1. **`key_id`** is mandatory in the card when space allows (cryptographic handle).  
2. **`keys {url}`** MUST be the same absolute URL used as signed `issuer.key_url` on claims (or a short redirect that **302/200** resolves to that document).  
3. Optional one-liner: `how https://…/use/marks/` or house meaning page.  
4. Card text is **unsigned marketing/discovery**. Crypto trust still comes from verifying seals + pin/WoT.  
5. Platforms that allow a single link field: put **`key_url`** (or shortlink to it) as the profile URL; put fingerprint in bio text.

#### D7.3 — Recommended profile placements

| Surface | Embed pattern |
|---------|----------------|
| X / Twitter bio | Issuer card truncated; link field → `key_url` or shortlink |
| GitHub profile | `README` or pinned gist with full issuer card + raw JSON link |
| Bluesky / AT Proto | Bio + website field; optional later DID document mapping |
| LinkedIn / mastodon / etc. | Website field → `key_url`; about text → fingerprint |
| Avatar-adjacent image | Seal PNG (mark family) linking out; card text in profile |

#### D7.4 — Relationship to signed claims

| Layer | Role |
|-------|------|
| Social / profile embed | Human discovery and **corroboration** (“this account claims this fingerprint”) |
| Signed `issuer.key_url` | **Authoritative** discovery channel frozen in each seal |
| Pin / WoT | Whether the verifier **recognizes** that key |

A profile that shows fingerprint **F** but seals that use a different `key_id` is a **mismatch warning** for humans and tools—not automatic invalid crypto.

#### D7.5 — Multiple discovery URLs

- Exactly one `key_url` is signed per claim (D1).  
- Issuers MAY publish the **same** issuer document bytes (or identical keys) at multiple HTTPS locations.  
- Optional later: `mirrors[]` on the issuer document; not required for v1.  
- Shortlinks allowed only if they resolve to the absolute document URL used in seals (document the final URL in seals when practical).

#### D7.6 — Platform risk (honesty)

| Risk | Mitigation |
|------|------------|
| Bio edited by attacker who took the account | Same class as host hijack for live discovery; pin fingerprint out-of-band |
| Platform deletes gist/raw file | Keep a second free host; re-issue claims only if `key_url` must change |
| Metadata stripped from images | Never rely on EXIF for keys; use profile text + link |
| Character limits | Fingerprint + short URL minimum; drop prose first |

**Non-goal:** Innsigle does not require partnership with social platforms or in-app key APIs for v1.

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
| Positive | Every seal freezes discovery URL; WoT edges are fetchable from issuer URLs; transitive trust is defineable; aligns with PGP certification + DKIM publish; **no webserver admin required** (D7 free hosts + social cards) |
| Negative | Issuer documents and endorsement URLs must stay available; verifiers need pin/depth policy; more fetch steps; social embeds are spoofable text |
| Neutral | `issuer.id` remains cosmetic; fingerprints remain the shareable handle |

## Risks

| Risk | Prob | Impact | Mitigation |
|------|------|--------|------------|
| Broken absolute URL rules in CLI | M | H | Contract + CLI reject relative `key_url` on sign path |
| Infinite / hostile endorsement graphs | M | M | `max_depth`, cycle detection, pin roots only |
| Stale endorsement index vs attestation | M | M | Attestation is source of truth; index is discovery |
| Users trust slug in UI | H | H | Verify UX shows fingerprint + key_url; docs stress pin |
| Host hijack still confuses live-only users | M | H | Document TOFU/pin; optional multi-mirror later |
| Social bio spoof / account takeover | M | H | Fingerprint pin; treat profile text as discovery only |
| Free host deletes raw JSON | M | M | Second host; document re-publish; prefer durable forges |
| Users think profile embed is a signature | H | M | UX copy: card is not a seal; verify still required |

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
2. **Publish:** issuer document at that URL with keys; optional endorsements index — **any durable HTTPS host**, not only self-hosted servers (D7).  
3. **Embed:** put issuer card (fingerprint + keys URL) on social/profiles for human discovery (D7).  
4. **Endorse:** sign key-endorsement attestations; list them on your issuer document.  
5. **Verify content:** crypto under sealer key from signed key_url.  
6. **Verify identity (optional):** pin roots + walk endorsement edges with depth limits.

## References

- ADR-001 Signing and canonicalization  
- CONTRACT-001 Claim and CLI  
- `docs/helix/02-design/claim-system.md`  
- `docs/helix/02-design/attestation-prior-art.md` (PGP WoT, DKIM)  
- RFC 8785 JCS  
- PRD FR-9–12  
