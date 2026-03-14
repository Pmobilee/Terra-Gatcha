const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const LOG_DIR = path.join(ROOT, 'data/playtests/logs');
const REPORT_DIR = path.join(ROOT, 'data/playtests/reports');
const INPUT_LIST = process.argv[2];

if (!INPUT_LIST) {
  console.error('Usage: node tmp/analyze-new-playtests.cjs /tmp/playtest_new_logs.txt');
  process.exit(1);
}

const ALL_CARD_TYPES = ['attack', 'shield', 'heal', 'buff', 'debuff', 'utility', 'regen', 'wild'];

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function analyze(log) {
  const issues = [];
  let issueNum = 0;

  const turns = safeArray(log.turns);
  const summary = log.summary || {};
  const encounters = safeArray(summary.encounterResults);
  const baseRepro = `Profile: ${log.profileId}, Seed: ${log.rngSeed}`;

  const addIssue = (category, severity, title, description, evidence = {}, reproductionSteps = [], suggestedFix) => {
    issueNum += 1;
    const issue = {
      id: `issue-${log.id}-${String(issueNum).padStart(3, '0')}`,
      playthroughId: log.id,
      profileId: log.profileId,
      category,
      severity,
      title: String(title || '').slice(0, 120),
      description: description || '',
      evidence,
      reproductionSteps,
    };
    if (suggestedFix) issue.suggestedFix = suggestedFix;
    issues.push(issue);
  };

  // 1) balance_damage_spike
  for (const t of turns) {
    if (t?.phase !== 'enemy_turn') continue;
    const dmg = Number(t?.outcome?.damageReceived || 0);
    if (dmg <= 0) continue;
    const hpAfter = Number(t?.snapshot?.playerHP || 0);
    const hpBefore = hpAfter + dmg;
    if (hpBefore <= 0) continue;
    const ratio = dmg / hpBefore;
    if (ratio > 0.5) {
      addIssue(
        'balance_damage_spike',
        'high',
        `Enemy hit for ${dmg} (${Math.round(ratio * 100)}% HP) on floor ${t.floor}`,
        `Enemy dealt ${dmg} damage in one enemy turn (seq ${t.seq}), which is ${Math.round(ratio * 100)}% of player HP (${hpBefore}) before the hit.`,
        {
          turnSeqs: [t.seq],
          floor: t.floor,
          encounter: t.encounter,
          metric: `damage=${dmg}, hpBefore=${hpBefore}, ratio=${ratio.toFixed(3)}`,
        },
        [baseRepro, `Floor ${t.floor}, Encounter ${t.encounter}`],
        'Cap spike damage or scale down high-roll enemy intents.'
      );
    }
  }

  // 2) balance_too_easy
  {
    let start = -1;
    for (let i = 0; i <= encounters.length; i += 1) {
      const er = i < encounters.length ? encounters[i] : null;
      const easy = !!er && Number(er.playerHPRemaining || 0) > 72; // 90% of 80 HP
      if (easy && start === -1) start = i;
      if (!easy && start !== -1) {
        const streak = i - start;
        if (streak >= 3) {
          const seq = encounters.slice(start, i);
          addIssue(
            'balance_too_easy',
            'low',
            `${streak} easy encounters in a row (HP > 90%)`,
            `${streak} consecutive encounters ended with HP above 90% threshold.`,
            {
              floor: seq[0]?.floor ?? null,
              encounter: seq[0]?.encounter ?? null,
              floors: seq.map((e) => e.floor),
              metric: `hpRemaining=[${seq.map((e) => e.playerHPRemaining).join(', ')}]`,
            },
            [baseRepro, `Starts floor ${seq[0]?.floor ?? '?'} encounter ${seq[0]?.encounter ?? '?'}`],
            'Increase pressure on this profile/seed segment.'
          );
        }
        start = -1;
      }
    }
  }

  // 3) balance_too_hard
  for (const er of encounters) {
    if (er?.result === 'defeat' && Number(er.floor || 0) <= 3) {
      addIssue(
        'balance_too_hard',
        'medium',
        `Early defeat on floor ${er.floor} encounter ${er.encounter}`,
        `Player lost on early floor ${er.floor} against ${er.enemyId} with accuracy ${Math.round((er.accuracy || 0) * 100)}%.`,
        {
          floor: er.floor,
          encounter: er.encounter,
          metric: `enemy=${er.enemyId}, accuracy=${(er.accuracy || 0).toFixed(3)}, dmgTaken=${er.damageTaken}`,
        },
        [baseRepro, `Floor ${er.floor}, Encounter ${er.encounter}`],
        'Soften early enemy scaling or improve assist recovery.'
      );
    }
  }

  // 4) balance_healing_insufficient
  {
    const post3 = turns.filter((t) => Number(t?.floor || 0) > 3);
    if (post3.length) {
      const maxHp = Math.max(...post3.map((t) => Number(t?.snapshot?.playerHP || 0)));
      if (maxHp < 48) {
        addIssue(
          'balance_healing_insufficient',
          'medium',
          `HP never recovered above 60% after floor 3 (max ${maxHp})`,
          `After floor 3, player HP never exceeded ${maxHp}.`,
          {
            floor: 4,
            encounter: 0,
            metric: `maxHpPostFloor3=${maxHp}`,
          },
          [baseRepro, 'Floors 4+'],
          'Increase mid-run healing reliability.'
        );
      }
    }
  }

  // 5) balance_combo_unreachable
  if (Number(summary.overallAccuracy || 0) > 0.6 && Number(summary.maxCombo || 0) < 3) {
    addIssue(
      'balance_combo_unreachable',
      'medium',
      `High accuracy (${Math.round((summary.overallAccuracy || 0) * 100)}%) but combo stayed below 3`,
      'Player accuracy exceeded 60% but combo system did not reach expected minimum.',
      {
        floor: null,
        encounter: null,
        metric: `accuracy=${(summary.overallAccuracy || 0).toFixed(3)}, maxCombo=${summary.maxCombo || 0}`,
      },
      [baseRepro],
      'Make combo buildup less brittle.'
    );
  }

  // 6) progression_difficulty_spike
  {
    const byFloor = new Map();
    for (const er of encounters) {
      const floor = Number(er.floor || 0);
      if (!byFloor.has(floor)) byFloor.set(floor, []);
      byFloor.get(floor).push(er);
    }
    const floors = [...byFloor.keys()].sort((a, b) => a - b);
    for (let i = 1; i < floors.length; i += 1) {
      const prevFloor = floors[i - 1];
      const floor = floors[i];
      const prevAvg = mean(byFloor.get(prevFloor).map((e) => Number(e.turnsToResolve || 0)));
      if (!prevAvg) continue;
      for (const er of byFloor.get(floor)) {
        const turnsToResolve = Number(er.turnsToResolve || 0);
        if (turnsToResolve > 2 * prevAvg) {
          addIssue(
            'progression_difficulty_spike',
            'high',
            `Turns spike on floor ${floor} encounter ${er.encounter} (${turnsToResolve} vs ${prevAvg.toFixed(1)})`,
            `Encounter took ${turnsToResolve} turns, over 2x previous floor average (${prevAvg.toFixed(1)}).`,
            {
              floor,
              encounter: er.encounter,
              metric: `turns=${turnsToResolve}, prevFloorAvg=${prevAvg.toFixed(2)}, ratio=${(turnsToResolve / prevAvg).toFixed(2)}`,
            },
            [baseRepro, `Floor ${floor}, Encounter ${er.encounter}`],
            'Smooth per-floor enemy durability growth.'
          );
        }
      }
    }
  }

  // 7) progression_dead_end
  for (const er of encounters) {
    if (Number(er.damageDealt || 0) === 0) {
      addIssue(
        'progression_dead_end',
        'critical',
        `Zero-damage encounter on floor ${er.floor}`,
        `Encounter produced 0 damage dealt (enemy ${er.enemyId}), indicating possible dead-end state.`,
        {
          floor: er.floor,
          encounter: er.encounter,
          metric: `damageDealt=0, cardsPlayed=${er.cardsPlayed || 0}`,
        },
        [baseRepro, `Floor ${er.floor}, Encounter ${er.encounter}`],
        'Guarantee at least one damaging option or fallback damage path.'
      );
    }
  }

  // 8) ux_unfun_moment
  {
    for (let i = 0; i < encounters.length; i += 1) {
      const hpBefore = i === 0 ? 80 : Number(encounters[i - 1].playerHPRemaining || 0);
      const hpAfter = Number(encounters[i].playerHPRemaining || 0);
      if (hpBefore > 56 && hpAfter < 16) {
        addIssue(
          'ux_unfun_moment',
          'low',
          `HP crash from ${hpBefore} to ${hpAfter} in one encounter`,
          'Player HP dropped from >70% to <20% inside one encounter.',
          {
            floor: encounters[i].floor,
            encounter: encounters[i].encounter,
            metric: `hpBefore=${hpBefore}, hpAfter=${hpAfter}`,
          },
          [baseRepro, `Floor ${encounters[i].floor}, Encounter ${encounters[i].encounter}`],
          'Reduce burst lethality or add emergency mitigation.'
        );
      }
    }
  }

  // 9) mechanic_unused
  {
    const counts = Object.fromEntries(ALL_CARD_TYPES.map((t) => [t, 0]));
    for (const t of turns) {
      if (t?.action?.type === 'play_card' && typeof t?.action?.cardType === 'string') {
        if (counts[t.action.cardType] != null) counts[t.action.cardType] += 1;
      }
    }
    for (const [type, count] of Object.entries(counts)) {
      if (count === 0) {
        addIssue(
          'mechanic_unused',
          'low',
          `Card type '${type}' never played in run`,
          'One card type had zero actual play events in this run.',
          {
            floor: null,
            encounter: null,
            metric: `${type}=0`,
          },
          [baseRepro],
          'Review deck composition and type exposure balance.'
        );
      }
    }
  }

  // 10) engagement checks
  const engagement = summary?.deepStats?.engagement;
  if (engagement && typeof engagement === 'object') {
    if (Number(engagement.engagementScore || 0) < 30) {
      addIssue(
        'engagement_boring_run',
        'medium',
        `Engagement score ${engagement.engagementScore} (<30)`,
        'Composite engagement score is in boring range.',
        { floor: summary.finalFloor || null, metric: `engagementScore=${engagement.engagementScore}` },
        [baseRepro]
      );
    }
    if (Number(engagement.slogEncounters || 0) > 2 || Number(engagement.deadTurnPct || 0) > 15) {
      addIssue(
        'engagement_tedious_grind',
        'medium',
        `Slog/dead-turn thresholds exceeded`,
        'Run pacing indicates tedious grind conditions.',
        { floor: summary.finalFloor || null, metric: `slog=${engagement.slogEncounters || 0}, deadTurnPct=${engagement.deadTurnPct || 0}` },
        [baseRepro]
      );
    }
    if (Number(engagement.snowballEncounters || 0) > 0.5 * Math.max(1, Number(summary.totalEncounters || 0))) {
      addIssue(
        'engagement_too_easy',
        'low',
        'Snowball encounters exceed 50%',
        'Run appears too easy from engagement pacing metrics.',
        { floor: summary.finalFloor || null, metric: `snowball=${engagement.snowballEncounters || 0}` },
        [baseRepro]
      );
    }
    if (Number(engagement.factRepeatRate || 0) > 0.4) {
      addIssue(
        'engagement_fact_staleness',
        'low',
        `Fact repeat rate ${(engagement.factRepeatRate * 100).toFixed(1)}%`,
        'Fact variety is low and repetition is high.',
        { floor: summary.finalFloor || null, metric: `factRepeatRate=${engagement.factRepeatRate}` },
        [baseRepro]
      );
    }
    if (Number(engagement.wrongStreakMax || 0) > 5) {
      addIssue(
        'engagement_frustrating_streaks',
        'medium',
        `Wrong streak max ${engagement.wrongStreakMax} (>5)`,
        'Long wrong-answer streaks indicate frustration risk.',
        { floor: summary.finalFloor || null, metric: `wrongStreakMax=${engagement.wrongStreakMax}` },
        [baseRepro]
      );
    }
    if ((log.profileId === 'expert' || log.profileId === 'average') && Number(engagement.funScore || 0) < 25) {
      addIssue(
        'engagement_low_fun',
        'high',
        `Fun score ${engagement.funScore} (<25) for ${log.profileId}`,
        'Run was not fun for a core profile.',
        { floor: summary.finalFloor || null, metric: `funScore=${engagement.funScore}` },
        [baseRepro]
      );
    }
  }

  return {
    playthroughId: log.id,
    profileId: log.profileId,
    analyzedAt: new Date().toISOString(),
    issueCount: issues.length,
    engagementSummary: engagement || null,
    issues,
  };
}

function main() {
  const files = fs.readFileSync(INPUT_LIST, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const out = [];

  for (const file of files) {
    const full = path.join(LOG_DIR, file);
    if (!fs.existsSync(full)) {
      console.warn(`Missing log: ${file}`);
      continue;
    }
    const log = JSON.parse(fs.readFileSync(full, 'utf8'));
    const report = analyze(log);
    const reportName = `report-${report.playthroughId}.json`;
    fs.writeFileSync(path.join(REPORT_DIR, reportName), JSON.stringify(report, null, 2));
    out.push({ file, reportName, issues: report.issueCount, profile: report.profileId });
  }

  console.log(JSON.stringify({ generated: out.length, reports: out }, null, 2));
}

main();
