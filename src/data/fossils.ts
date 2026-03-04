/** All possible mechanical effect types a fossil companion can provide. */
export type CompanionEffectType =
  | 'mineral_rate'   // Chance to add +1 mineral when collecting a node
  | 'layer_oxygen'   // Restore N oxygen units on each layer descent
  | 'hazard_alert'   // Reveal hazard blocks within N tiles even through fog
  | 'max_oxygen'     // Increase max oxygen at dive start
  | 'magnet_range'   // Extend mineral_magnet radius by N tiles
  | 'reveal_exit'    // Reveal exit ladder location at dive start
  | 'instant_break'  // N% chance to instantly destroy any block in one hit
  | 'extra_slot'     // Add N extra inventory slots at dive start
  | 'hazard_resist'  // Reduce hazard O2 costs by N (stacks with tough_skin relic)
  | 'scout_drone'    // Reveal a random cluster of tiles at dive start

/** A typed mechanical effect carried by a revived fossil companion. */
export interface CompanionEffect {
  type: CompanionEffectType
  /** Numeric magnitude — e.g. 0.05 = 5%, 3 = +3 O2, 2 = +2 tiles, etc. */
  value: number
}

/** A single fossil species that can be collected and revived as a companion. */
export interface FossilSpecies {
  id: string
  name: string
  icon: string // emoji
  era: string
  description: string
  fragmentsNeeded: number // 3-8
  requiredFacts: number // facts learned to unlock revival
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
  /** Human-readable bonus description */
  companionBonus?: string
  /** Typed mechanical effect applied when this companion is active */
  companionEffect: CompanionEffect
  /** True for fossilized plant/crop species. Crops cannot be set as dive companions. */
  isCrop?: boolean
  /** Botanical/agricultural fact category tags for knowledge gating (used in Phase 16.2). */
  factCategories?: string[]
}

