/**
 * Bridge between game flow (screen routing) and combat systems (turns, decks, enemies).
 * Provides Svelte stores and handler functions for CardApp.svelte.
 */

import { writable, get } from 'svelte/store'
import type { TurnState } from './turnManager'
import { startEncounter, playCardAction, skipCard, endPlayerTurn } from './turnManager'
import { buildRunPool } from './runPoolBuilder'
import { createDeck } from './deckManager'
import { createEnemy } from './enemyManager'
import { ENEMY_TEMPLATES } from '../data/enemies'
import { activeRunState, onEncounterComplete } from './gameFlowController'
import { getBossForFloor, pickCombatEnemy, isBossFloor } from './floorManager'
import type { CardRunState, PassiveEffect } from '../data/card-types'
import { recordCardPlay } from './runManager'
import { updateReviewState } from '../ui/stores/playerData'
import { TIER3_PASSIVE_VALUE } from '../data/balance'
import type { CombatScene } from '../game/scenes/CombatScene'

/** Lazy getter for the CombatScene via CardGameManager. */
function getCombatScene(): CombatScene | null {
  try {
    const reg = globalThis as Record<symbol, unknown>
    const sym = Symbol.for('terra:cardGameManager')
    const mgr = reg[sym] as { getCombatScene(): CombatScene | null; startCombat(): void } | undefined
    return mgr?.getCombatScene() ?? null
  } catch {
    return null
  }
}

/** Start the CombatScene via CardGameManager. */
function ensureCombatStarted(): void {
  try {
    const reg = globalThis as Record<symbol, unknown>
    const sym = Symbol.for('terra:cardGameManager')
    const mgr = reg[sym] as { startCombat(): void } | undefined
    mgr?.startCombat()
  } catch {
    // ignore
  }
}

// ============================================================
// Stores
// ============================================================

/** The active turn state for the current encounter. Null when not in combat. */
export const activeTurnState = writable<TurnState | null>(null)

/** The deck state for the current run. Persists across encounters within a run. */
let activeDeck: CardRunState | null = null

// ============================================================
// Encounter lifecycle
// ============================================================

/**
 * Start an encounter for the current room.
 * Called by CardApp when entering a combat screen.
 *
 * @param enemyId — specific enemy template ID, or undefined for auto-pick
 */
export function startEncounterForRoom(enemyId?: string): void {
  const run = get(activeRunState)
  if (!run) {
    console.warn('[encounterBridge] No active run state')
    return
  }

  // Build deck on first encounter of the run
  if (!activeDeck) {
    // No saved review states yet — pass empty array (all cards are tier 1)
    const pool = buildRunPool(run.primaryDomain, run.secondaryDomain, [])
    activeDeck = createDeck(pool)
  }

  // Determine enemy
  let templateId: string
  if (enemyId) {
    templateId = enemyId
  } else if (isBossFloor(run.floor.currentFloor)) {
    templateId = getBossForFloor(run.floor.currentFloor) ?? pickCombatEnemy(run.floor.currentFloor)
  } else {
    templateId = pickCombatEnemy(run.floor.currentFloor)
  }

  const template = ENEMY_TEMPLATES.find(t => t.id === templateId)
  if (!template) {
    console.error(`[encounterBridge] Enemy template not found: ${templateId}`)
    return
  }

  const enemy = createEnemy(template, run.floor.currentFloor)

  // Start the encounter with the shared deck
  const turnState = startEncounter(activeDeck, enemy, run.playerHp)

  // Extract Tier 3 cards as passive effects (they don't belong in the hand)
  const tier3InDraw = activeDeck.drawPile.filter(c => c.tier === 3)
  const tier3InHand = activeDeck.hand.filter(c => c.tier === 3)
  const allTier3 = [...tier3InDraw, ...tier3InHand]

  if (allTier3.length > 0) {
    // Remove Tier 3 from draw pile and hand
    activeDeck.drawPile = activeDeck.drawPile.filter(c => c.tier !== 3)
    activeDeck.hand = activeDeck.hand.filter(c => c.tier !== 3)

    // Convert to passive effects
    const passives: PassiveEffect[] = allTier3.map(c => ({
      sourceFactId: c.factId,
      cardType: c.cardType,
      domain: c.domain,
      value: TIER3_PASSIVE_VALUE[c.cardType] ?? 1,
    }))

    turnState.activePassives = passives

    // Draw replacement cards for any removed from hand
    if (tier3InHand.length > 0 && activeDeck.drawPile.length > 0) {
      const toDraw = Math.min(tier3InHand.length, activeDeck.drawPile.length)
      for (let i = 0; i < toDraw; i++) {
        const drawn = activeDeck.drawPile.pop()
        if (drawn) activeDeck.hand.push(drawn)
      }
    }
  }

  activeTurnState.set(turnState)

  // Ensure CombatScene is running, then push display data
  ensureCombatStarted()

  // The scene may need a frame to run create(). Defer the display update.
  const pushDisplayData = () => {
    const scene = getCombatScene()
    if (!scene) return
    scene.setEnemy(
      enemy.template.name,
      enemy.template.category,
      enemy.currentHP,
      enemy.maxHP,
    )
    scene.setEnemyIntent(
      enemy.nextIntent.telegraph,
      enemy.nextIntent.value > 0 ? enemy.nextIntent.value : undefined,
    )
    scene.updatePlayerHP(run.playerHp, run.playerMaxHp, false)
    scene.setFloorInfo(run.floor.currentFloor, run.floor.currentEncounter, run.floor.encountersPerFloor)
  }

  // Check if scene is already created (has game objects)
  const scene = getCombatScene()
  if (scene && scene.scene.isActive()) {
    pushDisplayData()
  } else {
    // Wait for the scene to finish creating
    setTimeout(pushDisplayData, 100)
  }
}

