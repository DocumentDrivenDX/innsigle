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

`kind_from_frontmatter`: how a page declares its composition.
- `true` — `generated: true` means model-primary, otherwise
  `default_composition` (default `mixed`). Cannot distinguish human-authored
  from mixed.
- `{ "field": "composition" }` — that frontmatter key holds one of
  `model-primary`, `human-authored`, `mixed`. Any other value is an error.
