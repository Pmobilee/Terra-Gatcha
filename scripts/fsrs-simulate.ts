#!/usr/bin/env npx tsx
// === FSRS Progression Simulator ===
// Models spaced-repetition knowledge mastery over simulated calendar time.
// Answer questions like: "How many runs to master 100/1000 facts?",
// "What accuracy is needed for reasonable progression?",
// "How long to complete a domain?"
//
// Usage:
//   npx tsx scripts/fsrs-simulate.ts --accuracy 0.7 --days 180 --seed 42
//   npx tsx scripts/fsrs-simulate.ts --sweep --days 90
//   npx tsx scripts/fsrs-simulate.ts --accuracy 0.9 --days 365 --facts 1000 --output results.json

import { writeFileSync } from 'node:fs';
import { createFactState, reviewFact, getCardTier } from '../src/services/fsrsScheduler';
import { qualifiesForMasteryTrial } from '../src/services/tierDerivation';
import type { PlayerFactState } from '../src/data/types';

// ─── Seeded RNG (Mulberry32) ────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Time-Travel Wrapper ────────────────────────────────────────────────────

function reviewFactAt(
  state: PlayerFactState,
  correct: boolean,
  timestampMs: number,
): PlayerFactState {
  const origNow = Date.now;
  const OrigDate = globalThis.Date;
  // @ts-expect-error — monkey-patching Date for time travel
  Date.now = () => timestampMs;
  // @ts-expect-error — monkey-patching Date constructor
  globalThis.Date = class extends OrigDate {
    constructor(...a: any[]) {
      if (a.length === 0) super(timestampMs);
      else super(...(a as [any]));
    }
    static now() { return timestampMs; }
  } as any;
  try {
    return reviewFact(state, correct);
  } finally {
    Date.now = origNow;
    globalThis.Date = OrigDate;
  }
}

/** Check if a fact is due at a given simulated timestamp. */
function isDueAt(state: PlayerFactState, timestampMs: number): boolean {
  const dueAt = state.due ?? state.nextReviewAt;
  return dueAt <= timestampMs;
}

// ─── Configuration ──────────────────────────────────────────────────────────

interface FSRSSimConfig {
  totalFacts: number;
  domains: Record<string, number>;
  playerAccuracy: number;
  runsPerDay: number;
  daysToSimulate: number;
  factsPerRun: number;
  poolSplit: { primary: number; secondary: number; review: number };
  seed: number;
}

const DEFAULT_DOMAINS: Record<string, number> = {
  general_knowledge: 800,
  natural_sciences: 500,
  history: 400,
  geography: 300,
  language_japanese: 400,
  arts_literature: 300,
  technology: 300,
};

function buildDefaultConfig(overrides: Partial<FSRSSimConfig> = {}): FSRSSimConfig {
  const domains = overrides.domains ?? DEFAULT_DOMAINS;
  const totalFacts = overrides.totalFacts ?? Object.values(domains).reduce((a, b) => a + b, 0);
  return {
    totalFacts,
    domains,
    playerAccuracy: 0.7,
    runsPerDay: 2,
    daysToSimulate: 180,
    factsPerRun: 100,
    poolSplit: { primary: 0.30, secondary: 0.25, review: 0.45 },
    seed: 42,
    ...overrides,
    // Ensure totalFacts matches domain sum if domains were provided
    ...(overrides.domains && !overrides.totalFacts
      ? { totalFacts: Object.values(domains).reduce((a, b) => a + b, 0) }
      : {}),
  };
}

// ─── Output Types ───────────────────────────────────────────────────────────

interface TierSnapshot {
  day: number;
  run: number;
  unseen: number;
  tier1: number;
  tier2a: number;
  tier2b: number;
  tier3: number;
}

interface FSRSOutput {
  meta: {
    config: FSRSSimConfig;
    generatedAt: string;
    elapsedMs: number;
  };
  masteryMilestones: {
    runsToMaster: Record<string, number | null>;
    daysToMaster: Record<string, number | null>;
  };
  tierDistributionOverTime: TierSnapshot[];
  domainCompletionCurves: Record<string, Array<{
    day: number;
    masteredCount: number;
    totalInDomain: number;
  }>>;
  accuracyVsMasterySpeed?: Array<{
    accuracy: number;
    runsToMaster100: number | null;
    daysToMaster100: number | null;
  }>;
  factEncounterFrequency: {
    avg: number;
    min: number;
    max: number;
    stdDev: number;
  };
}

