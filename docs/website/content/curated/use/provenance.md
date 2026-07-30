---
title: Session provenance
nav: use
weight: 23.5
parent: use
description: Session provenance from captured agent journals into proposed colophons.
---

# Session provenance

You finish an agent session with a shiny markdown file and no durable record of
which prompts, tools, or models the harness captured. Session provenance records
those events and **proposes a short colophon** for review, so the seal can name
what the journal actually logged.

**See the story first:**
[Walkthrough: conversation → document → colophon](../walkthrough-provenance/)

That page shows human prompts, the document the agent wrote, the proposed
colophon, and a sealed-page footer, using the multi-agent fixture (Claude + Codex).

## In one diagram

```text
You prompt the agent
 ↓
Agent writes a document (model-primary bytes)
 ↓
Skill records journal → builds session record → proposes colo
 ↓
You review · optionally publish the record · sign claim to content bytes
```

Signing stays a separate, deliberate step. Auto-sign is out of scope.

## Layers

| Layer | What | Public? |
|-------|------|---------|
| Content | The markdown/HTML you ship | Yes |
| Colophon | Composition + ingredients | Yes (in claim) |
| Session provenance | Prompt counts, tools, timeline | Optional URL |
| Raw transcript | Full chat | Local by default |

## Quick results (fixture)

| Metric | Value |
|--------|--------|
| Human prompts | 6 (3 prompts × Claude and Codex) |
| Composition | **model-primary** |
| Models | Claude, Codex |
| Tools | innsigle-session, sloptimizer |

Sloptimizer is listed as a tool. It does **not** flip composition to
human-authored.

## Machine pack

| File | Description |
|------|-------------|
| [human-inputs.json](/examples/provenance/human-inputs.json) | Scripted human prompts |
| [session-claude.jsonl](/examples/provenance/session-claude.jsonl) | Claude journal |
| [session-codex.jsonl](/examples/provenance/session-codex.jsonl) | Codex journal |
| [session-provenance.json](/examples/provenance/session-provenance.json) | Session record |
| [colo.json](/examples/provenance/colo.json) | Proposed colo |
| [sealed-notes-claude.md](/examples/provenance/artifacts/sealed-notes-claude.md) | Document from Claude |
| [sealed-notes-codex.md](/examples/provenance/artifacts/sealed-notes-codex.md) | Document from Codex |

## Reproduce

From a full clone of this repo:

```bash
npm run test:provenance-driver
```

```bash
innsigle provenance build \
 --journal session.jsonl \
 --generated-at 2026-07-24T18:00:00Z \
 --out l2.json
innsigle provenance propose-colo --provenance l2.json --out colo.json
```

(From a clone without install: `node src/cli.mjs …`.)

### Check it

What we claim: the fixture driver proposes **model-primary** and lists rewrite
tools without laundering authorship.

```bash
npm run test:provenance-driver
# then inspect examples under docs/website/static/examples/provenance/
# or site/examples/provenance/ after a site build
```

Expect: composition `model-primary`; ingredients include models and
`innsigle-session` / sloptimizer as tools, not a flip to human-authored.

## Spec

- [Walkthrough (story)](../walkthrough-provenance/)
- Design: [session provenance](../../reference/artifacts/session-provenance/)
- Feature note: [session provenance feature](../../reference/artifacts/features/feat-004-session-provenance/)
