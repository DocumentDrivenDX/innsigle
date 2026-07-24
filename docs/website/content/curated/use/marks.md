---
title: Marks
nav: use
weight: 24
parent: use
description: Seal mark pack — choosable families, H/M/A composition cues.
---

# Marks

Pick a **seal family**, then a **composition countermark**. Opaque stamp matrices
inspired by craft seals, merchant marks, pottery cartouches, and hallmarks—not
detectors or purity badges.

This site’s header and footer use the **matrix** family (`innsigle-*.svg`). Use
any family in your own footers and social posts.

## Composition cues

| Cue | File suffix | Meaning |
|-----|-------------|---------|
| (none) | `-base` | Neutral / tiny chrome |
| **H** | `-human` | `human-authored` |
| **M** | `-mixed` | `mixed` |
| **A** | `-model` | `model-primary` |

## Families

### Matrix (default)

Beaded rim, merchant-mark monogram (stave + thryst + lozenge). Site chrome.

<div class="mark-family">
<div class="mark-pack" role="list">
<figure class="mark-card" role="listitem">
<img src="/assets/marks/innsigle-base.svg" width="88" height="88" alt="Matrix base" />
<span class="label"><strong>Base</strong><code>innsigle-base.svg</code></span>
</figure>
<figure class="mark-card" role="listitem">
<img src="/assets/marks/innsigle-human.svg" width="88" height="88" alt="Matrix human" />
<span class="label"><strong>H</strong><code>innsigle-human.svg</code></span>
</figure>
<figure class="mark-card" role="listitem">
<img src="/assets/marks/innsigle-mixed.svg" width="88" height="88" alt="Matrix mixed" />
<span class="label"><strong>M</strong><code>innsigle-mixed.svg</code></span>
</figure>
<figure class="mark-card" role="listitem">
<img src="/assets/marks/innsigle-model.svg" width="88" height="88" alt="Matrix model" />
<span class="label"><strong>A</strong><code>innsigle-model.svg</code></span>
</figure>
</div>
</div>

### Brand

Heavy iron-brand silhouette. Reads at distance (social thumbs, avatars).

<div class="mark-family">
<div class="mark-pack" role="list">
<figure class="mark-card" role="listitem">
<img src="/assets/marks/brand-base.svg" width="88" height="88" alt="Brand base" />
<span class="label"><strong>Base</strong><code>brand-base.svg</code></span>
</figure>
<figure class="mark-card" role="listitem">
<img src="/assets/marks/brand-human.svg" width="88" height="88" alt="Brand human" />
<span class="label"><strong>H</strong><code>brand-human.svg</code></span>
</figure>
<figure class="mark-card" role="listitem">
<img src="/assets/marks/brand-mixed.svg" width="88" height="88" alt="Brand mixed" />
<span class="label"><strong>M</strong><code>brand-mixed.svg</code></span>
</figure>
<figure class="mark-card" role="listitem">
<img src="/assets/marks/brand-model.svg" width="88" height="88" alt="Brand model" />
<span class="label"><strong>A</strong><code>brand-model.svg</code></span>
</figure>
</div>
</div>

### Cartouche

Pottery-style square plate inside a round matrix. Light field, dark monogram.

<div class="mark-family">
<div class="mark-pack" role="list">
<figure class="mark-card" role="listitem">
<img src="/assets/marks/cartouche-base.svg" width="88" height="88" alt="Cartouche base" />
<span class="label"><strong>Base</strong><code>cartouche-base.svg</code></span>
</figure>
<figure class="mark-card" role="listitem">
<img src="/assets/marks/cartouche-human.svg" width="88" height="88" alt="Cartouche human" />
<span class="label"><strong>H</strong><code>cartouche-human.svg</code></span>
</figure>
<figure class="mark-card" role="listitem">
<img src="/assets/marks/cartouche-mixed.svg" width="88" height="88" alt="Cartouche mixed" />
<span class="label"><strong>M</strong><code>cartouche-mixed.svg</code></span>
</figure>
<figure class="mark-card" role="listitem">
<img src="/assets/marks/cartouche-model.svg" width="88" height="88" alt="Cartouche model" />
<span class="label"><strong>A</strong><code>cartouche-model.svg</code></span>
</figure>
</div>
</div>

### Ring (signet)

Concentric bezel rings; smaller monogram field. Quieter on dense footers.

<div class="mark-family">
<div class="mark-pack" role="list">
<figure class="mark-card" role="listitem">
<img src="/assets/marks/ring-base.svg" width="88" height="88" alt="Ring base" />
<span class="label"><strong>Base</strong><code>ring-base.svg</code></span>
</figure>
<figure class="mark-card" role="listitem">
<img src="/assets/marks/ring-human.svg" width="88" height="88" alt="Ring human" />
<span class="label"><strong>H</strong><code>ring-human.svg</code></span>
</figure>
<figure class="mark-card" role="listitem">
<img src="/assets/marks/ring-mixed.svg" width="88" height="88" alt="Ring mixed" />
<span class="label"><strong>M</strong><code>ring-mixed.svg</code></span>
</figure>
<figure class="mark-card" role="listitem">
<img src="/assets/marks/ring-model.svg" width="88" height="88" alt="Ring model" />
<span class="label"><strong>A</strong><code>ring-model.svg</code></span>
</figure>
</div>
</div>

## How to use

1. Choose a **family** that fits the surface (brand for social; ring for dense docs).
2. Choose the **cue** that matches your colo composition.
3. Link the mark to your colophon or attestation—not to a “verified true” claim.
4. Export PNG at 128 or 256 if a platform hates SVG.

```html
<a href="/path/to/colo-or-claim">
  <img src="brand-model.svg" width="48" height="48" alt="Innsigle, model-primary" />
</a>
```

## Sizes on this site

| Place | Size |
|-------|------|
| Header brand | 40px (matrix base) |
| Footer seal | 48px (matrix base) |
| Catalog cards | ~88px |

## Do / don’t

| Do | Don’t |
|----|--------|
| High-contrast solid matrix | Green = human, red = AI |
| Link mark to colophon | Imply “content is true” |
| Same family for all composition states | A human-only purity fork of the product |
| Let makers pick a family | Force one glyph when another reads better |

Source: `docs/sample/assets/marks/` (synced to site assets at build). Research notes in
`RESEARCH.md`.
