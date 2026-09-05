---
title: "Session provenance — automatic machine-readable production history"
slug: session-provenance
activity: "Design"
source: "02-design/session-provenance.md"
generated: true
supporting: false
---

> **Generated from HELIX docs.** Source: `docs/helix/02-design/session-provenance.md`. Edit the source, not this file or `site/` HTML.

<details><summary>Source frontmatter</summary>

```yaml
ddx:
  id: innsigle.design.session-provenance
  type: solution-design
  links:
    - target: innsigle.design.claim-system
      kind: informed_by
    - target: innsigle.adr.001
      kind: informed_by
    - target: innsigle.adr.003
      kind: informed_by
    - target: innsigle.contract.001
      kind: informs
    - target: innsigle.feat.004
      kind: informs
    - target: innsigle.prd
      kind: informed_by
status: draft
activity: 02-design
created: 2026-07-24
```

</details>

# Session provenance — automatic machine-readable production history

## Problem

Manual colophons under-specify how agent work actually happened. Operators
using Claude (or other agents) with skills that write files should be able to:

1. **Capture** interaction history machine-side (prompts, tools, models, skills).  
2. **Summarize** into a durable provenance record.  
3. **Propose** a detailed colophon (composition + ingredients + metrics).  
4. **Optionally publish** the record (HTTPS, same constraints as issuer docs).  
5. **Sign** content + provenance under the operator’s issuer key (ADR-001/003).

Without this, the colo is a short declaration only; verifiers cannot see *how*
many human prompts drove a model-primary doc, which skill wrote the file, etc.

## Non-goals

| Out | Why |
|-----|-----|
| Auto-flip composition to `human-authored` after polish | FR-4a / no authorship laundering |
| Require full raw transcript publication | Privacy; size; platform ToS |
| Central Innsigle session cloud | Craft keys stay local; optional self-publish only |
| Replace sloptimizer | sloptimizer = edit quality; this = seal provenance |
| Claim content truth or “safe AI” | Same as core product |

## Layered model

Keep three layers distinct (SLSA lesson: provenance ≠ policy ≠ truth).

```text
┌─────────────────────────────────────────────────────────┐
│  L0 Content artifact (markdown, HTML, …)                │
│      SHA-256 subject of the seal                        │
├─────────────────────────────────────────────────────────┤
│  L1 Colophon (colo) — short human + machine summary     │
│      composition + ingredients [+ optional provenance   │
│      pointer]                                           │
├─────────────────────────────────────────────────────────┤
│  L2 Session provenance document — detailed machine BOM  │
│      metrics, skill/model list, compact timeline,       │
│      optional transcript digest                         │
├─────────────────────────────────────────────────────────┤
│  L3 Optional raw session log (local only by default)    │
│      never required for verify                          │
└─────────────────────────────────────────────────────────┘
```

| Layer | Audience | In signature? |
|-------|----------|----------------|
| L0 content | Everyone | Subject digest |
| L1 colo | Footer / claim payload | Inside colophon claim |
| L2 session provenance | Machines + curious humans | Linked by URI + digest (and/or second subject) |
| L3 raw log | Operator only | No (default) |

**Verify L0+L1** remains the default path. **Verify L2** is optional: if a
pointer is present, re-fetch/hash the provenance document and match digest.

## Actors and flow

### Happy path (Claude skill / agent hook)

```text
  human prompts agent
        │
        ▼
  skill / harness observes session events
        │
        ▼
  SessionJournal (local, structured)
        │
        ▼
  provenance build  →  session-provenance.json  (L2)
        │
        ├──► colo propose  →  colo.json  (L1, operator-editable)
        │
        ▼
  operator review (required for publish/sign)
        │
        ├── optional: publish L2 to HTTPS (gist/Pages/…)
        │
        ▼
  claim build (content + colo [+ L2 as subject or pointer])
        │
        ▼
  sign with house key  →  attestation
```

**Operator review is mandatory** before publish/sign of anything public. Auto-capture
is automatic; **auto-publish is opt-in** and off by default.

### Skill responsibilities

