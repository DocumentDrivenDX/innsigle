---
ddx:
  id: aibadge.design.session-provenance-convergence
  type: design-note
  links:
    - target: aibadge.design.session-provenance
      kind: refines
    - target: aibadge.feat.004
      kind: informs
status: accepted
activity: 02-design
created: 2026-07-24
---

# Session provenance — convergence (Claude + Codex adversarial review)

**Round 1 verdict:** BLOCK (both harnesses).  
**Round 2 verdict:** Codex **APPROVE** on P1 fixture path; Claude deferred to live test (suite already green).  
**Resolution:** Fix load-bearing contracts below; implement P1 fixture path; live multi-agent capture via test driver with recorded journals.

## Blocking fixes accepted

| Issue | Resolution |
|-------|------------|
| Journal underspecified | Versioned JSONL schema `session-journal-event.schema.json` with `session_id`, `event_id`, `sequence`, `actor`, `model`, `file_write.by` |
| Composition non-deterministic | Total function in `propose-colo` (see algorithm) |
| FR-4a unenforceable | Propose refuses `human-authored` if any `file_write.by=model` unless `--force-composition` + notes |
| L2 digest vs file bytes | **Digest = SHA-256 of exact L2 file bytes as written** (CONTRACT-001 aligned). No JCS for L2 file binding. |
| `colophon.provenance` unschematized | Add optional `provenance` to colophon schema |
| Skills kind | Map skills → `kind: "tool"` until enum extended |
| Clock nondeterminism | `--generated-at` required for golden tests (or default now; goldens pass fixed value) |
| Multi-agent driver | Scripted human inputs → per-agent journal segments (live or mock) → merge → build → propose-colo |
| Review gate | `propose-colo` does not sign; sign remains separate CLI step (human/explicit) |

## Composition algorithm (total)

Input: L2 document (and optional `--prior-composition`).

```
if any artifact role=primary-output has write.by=model (from build) OR models[] non-empty
   AND humans have prompt_count > 0:
    if only model wrote primary bytes (no human file_write on primary): model-primary
    else: mixed
else if models[] empty AND no file_write.by=model:
    human-authored
else:
    model-primary   # conservative default
```

Never propose `human-authored` if any `file_write` with `by=model` exists unless forced.

## P1 implementable path

```
journal.jsonl → provenance build → L2.json
L2.json → provenance propose-colo → colo.json
```

Test driver: human-inputs sequence × agents {claude,codex} → journals → merge → build → colo.

## Harness findings (archive)

- `.tmp-review/findings-claude.md`
- `.tmp-review/findings-codex.md`
