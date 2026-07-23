# Innsigle microsite

Static public site (DESIGN.md craft voice). Source of truth for HTML/CSS is this
directory. GitHub Pages serves the `gh-pages` branch.

**Live:** https://documentdrivendx.github.io/innsigle/

| Path | Page |
|------|------|
| `index.html` | What it is |
| `mash-bill.html` | Composition model |
| `verify.html` | Signet verify |
| `marks.html` | Seal pack H/M/A |
| `non-goals.html` | Category boundaries |
| `dogfood/` | Signed sample page |

Deploy: push to `main` runs `.github/workflows/pages.yml`, or
`bash scripts/publish-site.sh`.
