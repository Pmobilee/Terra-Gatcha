#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pathArg = process.argv[2] || 'data/playtests/leaderboard.json';
const fullPath = resolve(process.cwd(), pathArg);

function fail(msg) {
  console.error(`[schema] ${msg}`);
  process.exit(1);
}

const lb = JSON.parse(readFileSync(fullPath, 'utf8'));
if (!Array.isArray(lb.issues)) fail('leaderboard.issues must be an array');

let validated = 0;
for (const issue of lb.issues) {
  validated += 1;

  if (!Array.isArray(issue.affectedProfiles)) {
    fail(`issue ${issue.canonicalId || issue.title}: missing affectedProfiles[]`);
  }

  if (!issue.affectedSettings || typeof issue.affectedSettings !== 'object') {
    fail(`issue ${issue.canonicalId || issue.title}: missing affectedSettings`);
  }

  const s = issue.affectedSettings;
  if (!Array.isArray(s.difficultyModes) || !Array.isArray(s.archetypes) || !Array.isArray(s.domains)) {
    fail(`issue ${issue.canonicalId || issue.title}: affectedSettings must include arrays for difficultyModes/archetypes/domains`);
  }

  if (!Array.isArray(issue.runBreakdown)) {
    fail(`issue ${issue.canonicalId || issue.title}: runBreakdown must be an array`);
  }

  const hasHeadlessRows = issue.runBreakdown.some(rb => rb && rb.profileId && rb.profileId !== 'visual-worker');
  if (hasHeadlessRows && issue.runBreakdown.length === 0) {
    fail(`issue ${issue.canonicalId || issue.title}: headless-sourced issue must have non-empty runBreakdown`);
  }

  for (const rb of issue.runBreakdown) {
    if (!Object.prototype.hasOwnProperty.call(rb, 'accuracy')) {
      fail(`issue ${issue.canonicalId || issue.title}: runBreakdown row missing accuracy field`);
    }
    if (!Object.prototype.hasOwnProperty.call(rb, 'maxCombo')) {
      fail(`issue ${issue.canonicalId || issue.title}: runBreakdown row missing maxCombo field`);
    }
    if (rb.profileId && rb.profileId !== 'visual-worker') {
      if (typeof rb.accuracy !== 'number') {
        fail(`issue ${issue.canonicalId || issue.title}: headless runBreakdown accuracy must be number`);
      }
      if (typeof rb.maxCombo !== 'number') {
        fail(`issue ${issue.canonicalId || issue.title}: headless runBreakdown maxCombo must be number`);
      }
    }
  }
}

console.log(`[schema] OK - validated ${validated} issues in ${fullPath}`);
