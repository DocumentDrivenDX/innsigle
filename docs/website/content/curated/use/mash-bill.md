---
title: Mash bill
nav: use
weight: 22
parent: use
description: Composition states and ingredients for how work was made.
---

# Mash bill

The **mash bill** is the recipe of making—not a moral grade. Like a distiller’s
grain bill: ingredients and roles, not “good” vs “bad.”

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

Full schema: [claim system design](../../reference/artifacts/claim-system/) and
JSON Schema in the repo under `docs/helix/02-design/schemas/`.
