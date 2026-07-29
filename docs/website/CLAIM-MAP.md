# Public claim map (curated website)

Authors of `docs/website/content/curated/` must not invent guarantees outside
this table without adding a proof row. Warm language may **illustrate** a claim;
it may not **expand** it.

| Claim (paraphrase) | OK on | Proof |
|--------------------|-------|--------|
| When signed, verify answers: this issuer sealed this colophon for these content bytes | home, verify, sample, walkthroughs | Live `/sample/` + `innsigle verify` → VALID; golden vectors; `tests/install.test.mjs` |
| Unsigned mark is still a valid Innsigle (signature optional) | home, verify, DESIGN | Principles (signet optional); no test requires every page signed |
| Absolute HTTPS `key_url` is required in signed claims | issuer, CLI, verify | ADR-003; CLI exit 5 on relative URL |
| Composition is declaration, not a purity score or AI detector | home, non-goals, colophon | Non-goals; e2e FORBIDDEN_VOICE; no detector verbs |
| Prose cleanup (sloptimizer) does not flip model-primary → human-authored | colophon, non-goals, provenance | FR-4a / PROV-10 tests |
| Same seal family for model-primary docs and human social | home, why, marks | Brand/DESIGN; dual UC walkthroughs |
| Install from GitHub exposes working `innsigle` bin | CLI, README, use | `tests/install.test.mjs` pack → install → use |
| Published sample bytes match the signed subject | sample, site-build | `tests/site-build.test.mjs` byte-identity + VALID |

## Forbidden expansions (never on curated or chrome)

- Content is true / authentic / verified fact  
- Detector accuracy, authorship percentages, “AI score”  
- Human-only purity as the product story  
- Chrome implying every page is cryptographically signed (B4 alone ≠ signed)

## Spec IDs

Put CONTRACT / ADR / FEAT / UC codes **below the fold** or under a single
“Spec” link on Evaluate/Use pages. Full vocabulary stays on Reference (generated
from `docs/helix/`).
