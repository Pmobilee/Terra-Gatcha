import { BALANCE } from '../../data/balance'
import { BlockType } from '../../data/types'

export type OxygenState = {
  current: number
  max: number
}

/**
 * Creates a fresh oxygen state from the number of tanks for a dive.
 */
export function createOxygenState(tanks: number): OxygenState {
  const totalOxygen = tanks * BALANCE.OXYGEN_PER_TANK

  return {
    current: totalOxygen,
    max: totalOxygen,
  }
}

/**
 * Consumes oxygen and returns an updated immutable state.
 */
export function consumeOxygen(
  state: OxygenState,
  amount: number,
): { state: OxygenState; depleted: boolean } {
  const current = Math.max(0, state.current - amount)
  const nextState: OxygenState = {
    ...state,
    current,
  }

  return {
    state: nextState,
    depleted: current <= 0,
  }
}

/**
 * Adds oxygen to the current amount, clamped to the maximum capacity.
 */
export function addOxygen(state: OxygenState, amount: number): OxygenState {
  const current = Math.min(state.max, state.current + amount)

  return {
    ...state,
    current,
  }
}

/**
 * Returns oxygen cost for interacting with a given block type.
 */
export function getOxygenCostForBlock(blockType: BlockType): number {
  switch (blockType) {
    case BlockType.Dirt:
      return BALANCE.OXYGEN_COST_MINE_DIRT
    case BlockType.SoftRock:
      return BALANCE.OXYGEN_COST_MINE_SOFT_ROCK
    case BlockType.Stone:
      return BALANCE.OXYGEN_COST_MINE_STONE
    case BlockType.HardRock:
      return BALANCE.OXYGEN_COST_MINE_HARD_ROCK
    case BlockType.MineralNode:
      return BALANCE.OXYGEN_COST_MINE_STONE
    case BlockType.ArtifactNode:
      return BALANCE.OXYGEN_COST_MINE_HARD_ROCK
    case BlockType.OxygenCache:
      return BALANCE.OXYGEN_COST_MINE_DIRT
    case BlockType.QuizGate:
      return BALANCE.OXYGEN_COST_QUIZ_ATTEMPT
    case BlockType.UpgradeCrate:
      return BALANCE.OXYGEN_COST_MINE_SOFT_ROCK
    case BlockType.Empty:
    case BlockType.Unbreakable:
      return 0
    default:
      return 1
  }
}
