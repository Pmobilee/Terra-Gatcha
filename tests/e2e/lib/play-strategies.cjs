/**
 * Pre-built play strategies for AI playtesters.
 * Each strategy takes a tester (from playtest-harness.cjs) and plays the game
 * following a specific pattern. Returns a summary of what happened.
 *
 * Usage:
 *   const { createPlaytester } = require('./playtest-harness.cjs');
 *   const { aggressiveMiner } = require('./play-strategies.cjs');
 *   const tester = await createPlaytester({ preset: 'mid_game_3_rooms' });
 *   const result = await aggressiveMiner(tester, 50);
 */

/**
 * Mine straight down aggressively, answer all quizzes correctly.
 * @param {object} tester - from createPlaytester
 * @param {number} maxBlocks - max blocks to mine before stopping
 * @returns {Promise<object>} summary of the dive
 */
async function aggressiveMiner(tester, maxBlocks = 50) {
  const log = [];
  let blocksMined = 0;
  let quizzesCorrect = 0;
  let quizzesWrong = 0;
  let artifactsFound = 0;

  // Start a dive if not already in mine
  const screen = await tester.getScreen();
  if (screen !== 'mine' && screen !== 'mineActive') {
    await tester.startDive(1);
    await tester.wait(2000);
  }

  for (let i = 0; i < maxBlocks; i++) {
    // Check for quiz first
    const quiz = await tester.getQuiz();
    if (quiz) {
      await tester.answerQuizCorrectly();
      quizzesCorrect++;
      log.push(`Quiz: answered correctly (streak continues)`);
      await tester.wait(500);
      continue;
    }

    // Look at surroundings
    const view = await tester.look();

    // Mine down if possible, otherwise try right, left, up
    const directions = ['down', 'right', 'left', 'up'];
    let mined = false;
    for (const dir of directions) {
      const result = await tester.mineBlock(dir);
      if (result?.ok) {
        blocksMined++;
        log.push(`Mined ${dir}: ${result.message}`);
        mined = true;
        break;
      }
    }

    if (!mined) {
      log.push('Stuck — no valid mining direction');
      break;
    }

    // Check if dive ended (surfaced)
    const currentScreen = await tester.getScreen();
    if (currentScreen !== 'mine' && currentScreen !== 'mineActive') {
      log.push(`Dive ended — now on ${currentScreen}`);
      break;
    }

    await tester.wait(200);
  }

  const summary = await tester.getSessionSummary();
  return {
    strategy: 'aggressiveMiner',
    blocksMined,
    quizzesCorrect,
    quizzesWrong,
    log,
    summary,
  };
}

/**
 * Mine cautiously — use scanner when available, avoid hazards.
 * @param {object} tester
 * @param {number} maxBlocks
 */
async function cautiousMiner(tester, maxBlocks = 50) {
  const log = [];
  let blocksMined = 0;
  let scannersUsed = 0;

  const screen = await tester.getScreen();
  if (screen !== 'mine' && screen !== 'mineActive') {
    await tester.startDive(1);
    await tester.wait(2000);
  }

  for (let i = 0; i < maxBlocks; i++) {
    // Handle quiz
    const quiz = await tester.getQuiz();
    if (quiz) {
      await tester.answerQuizCorrectly();
      log.push('Quiz answered correctly');
      await tester.wait(500);
      continue;
    }

    // Try scanner periodically
    if (i % 10 === 0) {
      const scanResult = await tester.useScanner();
      if (scanResult?.ok) {
        scannersUsed++;
        log.push('Used scanner');
        await tester.wait(300);
      }
    }

    // Prefer down and right (avoid going up)
    const directions = ['down', 'right', 'left'];
    let mined = false;
    for (const dir of directions) {
      const result = await tester.mineBlock(dir);
      if (result?.ok) {
        blocksMined++;
        log.push(`Mined ${dir}: ${result.message}`);
        mined = true;
        break;
      }
    }

    if (!mined) break;

    const currentScreen = await tester.getScreen();
    if (currentScreen !== 'mine' && currentScreen !== 'mineActive') break;

    await tester.wait(200);
  }

  return { strategy: 'cautiousMiner', blocksMined, scannersUsed, log };
}

/**
 * Mine in random directions.
 * @param {object} tester
 * @param {number} maxBlocks
 */
