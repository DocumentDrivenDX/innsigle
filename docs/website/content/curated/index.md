---
title: Innsigle
nav: home
weight: 0
description: Content provenance in the time of AI — Innsigle seals how work was made.
---

# Content provenance in the time of AI

**Innsigle** (say **INN-siggle**, rhymes with *single*) is a craft seal for
published work: a visible mark, a short **colophon** of how the piece was made
(human-authored, mixed, or model-primary), and an optional house or person
signature over the content bytes.

Same seal family for model-heavy docs and human social posts. The seal does not
score purity or detect AI.

## Two jobs, one system

### Docs (model-primary, proud)

Long-lived documentation often starts with models. Name the tools on the
colophon (Claude, sloptimizer, …). Sign with a house key when you want standing.

### Social (human-authored, clear)

Short posts strip file metadata. Use the same seal family with a human cue and a
link out. Visibility first; per-post crypto optional.

## What verification answers

When a claim is signed: **did this issuer seal this colophon for these content
bytes?** It does not say whether the prose is true.

## Start

- [Why Innsigle](why/) — problem and gap
- [Conversation → colophon](use/walkthrough-provenance/) — prompts become a sealed document
- [Use](use/) — CLI, issuer, colophon, verify, marks
- [Sample](sample/) — signed model-primary page
- [Reference](reference/) — specs from `docs/helix/`
- [Non-goals](non-goals/) — category boundaries
