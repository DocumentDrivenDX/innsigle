# Innsigle project state

Two keys, one issuer document (ADR-004). **Do not put private keys here.**

| Role | Seals | Custody |
|------|--------|---------|
| **human** | mixed / human-authored markdown in git | `.innsigle/keys/` (gitignored) or 1Password |
| **build** | `generated: true` / model-primary | gitignored PEM, or GitHub secret `INNSIGLE_BUILD_KEY` |

The human key **endorses** the build key (`innsigle endorse`). CI never holds the human key.

| Path | Purpose |
|------|---------|
| `config.json` | Issuer metadata, `content_root` / `content_globs`, optional local `signing_key` |
| `public/keys.json` | Public issuer document |
| `public/claims/` | Attestations over `docs/website/content/**/*.md` |
| `keys/` | Local private key (gitignored). Import into 1Password when you can. |

```bash
innsigle seal --all
innsigle publish site
innsigle verify --all
```

`kind_from_frontmatter`: `generated: true` → model-primary, else mixed (Helix).
