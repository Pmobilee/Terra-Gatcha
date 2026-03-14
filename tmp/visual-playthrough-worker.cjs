const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const seed = Number(process.env.PLAYTEST_SEED || 4242);
const maxTurns = Number(process.env.PLAYTEST_MAX_TURNS || 260);
const baseUrl = process.env.PLAYTEST_DEV_URL || 'http://127.0.0.1:5173';
const outDir = process.env.PLAYTEST_OUT_DIR || 'data/playtests/qa-reports';

(async () => {
  const report = {
    type: 'visual_playthrough',
    seed,
    startedAt: new Date().toISOString(),
    baseUrl,
    maxTurns,
    steps: [],
    issues: [],
    screenshots: [],
    result: 'unknown',
    completedAt: null,
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const snapshot = async () => {
    return page.evaluate(() => {
      const api = window.__terraPlay;
      const ids = Array.from(document.querySelectorAll('[data-testid]'))
        .map((el) => {
          const testId = el.getAttribute('data-testid');
          const he = el;
          const style = getComputedStyle(he);
          const visible = style.display !== 'none' && style.visibility !== 'hidden' && he.getBoundingClientRect().width > 0 && he.getBoundingClientRect().height > 0;
          const disabled = he.hasAttribute('disabled');
          return visible ? { testId, disabled } : null;
        })
        .filter(Boolean);
      const visibleIds = ids.map((x) => x.testId);
      return {
        screen: api?.getScreen?.() ?? 'unknown',
        look: api?.look?.() ?? '',
        validation: api?.validateScreen?.() ?? { valid: true, issues: [] },
        visibleIds,
        ids,
      };
    });
  };

  const pushStep = async (turn, action, extra = {}) => {
    const snap = await snapshot();
    report.steps.push({ turn, action, ...snap, ...extra });
    if (snap.validation && snap.validation.valid === false) {
      report.issues.push({
        type: 'screen_validation',
        turn,
        action,
        details: snap.validation.issues || [],
      });
    }
  };

  const runApi = async (fnName, ...args) => {
    return page.evaluate(([name, callArgs]) => {
      const api = window.__terraPlay;
      if (!api || typeof api[name] !== 'function') {
        return { ok: false, message: `Missing API method: ${name}` };
      }
      return api[name](...(callArgs || []));
    }, [fnName, args]);
  };

  try {
    await page.goto(`${baseUrl}?skipOnboarding=true&devpreset=post_tutorial&playtest=true`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(2500);

    const apiReady = await page.evaluate(() => !!window.__terraPlay?.look);
    if (!apiReady) throw new Error('window.__terraPlay unavailable');

    await pushStep(0, 'boot');
    const ss0 = `/tmp/visual-playthrough-${seed}-00.png`;
    await page.screenshot({ path: ss0 });
    report.screenshots.push(ss0);

    for (let turn = 1; turn <= maxTurns; turn++) {
      await page.waitForTimeout(250);
      const state = await snapshot();

      if (state.screen === 'runEnd') {
        await pushStep(turn, 'run-end-screen');
        report.result = 'completed';
        break;
      }

      if ((state.screen === 'hub' || state.screen === 'base') && turn > 8) {
        const runState = await runApi('getRunState');
        if (!runState || !runState.floor) {
          await pushStep(turn, 'hub-after-run');
          report.result = 'completed';
          break;
        }
      }

      let action = null;
      let actionResult = null;

      // Prefer direct UI clicks when elements are visible.
      if (state.visibleIds.includes('quiz-answer-0')) {
        await page.locator('[data-testid="quiz-answer-0"]').first().click({ force: true });
        action = 'click-quiz-answer-0';
      } else if (state.visibleIds.some((id) => /^card-hand-\d+/.test(id))) {
        const cards = state.ids.filter((x) => /^card-hand-\d+/.test(x.testId) && !x.disabled).map((x) => x.testId);
        if (cards.length) {
          await page.locator(`[data-testid="${cards[0]}"]`).first().dblclick({ force: true });
          action = `dblclick-${cards[0]}`;
        }
      } else if (state.visibleIds.includes('btn-end-turn')) {
        await page.locator('[data-testid="btn-end-turn"]').first().click({ force: true });
        action = 'click-end-turn';
      } else if (state.visibleIds.includes('room-choice-0')) {
        await page.locator('[data-testid="room-choice-0"]').first().click({ force: true });
        action = 'click-room-choice-0';
      } else if (state.visibleIds.includes('reward-accept')) {
        await page.locator('[data-testid="reward-accept"]').first().click({ force: true });
        action = 'click-reward-accept';
      }

      // Fallback to programmatic play API (which itself clicks in-game controls).
      if (!action) {
        if (state.screen === 'hub' || state.screen === 'base') {
          actionResult = await runApi('startRun');
          action = 'api-startRun';
        } else if (state.screen === 'domainSelection') {
          actionResult = await runApi('selectDomain', 'general_knowledge');
          action = 'api-selectDomain';
        } else if (state.screen === 'archetypeSelection') {
          actionResult = await runApi('selectArchetype', 'balanced');
          action = 'api-selectArchetype';
        } else if (state.screen === 'combat') {
          const quiz = await runApi('getQuiz');
          if (quiz && quiz.question) {
            actionResult = await runApi('answerQuizCorrectly');
            action = 'api-answerQuizCorrectly';
          } else {
            actionResult = await runApi('playCard', 0);
            if (!actionResult?.ok) {
              actionResult = await runApi('endTurn');
              action = 'api-endTurn';
            } else {
              action = 'api-playCard-0';
            }
          }
        } else if (state.screen === 'roomSelection') {
          actionResult = await runApi('selectRoom', 0);
          action = 'api-selectRoom-0';
        } else if (state.screen === 'cardReward') {
          await runApi('selectRewardType', 'attack');
          actionResult = await runApi('acceptReward');
          action = 'api-cardReward';
        } else if (state.screen === 'restRoom') {
          actionResult = await runApi('restHeal');
          action = 'api-restHeal';
        } else if (state.screen === 'mysteryEvent') {
          actionResult = await runApi('mysteryContinue');
          action = 'api-mysteryContinue';
        } else if (state.screen === 'retreatOrDelve') {
          actionResult = await runApi('delve');
          action = 'api-delve';
        }
      }

      if (!action) {
        report.issues.push({
          type: 'unknown_state',
          turn,
          screen: state.screen,
          visibleIds: state.visibleIds.slice(0, 30),
        });
        await pushStep(turn, 'unknown-state');
      } else {
        await page.waitForTimeout(450);
        await pushStep(turn, action, actionResult ? { actionResult } : {});
      }

      if (turn % 35 === 0) {
        const ss = `/tmp/visual-playthrough-${seed}-${String(turn).padStart(3, '0')}.png`;
        await page.screenshot({ path: ss });
        report.screenshots.push(ss);
      }
    }

    if (report.result === 'unknown') report.result = 'max_turns_reached';
  } catch (err) {
    report.result = 'error';
    report.issues.push({ type: 'exception', message: String(err?.stack || err) });
  } finally {
    report.completedAt = new Date().toISOString();
    report.consoleErrors = consoleErrors;
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `visual-playthrough-seed${seed}-${Date.now()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(outPath);
    await browser.close();
  }
})();
