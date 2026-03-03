import {
  RELIC_CATALOGUE,
  ARCHETYPE_SYNERGY_BONUSES,
  type RelicDefinition,
  type RelicArchetype,
} from '../../data/relics'

/**
 * Manages relic equipping, effect resolution, synergy calculation, and loot draws.
 * Max 3 relics per run. (DD-V2-068)
 */
export class RelicManager {
  private equipped: RelicDefinition[] = []
  private resolvedEffects: Map<string, number> = new Map()

  constructor(initialEquipped: RelicDefinition[] = []) {
    this.equipped = initialEquipped.slice(0, 3)
    this.recompute()
  }

  /**
   * Equip a relic. Returns false if at capacity or already equipped.
   *
   * @param relic - The relic definition to equip
   */
  equip(relic: RelicDefinition): boolean {
    if (this.equipped.length >= 3) return false
    if (this.equipped.find(r => r.id === relic.id)) return false
    this.equipped.push(relic)
    this.recompute()
    return true
  }

  /**
   * Unequip a relic by id.
   *
   * @param relicId - The id of the relic to remove
   */
  unequip(relicId: string): void {
    this.equipped = this.equipped.filter(r => r.id !== relicId)
    this.recompute()
  }

  /**
   * Get resolved value for an effectId. Returns 0 if not present.
   *
   * @param effectId - The effect identifier to look up
   */
  getEffect(effectId: string): number {
    return this.resolvedEffects.get(effectId) ?? 0
  }

  /**
   * Returns all equipped relic definitions.
   */
  getEquipped(): RelicDefinition[] {
    return [...this.equipped]
  }

  /**
   * Draw a random relic from catalogue filtered by tier (weighted).
   *
   * @param tier - Optional tier filter; if omitted draws from full catalogue
   * @param rng - Random number generator (defaults to Math.random)
   */
  static drawRelic(tier?: RelicDefinition['tier'], rng: () => number = Math.random): RelicDefinition {
    const pool = tier ? RELIC_CATALOGUE.filter(r => r.tier === tier) : RELIC_CATALOGUE
    const totalWeight = pool.reduce((sum, r) => sum + r.dropWeight, 0)
    let rand = rng() * totalWeight
    for (const relic of pool) {
      rand -= relic.dropWeight
      if (rand <= 0) return relic
    }
    return pool[pool.length - 1]
  }

  /**
   * Draw a relic appropriate for a layer depth. Deeper layers have higher tier chances.
   *
   * @param layer - Current layer number (1-based)
   * @param rng - Random number generator (defaults to Math.random)
   */
  static drawRelicForLayer(layer: number, rng: () => number = Math.random): RelicDefinition {
    const r = rng()
    if (layer <= 5) return RelicManager.drawRelic(r < 0.80 ? 'common' : 'rare', rng)
    if (layer <= 10) {
      if (r < 0.50) return RelicManager.drawRelic('common', rng)
      if (r < 0.90) return RelicManager.drawRelic('rare', rng)
      return RelicManager.drawRelic('legendary', rng)
    }
    if (layer <= 15) {
      if (r < 0.20) return RelicManager.drawRelic('common', rng)
      if (r < 0.70) return RelicManager.drawRelic('rare', rng)
      return RelicManager.drawRelic('legendary', rng)
    }
    return RelicManager.drawRelic(r < 0.30 ? 'rare' : 'legendary', rng)
  }

  private recompute(): void {
    this.resolvedEffects.clear()

    // Accumulate effects from all equipped relics
    for (const relic of this.equipped) {
      for (const effect of relic.effects) {
        this.resolvedEffects.set(
          effect.effectId,
          (this.resolvedEffects.get(effect.effectId) ?? 0) + effect.magnitude,
        )
      }
    }

    // Count archetype frequency
    const archetypeCounts = new Map<RelicArchetype, number>()
    for (const relic of this.equipped) {
      archetypeCounts.set(relic.archetype, (archetypeCounts.get(relic.archetype) ?? 0) + 1)
    }

    // Apply archetype synergy bonuses where threshold is met
    for (const synergy of ARCHETYPE_SYNERGY_BONUSES) {
      const count = archetypeCounts.get(synergy.archetype) ?? 0
      if (count >= synergy.threshold) {
        for (const effect of synergy.effects) {
          this.resolvedEffects.set(
            effect.effectId,
            (this.resolvedEffects.get(effect.effectId) ?? 0) + effect.magnitude,
          )
        }
      }
    }
  }
}