| Duty | Behavior |
|------|----------|
| Observe | Record structured events: user message, assistant message, tool/skill call, file write, model id if known |
| Redact | Strip secrets (API keys, `.env`, private paths) before any proposed publish |
| Summarize | Produce L2 metrics + compact timeline; **not** a novel marketing blurb |
| Propose colo | Map journal → composition + ingredients (defaults conservative: prefer `model-primary` / `mixed` over `human-authored`) |
| Never launder | Must not set `human-authored` solely because of rewrite/sloptimizer/skill cleanup |
| List self | The capturing skill appears as `kind: tool` (or `skill`) on the colo |

## L2 schema — session provenance (draft v1)

**Type URI (when claimed alone):**  
`https://innsigle.dev/claim/session-provenance/v1`  

Or embed as a **document** referenced from a colophon claim (preferred for docs):

```json
{
  "innsigle_provenance": "1",
  "kind": "session",
  "schema_version": "1",
  "generated_at": "2026-07-24T18:00:00Z",
  "generator": {
    "name": "innsigle-session-skill",
    "version": "0.1.0",
    "uri": "https://example.com/skills/innsigle-session"
  },
  "session": {
    "id": "local-opaque-id",
    "started_at": "2026-07-24T17:00:00Z",
    "ended_at": "2026-07-24T17:45:00Z",
    "harness": { "name": "claude-code", "version": null }
  },
  "composition_suggestion": "model-primary",
  "metrics": {
    "user_prompts": 12,
    "assistant_turns": 15,
    "tool_calls": 40,
    "skill_invocations": 3,
    "files_touched": 2,
    "approx_input_tokens": null,
    "approx_output_tokens": null
  },
  "models": [
    { "name": "Claude", "version": null, "role": "primary", "uri": null }
  ],
  "skills": [
    {
      "name": "innsigle-session",
      "version": "0.1.0",
      "role": "provenance-capture",
      "uri": null
    }
  ],
  "tools": [
    { "name": "sloptimizer", "role": "rewrite", "uri": null }
  ],
  "humans": [
    { "name": "operator", "role": "prompter", "prompt_count": 12 }
  ],
  "artifacts": [
    {
      "path": "docs/page.md",
      "digest": { "alg": "sha256", "value": "…" },
      "role": "primary-output"
    }
  ],
  "timeline": [
    {
      "t": "2026-07-24T17:01:00Z",
      "type": "user_prompt",
      "summary": "Asked to draft page structure"
    },
    {
      "t": "2026-07-24T17:10:00Z",
      "type": "file_write",
      "path": "docs/page.md",
      "summary": "Initial draft written"
    }
  ],
  "transcript": null,
  "privacy": {
    "redacted": true,
    "raw_retained_locally": true,
    "notes": "Full transcript not published"
  }
}
```

### Timeline rules

- Entries are **summaries**, not full message bodies (default).  
- `type` enum (open set with documented core):  
  `user_prompt` | `assistant_turn` | `tool_call` | `skill_call` | `file_write` | `file_read` | `model_switch` | `note` | `review`  
- Max recommended published timeline length: **50** events (truncate with `metrics` still full).  
- Optional `transcript`: `{ "digest", "uri" }` only if operator explicitly publishes raw/redacted log.

### Metrics semantics

| Field | Meaning |
|-------|---------|
| `user_prompts` | Count of human→agent messages (or equivalent turns) in session scope |
| `assistant_turns` | Agent responses in scope |
| `tool_calls` | Tool/function invocations |
| `skill_invocations` | Distinct skill runs if the harness exposes them |
| Token fields | Optional; null if unknown — never invent |

**Honesty:** Counts are best-effort from the harness. Document generator limits in
`generator` / `privacy.notes`. Do not claim forensic completeness.

## Human-input measure (hi1)

An optional, declared measure of human input over an artifact, computed
deterministically from the merged redacted journal (FR-20). It summarizes how
much human **direction**, **contribution**, and **review** shaped the artifact.
It is **not** a detection score (FR-20a), and it is never invented: no journal
evidence → no number.

Journal inputs: `user_prompt.chars`; `file_write.chars_added` /
`chars_removed`; `file_write` with `by: "human"` for operator edits; and the
`review` event type (human actor required; optional `path` and
`verdict: approved | changes-requested`).

Derived per artifact A (writesA = `file_write` events matching A's path, in
merged journal order):

