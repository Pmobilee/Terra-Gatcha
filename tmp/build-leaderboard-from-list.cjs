const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'data/playtests/reports');
const OUT_PATH = path.join(ROOT, 'data/playtests/leaderboard.json');
const INPUT_LIST = process.argv[2];
if (!INPUT_LIST) {
  console.error('Usage: node tmp/build-leaderboard-from-list.cjs /tmp/playtest_new_reports.txt');
  process.exit(1);
}

const SEV_WEIGHT = { critical: 10, high: 5, medium: 3, low: 1, cosmetic: 0.5 };
const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'cosmetic'];

function floorBucket(floor) {
  if (floor == null || Number.isNaN(Number(floor))) return 'global';
  const f = Number(floor);
  if (f >= 1 && f <= 3) return 'early';
  if (f >= 4 && f <= 6) return 'mid_early';
  if (f >= 7 && f <= 9) return 'mid';
  if (f >= 10 && f <= 12) return 'late';
  if (f >= 13) return 'endgame';
  return 'global';
}

function breadthFactor(n) {
  if (n >= 3) return 1.5;
  if (n >= 2) return 1.25;
  return 1;
}

function bestSeverity(issues) {
  return [...issues].sort((a,b)=>SEV_ORDER.indexOf(a.severity)-SEV_ORDER.indexOf(b.severity))[0]?.severity || 'low';
}

function pickBest(issues, key) {
  return [...issues].sort((a,b)=>{
    const sa = SEV_ORDER.indexOf(a.severity);
    const sb = SEV_ORDER.indexOf(b.severity);
    if (sa !== sb) return sa - sb;
    return String(b[key] || '').length - String(a[key] || '').length;
  })[0];
}

const files = fs.readFileSync(INPUT_LIST, 'utf8').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
const reports = files.map((f) => JSON.parse(fs.readFileSync(path.join(REPORT_DIR, f), 'utf8')));

const groups = new Map();
for (const report of reports) {
  for (const issue of report.issues || []) {
    const floor = issue?.evidence?.floor ?? null;
    const bucket = floorBucket(floor);
    const canonicalId = `${issue.category}_${bucket}`;
    if (!groups.has(canonicalId)) {
      groups.set(canonicalId, {
        canonicalId,
        category: issue.category,
        bucket,
        items: [],
        playthroughIds: new Set(),
        profiles: new Set(),
        timestamps: [],
      });
    }
    const g = groups.get(canonicalId);
    g.items.push(issue);
    g.playthroughIds.add(report.playthroughId);
    g.profiles.add(report.profileId);
    g.timestamps.push(report.analyzedAt || null);
  }
}

const issues = [];
for (const [, g] of groups) {
  const severity = bestSeverity(g.items);
  const frequency = g.playthroughIds.size;
  const profiles = [...g.profiles].sort();
  const score = Number((frequency * (SEV_WEIGHT[severity] || 1) * breadthFactor(profiles.length)).toFixed(2));
  const best = pickBest(g.items, 'title') || g.items[0] || {};
  const desc = pickBest(g.items, 'description') || best;
  const firstSeen = [...g.timestamps].filter(Boolean).sort()[0] || null;
  const lastSeen = [...g.timestamps].filter(Boolean).sort().slice(-1)[0] || null;

  issues.push({
    canonicalId: g.canonicalId,
    category: g.category,
    severity,
    title: best.title || g.category,
    description: desc.description || '',
    frequency,
    affectedProfiles: profiles,
    firstSeen,
    lastSeen,
    score,
    status: 'open',
    sourceReports: [...g.playthroughIds].sort().map((id) => `report-${id}.json`),
    bestEvidence: best.evidence || {},
    reproductionSteps: best.reproductionSteps || [],
  });
}

issues.sort((a,b)=> b.score - a.score || b.frequency - a.frequency || a.category.localeCompare(b.category));
issues.forEach((i,idx)=>{ i.rank = idx + 1; });

const leaderboard = {
  updatedAt: new Date().toISOString(),
  totalPlaythroughs: reports.length,
  totalIssues: issues.length,
  issues,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(leaderboard, null, 2));
console.log(JSON.stringify({ out: OUT_PATH, totalPlaythroughs: reports.length, totalIssues: issues.length }, null, 2));
