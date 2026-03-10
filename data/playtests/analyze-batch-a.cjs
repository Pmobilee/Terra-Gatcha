/**
 * Playtest Log Analyzer — Batch A (13 logs)
 * Reads each log, applies the analysis checklist, writes report JSON files.
 */
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, 'logs');
const REPORT_DIR = path.join(__dirname, 'reports');

const BATCH_A_FILES = [
  'playthrough-average-100-1773147436903.json',
  'playthrough-average-201-1773147448175.json',
  'playthrough-average-303-1773147468738.json',
  'playthrough-average-400-1773147471156.json',
  'playthrough-average-500-1773147472444.json',
  'playthrough-average-600-1773147473528.json',
  'playthrough-average-704-1773147481564.json',
  'playthrough-beginner-100-1773147435674.json',
  'playthrough-beginner-203-1773147450665.json',
  'playthrough-beginner-300-1773147464896.json',
  'playthrough-beginner-304-1773147469779.json',
  'playthrough-beginner-703-1773147480431.json',
  'playthrough-expert-100-1773147438103.json',
];

const MAX_HP = 80;

function analyzeLog(data) {
  const issues = [];
  const { id, profileId, summary, turns } = data;
  let issueNum = 0;

  function addIssue(category, severity, title, description, evidence, reproSteps, suggestedFix) {
    issueNum++;
    issues.push({
      id: `issue-${id}-${issueNum}`,
      category,
      severity,
      title: title.slice(0, 120),
      description,
      evidence,
      reproductionSteps: reproSteps || [`Profile: ${profileId}, Seed: ${data.rngSeed}`],
      suggestedFix: suggestedFix || undefined,
    });
  }

  // ===== CHECK 1: Damage spikes =====
  // In turns where phase === 'enemy_turn', check if damageReceived > 0.5 * previous snapshot.playerHP
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    if (t.phase === 'enemy_turn' && t.outcome.damageReceived > 0) {
      // Find the snapshot BEFORE this turn (previous turn's snapshot or this turn's pre-state)
      // The snapshot in the turn represents the state AFTER the action, so we need previous snapshot
      const prevHP = i > 0 ? turns[i - 1].snapshot.playerHP : MAX_HP;
      if (prevHP > 0 && t.outcome.damageReceived > 0.5 * prevHP) {
        addIssue(
          'balance_damage_spike',
          'high',
          `Enemy dealt ${t.outcome.damageReceived} damage (${Math.round(100 * t.outcome.damageReceived / prevHP)}% of ${prevHP} HP) on floor ${t.floor}`,
          `At turn seq ${t.seq}, floor ${t.floor} encounter ${t.encounter}, enemy dealt ${t.outcome.damageReceived} damage when player had ${prevHP} HP. This is ${Math.round(100 * t.outcome.damageReceived / prevHP)}% of player's HP, exceeding the 50% threshold.`,
          {
            turnSeqs: [i > 0 ? turns[i - 1].seq : 0, t.seq],
            floor: t.floor,
            encounter: t.encounter,
            metric: `Enemy dealt ${t.outcome.damageReceived} damage (${Math.round(100 * t.outcome.damageReceived / prevHP)}% of player's ${prevHP} HP)`,
          },
          [`Profile: ${profileId}, Seed: ${data.rngSeed}`, `Reach floor ${t.floor}, encounter ${t.encounter}, turn ${t.turnNumber}`],
          'Review enemy damage scaling; consider capping single-hit damage relative to player max HP'
        );
      }
    }
  }

  // ===== CHECK 2: Too easy — 3+ consecutive encounters with playerHPRemaining > 0.9 * 80 =====
  const encounters = summary.encounterResults;
  for (let i = 0; i <= encounters.length - 3; i++) {
    const run = [encounters[i], encounters[i + 1], encounters[i + 2]];
    if (run.every(e => e.playerHPRemaining > 0.9 * MAX_HP)) {
      addIssue(
        'balance_too_easy',
        'low',
        `3+ consecutive encounters with >90% HP remaining (floors ${run[0].floor}-${run[2].floor})`,
        `Encounters at F${run[0].floor}E${run[0].encounter}, F${run[1].floor}E${run[1].encounter}, F${run[2].floor}E${run[2].encounter} all ended with player HP above ${0.9 * MAX_HP}. HP remaining: ${run.map(e => e.playerHPRemaining).join(', ')}. Enemies may be too weak for this profile.`,
        {
          floors: run.map(e => e.floor),
          encounters: run.map(e => e.encounter),
          hpRemaining: run.map(e => e.playerHPRemaining),
          metric: `All 3 encounters ended with HP > ${0.9 * MAX_HP}: ${run.map(e => e.playerHPRemaining).join(', ')}`,
        },
        [`Profile: ${profileId}, Seed: ${data.rngSeed}`, `Play through floors ${run[0].floor}-${run[2].floor}`],
        'Increase enemy damage or HP on these floors to create more tension'
      );
      // Only flag once per consecutive run, skip ahead
      i += 2;
    }
  }

  // ===== CHECK 3: Too hard early — Player defeated on floors 1-3 =====
  if (summary.result === 'defeat' && summary.finalFloor <= 3) {
    const severity = summary.finalFloor === 1 ? 'high' : 'medium';
    const defeatEncounter = encounters.find(e => e.result === 'defeat');
    addIssue(
      'balance_too_hard',
      severity,
      `Player defeated on floor ${summary.finalFloor}${summary.finalFloor === 1 ? ' (early death)' : ''}`,
      `${profileId} profile was defeated on floor ${summary.finalFloor} with ${summary.overallAccuracy * 100}% accuracy. ${defeatEncounter ? `Final encounter against ${defeatEncounter.enemyId} (${defeatEncounter.enemyCategory}), dealt ${defeatEncounter.damageDealt} but took ${defeatEncounter.damageTaken} damage.` : ''} Early deaths discourage new players.`,
      {
        floor: summary.finalFloor,
        encounter: defeatEncounter ? defeatEncounter.encounter : -1,
        accuracy: summary.overallAccuracy,
        enemyId: defeatEncounter ? defeatEncounter.enemyId : 'unknown',
        metric: `Defeated on floor ${summary.finalFloor} with ${(summary.overallAccuracy * 100).toFixed(1)}% accuracy`,
      },
      [`Profile: ${profileId}, Seed: ${data.rngSeed}`, `Play through floor ${summary.finalFloor}`],
      summary.finalFloor === 1
        ? 'Reduce floor 1 enemy damage or HP significantly; new players should rarely die on floor 1'
        : 'Consider reducing early floor difficulty or adding more healing opportunities'
    );
  }

  // ===== CHECK 4: Healing insufficient — Player never heals above 60% HP (48) after floor 3 =====
  if (summary.finalFloor > 3) {
    const postFloor3Encounters = encounters.filter(e => e.floor > 3);
    const maxHPPostFloor3 = postFloor3Encounters.length > 0
      ? Math.max(...postFloor3Encounters.map(e => e.playerHPRemaining))
      : 0;
    if (maxHPPostFloor3 > 0 && maxHPPostFloor3 <= 48) {
      addIssue(
        'balance_healing_insufficient',
        'medium',
        `Player never exceeds 60% HP after floor 3 (max: ${maxHPPostFloor3})`,
        `After floor 3, the highest HP the player reached was ${maxHPPostFloor3} (${(maxHPPostFloor3 / MAX_HP * 100).toFixed(1)}% of ${MAX_HP}). Healing seems insufficient to sustain longer runs. Post-floor-3 encounters: ${postFloor3Encounters.length}.`,
        {
          maxHPPostFloor3,
          postFloor3EncounterCount: postFloor3Encounters.length,
          metric: `Max HP after floor 3: ${maxHPPostFloor3}/${MAX_HP} (${(maxHPPostFloor3 / MAX_HP * 100).toFixed(1)}%)`,
        },
        [`Profile: ${profileId}, Seed: ${data.rngSeed}`, 'Progress past floor 3 and observe HP recovery'],
        'Add more healing cards or campfire rest opportunities between floors'
      );
    }
  }

  // ===== CHECK 5: Combo unreachable =====
  // maxCombo stuck at exactly 3 across ALL runs = systemic bug (checked globally, flagged per log)
  // For expert/speed-runner: always flag as they need combos for damage
  if (summary.maxCombo === 3) {
    const isExpertOrSpeedRunner = profileId === 'expert' || profileId === 'speed-runner';
    // Check if ALL encounters also capped at 3
    const allEncountersCappedAt3 = encounters.every(e => e.maxCombo <= 3);

    if (isExpertOrSpeedRunner) {
      addIssue(
        'balance_combo_unreachable',
        'critical',
        `Systemic combo cap at 3 — expert/speed-runner profile cannot reach higher combos`,
        `Max combo across entire run is exactly 3 (${summary.totalCardsPlayed} cards played, ${summary.overallAccuracy * 100}% accuracy). All ${encounters.length} encounters also capped at maxCombo <= 3. This is a systemic bug — the combo system appears hard-capped at 3, preventing expert players from achieving the designed 1.5x/2.0x multipliers at combo 4/5. This severely limits damage output and is likely the root cause of expert defeats.`,
        {
          maxCombo: summary.maxCombo,
          totalCardsPlayed: summary.totalCardsPlayed,
          overallAccuracy: summary.overallAccuracy,
          allEncountersCapped: allEncountersCappedAt3,
          metric: `maxCombo = 3 with ${(summary.overallAccuracy * 100).toFixed(1)}% accuracy over ${summary.totalCardsPlayed} cards — combo system broken`,
        },
        [`Profile: ${profileId}, Seed: ${data.rngSeed}`, 'Achieve 4+ consecutive correct answers in a single turn'],
        'Investigate combo counter logic — likely a reset or cap bug preventing combo > 3. Check if combo resets on turn boundary or is capped in encounter bridge.'
      );
    } else if (allEncountersCappedAt3 && summary.overallAccuracy > 0.6) {
      addIssue(
        'balance_combo_unreachable',
        'high',
        `Max combo stuck at 3 despite ${(summary.overallAccuracy * 100).toFixed(0)}% accuracy — likely systemic combo cap bug`,
        `Max combo across entire run is exactly 3 (${summary.totalCardsPlayed} cards played, ${(summary.overallAccuracy * 100).toFixed(1)}% accuracy). All ${encounters.length} encounters also capped at maxCombo <= 3. With this accuracy, higher combos should be achievable. This appears to be a systemic bug in the combo counting logic.`,
        {
          maxCombo: summary.maxCombo,
          totalCardsPlayed: summary.totalCardsPlayed,
          overallAccuracy: summary.overallAccuracy,
          allEncountersCapped: allEncountersCappedAt3,
          metric: `maxCombo = 3 with ${(summary.overallAccuracy * 100).toFixed(1)}% accuracy — systemic cap suspected`,
        },
        [`Profile: ${profileId}, Seed: ${data.rngSeed}`, 'Achieve consecutive correct answers and observe combo counter'],
        'Investigate combo counter logic — appears to be capped at 3 instead of scaling to 5'
      );
    }
  }

  // ===== CHECK 6: Difficulty spike — turnsToResolve > 2x average of previous floor =====
  const floorMap = {};
  for (const enc of encounters) {
    if (!floorMap[enc.floor]) floorMap[enc.floor] = [];
    floorMap[enc.floor].push(enc);
  }
  const floorNums = Object.keys(floorMap).map(Number).sort((a, b) => a - b);
  for (let fi = 1; fi < floorNums.length; fi++) {
    const prevFloor = floorNums[fi - 1];
    const currFloor = floorNums[fi];
    const prevAvg = floorMap[prevFloor].reduce((s, e) => s + e.turnsToResolve, 0) / floorMap[prevFloor].length;
    for (const enc of floorMap[currFloor]) {
      if (prevAvg > 0 && enc.turnsToResolve > 2 * prevAvg) {
        addIssue(
          'progression_difficulty_spike',
          'high',
          `Difficulty spike: F${currFloor}E${enc.encounter} took ${enc.turnsToResolve} turns (prev floor avg: ${prevAvg.toFixed(1)})`,
          `Encounter at floor ${currFloor} encounter ${enc.encounter} (${enc.enemyId}, ${enc.enemyCategory}) took ${enc.turnsToResolve} turns to resolve, which is ${(enc.turnsToResolve / prevAvg).toFixed(1)}x the previous floor's average of ${prevAvg.toFixed(1)} turns. This indicates a sudden difficulty spike.`,
          {
            floor: currFloor,
            encounter: enc.encounter,
            turnsToResolve: enc.turnsToResolve,
            previousFloorAvg: Math.round(prevAvg * 10) / 10,
            ratio: Math.round(enc.turnsToResolve / prevAvg * 10) / 10,
            enemyId: enc.enemyId,
            metric: `${enc.turnsToResolve} turns vs ${prevAvg.toFixed(1)} avg (${(enc.turnsToResolve / prevAvg).toFixed(1)}x)`,
          },
          [`Profile: ${profileId}, Seed: ${data.rngSeed}`, `Reach floor ${currFloor}, encounter ${enc.encounter}`],
          'Smooth out enemy stat scaling between floors to avoid jarring difficulty jumps'
        );
      }
    }
  }

  // ===== CHECK 7: Dead end — encounter with damageDealt === 0 =====
  for (const enc of encounters) {
    if (enc.damageDealt === 0) {
      addIssue(
        'progression_dead_end',
        'critical',
        `Dead end: Zero damage dealt in F${enc.floor}E${enc.encounter} against ${enc.enemyId}`,
        `Player dealt 0 damage in floor ${enc.floor} encounter ${enc.encounter} against ${enc.enemyId} (${enc.enemyCategory}). This means the player could not progress. Cards played: ${enc.cardsPlayed}, correct: ${enc.correctAnswers}, wrong: ${enc.wrongAnswers}.`,
        {
          floor: enc.floor,
          encounter: enc.encounter,
          enemyId: enc.enemyId,
          cardsPlayed: enc.cardsPlayed,
          metric: `0 damage dealt with ${enc.cardsPlayed} cards played`,
        },
        [`Profile: ${profileId}, Seed: ${data.rngSeed}`, `Reach floor ${enc.floor}, encounter ${enc.encounter}`],
        'Ensure players always have at least one viable damage option regardless of hand composition'
      );
    }
  }

  // ===== CHECK 8: Unfun moment — HP drops from >70% to <20% in single encounter =====
  for (let i = 0; i < encounters.length; i++) {
    const enc = encounters[i];
    // HP at start of encounter = previous encounter's HPRemaining, or MAX_HP for first
    const hpBefore = i === 0 ? MAX_HP : encounters[i - 1].playerHPRemaining;
    const hpAfter = enc.playerHPRemaining;
    // Use playerMaxHP from the snapshot context - HP may be reduced from MAX_HP
    // >70% means > 0.7 * MAX_HP, <20% means < 0.2 * MAX_HP
    if (hpBefore > 0.7 * MAX_HP && hpAfter < 0.2 * MAX_HP && hpAfter >= 0) {
      addIssue(
        'ux_unfun_moment',
        'low',
        `Unfun moment: HP dropped from ${hpBefore} (${Math.round(hpBefore/MAX_HP*100)}%) to ${hpAfter} (${Math.round(hpAfter/MAX_HP*100)}%) in F${enc.floor}E${enc.encounter}`,
        `Player HP dropped from ${hpBefore} to ${hpAfter} (${enc.damageTaken} damage taken) in a single encounter against ${enc.enemyId} (${enc.enemyCategory}) on floor ${enc.floor}. This kind of dramatic swing feels punishing and unfun.`,
        {
          floor: enc.floor,
          encounter: enc.encounter,
          hpBefore,
          hpAfter,
          damageTaken: enc.damageTaken,
          enemyId: enc.enemyId,
          metric: `HP ${hpBefore} → ${hpAfter} (lost ${hpBefore - hpAfter})`,
        },
        [`Profile: ${profileId}, Seed: ${data.rngSeed}`, `Reach floor ${enc.floor}, encounter ${enc.encounter}`],
        'Add a damage cap per encounter or emergency shield mechanic when HP drops below threshold'
      );
    }
  }

  // ===== CHECK 9: Dead turns — turns where player plays 0 cards =====
  // Group turns by turnNumber within each encounter to find turns with no card plays
  const turnGroups = {};
  for (const t of turns) {
    const key = `${t.floor}-${t.encounter}-${t.turnNumber}`;
    if (!turnGroups[key]) turnGroups[key] = { floor: t.floor, encounter: t.encounter, turnNumber: t.turnNumber, actions: [] };
    turnGroups[key].actions.push(t);
  }
  let deadTurnCount = 0;
  const deadTurnExamples = [];
  for (const [key, group] of Object.entries(turnGroups)) {
    const hasCardPlay = group.actions.some(a => a.action.type === 'play_card');
    const hasPlayerPhase = group.actions.some(a => a.phase === 'player_action');
    // Only flag if there was a player action phase but no card was played
    // Or if the turn had only enemy/encounter phases with no player card plays
    // Actually: check if any turn has ONLY non-play_card actions in player phases
    const playerActions = group.actions.filter(a => a.phase === 'player_action');
    if (playerActions.length > 0 && !hasCardPlay) {
      deadTurnCount++;
      if (deadTurnExamples.length < 3) {
        deadTurnExamples.push({ floor: group.floor, encounter: group.encounter, turnNumber: group.turnNumber });
      }
    }
  }
  if (deadTurnCount > 0) {
    addIssue(
      'ux_dead_turn',
      'low',
      `${deadTurnCount} dead turn(s) where player had action phase but played 0 cards`,
      `Found ${deadTurnCount} turns where the player had a player_action phase but did not play any cards. Examples: ${deadTurnExamples.map(e => `F${e.floor}E${e.encounter}T${e.turnNumber}`).join(', ')}. Dead turns waste time and feel unproductive.`,
      {
        deadTurnCount,
        examples: deadTurnExamples,
        metric: `${deadTurnCount} turns with 0 cards played`,
      },
      [`Profile: ${profileId}, Seed: ${data.rngSeed}`, 'Observe turns where no cards are played'],
      'Ensure hand always contains playable cards; consider auto-draw mechanics'
    );
  }

  // ===== CHECK 10: Mechanic unused — a card type has 0 plays across entire run =====
  const cardTypesPlayed = {};
  for (const t of turns) {
    if (t.action.type === 'play_card' && t.action.cardType) {
      cardTypesPlayed[t.action.cardType] = (cardTypesPlayed[t.action.cardType] || 0) + 1;
    }
  }
  const expectedTypes = ['attack', 'shield', 'heal', 'utility'];
  for (const typ of expectedTypes) {
    if (!cardTypesPlayed[typ]) {
      addIssue(
        'mechanic_unused',
        'low',
        `Card type "${typ}" was never played across the entire run`,
        `The "${typ}" card type had 0 plays across ${summary.totalCardsPlayed} total cards played in ${encounters.length} encounters. Card types used: ${Object.entries(cardTypesPlayed).map(([k, v]) => `${k}: ${v}`).join(', ')}. This suggests either poor deck composition or the type is undervalued.`,
        {
          unusedType: typ,
          totalCardsPlayed: summary.totalCardsPlayed,
          cardTypeDistribution: cardTypesPlayed,
          metric: `"${typ}" played 0 times out of ${summary.totalCardsPlayed} total`,
        },
        [`Profile: ${profileId}, Seed: ${data.rngSeed}`, 'Complete a full run and observe card type distribution'],
        `Ensure "${typ}" cards are included in starter deck and offered in rewards`
      );
    }
  }

  // ===== CHECK 11: Universal defeat for expert/speed-runner on long runs =====
  if (summary.result === 'defeat' && summary.finalFloor >= 4 && (profileId === 'expert' || profileId === 'speed-runner')) {
    addIssue(
      'balance_too_hard',
      'high',
      `Expert/speed-runner defeated on floor ${summary.finalFloor} despite ${(summary.overallAccuracy * 100).toFixed(0)}% accuracy`,
      `${profileId} profile with ${(summary.overallAccuracy * 100).toFixed(1)}% accuracy was defeated on floor ${summary.finalFloor} after ${encounters.length} encounters. With this level of skill, the player should be able to progress further. The combination of combo cap at 3 and enemy scaling likely makes late-game progression impossible even for skilled players.`,
      {
        floor: summary.finalFloor,
        accuracy: summary.overallAccuracy,
        totalEncounters: encounters.length,
        maxCombo: summary.maxCombo,
        metric: `Defeat on floor ${summary.finalFloor} with ${(summary.overallAccuracy * 100).toFixed(1)}% accuracy and maxCombo ${summary.maxCombo}`,
      },
      [`Profile: ${profileId}, Seed: ${data.rngSeed}`, `Play through to floor ${summary.finalFloor}`],
      'Fix combo cap bug to unlock higher damage multipliers; review late-game enemy HP scaling'
    );
  }

  return issues;
}

// Main
fs.mkdirSync(REPORT_DIR, { recursive: true });

for (const file of BATCH_A_FILES) {
  const filePath = path.join(LOG_DIR, file);
  console.log(`Analyzing ${file}...`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  const issues = analyzeLog(data);

  const report = {
    playthroughId: data.id,
    profileId: data.profileId,
    analyzedAt: new Date().toISOString(),
    issueCount: issues.length,
    issues,
  };

  const reportFile = path.join(REPORT_DIR, `report-${data.id}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`  → ${issues.length} issues found, wrote ${reportFile}`);
}

console.log('\nDone! All reports written to', REPORT_DIR);
