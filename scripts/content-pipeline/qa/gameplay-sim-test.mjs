#!/usr/bin/env node
/**
 * gameplay-sim-test.mjs — Simulate what a player ACTUALLY sees during gameplay.
 * Tests the 3-option presentation (correct answer + 2 random distractors) for quality issues.
 *
 * The game shows:
 *   - 1 correct answer (from correctAnswer column)
 *   - 2 random distractors (from the distractors array, which should have 8+)
 *
 * This script checks if the 3-option presentation is plausible in terms of:
 *   - Option type consistency (all places, all numbers, all animals, NOT mixed domains)
 *   - Option length plausibility
 *   - Vocabulary translation patterns appearing in wrong places
 *   - Question quality (nonsensical, placeholder, answer visible)
 *   - Domain mismatch between answer and distractors
 *
 * Usage: node scripts/content-pipeline/qa/gameplay-sim-test.mjs [--count 200] [--verbose]
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeText, isBadDistractor, hasAnswerInQuestion } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')
const require = createRequire(import.meta.url)

const args = process.argv.slice(2)
const verbose = args.includes('--verbose')
const countIdx = args.indexOf('--count')
const COUNT = countIdx >= 0 ? parseInt(args[countIdx + 1], 10) || 200 : 200

const DB_PATH = path.join(root, 'public', 'facts.db')

// Load sql.js
const initSqlJs = require('sql.js')
const fs = require('fs')

// ============================================================================
// Option Type Detection (heuristics for semantic consistency)
// ============================================================================

/**
 * Detect rough semantic category of a string (place, number, person, object, etc.)
 * Uses simple heuristics since we can't do full semantic analysis.
 */
function detectOptionType(text) {
  const t = String(text || '').toLowerCase().trim()

  // Numbers
  if (/^\d+(\.\d+)?%?$/.test(t) || /^(zero|one|two|three|four|five|six|seven|eight|nine|ten)$/.test(t)) {
    return 'number'
  }

  // Years/dates
  if (/^(19|20)\d{2}$/.test(t) || /^[a-z]+\s+(19|20)\d{2}$/.test(t)) {
    return 'year'
  }

  // Chemical formulas/compounds (Ca, H2O, CO2, NaCl, etc.)
  if (/^[A-Z][a-z]?(\d+)?([A-Z][a-z]?)?(\d+)?$/.test(t) && /[A-Z]/.test(t)) {
    return 'chemical'
  }

  // Places (country names, cities, landmarks)
  const placeWords = ['city', 'country', 'island', 'mountain', 'sea', 'ocean', 'bay', 'desert', 'river', 'lake', 'park', 'tower', 'bridge', 'coast', 'valley', 'canyon']
  if (placeWords.some(w => t.includes(w)) || /^[a-z]{3,}(,\s*[a-z]{2,})?$/.test(t)) {
    return 'place'
  }

  // Animals/creatures
  const animalWords = ['animal', 'bird', 'fish', 'insect', 'mammal', 'reptile', 'amphibian', 'dog', 'cat', 'horse', 'bear', 'eagle', 'whale', 'shark']
  if (animalWords.some(w => t.includes(w))) {
    return 'animal'
  }

  // People/names
  const nameWords = ['person', 'man', 'woman', 'king', 'queen', 'emperor', 'president', 'scientist', 'artist', 'inventor']
  if (nameWords.some(w => t.includes(w)) || /^[a-z]+\s+[a-z]+$/.test(t)) {
    return 'person'
  }

  // Abstract concepts
  const abstractWords = ['concept', 'idea', 'theory', 'principle', 'philosophy', 'belief', 'movement', 'revolution']
  if (abstractWords.some(w => t.includes(w))) {
    return 'abstract'
  }

  // Verbs (especially foreign language facts: "to X")
  if (/^to\s+[a-z]+/.test(t) || /^\[?verb\]?/.test(t)) {
    return 'verb'
  }

  // Vocabulary/word (for language-learning facts)
  const vocabWords = ['word', 'term', 'phrase', 'expression', 'meaning']
  if (vocabWords.some(w => t.includes(w)) || t.length < 15 && !/\s/.test(t)) {
    return 'vocab'
  }

  return 'unknown'
}

