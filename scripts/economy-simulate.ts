#!/usr/bin/env npx tsx
// === Economy Progression Simulator ===
// Models currency earning and relic unlock pacing over many runs.
// Answers: "How many runs to unlock all relics?", "What's the optimal unlock order?",
// "Is the grind reasonable?"
//
// Usage:
//   npx tsx scripts/economy-simulate.ts --profiles average,expert --max-runs 500
//   npx tsx scripts/economy-simulate.ts --profiles average --max-runs 50 --seeds 10 --quiet

import { writeFileSync } from 'node:fs';
import { HeadlessCombatSimulator } from '../tests/playtest/core/headless-combat';
import type { PlayerProfile, PlaythroughSummary } from '../tests/playtest/core/types';

// ─── Profile Presets ─────────────────────────────────────────────────────────

const PROFILES: Record<string, PlayerProfile> = {
  beginner: {
    id: 'beginner', name: 'Beginner', description: 'New player',
    learningAbility: { baseAccuracy: 0.5, accuracyCurve: 'flat', accuracyPerFloorDelta: 0.0, minAccuracy: 0.5, maxAccuracy: 0.5 },
    readingSpeed: { category: 'slow', speedBonusProbability: 0.05 },
    strategicSkill: { level: 'random', prioritizeShieldsBeforeAttacks: false, useBuffsBeforeDamage: false, saveHealsForLowHP: false, hpThresholdForHeal: 0.3 },
    engagement: { skipProbability: 0.05, aggression: 'passive' },
    sessionBehavior: { maxFloors: 24, cashOutFloor: 0 },
  },
  average: {
    id: 'average', name: 'Average', description: 'Typical player',
    learningAbility: { baseAccuracy: 0.7, accuracyCurve: 'improving', accuracyPerFloorDelta: 0.01, minAccuracy: 0.6, maxAccuracy: 0.8 },
    readingSpeed: { category: 'normal', speedBonusProbability: 0.15 },
    strategicSkill: { level: 'basic', prioritizeShieldsBeforeAttacks: true, useBuffsBeforeDamage: false, saveHealsForLowHP: false, hpThresholdForHeal: 0.4 },
    engagement: { skipProbability: 0.05, aggression: 'balanced' },
    sessionBehavior: { maxFloors: 24, cashOutFloor: 0 },
  },
  expert: {
    id: 'expert', name: 'Expert', description: 'Highly skilled player',
    learningAbility: { baseAccuracy: 0.9, accuracyCurve: 'flat', accuracyPerFloorDelta: 0.0, minAccuracy: 0.85, maxAccuracy: 0.95 },
    readingSpeed: { category: 'fast', speedBonusProbability: 0.6 },
    strategicSkill: { level: 'optimal', prioritizeShieldsBeforeAttacks: true, useBuffsBeforeDamage: true, saveHealsForLowHP: true, hpThresholdForHeal: 0.35 },
    engagement: { skipProbability: 0.02, aggression: 'aggressive' },
    sessionBehavior: { maxFloors: 24, cashOutFloor: 0 },
  },
  struggling: {
    id: 'struggling', name: 'Struggling', description: 'Low accuracy declining player',
    learningAbility: { baseAccuracy: 0.4, accuracyCurve: 'declining', accuracyPerFloorDelta: -0.02, minAccuracy: 0.2, maxAccuracy: 0.5 },
    readingSpeed: { category: 'slow', speedBonusProbability: 0.02 },
    strategicSkill: { level: 'random', prioritizeShieldsBeforeAttacks: false, useBuffsBeforeDamage: false, saveHealsForLowHP: false, hpThresholdForHeal: 0.2 },
    engagement: { skipProbability: 0.1, aggression: 'passive' },
    sessionBehavior: { maxFloors: 24, cashOutFloor: 0 },
  },
  'speed-runner': {
    id: 'speed-runner', name: 'Speed Runner', description: 'Elite speed player',
    learningAbility: { baseAccuracy: 0.9, accuracyCurve: 'flat', accuracyPerFloorDelta: 0.0, minAccuracy: 0.85, maxAccuracy: 0.95 },
    readingSpeed: { category: 'fast', speedBonusProbability: 0.9 },
    strategicSkill: { level: 'optimal', prioritizeShieldsBeforeAttacks: true, useBuffsBeforeDamage: true, saveHealsForLowHP: true, hpThresholdForHeal: 0.3 },
    engagement: { skipProbability: 0.0, aggression: 'aggressive' },
    sessionBehavior: { maxFloors: 24, cashOutFloor: 0 },
  },
};

