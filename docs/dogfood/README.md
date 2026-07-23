# Dogfood site (UC-AI-docs)

| Path | Role |
|------|------|
| `index.html` | Sample docs page (content subject) |
| `bill.json` | Mash bill used when signing |
| `assets/marks/` | Seal SVG exploration pack |
| `snippets/footer.html` | Copy-paste footer |
| `.well-known/innsigle/keys.json` | Public issuer keys |
| `.well-known/innsigle/claims/` | Claim + attestation |

Private signing key lives in `.dogfood-secrets/` (gitignored). To re-sign after
editing `index.html`:

```bash
node src/cli.mjs keygen --out-dir .dogfood-secrets/dogfood-key   # if missing
# rebuild keys.json from public material, then:
node src/cli.mjs claim build --content docs/dogfood/index.html \
  --bill docs/dogfood/bill.json \
  --issuer-id azgaard-dogfood --issuer-name "Azgaard Dogfood" \
  --key-id "$(cat .dogfood-secrets/dogfood-key/key-id.txt)" \
  --key-url ./keys.json \
  --out docs/dogfood/.well-known/innsigle/claims/index.claim.json
node src/cli.mjs sign \
  --claim docs/dogfood/.well-known/innsigle/claims/index.claim.json \
  --key .dogfood-secrets/dogfood-key/ed25519.priv.pem \
  --out docs/dogfood/.well-known/innsigle/claims/index.attestation.json
```
