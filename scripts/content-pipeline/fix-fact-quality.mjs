#!/usr/bin/env node
/**
 * fix-fact-quality.mjs
 *
 * Comprehensive mechanical fix script for fact quality issues.
 * Strips garbage/placeholder distractors, removes answer-in-distractor duplicates,
 * deduplicates distractors, and fixes bare-word questions.
 *
 * Run `mine-distractors.mjs` after this to backfill stripped distractors from same-domain pools.
 *
 * Usage: node scripts/content-pipeline/fix-fact-quality.mjs [--dry-run] [--extract-aiq <path>]
 *   --dry-run: Don't write changes
 *   --extract-aiq <path>: Write answer-in-question facts to a JSONL file for LLM rewriting
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeText, isBadDistractor } from './qa/shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '../..')
const SEED_FILE = path.join(ROOT, 'src', 'data', 'seed', 'facts-generated.json')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const extractAiqIdx = args.indexOf('--extract-aiq')
const extractAiqPath = extractAiqIdx >= 0 ? args[extractAiqIdx + 1] : null

console.log('[fix-quality] Reading seed file...')
const raw = fs.readFileSync(SEED_FILE, 'utf8')
const facts = JSON.parse(raw)
console.log(`[OK] Loaded ${facts.length} facts`)

// Stats
const stats = {
  garbageDistractorsStripped: 0,
  answerInDistractorFixed: 0,
  duplicateDistractorsFixed: 0,
  bareWordQuestionsFixed: 0,
  badTextFixed: 0,
  answerInQuestionFlagged: 0,
  totalFactsModified: 0,
  factsWithStrippedDistractors: 0,
}

// Collect answer-in-question facts for LLM extraction
const aiqFacts = []

for (const fact of facts) {
  let modified = false
  const answer = String(fact.correctAnswer || '').trim()
  const answerNorm = normalizeText(answer)

  // === Fix 1: Strip garbage/placeholder distractors ===
  if (Array.isArray(fact.distractors)) {
    const before = fact.distractors.length
    const cleaned = fact.distractors.filter(d => {
      const text = typeof d === 'string' ? d : String(d?.text ?? d ?? '')
      return text && !isBadDistractor(text)
    })
    const stripped = before - cleaned.length
    if (stripped > 0) {
      stats.garbageDistractorsStripped += stripped
      fact.distractors = cleaned
      modified = true
    }
  }

  // === Fix 2: Remove distractor that equals the correct answer ===
  if (Array.isArray(fact.distractors) && answer) {
    const before = fact.distractors.length
    fact.distractors = fact.distractors.filter(d => {
      const text = typeof d === 'string' ? d : String(d?.text ?? d ?? '')
      return normalizeText(text) !== answerNorm
    })
    if (fact.distractors.length < before) {
      stats.answerInDistractorFixed += before - fact.distractors.length
      modified = true
    }
  }

  // === Fix 3: Deduplicate distractors (case-insensitive) ===
  if (Array.isArray(fact.distractors)) {
    const seen = new Set()
    const before = fact.distractors.length
    fact.distractors = fact.distractors.filter(d => {
      const text = typeof d === 'string' ? d : String(d?.text ?? d ?? '')
      const norm = normalizeText(text)
      if (seen.has(norm)) return false
      seen.add(norm)
      return true
    })
    if (fact.distractors.length < before) {
      stats.duplicateDistractorsFixed += before - fact.distractors.length
      modified = true
    }
  }

  // === Fix 4: Fix bare-word questions ===
  // If quizQuestion is a single bare word (no spaces, no "?"), it's broken
  const q = String(fact.quizQuestion || '').trim()
  if (q && !q.includes(' ') && !q.includes('?') && q.length < 30) {
    // It's a bare word — probably a vocab fact missing the question frame
    const lang = fact.language || ''
    const langLabel = {
      ja: 'Japanese', ko: 'Korean', es: 'Spanish', de: 'German',
      fr: 'French', it: 'Italian', nl: 'Dutch', cs: 'Czech',
    }[lang] || ''

    if (langLabel) {
      fact.quizQuestion = `What does the ${langLabel} word "${q}" mean in English?`
    } else {
      fact.quizQuestion = `What does "${q}" mean?`
    }
    stats.bareWordQuestionsFixed++
    modified = true
  }

  // === Fix 5: Fix bad text patterns (undefined, null, NaN, trailing "...") ===
  const badTextRe = /^(undefined|null|NaN|\.{3,}|n\/a)$/i
  if (badTextRe.test(String(fact.correctAnswer || '').trim())) {
    // Can't fix mechanically — flag for removal or LLM rewrite
    stats.badTextFixed++
  }
  if (badTextRe.test(String(fact.quizQuestion || '').trim())) {
    stats.badTextFixed++
  }

  // === Fix 6: Clean variant distractors too ===
  if (Array.isArray(fact.variants)) {
    for (const variant of fact.variants) {
      if (!Array.isArray(variant.distractors)) continue
      const before = variant.distractors.length

      // Strip garbage
      variant.distractors = variant.distractors.filter(d => {
        const text = typeof d === 'string' ? d : String(d?.text ?? d ?? '')
        return text && !isBadDistractor(text)
      })

      // Remove answer dupes
      const vAnswer = normalizeText(String(variant.correctAnswer || fact.correctAnswer || ''))
      variant.distractors = variant.distractors.filter(d => {
        const text = typeof d === 'string' ? d : String(d?.text ?? d ?? '')
        return normalizeText(text) !== vAnswer
      })

      // Deduplicate
      const seen = new Set()
      variant.distractors = variant.distractors.filter(d => {
        const text = typeof d === 'string' ? d : String(d?.text ?? d ?? '')
        const norm = normalizeText(text)
        if (seen.has(norm)) return false
        seen.add(norm)
        return true
      })

      if (variant.distractors.length < before) {
        modified = true
      }
    }
  }

  // === Detect: Answer-in-question (for extraction, not auto-fix) ===
  const question = String(fact.quizQuestion || '').trim()
  if (answer && answerNorm.length >= 5 && normalizeText(question).includes(answerNorm)) {
    // Filter out obvious false positives:
    // - Vocab translations where the word appears in "What does X mean?" are fine
    // - Geography "capital of X" where answer != X is fine
    const isVocab = fact.type === 'vocabulary' || fact.type === 'grammar' || fact.type === 'phrase'
    if (!isVocab) {
      stats.answerInQuestionFlagged++
      aiqFacts.push({
        id: fact.id,
        quizQuestion: fact.quizQuestion,
        correctAnswer: fact.correctAnswer,
        type: fact.type,
        categoryL1: fact.categoryL1,
      })
    }
  }

  if (modified) {
    stats.totalFactsModified++
    if (fact.distractors && fact.distractors.length < 3) {
      stats.factsWithStrippedDistractors++
    }
  }
}

// Report
console.log('\n=== Fix Quality Summary ===')
console.log(`Total facts:                    ${facts.length}`)
console.log(`Facts modified:                 ${stats.totalFactsModified}`)
console.log(`Garbage distractors stripped:    ${stats.garbageDistractorsStripped}`)
console.log(`Answer-in-distractor fixed:     ${stats.answerInDistractorFixed}`)
console.log(`Duplicate distractors removed:  ${stats.duplicateDistractorsFixed}`)
console.log(`Bare-word questions fixed:       ${stats.bareWordQuestionsFixed}`)
console.log(`Bad text patterns found:         ${stats.badTextFixed}`)
console.log(`Answer-in-question flagged:      ${stats.answerInQuestionFlagged}`)
console.log(`Facts needing distractor mining: ${stats.factsWithStrippedDistractors} (run mine-distractors.mjs next)`)

if (extractAiqPath && aiqFacts.length > 0) {
  const aiqOut = aiqFacts.map(f => JSON.stringify(f)).join('\n') + '\n'
  fs.mkdirSync(path.dirname(path.resolve(extractAiqPath)), { recursive: true })
  fs.writeFileSync(extractAiqPath, aiqOut, 'utf8')
  console.log(`\n[OK] Wrote ${aiqFacts.length} answer-in-question facts to ${extractAiqPath}`)
}

if (dryRun) {
  console.log('\n[DRY RUN] No changes written.')
} else {
  console.log('\nWriting fixed data...')
  fs.writeFileSync(SEED_FILE, JSON.stringify(facts, null, 2) + '\n', 'utf8')
  console.log(`[OK] ${path.relative(ROOT, SEED_FILE)} updated.`)
  console.log('\nNext steps:')
  console.log('  1. node scripts/content-pipeline/mine-distractors.mjs')
  console.log('  2. node scripts/build-facts-db.mjs')
}
