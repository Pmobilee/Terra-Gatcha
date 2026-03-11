#!/usr/bin/env npx tsx
// === Balance Battery Runner ===
// Wraps mass-simulate.ts with named test batteries, git metadata,
// result persistence, baseline management, and mechanical diffing.
//
// Usage:
//   npx tsx scripts/balance-battery.ts --battery full-sweep
//   npx tsx scripts/balance-battery.ts --battery targeted --relics flame_brand,war_drum
//   npx tsx scripts/balance-battery.ts --set-baseline
//   npx tsx scripts/balance-battery.ts --diff
//   npx tsx scripts/balance-battery.ts --list
//   npx tsx scripts/balance-battery.ts --help

import { execSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Directories ────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const RUNS_DIR = path.join(ROOT, 'data', 'balance-reports', 'runs');
const BASELINES_DIR = path.join(ROOT, 'data', 'balance-reports', 'baselines');

// ─── Battery Definitions ────────────────────────────────────────────────────

interface BatteryDef {
  description: string;
  mode: string;
  seeds: number;
  ascension: number[];
}

const BATTERIES: Record<string, BatteryDef> = {
  sanity: { description: 'Quick pre-commit sanity check', mode: 'solo', seeds: 20, ascension: [0] },
  'full-sweep': { description: 'Comprehensive balance sweep', mode: 'sweep', seeds: 50, ascension: [0] },
  'deep-combos': { description: 'High-confidence synergy analysis', mode: 'combos', seeds: 200, ascension: [0] },
  'ascension-stress': { description: 'Full sweep at all ascension breakpoints', mode: 'sweep', seeds: 50, ascension: [0, 5, 10, 15, 20] },
  'fairness-audit': { description: 'High-confidence fairness across skill levels', mode: 'fairness', seeds: 200, ascension: [0, 10] },
  'progression': { description: 'Progression curve smoothness', mode: 'progression', seeds: 100, ascension: [0, 5, 10] },
  'targeted': { description: 'Test specific relics at high confidence', mode: 'custom', seeds: 200, ascension: [0, 10] },
  'deep-combat': { description: 'Deep combat analysis: floors, enemies, card types, fun factor', mode: 'deep', seeds: 100, ascension: [0] },
  'fsrs-progression': { description: 'FSRS knowledge progression curves', mode: 'fsrs', seeds: 1, ascension: [0] },
  'economy-progression': { description: 'Economy and relic unlock pacing', mode: 'economy', seeds: 1, ascension: [0] },
  'full-audit': { description: 'Complete game audit: combat + FSRS + economy', mode: 'full-audit', seeds: 50, ascension: [0] },
};

// ─── Result Types ───────────────────────────────────────────────────────────

interface BatteryResult {
  battery: string;
  runAt: string;
  gitHash: string;
  gitDirty: boolean;
  balanceFileHash: string;
  relicResolverHash: string;
  simulatorOutput: any;
  summary: {
    sTierCount: number;
    fTierCount: number;
    brokenSynergyCount: number;
    immortalityCount: number;
    avgSurvivalRate: number;
    topRelic: { id: string; score: number } | null;
    bottomRelic: { id: string; score: number } | null;
  };
}

// ─── Git Metadata ───────────────────────────────────────────────────────────

function getGitHash(): string {
  try { return execSync('git rev-parse --short HEAD', { encoding: 'utf-8', cwd: ROOT }).trim(); }
  catch { return 'unknown'; }
}

function isGitDirty(): boolean {
  try { execSync('git diff --quiet', { stdio: 'ignore', cwd: ROOT }); return false; }
  catch { return true; }
}

// ─── File Hashing ───────────────────────────────────────────────────────────

function hashFile(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  } catch {
    return 'not-found';
  }
}

// ─── Summary Computation ────────────────────────────────────────────────────

