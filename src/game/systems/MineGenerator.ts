import { BALANCE } from '../../data/balance'
import { BlockType, type MineCell, type Rarity } from '../../data/types'

/**
 * Creates a deterministic pseudo-random number generator from a numeric seed.
 * Uses the mulberry32 algorithm and returns values in the range [0, 1).
 */
export function seededRandom(seed: number): () => number {
  let t = seed >>> 0

  return (): number => {
    t += 0x6d2b79f5
    let n = Math.imul(t ^ (t >>> 15), t | 1)
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61)
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Generates a mine grid using deterministic procedural rules.
 */
export function generateMine(seed: number, width: number, height: number, facts: string[]): MineCell[][] {
  const rng = seededRandom(seed)
  const grid: MineCell[][] = []

  const weightedBaseBlocks: Array<{ type: BlockType; weight: number }> = [
    { type: BlockType.Dirt, weight: 55 },
    { type: BlockType.SoftRock, weight: 20 },
    { type: BlockType.Stone, weight: 10 },
    { type: BlockType.HardRock, weight: 5 },
  ]
  const baseWeightTotal = weightedBaseBlocks.reduce((sum, entry) => sum + entry.weight, 0)

  for (let y = 0; y < height; y++) {
    const row: MineCell[] = []

    for (let x = 0; x < width; x++) {
      const type = y < 2 ? BlockType.Empty : pickBaseBlock(rng, weightedBaseBlocks, baseWeightTotal)
      const hardness = getHardness(type)

      row.push({
        type,
        hardness,
        maxHardness: hardness,
        revealed: false,
      })
    }

    grid.push(row)
  }

  const positions = buildSpecialPositionPool(width, height)
  let factCursor = 0

  const nextFactId = (): string | undefined => {
    if (facts.length === 0) {
      return undefined
    }

    const factId = facts[factCursor % facts.length]
    factCursor += 1
    return factId
  }

  placeSpecialBlocks(grid, positions, BALANCE.DENSITY_MINERAL_NODES, rng, () => {
    const hardness = BALANCE.HARDNESS_MINERAL_NODE
    const mineralAmount = randomIntInclusive(rng, BALANCE.MINERAL_DROP_MIN, BALANCE.MINERAL_DROP_MAX)
    return {
      type: BlockType.MineralNode,
      hardness,
      maxHardness: hardness,
      revealed: false,
      content: {
        mineralType: 'dust',
        mineralAmount,
      },
    }
  })

  placeSpecialBlocks(grid, positions, BALANCE.DENSITY_ARTIFACT_NODES, rng, () => {
    const hardness = BALANCE.HARDNESS_ARTIFACT_NODE
    return {
      type: BlockType.ArtifactNode,
      hardness,
      maxHardness: hardness,
      revealed: false,
      content: {
        artifactRarity: pickRarity(rng),
        factId: nextFactId(),
      },
    }
  })

  placeSpecialBlocks(grid, positions, BALANCE.DENSITY_OXYGEN_CACHES, rng, () => {
    const hardness = 2
    return {
      type: BlockType.OxygenCache,
      hardness,
      maxHardness: hardness,
      revealed: false,
      content: {
        oxygenAmount: BALANCE.OXYGEN_CACHE_RESTORE,
      },
    }
  })

  placeSpecialBlocks(grid, positions, BALANCE.DENSITY_QUIZ_GATES, rng, () => {
    const hardness = BALANCE.HARDNESS_QUIZ_GATE
    return {
      type: BlockType.QuizGate,
      hardness,
      maxHardness: hardness,
      revealed: false,
      content: {
        factId: nextFactId(),
      },
    }
  })

  placeSpecialBlocks(grid, positions, BALANCE.DENSITY_UPGRADE_CRATES, rng, () => {
    const hardness = 2
    return {
      type: BlockType.UpgradeCrate,
      hardness,
      maxHardness: hardness,
      revealed: false,
    }
  })

  placeEmptyPockets(grid, rng, BALANCE.DENSITY_EMPTY_POCKETS)

  revealAround(grid, Math.floor(width / 2), 1, BALANCE.FOG_REVEAL_RADIUS)

  return grid
}

/**
 * Reveals all cells within a Manhattan-distance radius from a center point.
 */
export function revealAround(grid: MineCell[][], x: number, y: number, radius: number): void {
  if (grid.length === 0 || grid[0].length === 0) {
    return
  }

  const height = grid.length
  const width = grid[0].length

  for (let cy = y - radius; cy <= y + radius; cy++) {
    if (cy < 0 || cy >= height) {
      continue
    }

    for (let cx = x - radius; cx <= x + radius; cx++) {
      if (cx < 0 || cx >= width) {
        continue
      }

      if (Math.abs(cx - x) + Math.abs(cy - y) <= radius) {
        grid[cy][cx].revealed = true
      }
    }
  }
}

/**
 * Selects an artifact rarity using weighted probabilities from balance config.
 */
export function pickRarity(rng: () => number): Rarity {
  const entries = Object.entries(BALANCE.ARTIFACT_RARITY_WEIGHTS) as Array<[Rarity, number]>
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0)
  const roll = rng() * totalWeight

  let cumulative = 0
  for (const [rarity, weight] of entries) {
    cumulative += weight
    if (roll < cumulative) {
      return rarity
    }
  }

  return entries[entries.length - 1][0]
}

