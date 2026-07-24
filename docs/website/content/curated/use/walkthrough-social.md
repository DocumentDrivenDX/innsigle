---
title: Walkthrough — human social mark
nav: use
weight: 26
parent: use
description: Step-by-step UC-human-social path for X-class platforms.
---

# Walkthrough: human social mark

**Reader mode:** Start. **Feature:** FEAT-003. **Use case:** UC-human-social.

## Goal

Mark a short post as human-authored with the Innsigle seal family, without
depending on platform-preserved file metadata—and without running a webserver.

## Steps

### 1. Confirm composition

Only use `human-authored` when humans produced the substantive words. Do not
mark model-primary text as human because it was sloptimized.

### 2. Publish issuer metadata (no server)

If you sign anything (optional for social v1, required when you do sign):

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

Use the H-cue SVG from the mark pack:

- Repo: `docs/sample/assets/marks/innsigle-human.svg`
- Site: [Marks](../marks/)

Render to PNG at 128×128 if the platform prefers raster attachments.

### 5. Place on the post

Pick one or both:

1. **Image:** attach the mark still (or composite into a card).  
2. **Link:** short URL to how-to-read (e.g. site Use → Marks) and/or your keys URL.

Example caption skeleton:

```text
Human-authored. Innsigle colo: H.
key ed25519:… · keys https://…
How to read: https://documentdrivendx.github.io/innsigle/use/marks/
```

### 6. What not to do

- Do not rely on C2PA in the image surviving upload.  
- Do not use a different “purity” logo for human posts only.  
- Do not claim the platform verified authenticity.  
- Do not upload your private key anywhere.

## Captures

Add before/after post screenshots under `docs/website/static/captures/` when
available (e.g. `walkthrough-social-x.png`).
