/**
 * Biome completion configuration.
 * Each biome maps to a set of fact categories; mastering all facts in those
 * categories unlocks a cosmetic title and a permanent passive bonus.
 * DD-V2-050: biome mastery track.
 */
import type { BiomeId } from './biomes'

export interface BiomeCompletionConfig {
  biomeId: BiomeId
  /** Fact category tags that "belong" to this biome. At least one tag must match. */
  requiredCategories: string[]
  /** Minimum number of matching facts needed before this biome is considered completable. */
  minimumFacts: number
  /** Title awarded on completion. Added to PlayerSave.titles. */
  titleId: string
  /** Display text for the title (shown in profile and leaderboard). */
  titleDisplay: string
  /** Passive modifier applied to all future dives in this biome. */
  passiveBonus: BiomePassiveBonus
  /** GAIA one-time line on completion. */
  gaiaLine: string
}

export interface BiomePassiveBonus {
  /** Fractional multiplier applied to all mineral yields in this biome (1.0 = no change). */
  mineralYieldMultiplier: number
  /** Flat O2 reduction to hazard damage (applied after all other modifiers). */
  hazardO2Reduction: number
}

export const BIOME_COMPLETION_CONFIGS: BiomeCompletionConfig[] = [
  {
    biomeId: 'limestone_caves',
    requiredCategories: ['Geology', 'Natural Sciences', 'Geography'],
    minimumFacts: 5,
    titleId: 'title_limestone_scholar',
    titleDisplay: 'Limestone Scholar',
    passiveBonus: { mineralYieldMultiplier: 1.2, hazardO2Reduction: 0 },
    gaiaLine: "You know more about limestone than the limestone does. That's philosophically interesting.",
  },
  {
    biomeId: 'clay_basin',
    requiredCategories: ['Geology', 'Natural Sciences'],
    minimumFacts: 5,
    titleId: 'title_clay_artisan',
    titleDisplay: 'Clay Artisan',
    passiveBonus: { mineralYieldMultiplier: 1.15, hazardO2Reduction: 0 },
    gaiaLine: "Clay shaped civilizations for ten thousand years. You've returned the favor by learning them all.",
  },
  {
    biomeId: 'iron_seam',
    requiredCategories: ['Geology', 'Technology', 'History'],
    minimumFacts: 5,
    titleId: 'title_iron_sage',
    titleDisplay: 'Iron Sage',
    passiveBonus: { mineralYieldMultiplier: 1.25, hazardO2Reduction: 0 },
    gaiaLine: "Iron built empires. You've learned why. That's not nothing.",
  },
  {
    biomeId: 'root_tangle',
    requiredCategories: ['Life Sciences', 'Natural Sciences'],
    minimumFacts: 5,
    titleId: 'title_root_whisperer',
    titleDisplay: 'Root Whisperer',
    passiveBonus: { mineralYieldMultiplier: 1.1, hazardO2Reduction: 1 },
    gaiaLine: "The roots down here have been reaching for light for longer than our species has existed. You know them now.",
  },
  {
    biomeId: 'peat_bog',
    requiredCategories: ['Life Sciences', 'Natural Sciences', 'History'],
    minimumFacts: 5,
    titleId: 'title_bog_historian',
    titleDisplay: 'Bog Historian',
    passiveBonus: { mineralYieldMultiplier: 1.1, hazardO2Reduction: 1 },
    gaiaLine: "Bogs preserve things. Apparently including your knowledge of them.",
  },
  {
    biomeId: 'basalt_maze',
    requiredCategories: ['Geology', 'Geography', 'Natural Sciences'],
    minimumFacts: 5,
    titleId: 'title_basalt_navigator',
    titleDisplay: 'Basalt Navigator',
    passiveBonus: { mineralYieldMultiplier: 1.2, hazardO2Reduction: 0 },
    gaiaLine: "Basalt columns form in silence over millennia. You've catalogued every reason why.",
  },
  {
    biomeId: 'salt_flats',
    requiredCategories: ['Geology', 'Geography', 'History'],
    minimumFacts: 5,
    titleId: 'title_salt_chronicler',
    titleDisplay: 'Salt Chronicler',
    passiveBonus: { mineralYieldMultiplier: 1.15, hazardO2Reduction: 0 },
    gaiaLine: "Salt was once worth its weight in gold. You've learned exactly why — and proven the point.",
  },
  {
    biomeId: 'coal_veins',
    requiredCategories: ['Geology', 'History', 'Technology'],
    minimumFacts: 5,
    titleId: 'title_coal_chronicler',
    titleDisplay: 'Coal Chronicler',
    passiveBonus: { mineralYieldMultiplier: 1.2, hazardO2Reduction: 0 },
    gaiaLine: "Coal powered a revolution. You've mastered the knowledge of what came before it — and after.",
  },
  {
    biomeId: 'granite_canyon',
    requiredCategories: ['Geology', 'Geography', 'Natural Sciences'],
    minimumFacts: 5,
    titleId: 'title_granite_scholar',
    titleDisplay: 'Granite Scholar',
    passiveBonus: { mineralYieldMultiplier: 1.2, hazardO2Reduction: 0 },
    gaiaLine: "Granite takes millions of years to form. You've learned all of its secrets in considerably less time.",
  },
  {
    biomeId: 'sulfur_springs',
    requiredCategories: ['Geology', 'Natural Sciences', 'Life Sciences'],
    minimumFacts: 5,
    titleId: 'title_sulfur_scholar',
    titleDisplay: 'Sulfur Scholar',
    passiveBonus: { mineralYieldMultiplier: 1.1, hazardO2Reduction: 2 },
    gaiaLine: "Sulfur springs support life that shouldn't exist. You've mastered the science of why they do.",
  },
  {
    biomeId: 'obsidian_rift',
    requiredCategories: ['Geology', 'History', 'Culture'],
    minimumFacts: 5,
    titleId: 'title_obsidian_sage',
    titleDisplay: 'Obsidian Sage',
    passiveBonus: { mineralYieldMultiplier: 1.25, hazardO2Reduction: 0 },
    gaiaLine: "Obsidian was the sharpest edge in prehistory. You've honed your knowledge just as keenly.",
  },
  {
    biomeId: 'magma_shelf',
    requiredCategories: ['Geology', 'Natural Sciences', 'Geography'],
    minimumFacts: 5,
    titleId: 'title_magma_master',
    titleDisplay: 'Magma Master',
    passiveBonus: { mineralYieldMultiplier: 1.15, hazardO2Reduction: 3 },
    gaiaLine: "You've learned what drives the planet's engine. I find that appropriately humbling.",
  },
  {
    biomeId: 'crystal_geode',
    requiredCategories: ['Geology', 'Natural Sciences'],
    minimumFacts: 5,
    titleId: 'title_crystal_sage',
    titleDisplay: 'Crystal Sage',
    passiveBonus: { mineralYieldMultiplier: 1.3, hazardO2Reduction: 0 },
    gaiaLine: "Crystals grow in perfect mathematical structures. Your knowledge of them is equally precise.",
  },
  {
    biomeId: 'fossil_layer',
    requiredCategories: ['Paleontology', 'Life Sciences', 'Natural Sciences'],
    minimumFacts: 5,
    titleId: 'title_fossil_whisperer',
    titleDisplay: 'Fossil Whisperer',
    passiveBonus: { mineralYieldMultiplier: 1.0, hazardO2Reduction: 2 },
    gaiaLine: "Every bone down there has a name now, because of you.",
  },
  {
    biomeId: 'quartz_halls',
    requiredCategories: ['Geology', 'Technology', 'Natural Sciences'],
    minimumFacts: 5,
    titleId: 'title_quartz_scholar',
    titleDisplay: 'Quartz Scholar',
    passiveBonus: { mineralYieldMultiplier: 1.2, hazardO2Reduction: 0 },
    gaiaLine: "Quartz runs through everything — technology, geology, time itself. You've mastered all of it.",
  },
  {
    biomeId: 'primordial_mantle',
    requiredCategories: ['Geology', 'Natural Sciences', 'Geography'],
    minimumFacts: 5,
    titleId: 'title_primordial_sage',
    titleDisplay: 'Primordial Sage',
    passiveBonus: { mineralYieldMultiplier: 1.25, hazardO2Reduction: 2 },
    gaiaLine: "You've learned things about Earth's interior that most geologists only theorize. Down here, they're real.",
  },
  {
    biomeId: 'iron_core_fringe',
    requiredCategories: ['Geology', 'Natural Sciences'],
    minimumFacts: 5,
    titleId: 'title_core_scholar',
    titleDisplay: 'Core Scholar',
    passiveBonus: { mineralYieldMultiplier: 1.3, hazardO2Reduction: 2 },
    gaiaLine: "The iron core keeps the planet alive. You know exactly how. I respect that enormously.",
  },
  {
    biomeId: 'pressure_dome',
    requiredCategories: ['Natural Sciences', 'Technology', 'Geology'],
    minimumFacts: 5,
    titleId: 'title_pressure_master',
    titleDisplay: 'Pressure Master',
    passiveBonus: { mineralYieldMultiplier: 1.15, hazardO2Reduction: 3 },
    gaiaLine: "Pressure creates diamonds. It also, apparently, creates scholars. You're proof.",
  },
  {
    biomeId: 'deep_biolume',
    requiredCategories: ['Life Sciences', 'Natural Sciences'],
    minimumFacts: 5,
    titleId: 'title_biolume_scholar',
    titleDisplay: 'Biolume Scholar',
    passiveBonus: { mineralYieldMultiplier: 1.1, hazardO2Reduction: 0 },
    gaiaLine: "Bioluminescence is one of evolution's finest achievements. You've learned them all.",
  },
  {
    biomeId: 'tectonic_scar',
    requiredCategories: ['Geology', 'Natural Sciences', 'Geography'],
    minimumFacts: 5,
    titleId: 'title_tectonic_sage',
    titleDisplay: 'Tectonic Sage',
    passiveBonus: { mineralYieldMultiplier: 1.2, hazardO2Reduction: 1 },
    gaiaLine: "Tectonic scars record millions of years of planetary trauma. You've read every word.",
  },
  {
    biomeId: 'temporal_rift',
    requiredCategories: ['Natural Sciences', 'History', 'Technology'],
    minimumFacts: 5,
    titleId: 'title_temporal_scholar',
    titleDisplay: 'Temporal Scholar',
    passiveBonus: { mineralYieldMultiplier: 1.2, hazardO2Reduction: 0 },
    gaiaLine: "Time rifts don't yield their secrets easily. Yours did.",
  },
  {
    biomeId: 'alien_intrusion',
    requiredCategories: ['Natural Sciences', 'Technology'],
    minimumFacts: 5,
    titleId: 'title_xenolith_scholar',
    titleDisplay: 'Xenolith Scholar',
    passiveBonus: { mineralYieldMultiplier: 1.25, hazardO2Reduction: 0 },
    gaiaLine: "Something from outside got in down here. You've catalogued exactly what that means.",
  },
  {
    biomeId: 'bioluminescent',
    requiredCategories: ['Life Sciences', 'Natural Sciences'],
    minimumFacts: 5,
    titleId: 'title_light_keeper',
    titleDisplay: 'Light Keeper',
    passiveBonus: { mineralYieldMultiplier: 1.1, hazardO2Reduction: 0 },
    gaiaLine: "Light in the dark. You've learned why it persists. So have you.",
  },
  {
    biomeId: 'void_pocket',
    requiredCategories: ['Natural Sciences', 'Geology'],
    minimumFacts: 5,
    titleId: 'title_void_scholar',
    titleDisplay: 'Void Scholar',
    passiveBonus: { mineralYieldMultiplier: 1.1, hazardO2Reduction: 1 },
    gaiaLine: "Empty spaces hold their own kind of knowledge. You've found it all.",
  },
  {
    biomeId: 'echo_chamber',
    requiredCategories: ['Natural Sciences', 'Geology', 'Culture'],
    minimumFacts: 5,
    titleId: 'title_echo_scholar',
    titleDisplay: 'Echo Scholar',
    passiveBonus: { mineralYieldMultiplier: 1.1, hazardO2Reduction: 0 },
    gaiaLine: "Echoes carry truth from the past. You've heard every one.",
  },
]

/** Quick lookup map for runtime use. */
export const BIOME_COMPLETION_MAP: Map<BiomeId, BiomeCompletionConfig> =
  new Map(BIOME_COMPLETION_CONFIGS.map(c => [c.biomeId, c]))
