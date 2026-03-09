import type { Fact } from '../data/types';
import type { FactDomain, CardType } from '../data/card-types';
import { pickWeightedType } from './cardTypeAllocator';

/** Top-level category string → FactDomain mapping */
const CATEGORY_TO_DOMAIN: Record<string, FactDomain> = {
  'Language':          'language',
  'Natural Sciences':  'science',
  'Life Sciences':     'medicine',
  'History':           'history',
  'Geography':         'geography',
  'Technology':        'technology',
  'Culture':           'arts',
  // Extended mappings for categoryL1 / sub-categories that may appear
  'Mathematics':       'math',
  'Math':              'math',
  'Science':           'science',
  'Arts':              'arts',
  'Medicine':          'medicine',
  'Health':            'medicine',
};

const DEFAULT_DOMAIN: FactDomain = 'science';

/**
 * Resolves a Fact's knowledge domain from its category hierarchy.
 *
 * Checks `fact.category[0]` (primary top-level category), then `fact.categoryL1`,
 * then falls back to 'science'.
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