function computeSummary(output: any): BatteryResult['summary'] {
  const solo = output.soloRelicImpact ?? [];
  const flags = output.flags ?? {};

  const sTier = solo.filter((r: any) => r.tier === 'S').length;
  const fTier = solo.filter((r: any) => r.tier === 'F').length;
  const broken = (flags.brokenSynergies ?? []).length;
  const immortal = (flags.immortality ?? []).length;
  const avgSurv = solo.length > 0
    ? solo.reduce((s: number, r: any) => s + (r.metrics?.survivalRate ?? 0), 0) / solo.length
    : 0;

  const sorted = [...solo].sort((a: any, b: any) => (b.impact?.overall ?? 0) - (a.impact?.overall ?? 0));
  const top = sorted[0] ? { id: sorted[0].relicId, score: sorted[0].impact?.overall ?? 0 } : null;
  const bottom = sorted.length > 0 ? { id: sorted[sorted.length - 1].relicId, score: sorted[sorted.length - 1].impact?.overall ?? 0 } : null;

  return {
    sTierCount: sTier,
    fTierCount: fTier,
    brokenSynergyCount: broken,
    immortalityCount: immortal,
    avgSurvivalRate: Math.round(avgSurv * 1000) / 1000,
    topRelic: top,
    bottomRelic: bottom,
  };
}

// ─── ISO Timestamp (filesystem-safe) ────────────────────────────────────────

function safeTimestamp(): string {
  return new Date().toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, '');
}

// ─── CLI Arg Parsing ────────────────────────────────────────────────────────

interface CliArgs {
  battery: string | null;
  relics: string[];
  setBaseline: boolean;
  diff: boolean;
  list: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    battery: null,
    relics: [],
    setBaseline: false,
    diff: false,
    list: false,
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case '--battery':
        args.battery = next ?? null;
        i++;
        break;
      case '--relics':
        args.relics = (next ?? '').split(',').map(s => s.trim()).filter(Boolean);
        i++;
        break;
      case '--set-baseline':
        args.setBaseline = true;
        break;
      case '--diff':
        args.diff = true;
        break;
      case '--list':
        args.list = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        if (arg.startsWith('--')) {
          process.stderr.write(`Unknown option: ${arg}\n`);
          process.exit(1);
        }
    }
  }

  return args;
}

// ─── Help ───────────────────────────────────────────────────────────────────

function printHelp(): void {
  process.stderr.write(`
Balance Battery Runner — Recall Rogue

Wraps mass-simulate.ts with named test batteries, git metadata,
baseline management, and mechanical diffing.

Usage:
  npx tsx scripts/balance-battery.ts --battery <name>    Run a named battery
  npx tsx scripts/balance-battery.ts --set-baseline      Promote latest full-sweep to baseline
  npx tsx scripts/balance-battery.ts --diff              Diff latest run vs baseline
  npx tsx scripts/balance-battery.ts --list              List saved runs and baselines
  npx tsx scripts/balance-battery.ts --help              Show this help

Options:
  --battery <name>     Battery to run (see list below)
  --relics a,b,c       Relic list for 'targeted' battery
  --set-baseline       Copy most recent full-sweep run to baseline
  --diff               Show mechanical diff between latest run and baseline
  --list               List all saved runs and baselines
  --help, -h           Show this help

Batteries:
`);

  for (const [name, def] of Object.entries(BATTERIES)) {
    const ascStr = def.ascension.join(',');
    process.stderr.write(`  ${name.padEnd(20)} ${def.description}\n`);
    process.stderr.write(`${''.padEnd(22)} mode=${def.mode}  seeds=${def.seeds}  ascension=[${ascStr}]\n`);
  }
  process.stderr.write('\n');
}

// ─── Run Battery ────────────────────────────────────────────────────────────

