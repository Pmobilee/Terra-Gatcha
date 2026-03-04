// src/data/biomeTransitionSpec.ts
// Phase 33.6 — Biome transition tileset specification.
// Defines which biome pairs get bespoke transition tiles at layer boundaries.

import type { BiomeId } from './biomes'

/** A pair of biomes that commonly appear adjacent in the layer sequence. */
export interface TransitionPair {
  biomeA: BiomeId
  biomeB: BiomeId
  /** Blending mode — 'blend' mixes colors, 'erode' biomeA erodes into biomeB */
  mode: 'blend' | 'erode'
}

/**
 * All valid adjacent tier transitions in the 20-layer sequence.
 * Shallow↔Mid, Mid↔Deep, Deep↔Extreme.
 * Anomaly biomes can appear anywhere so are paired with their host tier.
 */
export const TRANSITION_PAIRS: TransitionPair[] = [
  // Shallow → Mid boundaries (layer 5→6)
  { biomeA: 'limestone_caves', biomeB: 'basalt_maze',    mode: 'erode' },
  { biomeA: 'limestone_caves', biomeB: 'coal_veins',     mode: 'blend' },
  { biomeA: 'clay_basin',      biomeB: 'basalt_maze',    mode: 'blend' },
  { biomeA: 'iron_seam',       biomeB: 'granite_canyon', mode: 'erode' },
  { biomeA: 'peat_bog',        biomeB: 'coal_veins',     mode: 'blend' },
  // Mid → Deep boundaries (layer 10→11)
  { biomeA: 'basalt_maze',     biomeB: 'obsidian_rift',  mode: 'erode' },
  { biomeA: 'coal_veins',      biomeB: 'fossil_layer',   mode: 'blend' },
  { biomeA: 'granite_canyon',  biomeB: 'crystal_geode',  mode: 'blend' },
  { biomeA: 'sulfur_springs',  biomeB: 'magma_shelf',    mode: 'erode' },
  // Deep → Extreme boundaries (layer 15→16)
  { biomeA: 'magma_shelf',     biomeB: 'primordial_mantle', mode: 'erode' },
  { biomeA: 'crystal_geode',   biomeB: 'pressure_dome',  mode: 'blend' },
  { biomeA: 'obsidian_rift',   biomeB: 'tectonic_scar',  mode: 'erode' },
]
