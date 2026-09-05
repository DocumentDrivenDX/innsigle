---
title: Colophon
nav: use
weight: 22
parent: use
description: Composition states and ingredients for how work was made.
---

# Colophon

Printers used to tuck a short note at the end of a book: who set the type, where
it was printed, what went into the production. Innsigle borrows that idea for
the web.

The **colophon** is the short recipe bound to content bytes: **composition**
plus **ingredients**. The **seal** is what readers see; the colophon is what
opens. It is not a moral grade.

CLI short name for the object and commands: **`colo`**.

## Composition

| Value | When | Mark cue |
|-------|------|----------|
| `human-authored` | Humans produced the substantive work | H |
| `mixed` | Material human and model authorship both present | M |
| `model-primary` | Models produced most substantive content | A |

## Human input percent (optional)

A colophon MAY carry `human_input`: an integer percent of human input over the
sealed work, computed from the maker's **own session journal** by a versioned
method (`hi1` weighs direction 25 · contribution 40 · review 35). The object
records the raw counts (prompts, human/model chars, review events), so anyone
holding it can recompute the headline — tooling refuses a percent that does
not recompute from its own counts.

Intent over keystrokes: model-drafted work that a human prompted, steered, and
reviewed scores well; unreviewed autonomous output does not. No journal char
evidence → no percent (the field is omitted, never invented). It is a
declaration under the seal, not a detection score — see
[Non-goals](../../non-goals/).

## Ingredients

Each line is `kind` (`model` · `tool` · `human` · `other`) plus `name` and optional
`role` / `version` / `uri`.

## Edit is not origin

Running sloptimizer (or similar) on model output does **not** flip
`model-primary` to `human-authored`. List the tool as `kind: tool`.

## CLI

```bash
innsigle colo example --kind model-primary > colo.json
```

Full schema: [claim system design](../../reference/artifacts/claim-system/) and
JSON Schema under `docs/helix/02-design/schemas/`.
