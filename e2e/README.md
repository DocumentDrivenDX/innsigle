# Playwright e2e (microsite)

| Spec | Purpose |
|------|---------|
| `link-integrity.spec.ts` | Core IA leaves load; crawl same-origin links; `aria-current` on nav |
| `design-voice.spec.ts` | Visible copy, no detector theater claims, text not clipped, full-page screenshots (desktop + mobile) |

## Run

```bash
# Install browsers once
npx playwright install chromium

# Build local site (SITE_BASE empty) + serve + test
npm run test:e2e

# Refresh screenshot baselines after intentional visual changes
npm run test:e2e:update
```

Screenshots live in `e2e/*-snapshots/`. Review them when assessing DESIGN.md voice
(craft stamp, readable text, seal marks). CI runs `npm run test:e2e` before Pages deploy.
