---
title: Walkthrough: profile in your bio
nav: use
weight: 27
parent: use
description: Put an Innsigle profile URL in X, LinkedIn, and Slack; stamp a Google Doc.
---

# Walkthrough: profile in your bio

You write in Google Docs, mail, and slides. You want people to see how a piece
was made when they click the one link in your bio. You do not want to install
Node or generate a key yet.

## Goal

Publish a maker profile, put its URL in X / LinkedIn / Slack, and paste a
footer line into a living document.

## Steps

### 1. Build the page

Open [Maker profile](../profile/) and fill **Name** and **Profile id**. Add one
work: title, the Doc or deck URL, composition (mixed is the usual work default),
optional model name. Download `index.html`.

Or from a clone:

```bash
innsigle profile init --id you --name "Your Name" --out-dir ./innsigle-profile
innsigle profile add --profile ./innsigle-profile/profile.json \
  --title "Q3 strategy memo" \
  --url https://example.com/memo \
  --kind mixed --model Claude
```

### 2. Host it

Drop the file (or the `innsigle-profile/` folder) on GitHub Pages, Codeberg
Pages, Netlify Drop, or any static HTTPS host. You need a durable URL. You do
not need to run a server.

If the CLI wrote a `marks/` folder, publish it next to `index.html`.

### 3. Put the URL in bios

Copy the **bio card** from the builder (or `innsigle profile bio`):

```text
Innsigle · Your Name
https://you.github.io/innsigle/
```

| Surface | Field |
|---------|--------|
| X | Website / link field; optional "Innsigle" in the bio text |
| LinkedIn | Contact / website |
| Slack | Profile website (or a custom status that points at the same URL) |

One URL everywhere. Do not paste raw `keys.json` into the bio.

### 4. Stamp the work

Paste the **footer line** at the end of the Google Doc, the last slide notes, or
the email:

```text
Innsigle · mixed · you.github.io/innsigle#q3-strategy-memo
```

That line is the plain seal. The profile row is the colophon.

### 5. What not to do

- Do not hash the live Google Doc. It will drift. Stamp the living file; [seal](../walkthrough-docs/) a PDF later if you need a signature.
- Do not mark the work human-authored because a model draft was edited. That stays mixed or model-primary.
- Do not tell readers the profile is VALID. VALID is only for signed bytes.

## Check it

What we claim: you can produce a profile without keys, and verify still fails
closed on that file.

```bash
innsigle profile validate --profile ./innsigle-profile/profile.json
innsigle verify --attestation ./innsigle-profile/profile.json \
  --content ./innsigle-profile/index.html \
  --keys ./innsigle-profile/profile.json
```

Expect: `validate` prints **OK**; `verify` exits **5**.

Live example: [sample maker profile](/examples/profile/).

## Spec

[Plain seals and maker profile](../../reference/artifacts/features/feat-005-plain-seals-and-maker-profile/)