export const FOSSIL_SPECIES: FossilSpecies[] = [
  {
    id: 'trilobite',
    name: 'Trilobite',
    icon: '🦐',
    era: 'Paleozoic',
    description: 'An ancient arthropod that ruled the seas for 300 million years',
    fragmentsNeeded: 3,
    requiredFacts: 5,
    rarity: 'common',
    companionBonus: '+5% mineral find rate',
    companionEffect: { type: 'mineral_rate', value: 0.05 },
  },
  {
    id: 'ammonite',
    name: 'Ammonite',
    icon: '🐚',
    era: 'Mesozoic',
    description: 'A spiral-shelled cephalopod, cousin to the nautilus',
    fragmentsNeeded: 3,
    requiredFacts: 8,
    rarity: 'common',
    companionBonus: '+3 O2 per layer',
    companionEffect: { type: 'layer_oxygen', value: 3 },
  },
  {
    id: 'raptor',
    name: 'Velociraptor',
    icon: '🦖',
    era: 'Cretaceous',
    description: 'A feathered predator, smaller but smarter than the movies suggest',
    fragmentsNeeded: 5,
    requiredFacts: 15,
    rarity: 'uncommon',
    companionBonus: 'Alerts nearby hazards',
    companionEffect: { type: 'hazard_alert', value: 2 },
  },
  {
    id: 'mammoth',
    name: 'Woolly Mammoth',
    icon: '🦣',
    era: 'Pleistocene',
    description: 'A gentle giant that roamed the ice age tundra',
    fragmentsNeeded: 5,
    requiredFacts: 15,
    rarity: 'uncommon',
    companionBonus: '+10 max O2',
    companionEffect: { type: 'max_oxygen', value: 10 },
  },
  {
    id: 'megalodon',
    name: 'Megalodon',
    icon: '🦈',
    era: 'Cenozoic',
    description: 'A prehistoric shark that could swallow a car whole',
    fragmentsNeeded: 6,
    requiredFacts: 25,
    rarity: 'rare',
    companionBonus: '2x mineral magnet range',
    companionEffect: { type: 'magnet_range', value: 2 },
  },
  {
    id: 'pteranodon',
    name: 'Pteranodon',
    icon: '🦅',
    era: 'Cretaceous',
    description: 'A flying reptile with a 7-meter wingspan',
    fragmentsNeeded: 6,
    requiredFacts: 25,
    rarity: 'rare',
    companionBonus: 'Reveals exit location',
    companionEffect: { type: 'reveal_exit', value: 1 },
  },
  {
    id: 'trex',
    name: 'Tyrannosaurus Rex',
    icon: '🦕',
    era: 'Cretaceous',
    description: 'The king of the dinosaurs, with a bite force of 12,800 pounds',
    fragmentsNeeded: 8,
    requiredFacts: 40,
    rarity: 'legendary',
    companionBonus: 'Breaks blocks in 1 hit (10% chance)',
    companionEffect: { type: 'instant_break', value: 0.10 },
  },
  {
    id: 'dodo',
    name: 'Dodo',
    icon: '🐦',
    era: 'Holocene',
    description: 'A flightless bird driven to extinction by humans in 1681',
    fragmentsNeeded: 4,
    requiredFacts: 10,
    rarity: 'common',
    companionBonus: '+1 inventory slot',
    companionEffect: { type: 'extra_slot', value: 1 },
  },
  {
    id: 'sabertooth',
    name: 'Saber-toothed Cat',
    icon: '🐱',
    era: 'Pleistocene',
    description: 'A fearsome feline with 7-inch canine teeth',
    fragmentsNeeded: 5,
    requiredFacts: 20,
    rarity: 'uncommon',
    companionBonus: '-3 O2 per hazard',
    companionEffect: { type: 'hazard_resist', value: 3 },
  },
  {
    id: 'archaeopteryx',
    name: 'Archaeopteryx',
    icon: '🪶',
    era: 'Jurassic',
    description: 'The first known bird, bridging dinosaurs and modern avians',
    fragmentsNeeded: 7,
    requiredFacts: 30,
    rarity: 'rare',
    companionBonus: 'Scout drone on each dive',
    companionEffect: { type: 'scout_drone', value: 1 },
  },
  // ─── Crop Fossils (Phase 16.1) ────────────────────────────────
  {
    id: 'ancient_wheat',
    name: 'Ancient Wheat',
    icon: '🌾',
    era: 'Neolithic',
    description: 'Fossilized einkorn wheat, ancestor of every bread ever baked',
    fragmentsNeeded: 3,
    requiredFacts: 10,
    rarity: 'common',
    isCrop: true,
    factCategories: ['Life Sciences', 'History'],
    companionEffect: { type: 'mineral_rate', value: 0 },
  },
  {
    id: 'lotus_fossil',
    name: 'Sacred Lotus',
    icon: '🪷',
    era: 'Cretaceous',
    description: 'An 85-million-year-old lotus seed. Lotus seeds can stay viable for over 1,300 years.',
    fragmentsNeeded: 3,
    requiredFacts: 10,
    rarity: 'common',
    isCrop: true,
    factCategories: ['Life Sciences', 'Culture'],
    companionEffect: { type: 'mineral_rate', value: 0 },
  },
  {
    id: 'cave_mushroom',
    name: 'Primordial Mushroom',
    icon: '🍄',
    era: 'Carboniferous',
    description: 'A 350-million-year-old fungal spore. Fungi are more closely related to animals than plants.',
    fragmentsNeeded: 4,
    requiredFacts: 15,
    rarity: 'common',
    isCrop: true,
    factCategories: ['Life Sciences', 'Natural Sciences'],
    companionEffect: { type: 'mineral_rate', value: 0 },
  },
  {
    id: 'ancient_rice',
    name: 'Ancient Rice',
    icon: '🌾',
    era: 'Holocene',
    description: 'Rice domesticated ~9,000 years ago in the Yangtze River Delta. Half the world still eats it daily.',
    fragmentsNeeded: 4,
    requiredFacts: 20,
    rarity: 'uncommon',
    isCrop: true,
    factCategories: ['Life Sciences', 'History', 'Geography'],
    companionEffect: { type: 'mineral_rate', value: 0 },
  },
  {
    id: 'giant_fern',
    name: 'Giant Tree Fern',
    icon: '🌿',
    era: 'Carboniferous',
    description: 'Coal itself is fossilized Carboniferous fern forest. Every coal seam is a buried ancient jungle.',
    fragmentsNeeded: 5,
    requiredFacts: 20,
    rarity: 'uncommon',
    isCrop: true,
    factCategories: ['Natural Sciences', 'Life Sciences'],
    companionEffect: { type: 'mineral_rate', value: 0 },
  },
  {
    id: 'amber_orchid',
    name: 'Amber Orchid',
    icon: '🌸',
    era: 'Jurassic',
    description: 'Preserved in amber for 100 million years. Orchids are the most species-diverse plant family on Earth.',
    fragmentsNeeded: 5,
    requiredFacts: 25,
    rarity: 'uncommon',
    isCrop: true,
    factCategories: ['Life Sciences', 'Natural Sciences'],
    companionEffect: { type: 'mineral_rate', value: 0 },
  },
  {
    id: 'ancient_corn',
    name: 'Ancient Maize',
    icon: '🌽',
    era: 'Holocene',
    description: "Teosinte grass selectively bred into maize over 9,000 years — one of humanity's greatest agricultural achievements.",
    fragmentsNeeded: 6,
    requiredFacts: 35,
    rarity: 'rare',
    isCrop: true,
    factCategories: ['Life Sciences', 'History', 'Culture'],
    companionEffect: { type: 'mineral_rate', value: 0 },
  },
  {
    id: 'petrified_vine',
    name: 'Petrified Grapevine',
    icon: '🍇',
    era: 'Miocene',
    description: 'A 10-million-year-old grape fossil. Wine fermentation predates writing by thousands of years.',
    fragmentsNeeded: 6,
    requiredFacts: 35,
    rarity: 'rare',
    isCrop: true,
    factCategories: ['Life Sciences', 'History', 'Culture'],
    companionEffect: { type: 'mineral_rate', value: 0 },
  },
  {
    id: 'star_moss',
    name: 'Stellar Spore Moss',
    icon: '🌱',
    era: 'Silurian',
    description: 'Among the first land plants ever. This 430-million-year-old moss helped turn bare rock into soil.',
    fragmentsNeeded: 7,
    requiredFacts: 40,
    rarity: 'rare',
    isCrop: true,
    factCategories: ['Life Sciences', 'Natural Sciences'],
    companionEffect: { type: 'mineral_rate', value: 0 },
  },
  {
    id: 'world_tree_seed',
    name: 'World Tree Seedling',
    icon: '🌳',
    era: 'Precambrian',
    description: 'A 600-million-year-old seed from before complex multicellular life. Origin of all terrestrial plant lineages.',
    fragmentsNeeded: 8,
    requiredFacts: 60,
    rarity: 'legendary',
    isCrop: true,
    factCategories: ['Natural Sciences', 'Life Sciences'],
    companionEffect: { type: 'mineral_rate', value: 0 },
  },
]

