import { writable } from 'svelte/store'
import type { Fact, InventorySlot } from '../../data/types'

/** All top-level UI screens used by routing state. */
export type Screen =
  | 'mainMenu'
  | 'base'
  | 'divePrepScreen'
  | 'mining'
  | 'quiz'
  | 'factReveal'
  | 'backpack'
  | 'sacrifice'

export const currentScreen = writable<Screen>('mainMenu')

// In-mine state (updated by Phaser events)
export const oxygenCurrent = writable<number>(0)
export const oxygenMax = writable<number>(0)
export const currentDepth = writable<number>(0)
export const inventory = writable<InventorySlot[]>([])

// Quiz overlay state
export const activeQuiz = writable<{ fact: Fact; choices: string[] } | null>(null)

// Fact reveal state
export const activeFact = writable<Fact | null>(null)

// Pending artifacts to review at base (accumulated during dive)
export const pendingArtifacts = writable<string[]>([])
