/**
 * Computes a fast integer checksum over a mine grid for determinism verification.
 * Hashes block type, hardness, and content fields of every cell.
 * Uses a djb2-style rolling hash for speed.
 *
 * @file src/game/systems/SeedVerifier.ts
 */

import type { MineCell } from '../../data/types'

/**
 * Computes a 32-bit unsigned integer checksum of a mine grid.
 * Same grid → same checksum (deterministic).
 *
 * @param grid - The mine grid to checksum.
 * @returns A 32-bit unsigned integer.
 */
export function gridChecksum(grid: MineCell[][]): number {
  let hash = 5381
  for (const row of grid) {
    for (const cell of row) {
      hash = ((hash << 5) + hash + cell.type) >>> 0
      hash = ((hash << 5) + hash + cell.hardness) >>> 0
      if (cell.content) {
        hash = ((hash << 5) + hash + (cell.content.mineralAmount ?? 0)) >>> 0
        hash = ((hash << 5) + hash + (cell.content.oxygenAmount ?? 0)) >>> 0
      }
    }
  }
  return hash >>> 0
}

/**
 * Verifies that re-generating a mine from its seed produces the same checksum
 * as was recorded during the original generation. Returns true if checksums match.
 *
 * @param seed - Original seed.
 * @param facts - Original facts array.
 * @param layer - Layer index.
 * @param biome - Biome used.
 * @param expectedChecksum - Previously recorded checksum.
 */
export function verifyMineChecksum(
  seed: number,
  facts: string[],
  layer: number,
  biome: import('../../data/biomes').Biome,
  expectedChecksum: number,
): boolean {
  // Dynamic import to avoid circular dependency issues at module load time.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { generateMine } = require('./MineGenerator') as typeof import('./MineGenerator')
  const { grid } = generateMine(seed, facts, layer, biome)
  const actual = gridChecksum(grid)
  return actual === expectedChecksum
}
