/**
 * New Player Funness Bias
 *
 * Biases early run pools toward higher-funScore facts to improve
 * first impressions. The bias decays linearly from full strength
 * (runs 0-9) to zero (run 100+).
 *
 * This is a soft probabilistic bias — it increases the LIKELIHOOD
 * of fun facts appearing, not a hard filter. Low-fun facts can
 * still appear, just less often during early runs.
 */

/** Runs 0–9 have full funness boost. */
export const FUNNESS_FULL_BOOST_RUNS = 10;

/** Boost decays to zero by this run count. */
export const FUNNESS_DECAY_END_RUNS = 100;

/**
 * Calculate the funness boost factor based on total completed runs.
 * Returns 1.0 for runs 0–9, linearly decays to 0.0 at run 100+.
 */
export function calculateFunnessBoostFactor(totalRuns: number): number {
  if (totalRuns < FUNNESS_FULL_BOOST_RUNS) return 1.0;
  if (totalRuns >= FUNNESS_DECAY_END_RUNS) return 0.0;
  return 1.0 - (totalRuns - FUNNESS_FULL_BOOST_RUNS) / (FUNNESS_DECAY_END_RUNS - FUNNESS_FULL_BOOST_RUNS);
}

/**
 * Calculate selection weight for a fact based on its funScore and the current boost factor.
 *
 * At full boost (1.0): funScore 10 → 2.0x, funScore 5 → 1.0x, funScore 1 → 0.2x
 * At half boost (0.5): funScore 10 → 1.5x, funScore 5 → 1.0x, funScore 1 → 0.6x
 * At no boost (0.0):   all facts → 1.0x (uniform random)
 *
 * Minimum weight is clamped to 0.1 to prevent any fact from being completely excluded.
 */
export function funScoreWeight(funScore: number, boostFactor: number): number {
  if (boostFactor <= 0) return 1;
  return Math.max(0.1, 1 + boostFactor * (funScore - 5) / 5);
}