// ─── Simulation Core ────────────────────────────────────────────────────────

interface FactEntry {
  factId: string;
  domain: string;
  state: PlayerFactState;
  encounters: number;
  seen: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MILESTONE_KEYS = ['10', '50', '100', '500', '1000', 'all'] as const;

function runSimulation(config: FSRSSimConfig): FSRSOutput {
  const startTime = performance.now();
  const rng = mulberry32(config.seed);

  // Build fact pool from domains
  const facts: FactEntry[] = [];
  const domainNames = Object.keys(config.domains);
  let factIdx = 0;
  for (const domain of domainNames) {
    const count = config.domains[domain];
    for (let i = 0; i < count; i++) {
      const factId = `${domain}_${String(i).padStart(4, '0')}`;
      facts.push({
        factId,
        domain,
        state: createFactState(factId),
        encounters: 0,
        seen: false,
      });
    }
    factIdx += count;
  }

  // Tracking structures
  const tierSnapshots: TierSnapshot[] = [];
  const domainCurves: Record<string, Array<{ day: number; masteredCount: number; totalInDomain: number }>> = {};
  for (const d of domainNames) {
    domainCurves[d] = [];
  }

  const milestoneRuns: Record<string, number | null> = {};
  const milestoneDays: Record<string, number | null> = {};
  for (const k of MILESTONE_KEYS) {
    milestoneRuns[k] = null;
    milestoneDays[k] = null;
  }

  let totalMastered = 0;
  let globalRunCount = 0;
  let primaryDomainIdx = 0;

  // Simulation start: today at midnight
  const simStartMs = Date.now();
  let currentTimeMs = simStartMs;

  for (let day = 1; day <= config.daysToSimulate; day++) {
    const dayStartMs = simStartMs + (day - 1) * MS_PER_DAY;
    const runSpacingMs = MS_PER_DAY / (config.runsPerDay + 1);

    for (let runInDay = 1; runInDay <= config.runsPerDay; runInDay++) {
      globalRunCount++;
      currentTimeMs = dayStartMs + runInDay * runSpacingMs;

      // 1. Gather due-for-review facts
      const dueFacts = facts
        .filter(f => f.seen && isDueAt(f.state, currentTimeMs) && getCardTier(f.state) !== '3')
        .sort((a, b) => (a.state.due ?? a.state.nextReviewAt) - (b.state.due ?? b.state.nextReviewAt));

      // 2. Gather unseen facts from domains
      const primaryDomain = domainNames[primaryDomainIdx % domainNames.length];
      const secondaryDomain = domainNames[(primaryDomainIdx + 1) % domainNames.length];
      primaryDomainIdx++;

      const unseenPrimary = facts.filter(f => !f.seen && f.domain === primaryDomain);
      const unseenSecondary = facts.filter(f => !f.seen && f.domain === secondaryDomain);
      const unseenOther = facts.filter(f => !f.seen && f.domain !== primaryDomain && f.domain !== secondaryDomain);

      // 3. Compose pool
      const reviewTarget = Math.round(config.factsPerRun * config.poolSplit.review);
      const primaryTarget = Math.round(config.factsPerRun * config.poolSplit.primary);
      const secondaryTarget = config.factsPerRun - reviewTarget - primaryTarget;

      const pool: FactEntry[] = [];

      // Review slots
      const reviewPick = dueFacts.slice(0, reviewTarget);
      pool.push(...reviewPick);

      // Primary domain unseen
      const primaryPick = unseenPrimary.slice(0, primaryTarget);
      pool.push(...primaryPick);

      // Secondary domain unseen
      const secondaryPick = unseenSecondary.slice(0, secondaryTarget);
      pool.push(...secondaryPick);

      // Backfill: if not enough review facts, fill with unseen
      if (pool.length < config.factsPerRun) {
        const remaining = config.factsPerRun - pool.length;
        const poolIds = new Set(pool.map(f => f.factId));
        const backfillUnseen = [...unseenPrimary, ...unseenSecondary, ...unseenOther]
          .filter(f => !poolIds.has(f.factId))
          .slice(0, remaining);
        pool.push(...backfillUnseen);
      }

      // Backfill: if not enough unseen, fill with due
      if (pool.length < config.factsPerRun) {
        const remaining = config.factsPerRun - pool.length;
        const poolIds = new Set(pool.map(f => f.factId));
        const backfillDue = dueFacts
          .filter(f => !poolIds.has(f.factId))
          .slice(0, remaining);
        pool.push(...backfillDue);
      }

      // 4. Review each fact in the pool
      let newlyMastered = 0;
      for (const entry of pool) {
        const correct = rng() < config.playerAccuracy;
        const prevTier = getCardTier(entry.state);

        entry.state = reviewFactAt(entry.state, correct, currentTimeMs);
        entry.seen = true;
        entry.encounters++;

        // Check T2b → T3 mastery trial qualification
        if (qualifiesForMasteryTrial(entry.state)) {
          // Auto-pass mastery trial
          entry.state.passedMasteryTrial = true;
          // One more review to lock in the tier transition
          entry.state = reviewFactAt(entry.state, true, currentTimeMs + 1000);
          entry.encounters++;
        }

        const finalTier = getCardTier(entry.state);
        if (finalTier === '3' && prevTier !== '3') {
          newlyMastered++;
          totalMastered++;
        }
      }

      // 5. Check milestones
      for (const k of MILESTONE_KEYS) {
        const target = k === 'all' ? config.totalFacts : parseInt(k, 10);
        if (milestoneRuns[k] === null && totalMastered >= target) {
          milestoneRuns[k] = globalRunCount;
          milestoneDays[k] = day;
        }
      }

      // 6. Record tier snapshot
      let unseen = 0, t1 = 0, t2a = 0, t2b = 0, t3 = 0;
      for (const f of facts) {
        if (!f.seen) { unseen++; continue; }
        const tier = getCardTier(f.state);
        if (tier === '1') t1++;
        else if (tier === '2a') t2a++;
        else if (tier === '2b') t2b++;
        else if (tier === '3') t3++;
      }

      tierSnapshots.push({ day, run: globalRunCount, unseen, tier1: t1, tier2a: t2a, tier2b: t2b, tier3: t3 });
    }

    // Record domain curves once per day (after all runs)
    for (const domain of domainNames) {
      const domFacts = facts.filter(f => f.domain === domain);
      const mastered = domFacts.filter(f => getCardTier(f.state) === '3').length;
      // Only record if changed from last entry or first day
      const curve = domainCurves[domain];
      if (curve.length === 0 || curve[curve.length - 1].masteredCount !== mastered) {
        curve.push({ day, masteredCount: mastered, totalInDomain: domFacts.length });
      }
    }
  }

  // Encounter frequency stats
  const encounterCounts = facts.filter(f => f.seen).map(f => f.encounters);
  // Include unseen facts as 0
  const allCounts = facts.map(f => f.encounters);
  const avg = allCounts.length > 0 ? allCounts.reduce((a, b) => a + b, 0) / allCounts.length : 0;
  const min = allCounts.length > 0 ? Math.min(...allCounts) : 0;
  const max = allCounts.length > 0 ? Math.max(...allCounts) : 0;
  const variance = allCounts.length > 0
    ? allCounts.reduce((sum, c) => sum + (c - avg) ** 2, 0) / allCounts.length
    : 0;
  const stdDev = Math.sqrt(variance);

  const elapsedMs = performance.now() - startTime;

  return {
    meta: {
      config,
      generatedAt: new Date().toISOString(),
      elapsedMs: Math.round(elapsedMs),
    },
    masteryMilestones: {
      runsToMaster: milestoneRuns,
      daysToMaster: milestoneDays,
    },
    tierDistributionOverTime: tierSnapshots,
    domainCompletionCurves: domainCurves,
    factEncounterFrequency: {
      avg: parseFloat(avg.toFixed(2)),
      min,
      max,
      stdDev: parseFloat(stdDev.toFixed(2)),
    },
  };
}

// ─── Sweep Mode ─────────────────────────────────────────────────────────────

function runAccuracySweep(baseConfig: FSRSSimConfig): FSRSOutput {
  const accuracies = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95];
  const sweepResults: Array<{
    accuracy: number;
    runsToMaster100: number | null;
    daysToMaster100: number | null;
  }> = [];

