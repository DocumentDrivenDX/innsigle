---
title: Colophon
nav: use
weight: 22
parent: use
description: Composition states and ingredients for how work was made.
---

# Colophon

In publishing, a **colophon** lists how a work was produced. In Innsigle, it is
the short machine-readable recipe bound to content bytes: composition plus
ingredients. Not a moral grade.

CLI short name for the object and commands: **`colo`**.

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
JSON Schema under `docs/helix/02-design/schemas/`.