/**
 * Check for vocab-translation patterns in text.
 * Examples: "(E~)", "(esp.", "(n.)", "[verb]", "~を" (Japanese)
 * These indicate the text is still in raw vocab form and shouldn't appear as a distractor.
 */
function hasVocabTranslationPattern(text) {
  const t = String(text || '').toLowerCase()
  const patterns = [
    /\([a-z][\w.~]*\)/,      // (e.g.), (esp.), (E~), etc.
    /\[.+?\]/,               // [verb], [noun], etc.
    /^[a-z\s]+ ~ /i,         // "to X ~ "
    /[~を][a-z]/,            // Japanese markers
    /^to\s+[a-z]+\s*\(/,     // "to verb ("
  ]
  return patterns.some(p => p.test(t))
}

/**
 * Check if text is suspiciously short or long for its apparent type.
 */
function hasLengthAnomaly(text) {
  const t = String(text || '').trim()
  const len = t.length

  // Extremely short (< 2 chars) or long (> 150 chars)
  if (len < 2) return { suspicion: 'too short', len }
  if (len > 150) return { suspicion: 'too long', len }

  // Very short but looks like it should be longer (likely truncation)
  if (len < 5 && /[a-z]{3,}$/.test(t) && !/^(i|a|an|or|to)$/.test(t)) {
    return { suspicion: 'likely truncated', len }
  }

  return null
}

/**
 * Score a 3-option presentation (1 correct answer + 2 distractors).
 * Returns { score: 1-5, reasons: [...] }
 */
function scorePresentation(question, correctAnswer, selectedDistracters) {
  const reasons = []
  let score = 5 // Start perfect, deduct for issues

  // All 3 options (answer + 2 distractors)
  const allOptions = [correctAnswer, ...selectedDistracters]

  // Check 1: Question quality
  const q = String(question || '').trim()
  if (!q || q.length === 0) {
    reasons.push('empty question')
    score = 1
    return { score, reasons }
  }
  if (q.length < 5 || !q.includes(' ')) {
    reasons.push('question is bare word/too short')
    score = Math.min(score, 2)
  }
  if (q.includes('___') && q.split('___').length === 2 && q.split('___')[0].trim().length < 10) {
    reasons.push('placeholder question with no context')
    score = Math.min(score, 2)
  }
  if (hasAnswerInQuestion(q, correctAnswer)) {
    reasons.push('correct answer visible in question')
    score = 1
    return { score, reasons }
  }

  // Check 2: Option count (should always be 3 for this test)
  if (allOptions.length !== 3) {
    reasons.push(`only ${allOptions.length} options available`)
    score = Math.min(score, 2)
  }

  // Check 3: Check for bad distractors
  for (const d of selectedDistracters) {
    if (isBadDistractor(d)) {
      reasons.push(`garbage/placeholder distractor: "${d}"`)
      score = Math.min(score, 2)
    }
  }

  // Check 4: Type consistency
  const types = allOptions.map(o => detectOptionType(o))
  const uniqueTypes = new Set(types.filter(t => t !== 'unknown'))
  if (uniqueTypes.size > 2) {
    // More than 2 distinct types = likely domain mismatch
    reasons.push(`type mismatch: ${Array.from(uniqueTypes).join(', ')}`)
    score = Math.min(score, 2)
  } else if (uniqueTypes.size === 2) {
    // 2 types is questionable but might be OK (e.g., place vs abstract)
    const typeStr = Array.from(uniqueTypes).join(', ')
    // Allow some combinations (e.g., person + place), but not (chemical + verb)
    const badCombos = [
      ['chemical', 'verb'],
      ['number', 'place'],
      ['chemical', 'animal'],
    ]
    const hasBC = badCombos.some(combo => uniqueTypes.has(combo[0]) && uniqueTypes.has(combo[1]))
    if (hasBC) {
      reasons.push(`suspicious type combo: ${typeStr}`)
      score = Math.min(score, 2)
    } else {
      reasons.push(`type variation: ${typeStr}`)
      score = Math.min(score, 4) // Minor penalty
    }
  }

  // Check 5: Length anomalies
  for (const opt of allOptions) {
    const anom = hasLengthAnomaly(opt)
    if (anom) {
      reasons.push(`${opt.substring(0, 30)}: ${anom.suspicion} (${anom.len} chars)`)
      score = Math.min(score, 3)
    }
  }

  // Check 6: Vocab translation patterns in distractors
  for (const d of selectedDistracters) {
    if (hasVocabTranslationPattern(d)) {
      reasons.push(`distractor has vocab pattern: "${d.substring(0, 30)}"`)
      score = Math.min(score, 3)
    }
  }

  // Check 7: Duplicate options
  const optionNorms = allOptions.map(o => normalizeText(o))
  if (new Set(optionNorms).size < 3) {
    reasons.push('duplicate option(s)')
    score = Math.min(score, 2)
  }

  return { score, reasons }
}

/**
 * Randomly pick N items from array
 */
function pickRandom(arr, count) {
  const result = []
  const indices = new Set()
  while (result.length < count && indices.size < arr.length) {
    const i = Math.floor(Math.random() * arr.length)
    if (!indices.has(i)) {
      indices.add(i)
      result.push(arr[i])
    }
  }
  return result
}

async function main() {
  const SQL = await initSqlJs()
  const buffer = fs.readFileSync(DB_PATH)
  const db = new SQL.Database(buffer)

  // Get total count
  const totalRows = db.exec('SELECT COUNT(*) FROM facts')
  const total = totalRows[0]?.values[0]?.[0] ?? 0
  console.log(`[sim] Database has ${total} facts, simulating gameplay for ${COUNT}...\n`)

  // Sample random knowledge facts (type != 'vocab')
  const knowledgeRows = db.exec(`
    SELECT id, quiz_question, correct_answer, distractors, type, category, language
    FROM facts
    WHERE type != 'vocab'
    ORDER BY RANDOM()
    LIMIT ${COUNT}
  `)

  if (!knowledgeRows.length || !knowledgeRows[0].values.length) {
    console.error('[ERROR] No knowledge facts found in database')
    process.exit(1)
  }

  const scoreDistribution = { 1: [], 2: [], 3: [], 4: [], 5: [] }
  const allResults = []
  let totalScore = 0

  for (const row of knowledgeRows[0].values) {
    const [id, question, answer, distractorsJson, type, category, language] = row
    const q = String(question || '').trim()
    const a = String(answer || '').trim()

    // Parse distractors
    let distractors = []
    try { distractors = JSON.parse(String(distractorsJson || '[]')) } catch {}
    const dTexts = distractors.map(d => typeof d === 'string' ? d : String(d?.text ?? d ?? '')).filter(Boolean)

    // Skip if insufficient distractors (can't simulate 3 options)
    if (dTexts.length < 2) continue

    // Simulate: pick 2 random distractors
    const selectedDistracters = pickRandom(dTexts, 2)

    // Score this presentation
    const { score, reasons } = scorePresentation(q, a, selectedDistracters)
    scoreDistribution[score].push(id)
    totalScore += score

    allResults.push({
      id,
      question: q,
      correctAnswer: a,
      selectedDistracters,
      score,
      reasons,
      type,
      category,
      language,
    })
  }

  const tested = allResults.length
  const avgScore = (totalScore / tested).toFixed(2)

  // Report
  console.log('=== Gameplay Simulation Test (Knowledge Facts) ===')
  console.log(`Facts tested:             ${tested}`)
  console.log(`Score 5 (Perfect):        ${scoreDistribution[5].length} (${((scoreDistribution[5].length / tested) * 100).toFixed(1)}%)`)
  console.log(`Score 4 (Minor):          ${scoreDistribution[4].length} (${((scoreDistribution[4].length / tested) * 100).toFixed(1)}%)`)
  console.log(`Score 3 (Questionable):   ${scoreDistribution[3].length} (${((scoreDistribution[3].length / tested) * 100).toFixed(1)}%)`)
  console.log(`Score 2 (Bad):            ${scoreDistribution[2].length} (${((scoreDistribution[2].length / tested) * 100).toFixed(1)}%)`)
  console.log(`Score 1 (Terrible):       ${scoreDistribution[1].length} (${((scoreDistribution[1].length / tested) * 100).toFixed(1)}%)`)
  console.log(`Average score:            ${avgScore} / 5.0`)

  // Separate vocab test (sample 50)
  console.log('\n=== Gameplay Simulation Test (Vocab Facts) ===')
  const vocabRows = db.exec(`
    SELECT id, quiz_question, correct_answer, distractors, type, category, language
    FROM facts
    WHERE type = 'vocab'
    ORDER BY RANDOM()
    LIMIT 50
  `)

  if (vocabRows.length && vocabRows[0].values.length > 0) {
    const vocabScoreDistribution = { 1: [], 2: [], 3: [], 4: [], 5: [] }
    let vocabTotalScore = 0
    const vocabResults = []

    for (const row of vocabRows[0].values) {
      const [id, question, answer, distractorsJson, type, category, language] = row
      const q = String(question || '').trim()
      const a = String(answer || '').trim()

      let distractors = []
      try { distractors = JSON.parse(String(distractorsJson || '[]')) } catch {}
      const dTexts = distractors.map(d => typeof d === 'string' ? d : String(d?.text ?? d ?? '')).filter(Boolean)

      if (dTexts.length < 2) continue

      const selectedDistracters = pickRandom(dTexts, 2)
      const { score, reasons } = scorePresentation(q, a, selectedDistracters)
      vocabScoreDistribution[score].push(id)
      vocabTotalScore += score

      vocabResults.push({
        id,
        question: q,
        correctAnswer: a,
        selectedDistracters,
        score,
        reasons,
        type,
        category,
        language,
      })
    }

    const vocabTested = vocabResults.length
    const vocabAvgScore = (vocabTotalScore / vocabTested).toFixed(2)

    console.log(`Facts tested:             ${vocabTested}`)
    console.log(`Score 5 (Perfect):        ${vocabScoreDistribution[5].length} (${((vocabScoreDistribution[5].length / vocabTested) * 100).toFixed(1)}%)`)
    console.log(`Score 4 (Minor):          ${vocabScoreDistribution[4].length} (${((vocabScoreDistribution[4].length / vocabTested) * 100).toFixed(1)}%)`)
    console.log(`Score 3 (Questionable):   ${vocabScoreDistribution[3].length} (${((vocabScoreDistribution[3].length / vocabTested) * 100).toFixed(1)}%)`)
    console.log(`Score 2 (Bad):            ${vocabScoreDistribution[2].length} (${((vocabScoreDistribution[2].length / vocabTested) * 100).toFixed(1)}%)`)
    console.log(`Score 1 (Terrible):       ${vocabScoreDistribution[1].length} (${((vocabScoreDistribution[1].length / vocabTested) * 100).toFixed(1)}%)`)
    console.log(`Average score:            ${vocabAvgScore} / 5.0`)
  }

  // Verbose: show worst examples
  if (verbose) {
    const worstByScore = allResults.filter(r => r.score <= 2).sort((a, b) => a.score - b.score)

    if (worstByScore.length > 0) {
      console.log('\n--- Worst Presentations (score 1-2) ---')
      for (const result of worstByScore.slice(0, 15)) {
        console.log(`\n[${result.id}] Score ${result.score}/5`)
        console.log(`  Question: "${result.question}"`)
        console.log(`  Correct:  "${result.correctAnswer}"`)
        console.log(`  Distract: "${result.selectedDistracters[0]}", "${result.selectedDistracters[1]}"`)
        console.log(`  Issues:   ${result.reasons.join('; ')}`)
      }
    }
  }

  // Final judgment
  console.log('\n=== Overall Quality ===')
  const good = scoreDistribution[5].length + scoreDistribution[4].length
  const goodPct = ((good / tested) * 100).toFixed(1)
  console.log(`Presentations scoring 4-5: ${good} / ${tested} (${goodPct}%)`)

  if (avgScore >= 4.5) {
    console.log('[PASS] Excellent presentation quality!')
  } else if (avgScore >= 4.0) {
    console.log('[PASS] Good presentation quality (minor issues)')
  } else if (avgScore >= 3.0) {
    console.log('[WARN] Moderate issues in option presentations')
  } else {
    console.log('[FAIL] Significant quality issues in presentations')
  }

  db.close()
}

main().catch(err => {
  console.error('[FATAL]', err)
  process.exit(1)
})
