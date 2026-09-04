# PLAN-001 — Wild-usage fixes and automatic session attestation

**Status:** Draft for review
**Date:** 2026-09-03
**Source evidence:** entropy-exchange sealing session (Claude transcript `75eaa6d8`, 2026-09-03), its `script/innsigle-seal-post` wrapper, helix's `scripts/innsigle-seal.sh`, and code inspection of `src/`.
**Informs:** FEAT-004 (session provenance), CONTRACT-001.

## Goal

Make `innsigle seal` usable directly by agents and humans in real repos (no
hand-rolled wrapper scripts), and make the colophon/attestation build itself
from the actual agent conversation instead of being hand-authored — while
preserving the FR-4a no-laundering guard and the PROV-05 operator-review gate.

## Scope

In scope: CLI changes in `src/`, new `provenance import` adapter for Claude
Code transcripts, `status`/stale-reseal commands, a Quarto reference
integration, tests, docs, npm publish readiness.
Out of scope: hosted/cloud anything, other-harness adapters beyond a stub
(Codex adapter deferred), auto-publish of L2 documents (stays off per PROV-08),
changes to the signature format (ADR-001/CONTRACT-001 unchanged).

## Assumptions

- The claim payload and signature format do not change; everything here is
  packaging around them, so existing published attestations stay valid.
- entropy-exchange and helix are the two known consumers; both use
  full-relative-path slug attestation names, which we adopt as canonical.
- Claude Code transcript JSONL (`~/.claude/projects/<slug>/<session>.jsonl`)
  is available locally when auto-provenance is requested. Its format is
  internal and version-drifting — the importer must parse tolerantly.
- npm package name `innsigle` is unclaimed (`npm view innsigle` → E404 as of
  2026-09-03).

## Work Breakdown

### Phase 1 — seal correctness (removes the need for wrapper scripts)

Each task: code + unit test in `tests/*.test.mjs` (`node --test`), same PR.

- **A1. Canonical attestation naming.** `defaultAttestationPath` currently uses
  basename-minus-extension (`src/config.mjs:139`), so every Quarto/Hugo page
  bundle (`posts/*/index.qmd`) collides at `index.attestation.json`. Adopt the
  wild slug: project-relative path, non-alphanumeric runs → `-`
  (`posts-source-shaped-tables-index-qmd.attestation.json`) — identical to
  `filters/innsigle.lua` and helix's badge partial. `resolveVerifyPaths` looks
  up slug first, legacy basename second (existing sites keep verifying).
  *Exit:* two sibling `index.qmd` files seal to distinct paths; legacy-named
  attestation still verifies.
- **A2. Idempotent, self-verifying seal.** Before signing: if the existing
  attestation's subject digest matches current content bytes, print
  `up to date` and exit 0 (`--force` overrides). After signing: verify the
  attestation against `.innsigle/public/keys.json`; on failure delete the
  written file and exit nonzero. (Both features exist in both wild wrappers.)
  *Exit:* seal→seal is a no-op; a corrupted key produces no attestation file.
- **A3. 1Password bridging.** Split `INNSIGLE_OP_BIN` on whitespace so
  `INNSIGLE_OP_BIN="mac op"` works (OrbStack host bridge); honor `OP_ACCOUNT`
  env and a `--op-account` flag by passing `--account` to `op read`. Document
  in README + init's generated `AGENTS.md`. This deletes the
  "innsigle-signing-via-mac-op" tribal-knowledge memory.
  *Exit:* unit test with a fake `op` shim verifies argv; sealing from the
  Linux side of OrbStack works with env vars only.
- **A4. Stop publishing debug sidecars.** `seal` writes `<name>.claim.json`
  into `public/claims/`, which post-render hooks then publish to
  `.well-known/`. Gate it behind `--debug-claim` and write to
  `.innsigle/debug/` (gitignored by init).
  *Exit:* default seal writes exactly one file under `public/claims/`.

### Phase 2 — repo-level workflow (status, stale, colo conventions)

