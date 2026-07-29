---
title: Walkthrough — human social mark
nav: use
weight: 26
parent: use
description: Step-by-step human-authored mark for X-class platforms.
---

# Walkthrough: human social mark

You wrote the post yourself. Platforms will strip file metadata. You still want
the **same Innsigle seal family** as your docs—with a clear human cue—and you
do not want to run a webserver.

## Goal

Mark a short post as **human-authored** so viewers can see composition without a
purity lecture and without depending on C2PA surviving upload.

## Steps

### 1. Confirm composition

Only use `human-authored` when humans produced the substantive words. Do not
mark model-primary text as human because it was sloptimized.

### 2. Publish issuer metadata (no server)

If you sign anything (optional for social, required when you do sign):

1. `keygen` + `keys template` → `issuer.json`  
2. Host the **public** file on a free HTTPS host (GitHub Gist raw, Codeberg, Pages, …)  
3. That absolute URL is your `key_url`  

See [Issuer identity](../issuer/).

### 3. Embed an issuer card on your profile

Bio / about + website field:

```text
Innsigle · Your Name
key ed25519:YOUR_FINGERPRINT_HERE
keys https://gist.githubusercontent.com/you/…/raw/issuer.json
```

Link field → the same `keys` URL. This is **discovery**, not a seal.

### 4. Export the mark

Use the **H** cue from the mark pack:

- Repo: `docs/sample/assets/marks/innsigle-human.svg`  
- Site catalog: [Marks](../marks/)  

Render to PNG at 128×128 if the platform prefers raster attachments.

### 5. Place on the post

Pick one or both:

1. **Image:** attach the mark still (or composite into a card).  
2. **Link:** short URL to how-to-read (e.g. site Use → Marks) and/or your keys URL.  

Example caption skeleton:

```text
Human-authored. Innsigle mark: H.
key ed25519:… · keys https://…
How to read: https://documentdrivendx.github.io/innsigle/use/marks/
```

### 6. What not to do

- Do not rely on C2PA in the image surviving upload.  
- Do not use a different “purity” logo for human posts only.  
- Do not claim the platform verified authenticity.  
- Do not upload your private key anywhere.  

## Same family as docs

Model-primary docs use the **A** cue; human posts use **H**. Both are Innsigle.
See the [home](../../) dual-job story and [Non-goals](../../non-goals/).

## Spec

Feature note: [human social mark](../../reference/artifacts/features/feat-003-human-social-mark/)

## Captures

Add before/after post screenshots under `docs/website/static/captures/` when
available (e.g. `walkthrough-social-x.png`).
