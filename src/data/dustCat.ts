/**
 * dustCat.ts
 * All static data for the Dust Cat permanent pet. (DD-V2-040)
 */

/** Possible ambient animations the Dust Cat can play in the dome. */
export type DustCatAmbientAnim =
  | 'walk'
  | 'idle_sit'
  | 'idle_groom'
  | 'idle_sniff'
  | 'sleep'
  | 'react_happy'
  | 'react_excited'
  | 'react_hungry'

/** Mine-layer animation modes for the Dust Cat mine follower. */
export type DustCatMineAnim = 'follow' | 'idle_sniff' | 'react_block'

/** Dust Cat mine-follow behavior config. */
export interface DustCatMineConfig {
  /** Tiles behind the player the cat maintains. */
  followDistance: number
  /** Maximum tiles per second the cat moves to close the gap. */
  moveSpeed: number
  /** Probability per block mined that the cat plays react_block animation. */
  reactChance: number
  /** Minimum ticks between mine reactions to avoid spamming. */
  reactCooldownTicks: number
}

export const DUST_CAT_MINE_CONFIG: DustCatMineConfig = {
  followDistance: 2,
  moveSpeed: 3,
  reactChance: 0.12,
  reactCooldownTicks: 8,
}

/** Sprite keys expected from the sprite pipeline for the Dust Cat. */
export const DUST_CAT_SPRITE_KEYS = {
  walk:          'dust_cat_walk',        // 4-frame walk strip, 48×32 px per frame
  idle_sit:      'dust_cat_idle_sit',    // 2-frame sit strip
  idle_groom:    'dust_cat_idle_groom',  // 4-frame groom strip
  idle_sniff:    'dust_cat_idle_sniff',  // 3-frame sniff strip
  sleep:         'dust_cat_sleep',       // 2-frame sleep strip (eyes closed)
  react_happy:   'dust_cat_react_happy', // 3-frame bounce strip
  react_excited: 'dust_cat_react_excited', // 4-frame roll strip
  react_hungry:  'dust_cat_react_hungry',  // 2-frame ears-down strip
  shadow:        'dust_cat_shadow',      // static 48×8 soft-circle shadow
} as const

/** Logical render size of the Dust Cat sprite in dome tile units. */
export const DUST_CAT_RENDER = { width: 48, height: 32 }

/** Base mine-follow sprite size in Phaser pixel units (matches 32px tile grid). */
export const DUST_CAT_MINE_RENDER = { width: 24, height: 16 }
