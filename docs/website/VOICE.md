# Innsigle website voice

Applies HELIX `public-site` profile and DESIGN.md craft voice to hand-authored
pages under `docs/website/content/curated/`.

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
Canonical casing above is for tables and SSoT display.

| Do | Don't |
|----|--------|
| Lead with **Innsigle** as the product | Lead chrome with “Colo” |
| Use B4 as footer cue | Footer: category paper-title or “not a detector” |
| **Maker** = publisher/operator | Maker = human author only |
| **Seal / mark** for recognition | Imply footer means cryptographically signed |
| **Colophon** on first mention; `colo` = CLI | “Colo · …” as brand badge |
| Category boundaries on Non-goals | Detector pitch on every page |
| **Sigil** ≤1 body use (home *or* Marks) + glossary | Occult/spell language; sigil in footer/H1 |
| Plain surroundings | Fantasy runes, Viking cosplay, “ancient Norse for truth” |

Spoken product name: **INN-siggle** (rhymes with *single*). Once per page max.
Do not put pronunciation and “sigil” in the same sentence.

Sample specialized cue (signed page only):  
`The maker's seal · model-primary · signed`

## Contracts

1. **First paragraph** says what the page covers and what the reader can do.
2. **First-use terms** get a short definition (colophon, seal, claim).
3. **Cards** name the destination and what the click gives the reader.
4. No purity theater, no “verified true content,” no AI-score language.
5. Prefer short sentences, concrete nouns, named actors.
6. Dual UC (docs + social) lives in **body** copy, not footer chrome.

## Register

Craft manual, not compliance form. Seal, mark, claim, composition, ingredients.
Avoid “credentials” as product objects, “authentic real,” “unlock,” “empower,”
“seamless.” Factual “C2PA Content Credentials” as competitor name is fine.
