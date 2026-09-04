# innsigle-seal — install

A Claude Code agent skill for consumer repos (Quarto/Hugo blogs, docs sites).
Ships in this repo under `skills/innsigle-seal/`.

## Install into a consumer repo (shared with the team)

```bash
mkdir -p .claude/skills
cp -r /path/to/innsigle/skills/innsigle-seal .claude/skills/innsigle-seal
```

## Install for your user (all repos)

```bash
mkdir -p ~/.claude/skills
cp -r /path/to/innsigle/skills/innsigle-seal ~/.claude/skills/innsigle-seal
```

Or symlink to track updates from a clone:

```bash
ln -s /path/to/innsigle/skills/innsigle-seal ~/.claude/skills/innsigle-seal
```

Then ask Claude Code to "seal this post" or "check seals" — the skill covers
`status` → `provenance sync` → `seal --auto`, with the operator-review gate
(PROV-05) and the no-laundering rule (FR-4a) built in.
