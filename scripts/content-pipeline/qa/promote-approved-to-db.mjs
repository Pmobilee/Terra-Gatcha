#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { listJsonlFiles, loadJsonl, parseArgs, readJson, writeJson } from './shared.mjs'
import { hasSubcategoryTaxonomy, isValidSubcategoryId, resolveFactTaxonomyDomain } from '../subcategory-taxonomy.mjs'

const execFileAsync = promisify(execFile)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

function deriveRarity(difficulty) {
  switch (difficulty) {
    case 1: case 2: return 'common'
    case 3: return 'uncommon'
    case 4: return 'rare'
    case 5: return 'epic'
    default: return 'common'
  }
}

function normalizeFactShape(fact) {
  const type = fact?.type || (fact?.contentType === 'vocabulary' ? 'vocabulary' : 'fact')
  const explanation = fact?.explanation || fact?.wowFactor || fact?.statement || ''
  const rarity = fact?.rarity || deriveRarity(fact?.difficulty)

  if (Array.isArray(fact?.category)) {
    return { ...fact, type, explanation, rarity }
  }

  const category = typeof fact?.category === 'string'
    ? [fact.category]
    : ['General Knowledge']

  return {
    ...fact,
    type,
    category,
    explanation,
    rarity,
  }
}

function taxonomyViolationForFact(fact) {
  const domain = resolveFactTaxonomyDomain(fact, '')
  if (!domain || !hasSubcategoryTaxonomy(domain)) return null
  const categoryL2 = String(fact?.categoryL2 ?? '').trim()
  if (isValidSubcategoryId(domain, categoryL2)) return null
  return {
    id: fact?.id || null,
    domain,
    categoryL2,
    category: Array.isArray(fact?.category) ? fact.category.slice(0, 3) : fact?.category,
    question: fact?.quizQuestion || fact?.statement || '',
  }
}

const DISTRACTOR_BLOCKLIST = new Set([
  'unknown', 'other', 'none of the above', 'none of these',
  'all of the above', 'n/a', '...', '', 'debated', 'disputed',
  '[object object]'
])

function validateFactQuality(fact) {
  const issues = []

  // Require Haiku processing
  if (!fact._haikuProcessed) {
    issues.push('Missing _haikuProcessed flag — fact was never processed by Haiku agent')
  }

  // Check distractors for blocklisted content
  if (Array.isArray(fact.distractors)) {
    for (const d of fact.distractors) {
      const text = (typeof d === 'string' ? d : d?.text || '').toLowerCase().trim()
      if (DISTRACTOR_BLOCKLIST.has(text)) {
        issues.push(`Blocklisted distractor: "${text}"`)
      }
      if (typeof d === 'object' && d !== null) {
        issues.push('Object-format distractor (must be plain string)')
      }
    }
  }

  // Check answer completeness
  const answer = String(fact.correctAnswer || '')
  if (answer.length < 2) issues.push('Answer too short')
  if (answer.endsWith('...')) issues.push('Truncated answer')

  // Check question completeness
  const question = String(fact.quizQuestion || '')
  if (question.length < 10) issues.push('Question too short')
  if (question.endsWith('...')) issues.push('Truncated question')

  return issues
}

