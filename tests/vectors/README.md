# Golden vectors (CONTRACT-001 / ADR-001)

Fixed fixtures for independent verify implementations.

| File | Role |
|------|------|
| `content/sample.html` | Subject bytes (do not edit without regen) |
| `colo-model-primary.json` | Colophon only |
| `claim.json` | Claim payload (`issued_at` fixed) |
| `claim.jcs.txt` | RFC 8785 canonical JSON of payload |
| `claim.jcs.sha256` | SHA-256 hex of JCS bytes |
| `attestation.json` | Signed envelope |
| `keys.json` | Issuer public key document |
| `ed25519.priv.pem` | **Test-only** private key |
| `expected.json` | Digests and ids for assertions |

## Verify without regenerating

```bash
node src/cli.mjs verify \
  --attestation tests/vectors/attestation.json \
  --content tests/vectors/content/sample.html \
  --keys tests/vectors/keys.json
# expect exit 0 and VALID
```

## Regenerate (only when crypto/schema changes)

```bash
node scripts/generate-vectors.mjs
npm test
```

The private key is intentionally committed for reproducible signatures. Do not
reuse it outside this repository.