function pickBaseBlock(
  rng: () => number,
  weightedBaseBlocks: Array<{ type: BlockType; weight: number }>,
  baseWeightTotal: number
): BlockType {
  if (rng() < BALANCE.DENSITY_UNBREAKABLE_RATIO) {
    return BlockType.Unbreakable
  }

  const roll = rng() * baseWeightTotal
  let cumulative = 0

  for (const entry of weightedBaseBlocks) {
    cumulative += entry.weight
    if (roll < cumulative) {
      return entry.type
    }
  }

  return BlockType.HardRock
}

function getHardness(type: BlockType): number {
  switch (type) {
    case BlockType.Dirt:
      return BALANCE.HARDNESS_DIRT
    case BlockType.SoftRock:
      return BALANCE.HARDNESS_SOFT_ROCK
    case BlockType.Stone:
      return BALANCE.HARDNESS_STONE
    case BlockType.HardRock:
      return BALANCE.HARDNESS_HARD_ROCK
    case BlockType.MineralNode:
      return BALANCE.HARDNESS_MINERAL_NODE
    case BlockType.ArtifactNode:
      return BALANCE.HARDNESS_ARTIFACT_NODE
    case BlockType.QuizGate:
      return BALANCE.HARDNESS_QUIZ_GATE
    case BlockType.Unbreakable:
      return 999
    default:
      return 0
  }
}

function buildSpecialPositionPool(width: number, height: number): Array<{ x: number; y: number }> {
  const pool: Array<{ x: number; y: number }> = []

  for (let y = 2; y < height; y++) {
    for (let x = 1; x < width - 1; x++) {
      pool.push({ x, y })
    }
  }

  return pool
}

function placeSpecialBlocks(
  grid: MineCell[][],
  positions: Array<{ x: number; y: number }>,
  count: number,
  rng: () => number,
  createCell: () => MineCell
): void {
  const placements = Math.min(count, positions.length)

  for (let i = 0; i < placements; i++) {
    const randomIndex = Math.floor(rng() * positions.length)
    const [position] = positions.splice(randomIndex, 1)
    grid[position.y][position.x] = createCell()
  }
}

function placeEmptyPockets(grid: MineCell[][], rng: () => number, count: number): void {
  const height = grid.length
  const width = height > 0 ? grid[0].length : 0

  if (width === 0 || height === 0) {
    return
  }

  const minCenterX = 1
  const maxCenterX = width - 2
  const minCenterY = 3
  const maxCenterY = height - 2

  if (maxCenterX < minCenterX || maxCenterY < minCenterY) {
    return
  }

  for (let i = 0; i < count; i++) {
    const centerX = randomIntInclusive(rng, minCenterX, maxCenterX)
    const centerY = randomIntInclusive(rng, minCenterY, maxCenterY)

    for (let y = centerY - 1; y <= centerY + 1; y++) {
      for (let x = centerX - 1; x <= centerX + 1; x++) {
        grid[y][x] = {
          type: BlockType.Empty,
          hardness: 0,
          maxHardness: 0,
          revealed: false,
        }
      }
    }
  }
}

function randomIntInclusive(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}
