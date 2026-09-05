# Changelog

## [Unreleased]

### Product

- Claude Code importer counts Bash heredoc writes (`cat > path <<'EOF'`,
  `cat <<EOF > path`, `tee`, `>>`, `<<-`) as model `file_write` events with
  `chars_added` = heredoc body length, so shell-first sessions carry char
  evidence for `human_input`; indirect writers (python heredocs) stay
  `tool_call`; bodies are measured, never carried (PROV-09)
- Claude Code importer counts messages the operator typed mid-turn
  (`queue-operation` `enqueue` records) as `user_prompt` events; they were
  previously skipped as non-message records, under-counting direction and
  review for long working sessions
- `provenance sync` follows renames via `git log --follow`: writes recorded
  under a content file's earlier paths attribute to the current artifact

## [0.3.1] — 2026-09-04

Operator/agent surfacing for the hi1 human-input measure (no behavior change):

- `innsigle colo example --kind <k> --human-input` emits a valid, sealable
  reference `human_input` object (percent recomputes from its counts)
- CLI usage documents the flag and the `human_input=NN%` output lines
- README "Human-input percent" section; init's `.innsigle/AGENTS.md` template
  states the no-tuning rule and the shape-reference command

## [0.3.0] — 2026-09-04

**Declared human-input percentage (`colophon.human_input`, method `hi1`).**
CONTRACT-001 → v1.1 (additive; colophon `schema_version` stays `"1"`, existing
attestations and v1 verifiers unaffected).

### Product

- New optional signed colophon object `human_input`: integer percent of human
  input computed from the maker's own session journal — direction 25 ·
  contribution 40 · review 35, exact-rational round-half-up, raw counts
  recorded so the headline is recomputable (PRD FR-20/FR-20a)
- Contribution (char evidence) is required for a headline: no journal chars →
  no percent, omitted — never invented; not a detection score
- Journal v1 additions: `chars` / `chars_added` / `chars_removed` fields and a
  human `review` event type; Claude Code importer emits char evidence (old
  transcripts re-import retroactively) and strips `<system-reminder>` text
- Seal/claim-build refuse fudged arithmetic (percent must recompute from its
  own counts; exit 5); `seal --auto` review and `verify` print
  `human_input=NN% (declared, method hi1)`
- Quarto footer renders "… · NN% human input" with modifier class
  `innsigle-seal--hi` + suggested CSS (badge visibility); skills document the
  evidence fields and the no-tuning rule

### Docs / site

- Normative spec "Human-input measure (hi1)" in session-provenance.md; PRD
  FR-20/FR-20a; claim-system `mixed` sub-ratio question resolved; non-goals
  reworded ("no detection scores"; a declared measure is not detection)
- New golden vectors `claim-hi.*` / `attestation-hi.json`; hi fixtures with
  0/100/null/rounding-boundary cases

## [0.2.0] — 2026-09-03

PLAN-001 wild-usage fixes: canonical slug attestation naming, idempotent
self-verifying seal, `status` / `verify --all` / `seal --stale`, Claude Code
transcript import + provenance sync + `seal --auto`, vendored Quarto
integration, `innsigle-seal` skill, npm packaging (published via CI on tags).

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