- **A5. `innsigle status` + `seal --stale` + `verify --all`.** `status` scans
  `public/claims/`, resolves each subject back to a source file, and reports
  VALID / STALE (digest drift) / ORPHAN (source gone, e.g. after a slug
  rename) / UNSEALED (tracked content with no claim, driven by a
  `content_globs` key in config). `verify --all` exits nonzero on any
  non-VALID — the CI gate the Lua filter's render-time warning can't provide.
  `seal --stale` re-seals only drifted claims (one `op read`, loop content) —
  the entropy-exchange session re-sealed 8× by hand.
  *Exit:* fixture repo with valid/stale/orphan claims produces the right table
  and exit codes; `seal --stale` fixes only the stale one. Depends on A1.
- **A6. Content-adjacent colophons.** Colo resolution order becomes:
  `--colo` → `<content-dir>/colo.json` → `.innsigle/colo.json` → `--kind`/
  default. Matches the wild `posts/<slug>/_sources/colo.json` habit closely
  enough (one `cp` away); document the convention.
  *Exit:* seal with no flags picks up the sidecar colo.

### Phase 3 — automatic attestation from the conversation (FEAT-004 P2)

The journal schema, `provenance build` (journal→L2), and `propose-colo`
(L2→colo with the FR-4a guard) already exist and are tested. What's missing is
the front end: nobody writes journals by hand. The entropy-exchange session
hand-wrote an 8-ingredient colo while its own transcript — sitting on disk —
contained every fact in it. Close that loop:

