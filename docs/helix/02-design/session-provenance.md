---
ddx:
  id: aibadge.design.session-provenance
  type: solution-design
  links:
    - target: aibadge.design.claim-system
      kind: informed_by
    - target: aibadge.adr.001
      kind: informed_by
    - target: aibadge.adr.003
      kind: informed_by
    - target: aibadge.contract.001
      kind: informs
    - target: aibadge.feat.004
      kind: informs
    - target: aibadge.prd
      kind: informed_by
status: draft
activity: 02-design
created: 2026-07-24
---

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
  `user_prompt` | `assistant_turn` | `tool_call` | `skill_call` | `file_write` | `file_read` | `model_switch` | `note`  
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