| Symbol | Meaning |
|--------|---------|
| `M` | Σ `chars_added` over writesA with `by` `model`/`mixed` (`mixed` counts as model — conservative, FR-4a spirit) |
| `H` | Σ `chars_added` over writesA with `by: human` |
| `B` | Model write **bursts**: maximal runs of model writes with no intervening `user_prompt` |
| `P` | `user_prompt` count (session scope) |
| `Rp` | `user_prompt` events after the first model write in writesA |
| `Re` | `review` events matching A's path (or carrying no `path`) |

Components (exact rationals in [0,1]):

| Component | Formula | null when |
|-----------|---------|-----------|
| direction `D` | `min(1, P/B)` | `B = 0` (nothing to direct) |
| contribution `C` | `H/(H+M)` | `H + M = 0` (no char evidence) |
| review `R` | `min(1, (Rp+Re)/B)` | `B = 0` |

Contribution records `coverage: full | partial` — `partial` when any model
write in writesA lacks `chars_added` (computed over known chars; the flag keeps
the claim honest).

Headline: weights `direction 25, contribution 40, review 35` (integers, sum
100; a governance choice versioned by the method string — a reweighting ships
as `hi2`, never as a silent change to `hi1`).

```text
percent = round_half_up( 100 · Σ wᵢ·compᵢ / Σ wᵢ )   over non-null components
```

Rounding is exact-rational round-half-up (BigInt in the reference
implementation) — never floating point; every recorded number is an integer,
so the object is JCS-safe (ADR-001). The headline requires char evidence:
when `contribution` is null the whole measure is null (direction/review alone
would inflate the number on works with no char evidence), and a null measure
is **omitted** from L1 entirely — the colophon never carries an invented
number. `direction` and `review` are null only when `B = 0` (nothing to
direct or review; possible non-null sets are `{C}` and `{D, C, R}`).
An `Edit` with `replace_all` counts its chars once — a documented importer
limitation. Bash heredoc writes (`cat > path <<'EOF' … EOF`, `cat <<EOF > path`,
`tee path <<EOF`, `>>` append, `<<-`) are imported as model `file_write` events
with the heredoc body length as `chars_added`, so shell-first agents leave the
same char evidence as `Write`; scripts that write files indirectly (a python3
heredoc calling `open().write`) are not measurable and stay `tool_call`. A
renamed content file keeps its evidence: `provenance sync` matches writes under
every earlier path reported by `git log --follow`.

Worked example: `P=3`, `B=3` → `D=1`; `H=0`, `M=812` → `C=0`; `Rp=2`, `Re=0`
→ `R=2/3`; headline `round(25·1 + 40·0 + 35·⅔) = round(48.33…) = 48`.

Record shape (identical object on L2 `human_input` and the optional colophon
`human_input`):

```json
"human_input": {
  "method": "hi1", "basis": "session-journal", "percent": 48,
  "weights": { "direction": 25, "contribution": 40, "review": 35 },
  "direction":    { "percent": 100, "user_prompts": 3, "model_write_bursts": 3 },
  "contribution": { "percent": 0, "human_chars": 0, "model_chars": 812,
                    "human_write_events": 0, "coverage": "full" },
  "review":       { "percent": 67, "post_output_prompts": 2, "review_events": 0 }
}
```

Sub-`percent` fields are display conveniences; seal-time validation and
verifiers recompute the headline from the raw counts (CONTRACT-001 v1.1
consistency rule). Intent over keystrokes: model-drafted work that was
prompted, steered, and reviewed by a human scores well; unreviewed autonomous
output does not — char share alone is deliberately only 40% of the weight.

## L1 colo extension — pointer to L2

Additive fields on colophon (schema_version stays `"1"` with optional object; or bump to `"1.1"`):

```json
"colophon": {
  "schema_version": "1",
  "composition": "model-primary",
  "ingredients": [ /* derived from L2 */ ],
  "notes": null,
  "provenance": {
    "kind": "session",
    "digest": { "alg": "sha256", "value": "hex of L2 JSON canonical bytes" },
    "uri": "https://…/session-provenance.json"
  }
}
```

**Canonicalization for L2 digest:** JCS (RFC 8785) of the provenance document,
same spirit as ADR-001, so independent verifiers agree.

With CONTRACT-001 v1.1 the colophon MAY also carry the optional `human_input`
object (see "Human-input measure (hi1)" above); `schema_version` stays `"1"`.

### Binding strategies (both allowed)