// ─── Relic Unlock Costs ──────────────────────────────────────────────────────

const RELIC_UNLOCK_COSTS: Record<string, number> = {
  glass_cannon: 25, blood_price: 30, time_dilation: 30, venom_fang: 35, renewal_spring: 35, echo_lens: 35,
  berserker_band: 40, iron_resolve: 40, afterimage: 40, polyglot_pendant: 40,
  crescendo_blade: 45, fortress_wall: 45, quicksilver: 45, prospectors_pick: 45,
  chain_lightning_rod: 50, executioners_axe: 50, mirror_shield: 50, eidetic_memory: 50, miser_ring: 50,
  blood_pact: 55, double_vision: 55, speed_reader: 55,
  phase_cloak: 60, domain_mastery: 60,
  phoenix_feather: 70,
};

const TOTAL_UNLOCK_COST = Object.values(RELIC_UNLOCK_COSTS).reduce((a, b) => a + b, 0);
const TOTAL_RELICS = Object.keys(RELIC_UNLOCK_COSTS).length;

// ─── Relic Impact Scores (from sweep data) ───────────────────────────────────

const RELIC_IMPACT_APPROX: Record<string, number> = {
  glass_cannon: 19.6, combo_ring: 16.8, blood_price: 16.3, thorned_vest: 11.5,
  afterimage: 11.3, barbed_edge: 11.1, war_drum: 10.9, whetstone: 10.9,
  mirror_shield: 8.2, curiosity_gem: 7.7, executioners_axe: 7.6,
  memory_palace: 7.5, chain_lightning_rod: 6.3, quicksilver: 4.2,
  flame_brand: 4.1, double_vision: 3.8, fortress_wall: 3.2,
  crescendo_blade: 2.8, momentum_gem: 1.5, berserker_band: 1.5,
  phase_cloak: 0.5, iron_resolve: 0.3, stone_wall: 0.2,
  steel_skin: 0.1, renewal_spring: 0.1,
  // Non-combat relics (approximate value)
  time_dilation: 5.0, echo_lens: 3.0, speed_reader: 4.0, domain_mastery: 6.0,
  polyglot_pendant: 3.0, eidetic_memory: 4.0, prospectors_pick: 5.0,
  miser_ring: 8.0, gold_magnet: 7.0, lucky_coin: 3.0, scavengers_pouch: 2.0,
  // Starters / not unlockable
  venom_fang: 0.0, sharp_eye: 0.0, speed_charm: 0.0,
  blood_pact: -1.6, phoenix_feather: -13.9,
};

// ─── Economy Constants ───────────────────────────────────────────────────────

/** Base currency rewards per encounter category. */
const BASE_REWARDS: Record<string, number> = {
  common: 10,
  elite: 25,
  mini_boss: 30,
  boss: 50,
};

/** Death penalty: fraction of currency kept per segment. */
const DEATH_PENALTY: Record<number, number> = {
  1: 0.80,
  2: 0.65,
  3: 0.50,
  4: 0.35,
};

/** Boss floors (every 3rd). */
const BOSS_FLOORS = new Set([3, 6, 9, 12, 15, 18, 21, 24]);

// ─── Output Types ────────────────────────────────────────────────────────────

interface EconomySimConfig {
  profiles: string[];
  maxRuns: number;
  seeds: number;
  seed: number;
}

interface CurrencyPerRun {
  profile: string;
  avgDustPerRun: number;
  avgFloor: number;
  avgMasteryCoinsPerRun: number;
}

interface UnlockProgressionEntry {
  runNumber: number;
  cumulativeMasteryCoins: number;
  relicsUnlocked: number;
  relicsList: string[];
  lastUnlocked: string | null;
}

interface OptimalUnlockEntry {
  rank: number;
  relicId: string;
  cost: number;
  impact: number;
  roi: number;
}

interface EconomyOutput {
  meta: {
    config: EconomySimConfig;
    generatedAt: string;
    elapsedMs: number;
    totalUnlockCost: number;
  };
  currencyPerRun: CurrencyPerRun[];
  unlockProgression: UnlockProgressionEntry[];
  runsToUnlockAll: Record<string, number | null>;
  optimalUnlockOrder: OptimalUnlockEntry[];
}

