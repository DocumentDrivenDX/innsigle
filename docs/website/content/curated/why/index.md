---
title: Why Innsigle
nav: why
weight: 10
description: Why content provenance matters when models draft and platforms strip metadata.
---

# Why Innsigle

You ship work in an AI-shaped world: models draft, platforms strip metadata, and
readers still want a straight answer to *how was this made?* Badges that only
celebrate “no AI” leave model-primary docs without a proud path. Industrial
media pipelines do not center HTML docs or short posts.

**Content provenance for the AI era** is that problem: origin under *your*
control, as a mark people can learn by sight.

## The gap

| Approach | Example | Miss for makers |
|----------|---------|-----------------|
| Human-only badges | Not By AI | No proud path for model-primary docs |
| Media credentials | C2PA | Social uploads strip metadata; not optimized for plain HTML docs or short social posts |
| Vendor watermark | SynthID | Not a maker-authored bill of production |
| Free-text footer | “Written with AI” | No shared mark or signature check |

You need one language for **how work was made**, usable for:

1. **Owned docs** — a signed colophon that can name models without shame  
2. **Human social posts** — a mark that survives when file metadata dies  

**Innsigle** is that language: the maker's seal under your control, across docs
and social, with an optional signature over content bytes. C2PA and similar stay
in their lane for industrial media—see [Non-goals](../non-goals/).

## What you can check

We do not ask you to take the marketing on faith. The microsite ships a
[sealed sample](../sample/) you can re-verify with the CLI. That lets a reader
check one binding: this issuer sealed this colophon for these bytes. It does not
check whether the article is true.

### Check it

What we claim: the published sample verifies under its live claim and keys.

```bash
npm install github:DocumentDrivenDX/innsigle
curl -sL -o page.html https://documentdrivendx.github.io/innsigle/sample/
curl -sL -o att.json https://documentdrivendx.github.io/innsigle/sample/.well-known/innsigle/claims/index.attestation.json
curl -sL -o keys.json https://documentdrivendx.github.io/innsigle/sample/.well-known/innsigle/keys.json
npx innsigle verify --attestation att.json --content page.html --keys keys.json
```

Expect: `VALID`. Same recipe on [CLI](../use/cli/).

## Next

- [Install and seal](../use/)  
- [Non-goals](../non-goals/) — category boundaries  