function runBattery(batteryName: string, relics: string[]): void {
  const def = BATTERIES[batteryName];
  if (!def) {
    process.stderr.write(`Error: unknown battery "${batteryName}"\n`);
    process.stderr.write(`Available batteries: ${Object.keys(BATTERIES).join(', ')}\n`);
    process.exit(1);
  }

  if (batteryName === 'targeted' && relics.length === 0) {
    process.stderr.write('Error: --relics is required for the "targeted" battery\n');
    process.exit(1);
  }

  // Build command(s) based on mode
  const ascStr = def.ascension.join(',');
  const execOpts = {
    encoding: 'utf-8' as const,
    cwd: ROOT,
    timeout: 600_000, // 10 minutes
    maxBuffer: 50 * 1024 * 1024, // 50MB
    stdio: ['pipe', 'pipe', 'inherit'] as const, // pass stderr through for progress
  };

  let cmd: string;
  if (def.mode === 'deep') {
    cmd = `npx tsx scripts/mass-simulate.ts --mode deep --seeds ${def.seeds} --quiet`;
  } else if (def.mode === 'fsrs') {
    cmd = `npx tsx scripts/fsrs-simulate.ts --accuracy 0.7 --days 180 --seed 42 --quiet`;
  } else if (def.mode === 'economy') {
    cmd = `npx tsx scripts/economy-simulate.ts --profiles average,expert --max-runs 500 --seeds 50 --quiet`;
  } else {
    cmd = `npx tsx scripts/mass-simulate.ts --mode ${def.mode} --seeds ${def.seeds} --ascension ${ascStr} --quiet`;
    if (batteryName === 'targeted' && relics.length > 0) {
      cmd += ` --relics ${relics.join(',')}`;
    }
  }

  process.stderr.write(`\n  Battery: ${batteryName}\n`);
  process.stderr.write(`  ${def.description}\n`);
  if (batteryName !== 'full-audit') {
    process.stderr.write(`  Command: ${cmd}\n`);
  }
  process.stderr.write(`  Running...\n\n`);

  // Execute simulator(s)
  let simulatorOutput: any;

  if (batteryName === 'full-audit') {
    // Full audit runs all three simulators sequentially and combines output
    process.stderr.write('  Running combat sweep...\n');
    const combatCmd = `npx tsx scripts/mass-simulate.ts --mode sweep --seeds ${def.seeds} --quiet`;
    let combatOutput: any;
    try {
      combatOutput = JSON.parse(execSync(combatCmd, execOpts) as string);
    } catch (err: any) {
      process.stderr.write(`\n  Combat simulator failed!\n`);
      if (err.stdout) process.stderr.write(`  stdout: ${err.stdout.substring(0, 500)}\n`);
      if (err.stderr) process.stderr.write(`  stderr: ${err.stderr.substring(0, 500)}\n`);
      process.exit(1);
    }

    process.stderr.write('  Running FSRS progression...\n');
    const fsrsCmd = `npx tsx scripts/fsrs-simulate.ts --accuracy 0.7 --days 180 --seed 42 --quiet`;
    let fsrsOutput: any;
    try {
      fsrsOutput = JSON.parse(execSync(fsrsCmd, execOpts) as string);
    } catch (err: any) {
      process.stderr.write(`\n  FSRS simulator failed!\n`);
      if (err.stdout) process.stderr.write(`  stdout: ${err.stdout.substring(0, 500)}\n`);
      if (err.stderr) process.stderr.write(`  stderr: ${err.stderr.substring(0, 500)}\n`);
      process.exit(1);
    }

    process.stderr.write('  Running economy progression...\n');
    const econCmd = `npx tsx scripts/economy-simulate.ts --profiles average,expert --max-runs 500 --seeds 50 --quiet`;
    let econOutput: any;
    try {
      econOutput = JSON.parse(execSync(econCmd, execOpts) as string);
    } catch (err: any) {
      process.stderr.write(`\n  Economy simulator failed!\n`);
      if (err.stdout) process.stderr.write(`  stdout: ${err.stdout.substring(0, 500)}\n`);
      if (err.stderr) process.stderr.write(`  stderr: ${err.stderr.substring(0, 500)}\n`);
      process.exit(1);
    }

    simulatorOutput = { combat: combatOutput, fsrs: fsrsOutput, economy: econOutput };
  } else {
    // Single simulator run
    let stdout: string;
    try {
      stdout = execSync(cmd, execOpts) as string;
    } catch (err: any) {
      process.stderr.write(`\n  Simulator failed!\n`);
      if (err.stdout) process.stderr.write(`  stdout: ${err.stdout.substring(0, 500)}\n`);
      if (err.stderr) process.stderr.write(`  stderr: ${err.stderr.substring(0, 500)}\n`);
      process.exit(1);
    }

    try {
      simulatorOutput = JSON.parse(stdout);
    } catch {
      process.stderr.write(`  Error: could not parse simulator JSON output\n`);
      process.stderr.write(`  First 500 chars: ${stdout.substring(0, 500)}\n`);
      process.exit(1);
    }
  }

  // Build result
  const timestamp = safeTimestamp();
  const result: BatteryResult = {
    battery: batteryName,
    runAt: new Date().toISOString(),
    gitHash: getGitHash(),
    gitDirty: isGitDirty(),
    balanceFileHash: hashFile(path.join(ROOT, 'src', 'data', 'balance.ts')),
    relicResolverHash: hashFile(path.join(ROOT, 'src', 'services', 'relicEffectResolver.ts')),
    simulatorOutput,
    summary: computeSummary(simulatorOutput),
  };

  // Ensure output directory exists
  fs.mkdirSync(RUNS_DIR, { recursive: true });

  // Save
  const filename = `${batteryName}-${timestamp}.json`;
  const outPath = path.join(RUNS_DIR, filename);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');

  // Print summary
  const s = result.summary;
  process.stderr.write(`  Done! Results saved to: ${path.relative(ROOT, outPath)}\n\n`);
  process.stderr.write(`  SUMMARY:\n`);
  process.stderr.write(`    Git:               ${result.gitHash}${result.gitDirty ? ' (dirty)' : ''}\n`);
  process.stderr.write(`    balance.ts hash:   ${result.balanceFileHash}\n`);
  process.stderr.write(`    S-tier relics:     ${s.sTierCount}\n`);
  process.stderr.write(`    F-tier relics:     ${s.fTierCount}\n`);
  process.stderr.write(`    Broken synergies:  ${s.brokenSynergyCount}\n`);
  process.stderr.write(`    Immortality flags: ${s.immortalityCount}\n`);
  process.stderr.write(`    Avg survival:      ${(s.avgSurvivalRate * 100).toFixed(1)}%\n`);
  if (s.topRelic) {
    process.stderr.write(`    Top relic:         ${s.topRelic.id} (${s.topRelic.score.toFixed(1)})\n`);
  }
  if (s.bottomRelic) {
    process.stderr.write(`    Bottom relic:      ${s.bottomRelic.id} (${s.bottomRelic.score.toFixed(1)})\n`);
  }
  process.stderr.write('\n');
}

