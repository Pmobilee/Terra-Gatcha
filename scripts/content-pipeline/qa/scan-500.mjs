#!/usr/bin/env node
/**
 * scan-500.mjs — Sample 500 random facts from the DB and check for quality issues.
 * Quick verification that fix-fact-quality.mjs + mine-distractors.mjs worked.
 *
 * Usage: node scripts/content-pipeline/qa/scan-500.mjs [--count 500] [--verbose]
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
const COUNT = countIdx >= 0 ? parseInt(args[countIdx + 1], 10) || 500 : 500

const DB_PATH = path.join(root, 'public', 'facts.db')

// Load sql.js
const initSqlJs = require('sql.js')
const fs = require('fs')

async function main() {
  const SQL = await initSqlJs()
  const buffer = fs.readFileSync(DB_PATH)
  const db = new SQL.Database(buffer)

  // Get total count
  const totalRows = db.exec('SELECT COUNT(*) FROM facts')
  const total = totalRows[0]?.values[0]?.[0] ?? 0
  console.log(`[scan] Database has ${total} facts, sampling ${COUNT}...\n`)

  // Sample random facts
  const rows = db.exec(`SELECT id, quiz_question, correct_answer, distractors, type, category FROM facts ORDER BY RANDOM() LIMIT ${COUNT}`)
  if (!rows.length || !rows[0].values.length) {
    console.error('[ERROR] No facts found in database')
    process.exit(1)
  }

  const issues = {
    garbageDistractors: [],
    answerInDistractors: [],
    duplicateDistractors: [],
    answerInQuestion: [],
    tooFewDistractors: [],
    emptyQuestion: [],
    emptyAnswer: [],
    bareWordQuestion: [],
    sameDistractorSet: new Map(), // hash -> [ids]
  }

  for (const row of rows[0].values) {
    const [id, question, answer, distractorsJson, type, category] = row
    const q = String(question || '').trim()
    const a = String(answer || '').trim()
    const aNorm = normalizeText(a)

    // Parse distractors
    let distractors = []
    try { distractors = JSON.parse(String(distractorsJson || '[]')) } catch {}
    const dTexts = distractors.map(d => typeof d === 'string' ? d : String(d?.text ?? d ?? ''))

    // Check: empty question/answer
    if (!q) issues.emptyQuestion.push({ id, question: q, answer: a })
    if (!a) issues.emptyAnswer.push({ id, question: q, answer: a })

    // Check: bare word question (no spaces, no ?)
    if (q && !q.includes(' ') && !q.includes('?') && q.length < 30) {
      issues.bareWordQuestion.push({ id, question: q, answer: a })
    }

    // Check: too few distractors
    if (dTexts.length < 3) {
      issues.tooFewDistractors.push({ id, question: q, count: dTexts.length })
    }

    // Check: garbage distractors
    const garbageFound = dTexts.filter(d => isBadDistractor(d))
    if (garbageFound.length > 0) {
      issues.garbageDistractors.push({ id, question: q, garbage: garbageFound })
    }

    // Check: answer in distractors
    const answerDupes = dTexts.filter(d => normalizeText(d) === aNorm)
    if (answerDupes.length > 0) {
      issues.answerInDistractors.push({ id, question: q, answer: a })
    }

    // Check: duplicate distractors
    const seen = new Set()
    const dupes = []
    for (const d of dTexts) {
      const norm = normalizeText(d)
      if (seen.has(norm)) dupes.push(d)
      seen.add(norm)
    }
    if (dupes.length > 0) {
      issues.duplicateDistractors.push({ id, question: q, dupes })
    }

    // Check: answer in question
    if (hasAnswerInQuestion(q, a)) {
      issues.answerInQuestion.push({ id, question: q, answer: a, type })
    }

    // Check: same distractor set (hash first 5 sorted)
    const sortedKey = dTexts.slice(0, 5).map(d => normalizeText(d)).sort().join('|')
    if (!issues.sameDistractorSet.has(sortedKey)) {
      issues.sameDistractorSet.set(sortedKey, [])
    }
    issues.sameDistractorSet.get(sortedKey).push(id)
  }

  // Find reused distractor sets (3+ facts sharing same set)
  const reusedSets = [...issues.sameDistractorSet.entries()]
    .filter(([, ids]) => ids.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)

  // Report
  console.log('=== Quality Scan Results ===')
  console.log(`Facts scanned:            ${COUNT}`)
  console.log(`Garbage distractors:      ${issues.garbageDistractors.length}`)
  console.log(`Answer in distractors:    ${issues.answerInDistractors.length}`)
  console.log(`Duplicate distractors:    ${issues.duplicateDistractors.length}`)
  console.log(`Answer in question:       ${issues.answerInQuestion.length}`)
  console.log(`Too few distractors (<3): ${issues.tooFewDistractors.length}`)
  console.log(`Empty questions:          ${issues.emptyQuestion.length}`)
  console.log(`Empty answers:            ${issues.emptyAnswer.length}`)
  console.log(`Bare-word questions:      ${issues.bareWordQuestion.length}`)
  console.log(`Reused distractor sets:   ${reusedSets.length} sets shared by 3+ facts`)

  const totalIssues = issues.garbageDistractors.length + issues.answerInDistractors.length +
    issues.duplicateDistractors.length + issues.tooFewDistractors.length +
    issues.emptyQuestion.length + issues.emptyAnswer.length + issues.bareWordQuestion.length

  if (totalIssues === 0 && reusedSets.length === 0) {
    console.log('\n[PASS] No critical quality issues found in sample!')
  } else {
    console.log(`\n[ISSUES] ${totalIssues} critical issues + ${issues.answerInQuestion.length} answer-in-question (needs LLM fix)`)
  }

  // Verbose output
  if (verbose) {
    if (issues.garbageDistractors.length > 0) {
      console.log('\n--- Garbage Distractors (first 10) ---')
      for (const item of issues.garbageDistractors.slice(0, 10)) {
        console.log(`  ${item.id}: "${item.question}" → garbage: ${JSON.stringify(item.garbage)}`)
      }
    }
    if (issues.answerInQuestion.length > 0) {
      console.log('\n--- Answer in Question (first 10) ---')
      for (const item of issues.answerInQuestion.slice(0, 10)) {
        console.log(`  ${item.id} [${item.type}]: "${item.question}" → "${item.answer}"`)
      }
    }
    if (reusedSets.length > 0) {
      console.log('\n--- Most Reused Distractor Sets (top 5) ---')
      for (const [key, ids] of reusedSets.slice(0, 5)) {
        console.log(`  ${ids.length} facts share: ${key.split('|').slice(0, 3).join(', ')}...`)
      }
    }
  }

  db.close()
}

main().catch(err => {
  console.error('[FATAL]', err)
  process.exit(1)
})