  // Use shorter simulation for sweep
  const sweepConfig: FSRSSimConfig = { ...baseConfig, daysToSimulate: Math.min(baseConfig.daysToSimulate, 90) };

  let lastFullResult: FSRSOutput | null = null;

  for (const accuracy of accuracies) {
    process.stderr.write(`  Sweep: accuracy=${accuracy.toFixed(2)}...`);
    const result = runSimulation({ ...sweepConfig, playerAccuracy: accuracy });
    sweepResults.push({
      accuracy,
      runsToMaster100: result.masteryMilestones.runsToMaster['100'] ?? null,
      daysToMaster100: result.masteryMilestones.daysToMaster['100'] ?? null,
    });
    lastFullResult = result;
    process.stderr.write(` done\n`);
  }

  // Return the last simulation's full data + sweep overlay
  const primaryResult = runSimulation(baseConfig);
  primaryResult.accuracyVsMasterySpeed = sweepResults;
  return primaryResult;
}

// ─── Human-Readable Summary ─────────────────────────────────────────────────

function printSummary(output: FSRSOutput): void {
  const c = output.meta.config;
  const w = (s: string) => process.stderr.write(s + '\n');

  w('');
  w('FSRS PROGRESSION SIMULATION');
  w('\u2550'.repeat(40));
  w(`Config: ${c.totalFacts} facts, accuracy=${c.playerAccuracy.toFixed(2)}, ${c.runsPerDay} runs/day, ${c.daysToSimulate} days`);
  w(`Elapsed: ${(output.meta.elapsedMs / 1000).toFixed(1)}s`);
  w('');

  w('MASTERY MILESTONES:');
  for (const k of MILESTONE_KEYS) {
    const label = k === 'all' ? 'All facts' : `${k} facts`;
    const run = output.masteryMilestones.runsToMaster[k];
    const day = output.masteryMilestones.daysToMaster[k];
    if (run !== null && day !== null) {
      w(`  ${label.padEnd(12)} Run ${String(run).padStart(4)} (Day ${day})`);
    } else {
      w(`  ${label.padEnd(12)} Not reached in ${c.daysToSimulate} days`);
    }
  }
  w('');

  // Final tier distribution
  const finalSnap = output.tierDistributionOverTime[output.tierDistributionOverTime.length - 1];
  if (finalSnap) {
    const total = c.totalFacts;
    const pct = (n: number) => `${n} (${((n / total) * 100).toFixed(1)}%)`;
    w(`FINAL TIER DISTRIBUTION (Day ${finalSnap.day}):`);
    w(`  Unseen:   ${pct(finalSnap.unseen)}`);
    w(`  Tier 1:   ${pct(finalSnap.tier1)}`);
    w(`  Tier 2a:  ${pct(finalSnap.tier2a)}`);
    w(`  Tier 2b:  ${pct(finalSnap.tier2b)}`);
    w(`  Tier 3:   ${pct(finalSnap.tier3)}`);
    w('');
  }

  // Domain progress
  w('DOMAIN PROGRESS:');
  const domains = Object.keys(c.domains);
  for (const domain of domains) {
    const curve = output.domainCompletionCurves[domain];
    const last = curve && curve.length > 0 ? curve[curve.length - 1] : null;
    const mastered = last ? last.masteredCount : 0;
    const totalD = c.domains[domain];
    const pct = totalD > 0 ? ((mastered / totalD) * 100).toFixed(1) : '0.0';
    w(`  ${domain.padEnd(25)} ${String(mastered).padStart(4)}/${totalD} mastered (${pct}%)`);
  }
  w('');

  // Encounter stats
  const enc = output.factEncounterFrequency;
  w('FACT ENCOUNTERS:');
  w(`  Avg encounters/fact: ${enc.avg}`);
  w(`  Min: ${enc.min}, Max: ${enc.max}, StdDev: ${enc.stdDev}`);
  w('');

  // Accuracy sweep results
  if (output.accuracyVsMasterySpeed) {
    w('ACCURACY vs MASTERY SPEED (100 facts):');
    for (const entry of output.accuracyVsMasterySpeed) {
      const runs = entry.runsToMaster100 !== null ? `Run ${entry.runsToMaster100}` : 'Not reached';
      const days = entry.daysToMaster100 !== null ? `Day ${entry.daysToMaster100}` : 'N/A';
      w(`  accuracy=${entry.accuracy.toFixed(2)}  ${runs.padEnd(14)} ${days}`);
    }
    w('');
  }
}