// ─── Economy Calculation ─────────────────────────────────────────────────────

/**
 * Calculates the segment number for a given floor.
 *
 * @param floor - Floor number (1-24+).
 * @returns Segment 1-4.
 */
function getSegment(floor: number): number {
  if (floor <= 6) return 1;
  if (floor <= 12) return 2;
  if (floor <= 18) return 3;
  return 4;
}

/**
 * Computes the approximate mastery coins earned based on total completed runs
 * and average floor depth reached.
 *
 * @param totalRuns - Total runs completed so far.
 * @param avgFloor - Average floor depth reached in recent runs.
 * @returns Mastery coins for this run.
 */
function getMasteryCoins(totalRuns: number, avgFloor: number): number {
  // Base mastery from fact progression (T3 achievements)
  let base = 0;
  if (totalRuns < 20) base = 0;
  else if (totalRuns < 50) base = 0.5;
  else if (totalRuns < 100) base = 1.5;
  else base = 3;

  // Floor bonus: deeper runs earn more mastery from encountering more facts
  const floorBonus = Math.floor(avgFloor / 6) * 0.5;

  return base + floorBonus;
}

/**
 * Calculates currency earned for a single run from simulation results.
 *
 * @param summary - The playthrough summary from the headless simulator.
 * @returns Total currency earned after death penalties.
 */
function calculateRunCurrency(summary: PlaythroughSummary): number {
  const finalFloor = summary.finalFloor;
  let totalCurrency = 0;

  // Calculate currency for each floor reached
  for (let floor = 1; floor <= finalFloor; floor++) {
    const floorScaling = 1 + (floor - 1) * 0.15;

    // 2 common encounters per floor
    totalCurrency += 2 * Math.round(BASE_REWARDS.common * floorScaling);

    // 1 boss or mini-boss encounter per floor
    if (BOSS_FLOORS.has(floor)) {
      totalCurrency += Math.round(BASE_REWARDS.boss * floorScaling);
    } else {
      totalCurrency += Math.round(BASE_REWARDS.mini_boss * floorScaling);
    }
  }

  // Add combo bonus from best combo in the run
  totalCurrency += summary.maxCombo * 2;

  // Apply death penalty if not a victory/cash_out
  if (summary.result === 'defeat') {
    const segment = getSegment(finalFloor);
    const retention = DEATH_PENALTY[segment] ?? 0.35;
    totalCurrency = Math.round(totalCurrency * retention);
  }

  return totalCurrency;
}

// ─── Simulation Core ─────────────────────────────────────────────────────────

/**
 * Runs economy simulations for a single profile across multiple seeds.
 *
 * @param profileId - Profile identifier.
 * @param seeds - Number of seeds to simulate.
 * @param baseSeed - Starting RNG seed.
 * @param maxRuns - Maximum runs to simulate.
 * @param quiet - Suppress progress output.
 * @returns Per-run average stats.
 */
function simulateProfileEconomy(
  profileId: string,
  seeds: number,
  baseSeed: number,
  maxRuns: number,
  quiet: boolean,
): { avgDustPerRun: number; avgFloor: number; avgMasteryCoinsPerRun: number; perSeedResults: Array<{ currency: number; floor: number }> } {
  const profile = PROFILES[profileId];
  if (!profile) throw new Error(`Unknown profile: ${profileId}`);

  let totalCurrency = 0;
  let totalFloor = 0;
  let totalMastery = 0;
  const perSeedResults: Array<{ currency: number; floor: number }> = [];

  const runCount = Math.min(seeds, maxRuns);

  for (let s = 0; s < runCount; s++) {
    const seed = baseSeed + s;
    const sim = new HeadlessCombatSimulator(profile, seed);
    const log = sim.simulateRun({ summaryOnly: true, maxTotalTurns: 500 });
    const summary = log.summary;

    const currency = calculateRunCurrency(summary);
    const mastery = getMasteryCoins(s + 1, summary.finalFloor);

    totalCurrency += currency;
    totalFloor += summary.finalFloor;
    totalMastery += mastery;
    perSeedResults.push({ currency, floor: summary.finalFloor });

    if (!quiet && (s + 1) % 100 === 0) {
      process.stderr.write(`  ${profileId}: ${s + 1}/${runCount} seeds completed\n`);
    }
  }

  return {
    avgDustPerRun: Math.round(totalCurrency / runCount * 10) / 10,
    avgFloor: Math.round(totalFloor / runCount * 10) / 10,
    avgMasteryCoinsPerRun: Math.round(totalMastery / runCount * 100) / 100,
    perSeedResults,
  };
}