async function randomWalker(tester, maxBlocks = 50) {
  const log = [];
  let blocksMined = 0;
  const dirs = ['up', 'down', 'left', 'right'];

  const screen = await tester.getScreen();
  if (screen !== 'mine' && screen !== 'mineActive') {
    await tester.startDive(1);
    await tester.wait(2000);
  }

  for (let i = 0; i < maxBlocks; i++) {
    const quiz = await tester.getQuiz();
    if (quiz) {
      // 70% chance answer correctly, 30% wrong — more realistic
      if (Math.random() < 0.7) {
        await tester.answerQuizCorrectly();
        log.push('Quiz: correct');
      } else {
        await tester.answerQuizIncorrectly();
        log.push('Quiz: wrong');
      }
      await tester.wait(500);
      continue;
    }

    // Pick random direction
    const shuffled = [...dirs].sort(() => Math.random() - 0.5);
    let mined = false;
    for (const dir of shuffled) {
      const result = await tester.mineBlock(dir);
      if (result?.ok) {
        blocksMined++;
        log.push(`Mined ${dir}`);
        mined = true;
        break;
      }
    }

    if (!mined) break;

    const currentScreen = await tester.getScreen();
    if (currentScreen !== 'mine' && currentScreen !== 'mineActive') break;

    await tester.wait(150);
  }

  return { strategy: 'randomWalker', blocksMined, log };
}

/**
 * Study all due cards with a configurable grade distribution.
 * @param {object} tester
 * @param {object} gradeDistribution - e.g. { again: 0.1, okay: 0.3, good: 0.6 }
 */
async function diligentStudent(tester, gradeDistribution = { again: 0.1, okay: 0.3, good: 0.6 }) {
  const log = [];
  let cardsReviewed = 0;
  const grades = { again: 0, okay: 0, good: 0 };

  // Navigate to study and start a session
  await tester.startStudy('normal');
  await tester.wait(1500);

  for (let i = 0; i < 30; i++) { // safety limit
    const card = await tester.getStudyCard();
    if (!card) {
      log.push('No more cards — session complete');
      break;
    }

    log.push(`Card: ${card.question}`);

    // Reveal the card (wait for flip)
    await tester.wait(500);

    // Pick grade based on distribution
    const roll = Math.random();
    let grade;
    if (roll < gradeDistribution.again) {
      grade = 'again';
    } else if (roll < gradeDistribution.again + gradeDistribution.okay) {
      grade = 'okay';
    } else {
      grade = 'good';
    }

    await tester.gradeCard(grade);
    grades[grade]++;
    cardsReviewed++;
    log.push(`Graded: ${grade}`);
    await tester.wait(500);
  }

  return { strategy: 'diligentStudent', cardsReviewed, grades, log };
}

/**
 * Explore the dome — enter every room, check notifications.
 * @param {object} tester
 */
async function domeExplorer(tester) {
  const log = [];
  const rooms = ['lab', 'workshop', 'farm', 'zoo', 'quarters', 'observatory'];

  await tester.navigate('base');
  await tester.wait(1000);

  const baseView = await tester.look();
  log.push(`Base view: ${baseView.substring(0, 200)}...`);

  for (const room of rooms) {
    await tester.enterRoom(room);
    await tester.wait(500);

    const text = await tester.getAllText();
    log.push(`Room ${room}: ${Object.keys(text.byTestId).length} text elements`);

    const validation = await tester.validateScreen();
    if (!validation.valid) {
      log.push(`Issues in ${room}: ${validation.issues.join(', ')}`);
    }

    await tester.exitRoom();
    await tester.wait(300);
  }

  return { strategy: 'domeExplorer', roomsVisited: rooms.length, log };
}

/**
 * Full play session: dive, study, dome visit.
 * @param {object} tester
 * @param {number} dives - number of dives to do
 */
async function fullSession(tester, dives = 2) {
  const results = {
    strategy: 'fullSession',
    diveResults: [],
    studyResult: null,
    domeResult: null,
    issues: [],
  };

  // Do N dives
  for (let d = 0; d < dives; d++) {
    const diveResult = await aggressiveMiner(tester, 30);
    results.diveResults.push(diveResult);
    await tester.wait(1000);

    // Navigate back to base
    await tester.navigate('base');
    await tester.wait(1000);
  }

  // Study session
  try {
    results.studyResult = await diligentStudent(tester);
  } catch (e) {
    results.issues.push(`Study failed: ${e.message}`);
  }
  await tester.wait(500);

  // Dome exploration
  try {
    results.domeResult = await domeExplorer(tester);
  } catch (e) {
    results.issues.push(`Dome failed: ${e.message}`);
  }

  return results;
}

module.exports = {
  aggressiveMiner,
  cautiousMiner,
  randomWalker,
  diligentStudent,
  domeExplorer,
  fullSession,
};
