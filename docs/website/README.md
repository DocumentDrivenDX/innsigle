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
npm run site:publish      # docs/helix → content/generated
npm run site:build        # publish + render HTML → site/ (SITE_BASE=/innsigle)
npm run site:build:local  # SITE_BASE= for file:// or localhost root
npm run test:e2e          # Playwright against local site/
```

## Deploy (GitHub Actions)

**Primary:** push to `main` (or **Actions → Deploy microsite → Run workflow**).

Workflow: `.github/workflows/pages.yml`

1. Unit tests + Playwright e2e  
2. Build with `SITE_BASE=/innsigle`  
3. `actions/upload-pages-artifact` + `actions/deploy-pages`  

Repo Pages source must be **GitHub Actions** (not the `gh-pages` branch).

**Emergency only:** `FORCE_LEGACY_GH_PAGES=1 bash scripts/publish-site.sh`  
force-pushes the old `gh-pages` branch. Prefer fixing CI instead.

## Rules

1. Specs and design docs live in `docs/helix/` (and other `docs/` sources).
2. Curated marketing/onboarding lives only under `content/curated/`.
3. `site/` HTML for content pages is generated; treat as deploy artifact.
4. Walkthrough captures go in `static/captures/` and link from Use pages.
