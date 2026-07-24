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

This is design + schema today; CLI/skill automation is phased (FEAT-004).

## Layers

| Layer | What | Public? |
|-------|------|---------|
| Content | The markdown/HTML you ship | Yes |
| Colophon | Short composition + ingredients | Yes (in claim) |
| Session provenance | Prompt counts, tools, compact timeline | Optional URL |
| Raw transcript | Full chat log | Local by default |

## Example metrics

From a session that wrote a docs page:

- `user_prompts`: 12  
- `assistant_turns`: 15  
- models: Claude (primary)  
- tools: sloptimizer (rewrite)  
- skills: innsigle-session (capture)  
- composition suggestion: **model-primary** (not human-authored after polish)

## Rules that stay

- Editorial tools do **not** launder model work into `human-authored`.  
- Auto-**capture** may be on; auto-**publish** and auto-**sign** are off until you say so.  
- Signed claims still freeze absolute `key_url` (ADR-003). Provenance files can live on the same free HTTPS hosts as issuer docs.

## Specs

- Design: HELIX `session-provenance.md`  
- Feature: FEAT-004  
- Schema: `session-provenance.schema.json`  
- Example: `examples/session-provenance.json`  
