---
title: Maker profile
nav: use
weight: 23.5
parent: use
description: One bio URL and plain (unsigned) seals for Docs, mail, and slides.
---

# Maker profile

You want a URL for X, LinkedIn, and Slack, and a way to say how a Google Doc or
deck was made without hashing a file that will keep changing. Start here. No
keys. No Node required if you use the builder below.

A **plain seal** is an unsigned declaration: composition (human-authored, mixed,
or model-primary) plus optional named tools. It is not a signature. Recipients
do not run `innsigle verify`. The word VALID does not apply.

The **profile** is a short page that lists you, your links, and those works.
Put its URL in every bio. Same idea as a link page, with a composition cue on
each row.

## Live sample

[Sample maker profile](/examples/profile/): three plain seals, no signature.

## Build yours

Fill this in, add a work, copy the bio card into a social profile, and paste the
footer line into the Doc, deck, or mail. Then download `index.html` and host it
(GitHub Pages, a gist, Netlify Drop, or any static host).

<section id="innsigle-profile-builder" class="profile-builder" aria-label="Profile builder"></section>
<script type="module" src="/assets/js/profile-builder.js"></script>

## CLI (optional)

Same renderer, no website needed:

```bash
innsigle profile init --id ada --name "Ada Maker" --out-dir ./innsigle-profile
innsigle profile add --profile ./innsigle-profile/profile.json \
  --title "Q3 strategy memo" \
  --url https://docs.google.com/document/d/… \
  --kind mixed --model Claude
innsigle profile bio --profile ./innsigle-profile/profile.json
```

`profile add` prints the footer line. Publish the folder; put the public URL in
`--url` on a later `init`/`add` so the line includes your host.

## What not to do

- Do not treat a profile row as a signed claim. Export a PDF and [seal](../walkthrough-docs/) when you need bytes that verify.
- Do not mark model-primary text as human-authored because you edited it. Use mixed, or keep model-primary.
- Do not put a private key on this page.

## Next

- [Walkthrough: profile in your bio](../walkthrough-profile/)
- [Marks](../marks/): which cue for which composition
- [Issuer](../issuer/): add a key later, on the same page

### Check it

What we claim: the sample profile is an unsigned declaration, and `verify`
refuses it.

Open [the sample](/examples/profile/). Expect **Unsigned declaration** on each
work, and no VALID badge.

```bash
innsigle verify --attestation docs/website/static/examples/profile/profile.json \
  --content docs/website/static/examples/profile/profile.json \
  --keys docs/website/static/examples/profile/profile.json
```

Expect: exit **5**, message about an unsigned declaration.

Spec: [plain seals and maker profile](../../reference/artifacts/features/feat-005-plain-seals-and-maker-profile/)
