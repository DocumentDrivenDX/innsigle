---
title: Use
nav: use
weight: 20
description: Try Innsigle — CLI, colophon, verify, and marks.
---

# Use Innsigle

Four beats: **install** the tool → **see** a sealed sample → **declare** how a
file was made → **verify** (yours or someone else’s).

## 1. Install

Node 20+. Not on the public npm registry yet.

```bash
npm install github:DocumentDrivenDX/innsigle
npx innsigle
```

Or clone and `npm install -g .` / `node src/cli.mjs`. Details: [CLI](cli/).

## 2. See a real seal

Open the [sealed sample](../sample/)—model-primary docs with a live attestation.
Re-check it anytime with the commands on [Verify](verify/) or [CLI](cli/).

## 3. Learn the pieces

| Page | Question |
|------|----------|
| [CLI](cli/) | How do I install and run keygen, claim, sign, verify? |
| [Issuer](issuer/) | How do I get a key and publish it without a server? |
| [Colophon](colophon/) | How do I declare composition? |
| [Provenance](provenance/) | Auto colophon from agent sessions |
| [Verify](verify/) | What does VALID mean? |
| [Marks](marks/) | Which seal cue for which state? |

## 4. Walk it through

| Walkthrough | Story |
|-------------|--------|
| [Seal a docs page](walkthrough-docs/) | Model-primary page from colo to verify |
| [Conversation → colophon](walkthrough-provenance/) | Agent session to sealed document |
| [Human social mark](walkthrough-social/) | Human-authored mark when metadata dies |

## Proof

- [Sample](../sample/) — signed page in this site tree  
- [Golden vectors](https://github.com/DocumentDrivenDX/innsigle/tree/main/tests/vectors) — crypto fixtures  

Deeper specs (generated from design docs): [Reference](../reference/).
