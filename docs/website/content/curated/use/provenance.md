---
title: Session provenance
nav: use
weight: 23.5
parent: use
description: Automatic machine provenance from agent sessions into detailed colophons.
---

# Session provenance

Agent work should leave a **machine trail** and a **short colophon**—not just a
finished markdown file with no history.

**See the story first:**  
[Walkthrough: conversation → document → colophon](../walkthrough-provenance/)

That page shows human prompts, the document the agent wrote, the proposed colo,
and a sealed-page footer—using the multi-agent fixture (Claude + Codex).

## In one diagram

```text
You prompt the agent
        ↓
Agent writes a document (model-primary bytes)
        ↓
Skill records journal → builds L2 provenance → proposes colo
        ↓
You review · optionally publish L2 · sign claim to content bytes
```

## Layers

| Layer | What | Public? |
|-------|------|---------|
| Content | The markdown/HTML you ship | Yes |
| Colophon | Composition + ingredients | Yes (in claim) |
| Session provenance (L2) | Prompt counts, tools, timeline | Optional URL |
| Raw transcript | Full chat | Local by default |

## Quick results (fixture)

| Metric | Value |
|--------|--------|
| Human prompts | 6 (3 prompts × Claude and Codex) |
| Composition | **model-primary** |
| Models | Claude, Codex |
| Tools | innsigle-session, sloptimizer |

Sloptimizer is listed as a tool. It does **not** flip composition to human-authored.

## Machine pack

| File | Description |
|------|-------------|
| [human-inputs.json](/examples/provenance/human-inputs.json) | Scripted human prompts |
| [session-claude.jsonl](/examples/provenance/session-claude.jsonl) | Claude journal |
| [session-codex.jsonl](/examples/provenance/session-codex.jsonl) | Codex journal |
| [session-provenance.json](/examples/provenance/session-provenance.json) | L2 |
| [colo.json](/examples/provenance/colo.json) | Proposed colo |
| [sealed-notes-claude.md](/examples/provenance/artifacts/sealed-notes-claude.md) | Document from Claude |
| [sealed-notes-codex.md](/examples/provenance/artifacts/sealed-notes-codex.md) | Document from Codex |

## Reproduce

```bash
npm run test:provenance-driver
```

```bash
node src/cli.mjs provenance build --journal session.jsonl --generated-at 2026-07-24T18:00:00Z --out l2.json
node src/cli.mjs provenance propose-colo --provenance l2.json --out colo.json
```

## Specs

- [Walkthrough (story)](../walkthrough-provenance/)  
- Design: [session-provenance](../../reference/artifacts/session-provenance/)  
- [FEAT-004](../../reference/artifacts/features/feat-004-session-provenance/)  