async function main() {
  const args = parseArgs(process.argv, {
    input: 'data/generated',
    output: 'src/data/seed/facts-generated.json',
    'approved-only': true,
    'rebuild-db': true,
    'enforce-qa-gate': true,
    'qa-report': 'data/generated/qa-reports/post-ingestion-gate.json',
  })

  const inputDir = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output))
  const approvedOnly = Boolean(args['approved-only'])
  const rebuildDb = Boolean(args['rebuild-db'])
  const enforceQaGate = Boolean(args['enforce-qa-gate'])
  const qaReportPath = path.resolve(root, String(args['qa-report']))

  if (enforceQaGate) {
    let qaReport
    try {
      qaReport = await readJson(qaReportPath)
    } catch (error) {
      throw new Error(`QA gate report missing or unreadable: ${qaReportPath}. Run npm run content:qa first.`)
    }

    if (!qaReport?.pass) {
      throw new Error(`QA gate failed in ${qaReportPath}. Refusing promotion.`)
    }
  }

  const files = await listJsonlFiles(inputDir)
  const merged = []
  const taxonomyViolations = []
  const qualityRejections = []

  for (const file of files) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await loadJsonl(file)
    for (const row of rows) {
      if (approvedOnly && row?.status && row.status !== 'approved') continue
      const normalized = normalizeFactShape(row)
      const violation = taxonomyViolationForFact(normalized)
      if (violation) {
        taxonomyViolations.push(violation)
        continue
      }

      // Validate fact quality
      const qualityIssues = validateFactQuality(normalized)
      if (qualityIssues.length > 0) {
        qualityRejections.push({
          id: normalized?.id || null,
          domain: 'quality',
          categoryL2: 'quality_gate',
          category: Array.isArray(normalized?.category) ? normalized.category.slice(0, 3) : normalized?.category,
          question: normalized?.quizQuestion || '',
          issues: qualityIssues,
        })
        continue
      }

      merged.push(normalized)
    }
  }

  if (qualityRejections.length > 0) {
    console.warn(`[promote] ${qualityRejections.length} facts rejected by quality gate`)
    for (const r of qualityRejections.slice(0, 10)) {
      console.warn(`  - ${r.id}: ${r.issues.join(', ')}`)
    }
  }

  if (taxonomyViolations.length > 0 || qualityRejections.length > 0) {
    const violationsByDomain = taxonomyViolations.reduce((acc, violation) => {
      const key = violation.domain || 'unknown'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    const reportPath = path.resolve(root, 'data/generated/qa-reports/promote-approved-report.json')
    await writeJson(reportPath, {
      generatedAt: new Date().toISOString(),
      inputDir,
      scannedFiles: files.length,
      promotedFacts: 0,
      outputPath,
      qaGateEnforced: enforceQaGate,
      qaReportPath: enforceQaGate ? qaReportPath : null,
      taxonomyValidation: {
        pass: false,
        violations: taxonomyViolations.length,
        byDomain: violationsByDomain,
        samples: taxonomyViolations.slice(0, 50),
      },
      qualityValidation: {
        rejections: qualityRejections.length,
        samples: qualityRejections.slice(0, 50),
      },
    })

    const errors = []
    if (taxonomyViolations.length > 0) errors.push(`taxonomy categoryL2 validation failed (${taxonomyViolations.length} invalid rows)`)
    if (qualityRejections.length > 0) errors.push(`quality gate validation failed (${qualityRejections.length} facts rejected)`)
    throw new Error(`promotion blocked during QA: ${errors.join(', ')}`)
  }

  await writeJson(outputPath, merged)

  const reportPath = path.resolve(root, 'data/generated/qa-reports/promote-approved-report.json')
  await writeJson(reportPath, {
    generatedAt: new Date().toISOString(),
    inputDir,
    scannedFiles: files.length,
    promotedFacts: merged.length,
    outputPath,
    qaGateEnforced: enforceQaGate,
    qaReportPath: enforceQaGate ? qaReportPath : null,
    taxonomyValidation: { pass: true, violations: 0 },
  })

  if (rebuildDb) {
    await execFileAsync(process.execPath, [path.resolve(root, 'scripts/build-facts-db.mjs')], {
      cwd: root,
      env: process.env,
      maxBuffer: 1024 * 1024 * 25,
    })
  }

  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  console.log(JSON.stringify({
    ok: true,
    outputPath,
    reportPath,
    rebuildDb,
    promotedFacts: merged.length,
    qaGateEnforced: enforceQaGate,
    qaReportPath: enforceQaGate ? qaReportPath : null,
  }, null, 2))
}

main().catch((error) => {
  console.error('[promote-approved-to-db] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