// ─── Set Baseline ───────────────────────────────────────────────────────────

function setBaseline(): void {
  const files = listJsonFiles(RUNS_DIR).filter(f => f.startsWith('full-sweep-'));
  if (files.length === 0) {
    process.stderr.write('Error: no full-sweep runs found in data/balance-reports/runs/\n');
    process.stderr.write('Run a full-sweep battery first: npx tsx scripts/balance-battery.ts --battery full-sweep\n');
    process.exit(1);
  }

  // Most recent (sorted alphabetically = chronologically for ISO timestamps)
  files.sort();
  const latest = files[files.length - 1];
  const srcPath = path.join(RUNS_DIR, latest);

  fs.mkdirSync(BASELINES_DIR, { recursive: true });

  // Extract date from filename: full-sweep-2026-03-11T14-35-00.json -> 2026-03-11
  const dateMatch = latest.match(/full-sweep-(\d{4}-\d{2}-\d{2})/);
  const dateStr = dateMatch ? dateMatch[1] : safeTimestamp().substring(0, 10);

  const datedPath = path.join(BASELINES_DIR, `baseline-${dateStr}.json`);
  const latestPath = path.join(BASELINES_DIR, 'baseline-latest.json');

  fs.copyFileSync(srcPath, datedPath);
  fs.copyFileSync(srcPath, latestPath);

  process.stderr.write(`\n  Baseline set from: ${latest}\n`);
  process.stderr.write(`  Saved to: ${path.relative(ROOT, datedPath)}\n`);
  process.stderr.write(`  Saved to: ${path.relative(ROOT, latestPath)}\n\n`);
}

// ─── Diff ───────────────────────────────────────────────────────────────────

