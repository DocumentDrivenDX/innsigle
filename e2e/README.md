# Playwright e2e (microsite)

| Spec | Purpose |
|------|---------|
| `link-integrity.spec.ts` | Core IA leaves load; crawl same-origin links; `aria-current` on nav |
| `design-voice.spec.ts` | Visible copy, no detector theater claims, text not clipped, full-page screenshots (desktop + mobile) |
| `hugo-workflow.spec.ts` | Walkthrough page + screencast assets; documents Hugo × Innsigle path |

**CLI workflow e2e** (Hugo on PATH): `npm run test:hugo` →
`scripts/hugo-innsigle-workflow.mjs` (init, static wire, build, sign, VALID).
Screencast: `npm run record:hugo-walkthrough` → `docs/website/static/captures/walkthrough-hugo.{mp4,gif}`.

## Run

```bash
# Install browsers once
npx playwright install chromium

# Preferred local agent gate (unit + e2e)
npm run test:agent

# Build local site (SITE_BASE empty) + serve + test only
npm run test:e2e

# Refresh screenshot baselines after intentional visual changes
npm run test:agent:update
# or: npm run test:e2e:update
```

After changing nav, layout, or page copy, run **`npm run test:agent:update`**, commit
updated files under `e2e/*-snapshots/`, then push. CI does not rewrite baselines.

Screenshots live in `e2e/*-snapshots/`. Review them when assessing DESIGN.md voice
(craft stamp, readable text, seal marks). CI runs `npm run test:e2e` before Pages deploy.
