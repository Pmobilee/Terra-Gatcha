#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { listJsonlFiles, loadJsonl, parseArgs, readJson, writeJson } from './shared.mjs'

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

async function main() {
  const args = parseArgs(process.argv, {
    input: 'data/generated',
    output: 'src/data/seed/facts-generated.json',
    'approved-only': false,
    'rebuild-db': true,
    'enforce-qa-gate': false,
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

  for (const file of files) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await loadJsonl(file)
    for (const row of rows) {
      if (approvedOnly && row?.status && row.status !== 'approved') continue
      merged.push(normalizeFactShape(row))
    }
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
