#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, readJson, writeJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

function isLanguageBucket(name) {
  const lower = String(name || '').toLowerCase()
  return lower.includes('vocab') || /^.*-(ja|es|fr|de|ko|zh|nl|cs)$/.test(lower)
}

async function main() {
  const args = parseArgs(process.argv, {
    input: 'data/generated/qa-reports/coverage-report.json',
    output: 'data/generated/qa-reports/coverage-gate.json',
    'knowledge-min': 10000,
    'language-min': 5000,
    strict: false,
  })

  const inputPath = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output))
  const knowledgeMin = Math.max(1, Number(args['knowledge-min']) || 10000)
  const languageMin = Math.max(1, Number(args['language-min']) || 5000)
  const strict = Boolean(args.strict)

  const coverage = await readJson(inputPath)
  const domains = coverage?.domains && typeof coverage.domains === 'object' ? coverage.domains : {}

  const deficits = []
  let knowledgePassed = 0
  let languagePassed = 0

  for (const [name, summary] of Object.entries(domains)) {
    const total = Number(summary?.total || 0)
    const language = isLanguageBucket(name)
    const threshold = language ? languageMin : knowledgeMin
    const passed = total >= threshold

    if (passed) {
      if (language) languagePassed += 1
      else knowledgePassed += 1
      continue
    }

    deficits.push({
      name,
      type: language ? 'language' : 'knowledge',
      total,
      required: threshold,
      missing: Math.max(0, threshold - total),
    })
  }

  const result = {
    generatedAt: new Date().toISOString(),
    inputPath,
    thresholds: {
      knowledgeMin,
      languageMin,
    },
    summary: {
      checkedBuckets: Object.keys(domains).length,
      knowledgePassed,
      languagePassed,
      deficits: deficits.length,
    },
    deficits,
    pass: deficits.length === 0,
  }

  await writeJson(outputPath, result)
  console.log(JSON.stringify({ ok: result.pass, outputPath, deficits: deficits.length }, null, 2))

  if (strict && !result.pass) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('[coverage-gate] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
