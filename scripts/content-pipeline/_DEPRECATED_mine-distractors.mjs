#!/usr/bin/env node
/**
 * @deprecated DO NOT USE — This script mines distractors programmatically from the same-domain
 * correct-answer pool, producing cross-subcategory contamination (e.g., biology answers for
 * chemistry questions). ALL distractors must be generated via Haiku LLM agents.
 * See SKILL.md § "Distractor Quality Rules" for the correct approach.
 *
 * This file is kept for reference only. March 2026.
 */
console.error('ERROR: mine-distractors.mjs is DEPRECATED. All distractors must go through Haiku LLM agents.');
console.error('See .claude/skills/manual-fact-ingest-dedup/SKILL.md for correct distractor generation.');
process.exit(1);

// ----- DEPRECATED CODE BELOW (kept for reference) -----

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeText, isBadDistractor } from './qa/shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '../..')
const SEED_FILE = path.join(ROOT, 'src', 'data', 'seed', 'facts-generated.json')

const dryRun = process.argv.includes('--dry-run')
const targetArg = process.argv.indexOf('--target')
const TARGET_DISTRACTORS = targetArg >= 0 ? parseInt(process.argv[targetArg + 1], 10) || 8 : 8

console.log(`[mine-distractors] Target: ${TARGET_DISTRACTORS} distractors per fact`)
console.log(`[mine-distractors] Reading ${path.relative(ROOT, SEED_FILE)}...`)

let raw
try {
  raw = fs.readFileSync(SEED_FILE, 'utf8')
} catch (err) {
  console.error(`[ERROR] Could not read seed file: ${err.message}`)
  process.exit(1)
}

let facts
try {
  facts = JSON.parse(raw)
} catch (err) {
  console.error(`[ERROR] Invalid JSON in seed file: ${err.message}`)
  process.exit(1)
}

if (!Array.isArray(facts)) {
  console.error(`[ERROR] Seed file must contain a JSON array at top level`)
  process.exit(1)
}

console.log(`[OK] Loaded ${facts.length} facts`)

// Build pools of candidate distractors grouped by (language, category_l1)
// For vocab: group by language
// For knowledge: group by category_l1
const vocabPools = {}   // language -> Set of correct answers
const knowledgePools = {} // category_l1 -> Set of correct answers

for (const fact of facts) {
  const answer = String(fact.correctAnswer || '').trim()
  if (!answer) continue

  // Skip placeholder distractors
  if (isBadDistractor(answer)) continue

  if (fact.type === 'vocabulary' || fact.type === 'grammar' || fact.type === 'phrase') {
    const lang = fact.language || 'unknown'
    if (!vocabPools[lang]) vocabPools[lang] = new Set()
    vocabPools[lang].add(answer)
  } else {
    const domain = fact.categoryL1 || 'General Knowledge'
    if (!knowledgePools[domain]) knowledgePools[domain] = new Set()
    knowledgePools[domain].add(answer)
  }
}

console.log(`\n[POOLS] Distractor pools built:`)
for (const [lang, pool] of Object.entries(vocabPools)) {
  console.log(`  Vocab [${lang}]: ${pool.size} candidates`)
}
for (const [domain, pool] of Object.entries(knowledgePools)) {
  console.log(`  Knowledge [${domain}]: ${pool.size} candidates`)
}

// Shuffle helper
function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

let factsFixed = 0
let distractorsAdded = 0
let factsStillShort = 0

for (const fact of facts) {
  const currentDistractors = Array.isArray(fact.distractors)
    ? fact.distractors.filter(d => {
        const text = typeof d === 'string' ? d : String(d?.text ?? d ?? '')
        return text && !isBadDistractor(text)
      })
    : []

  if (currentDistractors.length >= TARGET_DISTRACTORS) continue

  const answer = String(fact.correctAnswer || '').trim()
  if (!answer || isBadDistractor(answer)) continue

  // Determine pool
  let pool
  if (fact.type === 'vocabulary' || fact.type === 'grammar' || fact.type === 'phrase') {
    pool = vocabPools[fact.language || 'unknown']
  } else {
    pool = knowledgePools[fact.categoryL1 || 'General Knowledge']
  }

  if (!pool || pool.size === 0) continue

  // Build existing set (normalized) to avoid duplicates
  const existingNorm = new Set([
    normalizeText(answer),
    ...currentDistractors.map(d => {
      const text = typeof d === 'string' ? d : String(d?.text ?? d ?? '')
      return normalizeText(text)
    }),
  ])

  // Pick candidates from pool
  const candidates = shuffleArray([...pool]).filter(c => {
    const norm = normalizeText(c)
    if (existingNorm.has(norm)) return false
    // Skip if it's the exact same normalized string as the correct answer
    if (norm === normalizeText(answer)) return false
    return true
  })

  const needed = TARGET_DISTRACTORS - currentDistractors.length
  const picked = candidates.slice(0, needed)

  if (picked.length > 0) {
    fact.distractors = [...currentDistractors, ...picked]
    distractorsAdded += picked.length
    factsFixed++
  }

  if (fact.distractors.length < TARGET_DISTRACTORS) {
    factsStillShort++
  }
}

console.log(`\n=== Mining Results ===`)
console.log(`Facts augmented:         ${factsFixed}`)
console.log(`Distractors added:       ${distractorsAdded}`)
console.log(`Facts still short:       ${factsStillShort}`)

if (dryRun) {
  console.log(`\n[DRY RUN] No changes written.`)
} else {
  console.log(`\nWriting updated seed data...`)
  fs.writeFileSync(SEED_FILE, JSON.stringify(facts, null, 2) + '\n', 'utf8')
  console.log(`[OK] ${path.relative(ROOT, SEED_FILE)} updated.`)
}
