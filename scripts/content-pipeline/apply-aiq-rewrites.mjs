#!/usr/bin/env node
/**
 * apply-aiq-rewrites.mjs
 *
 * Reads rewritten quiz questions from /tmp/aiq-results/chunk-*.json
 * and applies them back to the seed file. Only updates quizQuestion
 * where the rewrite actually removes the answer from the question.
 *
 * Usage: node scripts/content-pipeline/apply-aiq-rewrites.mjs [--dry-run]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeText } from './qa/shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '../..')
const SEED_FILE = path.join(ROOT, 'src', 'data', 'seed', 'facts-generated.json')
const RESULTS_DIR = '/tmp/aiq-results'

const dryRun = process.argv.includes('--dry-run')

// Load all result chunks
console.log('[apply-aiq] Loading rewrite results...')
const rewrites = new Map() // id -> newQuestion

let filesLoaded = 0
let totalRewrites = 0

if (!fs.existsSync(RESULTS_DIR)) {
  console.error(`[ERROR] Results directory not found: ${RESULTS_DIR}`)
  process.exit(1)
}

const files = fs.readdirSync(RESULTS_DIR).filter(f => f.endsWith('.json')).sort()
for (const file of files) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, file), 'utf8'))
    const items = Array.isArray(data) ? data : []
    for (const item of items) {
      if (item.id && item.quizQuestion && typeof item.quizQuestion === 'string') {
        rewrites.set(item.id, item.quizQuestion.trim())
        totalRewrites++
      }
    }
    filesLoaded++
  } catch (err) {
    console.warn(`  [WARN] Could not parse ${file}: ${err.message}`)
  }
}

console.log(`  Loaded ${totalRewrites} rewrites from ${filesLoaded} files`)

// Load seed file
console.log('[apply-aiq] Loading seed file...')
const facts = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'))
console.log(`  ${facts.length} facts loaded`)

// Apply rewrites with validation
let applied = 0
let skippedNoMatch = 0
let skippedStillContains = 0
let skippedEmpty = 0

for (const fact of facts) {
  const newQ = rewrites.get(fact.id)
  if (!newQ) continue

  // Skip if new question is empty or too short
  if (newQ.length < 10) {
    skippedEmpty++
    continue
  }

  // Validate: the answer should NOT appear in the new question
  const answer = String(fact.correctAnswer || '').trim()
  const answerNorm = normalizeText(answer)
  const newQNorm = normalizeText(newQ)

  if (answerNorm.length >= 5 && newQNorm.includes(answerNorm)) {
    skippedStillContains++
    continue
  }

  // Apply the rewrite
  fact.quizQuestion = newQ
  applied++
  rewrites.delete(fact.id) // mark as used
}

skippedNoMatch = rewrites.size

console.log('\n=== Apply Results ===')
console.log(`Rewrites available:       ${totalRewrites}`)
console.log(`Successfully applied:     ${applied}`)
console.log(`Skipped (still contains): ${skippedStillContains}`)
console.log(`Skipped (too short):      ${skippedEmpty}`)
console.log(`Skipped (ID not found):   ${skippedNoMatch}`)

if (dryRun) {
  console.log('\n[DRY RUN] No changes written.')
} else if (applied > 0) {
  console.log('\nWriting updated seed data...')
  fs.writeFileSync(SEED_FILE, JSON.stringify(facts, null, 2) + '\n', 'utf8')
  console.log(`[OK] ${applied} questions rewritten in ${path.relative(ROOT, SEED_FILE)}`)
  console.log('\nNext steps:')
  console.log('  1. node scripts/build-facts-db.mjs')
  console.log('  2. node scripts/content-pipeline/qa/scan-500.mjs --verbose')
} else {
  console.log('\n[SKIP] No valid rewrites to apply.')
}
