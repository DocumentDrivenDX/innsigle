# Website content model (product-microsite-ia)

| Path | Role |
|------|------|
| `content/curated/` | **Hand-authored** product copy (Why, Use, Non-goals). Outside HELIX source tree. |
| `content/generated/` | **Auto-built** from `docs/helix/` (+ glossary). Do not edit. |
| `static/` | CSS, captures/screenshots, walkthrough assets |
| `ia.yml` | Reader modes, nav, generation paths |
| `VOICE.md` | Public-site voice |

## Commands

```bash
npm run site:publish   # docs/helix → content/generated
npm run site:build     # publish + render HTML → site/ (SITE_BASE=/innsigle)
npm run site:build:local  # SITE_BASE= for file:// or localhost root
bash scripts/publish-site.sh  # build + force-push gh-pages
```

## Rules

1. Specs and design docs live in `docs/helix/` (and other `docs/` sources).
2. Curated marketing/onboarding lives only under `content/curated/`.
3. `site/` HTML for content pages is generated; treat as deploy artifact.
4. Walkthrough captures go in `static/captures/` and link from Use pages.
