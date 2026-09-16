---
title: Use
nav: use
weight: 20
description: Try Innsigle: CLI, colophon, verify, and marks.
---

# Use Innsigle

Start with a **maker profile** (plain seals, one bio URL, no keys). Then, when
you have stable file bytes, **install** the CLI, **see** a signed sample, and
**verify**.

## 1. Install

Node 20+. Not on the public npm registry yet.

```bash
npm install github:DocumentDrivenDX/innsigle
npx innsigle
```

Or clone and `npm install -g .` / `node src/cli.mjs`. Details: [CLI](cli/).

## 2. See a real seal

Open the [sealed sample](../sample/), model-primary docs with a live attestation.
Re-check it anytime with the commands on [Verify](verify/) or [CLI](cli/).

## 3. Learn the pieces

| Page | Question |
|------|----------|
| [Maker profile](profile/) | How do I stamp Docs, mail, and slides without keys? |
| [CLI](cli/) | How do I install and run keygen, claim, sign, verify? |
| [Issuer](issuer/) | How do I get a key and publish it without a server? |
| [Colophon](colophon/) | How do I declare composition? |
| [Provenance](provenance/) | Proposed colophon from agent sessions |
| [Verify](verify/) | What does VALID mean? |
| [Marks](marks/) | Which seal cue for which state? |

## 4. Walk it through

| Walkthrough | Story |
|-------------|--------|
| [Seal a docs page](walkthrough-docs/) | Model-primary page from colo to verify |
| [Conversation → colophon](walkthrough-provenance/) | Agent session to sealed document |
| [Human social mark](walkthrough-social/) | Human-authored mark when metadata dies |
| [Profile in your bio](walkthrough-profile/) | One URL for X, LinkedIn, Slack; stamp a Doc |
| [Hugo site](walkthrough-hugo/) | Init → `.innsigle/` → publish wire → seal (screencast) |

## Proof

- [Sample](../sample/): signed page in this site tree
- [Sample profile](/examples/profile/): unsigned maker page you can copy
- [Golden vectors](https://github.com/DocumentDrivenDX/innsigle/tree/main/tests/vectors): crypto fixtures

Deeper specs (generated from design docs): [Reference](../reference/).
