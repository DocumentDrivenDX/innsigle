---
name: innsigle-seal
description: Seal, re-seal, and check Innsigle seals on published content in a consumer repo (Quarto, Hugo, plain HTML). Use when asked to "seal this post", "seal this page", "re-seal", "check seals", or anything mentioning innsigle.
---

# innsigle-seal skill

Drive the Innsigle CLI from a consumer repo (a blog, docs site, etc. that has
run `innsigle init`). Builds the colophon from the actual agent transcripts,
gates every seal on operator review.

## Prerequisites

- Repo has `.innsigle/config.json` (else run `innsigle init --onepassword --site-url <url>` first — operator decision).
- CLI available. Prefer the installed bin; until the npm package `innsigle`
  is published, fall back to:

```bash
npx --package=github:DocumentDrivenDX/innsigle innsigle <args>
```

- 1Password bridging when the signing key lives on a host outside this
  environment (e.g. Linux VM / OrbStack with keys on the Mac side):

```bash
export INNSIGLE_OP_BIN="mac op"        # command to reach the host `op` (split on whitespace)
export OP_ACCOUNT=<account>            # or pass --op-account to seal
```

## Workflow

1. **Status.** See what needs work:

```bash
innsigle status          # VALID / STALE / ORPHAN / AMBIGUOUS / UNSEALED per claim
innsigle verify --all    # exits nonzero on any non-VALID (CI gate)
```

2. **Sync provenance** for the file being sealed:

```bash
innsigle provenance sync <content-file> [--transcript-dir <dir>] [--out <l2.json>]
```

Finds Claude Code transcripts for this repo (default dir:
`~/.claude/projects/<cwd with every non-alphanumeric character replaced by
"-">/`, e.g. `/home/erik/Projects/aibadge` → `-home-erik-Projects-aibadge`
and `/home/erik/my.site` → `-home-erik-my-site`), imports every
session whose file writes touched the content file, merges them, and writes
`.innsigle/provenance/<slug>.l2.json`. Re-run after more conversation — the
provenance accumulates. Summaries and counts only; message bodies never leave
the transcript (PROV-09).

3. **Propose and review the colophon** — never skip this:

```bash
innsigle seal <file> --auto --save-colo
```

This runs sync, prints the proposed colophon (composition, ingredients,
user_prompts count, and — when the transcripts carry char evidence — the
declared `human_input` percent, method hi1), writes it to
`<content-dir>/colo.json`, and exits
**without sealing**. **Show that proposal to the operator and wait for their
approval (PROV-05).** They may edit `colo.json` before you continue.

4. **Seal** once the operator approves:

```bash
innsigle seal <file> --auto --yes
# or, if colo.json was hand-edited in step 3:
innsigle seal <file>            # picks up <content-dir>/colo.json
```

Re-sealing after content edits: `innsigle seal --stale` re-seals only drifted
claims. Sealing an unchanged file prints `up to date` and is a no-op.

Optional, after the operator publishes the L2 somewhere:
`--provenance-uri <uri>` embeds `provenance.uri` + `provenance.digest`
(PROV-06). The L2 under `.innsigle/provenance/` is **not** auto-published
(PROV-08); do not copy it into `public/` yourself.

## Hard rules

- **PROV-05:** the proposed colophon MUST be surfaced to the operator before
  any seal. `--yes` is for after review, not instead of it.
- **FR-4a:** NEVER pass `--force-composition` to make model-assisted work
  claim `human-authored`. The CLI refuses laundered compositions; do not work
  around the refusal.
- **FR-20a:** NEVER edit `human_input` component counts to reach a target
  percent — the CLI recomputes the headline from the raw counts and refuses
  fudged arithmetic (exit 5). If the operator disputes the measure, remove
  the whole `human_input` object instead of tuning it.
- Never auto-publish L2 provenance, never upload or print private keys.
- List this skill as a tool ingredient in colophons for sessions where it ran.