- **B1. Claude Code transcript importer.**
  `innsigle provenance import claude-code <transcript.jsonl> [--out journal.jsonl]`
  maps harness transcript lines → journal v1 events: user messages →
  `user_prompt`, assistant messages (with `message.model`) → `assistant_turn`,
  `tool_use` Write/Edit/NotebookEdit → `file_write` (path, actor model),
  Skill/Agent calls → `skill_call`/`tool_call`, session boundaries →
  `session_start`/`session_end`. Emit **summaries and counts only** — never
  message bodies (PROV-09); run through existing `redactEvents`. Unknown line
  types → `note` events, never a parse failure (format drift tolerance).
  *Exit:* golden test from a sanitized fixture transcript (build one from this
  repo's own session, scrubbed); `provenance build` accepts the output;
  `propose-colo` on it names the model, tools, and prompt count.
- **B2. Session discovery + accumulation.** `innsigle provenance sync
  <content-file>`: find the transcript dir for the repo
  (`~/.claude/projects/<escaped-cwd>/`), scan sessions whose Write/Edit events
  touch the content path, import each, merge with `mergeJournals`, and write
  `.innsigle/provenance/<slug>.l2.json`. Re-running after more conversation
  picks up new sessions and turns — this is "the attestation builds out as the
  conversation evolves": each sync folds new sessions into the same L2, and
  the proposed colo grows with it (multiple models, editing passes, tools).
  *Exit:* fixture with two transcripts touching one file yields one merged L2
  with both models; second sync after appending a session updates counts.
- **B3. `seal --auto` (review-gated).** With `--auto`, seal runs sync →
  propose-colo → prints the proposed colophon (composition, ingredients,
  prompt count) → requires interactive confirm or explicit `--yes` before
  signing (PROV-05: review precedes sign; FR-4a still refuses laundered
  `human-authored`). `--save-colo` writes the proposal to
  `<content-dir>/colo.json` for editing instead of sealing. Optionally embed
  `provenance.uri`/`digest` per PROV-06 when the operator passes
  `--provenance-uri` (publish stays manual, PROV-08).
  *Exit:* e2e fixture: transcript → `seal --auto --yes` produces a VALID
  attestation whose colo lists the model from the transcript; `--auto` without
  confirm signs nothing.
- **B4 (deferred). Live hook capture.** Claude Code hooks appending journal
  events during the session. The importer (B1) supersedes it for Claude Code —
  same data, zero setup, works retroactively. Revisit only for harnesses
  without readable transcripts (Codex adapter would slot in as
  `provenance import codex`).

### Phase 4 — distribution and integrations

- **C1. Quarto reference integration.** Vendor entropy-exchange's
  `filters/innsigle.lua` (stale-digest footer suppression + render warning) and
  `script/publish-innsigle` post-render hook into `integrations/quarto/`, with
  a workflow test mirroring `tests/hugo-workflow.test.mjs`. Update the lua
  filter's slug logic to cite A1 as the shared contract. Update walkthrough
  docs + microsite (`npm run site:publish` / `site:build`).
- **C2. npm publish.** Flip `"private": true`, verify `files` whitelist, add a
  release workflow (tag → `npm publish --provenance`), publish `0.2.0` after
  Phases 1–2 land. Until then README documents
  `npx --package=github:DocumentDrivenDX/innsigle innsigle`.
  **Authorization boundary:** publishing to npm and creating the npm token are
  operator actions — the plan stops at a ready release PR.
- **C3. Sealing skill.** Package a Claude Code skill (`innsigle-seal`) usable
  from consumer repos: wraps status → sync → seal --auto with the A3 env
  bridging, so the next entropy-exchange session is one command instead of a
  three-hour excavation. Ship in this repo; install instructions in README.

## Validation

- `npm test` (unit) green per task; new tests named above are the acceptance
  checks.
- `verify --all` self-test: run against this repo's own `docs/sample` seals.
- Cross-repo smoke (manual, operator): re-seal one entropy-exchange post with
  bare `innsigle seal` + env vars — success defined as no wrapper script
  needed and byte-identical verify result. Then delete/deprecate
  `script/innsigle-seal-post` there.
- B-track golden tests are deterministic (fixture transcripts; timestamps
  passed via `--generated-at`).

## Risks

- **Transcript format drift** (highest): internal format, changes across
  Claude Code versions. Mitigate: tolerant parser (unknown → `note`),
  version-stamped fixtures, importer failures never block manual `--colo`.
- **Privacy leakage** via imported provenance: transcripts hold sensitive
  text. Mitigate: summaries/counts only, existing redaction pass, PROV-08
  auto-publish stays off, L2 stays under `.innsigle/provenance/` (not
  `public/`) unless explicitly published.
- **Naming migration:** consumers with legacy basename attestations must keep
  verifying — covered by the A1 fallback; `status` flags legacy names for
  one-command re-seal.
- **Review-gate erosion:** `--auto --yes` in agent hands could rubber-stamp
  colos. Mitigate: `--yes` still prints the colo into the log, FR-4a refusal
  is not overridable without `--force-composition --notes`, and the skill
  (C3) instructs agents to surface the proposal to the operator.

## Open Questions

1. npm scope: bare `innsigle` vs `@documentdrivendx/innsigle`? (Bare is free
   today; scoped survives name disputes.) Default: bare.
2. Should `status`'s UNSEALED detection (`content_globs`) land in Phase 2 or
   be cut to keep `status` claims-only? Default: include, it's ~20 lines.
3. Colo sidecar filename: `colo.json` in the content dir, or honor
   `_sources/colo.json` too? Default: `colo.json` only.
4. Does B2 need multi-harness merge (Claude + Codex in one L2) now, or is
   Claude-only acceptable for P2? Default: Claude-only; merge machinery
   already exists when a second importer lands.

## Handoff

Execution order: Phase 1 (one PR, small diffs) → Phase 2 → Phase 3 → Phase 4;
C1/C3 can proceed in parallel with Phase 3. Each task above is bead-sized for
ddx if you want them queued. Planning only — no code changed yet; C2's publish
step and the entropy-exchange smoke test are explicitly operator-authorized
actions.

## Execution Log (2026-09-03)

- **A1** canonical attestation slug naming — done
- **A2** idempotent, self-verifying seal — done
- **A3** 1Password bridging (`INNSIGLE_OP_BIN`, `OP_ACCOUNT`/`--op-account`) — done
- **A4** debug claim sidecars gated to `.innsigle/debug/` — done
- **A5** `status` / `seal --stale` / `verify --all` — done
- **A6** content-adjacent colophon resolution — done
- **B1** `provenance import claude-code` transcript importer — done
- **B2** `provenance sync` session discovery + accumulation — done
- **B3** `seal --auto` (review-gated, `--save-colo`, `--provenance-uri`) — done
- **B4** live hook capture — deferred (importer supersedes it for Claude Code)
- **C1** Quarto reference integration — done
- **C2** npm release readiness — done (v0.2.0 tagged; npm publish pending npm login)
- **C3** sealing skill (`skills/innsigle-seal/`) + documentation pass — this change
