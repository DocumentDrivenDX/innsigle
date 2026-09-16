# Hugo × Innsigle (Helix pattern)

Seal **markdown sources**, publish `/.well-known/innsigle/`, render a colophon
only when the claim digest still matches the source bytes.

## One-time

```bash
innsigle init --onepassword \
  --site-url https://example.com/ \
  --content-root docs/website/content
# writes content_globs: docs/website/content/**/*.md
# and kind_from_frontmatter: true
```

## Everyday

```bash
# Human-controlled pages (mixed / human-authored) — never put this key in GitHub
innsigle seal --all --role human
git add .innsigle/public && git commit

# Generated pages — CI, with INNSIGLE_BUILD_KEY
innsigle seal --all --role build
innsigle publish public
innsigle verify --all
```

Once: `innsigle endorse --subject-key-id <build-key-id> --purpose build-signing`

## Hugo mounts

```yaml
module:
  mounts:
    - source: ../.innsigle/public
      target: static/.well-known/innsigle
    - source: ../.innsigle/public
      target: assets/innsigle
    - source: ../docs/website/content
      target: assets/content-src
```

Copy `layouts/_partials/innsigle-colophon.html` into your site (Hextra: drop
it in as `layouts/_partials/components/comments.html` to run at the end of
every docs page, which is what HELIX does).

The partial warns `innsigle: …` and renders nothing when a page is edited
but not re-sealed. `innsigle verify --all` is the CI gate the warning cannot
be.
