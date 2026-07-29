# Innsigle website voice

Applies HELIX `public-site` profile and DESIGN.md craft voice to hand-authored
pages under `docs/website/content/curated/`.

**Public claims:** see [CLAIM-MAP.md](./CLAIM-MAP.md). Warm copy must not invent
proofs.

## Reader

Makers who publish docs and social posts. May know C2PA or DKIM. Does not need
HELIX jargon. Each page stands alone: what Innsigle is, why it matters, what to
do next.

## Branding

**Canonical bytes:** `scripts/brand-lines.mjs` (import as `BRAND`).  
Apostrophe in chrome/H1: straight ASCII `'` only.

| Slot | Exact string | Surfaces |
|------|--------------|----------|
| **A — category** | `Content provenance for the AI era` | Meta category clause, Non-goals opener, evaluator tables |
| **B — chrome** | `The maker's seal for published work` | Footer `.cue`, sample snippet default, home H1 |
| **H1 — home** | same as B | Home H1 only |

**A1 matchers** are **case-insensitive** (mid-sentence lowercase is correct English).

| Do | Don't |
|----|--------|
| Lead with **Innsigle** as the product | Lead chrome with “Colo” |
| Use B4 as footer cue | Footer: category paper-title or “not a detector” |
| **Maker** = publisher/operator | Maker = human author only |
| **Seal / mark** for recognition | Imply footer means cryptographically signed |
| **Colophon** on first mention; `colo` = CLI | “Colo · …” as brand badge |
| Category boundaries on Non-goals | Detector pitch on every page |
| **Sigil** ≤1 body use (home *or* Marks) + glossary | Occult/spell language; sigil in footer/H1 |
| Scene first (who does what) | Spec-ID openers (`CONTRACT-001` as first sentence) |
| Plain surroundings | Fantasy runes, Viking cosplay, “ancient Norse for truth” |

Spoken product name: **INN-siggle** (rhymes with *single*). Once per page max.
Do not put pronunciation and “sigil” in the same sentence.

Sample specialized cue (signed page only):  
`The maker's seal · model-primary · signed`

## Warmth without fluff

Craft manual with a human in the room—not a compliance form, not a startup
brochure.

- Prefer concrete nouns: footer mark, house key, page bytes, keys URL  
- Prefer short sentences and named actors (you, the reader, the issuer)  
- One craft register: pride in honest production, not shame about models  

**Ban empty boosters:** seamless, powerful, unlock, empower, next-gen, revolutionary.

**Jargon budget (Evaluate/Use):** at most one CONTRACT/ADR/FEAT link in the main
flow; put the rest under “Spec” or Reference.

## Proof boxes

When you make a checkable claim, show how to check it:

```markdown
### Check it

What we claim: [one sentence, scoped to crypto/binding—not content truth].

\`\`\`bash
[exact command a reader can run]
\`\`\`

Expect: `VALID` (or named exit code).  
Live: [Sample](/sample/) · Spec: [link if needed]
```

P0 pages (home, why, CLI, verify) must either link the live sample or include a
verify command.

## Contracts

1. **First paragraph** says what the page covers and what the reader can do.
2. **First-use terms** get a short definition (colophon, seal, claim).
3. **Cards / next steps** name the destination and what the click gives.
4. No purity theater, no “verified true content,” no AI-score language.
5. Prefer short sentences, concrete nouns, named actors.
6. Dual UC (docs + social) lives in **body** copy, not footer chrome.
7. Correctness: every strong claim maps to CLAIM-MAP.md.

## Register

Craft manual, not compliance form. Seal, mark, claim, composition, ingredients.
Avoid “credentials” as product objects, “authentic real,” “unlock,” “empower,”
“seamless.” Factual “C2PA Content Credentials” as competitor name is fine.

## Author checklist (before merge)

- [ ] Stranger can run one command from this page and get the stated outcome?  
- [ ] No sentence promises content truth or detection?  
- [ ] Spec IDs below the fold or single Spec link?  
- [ ] Brand lines (A1/B4/sample cue) untouched?  
- [ ] Claim still in CLAIM-MAP with a proof?  
