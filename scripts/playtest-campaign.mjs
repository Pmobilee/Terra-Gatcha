#!/usr/bin/env node
/**
 * Playtest Campaign Orchestrator
 * - Deterministic stratified run plan
 * - Executes strict batches of 5 parallel workers
 * - Produces campaign-only analysis + leaderboard outputs
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const PLAYTEST_ROOT = resolve(ROOT, 'data/playtests');
const LOGS_DIR = resolve(PLAYTEST_ROOT, 'logs');
const REPORTS_DIR = resolve(PLAYTEST_ROOT, 'reports');
const QA_DIR = resolve(PLAYTEST_ROOT, 'qa-reports');
const CAMPAIGNS_DIR = resolve(PLAYTEST_ROOT, 'campaigns');

const PROFILES = ['beginner', 'average', 'expert', 'speed-runner', 'struggling', 'impatient'];
const ASCENSIONS = [0, 5, 9, 14, 17, 20];
const ARCHETYPES = ['balanced', 'aggressive', 'defensive', 'control', 'hybrid'];
const DIFFICULTIES = ['normal', 'relaxed'];
const DOMAINS = ['general_knowledge', 'history', 'science'];

const ALL_CARD_TYPES = ['attack', 'shield', 'heal', 'buff', 'debuff', 'utility', 'regen', 'wild'];

function parseArgs(argv) {
  const args = {
    runs: 200,
    parallel: 5,
    campaignId: `campaign-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    seedBase: 42000,
    visualMaxTurns: 120,
    devUrl: 'http://127.0.0.1:5173',
  };

  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--runs' && v) { args.runs = Number(v); i++; }
    else if (k === '--parallel' && v) { args.parallel = Number(v); i++; }
    else if (k === '--campaign-id' && v) { args.campaignId = v; i++; }
    else if (k === '--seed-base' && v) { args.seedBase = Number(v); i++; }
    else if (k === '--visual-max-turns' && v) { args.visualMaxTurns = Number(v); i++; }
    else if (k === '--dev-url' && v) { args.devUrl = v; i++; }
  }

  if (!Number.isFinite(args.runs) || args.runs <= 0) args.runs = 200;
  if (!Number.isFinite(args.seedBase)) args.seedBase = 42000;
  if (!Number.isFinite(args.visualMaxTurns) || args.visualMaxTurns <= 0) args.visualMaxTurns = 120;

  // Requirement: strict 5-wide batching.
  args.parallel = 5;
  return args;
}

function laneCounts(totalRuns) {
  if (totalRuns === 200) return { headless: 180, visual: 20 };
  const visual = Math.max(1, Math.round(totalRuns * 0.1));
  return { headless: Math.max(0, totalRuns - visual), visual };
}

function generateHeadlessConfigs(count, seedBase) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const profile = PROFILES[(i + seedBase) % PROFILES.length];
    const ascension = ASCENSIONS[(Math.floor(i / PROFILES.length) + seedBase) % ASCENSIONS.length];
    const archetype = ARCHETYPES[(Math.floor(i / (PROFILES.length * ASCENSIONS.length)) + seedBase) % ARCHETYPES.length];
    const difficulty = DIFFICULTIES[(Math.floor(i / (PROFILES.length * ASCENSIONS.length * ARCHETYPES.length)) + seedBase) % DIFFICULTIES.length];
    const domain = DOMAINS[(Math.floor(i / (PROFILES.length * ASCENSIONS.length * ARCHETYPES.length * DIFFICULTIES.length)) + seedBase) % DOMAINS.length];

    out.push({
      lane: 'headless',
      index: i,
      seed: seedBase + i,
      profile,
      ascension,
      archetype,
      difficulty,
      domain,
      floors: 12,
    });
  }
  return out;
}

function generateVisualConfigs(count, seedBase) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const archetype = ARCHETYPES[(i + seedBase) % ARCHETYPES.length];
    const difficulty = DIFFICULTIES[(Math.floor(i / ARCHETYPES.length) + seedBase) % DIFFICULTIES.length];
    const domain = DOMAINS[(Math.floor(i / (ARCHETYPES.length * DIFFICULTIES.length)) + seedBase) % DOMAINS.length];

    out.push({
      lane: 'visual',
      index: i,
      seed: seedBase + 500000 + i,
      archetype,
      difficulty,
      domain,
    });
  }
  return out;
}

function buildUnifiedPlan(headless, visual) {
  const plan = [];
  let h = 0;
  let v = 0;

  while (h < headless.length || v < visual.length) {
    if (h >= headless.length) {
      plan.push(visual[v++]);
      continue;
    }
    if (v >= visual.length) {
      plan.push(headless[h++]);
      continue;
    }

    const hRatio = h / headless.length;
    const vRatio = v / visual.length;
    if (hRatio <= vRatio) plan.push(headless[h++]);
    else plan.push(visual[v++]);
  }

  return plan;
}

function runCommand(command, env = {}) {
  return new Promise((resolveRun) => {
    const child = spawn(command, {
      cwd: ROOT,
      shell: true,
      env: { ...process.env, ...env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      resolveRun({ ok: false, code: -1, stdout, stderr: `${stderr}\n${String(err)}` });
    });
    child.on('close', (code) => {
      resolveRun({ ok: code === 0, code, stdout, stderr });
    });
  });
}

function parseHeadlessLogPath(stdout) {
  const m = stdout.match(/Playthrough log written to:\s*(.+\.json)/);
  return m ? m[1].trim() : null;
}

function parseVisualReportPath(stdout) {
  const lines = stdout.trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const hit = [...lines].reverse().find(line => line.endsWith('.json') && line.includes('qa-reports'));
  return hit || null;
}

async function executeRun(config, campaignId, visualMaxTurns, devUrl) {
  const startedAt = new Date().toISOString();

  if (config.lane === 'headless') {
    const cmd = 'npx vitest run tests/playtest/runners/run-headless.test.ts --reporter=basic';
    const env = {
      PLAYTEST_PROFILE: config.profile,
      PLAYTEST_SEED: String(config.seed),
      PLAYTEST_FLOORS: String(config.floors),
      PLAYTEST_ASCENSION: String(config.ascension),
      PLAYTEST_ARCHETYPE: config.archetype,
      PLAYTEST_DIFFICULTY: config.difficulty,
      PLAYTEST_DOMAIN: config.domain,
      PLAYTEST_CAMPAIGN_ID: campaignId,
    };
    const r = await runCommand(cmd, env);
    const logPath = parseHeadlessLogPath(r.stdout);
    if (!r.ok || !logPath || !existsSync(logPath)) {
      return {
        ok: false,
        lane: 'headless',
        config,
        startedAt,
        endedAt: new Date().toISOString(),
        error: r.stderr || r.stdout || 'Headless run failed',
        stdout: r.stdout,
        stderr: r.stderr,
      };
    }

    const log = JSON.parse(readFileSync(logPath, 'utf8'));
    return {
      ok: true,
      lane: 'headless',
      config,
      startedAt,
      endedAt: new Date().toISOString(),
      logPath,
      playthroughId: log.id,
      summary: log.summary,
    };
  }

  const cmd = 'node scripts/run-visual-campaign.cjs';
  const env = {
    PLAYTEST_SEED: String(config.seed),
    PLAYTEST_MAX_TURNS: String(visualMaxTurns),
    PLAYTEST_CAMPAIGN_ID: campaignId,
    PLAYTEST_DEV_URL: devUrl,
  };
  const r = await runCommand(cmd, env);
  const qaPath = parseVisualReportPath(r.stdout);
  if (!r.ok || !qaPath || !existsSync(qaPath)) {
    return {
      ok: false,
      lane: 'visual',
      config,
      startedAt,
      endedAt: new Date().toISOString(),
      error: r.stderr || r.stdout || 'Visual run failed',
      stdout: r.stdout,
      stderr: r.stderr,
    };
  }

  const qa = JSON.parse(readFileSync(qaPath, 'utf8'));
  return {
    ok: true,
    lane: 'visual',
    config,
    startedAt,
    endedAt: new Date().toISOString(),
    qaPath,
    playthroughId: qa.playthroughId,
    summary: { result: qa.result, issueCount: (qa.errors || []).length },
  };
}

function floorToBucket(floor) {
  if (floor == null) return 'global';
  if (floor >= 1 && floor <= 3) return 'early';
  if (floor >= 4 && floor <= 6) return 'mid_early';
  if (floor >= 7 && floor <= 9) return 'mid';
  if (floor >= 10 && floor <= 12) return 'late';
  if (floor >= 13) return 'endgame';
  return 'global';
}

function analyzeHeadlessLog(log) {
  const turns = Array.isArray(log.turns) ? log.turns : [];
  const summary = log.summary || {};
  const encounters = Array.isArray(summary.encounterResults) ? summary.encounterResults : [];
  const issues = [];
  let n = 0;

  const add = (category, severity, title, description, evidence = {}, steps = [], suggestedFix) => {
    n += 1;
    const item = {
      id: `issue-${log.id}-${String(n).padStart(3, '0')}`,
      playthroughId: log.id,
      profileId: log.profileId,
      category,
      severity,
      title: String(title).slice(0, 120),
      description,
      evidence,
      reproductionSteps: steps,
    };
    if (suggestedFix) item.suggestedFix = suggestedFix;
    issues.push(item);
  };

  const reproBase = `Profile: ${log.profileId}, Seed: ${log.rngSeed}`;

  for (const t of turns) {
    if (t?.phase !== 'enemy_turn') continue;
    const dmg = Number(t?.outcome?.damageReceived || 0);
    if (dmg <= 0) continue;
    const hpAfter = Number(t?.snapshot?.playerHP || 0);
    const hpBefore = hpAfter + dmg;
    const ratio = hpBefore > 0 ? dmg / hpBefore : 0;
    if (ratio > 0.5) {
      add(
        'balance_damage_spike',
        'high',
        `Enemy hit for ${dmg} (${Math.round(ratio * 100)}% HP) on floor ${t.floor}`,
        'Single enemy turn exceeded 50% current HP damage threshold.',
        { turnSeqs: [t.seq], floor: t.floor, encounter: t.encounter, metric: `damage=${dmg}, ratio=${ratio.toFixed(3)}` },
        [reproBase, `Floor ${t.floor} Encounter ${t.encounter}`],
        'Reduce enemy burst damage scaling or cap extreme intents.'
      );
    }
  }

  {
    let streakStart = -1;
    for (let i = 0; i <= encounters.length; i++) {
      const er = i < encounters.length ? encounters[i] : null;
      const easy = !!er && Number(er.playerHPRemaining || 0) > 72;
      if (easy && streakStart === -1) streakStart = i;
      if (!easy && streakStart !== -1) {
        const len = i - streakStart;
        if (len >= 3) {
          const seq = encounters.slice(streakStart, i);
          add(
            'balance_too_easy',
            'low',
            `${len} easy encounters in a row (HP > 90%)`,
            'Multiple consecutive encounters ended above 90% HP.',
            { floor: seq[0]?.floor ?? null, encounter: seq[0]?.encounter ?? null, floors: seq.map(e => e.floor), metric: `hp=[${seq.map(e => e.playerHPRemaining).join(', ')}]` },
            [reproBase],
            'Increase pressure for this profile slice.'
          );
        }
        streakStart = -1;
      }
    }
  }

  for (const er of encounters) {
    if (er?.result === 'defeat' && Number(er.floor || 0) <= 3) {
      add(
        'balance_too_hard',
        'medium',
        `Early defeat on floor ${er.floor} encounter ${er.encounter}`,
        'Player defeat occurred on early floor segment.',
        { floor: er.floor, encounter: er.encounter, metric: `enemy=${er.enemyId}, accuracy=${(er.accuracy || 0).toFixed(3)}` },
        [reproBase],
        'Soften early-floor enemy scaling.'
      );
    }
  }

  if (Number(summary.overallAccuracy || 0) > 0.6 && Number(summary.maxCombo || 0) < 3) {
    add(
      'balance_combo_unreachable',
      'medium',
      `High accuracy (${Math.round((summary.overallAccuracy || 0) * 100)}%) but low combo`,
      'Combo threshold was not reached despite >60% accuracy.',
      { floor: null, encounter: null, metric: `accuracy=${(summary.overallAccuracy || 0).toFixed(3)}, maxCombo=${summary.maxCombo || 0}` },
      [reproBase],
      'Make combo progression more forgiving.'
    );
  }

  {
    const byFloor = new Map();
    for (const er of encounters) {
      const floor = Number(er.floor || 0);
      if (!byFloor.has(floor)) byFloor.set(floor, []);
      byFloor.get(floor).push(er);
    }
    const floors = [...byFloor.keys()].sort((a, b) => a - b);
    for (let i = 1; i < floors.length; i++) {
      const prev = floors[i - 1];
      const floor = floors[i];
      const prevList = byFloor.get(prev);
      const prevAvg = prevList.reduce((s, e) => s + Number(e.turnsToResolve || 0), 0) / Math.max(1, prevList.length);
      for (const er of byFloor.get(floor)) {
        const t = Number(er.turnsToResolve || 0);
        if (prevAvg > 0 && t > 2 * prevAvg) {
          add(
            'progression_difficulty_spike',
            'high',
            `Turns spike on floor ${floor} encounter ${er.encounter} (${t} vs ${prevAvg.toFixed(1)})`,
            'Encounter turns exceeded 2x previous floor average.',
            { floor, encounter: er.encounter, metric: `turns=${t}, prevAvg=${prevAvg.toFixed(2)}` },
            [reproBase],
            'Smooth progression curve between floors.'
          );
        }
      }
    }
  }

  for (const er of encounters) {
    if (Number(er.damageDealt || 0) === 0) {
      add(
        'progression_dead_end',
        'critical',
        `Zero-damage encounter on floor ${er.floor}`,
        'Encounter completed with zero damage dealt by player.',
        { floor: er.floor, encounter: er.encounter, metric: `damageDealt=0` },
        [reproBase],
        'Guarantee at least one damage path per hand cycle.'
      );
    }
  }

  {
    const counts = Object.fromEntries(ALL_CARD_TYPES.map(t => [t, 0]));
    for (const t of turns) {
      if (t?.action?.type === 'play_card' && typeof t?.action?.cardType === 'string' && counts[t.action.cardType] != null) {
        counts[t.action.cardType] += 1;
      }
    }
    for (const [k, v] of Object.entries(counts)) {
      if (v === 0) {
        add(
          'mechanic_unused',
          'low',
          `Card type '${k}' never played in run`,
          'Card type had zero play events in this run.',
          { floor: null, encounter: null, metric: `${k}=0` },
          [reproBase],
          'Review deck distribution and role relevance.'
        );
      }
    }
  }

  return {
    playthroughId: log.id,
    profileId: log.profileId,
    analyzedAt: new Date().toISOString(),
    issueCount: issues.length,
    issues,
  };
}

function severityForVisualType(type, message) {
  if (type === 'exception') return 'critical';
  if (type === 'setup_error') return 'high';
  if (type === 'action_error' && /Start Run button not found/i.test(message || '')) return 'high';
  if (type === 'action_error') return 'medium';
  return 'low';
}

function categoryForVisualType(type, message) {
  if (type === 'setup_error') return 'visual_setup_error';
  if (type === 'action_error' && /Start Run button not found/i.test(message || '')) return 'visual_start_run_unavailable';
  if (type === 'action_error') return 'visual_action_error';
  if (type === 'exception') return 'visual_exception';
  return 'visual_issue';
}

function analyzeVisualReport(visual) {
  const issues = [];
  let n = 0;
  const add = (category, severity, title, description, evidence = {}, steps = [], suggestedFix) => {
    n += 1;
    const issue = {
      id: `issue-${visual.playthroughId}-${String(n).padStart(3, '0')}`,
      playthroughId: visual.playthroughId,
      profileId: 'visual-worker',
      category,
      severity,
      title: String(title).slice(0, 120),
      description,
      evidence,
      reproductionSteps: steps,
    };
    if (suggestedFix) issue.suggestedFix = suggestedFix;
    issues.push(issue);
  };

  const baseSteps = [
    `Visual seed: ${visual.seed}`,
    'Open ?skipOnboarding=true&devpreset=post_tutorial&playtest=true',
  ];

  for (const err of visual.errors || []) {
    const category = categoryForVisualType(err.type, err.message);
    const severity = severityForVisualType(err.type, err.message);
    add(
      category,
      severity,
      `${category.replace(/_/g, ' ')} at turn ${err.turn ?? 'n/a'}`,
      err.message || 'Visual run issue detected',
      {
        floor: null,
        encounter: null,
        metric: `screen=${err.screen || 'unknown'} turn=${err.turn ?? 'n/a'}`,
      },
      baseSteps,
      'Review visual playtest controls and state transitions.'
    );
  }

  if ((visual.steps || []).length > 0) {
    const nonHub = (visual.steps || []).filter(s => s.screen !== 'hub' && s.screen !== 'base').length;
    if (nonHub === 0) {
      add(
        'visual_hub_stuck',
        'medium',
        'Visual run remained on hub only',
        'No non-hub screen transitions were observed during the visual run.',
        { floor: null, encounter: null, metric: `steps=${visual.steps.length}, nonHub=0` },
        baseSteps,
        'Confirm start-run controls are available in playtest mode.'
      );
    }
  }

  return {
    playthroughId: visual.playthroughId,
    profileId: 'visual-worker',
    analyzedAt: new Date().toISOString(),
    issueCount: issues.length,
    issues,
  };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const counts = laneCounts(args.runs);

  mkdirSync(LOGS_DIR, { recursive: true });
  mkdirSync(REPORTS_DIR, { recursive: true });
  mkdirSync(QA_DIR, { recursive: true });
  mkdirSync(CAMPAIGNS_DIR, { recursive: true });

  const campaignDir = join(CAMPAIGNS_DIR, args.campaignId);
  mkdirSync(campaignDir, { recursive: true });

  const headless = generateHeadlessConfigs(counts.headless, args.seedBase);
  const visual = generateVisualConfigs(counts.visual, args.seedBase);
  const plan = buildUnifiedPlan(headless, visual);

  const manifest = {
    campaignId: args.campaignId,
    startedAt: new Date().toISOString(),
    generatedAt: new Date().toISOString(),
    runCount: args.runs,
    headlessCount: counts.headless,
    visualCount: counts.visual,
    parallel: 5,
    seedBase: args.seedBase,
    devUrl: args.devUrl,
    plan,
    completedRuns: [],
    failedRuns: [],
    retries: [],
    reports: [],
    leaderboard: null,
    status: 'running',
  };

  const batches = chunk(plan, 5);

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    console.log(`\n[Campaign ${args.campaignId}] Batch ${b + 1}/${batches.length} (size=${batch.length})`);

    const firstPass = await Promise.all(batch.map(cfg => executeRun(cfg, args.campaignId, args.visualMaxTurns, args.devUrl)));

    const rerunTargets = [];
    firstPass.forEach((res, idx) => {
      if (!res.ok) {
        rerunTargets.push(batch[idx]);
      } else {
        manifest.completedRuns.push(res);
      }
    });

    if (rerunTargets.length > 0) {
      console.log(`[Campaign ${args.campaignId}] Retrying ${rerunTargets.length} failed runs once`);
      manifest.retries.push(...rerunTargets.map(cfg => ({
        lane: cfg.lane,
        index: cfg.index,
        seed: cfg.seed,
      })));
      const retryResults = await Promise.all(rerunTargets.map(cfg => executeRun(cfg, args.campaignId, args.visualMaxTurns, args.devUrl)));
      for (const r of retryResults) {
        if (r.ok) manifest.completedRuns.push(r);
        else manifest.failedRuns.push(r);
      }

      for (const r of firstPass) {
        if (!r.ok) manifest.failedRuns.push(r);
      }
    } else {
      // no retries; add failures directly (if any)
      for (const r of firstPass) {
        if (!r.ok) manifest.failedRuns.push(r);
      }
    }

    writeFileSync(join(campaignDir, 'manifest.partial.json'), JSON.stringify(manifest, null, 2));
  }

  // Analyze campaign outputs only.
  const reportFiles = [];

  for (const run of manifest.completedRuns) {
    if (run.lane === 'headless' && run.logPath && existsSync(run.logPath)) {
      const log = JSON.parse(readFileSync(run.logPath, 'utf8'));
      const report = analyzeHeadlessLog(log);
      const reportFile = `report-${report.playthroughId}.json`;
      writeFileSync(join(REPORTS_DIR, reportFile), JSON.stringify(report, null, 2));
      reportFiles.push(reportFile);
      manifest.reports.push({ lane: 'headless', playthroughId: report.playthroughId, reportFile });
    }

    if (run.lane === 'visual' && run.qaPath && existsSync(run.qaPath)) {
      const qa = JSON.parse(readFileSync(run.qaPath, 'utf8'));
      const report = analyzeVisualReport(qa);
      const reportFile = `report-${report.playthroughId}.json`;
      writeFileSync(join(REPORTS_DIR, reportFile), JSON.stringify(report, null, 2));
      reportFiles.push(reportFile);
      manifest.reports.push({ lane: 'visual', playthroughId: report.playthroughId, reportFile });
    }
  }

  const reportListPath = join(campaignDir, 'report-list.txt');
  writeFileSync(reportListPath, reportFiles.sort().join('\n') + '\n');

  const archiveLeaderboardPath = join(PLAYTEST_ROOT, `leaderboard.campaign-${args.campaignId}.json`);
  const buildCmdBase = [
    'node data/playtests/build-leaderboard.cjs',
    `--report-list "${reportListPath}"`,
    `--campaign-id "${args.campaignId}"`,
    `--run-count ${args.runs}`,
    `--headless-count ${counts.headless}`,
    `--visual-count ${counts.visual}`,
  ].join(' ');

  const buildArchive = await runCommand(`${buildCmdBase} --output "${archiveLeaderboardPath}"`);
  if (!buildArchive.ok) {
    throw new Error(`Failed to build archive leaderboard: ${buildArchive.stderr || buildArchive.stdout}`);
  }

  const canonicalLeaderboardPath = join(PLAYTEST_ROOT, 'leaderboard.json');
  copyFileSync(archiveLeaderboardPath, canonicalLeaderboardPath);

  manifest.endedAt = new Date().toISOString();
  manifest.status = 'completed';
  manifest.leaderboard = {
    archivePath: archiveLeaderboardPath,
    canonicalPath: canonicalLeaderboardPath,
    reportListPath,
  };

  writeFileSync(join(campaignDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const summary = {
    campaignId: args.campaignId,
    runCount: args.runs,
    headlessCount: counts.headless,
    visualCount: counts.visual,
    completedRuns: manifest.completedRuns.length,
    failedRuns: manifest.failedRuns.length,
    reportsGenerated: reportFiles.length,
    leaderboard: canonicalLeaderboardPath,
    archiveLeaderboard: archiveLeaderboardPath,
    manifest: join(campaignDir, 'manifest.json'),
  };

  console.log('\n=== Playtest Campaign Complete ===');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error('[playtest-campaign] Fatal error:', err);
  process.exit(1);
});
