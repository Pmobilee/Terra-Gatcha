/** Represents a single fact/knowledge card in the quiz system */
export interface FactCard {
  id: string
  category: string
  question: string
  correctAnswer: string
  distractors: string[]
  difficulty: number
  era: string
  /** SM-2 spaced repetition fields */
  easeFactor: number
  interval: number
  repetitions: number
  nextReview: number
}

/** Player save data */
export interface PlayerData {
  id: string
  name: string
  depth: number
  maxDepth: number
  minerals: number
  relicsFound: string[]
  factsLearned: string[]
  tools: ToolData[]
  stats: PlayerStats
  createdAt: number
  lastPlayedAt: number
}

/** Tool in the player's inventory */
export interface ToolData {
  id: string
  name: string
  type: 'pickaxe' | 'drill' | 'scanner' | 'bomb'
  level: number
  durability: number
  maxDurability: number
}

/** Player statistics */
export interface PlayerStats {
  totalBlocksMined: number
  totalQuizzesAnswered: number
  totalCorrectAnswers: number
  totalIncorrectAnswers: number
  currentStreak: number
  bestStreak: number
  playTimeSeconds: number
}

/** Game configuration constants */
export const GAME_CONFIG = {
  GRID_WIDTH: 12,
  GRID_HEIGHT: 20,
  MIN_CELL_SIZE: 24,
  MAX_CELL_SIZE: 64,
  QUIZ_DISTRACTOR_COUNT: 3,
  SM2_INITIAL_EASE: 2.5,
  SM2_MIN_EASE: 1.3,
} as const