// ─── CLI Argument Parsing ───────────────────────────────────────────────────

function parseArgs(): {
  config: Partial<FSRSSimConfig>;
  sweep: boolean;
  output: string | null;
  quiet: boolean;
} {
  const args = process.argv.slice(2);
  const result: {
    config: Partial<FSRSSimConfig>;
    sweep: boolean;
    output: string | null;
    quiet: boolean;
  } = {
    config: {},
    sweep: false,
    output: null,
    quiet: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--accuracy':
        result.config.playerAccuracy = parseFloat(next);
        i++;
        break;
      case '--days':
        result.config.daysToSimulate = parseInt(next, 10);
        i++;
        break;
      case '--runs-per-day':
        result.config.runsPerDay = parseInt(next, 10);
        i++;
        break;
      case '--facts':
        result.config.totalFacts = parseInt(next, 10);
        i++;
        break;
      case '--facts-per-run':
        result.config.factsPerRun = parseInt(next, 10);
        i++;
        break;
      case '--seed':
        result.config.seed = parseInt(next, 10);
        i++;
        break;
      case '--sweep':
        result.sweep = true;
        break;
      case '--output':
        result.output = next;
        i++;
        break;
      case '--quiet':
        result.quiet = true;
        break;
      default:
        if (arg.startsWith('-')) {
          process.stderr.write(`Unknown option: ${arg}\n`);
          process.stderr.write(`Usage: npx tsx scripts/fsrs-simulate.ts [options]\n`);
          process.stderr.write(`\nOptions:\n`);
          process.stderr.write(`  --accuracy <n>     Player accuracy (0.0-1.0, default 0.7)\n`);
          process.stderr.write(`  --days <n>         Days to simulate (default 180)\n`);
          process.stderr.write(`  --runs-per-day <n> Runs per day (default 2)\n`);
          process.stderr.write(`  --facts <n>        Total facts (default 3000)\n`);
          process.stderr.write(`  --facts-per-run <n> Facts per run (default 100)\n`);
          process.stderr.write(`  --seed <n>         RNG seed (default 42)\n`);
          process.stderr.write(`  --sweep            Run accuracy sweep (0.4 to 0.95)\n`);
          process.stderr.write(`  --output <path>    Output file path\n`);
          process.stderr.write(`  --quiet            Suppress stderr summary\n`);
          process.exit(1);
        }
    }
  }

  // Scale domains if custom --facts was provided
  if (result.config.totalFacts !== undefined) {
    const defaultTotal = Object.values(DEFAULT_DOMAINS).reduce((a, b) => a + b, 0);
    const scale = result.config.totalFacts / defaultTotal;
    const scaledDomains: Record<string, number> = {};
    let allocated = 0;
    const domainKeys = Object.keys(DEFAULT_DOMAINS);
    for (let i = 0; i < domainKeys.length; i++) {
      const key = domainKeys[i];
      if (i === domainKeys.length - 1) {
        // Last domain gets the remainder to match totalFacts exactly
        scaledDomains[key] = result.config.totalFacts - allocated;
      } else {
        const scaled = Math.round(DEFAULT_DOMAINS[key] * scale);
        scaledDomains[key] = scaled;
        allocated += scaled;
      }
    }
    result.config.domains = scaledDomains;
  }

  return result;
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main(): void {
  const { config: overrides, sweep, output: outputPath, quiet } = parseArgs();
  const config = buildDefaultConfig(overrides);

  let result: FSRSOutput;

  if (sweep) {
    process.stderr.write('Running accuracy sweep...\n');
    result = runAccuracySweep(config);
  } else {
    process.stderr.write(`Simulating ${config.totalFacts} facts over ${config.daysToSimulate} days...\n`);
    result = runSimulation(config);
  }

  if (!quiet) {
    printSummary(result);
  }

  const json = JSON.stringify(result, null, 2);
  if (outputPath) {
    writeFileSync(outputPath, json, 'utf-8');
    process.stderr.write(`JSON output written to ${outputPath}\n`);
  } else {
    process.stdout.write(json);
  }
}

main();
