/**
 * Differential privacy utilities for research data exports.
 * Implements the Laplace mechanism for (epsilon, 0)-DP guarantees.
 * DD-V2-190: Anonymization pipeline.
 */

/**
 * Sample from a Laplace(0, b) distribution using the inverse CDF method.
 * Uses Math.random() for noise generation.
 *
 * @param b - Scale parameter (b = sensitivity / epsilon).
 * @returns A sample from Laplace(0, b).
 */
function laplaceSample(b: number): number {
  // Two uniform samples in (0, 1) via rejection to avoid log(0)
  const u = Math.random() - 0.5
  return -b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u) + Number.EPSILON)
}

/**
 * Add Laplace noise to a numeric value to achieve (epsilon, 0)-DP.
 *
 * @param value       - The true aggregate value.
 * @param sensitivity - L1 sensitivity of the query (how much one row changes the result).
 * @param epsilon     - Privacy budget (smaller = more private, more noise). Recommended: 1.0.
 * @returns Noisy value rounded to the same precision as the input (integer inputs stay integer).
 */
export function addLaplaceNoise(value: number, sensitivity: number, epsilon: number): number {
  const b = sensitivity / epsilon
  const noise = laplaceSample(b)
  const noisy = value + noise
  // Preserve integer vs. float character of the original
  return Number.isInteger(value) ? Math.round(noisy) : parseFloat(noisy.toFixed(4))
}

/**
 * Apply Laplace noise to every numeric leaf in a stats object.
 * Non-numeric fields pass through unchanged.
 *
 * @param stats       - Flat or nested stats object (values must be number | string | object | null).
 * @param sensitivity - Global L1 sensitivity to use for all fields (conservative; caller may override per-field).
 * @param epsilon     - Privacy budget.
 * @returns A new object with noise applied to all numeric values.
 */
export function noisifyStats(
  stats: Record<string, unknown>,
  sensitivity: number,
  epsilon: number,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(stats)) {
    if (typeof v === 'number') {
      out[k] = addLaplaceNoise(v, sensitivity, epsilon)
    } else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = noisifyStats(v as Record<string, unknown>, sensitivity, epsilon)
    } else {
      out[k] = v
    }
  }
  return out
}
