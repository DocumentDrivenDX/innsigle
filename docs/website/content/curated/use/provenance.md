---
title: Session provenance
nav: use
weight: 23.5
parent: use
description: Automatic machine provenance from agent sessions into detailed colophons.
---

# Session provenance

Innsigle can seal more than a short colo. When an agent skill captures a session,
it can build a **session provenance** record (metrics, models, skills, file
digests) and **propose** a colophon—then you review, optionally publish, and sign.

## Layers

| Layer | What | Public? |
|-------|------|---------|
| Content | The markdown/HTML you ship | Yes |
| Colophon | Short composition + ingredients | Yes (in claim) |
| Session provenance | Prompt counts, tools, compact timeline | Optional URL |
| Raw transcript | Full chat log | Local by default |

## Worked example (multi-agent fixture)

The site ships a **real driver run**: three scripted human prompts fed into
**Claude** and **Codex** journals, then merged into L2 provenance and a proposed
colo.

| Result | Value |
|--------|--------|
| Human prompts (total across agents) | **6** (3 × 2) |
| Models | Claude, Codex |
| Composition | **model-primary** |
| Tools | innsigle-session, sloptimizer |

### Human inputs (scripted)

1. Draft a short markdown page titled Sealed Notes explaining what an Innsigle colophon is in two paragraphs.  
2. Add a bullet list of three non-goals: not a detector, not purity score, not content truth.  
3. Tighten the opening sentence; keep model-primary honesty.

### Proposed colophon

```json
{
  "schema_version": "1",
  "composition": "model-primary",
  "ingredients": [
    { "kind": "model", "name": "Claude", "role": "primary" },
    { "kind": "model", "name": "Codex", "role": "primary" },
    { "kind": "tool", "name": "innsigle-session", "role": "provenance-capture" },
    { "kind": "tool", "name": "sloptimizer", "role": "rewrite" },
    { "kind": "human", "name": "operator", "role": "prompter" }
  ],
  "notes": "session metrics: user_prompts=6; assistant_turns=5"
}
```

### Download the pack

| File | Description |
|------|-------------|
| [human-inputs.json](/examples/provenance/human-inputs.json) | Scripted human prompts |
| [session-claude.jsonl](/examples/provenance/session-claude.jsonl) | Claude agent journal |
| [session-codex.jsonl](/examples/provenance/session-codex.jsonl) | Codex agent journal |
| [session-provenance.json](/examples/provenance/session-provenance.json) | L2 merged provenance |
| [colo.json](/examples/provenance/colo.json) | Proposed colophon (L1) |
| [summary.json](/examples/provenance/summary.json) | Driver summary |
| [sealed-notes-claude.md](/examples/provenance/artifacts/sealed-notes-claude.md) | Artifact from Claude session |
| [sealed-notes-codex.md](/examples/provenance/artifacts/sealed-notes-codex.md) | Artifact from Codex session |
| [session-sloptimizer-only.jsonl](/examples/provenance/session-sloptimizer-only.jsonl) | FR-4a fixture (rewrite does not launder) |

### Reproduce

```bash
npm run test:provenance-driver
# or regenerate into the site static tree:
node scripts/agent-provenance-driver.mjs --out-dir docs/website/static/examples/provenance
```

Optional live agents (non-deterministic, not used in CI):

```bash
npm run test:provenance-driver:live
```

### CLI path used by the skill

```bash
node src/cli.mjs provenance build \
  --journal session-claude.jsonl \
  --journal session-codex.jsonl \
  --generated-at 2026-07-24T18:00:00Z \
  --out session-provenance.json

node src/cli.mjs provenance propose-colo \
  --provenance session-provenance.json \
  --uri https://example.com/session-provenance.json \
  --out colo.json
```

## Rules that stay

- Editorial tools do **not** launder model work into `human-authored`.  
- Auto-**capture** may be on; auto-**publish** and auto-**sign** are off until you say so.  
- Signed claims still freeze absolute `key_url` (ADR-003). Provenance files can live on the same free HTTPS hosts as issuer docs.

## Specs

- Design: [session-provenance](../../reference/artifacts/session-provenance/)  
- Convergence: [session-provenance-convergence](../../reference/artifacts/session-provenance-convergence/)  
- Feature: [FEAT-004](../../reference/artifacts/features/feat-004-session-provenance/)  
- Schema: repo `docs/helix/02-design/schemas/session-provenance.schema.json`  
- HELIX design example: repo `docs/helix/02-design/examples/session-provenance.json`  