function runDiff(): void {
  const baselinePath = path.join(BASELINES_DIR, 'baseline-latest.json');
  if (!fs.existsSync(baselinePath)) {
    process.stderr.write('Error: no baseline found at data/balance-reports/baselines/baseline-latest.json\n');
    process.stderr.write('Set a baseline first: npx tsx scripts/balance-battery.ts --set-baseline\n');
    process.exit(1);
  }

  const runFiles = listJsonFiles(RUNS_DIR);
  if (runFiles.length === 0) {
    process.stderr.write('Error: no runs found in data/balance-reports/runs/\n');
    process.exit(1);
  }

  runFiles.sort();
  const latestRunFile = runFiles[runFiles.length - 1];
  const latestRunPath = path.join(RUNS_DIR, latestRunFile);

  const baseline: BatteryResult = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
  const latest: BatteryResult = JSON.parse(fs.readFileSync(latestRunPath, 'utf-8'));

  const bDate = baseline.runAt.substring(0, 10);
  const lDate = latest.runAt.substring(0, 10);

  process.stderr.write(`\nBALANCE DIFF: ${latestRunFile.replace('.json', '')} vs baseline-${bDate}\n\n`);

  // Summary delta
  const bs = baseline.summary;
  const ls = latest.summary;

  process.stderr.write('SUMMARY DELTA:\n');
  printDelta('S-tier relics', bs.sTierCount, ls.sTierCount);
  printDelta('F-tier relics', bs.fTierCount, ls.fTierCount);
  printDelta('Broken synergies', bs.brokenSynergyCount, ls.brokenSynergyCount);
  printSurvivalDelta('Avg survival', bs.avgSurvivalRate, ls.avgSurvivalRate);

  // Tier changes
  const baselineSolo = buildRelicMap(baseline.simulatorOutput?.soloRelicImpact ?? []);
  const latestSolo = buildRelicMap(latest.simulatorOutput?.soloRelicImpact ?? []);

  const allRelicIds = new Set([...Object.keys(baselineSolo), ...Object.keys(latestSolo)]);
  const tierChanges: string[] = [];

  for (const relicId of allRelicIds) {
    const old = baselineSolo[relicId];
    const cur = latestSolo[relicId];
    if (!old || !cur) continue;

    const oldTier = old.tier ?? '?';
    const curTier = cur.tier ?? '?';
    if (oldTier !== curTier) {
      const oldScore = (old.impact?.overall ?? 0).toFixed(1);
      const curScore = (cur.impact?.overall ?? 0).toFixed(1);
      const tierOrder = ['S', 'A', 'B', 'C', 'D', 'F'];
      const oldIdx = tierOrder.indexOf(oldTier);
      const curIdx = tierOrder.indexOf(curTier);
      // Higher index = worse tier. Moving to higher index from S = improved (less OP)
      // Moving to lower index from F = improved (less UP)
      let arrow: string;
      if (oldIdx < curIdx) {
        // Was higher tier, now lower — check if old was OP
        arrow = (oldTier === 'S' || oldTier === 'A') ? 'improved' : 'worsened';
      } else {
        arrow = (oldTier === 'F' || oldTier === 'D') ? 'improved' : 'worsened';
      }
      const symbol = arrow === 'improved' ? (oldIdx < curIdx ? '\u2193' : '\u2191') : (oldIdx < curIdx ? '\u2193' : '\u2191');
      tierChanges.push(`  ${relicId.padEnd(22)} ${oldTier} (${oldScore}) \u2192 ${curTier} (${curScore})  ${symbol} ${arrow}`);
    }
  }

  process.stderr.write('\nTIER CHANGES:\n');
  if (tierChanges.length === 0) {
    process.stderr.write('  (no tier changes)\n');
  } else {
    for (const line of tierChanges) {
      process.stderr.write(line + '\n');
    }
  }

  // Flag changes
  const baseFlags = baseline.simulatorOutput?.flags ?? {};
  const latestFlags = latest.simulatorOutput?.flags ?? {};

  const baseAllFlags = new Set([
    ...(baseFlags.overpowered ?? []),
    ...(baseFlags.underpowered ?? []),
    ...(baseFlags.brokenSynergies ?? []),
    ...(baseFlags.immortality ?? []),
  ]);
  const latestAllFlags = new Set([
    ...(latestFlags.overpowered ?? []),
    ...(latestFlags.underpowered ?? []),
    ...(latestFlags.brokenSynergies ?? []),
    ...(latestFlags.immortality ?? []),
  ]);

  const newFlags = [...latestAllFlags].filter(f => !baseAllFlags.has(f));
  const resolvedFlags = [...baseAllFlags].filter(f => !latestAllFlags.has(f));

  // Build a reason map from baseline flags
  const flagReasons = new Map<string, string>();
  for (const f of (baseFlags.overpowered ?? [])) flagReasons.set(f, 'was overpowered');
  for (const f of (baseFlags.underpowered ?? [])) flagReasons.set(f, 'was underpowered');
  for (const f of (baseFlags.brokenSynergies ?? [])) flagReasons.set(f, 'was broken synergy');
  for (const f of (baseFlags.immortality ?? [])) flagReasons.set(f, 'was immortal');

  process.stderr.write('\nNEW FLAGS: ');
  if (newFlags.length === 0) {
    process.stderr.write('(none)\n');
  } else {
    process.stderr.write(newFlags.join(', ') + '\n');
  }

  process.stderr.write('RESOLVED FLAGS: ');
  if (resolvedFlags.length === 0) {
    process.stderr.write('(none)\n');
  } else {
    const resolvedStrs = resolvedFlags.map(f => {
      const reason = flagReasons.get(f);
      return reason ? `${f} (${reason})` : f;
    });
    process.stderr.write(resolvedStrs.join(', ') + '\n');
  }

  process.stderr.write('\n');
}

