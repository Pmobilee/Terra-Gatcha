/** All tunable game balance numbers. Change here, affects everything. */
export const BALANCE = {
  // === OXYGEN ===
  STARTING_OXYGEN_TANKS: 3,           // Player starts with 3 tanks per day
  OXYGEN_PER_TANK: 100,               // Each tank = 100 oxygen points
  OXYGEN_COST_MINE_DIRT: 1,
  OXYGEN_COST_MINE_SOFT_ROCK: 2,
  OXYGEN_COST_MINE_STONE: 3,
  OXYGEN_COST_MINE_HARD_ROCK: 5,
  OXYGEN_COST_MOVE: 1,                // Moving through empty space
  OXYGEN_COST_QUIZ_ATTEMPT: 5,        // Each quiz gate attempt
  OXYGEN_CACHE_RESTORE: 25,           // Oxygen from mining an oxygen cache
  OXYGEN_LAYER_BONUS: 15,             // Oxygen recovered on layer descent

  // === MINE GRID ===
  MINE_WIDTH: 20,                     // Blocks wide per layer
  MINE_LAYER_HEIGHT: 40,              // Blocks tall per layer
  MINE_TOTAL_LAYERS: 1,              // MVP: single layer
  VIEWPORT_TILES_X: 11,              // Visible tiles horizontally (odd = centered)
  VIEWPORT_TILES_Y: 15,              // Visible tiles vertically
  TILE_SIZE: 32,                      // Pixels per tile

  // === BLOCK HARDNESS ===
  HARDNESS_DIRT: 1,
  HARDNESS_SOFT_ROCK: 2,
  HARDNESS_STONE: 3,
  HARDNESS_HARD_ROCK: 5,
  HARDNESS_MINERAL_NODE: 3,
  HARDNESS_ARTIFACT_NODE: 4,
  HARDNESS_QUIZ_GATE: 1,             // 1 tap to interact, quiz handles the rest

  // === NODE DENSITY (per layer, approximate) ===
  DENSITY_MINERAL_NODES: 18,
  DENSITY_ARTIFACT_NODES: 4,
  DENSITY_OXYGEN_CACHES: 2,
  DENSITY_QUIZ_GATES: 2,
  DENSITY_UPGRADE_CRATES: 1,
  DENSITY_EMPTY_POCKETS: 3,          // Small pre-cleared areas
  DENSITY_UNBREAKABLE_RATIO: 0.05,   // 5% of blocks are unbreakable walls

  // === INVENTORY ===
  STARTING_INVENTORY_SLOTS: 6,
  DUST_STACK_SIZE: 50,
  SHARD_STACK_SIZE: 20,
  CRYSTAL_STACK_SIZE: 5,

  // === ARTIFACT DROP RATES ===
  ARTIFACT_RARITY_WEIGHTS: {
    common: 60,
    uncommon: 25,
    rare: 10,
    epic: 4,
    legendary: 0.9,
    mythic: 0.1,
  },

  // === MINERAL DROP AMOUNTS ===
  MINERAL_DROP_MIN: 5,               // Min dust from a mineral node
  MINERAL_DROP_MAX: 15,              // Max dust from a mineral node

  // === QUIZ ===
  QUIZ_DISTRACTORS_SHOWN: 3,         // 3 wrong + 1 correct = 4 choices
  QUIZ_GATE_MAX_FAILURES: 2,
  QUIZ_GATE_FAILURE_OXYGEN_COST: 10, // Extra oxygen penalty per wrong answer

  // === SM-2 DEFAULTS ===
  SM2_INITIAL_EASE: 2.5,
  SM2_MIN_EASE: 1.3,

  // === VISIBILITY ===
  FOG_REVEAL_RADIUS: 3,              // Blocks visible around player
  SCANNER_BASE_RADIUS: 1,            // Scanner reveals special blocks at this range
} as const
