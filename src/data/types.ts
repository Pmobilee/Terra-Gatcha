// ============================================================
// CONTENT TYPES
// ============================================================

/** Content type - extensible for language learning */
export type ContentType = 'fact' | 'vocabulary' | 'grammar' | 'phrase'

/** Age rating for content filtering */
export type AgeRating = 'kid' | 'teen' | 'adult'

/** Artifact rarity tier */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

/** A single learnable fact/word in the database */
export interface Fact {
  id: string
  type: ContentType

  // Core content
  statement: string           // Clear, concise (Anki-optimized)
  wowFactor?: string          // Mind-blowing framing (shown on reveal)
  explanation: string         // Why it's true / context
  giaiComment?: string        // GIAI's snarky ingestion comment

  // Quiz
  quizQuestion: string
  correctAnswer: string
  distractors: string[]       // 8-25 plausible wrong answers

  // Classification
  category: string[]          // Hierarchical: ["Language", "Japanese", "N3"]
  rarity: Rarity
  difficulty: number          // 1-5
  funScore: number            // 1-10
  ageRating: AgeRating

  // Sourcing
  sourceName?: string

  // Language-specific (optional)
  language?: string           // e.g., "ja"
  pronunciation?: string      // Reading/IPA
  exampleSentence?: string

  // Media (future)
  imageUrl?: string
  mnemonic?: string
}

// ============================================================
// SM-2 SPACED REPETITION
// ============================================================

/** SM-2 review state for a single fact */
export interface ReviewState {
  factId: string
  easeFactor: number          // Starts 2.5, min 1.3
  interval: number            // Days until next review
  repetitions: number         // Consecutive correct answers
  nextReviewAt: number        // Unix timestamp (ms)
  lastReviewAt: number        // Unix timestamp (ms)
  quality: number             // Last response quality (0-5)
}

// ============================================================
// MINE / RUN TYPES
// ============================================================

/** Block types in the mine grid */
export enum BlockType {
  Empty = 0,
  Dirt = 1,
  SoftRock = 2,
  Stone = 3,
  HardRock = 4,
  MineralNode = 10,
  ArtifactNode = 11,
  OxygenCache = 12,
  UpgradeCrate = 13,
  QuizGate = 14,
  Unbreakable = 99,
}

/** A single cell in the mine grid */
export interface MineCell {
  type: BlockType
  hardness: number            // Taps remaining to break
  maxHardness: number         // Original hardness
  revealed: boolean           // Visible to player?
  content?: MineCellContent   // What's inside (if special block)
}

/** Content inside a special block */
export interface MineCellContent {
  mineralType?: MineralTier
  mineralAmount?: number
  artifactRarity?: Rarity
  factId?: string             // Which fact this artifact contains
  oxygenAmount?: number
}

/** Mineral currency tiers */
export type MineralTier = 'dust' | 'shard' | 'crystal' | 'coreFragment' | 'primordialEssence'

// ============================================================
// INVENTORY
// ============================================================

/** A single inventory slot (MVP: simple slots, not Tetris) */
export interface InventorySlot {
  type: 'mineral' | 'artifact' | 'fossil' | 'empty'
  mineralTier?: MineralTier
  mineralAmount?: number      // Stack count
  artifactRarity?: Rarity
  factId?: string
}

// ============================================================
// PLAYER / SAVE STATE
// ============================================================

/** Full player save data */
export interface PlayerSave {
  version: number             // Save format version (for migrations)
  playerId: string
  ageRating: AgeRating
  createdAt: number
  lastPlayedAt: number

  // Resources
  oxygen: number              // Current stored oxygen tanks
  minerals: Record<MineralTier, number>

  // Knowledge
  learnedFacts: string[]      // Fact IDs the player has ingested
  reviewStates: ReviewState[] // SM-2 state per fact
  soldFacts: string[]         // Fact IDs sold (never show again)

  // Stats
  stats: PlayerStats

  // Progression (future: pets, dome, etc.)
}

/** Player statistics */
export interface PlayerStats {
  totalBlocksMined: number
  totalDivesCompleted: number
  deepestLayerReached: number
  totalFactsLearned: number
  totalFactsSold: number
  totalQuizCorrect: number
  totalQuizWrong: number
  currentStreak: number       // Daily review streak
  bestStreak: number
}

// ============================================================
// RUN STATE (active dive, not persisted)
// ============================================================

/** State of the current active dive */
export interface RunState {
  seed: number                // RNG seed for reproducibility
  oxygen: number              // Current oxygen remaining
  maxOxygen: number           // Starting oxygen for this run
  depth: number               // Current y-position
  layer: number               // Current layer index (0-based)
  inventory: InventorySlot[]  // Current backpack contents
  inventorySlots: number      // Max inventory slots this run
  minerX: number              // Player grid position
  minerY: number
  grid: MineCell[][]          // The mine grid
  gridWidth: number
  gridHeight: number
  blocksMinedThisRun: number
  quizGatesPassed: number
  quizGatesFailed: number
  artifactsFound: string[]    // Fact IDs found this run
  isActive: boolean
}
