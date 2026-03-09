#!/usr/bin/env node
/**
 * Content coverage report generator (AR-11).
 *
 * Usage:
 *   node scripts/report-coverage.mjs
 *   node scripts/report-coverage.mjs --json ./tmp/coverage.json --md ./tmp/coverage.md
 */

import fs from 'node:fs'
import path from 'node:path'
import { buildCoverageReport } from './contentPipelineUtils.mjs'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const SEED_DIR = path.join(ROOT, 'src', 'data', 'seed')
const DEFAULT_JSON = path.join(ROOT, 'docs', 'roadmap', 'evidence', 'content-coverage.json')
const DEFAULT_MD = path.join(ROOT, 'docs', 'roadmap', 'evidence', 'content-coverage.md')

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const value = argv[i + 1]
    if (value && !value.startsWith('--')) {
      args[key] = value
      i += 1
    } else {
      args[key] = true
    }
  }
  return args
}

function findJsonFiles(dir) {
  if (!fs.existsSync(dir)) return []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...findJsonFiles(full))
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(full)
  }
  return files
}

function readFacts() {
  const files = findJsonFiles(SEED_DIR)
  const facts = []
  for (const file of files) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (Array.isArray(parsed)) facts.push(...parsed)
    } catch {
      // skip malformed files
    }
  }
  return facts
}

function write(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, text)
}

function markdownFromReport(report) {
  const rows = (object) => Object.entries(object)
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([key, value]) => `| ${key} | ${value} |`)
    .join('\n')

  return [
    '# Content Coverage Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `- Total facts: **${report.totalFacts}**`,
    `- Source coverage: **${report.withSource}/${report.totalFacts} (${report.sourceCoveragePct}%)**`,
    `- Verified: **${report.byVerification.verified}**`,
    `- Unverified: **${report.byVerification.unverified}**`,
    '',
    '## By Category',
    '| Category | Count |',
    '|---|---:|',
    rows(report.byCategory),
    '',
    '## By Difficulty',
    '| Difficulty | Count |',
    '|---|---:|',
    rows(report.byDifficulty),
    '',
    '## By Type',
    '| Type | Count |',
    '|---|---:|',
    rows(report.byType),
    '',
    '## By Age Rating',
    '| Age Rating | Count |',
    '|---|---:|',
    rows(report.byAgeRating),
    '',
    `## Distractor Warnings`,
    `- Flagged facts: **${report.distractorWarnings.length}**`,
    '',
  ].join('\n')
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const outputJson = path.resolve(process.cwd(), args.json || DEFAULT_JSON)
  const outputMd = path.resolve(process.cwd(), args.md || DEFAULT_MD)

  const facts = readFacts()
  const report = buildCoverageReport(facts)

  write(outputJson, `${JSON.stringify(report, null, 2)}\n`)
  write(outputMd, `${markdownFromReport(report)}\n`)

  console.log(`Coverage JSON: ${path.relative(ROOT, outputJson)}`)
  console.log(`Coverage MD: ${path.relative(ROOT, outputMd)}`)
  console.log(`Total facts: ${report.totalFacts}`)
  console.log(`Source coverage: ${report.sourceCoveragePct}%`)
}

main()
