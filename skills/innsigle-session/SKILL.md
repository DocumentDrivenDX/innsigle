---
name: innsigle-session
description: Capture agent session provenance and propose an Innsigle colophon for files produced in the session.
---

# innsigle-session skill

When enabled, treat file writes and human prompts as a **session journal**, then
use the Innsigle CLI to build L2 provenance and propose a colophon.

## Do

1. Append versioned JSONL events (`session-journal-event` schema).  
2. On request (or session end), run:

```bash
node src/cli.mjs provenance build \
  --journal .innsigle/session.jsonl \
  --generated-at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --out .innsigle/session-provenance.json

node src/cli.mjs provenance propose-colo \
  --provenance .innsigle/session-provenance.json \
  --out .innsigle/colo.json
```

3. **Stop for operator review** before `claim build` / `sign` / publish.  
4. Never set `human-authored` only because of rewrite tools (FR-4a).  
5. List this skill as a tool ingredient.

## Do not

- Auto-sign or auto-publish.  
- Upload private keys.  
- Put full raw transcripts in public L2 by default.

## Test driver

```bash
npm run test:provenance-driver          # fixture: claude+codex journals
npm run test:provenance-driver:live     # optional live agents
```