/**
 * Simulates unlock progression for a single profile.
 * Runs N games sequentially, accumulating currency and buying cheapest relics.
 *
 * @param profileId - Profile identifier.
 * @param maxRuns - Maximum runs to simulate.
 * @param baseSeed - Starting RNG seed.
 * @param quiet - Suppress progress output.
 * @returns Unlock progression timeline and final run count.
 */
function simulateUnlockProgression(
  profileId: string,
  maxRuns: number,
  baseSeed: number,
  quiet: boolean,
): { progression: UnlockProgressionEntry[]; runsToUnlockAll: number | null } {
  const profile = PROFILES[profileId];
  if (!profile) throw new Error(`Unknown profile: ${profileId}`);

  let cumulativeDust = 0;
  let cumulativeMasteryCoins = 0;
  const unlockedRelics: string[] = [];
  const remainingRelics = { ...RELIC_UNLOCK_COSTS };
  const progression: UnlockProgressionEntry[] = [];

  // Record milestones at specific run counts
  const milestoneRuns = new Set([1, 5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000]);

  let runsToUnlockAll: number | null = null;

  // Track running average floor for getMasteryCoins
  let totalFloors = 0;

  for (let run = 1; run <= maxRuns; run++) {
    const seed = baseSeed + run;
    const sim = new HeadlessCombatSimulator(profile, seed);
    const log = sim.simulateRun({ summaryOnly: true, maxTotalTurns: 500 });
    const dust = calculateRunCurrency(log.summary);
    cumulativeDust += dust;
    totalFloors += log.summary.finalFloor;
    const avgFloor = totalFloors / run;

    // Add mastery coins (approximation) — tracked separately from dust
    const mastery = getMasteryCoins(run, avgFloor);
    cumulativeMasteryCoins += mastery;

    // Dust-to-mastery conversion: 10% if miser_ring is unlocked, 0% otherwise
    if (unlockedRelics.includes('miser_ring')) {
      const dustConversion = dust * 0.10;
      cumulativeMasteryCoins += dustConversion;
    }

    // Try to buy cheapest available relic using mastery coins only
    let boughtThisRun = true;
    let lastUnlocked: string | null = null;
    while (boughtThisRun) {
      boughtThisRun = false;
      // Find cheapest remaining relic
      let cheapestId: string | null = null;
      let cheapestCost = Infinity;
      for (const [id, cost] of Object.entries(remainingRelics)) {
        if (cost < cheapestCost) {
          cheapestCost = cost;
          cheapestId = id;
        }
      }
      if (cheapestId && cumulativeMasteryCoins >= cheapestCost) {
        cumulativeMasteryCoins -= cheapestCost;
        unlockedRelics.push(cheapestId);
        delete remainingRelics[cheapestId];
        lastUnlocked = cheapestId;
        boughtThisRun = true;
      }
    }

    // Check if all relics unlocked
    if (Object.keys(remainingRelics).length === 0 && runsToUnlockAll === null) {
      runsToUnlockAll = run;
    }

    // Record milestone or relic purchase
    if (milestoneRuns.has(run) || lastUnlocked !== null) {
      progression.push({
        runNumber: run,
        cumulativeMasteryCoins,
        relicsUnlocked: unlockedRelics.length,
        relicsList: [...unlockedRelics],
        lastUnlocked,
      });
    }

    if (!quiet && run % 200 === 0) {
      process.stderr.write(`  Progression ${profileId}: run ${run}/${maxRuns}, ${unlockedRelics.length}/${TOTAL_RELICS} relics\n`);
    }

    // Early exit if all unlocked
    if (runsToUnlockAll !== null) break;
  }

  return { progression, runsToUnlockAll };
}

/**
 * Computes the optimal unlock order based on impact/cost ROI.
 *
 * @returns Ranked list of relics by ROI.
 */
function computeOptimalUnlockOrder(): OptimalUnlockEntry[] {
  const entries: OptimalUnlockEntry[] = [];

  for (const [relicId, cost] of Object.entries(RELIC_UNLOCK_COSTS)) {
    const impact = RELIC_IMPACT_APPROX[relicId] ?? 0;
    const roi = Math.round((impact / cost) * 1000) / 1000;
    entries.push({ rank: 0, relicId, cost, impact, roi });
  }

  // Sort by ROI descending
  entries.sort((a, b) => b.roi - a.roi);

  // Assign ranks
  entries.forEach((e, i) => { e.rank = i + 1; });

  return entries;
}

