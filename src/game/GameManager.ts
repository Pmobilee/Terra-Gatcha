import Phaser from 'phaser'
import { get } from 'svelte/store'
import { BALANCE } from '../data/balance'
import type { Fact, InventorySlot } from '../data/types'
import {
  currentScreen,
  oxygenCurrent,
  oxygenMax,
  currentDepth,
  inventory,
  activeQuiz,
  activeFact,
  pendingArtifacts,
} from '../ui/stores/gameState'
import {
  playerSave,
  initPlayer,
  persistPlayer,
  addLearnedFact,
  sellFact,
  updateReviewState,
  addMinerals,
  recordDiveComplete,
  getDueReviews,
} from '../ui/stores/playerData'
import { getQuizChoices, selectQuestion } from '../services/quizService'
import type { OxygenState } from './systems/OxygenSystem'
import { BootScene } from './scenes/BootScene'
import { MineScene } from './scenes/MineScene'

/** All loaded facts, populated during boot */
let allFacts: Fact[] = []

/**
 * Singleton manager for the Phaser game instance.
 * Bridges Phaser events to Svelte stores and provides game lifecycle methods.
 */
export class GameManager {
  private static instance: GameManager
  private game: Phaser.Game | null = null
  private studyQueue: Fact[] = []
  private studyIndex = 0

  private constructor() {}

