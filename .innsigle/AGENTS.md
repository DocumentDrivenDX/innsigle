# Agent instructions: Innsigle microsite seals

All project state is under `.innsigle/`. Private keys are never committed
(`.innsigle/keys/` is gitignored).

## After editing curated or generated markdown

```bash
innsigle seal --all --role human   # mixed / human-authored (never in GitHub)
innsigle seal --all --role build   # generated: true (INNSIGLE_BUILD_KEY in CI)
git add .innsigle/public
```

`site:build` copies `.innsigle/public/` to `site/.well-known/innsigle/` and
injects a colophon into each HTML page whose source digest still matches.

## CI

`innsigle verify --all` must stay green. Do not re-run `innsigle init`.
