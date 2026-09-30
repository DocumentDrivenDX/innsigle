# Innsigle × Hugo

Seal your source markdown, publish the issuer document at a stable URL, and
render a colophon on each page that proves the seal still matches the source.

## Quick start

```sh
innsigle init --onepassword --hugo \
  --site-url https://example.com \
  --content-root content
innsigle seal --all
innsigle doctor --hugo      # check the wiring before you trust it
hugo
```

`--hugo` copies the partials and CSS into your site, creates `static/` if it
is missing, writes a theme adapter where your theme expects one, and appends
the `module.mounts` block to a root `hugo.yaml` that does not already declare
mounts. Anything it cannot do safely it prints for you to paste.

## What gets installed

| File | Purpose |
| --- | --- |
| `layouts/_partials/innsigle-colophon.html` | Per-page seal, with the attestation embedded as `application/innsigle+json` |
| `layouts/_partials/innsigle-badge.html` | Compact marker for list, archive and card views |
| `layouts/_partials/innsigle-glyph.html` | The mark, inline SVG, `currentColor` |
| `assets/css/innsigle.css` | Styling, via CSS custom properties you can override |

On Hugo below 0.146 these land in `layouts/partials/` instead.

## Mounts

```yaml
module:
  mounts:
    - {source: content, target: content}
    - {source: assets,  target: assets}
    - {source: layouts, target: layouts}
    - {source: static,  target: static}
    - {source: .innsigle/public, target: static/.well-known/innsigle}
    - {source: .innsigle/public, target: assets/innsigle}
    - {source: content,          target: assets/content-src}
```

**Declaring any mount replaces all of Hugo's defaults.** The first four entries
are not decoration — omit them and the site loses its content, assets, layouts
and static files. This is the single easiest way to break a Hugo site while
adding innsigle, which is why `--hugo` emits the whole block.

The three innsigle mounts do different jobs. `static/.well-known/innsigle`
publishes `keys.json` and the claims at the URL your claims are signed with.
`assets/innsigle` makes the same tree readable at build time. `assets/content-src`
exposes the source bytes so the partial can re-hash them.

## Declaring composition

Set the field mode in `.innsigle/config.json` (`--hugo` does this for you):

```json
"kind_from_frontmatter": { "field": "composition" }
```

Then each page declares itself:

```yaml
---
title: A post
composition: model-primary   # or human-authored, or mixed
---
```

The older `"kind_from_frontmatter": true` still works, but it only recognises
`generated: true` and so cannot distinguish human-authored from mixed. If you
use legacy mode while your pages carry a `composition:` field, the badge and
the seal will disagree on the same page — `doctor` warns about exactly this.

## Calling the partials

`--hugo` writes an adapter for themes it recognises:

| Theme | Adapter path | Also needed |
| --- | --- | --- |
| PaperMod | `layouts/partials/comments.html` | `params.comments: true` |
| Hextra | `layouts/_partials/components/comments.html` | — |

For anything else, call it yourself from your single-page template:

```gotemplate
{{ partial "innsigle-colophon.html" . }}
```

and, in list templates:

```gotemplate
{{ partial "innsigle-badge.html" . }}
```

## Badge options

```yaml
params:
  innsigle:
    field: composition   # frontmatter key the badge reads; default "composition"
    badgeAll: false      # show human-authored too; default false
    warnUnsealed: false  # build warning for any page with no claim
```

`warnUnsealed` is worth turning on once every page is meant to be sealed: a
page with no claim renders nothing and is indistinguishable from a broken
`assets/innsigle` mount.

## Why a page shows no seal

The partial refuses to render rather than show a seal that would not verify.
Each case emits a build warning naming the file:

- the source is unreadable — `assets/content-src` is not pointing at your
  content root
- the digest no longer matches — the page was edited after sealing; run
  `innsigle seal --all`
- an unsupported digest algorithm

A page with no claim at all is silent unless `warnUnsealed` is set.

## Checking the wiring

```sh
innsigle doctor --hugo
```

It validates the config, confirms all three mounts are declared **and that
Hugo actually resolves them** (`hugo config mounts`), finds the partial and
whether anything calls it, reports stale or unsealed claims, and compares each
page's declared composition against what its seal says.

## CI

Claims are committed, so CI only needs to verify:

```sh
innsigle verify --all
```

If you use the two-key split (ADR-004), generated pages are sealed in CI with
`innsigle seal --all --role build` before the Hugo build, using the build key
from a repository secret.
