import { FastifyInstance } from 'fastify'

/**
 * Artifact drop rate tiers with displayed probabilities (DD-V2-174).
 * Defined inline to avoid importing from the client source tree.
 */
interface DropRateTier {
  rarity: string
  displayRate: string
  actualRate: number
  pityThreshold: number
}

const DROP_RATES: DropRateTier[] = [
  { rarity: 'common',    displayRate: '45%',   actualRate: 0.45,  pityThreshold: 0   },
  { rarity: 'uncommon',  displayRate: '30%',   actualRate: 0.30,  pityThreshold: 0   },
  { rarity: 'rare',      displayRate: '15%',   actualRate: 0.15,  pityThreshold: 20  },
  { rarity: 'epic',      displayRate: '7%',    actualRate: 0.07,  pityThreshold: 35  },
  { rarity: 'legendary', displayRate: '2.5%',  actualRate: 0.025, pityThreshold: 50  },
  { rarity: 'mythic',    displayRate: '0.5%',  actualRate: 0.005, pityThreshold: 100 },
]

/** Returns drop rates formatted for public display. */
function getDisplayDropRates(): { rarity: string; displayRate: string; pityThreshold: number }[] {
  return DROP_RATES.map(({ rarity, displayRate, pityThreshold }) => ({
    rarity,
    displayRate,
    pityThreshold,
  }))
}

/** Validates that the sum of actual rates is approximately 1.0. */
function validateDropRates(): { valid: boolean; sum: number } {
  const sum = DROP_RATES.reduce((acc, t) => acc + t.actualRate, 0)
  return { valid: Math.abs(sum - 1.0) < 0.001, sum }
}

/**
 * Compliance endpoints for gacha ethics (DD-V2-174).
 * Drop rates must be publicly available.
 */
export async function complianceRoutes(app: FastifyInstance): Promise<void> {
  // Public: get drop rates (DD-V2-174: rates must be displayed)
  app.get('/drop-rates', async (_req, reply) => {
    const rates = getDisplayDropRates()
    const validation = validateDropRates()
    return reply.send({
      rates,
      validation,
      policy: {
        pitySystem: 'Guaranteed rare at 20 pulls, epic at 35, legendary at 50, mythic at 100',
        realMoneyPolicy: 'Premium currency cannot purchase gacha pulls or random items',
        transparencyCommitment: 'All drop rates are displayed in-game and via this API'
      }
    })
  })

  // Public: get compliance policy document
  app.get('/policy', async (_req, reply) => {
    return reply.send({
      version: '1.0.0',
      lastUpdated: '2026-03-04',
      policies: [
        { id: 'DD-V2-174', title: 'Drop Rate Transparency', description: 'All gacha/artifact drop rates are displayed to players before any engagement. Rates are consistent — no dynamic manipulation based on spending behavior.' },
        { id: 'no-rng-purchase', title: 'No Real-Money Randomization', description: 'Premium currency (real money) cannot purchase gacha pulls, mystery boxes, or any item with random outcomes. Premium purchases are cosmetic and deterministic.' },
        { id: 'pity-system', title: 'Pity System', description: 'After a configured number of pulls without receiving a rarity tier, the next pull is guaranteed at that tier. Pity thresholds: Rare=20, Epic=35, Legendary=50, Mythic=100.' },
        { id: 'kid-protection', title: 'Minor Protection', description: 'Players under 13 (Kid Mode) cannot make purchases. Players 13-17 have parental spending controls enabled by default.' }
      ]
    })
  })
}
