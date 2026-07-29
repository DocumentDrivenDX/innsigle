# Changelog

## [0.1.0] — 2026-07-29

First public cut of **Innsigle** (content-origin seal CLI + microsite).

### Install

- CLI via GitHub: `npm install github:DocumentDrivenDX/innsigle` / `npx innsigle`
- Not on the npm registry yet (`private: true`); package ships `bin: innsigle`
- Install tests: `npm pack` → install tarball → full keygen/claim/sign/verify

### Product

- Colophon claims (human-authored / mixed / model-primary) + Ed25519 sign/verify
- Absolute `key_url` in signed payload (ADR-003); sample sealed on the microsite
- Session provenance (L2) + `propose-colo` (FEAT-004); multi-agent fixture driver
- Brand lines: *The maker's seal for published work* / *Content provenance for the AI era*
- Sample published **byte-identical** to signed `docs/sample/index.html`

### Docs / site

- Microsite: https://documentdrivendx.github.io/innsigle/
- Use/CLI install docs, walkthroughs, non-goals, glossary, HELIX specs published

### Quality

- Unit, install-pack, provenance, site-build, golden vectors
- Playwright e2e (link integrity + design voice) + GitHub Pages deploy workflow
