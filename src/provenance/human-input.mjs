/**
 * Human-input measure hi1 (FR-20, CONTRACT-001 v1.1).
 *
 * Deterministic, recomputable measure of human input over one artifact,
 * derived from journal evidence: direction (prompts per model write burst),
 * contribution (human vs model chars), review (post-output prompts and
 * explicit review events per burst). All arithmetic is exact-rational via
 * BigInt; every recorded number is an integer (JCS-safe, ADR-001).
 *
 * Never invents (FR-20a): contribution (char evidence) is the required core
 * of the measure — without it computeHumanInput returns null and the
 * colophon omits the object entirely. Direction and review are null only
 * when there are no model write bursts (nothing to direct or review).
 */

export const HI_METHOD = "hi1";
export const HI_BASIS = "session-journal";
export const HI_WEIGHTS = Object.freeze({ direction: 25, contribution: 40, review: 35 });

/** round_half_up(100 * num / den) as a Number; exact BigInt arithmetic. */
export function roundHalfUpPercent(num, den) {
  const n = BigInt(num);
  const d = BigInt(den);
  if (d <= 0n) throw new Error("roundHalfUpPercent: den must be positive");
  if (n < 0n) throw new Error("roundHalfUpPercent: num must be non-negative");
  return Number((200n * n + d) / (2n * d));
}

const isCount = (v) => Number.isInteger(v) && v >= 0;

/** Raw per-artifact evidence from ordered journal events. */
export function collectEvidence(events, artifactPath) {
  let H = 0;
  let M = 0;
  let P = 0;
  let Rp = 0;
  let Re = 0;
  let B = 0;
  let humanWriteEvents = 0;
  let uncounted = 0; // model/mixed writes to A lacking chars_added
  let inBurst = false;
  let sawModelWrite = false;
  for (const e of events) {
    if (e.type === "user_prompt") {
      P += 1;
      if (sawModelWrite) Rp += 1;
      inBurst = false;
      continue;
    }
    if (e.type === "review" && (!e.path || e.path === artifactPath)) {
      Re += 1;
      continue;
    }
    if (e.type !== "file_write" || e.path !== artifactPath) continue;
    if (e.by === "human") {
      humanWriteEvents += 1;
      if (isCount(e.chars_added)) H += e.chars_added;
      continue;
    }
    if (e.by === "model" || e.by === "mixed") {
      // mixed counts as model — conservative (FR-4a spirit)
      sawModelWrite = true;
      if (!inBurst) {
        B += 1;
        inBurst = true;
      }
      if (isCount(e.chars_added)) M += e.chars_added;
      else uncounted += 1;
    }
  }
  return { H, M, P, Rp, Re, B, humanWriteEvents, uncounted };
}

/** percent = round_half_up(100 · Σ wᵢ·nᵢ/dᵢ / Σ wᵢ), exact rationals. */
function headlinePercent(parts) {
  let dprod = 1n;
  for (const [, c] of parts) dprod *= BigInt(c.d);
  let num = 0n;
  let wsum = 0n;
  for (const [name, c] of parts) {
    const w = BigInt(HI_WEIGHTS[name]);
    wsum += w;
    num += (w * BigInt(c.n) * dprod) / BigInt(c.d);
  }
  return roundHalfUpPercent(num, wsum * dprod);
}

/**
 * Compute the hi1 object for one artifact, or null when there is no char
 * evidence (never invent — FR-20a).
 *
 * @param {object[]} events ordered journal events (merged, redacted)
 * @param {string} artifactPath the artifact's path as it appears in events
 * @returns {object|null}
 */
