# Changelog

## [0.6.1] — 2026-09-30

Four bugs that only surface against a real 1Password and a real two-section
site. Found by wiring 0.6.0 into erik.labianca.org; each one made `init` or
`seal` fail in a way that looked like user error.

### Fixed

- **`init` produced a `private_key_ref` that can never be read.** The default
  item title is `Innsigle · <issuer>`, and `op` rejects non-ASCII in a secret
  reference outright. Every subsequent `seal` reported "key missing". The
  reference is now built from a reference-safe segment: the readable name when
  it is valid, otherwise the item uuid, which is also stable across renames.
- **`assertOpSignedIn` used `op whoami`,** which reports "account is not signed
  in" for every account under 1Password's desktop-app integration, because
  there is no persistent session token. That blocked `init` entirely for anyone
  using the desktop app. The probe is now `op vault list`, which exercises the
  same path a real call takes.
- **`createHouseKeyItem` ignored account selection** while `readPrivateKeyPem`
  honoured it, so with `OP_ACCOUNT` set to a non-default account the key was
  created in one account and looked up in another. Both now resolve the account
  the same way, and `init` accepts `--op-account` to match `seal`.
- **`--content-glob` silently kept only the first value.** A site with two
  content sections sealed one and ignored the other, with nothing reported. It
  is now repeatable.

### Changed

- `init` records `role: "human"` on the key it mints. Without a role the
  colophon rendered no key label and no trust line, because it resolves both
  from the issuer document. A fresh site's single key is human-held in
  1Password, and `keys.mjs` already falls the build role back to it.

## [0.6.0] — 2026-09-30

First-class Hugo integration, and four silent failures made loud.

### Product

- **`innsigle init --hugo`** scaffolds the whole Hugo integration: partials,
  CSS, a theme adapter at whatever path the theme calls (PaperMod, Hextra),
  `static/` if missing, and the `module.mounts` block appended to a root
  `hugo.yaml`. It handles `layouts/_partials` and `layouts/partials`, is
  idempotent, and prints anything it cannot do safely.
- **`innsigle doctor --hugo`** checks a site's wiring: config validity, all
  three mounts declared *and resolved by Hugo itself* (`hugo config mounts`),
  the partial present and actually called, stale or unsealed claims, and
  whether each page's declared composition matches its seal. It exists because
  a wrong mount makes the partial render nothing while the build still
  succeeds — a site that ships unsealed with no indication.
- **`kind_from_frontmatter` accepts a named field.** `{ "field": "composition" }`
  reads `model-primary | human-authored | mixed`. The legacy `true` form only
  recognised `generated: true` and so could not express human-authored versus
  mixed at all. A value outside the three now fails instead of coercing to
  mixed.
- **`innsigle --version`**, whose absence was the reason downstream repos carry
  a wrapper script to pin the CLI.
- `default_composition` works again. It had been unreachable since
  `kindFromFrontmatter` always returned a string.

### Hugo assets

- `innsigle-colophon.html` replaced with the version helix had diverged to:
  embeds the attestation as `application/innsigle+json`, resolves key role and
  endorsement from `keys.json`, and builds hrefs from the base URL's path so
  links survive a deploy under a subdirectory.
- `innsigle-badge.html` (new) for list and archive views.
- `innsigle-glyph.html` and `assets/css/innsigle.css` (new), the CSS driven by
  custom properties.

### Fixes

- `tryLoadPrivateKeyForRole` swallowed its exception, so `seal --all` with the
  1Password CLI missing or locked printed unexplained skips and **exited 0**.
  The reason is now reported once.
- Three path helpers diffed an unresolved root against a resolved path. On
  macOS `/var` is a symlink to `/private/var`, so `relative()` emitted a
  `../../../..` chain that `guessContentUri` **signed into the claim's subject
  URI**, and that made `attestationSlug` drop its directory prefix — seal wrote
  one filename while verify looked for another. This is why the shipped Hugo
  workflow test was failing.
- A composition derived from frontmatter was never validated against the three
  legal values.

### Quality

- `validateConfig`, the first config validation in the repo. `CONFIG_SCHEMA`
  had been written by `init` and never read, so `{ "feild": "composition" }`
  silently disabled the feature. It runs before the glob scan so a config
  mistake is reported as one.
- The site-build test now guards on the build key the way `ci.yml` does, so
  editing a generated page no longer turns the suite red on a laptop that
  cannot re-seal it.

### Docs

- `integrations/hugo/README.md` rewritten.
- CONTRACT-001 updated (normative) for the new frontmatter modes.


## [0.5.0] — 2026-09-16

### Product

- **Helix microsite pattern in the CLI:** `innsigle seal --all` walks
  `content_globs` (frontmatter `generated: true` → model-primary, else mixed),
  `innsigle publish [site]` copies `.innsigle/public` to `/.well-known/innsigle/`.
  Init accepts `--content-root`. Hugo partial at `integrations/hugo/`.
- This microsite's curated + generated markdown is sealed; `site:build` injects
  the colophon and CI runs `innsigle verify --all`.
- **ADR-004:** human key signs mixed/human sources; build key (GitHub secret
  `INNSIGLE_BUILD_KEY`) signs generated sources; human endorses build.
  Rendered HTML **quotes** the source attestation (`application/innsigle+json`);
  the signature covers markdown, not HTML bytes.
- CLI: `innsigle endorse` (human key endorses the build key); `seal --all --role human|build`.

## [0.4.0] — 2026-09-15

### Product

- **Maker profile + plain seals (FEAT-005).** Unsigned declarations for work
  that has no stable bytes (Docs, mail, slides). One bio URL for X, LinkedIn,
  Slack. Keys and `innsigle seal` stay a later step.
- CLI: `innsigle profile init|add|render|footer|bio|validate|claim`
- Site builder at `/use/profile/` (same `src/profile.mjs` as the CLI)
- Sample profile at `/examples/profile/`; walkthrough at `/use/walkthrough-profile/`
- `innsigle verify` refuses profiles and plain-colophon JSON (exit 5, never VALID)
- FR-4a: `human-authored` plus a model ingredient is refused on this path too

### Tests / CI

- Unit + CLI coverage in `tests/profile.test.mjs`; site-build assertions for
  the sample profile and builder assets
- Playwright: builder fill/download + sample profile page (`e2e/profile-builder.spec.ts`)
- New `CI` workflow on pull requests and `main` (unit + e2e)

## [0.3.2] — 2026-09-04

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
- Queued messages later delivered as normal user records count once, at
  delivery — enqueue+delivery double counting would have inflated
  direction/review (~42% of enqueues in sampled transcripts are delivered)

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
