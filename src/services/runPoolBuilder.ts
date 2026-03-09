import type { Fact, ReviewState } from '../data/types';
import type { Card, CardType, FactDomain } from '../data/card-types';
import { factsDB } from './factsDB';
import { createCard, resetCardIdCounter } from './cardFactory';
import { DEFAULT_POOL_SIZE, POOL_PRIMARY_PCT, POOL_SECONDARY_PCT } from '../data/balance';
import { MECHANICS_BY_TYPE, type MechanicDefinition } from '../data/mechanics';
import { assignTypesToCards } from './cardTypeAllocator';

const DOMAIN_TO_CATEGORY: Record<FactDomain, string[]> = {
  general_knowledge: ['General Knowledge', 'Technology', 'Mathematics', 'Math'],
  natural_sciences: ['Natural Sciences', 'Science'],
  space_astronomy: ['Space & Astronomy'],
  history: ['History'],
  geography: ['Geography'],
  language: ['Language'],
  mythology_folklore: ['Mythology & Folklore'],
  animals_wildlife: ['Animals & Wildlife'],
  human_body_health: ['Human Body & Health', 'Life Sciences', 'Medicine', 'Health'],
  food_cuisine: ['Food & World Cuisine'],
  art_architecture: ['Art & Architecture', 'Culture', 'Arts'],
  // Legacy IDs kept for save compatibility.
  science: ['Natural Sciences', 'Science'],
  math: ['General Knowledge', 'Mathematics', 'Math'],
  arts: ['Art & Architecture', 'Culture', 'Arts'],
  medicine: ['Human Body & Health', 'Life Sciences', 'Medicine', 'Health'],
  technology: ['General Knowledge', 'Technology'],
};

const FALLBACK_DOMAIN_ORDER: FactDomain[] = [
  'general_knowledge',
  'natural_sciences',
  'history',
  'geography',
  'language',
];

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickRandomSubset<T>(items: T[], count: number): T[] {
  return shuffle([...items]).slice(0, Math.max(0, count));
}

function buildProbeOrdering(cards: Card[], domain: FactDomain): Card[] {
  const domainCards = cards.filter((card) => card.domain === domain);
  if (domainCards.length === 0) return [];

  const easy: Card[] = [];
  const medium: Card[] = [];
  const hard: Card[] = [];

  for (const card of domainCards) {
    const fact = factsDB.getById(card.factId);
    const difficulty = fact?.difficulty ?? 3;
    if (difficulty <= 2) easy.push(card);
    else if (difficulty >= 4) hard.push(card);
    else medium.push(card);
  }

  const probe = [
    ...pickRandomSubset(easy, 3),
    ...pickRandomSubset(medium, 3),
    ...pickRandomSubset(hard, 3),
  ];

  const used = new Set(probe.map((card) => card.id));
  const wildcardCandidates = domainCards.filter((card) => !used.has(card.id));
  const wildcard = pickRandomSubset(wildcardCandidates, 1);
  return [...probe, ...wildcard].slice(0, 10);
}

function pickMechanic(
  cardType: CardType,
  mechanicCounts: Map<string, number>,
): MechanicDefinition {
  const pool = MECHANICS_BY_TYPE[cardType];
  const eligible = pool.filter((mechanic) => {
    if (mechanic.maxPerPool <= 0) return true;
    return (mechanicCounts.get(mechanic.id) ?? 0) < mechanic.maxPerPool;
  });

  const source = eligible.length > 0 ? eligible : pool;
  const selected = source[Math.floor(Math.random() * source.length)];
  mechanicCounts.set(selected.id, (mechanicCounts.get(selected.id) ?? 0) + 1);
  return selected;
}

function applyMechanics(cards: Card[]): Card[] {
  const mechanicCounts = new Map<string, number>();
  return cards.map((card) => {
    const mechanic = pickMechanic(card.cardType, mechanicCounts);
    return {
      ...card,
      mechanicId: mechanic.id,
      mechanicName: mechanic.name,
      apCost: mechanic.apCost,
      baseEffectValue: mechanic.baseValue,
      originalBaseEffectValue: mechanic.baseValue,
    };
  });
}

