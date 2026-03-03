import type { CompanionDefinition, CompanionState } from '../../data/companions'
import { COMPANION_CATALOGUE } from '../../data/companions'
import type { RelicStatEffect } from '../../data/relics'

/**
 * CompanionManager handles active companion effects, in-run temporary upgrades,
 * and the evolution upgrade system. (DD-V2-067)
 */
export class CompanionManager {
  private companion: CompanionDefinition | null = null
  private state: CompanionState | null = null
  /** Temporary in-run stage bonus (from mine event finds). Resets on run end. */
  private tempStageBonus = 0

  /** Initialize with the companion selected in PreDiveScreen. */
  setCompanion(companionId: string | null, states: CompanionState[]): void {
    if (!companionId) { this.companion = null; this.state = null; return }
    const def = COMPANION_CATALOGUE.find(c => c.id === companionId) ?? null
    const state = states.find(s => s.companionId === companionId) ?? null
    this.companion = def
    this.state = state
    this.tempStageBonus = 0
  }

  /** Apply a temporary in-run stage upgrade (from a mine event). Max stage cap at 2. */
  applyTemporaryUpgrade(): void {
    if (!this.state) return
    const effectiveStage = Math.min(2, this.state.currentStage + this.tempStageBonus)
    if (effectiveStage < 2) this.tempStageBonus++
  }

  /** Get the effective evolution stage this run (capped at 2). */
  getEffectiveStage(): number {
    if (!this.state) return 0
    return Math.min(2, this.state.currentStage + this.tempStageBonus)
  }

  /** Get the primary affinity effect for this companion at its effective stage. */
  getPrimaryEffect(): RelicStatEffect | null {
    if (!this.companion || !this.state) return null
    const stage = this.companion.evolutionPath[this.getEffectiveStage()]
    return {
      effectId: this.companion.effectId,
      description: `${this.companion.name} (${this.companion.affinity})`,
      magnitude: stage.affinityMagnitude,
    }
  }

  /** Get optional secondary effect for this companion at effective stage, if any. */
  getSecondaryEffect(): RelicStatEffect | null {
    if (!this.companion || !this.state) return null
    const stage = this.companion.evolutionPath[this.getEffectiveStage()]
    if (!stage.secondaryEffect) return null
    return {
      effectId: stage.secondaryEffect.effectId,
      description: stage.secondaryEffect.description,
      magnitude: stage.secondaryEffect.magnitude,
    }
  }

  /** Get the companion definition. */
  getCompanionDef(): CompanionDefinition | null { return this.companion }

  /** Get the companion state. */
  getState(): CompanionState | null { return this.state }

  /**
   * Check if a companion can be evolved to the next stage.
   * Returns true if shard cost and mastered facts threshold are both met.
   */
  static canEvolve(state: CompanionState, masteredFactsCount: number, availableShards: number): boolean {
    const def = COMPANION_CATALOGUE.find(c => c.id === state.companionId)
    if (!def) return false
    const nextStage = state.currentStage + 1
    if (nextStage > 2) return false
    const evolution = def.evolutionPath[nextStage]
    return availableShards >= evolution.shardsRequired && masteredFactsCount >= evolution.masteredFactsRequired
  }

  /**
   * Perform evolution upgrade. Mutates state. Returns shard cost.
   * Caller must deduct shards from inventory.
   */
  static evolve(state: CompanionState): { newStage: number; shardsSpent: number } {
    const def = COMPANION_CATALOGUE.find(c => c.id === state.companionId)
    if (!def || state.currentStage >= 2) throw new Error('Cannot evolve companion')
    const nextStage = state.currentStage + 1
    const cost = def.evolutionPath[nextStage].shardsRequired
    state.currentStage = nextStage
    return { newStage: nextStage, shardsSpent: cost }
  }
}
