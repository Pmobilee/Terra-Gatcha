// === Card Effect Resolver ===
// Resolves the effect of a played card into concrete results.
// Does NOT apply effects — returns results for the turn manager to apply.
// NO Phaser, Svelte, or DOM imports.

import type { Card, CardType } from '../data/card-types';
import type { StatusEffect } from '../data/statusEffects';
import type { PlayerCombatState } from './playerCombatState';
import type { EnemyInstance } from '../data/enemies';
import { TIER_MULTIPLIER, COMBO_MULTIPLIERS } from '../data/balance';
import { isVulnerable } from '../data/statusEffects';

/** The result of resolving a card's effect. */
export interface CardEffectResult {
  /** The card type that was resolved. */
  effectType: CardType;
  /** Raw value before multipliers. */
  rawValue: number;
  /** Final value after all multipliers. */
  finalValue: number;
  /** Whether the target was hit (false if blocked). */
  targetHit: boolean;
  /** Damage dealt to the enemy (attack/wild). */
  damageDealt: number;
  /** Shield applied to the player. */
  shieldApplied: number;
  /** Healing applied to the player. */
  healApplied: number;
  /** Status effects to be applied. */
  statusesApplied: StatusEffect[];
  /** Extra cards to draw (utility). */
  extraCardsDrawn: number;
  /** Whether this card's damage would defeat the enemy. */
  enemyDefeated: boolean;
}

/**
 * Checks whether a card is blocked by the enemy's domain immunity.
 *
 * @param card - The card being played.
 * @param enemy - The target enemy.
 * @returns True if the card's domain matches the enemy's immuneDomain.
 */
export function isCardBlocked(card: Card, enemy: EnemyInstance): boolean {
  return enemy.template.immuneDomain != null && card.domain === enemy.template.immuneDomain;
}

/**
 * Resolves the full effect of a played card.
 *
 * Calculates the multiplier chain:
 *   baseEffectValue * TIER_MULTIPLIER[tier] * effectMultiplier * comboMult * speedBonus * (1 + buffNextCard/100)
 *
 * Does NOT modify player or enemy state — returns a result object
 * for the turn manager to apply.
 *
 * @param card - The card being played.
 * @param playerState - The player's current combat state (read-only peek).
 * @param enemy - The target enemy (read-only peek for HP/vulnerability check).
 * @param comboCount - Current combo count for combo multiplier lookup.
 * @param speedBonus - Speed bonus multiplier (1.0 if no bonus, 1.5 if earned).
 * @param buffNextCard - Percentage buff from a previous buff card (0 if none).
 * @param lastCardType - The type of the last card played (for wild cards).
 * @returns The resolved card effect result.
 */
export function resolveCardEffect(
  card: Card,
  playerState: PlayerCombatState,
  enemy: EnemyInstance,
  comboCount: number,
  speedBonus: number,
  buffNextCard: number,
  lastCardType?: CardType,
): CardEffectResult {
  const result: CardEffectResult = {
    effectType: card.cardType,
    rawValue: 0,
    finalValue: 0,
    targetHit: true,
    damageDealt: 0,
    shieldApplied: 0,
    healApplied: 0,
    statusesApplied: [],
    extraCardsDrawn: 0,
    enemyDefeated: false,
  };

  // Check immunity
  if (isCardBlocked(card, enemy)) {
    result.targetHit = false;
    return result;
  }

  // Determine effective card type (wild copies last, defaults to attack)
  let effectiveType: CardType = card.cardType;
  if (card.cardType === 'wild') {
    effectiveType = lastCardType ?? 'attack';
    result.effectType = effectiveType;
  }

  // Calculate raw value
  const tierMult = TIER_MULTIPLIER[card.tier] ?? 1.0;
  const rawValue = card.baseEffectValue * tierMult * card.effectMultiplier;
  result.rawValue = rawValue;

  // Combo multiplier (cap at array length - 1)
  const comboIndex = Math.min(comboCount, COMBO_MULTIPLIERS.length - 1);
  const comboMult = COMBO_MULTIPLIERS[comboIndex];

  // Full multiplier chain
  const buffMult = 1 + buffNextCard / 100;
  const finalValue = Math.round(rawValue * comboMult * speedBonus * buffMult);
  result.finalValue = finalValue;

  // Apply effect based on type
  switch (effectiveType) {
    case 'attack': {
      let damage = finalValue;
      if (isVulnerable(enemy.statusEffects)) {
        damage = Math.round(damage * 1.5);
      }
      result.damageDealt = damage;
      result.enemyDefeated = damage >= enemy.currentHP;
      break;
    }
    case 'shield': {
      result.shieldApplied = finalValue;
      break;
    }
    case 'heal': {
      result.healApplied = Math.min(finalValue, playerState.maxHP - playerState.hp);
      break;
    }
    case 'buff': {
      // Buff returns finalValue as percentage for next card
      // No status effect — the turn manager tracks buffNextCard
      result.finalValue = finalValue;
      break;
    }
    case 'debuff': {
      // Apply weakness (2 turns, floor(finalValue/2))
      const weaknessValue = Math.floor(finalValue / 2);
      if (weaknessValue > 0) {
        result.statusesApplied.push({
          type: 'weakness',
          value: weaknessValue,
          turnsRemaining: 2,
        });
      }
      // Also apply vulnerable if finalValue >= 5
      if (finalValue >= 5) {
        result.statusesApplied.push({
          type: 'vulnerable',
          value: 1,
          turnsRemaining: 2,
        });
      }
      break;
    }
    case 'regen': {
      // Regen status (3 turns, ceil(finalValue/3) per turn)
      const regenPerTurn = Math.ceil(finalValue / 3);
      if (regenPerTurn > 0) {
        result.statusesApplied.push({
          type: 'regen',
          value: regenPerTurn,
          turnsRemaining: 3,
        });
      }
      break;
    }
    case 'utility': {
      result.extraCardsDrawn = 1;
      break;
    }
    case 'wild': {
      // Should not reach here since we resolved wild above
      break;
    }
  }

  return result;
}
