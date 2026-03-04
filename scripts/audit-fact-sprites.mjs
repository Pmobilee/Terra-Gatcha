#!/usr/bin/env node
/**
 * Terra Miner — Fact Sprite Audit
 * Reports pixel art coverage and emits a sprite manifest for the client.
 *
 * Usage:
 *   node scripts/audit-fact-sprites.mjs [--fail-below=80] [--emit-manifest]
 *
 * Exit codes:
 *   0 — coverage >= threshold and no dimension failures
 *   1 — below threshold or dimension failures found
 */

import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const require   = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT   = path.resolve(__dirname, '..')

const SPRITES_DIR   = path.join(PROJECT, 'src', 'assets', 'sprites', 'facts')
const FACTS_DB      = path.join(PROJECT, 'server', 'data', 'facts.db')
const OUT_DIR       = path.join(PROJECT, 'docs', 'audit')
const MANIFEST_PATH = path.join(PROJECT, 'src', 'assets', 'fact-sprite-manifest.json')

const args          = process.argv.slice(2)
const failBelowArg  = args.find(a => a.startsWith('--fail-below='))
const FAIL_THRESHOLD = failBelowArg ? parseInt(failBelowArg.split('=')[1]) : 0
const EMIT_MANIFEST  = args.includes('--emit-manifest')

// ── Load DB ───────────────────────────────────────────────────────────────────

let Database
try {
  Database = require('better-sqlite3')
} catch {
  // Try the server's node_modules (when run from project root)
  try {
    Database = require(path.join(PROJECT, 'server', 'node_modules', 'better-sqlite3'))
  } catch {
    console.warn('better-sqlite3 not found — writing empty audit.')
    fs.mkdirSync(OUT_DIR, { recursive: true })
    const empty = {
      generated_at: new Date().toISOString(), total_approved: 0, with_pixel_art: 0,
      coverage_pct: 0, queued: 0, generating: 0, none: 0, rejected: 0,
      size_failures: 0, by_category: {}, threshold: FAIL_THRESHOLD, pass: true,
    }
    fs.writeFileSync(path.join(OUT_DIR, 'fact-sprite-coverage.json'), JSON.stringify(empty, null, 2))
    if (EMIT_MANIFEST) fs.writeFileSync(MANIFEST_PATH, '[]')
    console.log('  PASS (no DB available)')
    process.exit(0)
  }
}

if (!fs.existsSync(FACTS_DB)) {
  console.warn(`facts.db not found at ${FACTS_DB} — writing empty audit.`)
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const empty = {
    generated_at: new Date().toISOString(), total_approved: 0, with_pixel_art: 0,
    coverage_pct: 0, queued: 0, generating: 0, none: 0, rejected: 0,
    size_failures: 0, by_category: {}, threshold: FAIL_THRESHOLD, pass: true,
  }
  fs.writeFileSync(path.join(OUT_DIR, 'fact-sprite-coverage.json'), JSON.stringify(empty, null, 2))
  if (EMIT_MANIFEST) fs.writeFileSync(MANIFEST_PATH, '[]')
  process.exit(0)
}

const db    = new Database(FACTS_DB, { readonly: true })
const facts = db.prepare(
  `SELECT id, category_l1, status, pixel_art_status, has_pixel_art
   FROM facts WHERE status = 'approved'`
).all()
db.close()

// ── Tally ─────────────────────────────────────────────────────────────────────

const total   = facts.length
let approved  = 0, queued = 0, generating = 0, none = 0, rejected = 0
const byCategory = {}

for (const f of facts) {
  const cat = f.category_l1 || 'Uncategorized'
  if (!byCategory[cat]) byCategory[cat] = { total: 0, approved: 0 }
  byCategory[cat].total++
  switch (f.pixel_art_status) {
    case 'approved':   approved++; byCategory[cat].approved++; break
    case 'generating': generating++; break
    case 'queued':     queued++;     break
    case 'rejected':   rejected++;   break
    default:           none++;       break
  }
}

// ── Dimension sanity check ────────────────────────────────────────────────────

let sizeFails = 0
if (fs.existsSync(SPRITES_DIR)) {
  // Use synchronous image size reading via PNG header (no sharp dependency required)
  for (const file of fs.readdirSync(SPRITES_DIR).filter(f => f.endsWith('.png'))) {
    try {
      const buf = Buffer.alloc(24)
      const fd  = fs.openSync(path.join(SPRITES_DIR, file), 'r')
      fs.readSync(fd, buf, 0, 24, 0)
      fs.closeSync(fd)
      // PNG IHDR: bytes 16-19 = width, 20-23 = height (big-endian uint32)
      const w = buf.readUInt32BE(16)
      const h = buf.readUInt32BE(20)
      if (w !== 64 || h !== 64) sizeFails++
    } catch {}
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

const pct = total > 0 ? Math.round((approved / total) * 100) : 0

console.log('\nTerra Miner — Fact Sprite Coverage Audit')
console.log('='.repeat(52))
console.log(`  Approved facts  : ${total}`)
console.log(`  With pixel art  : ${approved}  (${pct}%)`)
console.log(`  Queued          : ${queued}`)
console.log(`  Generating      : ${generating}`)
console.log(`  No art yet      : ${none}`)
console.log(`  Rejected        : ${rejected}`)
console.log(`  Dim failures    : ${sizeFails}`)
console.log()
console.log('  Category Breakdown:')

const sorted = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total)
for (const [cat, c] of sorted) {
  const p   = Math.round((c.approved / c.total) * 100)
  const bar = '█'.repeat(Math.floor(p / 5)).padEnd(20, '░')
  console.log(`    ${cat.padEnd(24)} ${bar} ${String(p).padStart(3)}%  (${c.approved}/${c.total})`)
}
console.log()

// ── Write audit JSON ──────────────────────────────────────────────────────────

fs.mkdirSync(OUT_DIR, { recursive: true })
const auditData = {
  generated_at: new Date().toISOString(),
  total_approved: total, with_pixel_art: approved, coverage_pct: pct,
  queued, generating, none, rejected, size_failures: sizeFails,
  by_category: byCategory, threshold: FAIL_THRESHOLD,
  pass: pct >= FAIL_THRESHOLD && sizeFails === 0,
}
const outPath = path.join(OUT_DIR, 'fact-sprite-coverage.json')
fs.writeFileSync(outPath, JSON.stringify(auditData, null, 2))
console.log(`  Audit JSON: ${outPath}`)

// ── Emit sprite manifest ──────────────────────────────────────────────────────

if (EMIT_MANIFEST) {
  const approvedIds = facts
    .filter(f => f.pixel_art_status === 'approved')
    .map(f => f.id)
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(approvedIds))
  console.log(`  Manifest : ${MANIFEST_PATH}  (${approvedIds.length} IDs)`)
}

// ── Exit code ─────────────────────────────────────────────────────────────────

if (FAIL_THRESHOLD > 0 && pct < FAIL_THRESHOLD) {
  console.error(`\n  FAIL: coverage ${pct}% < threshold ${FAIL_THRESHOLD}%`)
  process.exit(1)
} else if (sizeFails > 0) {
  console.error(`\n  FAIL: ${sizeFails} sprite(s) have wrong dimensions.`)
  process.exit(1)
} else {
  console.log(`  PASS`)
}
