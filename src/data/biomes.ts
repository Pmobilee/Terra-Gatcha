import { BlockType } from './types'

/**
 * Defines the visual and procedural character of a mine layer.
 */
export interface Biome {
  id: string
  name: string
  description: string
  /** Base background color for empty cells */
  bgColor: number
  /** Color overrides for block types (merged with BLOCK_COLORS in MineScene) */
  blockColorOverrides: Partial<Record<BlockType, number>>
  /** Multipliers for block distribution weights */
  blockWeights: {
    dirt: number
    softRock: number
    stone: number
    hardRock: number
  }
  /** Multipliers applied to hazard densities (LAVA_DENSITY, GAS_POCKET_DENSITY, UNSTABLE_GROUND_DENSITY) */
  hazardMultipliers: {
    lava: number
    gas: number
    unstable: number
  }
  /** Multiplier applied to the mineral node placement count */
  mineralMultiplier: number
  /** Fog tint color used for ring-1 and ring-2 hidden block backgrounds */
  fogTint: number
}

/**
 * All available biomes. The first entry (sedimentary) is the default/tutorial biome.
 */
export const BIOMES: Biome[] = [
  {
    id: 'sedimentary',
    name: 'Sedimentary Depths',
    description: 'Ancient layers of compressed earth.',
    bgColor: 0x111118,
    blockColorOverrides: {},
    blockWeights: { dirt: 1.0, softRock: 1.0, stone: 1.0, hardRock: 1.0 },
    hazardMultipliers: { lava: 1.0, gas: 1.0, unstable: 1.0 },
    mineralMultiplier: 1.0,
    fogTint: 0x1a1a2e,
  },
  {
    id: 'volcanic',
    name: 'Volcanic Veins',
    description: 'Heat radiates from the ancient magma flows.',
    bgColor: 0x1a0a0a,
    blockColorOverrides: {
      [BlockType.Dirt]: 0x8B4513,
      [BlockType.SoftRock]: 0x6B3410,
      [BlockType.Stone]: 0x4a3030,
      [BlockType.HardRock]: 0x3a2020,
    },
    blockWeights: { dirt: 0.6, softRock: 0.8, stone: 1.2, hardRock: 1.4 },
    hazardMultipliers: { lava: 2.5, gas: 0.5, unstable: 1.5 },
    mineralMultiplier: 0.8,
    fogTint: 0x2a1010,
  },
  {
    id: 'crystalline',
    name: 'Crystalline Caverns',
    description: 'Prismatic minerals line every surface.',
    bgColor: 0x0a0a1a,
    blockColorOverrides: {
      [BlockType.Dirt]: 0x3a4a6a,
      [BlockType.SoftRock]: 0x4a5a7a,
      [BlockType.Stone]: 0x5a6a8a,
      [BlockType.HardRock]: 0x3a3a5a,
    },
    blockWeights: { dirt: 0.8, softRock: 1.0, stone: 1.3, hardRock: 0.9 },
    hazardMultipliers: { lava: 0.3, gas: 1.5, unstable: 0.5 },
    mineralMultiplier: 1.6,
    fogTint: 0x10102a,
  },
]

/** The default sedimentary biome — used when no explicit biome is specified. */
export const DEFAULT_BIOME: Biome = BIOMES[0]

/**
 * Picks a biome for a given layer using seeded RNG.
 * Layer 0 is always sedimentary (tutorial-like intro). Deeper layers get random biomes.
 *
 * @param rng - Seeded random number generator for deterministic results
 * @param layer - Zero-based layer index
 */
export function pickBiome(rng: () => number, layer: number): Biome {
  if (layer === 0) return BIOMES[0]
  return BIOMES[Math.floor(rng() * BIOMES.length)]
}

/**
 * Generates a shuffled biome sequence for an entire dive run using Fisher-Yates shuffle.
 * If maxLayers exceeds the number of available biomes, the sequence cycles with a fresh
 * shuffle for each additional pass so every layer still gets a deterministic biome.
 *
 * @param rng - Seeded RNG (from seededRandom) for fully deterministic results per dive
 * @param maxLayers - Total number of layers in the run (typically BALANCE.MAX_LAYERS)
 * @returns Array of Biome objects, one per layer index
 */
export function generateBiomeSequence(rng: () => number, maxLayers: number): Biome[] {
  const sequence: Biome[] = []

  while (sequence.length < maxLayers) {
    // Clone the biome pool and Fisher-Yates shuffle it with the seeded RNG.
    const pool = [...BIOMES]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const temp = pool[i]
      pool[i] = pool[j]
      pool[j] = temp
    }
    // Append as many shuffled biomes as needed to fill the sequence.
    const needed = maxLayers - sequence.length
    sequence.push(...pool.slice(0, needed))
  }

  return sequence
}