| Strategy | How | When |
|----------|-----|------|
| **A. Pointer only** | Colo claim subjects = [content]; `colophon.provenance` = uri+digest | Default for docs footers |
| **B. Multi-subject** | Claim subjects = [content, provenance file] | Stronger offline bundle |

## Mapping L2 → ingredients (proposal rules)

| L2 source | Ingredient |
|-----------|------------|
| `models[]` | `kind: model`, name/version/role |
| `skills[]` / `tools[]` | `kind: tool` (or later `kind: skill` if enum extended) |
| `humans[]` | `kind: human` |
| Capturing skill | Always listed |

**Composition suggestion algorithm (conservative):**

1. If any model produced substantive artifact content → not `human-authored`.  
2. If human prompts **and** model both material → prefer `mixed` when human structural authorship is clear; else `model-primary`.  
3. If only human typed final bytes with no model → `human-authored`.  
4. Editorial tools (sloptimizer, formatters) never alone upgrade to `human-authored`.

Operator may override suggestion before sign; override SHOULD be noted in
`privacy.notes` or colo `notes` if composition was downgraded toward human.

## Skill / harness integration contract

### Event journal (local)

Minimal append-only JSONL (implementation sketch):

```json
{"t":"…","type":"user_prompt","bytes":120}
{"t":"…","type":"skill_call","name":"innsigle-session","action":"capture"}
{"t":"…","type":"file_write","path":"docs/page.md"}
```

### CLI / skill verbs (intent)

| Verb | Result |
|------|--------|
| `innsigle provenance capture` | Attach to session / import journal |
| `innsigle provenance build` | Journal → L2 JSON |
| `innsigle provenance propose-colo` | L2 → colo.json draft |
| `innsigle claim build …` | Existing; supports provenance pointer / multi-subject |

Skill wrappers (Claude Code, Cursor, etc.) call these or embed equivalent logic.

### Operator gates

| Gate | Default |
|------|---------|
| Write L2 to disk | On when skill enabled |
| Publish L2 URL | **Off** |
| Sign | **Off** until explicit |
| Include transcript URI | **Off** |

## Privacy and safety

1. **Redact** secrets before propose/publish (key material, tokens, home paths optional).  
2. **Do not** put private keys in provenance.  
3. **Do not** auto-post to social.  
4. Prompt **bodies** are optional and off by default in published L2.  
5. Metrics (counts) are preferred over content for public records.  
6. GDPR/workplace: operators own retention of L3 raw logs.

## Trust interpretation

| Statement | True? |
|-----------|--------|
| “This L2 was signed by issuer K for these digests” | Yes, if claim verifies |
| “The metrics are complete and ungameable” | No — harness-mediated |
| “The human-input percent is exact” | No — a declaration recomputable from recorded counts; harness-mediated, not forensic. Padded prompts or review events can inflate capped components |
| “The model is named honestly” | Declaration + optional automation, not oracle |
| “Therefore content is true” | **No** |

## Relationship to product surfaces

| Surface | Use of L2 |
|---------|-----------|
| Docs footer | Link “session provenance” next to colo when published |
| Sample site | Optional demo provenance file |
| Social | Rarely attach full L2; card may say “model-primary · N prompts” if desired |
| Verify CLI | Optional `--provenance` check digest match |

## Phased delivery

| Phase | Deliverable |
|-------|-------------|
| **P0 design** | This doc + FEAT-004 + schema stubs |
| **P1** | JSON Schema; `provenance build` / `propose-colo` from fixture journal; tests |
| **P2** | Reference skill for one harness (e.g. Claude Code) |
| **P3** | Multi-subject claim CLI; verify provenance pointer; site “how to auto-colo” |
| **P4** | Optional transcript digest publish helpers |

## Open questions

- [ ] Extend ingredient `kind` with `skill` vs overload `tool`  
- [ ] Token metrics: require harness API or always optional  
- [ ] Multi-session merge for long-running docs  
- [ ] Whether L2 should be a separate claim type vs document-only  
- [ ] Alignment with OpenTelemetry / gen-AI trace standards later  

## References

- claim-system.md, CONTRACT-001, ADR-001, ADR-003  
- FEAT-002 signed docs; FEAT-004 (auto provenance)  
- Prior art: SLSA provenance, in-toto predicates, SBOM field discipline  
