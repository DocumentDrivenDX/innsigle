---
title: Issuer identity
nav: use
weight: 22.5
parent: use
description: Get a key, publish issuer metadata without a webserver, share on social profiles.
---

# Issuer identity

You do **not** need to run a webserver to be an Innsigle issuer. You need:

1. An Ed25519 keypair (private key stays offline)  
2. A public **issuer document** at some durable **HTTPS** URL  
3. That absolute URL in every **signed** claim as `issuer.key_url` (ADR-003)

## Create keys

```bash
node src/cli.mjs keygen --out-dir ./keys
node src/cli.mjs keys template \
  --issuer-id my-house \
  --issuer-name "My House" \
  --public-key "$(cat keys/ed25519.pub.raw.b64url)" \
  --key-id "$(cat keys/key-id.txt)" \
  --out issuer.json
```

Keep `ed25519.priv.pem` offline. Never put it in a gist, bio, or site tree.

## Publish the issuer document (no server admin)

Upload **public** `issuer.json` (or `keys.json`) somewhere HTTPS and stable, for example:

| Option | How |
|--------|-----|
| **GitHub Gist / raw file** | Create gist → raw URL → use as `key_url` |
| **GitHub / Codeberg Pages** | Repo with `issuer.json`; Pages or raw link |
| **Static free host** | Neocities, Netlify Drop, Cloudflare Pages |
| **Your existing site** | Optional `/.well-known/innsigle/issuer.json` |

That HTTPS URL is what you pass to `claim build --key-url …`. It is **frozen inside the signature**.

## Embed on social profiles

Profiles are for **discovery**, not crypto. Use a short **issuer card**:

```text
Innsigle · My House
key ed25519:56a6f2f799318d5153b3ba9b5e955d3b
keys https://gist.githubusercontent.com/you/…/raw/issuer.json
```

| Field | Put |
|-------|-----|
| Bio / about | Issuer card (fingerprint + keys URL) |
| Website / link | Same `key_url` (or shortlink that resolves to it) |
| Avatar-adjacent | Optional [seal mark](../marks/) PNG |

**Do not** treat a bio as a seal. Anyone can paste someone else’s fingerprint. Verify seals with the CLI; pin fingerprints you care about.

### Platform notes

| Platform | Pattern |
|----------|---------|
| **X** | Link field → keys URL; bio → `key ed25519:…` |
| **GitHub** | Profile README or pinned gist with full card + raw JSON |
| **Bluesky / others** | Website field → keys URL; description → fingerprint |

## Seal content with your issuer

```bash
node src/cli.mjs claim build \
  --content ./page.html \
  --colo ./colo.json \
  --issuer-id my-house --issuer-name "My House" \
  --key-id "$(cat keys/key-id.txt)" \
  --key-url "https://…/issuer.json" \
  --out claim.json
node src/cli.mjs sign --claim claim.json --key keys/ed25519.priv.pem --out att.json
```

`--key-url` must be **absolute** `https://…` (relative paths are rejected).

## Trust and others’ keys

| Question | Answer |
|----------|--------|
| How do others trust me? | They pin your **fingerprint**, and/or follow **key-endorsements** you and peers publish (ADR-003 WoT) |
| How do I verify them? | Get content + attestation + their issuer document (`key_url` in the signed claim); `innsigle verify` |
| Duplicate house names? | Fine — identity is the **key**, not the slug |

Deep design: [ADR-003](../../reference/artifacts/adrs/adr-003-issuer-url-and-web-of-trust/), [Verify](../verify/).