export function computeHumanInput(events, artifactPath) {
  const { H, M, P, Rp, Re, B, humanWriteEvents, uncounted } = collectEvidence(
    events,
    artifactPath,
  );
  if (H + M === 0) return null;

  const contribution = { n: H, d: H + M };
  const direction = B > 0 ? { n: Math.min(P, B), d: B } : null;
  const review = B > 0 ? { n: Math.min(Rp + Re, B), d: B } : null;

  const parts = [];
  if (direction) parts.push(["direction", direction]);
  parts.push(["contribution", contribution]);
  if (review) parts.push(["review", review]);

  return {
    method: HI_METHOD,
    basis: HI_BASIS,
    percent: headlinePercent(parts),
    weights: { ...HI_WEIGHTS },
    direction: direction
      ? {
          percent: roundHalfUpPercent(direction.n, direction.d),
          user_prompts: P,
          model_write_bursts: B,
        }
      : null,
    contribution: {
      percent: roundHalfUpPercent(contribution.n, contribution.d),
      human_chars: H,
      model_chars: M,
      human_write_events: humanWriteEvents,
      coverage: uncounted === 0 ? "full" : "partial",
    },
    review: review
      ? {
          percent: roundHalfUpPercent(review.n, review.d),
          post_output_prompts: Rp,
          review_events: Re,
        }
      : null,
  };
}

/**
 * Validate a declared human_input object (CONTRACT-001 v1.1): shape, integer
 * ranges, and arithmetic honesty — the headline and sub-percents MUST
 * recompute from the recorded raw counts. Throws with a reason on failure.
 */
export function validateHumanInput(hi) {
  const fail = (m) => {
    throw new Error(`human_input ${m}`);
  };
  if (typeof hi !== "object" || hi === null || Array.isArray(hi)) fail("must be an object");
  if (hi.method !== HI_METHOD) fail(`method must be "${HI_METHOD}"`);
  if (hi.basis !== HI_BASIS) fail(`basis must be "${HI_BASIS}"`);
  const w = hi.weights;
  if (
    !w ||
    w.direction !== HI_WEIGHTS.direction ||
    w.contribution !== HI_WEIGHTS.contribution ||
    w.review !== HI_WEIGHTS.review
  ) {
    fail(`weights must be ${JSON.stringify(HI_WEIGHTS)} for method ${HI_METHOD}`);
  }
  const c = hi.contribution;
  if (!c || typeof c !== "object" || Array.isArray(c)) {
    fail("contribution is required (char evidence backs the measure)");
  }
  for (const k of ["human_chars", "model_chars", "human_write_events"]) {
    if (!isCount(c[k])) fail(`contribution.${k} must be a non-negative integer`);
  }
  if (c.human_chars + c.model_chars === 0) {
    fail("contribution requires human_chars + model_chars > 0 (omit the object instead)");
  }
  if (c.coverage !== "full" && c.coverage !== "partial") {
    fail("contribution.coverage must be full|partial");
  }
  const d = hi.direction ?? null;
  const r = hi.review ?? null;
  if ((d === null) !== (r === null)) {
    fail("direction and review must both be null (no model write bursts) or both present");
  }
  if (d !== null) {
    if (!isCount(d.user_prompts)) fail("direction.user_prompts must be a non-negative integer");
    if (!Number.isInteger(d.model_write_bursts) || d.model_write_bursts < 1) {
      fail("direction.model_write_bursts must be a positive integer");
    }
    for (const k of ["post_output_prompts", "review_events"]) {
      if (!isCount(r[k])) fail(`review.${k} must be a non-negative integer`);
    }
  }

  const parts = [];
  if (d !== null) {
    parts.push(["direction", { n: Math.min(d.user_prompts, d.model_write_bursts), d: d.model_write_bursts }]);
  }
  parts.push(["contribution", { n: c.human_chars, d: c.human_chars + c.model_chars }]);
  if (r !== null) {
    parts.push([
      "review",
      { n: Math.min(r.post_output_prompts + r.review_events, d.model_write_bursts), d: d.model_write_bursts },
    ]);
  }
  for (const [name, frac] of parts) {
    const expect = roundHalfUpPercent(frac.n, frac.d);
    if (hi[name].percent !== expect) {
      fail(`${name}.percent ${hi[name].percent} does not recompute from counts (expected ${expect})`);
    }
  }
  const expect = headlinePercent(parts);
  if (hi.percent !== expect) {
    fail(`percent ${hi.percent} does not recompute from counts (expected ${expect})`);
  }
}
