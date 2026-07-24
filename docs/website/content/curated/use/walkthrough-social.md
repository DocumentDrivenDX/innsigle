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
depending on platform-preserved file metadata.

## Steps

### 1. Confirm composition

Only use `human-authored` when humans produced the substantive words. Do not
mark model-primary text as human because it was sloptimized.

### 2. Export the mark

Use the H-cue SVG from the mark pack:

- Repo: `docs/sample/assets/marks/innsigle-human.svg`
- Site: [Marks](../marks/)

Render to PNG at 128×128 if the platform prefers raster attachments.

### 3. Place on the post

Pick one or both:

1. **Image:** attach the mark still (or composite into a card).
2. **Link:** include a short URL to how-to-read (e.g. site Use → Marks or house profile).

Example caption skeleton:

```text
Human-authored. Innsigle colophon: H.
How to read: https://documentdrivendx.github.io/innsigle/use/marks/
```

### 4. Optional: profile anchor

Put a stable link in bio to keys + meaning page so individual posts can stay
unsigned.

### 5. What not to do

- Do not rely on C2PA in the image surviving upload.
- Do not use a different “purity” logo for human posts only.
- Do not claim the platform verified authenticity.

## Captures

Add before/after post screenshots under `docs/website/static/captures/` when
available (e.g. `walkthrough-social-x.png`).