/**
 * Returns the fossil species with the given ID, or undefined if not found.
 */
export function getSpeciesById(id: string): FossilSpecies | undefined {
  return FOSSIL_SPECIES.find(s => s.id === id)
}

/**
 * Returns the CompanionEffect for the player's active companion, or null
 * if no companion is set or the species is unknown.
 * Handles backward-compat where activeCompanion may be undefined on old saves.
 */
export function getActiveCompanionEffect(playerSave: {
  activeCompanion?: string | null
  fossils?: Record<string, { revived: boolean }>
}): CompanionEffect | null {
  const companionId = playerSave.activeCompanion ?? null
  if (!companionId) return null

  // Verify the companion is actually revived (not just set on an old save)
  const fossilState = playerSave.fossils?.[companionId]
  if (!fossilState?.revived) return null

  const species = getSpeciesById(companionId)
  return species?.companionEffect ?? null
}

/**
 * Pick a random fossil species weighted by rarity. Uses the provided seeded RNG.
 * Weights: common=50, uncommon=30, rare=15, legendary=5.
 */
export function pickFossilDrop(rng: () => number): FossilSpecies {
  const weights: Record<FossilSpecies['rarity'], number> = {
    common: 50,
    uncommon: 30,
    rare: 15,
    legendary: 5,
  }
  const total = FOSSIL_SPECIES.reduce((sum, s) => sum + weights[s.rarity], 0)
  let roll = rng() * total
  for (const species of FOSSIL_SPECIES) {
    roll -= weights[species.rarity]
    if (roll <= 0) return species
  }
  return FOSSIL_SPECIES[0]
}
