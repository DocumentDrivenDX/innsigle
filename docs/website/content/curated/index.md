---
title: Innsigle
nav: home
weight: 0
description: The maker's seal for published work — Innsigle, content provenance for the AI era.
---

# The maker's seal for published work

You finish a docs page that a model helped write. You want the footer to name
the models and tools on the record—and, when it matters, let anyone check that
*you* sealed that story to *these* bytes. Or you post something you wrote
yourself, and want the same seal family to read human-authored without a purity
lecture.

**Innsigle** (say **INN-siggle**, rhymes with *single*) is that craft seal: a
visible mark, a short **colophon** of how the piece was made (human-authored,
mixed, or model-primary), and an optional house or person signature over the
content bytes.

Readers can learn the mark by sight—a **sigil** of care: the publisher put how
the work was made on the record. Same seal family for model-heavy docs and
human social posts.

## Two jobs, one system

### Docs (model-primary, proud)

Long-lived documentation often starts with models. Name the tools on the
colophon (Claude, sloptimizer, …). Sign with a house key when you want readers to
verify that your issuer sealed this colophon for these bytes.

### Social (human-authored, clear)

Short posts strip file metadata. Use the same seal family with a human cue and a
link out. Visibility first; per-post crypto optional.

## What a seal actually guarantees

When a claim is **signed**, verification answers one question: **did this issuer
seal this colophon for these content bytes?** It does not say whether the prose
is true. An unsigned mark is still a valid Innsigle—the signature is optional
depth, not a tax on using the mark.

### Check it

What we claim: the published sample is sealed to its exact file bytes.

```bash
npm install github:DocumentDrivenDX/innsigle
curl -sL -o page.html https://documentdrivendx.github.io/innsigle/sample/
curl -sL -o att.json https://documentdrivendx.github.io/innsigle/sample/.well-known/innsigle/claims/index.attestation.json
curl -sL -o keys.json https://documentdrivendx.github.io/innsigle/sample/.well-known/innsigle/keys.json
npx innsigle verify --attestation att.json --content page.html --keys keys.json
```

Expect: `VALID`. Live page: [Sample](sample/).

## Start here

1. [See the sealed sample](sample/) — model-primary page you can re-verify  
2. [Install the CLI](use/cli/) — keygen, claim, sign, verify  
3. [Seal a docs page](use/walkthrough-docs/) — full walkthrough  
4. [Why Innsigle](why/) — gap vs badges, C2PA, watermarks  
5. [Non-goals](non-goals/) — not a detector, not a purity product  
