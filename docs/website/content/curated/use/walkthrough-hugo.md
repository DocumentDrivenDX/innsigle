---
title: Walkthrough: Hugo site
nav: use
weight: 27
parent: use
description: Bootstrap a trivial Hugo site, init Innsigle under .innsigle/, wire publish, seal and verify.
---

# Walkthrough: Hugo site

You have (or can create) a **static site with Hugo**. You want a house key in
1Password, public keys under `/.well-known/innsigle/`, and a signed homepage —
without Innsigle learning Hugo’s layout rules.

## Screencast

Step-by-step terminal walkthrough (narrated on screen):

1. One-time `init` → `.innsigle/` + 1Password  
2. Publish wire → copy public staging into the site  
3. `innsigle seal public/index.html`  
4. `innsigle verify public/index.html` → **VALID**

Demo uses a stub `op` so recording does not need a vault; production uses
`op signin`.

<video controls playsinline preload="metadata" width="100%" style="max-width:48rem;border:1px solid #ccc;border-radius:6px;background:#111">
<source src="../../captures/walkthrough-hugo.mp4" type="video/mp4" />
</video>

[GIF fallback](/captures/walkthrough-hugo.gif) · regenerate with
`npm run record:hugo-walkthrough`.

## Goal

1. `innsigle init --onepassword` writes only **`.innsigle/`**
2. An agent (or you) copies **`.innsigle/public/` → site `/.well-known/innsigle/`**
3. After `hugo`, **`innsigle seal`** the built `public/index.html`
4. **`innsigle verify`** prints **VALID**

## Prerequisites

- Node 20+
- [Hugo](https://gohugo.io/) on `PATH`
- [1Password CLI](https://developer.1password.com/docs/cli/get-started/) (`op`) signed in  
  (e2e tests / screencast use a fake `op` via `INNSIGLE_OP_BIN`)

## Automated proof (this repo)

```bash
npm test -- tests/hugo-workflow.test.mjs
# or:
node scripts/hugo-innsigle-workflow.mjs --out-dir /tmp/hugo-demo --keep
```

Expect: exit 0, stderr contains `VALID`.

## Steps

### 1. Init (once per repo)

```bash
innsigle init --onepassword --site-url https://hugo-demo.example
```

Writes `.innsigle/config.json` (fingerprint + `op://` ref), stages
`.innsigle/public/keys.json`, and `AGENTS.md` for publish wiring.

### 2. Publish wire (not Innsigle’s job)

```bash
mkdir -p static/.well-known/innsigle
cp -a .innsigle/public/. static/.well-known/innsigle/
```

### 3. Build, seal, verify

```bash
hugo -d public

innsigle seal public/index.html
innsigle verify public/index.html
# expect VALID
```

Optional: `--kind model-primary|human-authored|mixed`, or `.innsigle/colo.json`.

Re-run `seal` after rebuilds that change the published HTML bytes.

### Check it

```bash
node scripts/hugo-innsigle-workflow.mjs --keep --out-dir /tmp/hugo-demo
```

## Why Hugo is only an example

Innsigle never probes `static/` vs `public/` vs `_site/`. The same
`.innsigle/public → /.well-known/innsigle` rule works for any static host —
see `.innsigle/AGENTS.md` after init.

## Spec

[CONTRACT-001](../../reference/artifacts/contracts/contract-001-claim-and-cli/) ·
[Issuer](../issuer/) · [CLI](../cli/)
