---
title: Colophon
nav: use
weight: 22
parent: use
description: Composition states and ingredients for how work was made.
---

# Colophon

The **colophon** (short: **colo**) is the declared recipe of how work was
made—composition plus ingredients. Not a moral grade. Not a detector score.
Publishing tradition: a colophon lists how the piece was produced; Innsigle
seals that declaration to content bytes.

## Composition

| Value | When | Mark cue |
|-------|------|----------|
| `human-authored` | Humans produced the substantive work | H |
| `mixed` | Material human and model authorship both present | M |
| `model-primary` | Models produced most substantive content | A |

## Ingredients

Each line is `kind` (`model` · `tool` · `human` · `other`) plus `name` and optional
`role` / `version` / `uri`.

## Edit is not origin

Running sloptimizer (or similar) on model output does **not** flip
`model-primary` to `human-authored`. List the tool as `kind: tool`.

## CLI

```bash
node src/cli.mjs colo example --kind model-primary > colo.json
```

Full schema: [claim system design](../../reference/artifacts/claim-system/) and
JSON Schema in the repo under `docs/helix/02-design/schemas/`.