export function buildRunPool(
  primaryDomain: FactDomain,
  secondaryDomain: FactDomain,
  allReviewStates: ReviewState[],
  options?: { poolSize?: number; probeRunNumber?: number; probeDomain?: FactDomain },
): Card[] {
  const poolSize = options?.poolSize ?? DEFAULT_POOL_SIZE;
  resetCardIdCounter();

  const primaryTarget = Math.round(poolSize * POOL_PRIMARY_PCT);
  const secondaryTarget = Math.round(poolSize * POOL_SECONDARY_PCT);
  const reviewTarget = poolSize - primaryTarget - secondaryTarget;

  const stateByFactId = new Map<string, ReviewState>();
  for (const state of allReviewStates) stateByFactId.set(state.factId, state);

  function normalizeDomain(domain: FactDomain): FactDomain {
    if (DOMAIN_TO_CATEGORY[domain]) return domain;
    return 'general_knowledge';
  }

  function collectDomainFacts(domain: FactDomain, limit: number, excludedFactIds: Set<string>): Fact[] {
    const normalized = normalizeDomain(domain);
    const categories = DOMAIN_TO_CATEGORY[normalized] ?? DOMAIN_TO_CATEGORY.general_knowledge;
    const selected: Fact[] = [];
    const addedIds = new Set<string>();

    const pushUnique = (fact: Fact) => {
      if (excludedFactIds.has(fact.id) || addedIds.has(fact.id)) return;
      selected.push(fact);
      addedIds.add(fact.id);
    };

    for (const fact of factsDB.getByCategory(categories, limit + 40)) {
      if (selected.length >= limit) break;
      pushUnique(fact);
    }

    if (selected.length >= limit) return selected.slice(0, limit);

    const fallbackDomains = FALLBACK_DOMAIN_ORDER
      .filter((candidate) => candidate !== normalized)
      .map((candidate) => DOMAIN_TO_CATEGORY[candidate] ?? []);

    for (const fallbackCategories of fallbackDomains) {
      const needed = limit - selected.length;
      if (needed <= 0) break;
      for (const fact of factsDB.getByCategory(fallbackCategories, needed + 30)) {
        if (selected.length >= limit) break;
        pushUnique(fact);
      }
    }

    return selected.slice(0, limit);
  }

  function factsToCards(facts: Fact[]): Card[] {
    return facts.map((fact) => createCard(fact, stateByFactId.get(fact.id)));
  }

  const primaryFacts = collectDomainFacts(primaryDomain, primaryTarget, new Set<string>());
  const usedFactIds = new Set(primaryFacts.map((fact) => fact.id));
  const primaryCards = factsToCards(primaryFacts);

  const secondaryFacts = collectDomainFacts(secondaryDomain, secondaryTarget, usedFactIds)
    .slice(0, secondaryTarget);
  for (const fact of secondaryFacts) usedFactIds.add(fact.id);
  const secondaryCards = factsToCards(secondaryFacts);

  const reviewCandidates = allReviewStates
    .filter((state) => !usedFactIds.has(state.factId))
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt)
    .slice(0, reviewTarget + 20);

  const reviewCards: Card[] = [];
  for (const state of reviewCandidates) {
    if (reviewCards.length >= reviewTarget) break;
    const fact = factsDB.getById(state.factId);
    if (!fact || usedFactIds.has(fact.id)) continue;
    reviewCards.push(createCard(fact, state));
    usedFactIds.add(fact.id);
  }

  let pool = [...primaryCards, ...secondaryCards, ...reviewCards];

  if (pool.length < poolSize) {
    const shortage = poolSize - pool.length;
    const fillerFacts = factsDB.getRandom(shortage + 20)
      .filter((fact) => !usedFactIds.has(fact.id))
      .slice(0, shortage);
    pool.push(...factsToCards(fillerFacts));
  }

  pool = pool.slice(0, poolSize);
  pool = pool.filter((card) => card.tier !== '3');
  pool = assignTypesToCards(pool);
  pool = applyMechanics(pool);

  if (options?.probeRunNumber === 1) {
    const probeDomain = options.probeDomain ?? primaryDomain;
    const probe = buildProbeOrdering(pool, probeDomain);
    const probeIds = new Set(probe.map((card) => card.id));
    const remaining = shuffle(pool.filter((card) => !probeIds.has(card.id)));
    return [...probe, ...remaining];
  }

  return shuffle(pool);
}
