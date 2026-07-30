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

Recorded end-to-end run (init → Hugo build → sign → `VALID`). Demo uses a stub
`op` so CI can record without a vault; your machine uses real `op signin`.

<video controls playsinline width="100%" style="max-width:48rem;border:1px solid #ccc;border-radius:6px;background:#111">
<source src="../../captures/walkthrough-hugo.mp4" type="video/mp4" />
</video>

[GIF fallback](/captures/walkthrough-hugo.gif) · regenerate with
`bash scripts/record-hugo-walkthrough.sh` in the repo.

## Goal

1. `innsigle init --onepassword` writes only **`.innsigle/`**
2. An agent (or you) copies **`.innsigle/public/` → site `/.well-known/innsigle/`**
3. After `hugo`, claim + sign the **built** `public/index.html`
4. `innsigle verify` prints **VALID**

## Prerequisites

- Node 20+
- [Hugo](https://gohugo.io/) on `PATH`
- [1Password CLI](https://developer.1password.com/docs/cli/get-started/) (`op`) signed in  
  (e2e tests / screencast use a fake `op` via `INNSIGLE_OP_BIN`)

## Automated proof (this repo)

```bash
# Full workflow (skips cleanly if hugo missing)
npm test -- tests/hugo-workflow.test.mjs
# or:
node scripts/hugo-innsigle-workflow.mjs --out-dir /tmp/hugo-demo --keep
```

Expect: exit 0, stderr contains `VALID`, and
`/tmp/hugo-demo/public/.well-known/innsigle/keys.json` exists.

## Steps (what the script does)

### 1. Trivial Hugo site

Minimal `hugo.toml`, `content/_index.md`, and layouts with an Innsigle footer
partial linking at the attestation URL.

### 2. Init (1Password house key)

```bash
innsigle init --onepassword \
  --site-url https://hugo-demo.example \
  --issuer-id hugo-demo \
  --issuer-name "Hugo Demo"
```

Writes:

| Path | Role |
|------|------|
| `.innsigle/config.json` | `key_id`, `key_url`, `op://…` ref |
| `.innsigle/public/keys.json` | Public issuer document (staging) |
| `.innsigle/AGENTS.md` | Publish + seal checklist for agents |

Private key stays in 1Password only.

### 3. Publish wire (not Innsigle’s job)

From `.innsigle/AGENTS.md` / `config.publish.copy`:

```bash
mkdir -p static/.well-known/innsigle
cp -a .innsigle/public/. static/.well-known/innsigle/
```

Hugo copies `static/` into `public/` on build, so keys land at
`/.well-known/innsigle/keys.json` on the site.

### 4. Build, claim, sign, verify

```bash
hugo -d public

innsigle colo example --kind model-primary > colo.json
innsigle claim build \
  --content public/index.html \
  --uri https://hugo-demo.example/ \
  --colo colo.json \
  --out claim.json
# issuer flags default from .innsigle/config.json

innsigle sign --claim claim.json \
  --out .innsigle/public/claims/index.attestation.json
# private key via op read from config

cp -a .innsigle/public/. static/.well-known/innsigle/
cp -a static/.well-known/innsigle/. public/.well-known/innsigle/

innsigle verify \
  --attestation public/.well-known/innsigle/claims/index.attestation.json \
  --content public/index.html \
  --keys public/.well-known/innsigle/keys.json
# expect VALID
```

Sign the **rendered HTML bytes** you ship. Re-run claim/sign after intentional
rebuilds that change those bytes.

### Check it

What we claim: the workflow script and unit e2e keep this path green.

```bash
node scripts/hugo-innsigle-workflow.mjs --keep --out-dir /tmp/hugo-demo
# stderr ends with VALID
```

## Why Hugo is only an example

Innsigle never probes `static/` vs `public/` vs `_site/`. The **same**
`.innsigle/public → /.well-known/innsigle` copy rule works for Quarto, plain
rsync, or CI artifacts — see `.innsigle/AGENTS.md` after init.

## Spec

[CONTRACT-001](../../reference/artifacts/contracts/contract-001-claim-and-cli/) ·
[Issuer](../issuer/) · [CLI](../cli/)
