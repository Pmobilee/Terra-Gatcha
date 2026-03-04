// src/game/systems/BlockAnimSystem.ts

import { BlockType } from '../../data/types'

interface BlockAnimConfig {
  /** Array of sprite keys to cycle through, in order */
  frames: string[]
  /** Total animation loop duration in milliseconds */
  periodMs: number
}

/** Configuration for ambient mote particles on special blocks */
export interface MoteParticleConfig {
  /** Particle tint color */
  tint: number
  /** Particle lifespan in ms */
  lifespan: number
  /** Particle speed range */
  speed: { min: number; max: number }
  /** Particle scale range */
  scale: { start: number; end: number }
  /** Emission frequency in ms (lower = more frequent) */
  frequency: number
}

/**
 * Animation configurations per animated block type.
 * Keys are Phaser sprite keys. The first frame in each array
 * is the base sprite (already loaded). Additional frames are
 * optional — if they don't exist, the system gracefully falls
 * back to the base frame.
 */
const BLOCK_ANIM_CONFIGS: Partial<Record<BlockType, BlockAnimConfig>> = {
  [BlockType.LavaBlock]: {
    frames: ['block_lava', 'block_lava_01', 'block_lava_02', 'block_lava_03', 'block_lava_04', 'block_lava_05'],
    periodMs: 800,
  },
  [BlockType.GasPocket]: {
    frames: ['block_gas', 'block_gas_01', 'block_gas_02', 'block_gas_03'],
    periodMs: 1200,
  },
  [BlockType.DescentShaft]: {
    frames: ['block_descent_shaft', 'block_descent_shaft_01', 'block_descent_shaft_02',
             'block_descent_shaft_03', 'block_descent_shaft_04', 'block_descent_shaft_05'],
    periodMs: 2000,
  },
  [BlockType.QuizGate]: {
    frames: ['block_quiz_gate', 'block_quiz_gate_01', 'block_quiz_gate_02', 'block_quiz_gate_03'],
    periodMs: 1000,
  },
  [BlockType.MineralNode]: {
    frames: ['block_mineral_shimmer_00', 'block_mineral_shimmer_01', 'block_mineral_shimmer_02'],
    periodMs: 1500,
  },
  [BlockType.ArtifactNode]: {
    frames: ['block_artifact', 'block_artifact_01', 'block_artifact_02', 'block_artifact_03'],
    periodMs: 2000,
  },
  [BlockType.RelicShrine]: {
    frames: ['block_relic_shrine', 'block_relic_shrine_01', 'block_relic_shrine_02', 'block_relic_shrine_03'],
    periodMs: 2500,
  },
  [BlockType.OxygenCache]: {
    frames: ['block_oxygen_cache', 'block_oxygen_cache_01', 'block_oxygen_cache_02', 'block_oxygen_cache_03'],
    periodMs: 1800,
  },
  [BlockType.UpgradeCrate]: {
    frames: ['block_upgrade_crate', 'block_upgrade_crate_01', 'block_upgrade_crate_02'],
    periodMs: 3000,
  },
  [BlockType.FossilNode]: {
    frames: ['block_fossil', 'block_fossil_01', 'block_fossil_02'],
    periodMs: 3000,
  },
}

/** Block types that emit ambient mote particles */
const MOTE_CONFIGS: Partial<Record<BlockType, MoteParticleConfig>> = {
  [BlockType.RelicShrine]: {
    tint: 0xcc88ff,
    lifespan: 1200,
    speed: { min: 3, max: 12 },
    scale: { start: 0.5, end: 0 },
    frequency: 400,
  },
  [BlockType.ArtifactNode]: {
    tint: 0xff99aa,
    lifespan: 900,
    speed: { min: 4, max: 15 },
    scale: { start: 0.4, end: 0 },
    frequency: 500,
  },
}

/**
 * Time-based frame cycling for animated block types, with per-tile phase offsets.
 *
 * Phase offset formula: `((tileX * 7 + tileY * 13) % frames.length) * (periodMs / frames.length)`
 * This ensures that adjacent tiles of the same type animate at different phases,
 * eliminating the "synchronized flash" artifact that makes tile patterns look fake.
 *
 * Usage in MineScene.drawBlockPattern():
 *   const animKey = BlockAnimSystem.getFrameKey(cell.type, this.time.now, this.textures, tileX, tileY)
 *   sprite.setTexture(animKey ?? defaultKey)
 */
export class BlockAnimSystem {
  /**
   * Returns the current sprite key for an animated block type,
   * based on the elapsed game time and the tile's grid position
   * (for per-tile phase offset to desynchronize adjacent tiles).
   *
   * @param blockType - The type of block to animate
   * @param nowMs     - Current time in milliseconds (from Phaser's this.time.now)
   * @param textures  - Phaser TextureManager to verify key existence
   * @param tileX     - Grid X position of this tile (used for phase offset)
   * @param tileY     - Grid Y position of this tile (used for phase offset)
   * @returns Sprite key string, or null if this block type has no animation config
   */
  static getFrameKey(
    blockType: BlockType,
    nowMs: number,
    textures: Phaser.Textures.TextureManager,
    tileX = 0,
    tileY = 0
  ): string | null {
    const cfg = BLOCK_ANIM_CONFIGS[blockType]
    if (!cfg) return null

    // Per-tile phase offset: deterministic based on grid position
    // Formula ensures adjacent same-type tiles animate at different phases
    const phaseOffset = ((tileX * 7 + tileY * 13) % cfg.frames.length)
      * (cfg.periodMs / cfg.frames.length)

    const adjustedTime = nowMs + phaseOffset
    const frameIdx = Math.floor((adjustedTime % cfg.periodMs) / cfg.periodMs * cfg.frames.length)
    const key = cfg.frames[frameIdx]

    // Graceful fallback: if frame sprite doesn't exist, use first frame
    if (!textures.exists(key)) {
      return textures.exists(cfg.frames[0]) ? cfg.frames[0] : null
    }
    return key
  }

  /**
   * Returns whether a given block type has an idle animation.
   *
   * @param blockType - The block type to check
   * @returns True if the block has an animation configuration
   */
  static isAnimated(blockType: BlockType): boolean {
    return BLOCK_ANIM_CONFIGS[blockType] !== undefined
  }

  /**
   * Returns whether a given block type emits ambient mote particles.
   *
   * @param blockType - The block type to check
   * @returns True if the block has a mote particle configuration
   */
  static hasMoteParticles(blockType: BlockType): boolean {
    return MOTE_CONFIGS[blockType] !== undefined
  }

  /**
   * Returns the mote particle configuration for a block type, or null if none.
   * Used by MineScene to spawn per-tile ambient particles for special blocks.
   *
   * @param blockType - The block type to check
   * @returns MoteParticleConfig or null
   */
  static getMoteConfig(blockType: BlockType): MoteParticleConfig | null {
    return MOTE_CONFIGS[blockType] ?? null
  }
}
