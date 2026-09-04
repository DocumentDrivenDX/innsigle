# Innsigle × Quarto

Reference integration for rendering Innsigle colophon seals on a Quarto
website. Two files, both vendored into your Quarto project:

- `innsigle.lua` — a Pandoc/Quarto filter that appends a colophon footer
  to any HTML page covered by a verified claim, and suppresses the footer
  (with a render warning) when the page was edited after sealing.
- `publish-innsigle` — a post-render hook that copies the Innsigle public
  tree (issuer keys + claim attestations) into the rendered site at
  `/.well-known/innsigle/`, so seals are verifiable by third parties.

## Install

Copy both files into your Quarto project root (or keep the filter under
`filters/` and adjust the path below), make the hook executable, and wire
them in `_quarto.yml`:

```yaml
project:
  type: website
  post-render:
    - ./publish-innsigle

filters:
  - innsigle.lua
```

```sh
chmod +x publish-innsigle
```

The filter needs `openssl` on `PATH` (used for sha256; present on macOS
and typical Linux hosts).

## Where attestations live

`innsigle init` creates `.innsigle/` at the repo root; `innsigle seal`
writes signed attestations into the staging tree:

```
.innsigle/
  config.json                 issuer identity + key reference
  public/                     everything publishable
    keys.json                 issuer document (public keys)
    claims/
      <slug>.attestation.json one signed claim per sealed source file
```

Claim filenames use the canonical slug contract shared with the CLI
(PLAN-001 A1): the project-relative source path with every run of
non-alphanumeric characters collapsed to `-`, plus `.attestation.json` —
for example `posts/hello/index.qmd` →
`posts-hello-index-qmd.attestation.json`. The filter checks the
slug-named claim first and falls back to scanning the rest of
`.innsigle/public/claims/`, so legacy basename-named attestations keep
matching by subject URI.

At render time, `publish-innsigle` copies `.innsigle/public/` into
`$QUARTO_PROJECT_OUTPUT_DIR/.well-known/innsigle/` (default `_site`), so
the published site serves:

```
/.well-known/innsigle/keys.json
/.well-known/innsigle/claims/<slug>.attestation.json
```

The footer's "attestation file" link points at that published path.

## How a page gets its footer

A claim matches a page when one of its subjects' URIs has a path equal to
`/<project-relative-source-path>` (e.g. `https://example.com/index.qmd`
for `index.qmd`) **and** the subject's sha256 digest matches the current
source bytes. Only then does the colophon footer render.

## Re-seal after every edit

The seal covers exact source bytes. If you edit a sealed `.qmd` and
re-render without re-sealing, the digest no longer matches: the filter
emits a render warning —

```
WARNING (innsigle.lua): index.qmd: source bytes no longer match claim …
(edited since sealing?); re-run `innsigle seal` -- no colophon rendered
```

— and renders **no footer** for that page. A stale seal is never
displayed. To restore the footer:

```sh
innsigle seal path/to/page.qmd
quarto render
```

`innsigle verify path/to/page.qmd` confirms the published attestation
still matches before you deploy.