  /** Get or create the singleton instance */
  static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager()
    }
    return GameManager.instance
  }

  /** Set the loaded facts pool (called during boot) */
  setFacts(facts: Fact[]): void {
    allFacts = facts
  }

  /** Get all loaded facts */
  getFacts(): Fact[] {
    return allFacts
  }

  /** Boot the Phaser game engine and attach to DOM */
  boot(): void {
    if (this.game) {
      console.warn('GameManager: game already booted')
      return
    }

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: 'game-container',
      width: window.innerWidth,
      height: window.innerHeight,
      pixelArt: true,
      roundPixels: true,
      antialias: false,
      backgroundColor: '#1a1a2e',
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: [BootScene, MineScene],
      input: {
        activePointers: 3,
      },
    }

    this.game = new Phaser.Game(config)
    this.setupEventBridge()
  }

  /** Get the Phaser game instance */
  getGame(): Phaser.Game | null {
    return this.game
  }

  /** Destroy the game instance (cleanup) */
  destroy(): void {
    if (this.game) {
      this.game.events.removeAllListeners()
      this.game.destroy(true)
      this.game = null
    }
  }

  // =========================================================
  // Event Bridge: Phaser → Svelte stores
  // =========================================================

  /** Wire up all Phaser event listeners to update Svelte stores */
  private setupEventBridge(): void {
    if (!this.game) return

    const events = this.game.events

    events.on('mine-started', (data: { seed: number; oxygen: OxygenState; inventorySlots: number }) => {
      oxygenCurrent.set(data.oxygen.current)
      oxygenMax.set(data.oxygen.max)
      currentDepth.set(1)
      inventory.set(
        Array.from({ length: data.inventorySlots }, () => ({ type: 'empty' as const }))
      )
    })

    events.on('oxygen-changed', (state: OxygenState) => {
      oxygenCurrent.set(state.current)
      oxygenMax.set(state.max)
    })

    events.on('depth-changed', (depth: number) => {
      currentDepth.set(depth)
    })

    events.on('mineral-collected', (data: { mineralType?: string; mineralAmount?: number; addedToInventory: boolean }) => {
      // Update inventory display
      this.syncInventoryFromScene()
    })

    events.on('artifact-found', (data: { factId?: string; rarity?: string; addedToInventory: boolean }) => {
      this.syncInventoryFromScene()
    })

    events.on('oxygen-restored', () => {
      // Already handled by oxygen-changed
    })

    events.on('quiz-gate', (data: { factId?: string }) => {
      // Find the fact and show quiz
      const fact = allFacts.find(f => f.id === data.factId)
      if (fact) {
        const choices = getQuizChoices(fact)
        activeQuiz.set({ fact, choices })
        currentScreen.set('quiz')
      } else {
        // No fact found — just resume
        this.resumeQuiz(true)
      }
    })

    events.on('oxygen-depleted', () => {
      this.handleOxygenDepleted()
    })

    events.on('open-backpack', () => {
      this.syncInventoryFromScene()
      currentScreen.set('backpack')
    })

    events.on('run-complete', () => {
      // Handled by endDive
    })
  }

  /** Sync inventory from MineScene to Svelte store */
  private syncInventoryFromScene(): void {
    const scene = this.getMineScene()
    if (!scene) return
    // Access the inventory from surfaceRun (peek without ending)
    // We'll use a direct access approach
    const sceneAny = scene as unknown as { inventory: InventorySlot[] }
    if (sceneAny.inventory) {
      inventory.set([...sceneAny.inventory])
    }
  }

  /** Get active MineScene if running */
  private getMineScene(): MineScene | null {
    if (!this.game) return null
    const scene = this.game.scene.getScene('MineScene')
    return scene as MineScene | null
  }

  // =========================================================
  // Dive lifecycle
  // =========================================================

  /** Start a new dive with the given number of oxygen tanks */
  startDive(tanks: number): void {
    if (!this.game) return

    const save = get(playerSave)
    if (!save) return

    // Deduct oxygen tanks from save
    const actualTanks = Math.min(tanks, save.oxygen)
    playerSave.update(s => {
      if (!s) return s
      return { ...s, oxygen: s.oxygen - actualTanks }
    })
    persistPlayer()

    // Get fact IDs for mine generation
    const factIds = allFacts.map(f => f.id)

    // Start the MineScene
    this.game.scene.start('MineScene', {
      seed: Date.now() >>> 0,
      oxygenTanks: actualTanks,
      inventorySlots: BALANCE.STARTING_INVENTORY_SLOTS,
      facts: factIds,
    })

    currentScreen.set('mining')
  }

  /** End the current dive and process results */
  endDive(forced: boolean = false): void {
    const scene = this.getMineScene()
    if (!scene) {
      currentScreen.set('base')
      return
    }

    const results = scene.surfaceRun()

    // Process inventory: collect minerals, queue artifacts
    let totalDust = 0
    const artifactFactIds: string[] = []

    for (const slot of results.inventory) {
      if (slot.type === 'mineral' && slot.mineralAmount) {
        totalDust += slot.mineralAmount
      }
      if (slot.type === 'artifact' && slot.factId) {
        artifactFactIds.push(slot.factId)
      }
    }

    // If forced (oxygen depleted), lose 30% of inventory randomly
    if (forced) {
      const lossRatio = 0.3
      totalDust = Math.floor(totalDust * (1 - lossRatio))
      // Remove ~30% of artifacts
      const numToLose = Math.floor(artifactFactIds.length * lossRatio)
      for (let i = 0; i < numToLose; i++) {
        const idx = Math.floor(Math.random() * artifactFactIds.length)
        artifactFactIds.splice(idx, 1)
      }
    }

    // Add minerals to player save
    if (totalDust > 0) {
      addMinerals('dust', totalDust)
    }

    // Queue artifacts for review at base
    if (artifactFactIds.length > 0) {
      pendingArtifacts.update(existing => [...existing, ...artifactFactIds])
    }

    // Record dive stats
    recordDiveComplete(0, results.blocksMinedThisRun)

    // Stop the mine scene
    this.game?.scene.stop('MineScene')

    // Navigate to base
    currentScreen.set('base')
  }

  /** Handle oxygen depletion — forced surface */
  private handleOxygenDepleted(): void {
    this.endDive(true)
  }

  // =========================================================
  // Quiz handling
  // =========================================================

  /** Resume mining after a quiz gate answer */
  resumeQuiz(passed: boolean): void {
    activeQuiz.set(null)

    const scene = this.getMineScene()
    if (scene) {
      scene.resumeFromQuiz(passed)
      currentScreen.set('mining')
    } else {
      currentScreen.set('base')
    }
  }

  /** Handle a quiz answer during mining (gate mode) */
  handleQuizAnswer(correct: boolean): void {
    const quiz = get(activeQuiz)
    if (quiz) {
      updateReviewState(quiz.fact.id, correct)
    }
    this.resumeQuiz(correct)
  }

  // =========================================================
  // Study session
  // =========================================================

  /** Start a study session at base */
  startStudySession(): void {
    const save = get(playerSave)
    if (!save) return

    // Get due reviews
    const dueReviews = getDueReviews()

    // Build queue of facts to study
    this.studyQueue = []
    for (const review of dueReviews) {
      const fact = allFacts.find(f => f.id === review.factId)
      if (fact) this.studyQueue.push(fact)
    }

    // If nothing due, pick random learned facts (up to 5)
    if (this.studyQueue.length === 0 && save.learnedFacts.length > 0) {
      const shuffled = [...save.learnedFacts].sort(() => Math.random() - 0.5)
      for (const id of shuffled.slice(0, 5)) {
        const fact = allFacts.find(f => f.id === id)
        if (fact) this.studyQueue.push(fact)
      }
    }

    if (this.studyQueue.length === 0) return

    this.studyIndex = 0
    this.showNextStudyQuestion()
  }

  /** Show the next study question or end session */
  private showNextStudyQuestion(): void {
    if (this.studyIndex >= this.studyQueue.length || this.studyIndex >= 10) {
      // Session complete
      activeQuiz.set(null)
      currentScreen.set('base')
      return
    }

    const fact = this.studyQueue[this.studyIndex]
    const choices = getQuizChoices(fact)
    activeQuiz.set({ fact, choices })
    currentScreen.set('quiz')
  }

  /** Handle a study mode quiz answer */
  handleStudyAnswer(correct: boolean): void {
    const quiz = get(activeQuiz)
    if (quiz) {
      updateReviewState(quiz.fact.id, correct)
    }
    this.studyIndex++
    this.showNextStudyQuestion()
  }

  // =========================================================
  // Artifact review
  // =========================================================

  /** Start reviewing pending artifacts from last dive */
  reviewNextArtifact(): void {
    const pending = get(pendingArtifacts)
    if (pending.length === 0) {
      activeFact.set(null)
      currentScreen.set('base')
      return
    }

    const factId = pending[0]
    const fact = allFacts.find(f => f.id === factId)
    if (fact) {
      activeFact.set(fact)
      currentScreen.set('factReveal')
    } else {
      // Skip unknown fact
      pendingArtifacts.update(arr => arr.slice(1))
      this.reviewNextArtifact()
    }
  }

  /** Player chose to learn the current artifact fact */
  learnArtifact(): void {
    const fact = get(activeFact)
    if (fact) {
      addLearnedFact(fact.id)
      pendingArtifacts.update(arr => arr.filter(id => id !== fact.id))
    }
    activeFact.set(null)
    this.reviewNextArtifact()
  }

  /** Player chose to sell the current artifact fact */
  sellArtifact(): void {
    const fact = get(activeFact)
    if (fact) {
      // Sell value based on rarity
      const sellValues: Record<string, number> = {
        common: 5, uncommon: 10, rare: 20, epic: 40, legendary: 80, mythic: 150,
      }
      const reward = sellValues[fact.rarity] ?? 5
      addMinerals('dust', reward)
      pendingArtifacts.update(arr => arr.filter(id => id !== fact.id))
    }
    activeFact.set(null)
    this.reviewNextArtifact()
  }

  // =========================================================
  // Backpack handling
  // =========================================================

  /** Close backpack overlay and return to mining */
  closeBackpack(): void {
    currentScreen.set('mining')
  }

  /** Drop an item from the backpack during a dive */
  dropItem(index: number): void {
    const scene = this.getMineScene()
    if (!scene) return

    const sceneAny = scene as unknown as { inventory: InventorySlot[] }
    if (sceneAny.inventory && sceneAny.inventory[index]) {
      sceneAny.inventory[index] = { type: 'empty' }
      inventory.set([...sceneAny.inventory])
    }
  }

  // =========================================================
  // Navigation helpers
  // =========================================================

  /** Navigate to dive prep screen */
  goToDivePrep(): void {
    currentScreen.set('divePrepScreen')
  }

  /** Navigate back to base */
  goToBase(): void {
    currentScreen.set('base')
  }

  /** Navigate to main menu */
  goToMainMenu(): void {
    currentScreen.set('mainMenu')
  }
}
