import type { Fact } from '../data/types';
import type { FactDomain, CardType } from '../data/card-types';
import { pickWeightedType } from './cardTypeAllocator';

/** Top-level category string → FactDomain mapping */
const CATEGORY_TO_DOMAIN: Record<string, FactDomain> = {
  'Language': 'language',
  'General Knowledge': 'general_knowledge',
  'Natural Sciences': 'natural_sciences',
  'Space & Astronomy': 'space_astronomy',
  'Geography': 'geography',
  'History': 'history',
  'Mythology & Folklore': 'mythology_folklore',
  'Animals & Wildlife': 'animals_wildlife',
  'Human Body & Health': 'human_body_health',
  'Food & World Cuisine': 'food_cuisine',
  'Art & Architecture': 'art_architecture',
  // Legacy compatibility
  'Life Sciences': 'human_body_health',
  'Technology': 'general_knowledge',
  'Culture': 'art_architecture',
  'Mathematics': 'general_knowledge',
  'Math': 'general_knowledge',
  'Science': 'natural_sciences',
  'Arts': 'art_architecture',
  'Medicine': 'human_body_health',
  'Health': 'human_body_health',
};

const DEFAULT_DOMAIN: FactDomain = 'general_knowledge';

/**
 * Resolves a Fact's knowledge domain from its category hierarchy.
 *
 * Checks `fact.category[0]` (primary top-level category), then `fact.categoryL1`,
 * then falls back to `general_knowledge`.
 *
 * @param fact - The fact to resolve a domain for.
 * @returns The resolved FactDomain.
 */
export function resolveDomain(fact: Fact): FactDomain {
  // Try primary category first
  const primary = fact.category[0];
  if (primary && CATEGORY_TO_DOMAIN[primary]) {
    return CATEGORY_TO_DOMAIN[primary];
  }

  // Try categoryL1 if present
  if (fact.categoryL1 && CATEGORY_TO_DOMAIN[fact.categoryL1]) {
    return CATEGORY_TO_DOMAIN[fact.categoryL1];
  }

  // Try all categories in the hierarchy
  for (const cat of fact.category) {
    if (CATEGORY_TO_DOMAIN[cat]) {
      return CATEGORY_TO_DOMAIN[cat];
    }
  }

  return DEFAULT_DOMAIN;
}

/**
 * Legacy helper retained for compatibility.
 * Card type is no longer derived from domain; we return a deterministic weighted type.
 */
export function resolveCardType(domain: FactDomain): CardType {
  return pickWeightedType(`domain:${domain}`);
}