function printDelta(label: string, oldVal: number, newVal: number): void {
  const delta = newVal - oldVal;
  const sign = delta > 0 ? '+' : delta < 0 ? '' : '';
  process.stderr.write(`  ${label.padEnd(22)} ${oldVal} \u2192 ${newVal}  (${sign}${delta})\n`);
}

function printSurvivalDelta(label: string, oldVal: number, newVal: number): void {
  const oldPct = (oldVal * 100).toFixed(1);
  const newPct = (newVal * 100).toFixed(1);
  const delta = ((newVal - oldVal) * 100).toFixed(1);
  const sign = newVal >= oldVal ? '+' : '';
  process.stderr.write(`  ${label.padEnd(22)} ${oldPct}% \u2192 ${newPct}%  (${sign}${delta}%)\n`);
}

function buildRelicMap(soloArray: any[]): Record<string, any> {
  const map: Record<string, any> = {};
  for (const entry of soloArray) {
    if (entry.relicId) {
      map[entry.relicId] = entry;
    }
  }
  return map;
}

// ─── List ───────────────────────────────────────────────────────────────────

function listRuns(): void {
  process.stderr.write('\nSAVED RUNS:\n');
  printDirListing(RUNS_DIR);

  process.stderr.write('\nBASELINES:\n');
  printDirListing(BASELINES_DIR);

  process.stderr.write('\n');
}

function printDirListing(dir: string): void {
  if (!fs.existsSync(dir)) {
    process.stderr.write('  (directory does not exist)\n');
    return;
  }

  const files = listJsonFiles(dir);
  if (files.length === 0) {
    process.stderr.write('  (empty)\n');
    return;
  }

  files.sort();
  for (const f of files) {
    const stat = fs.statSync(path.join(dir, f));
    const sizeKb = (stat.size / 1024).toFixed(1);
    process.stderr.write(`  ${f.padEnd(55)} ${sizeKb.padStart(8)} KB\n`);
  }
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function listJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main(): void {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.list) {
    listRuns();
    process.exit(0);
  }

  if (args.setBaseline) {
    setBaseline();
    process.exit(0);
  }

  if (args.diff) {
    runDiff();
    process.exit(0);
  }

  if (args.battery) {
    runBattery(args.battery, args.relics);
    process.exit(0);
  }

  // No action specified
  process.stderr.write('Error: no action specified. Use --battery, --set-baseline, --diff, --list, or --help.\n');
  printHelp();
  process.exit(1);
}

main();
