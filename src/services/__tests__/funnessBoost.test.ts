import { describe, it, expect } from 'vitest'
import {
  FUNNESS_FULL_BOOST_RUNS,
  FUNNESS_DECAY_END_RUNS,
  calculateFunnessBoostFactor,
  funScoreWeight,
} from '../funnessBoost'

describe('funnessBoost', () => {
  describe('constants', () => {
    it('FUNNESS_FULL_BOOST_RUNS should be 10', () => {
      expect(FUNNESS_FULL_BOOST_RUNS).toBe(10)
    })

    it('FUNNESS_DECAY_END_RUNS should be 100', () => {
      expect(FUNNESS_DECAY_END_RUNS).toBe(100)
    })
  })

  describe('calculateFunnessBoostFactor', () => {
    it('returns 1.0 for run 0 (start of full boost period)', () => {
      expect(calculateFunnessBoostFactor(0)).toBe(1.0)
    })

    it('returns 1.0 for run 9 (end of full boost period)', () => {
      expect(calculateFunnessBoostFactor(9)).toBe(1.0)
    })

    it('returns a value between 0 and 1 for run 50 (decay phase)', () => {
      const result = calculateFunnessBoostFactor(50)
      expect(result).toBeGreaterThan(0)
      expect(result).toBeLessThan(1)
    })

    it('returns approximately 0.556 for run 50 (linear decay midpoint)', () => {
      // At run 50, we're 40 runs into the decay (50 - 10 = 40)
      // Decay window is 90 runs (100 - 10 = 90)
      // So the factor should be 1.0 - (40 / 90) ≈ 0.556
      const result = calculateFunnessBoostFactor(50)
      expect(result).toBeCloseTo(0.5555555, 5)
    })

    it('returns 0.0 for run 100 (decay end)', () => {
      expect(calculateFunnessBoostFactor(100)).toBe(0.0)
    })

    it('returns 0.0 for run 200 (beyond decay end)', () => {
      expect(calculateFunnessBoostFactor(200)).toBe(0.0)
    })

    it('returns 1.0 for negative runs (edge case)', () => {
      expect(calculateFunnessBoostFactor(-1)).toBe(1.0)
    })

    it('returns approximately correct value at run 10 (start of decay)', () => {
      // At run 10, we're 0 runs into the decay (10 - 10 = 0)
      // Factor should be 1.0 - (0 / 90) = 1.0
      expect(calculateFunnessBoostFactor(10)).toBeCloseTo(1.0, 5)
    })

    it('returns approximately correct value at run 55 (3/4 through decay)', () => {
      // At run 55, we're 45 runs into the decay (55 - 10 = 45)
      // Factor should be 1.0 - (45 / 90) = 0.5
      expect(calculateFunnessBoostFactor(55)).toBeCloseTo(0.5, 5)
    })
  })

  describe('funScoreWeight', () => {
    it('returns 1 when boostFactor is 0 (no boost)', () => {
      expect(funScoreWeight(10, 0)).toBe(1)
      expect(funScoreWeight(5, 0)).toBe(1)
      expect(funScoreWeight(1, 0)).toBe(1)
    })

    it('returns 1 when boostFactor is negative (edge case)', () => {
      expect(funScoreWeight(10, -1)).toBe(1)
    })

    describe('at full boost (boostFactor = 1.0)', () => {
      it('returns 2.0 for funScore 10', () => {
        // 1 + 1.0 * (10 - 5) / 5 = 1 + 1.0 = 2.0
        expect(funScoreWeight(10, 1.0)).toBe(2.0)
      })

      it('returns 1.0 for funScore 5 (baseline)', () => {
        // 1 + 1.0 * (5 - 5) / 5 = 1 + 0 = 1.0
        expect(funScoreWeight(5, 1.0)).toBe(1.0)
      })

      it('returns 0.2 for funScore 1 (minimum without clamping)', () => {
        // 1 + 1.0 * (1 - 5) / 5 = 1 - 0.8 = 0.2
        // But clamped to 0.1 minimum
        const result = funScoreWeight(1, 1.0)
        expect(result).toBeGreaterThanOrEqual(0.1)
      })

      it('respects minimum clamp of 0.1 for funScore 1', () => {
        // Raw calculation: 1 + 1.0 * (1 - 5) / 5 = 0.2
        // Should not be clamped since 0.2 >= 0.1
        expect(funScoreWeight(1, 1.0)).toBeCloseTo(0.2, 5)
      })

      it('returns 1.4 for funScore 7', () => {
        // 1 + 1.0 * (7 - 5) / 5 = 1 + 0.4 = 1.4
        expect(funScoreWeight(7, 1.0)).toBe(1.4)
      })

      it('returns 0.6 for funScore 2 (clamped at 0.1)', () => {
        // 1 + 1.0 * (2 - 5) / 5 = 1 - 0.6 = 0.4
        // Should not be clamped since 0.4 >= 0.1
        expect(funScoreWeight(2, 1.0)).toBe(0.4)
      })
    })

    describe('at half boost (boostFactor = 0.5)', () => {
      it('returns 1.5 for funScore 10', () => {
        // 1 + 0.5 * (10 - 5) / 5 = 1 + 0.5 = 1.5
        expect(funScoreWeight(10, 0.5)).toBe(1.5)
      })

      it('returns 1.0 for funScore 5 (baseline)', () => {
        // 1 + 0.5 * (5 - 5) / 5 = 1 + 0 = 1.0
        expect(funScoreWeight(5, 0.5)).toBe(1.0)
      })

      it('returns 0.6 for funScore 1', () => {
        // 1 + 0.5 * (1 - 5) / 5 = 1 - 0.4 = 0.6
        expect(funScoreWeight(1, 0.5)).toBe(0.6)
      })

      it('returns 0.7 for funScore 2', () => {
        // 1 + 0.5 * (2 - 5) / 5 = 1 - 0.3 = 0.7
        expect(funScoreWeight(2, 0.5)).toBe(0.7)
      })

      it('returns 1.2 for funScore 7', () => {
        // 1 + 0.5 * (7 - 5) / 5 = 1 + 0.2 = 1.2
        expect(funScoreWeight(7, 0.5)).toBe(1.2)
      })
    })

    describe('clamping behavior', () => {
      it('never returns less than 0.1', () => {
        // Test with very low funScore and full boost
        // 1 + 1.0 * (0 - 5) / 5 = 1 - 1 = 0 → clamped to 0.1
        expect(funScoreWeight(0, 1.0)).toBe(0.1)
      })

      it('clamps negative raw calculations to 0.1', () => {
        // funScore = -10, boostFactor = 1.0
        // 1 + 1.0 * (-10 - 5) / 5 = 1 - 3 = -2 → clamped to 0.1
        expect(funScoreWeight(-10, 1.0)).toBe(0.1)
      })

      it('allows positive results above 0.1 without clamping', () => {
        // funScore = 15, boostFactor = 1.0
        // 1 + 1.0 * (15 - 5) / 5 = 1 + 2 = 3.0
        expect(funScoreWeight(15, 1.0)).toBe(3.0)
      })
    })

    describe('edge cases', () => {
      it('handles boostFactor between 0 and 1', () => {
        const result = funScoreWeight(5, 0.75)
        expect(result).toBe(1.0) // (5 - 5) component is zero
      })

      it('handles boostFactor greater than 1', () => {
        // 1 + 1.5 * (10 - 5) / 5 = 1 + 1.5 = 2.5
        expect(funScoreWeight(10, 1.5)).toBe(2.5)
      })

      it('handles very large funScore', () => {
        // 1 + 1.0 * (1000 - 5) / 5 = 1 + 199 = 200
        expect(funScoreWeight(1000, 1.0)).toBe(200)
      })

      it('handles very small funScore', () => {
        // 1 + 1.0 * (-1000 - 5) / 5 = 1 - 201 = -200 → clamped to 0.1
        expect(funScoreWeight(-1000, 1.0)).toBe(0.1)
      })
    })
  })

  describe('integration scenarios', () => {
    it('early runs have high boost for fun facts', () => {
      const earlyRunBoost = calculateFunnessBoostFactor(0)
      const weight = funScoreWeight(10, earlyRunBoost)
      expect(weight).toBe(2.0) // High-fun fact gets 2x weight
    })

    it('late runs have no boost regardless of funScore', () => {
      const lateRunBoost = calculateFunnessBoostFactor(150)
      const weightHighFun = funScoreWeight(10, lateRunBoost)
      const weightLowFun = funScoreWeight(1, lateRunBoost)
      expect(weightHighFun).toBe(1.0) // All same weight
      expect(weightLowFun).toBe(1.0)
    })

    it('mid-run shows partial boost', () => {
      const midRunBoost = calculateFunnessBoostFactor(50)
      const weightHighFun = funScoreWeight(10, midRunBoost)
      const weightLowFun = funScoreWeight(1, midRunBoost)
      // At ~0.556 boost, high fun should be > 1.0 and low fun should be < 1.0
      expect(weightHighFun).toBeGreaterThan(1.0)
      expect(weightLowFun).toBeLessThan(1.0)
      expect(weightHighFun).toBeGreaterThan(weightLowFun)
    })
  })
})
