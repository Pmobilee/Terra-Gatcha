#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listJsonlFiles, loadJsonl, normalizeText, parseArgs, writeJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

const CONTROVERSIAL_TERMS = [
  'disputed',
  'controversial',
  'alleged',
  'conspiracy',
  'claims',
  'unverified',
  'debated',
]

function hasAnyTerm(text, terms) {
  const normalized = normalizeText(text)
  return terms.some((term) => normalized.includes(term))
}

function looksStale(text, currentYear) {
  const normalized = normalizeText(text)
  const yearMatches = [...normalized.matchAll(/\b(19\d{2}|20\d{2})\b/g)]
    .map((m) => Number(m[1]))
    .filter((year) => Number.isFinite(year))

  const hasRecencyLanguage = /(latest|currently|current|today|recent|as of)/.test(normalized)
  if (!hasRecencyLanguage || yearMatches.length === 0) return false

  return yearMatches.some((year) => year <= currentYear - 3)
}

function hasAnswerCollision(fact) {
  const answer = normalizeText(fact?.correctAnswer)
  if (!answer) return false

  const rawDistractors = Array.isArray(fact?.distractors) ? fact.distractors : []
  const distractors = rawDistractors
    .map((row) => {
      if (typeof row === 'string') return row
      if (row && typeof row === 'object') return row.text || row.value || ''
      return ''
    })
    .map((d) => normalizeText(d))
    .filter(Boolean)

  return distractors.includes(answer)
}

async function main() {
  const args = parseArgs(process.argv, {
    input: 'data/generated',
    output: 'data/generated/qa-reports/content-risk-report.json',
  })

  const inputDir = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output))
  const currentYear = new Date().getUTCFullYear()

  const files = await listJsonlFiles(inputDir)
  const flagged = []

  for (const file of files) {
    const bucket = path.basename(file, '.jsonl')
    const facts = await loadJsonl(file)

    for (const fact of facts) {
      const textBlob = `${fact?.statement || ''} ${fact?.quizQuestion || ''} ${fact?.explanation || ''}`
      const reasons = []

      if (hasAnswerCollision(fact)) reasons.push('answer_collision_with_distractor')
      if (hasAnyTerm(textBlob, CONTROVERSIAL_TERMS)) reasons.push('controversial_or_uncertain_wording')
      if (looksStale(textBlob, currentYear)) reasons.push('potentially_stale_time_reference')

      if (reasons.length > 0) {
        flagged.push({
          bucket,
          id: fact?.id || null,
          reasons,
          quizQuestion: fact?.quizQuestion || null,
          sourceName: fact?.sourceName || null,
          sourceUrl: fact?.sourceUrl || null,
        })
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    checkedFiles: files.length,
    totalFlagged: flagged.length,
    flagged,
  }

  await writeJson(outputPath, report)
  console.log(JSON.stringify({ ok: true, outputPath, totalFlagged: flagged.length }, null, 2))
}

main().catch((error) => {
  console.error('[flag-content-risks] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