// ============================================================
// Card play handlers (called from CardApp → CardCombatOverlay)
// ============================================================

/**
 * Handle a card being played (quiz answered).
 * Called by CardCombatOverlay via CardApp.
 */
export function handlePlayCard(cardId: string, correct: boolean, speedBonus: boolean): void {
  const ts = get(activeTurnState)
  if (!ts) return

  // Resolve factId before the card is moved from hand
  const cardInHand = ts.deck.hand.find(c => c.id === cardId)
  const factId = cardInHand?.factId

  const result = playCardAction(ts, cardId, correct, speedBonus)

  // Record in run stats
  const run = get(activeRunState)
  if (run) {
    recordCardPlay(run, correct, result.comboCount)
    // Sync player HP from combat state to run state
    run.playerHp = result.turnState.playerState.hp
    activeRunState.set(run)
  }

  // Update SM-2 review state for this fact
  if (factId) {
    updateReviewState(factId, correct)
  }

  // Force store update (turnState is mutated in place)
  activeTurnState.set({ ...result.turnState })

  // Update CombatScene display
  const scene = getCombatScene()
  if (scene) {
    scene.updateEnemyHP(result.turnState.enemy.currentHP, true)
    scene.updatePlayerHP(result.turnState.playerState.hp, result.turnState.playerState.maxHP, true)
    if (correct && result.effect.damageDealt > 0) {
      scene.playEnemyHitReaction()
      scene.playScreenFlash(0.15)
      scene.burstParticles(12, scene.scale.width / 2, scene.scale.height * 0.11, 0xFFD700)
    }
    if (result.enemyDefeated) {
      scene.playEnemyDeathAnimation()
    }
  }

  // Check for victory
  if (result.enemyDefeated) {
    // Small delay so animations can play
    setTimeout(() => {
      activeTurnState.set(null)
      onEncounterComplete('victory')
    }, 600)
  }
}

/**
 * Handle a card being skipped.
 */
export function handleSkipCard(cardId: string): void {
  const ts = get(activeTurnState)
  if (!ts) return

  skipCard(ts, cardId)
  activeTurnState.set({ ...ts })
}

/**
 * Handle end of player turn — execute enemy turn.
 */
export function handleEndTurn(): void {
  const ts = get(activeTurnState)
  if (!ts) return

  const result = endPlayerTurn(ts)

  // Sync player HP
  const run = get(activeRunState)
  if (run) {
    run.playerHp = result.turnState.playerState.hp
    activeRunState.set(run)
  }

  // Force store update
  activeTurnState.set({ ...result.turnState })

  // Update CombatScene display
  const scene = getCombatScene()
  if (scene) {
    if (result.damageDealt > 0) {
      scene.playEnemyAttackAnimation()
      scene.playPlayerDamageFlash()
    }
    scene.updatePlayerHP(result.turnState.playerState.hp, result.turnState.playerState.maxHP, true)
    scene.updateEnemyHP(result.turnState.enemy.currentHP, true)
    scene.setEnemyIntent(
      result.turnState.enemy.nextIntent.telegraph,
      result.turnState.enemy.nextIntent.value > 0 ? result.turnState.enemy.nextIntent.value : undefined,
    )
  }

  // Check for defeat
  if (result.playerDefeated) {
    setTimeout(() => {
      activeTurnState.set(null)
      activeDeck = null // Clear deck on defeat
      onEncounterComplete('defeat')
    }, 600)
  }
}

/**
 * Reset the encounter bridge state (call when run ends).
 */
export function resetEncounterBridge(): void {
  activeTurnState.set(null)
  activeDeck = null
}