// ─── CLI Argument Parsing ────────────────────────────────────────────────────

function parseArgs(): { config: EconomySimConfig; outputPath: string | null; quiet: boolean } {
  const args = process.argv.slice(2);
  let profiles = ['average', 'expert'];
  let maxRuns = 500;
  let seeds = 50;
  let seed = 42;
  let outputPath: string | null = null;
  let quiet = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--profiles':
        profiles = (args[++i] ?? '').split(',').map(s => s.trim()).filter(Boolean);
        break;
      case '--max-runs':
        maxRuns = parseInt(args[++i] ?? '500', 10);
        break;
      case '--seeds':
        seeds = parseInt(args[++i] ?? '50', 10);
        break;
      case '--seed':
        seed = parseInt(args[++i] ?? '42', 10);
        break;
      case '--output':
        outputPath = args[++i] ?? null;
        break;
      case '--quiet':
        quiet = true;
        break;
      case '--help':
        process.stderr.write(`Usage: npx tsx scripts/economy-simulate.ts [options]

Options:
  --profiles <list>   Comma-separated profiles (default: "average,expert")
  --max-runs <n>      Max runs to simulate (default 500)
  --seeds <n>         Seeds per profile for avg currency calc (default 50)
  --seed <n>          Base RNG seed (default 42)
  --output <path>     Output file path (default: stdout)
  --quiet             Suppress stderr summary

Available profiles: ${Object.keys(PROFILES).join(', ')}
`);
        process.exit(0);
    }
  }

  // Validate profiles
  for (const p of profiles) {
    if (!PROFILES[p]) {
      process.stderr.write(`ERROR: Unknown profile "${p}". Available: ${Object.keys(PROFILES).join(', ')}\n`);
      process.exit(1);
    }
  }

  return {
    config: { profiles, maxRuns, seeds, seed },
    outputPath,
    quiet,
  };
}

// ─── Formatting Helpers ──────────────────────────────────────────────────────

/**
 * Pads a string to a fixed width for table formatting.
 *
 * @param s - The string to pad.
 * @param width - Desired width.
 * @returns Padded string.
 */
function pad(s: string, width: number): string {
  return s.padEnd(width);
}

/**
 * Right-aligns a number string to a fixed width.
 *
 * @param n - The number to format.
 * @param width - Desired width.
 * @param decimals - Decimal places (default 1).
 * @returns Right-aligned formatted string.
 */
