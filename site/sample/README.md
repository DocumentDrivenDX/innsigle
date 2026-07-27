# Sample site (UC-AI-docs)

Live signed example of Innsigle on a static docs page (the maker's seal).

The site build copies this tree **byte-for-byte** into `site/sample/`. Relative
links (`.well-known/`, `assets/marks/`) stay relative so the published page
matches the signed content digest. Do not rewrite paths at build time.

| Path | Role |
|------|------|
| `index.html` | Sample docs page (content subject) |
| `colo.json` | Colophon used when signing |
| `assets/marks/` | Seal SVG pack |
| `snippets/footer.html` | Copy-paste footer |
| `.well-known/innsigle/keys.json` | Public issuer keys |
| `.well-known/innsigle/claims/` | Claim + attestation |

Private signing key lives in `.dogfood-secrets/` (gitignored). To re-sign after
editing `index.html`:

```bash
# key already at .dogfood-secrets/dogfood-key for this repo
node src/cli.mjs claim build --content docs/sample/index.html \
  --colo docs/sample/colo.json \
  --issuer-id azgaard-dogfood --issuer-name "Azgaard Sample" \
  --key-id "$(cat .dogfood-secrets/dogfood-key/key-id.txt)" \
  --key-url "https://documentdrivendx.github.io/innsigle/sample/.well-known/innsigle/keys.json" \
  --out docs/sample/.well-known/innsigle/claims/index.claim.json
node src/cli.mjs sign \
  --claim docs/sample/.well-known/innsigle/claims/index.claim.json \
  --key .dogfood-secrets/dogfood-key/ed25519.priv.pem \
  --out docs/sample/.well-known/innsigle/claims/index.attestation.json
```