function rpad(n: number, width: number, decimals: number = 1): string {
  return n.toFixed(decimals).padStart(width);
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  const { config, outputPath, quiet } = parseArgs();
  const startTime = Date.now();

  if (!quiet) {
    process.stderr.write(`\nECONOMY PROGRESSION SIMULATION\n`);
    process.stderr.write(`${'═'.repeat(50)}\n`);
    process.stderr.write(`Config: profiles=${config.profiles.join(',')}, maxRuns=${config.maxRuns}, seeds=${config.seeds}\n`);
    process.stderr.write(`Total unlock cost: ${TOTAL_UNLOCK_COST.toLocaleString()} mastery coins\n\n`);
  }

  // ── Phase 1: Average currency per run per profile ──
  if (!quiet) process.stderr.write(`Phase 1: Computing average currency per run...\n`);

  const currencyPerRun: CurrencyPerRun[] = [];

  for (const profileId of config.profiles) {
    const result = simulateProfileEconomy(profileId, config.seeds, config.seed, config.maxRuns, quiet);
    currencyPerRun.push({
      profile: profileId,
      avgDustPerRun: result.avgDustPerRun,
      avgFloor: result.avgFloor,
      avgMasteryCoinsPerRun: result.avgMasteryCoinsPerRun,
    });
  }

  // ── Phase 2: Unlock progression per profile ──
  if (!quiet) process.stderr.write(`\nPhase 2: Simulating unlock progression...\n`);

  const allProgressions: Record<string, UnlockProgressionEntry[]> = {};
  const runsToUnlockAll: Record<string, number | null> = {};

  for (const profileId of config.profiles) {
    const result = simulateUnlockProgression(profileId, config.maxRuns, config.seed, quiet);
    allProgressions[profileId] = result.progression;
    runsToUnlockAll[profileId] = result.runsToUnlockAll;
  }

  // Use first profile's progression as the primary progression output
  const primaryProfile = config.profiles[0];
  const unlockProgression = allProgressions[primaryProfile] ?? [];

  // ── Phase 3: Optimal unlock order ──
  const optimalUnlockOrder = computeOptimalUnlockOrder();

  // ── Build output ──
  const elapsedMs = Date.now() - startTime;

  const output: EconomyOutput = {
    meta: {
      config,
      generatedAt: new Date().toISOString(),
      elapsedMs,
      totalUnlockCost: TOTAL_UNLOCK_COST,
    },
    currencyPerRun,
    unlockProgression,
    runsToUnlockAll,
    optimalUnlockOrder,
  };

  // ── Write JSON output ──
  const json = JSON.stringify(output, null, 2);
  if (outputPath) {
    writeFileSync(outputPath, json, 'utf-8');
    if (!quiet) process.stderr.write(`\nOutput written to ${outputPath}\n`);
  } else {
    process.stdout.write(json + '\n');
  }

  // ── Summary to stderr ──
  if (!quiet) {
    process.stderr.write(`\nElapsed: ${(elapsedMs / 1000).toFixed(1)}s\n`);

    // Currency per run table
    process.stderr.write(`\nCURRENCY PER RUN (dust = encounter currency, mastery coins = relic unlock currency):\n`);
    process.stderr.write(`  ${pad('Profile', 14)} ${pad('Avg Dust', 12)} ${pad('Avg Floor', 10)} ${pad('Avg Mastery', 14)}\n`);
    process.stderr.write(`  ${'-'.repeat(14)} ${'-'.repeat(12)} ${'-'.repeat(10)} ${'-'.repeat(14)}\n`);
    for (const row of currencyPerRun) {
      process.stderr.write(`  ${pad(row.profile, 14)} ${rpad(row.avgDustPerRun, 12)} ${rpad(row.avgFloor, 10)} ${rpad(row.avgMasteryCoinsPerRun, 14, 2)}\n`);
    }

    // Unlock timeline per profile
    for (const profileId of config.profiles) {
      const prog = allProgressions[profileId] ?? [];
      process.stderr.write(`\nUNLOCK TIMELINE (${profileId} profile):\n`);

      // Show milestones at run 50, 100, 200, 500
      for (const milestone of [50, 100, 200, 500]) {
        // Find the last entry at or before this milestone
        let entry: UnlockProgressionEntry | null = null;
        for (const p of prog) {
          if (p.runNumber <= milestone) entry = p;
        }
        if (entry) {
          const relicSample = entry.relicsUnlocked <= 3
            ? ` (${entry.relicsList.join(', ')})`
            : '';
          process.stderr.write(`  Run ${String(milestone).padStart(4)}: ${String(entry.relicsUnlocked).padStart(2)} relics${relicSample}\n`);
        }
      }

      const allCount = runsToUnlockAll[profileId];
      if (allCount !== null) {
        process.stderr.write(`  All ${TOTAL_RELICS}:   Reached at run ${allCount}\n`);
      } else {
        process.stderr.write(`  All ${TOTAL_RELICS}:   Not reached in ${config.maxRuns} runs\n`);
      }
    }

    // Optimal unlock order (top 10)
    process.stderr.write(`\nOPTIMAL UNLOCK ORDER (top 10):\n`);
    process.stderr.write(`  ${pad('#', 3)} ${pad('Relic', 24)} ${pad('Cost', 6)} ${pad('Impact', 8)} ROI\n`);
    for (const entry of optimalUnlockOrder.slice(0, 10)) {
      process.stderr.write(`  ${pad(String(entry.rank), 3)} ${pad(entry.relicId, 24)} ${pad(String(entry.cost), 6)} ${rpad(entry.impact, 8)} ${rpad(entry.roi, 6, 3)}\n`);
    }

    // Runs to unlock all summary
    process.stderr.write(`\nRUNS TO UNLOCK ALL:\n`);
    for (const profileId of config.profiles) {
      const count = runsToUnlockAll[profileId];
      if (count !== null) {
        process.stderr.write(`  ${pad(profileId + ':', 16)} ~${count} runs\n`);
      } else {
        process.stderr.write(`  ${pad(profileId + ':', 16)} >${config.maxRuns} runs (not reached)\n`);
      }
    }
    process.stderr.write('\n');
  }
}

main();
