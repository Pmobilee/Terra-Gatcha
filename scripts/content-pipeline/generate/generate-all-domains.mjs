#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

const DEFAULT_DOMAINS = [
  'general-knowledge',
  'natural-sciences',
  'space-astronomy',
  'geography',
  'history',
  'mythology-folklore',
  'animals-wildlife',
  'human-body-health',
  'food-cuisine',
  'art-architecture',
]

function parseArgs(argv, defaults = {}) {
  const out = { ...defaults }
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next == null || next.startsWith('--')) {
      out[key] = true
      continue
    }
    if (next === 'true') out[key] = true
    else if (next === 'false') out[key] = false
    else if (!Number.isNaN(Number(next)) && next.trim() !== '') out[key] = Number(next)
    else out[key] = next
    i += 1
  }
  return out
}

function resolveFromRoot(relativePath) {
  return path.resolve(root, relativePath)
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function runNodeScript(scriptRelativePath, args = []) {
  const scriptPath = resolveFromRoot(scriptRelativePath)
  const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath, ...args], {
    cwd: root,
    env: process.env,
    maxBuffer: 1024 * 1024 * 30,
  })
  return {
    stdout: String(stdout || '').trim(),
    stderr: String(stderr || '').trim(),
  }
}

function toUnderscoreDomain(slug) {
  return String(slug).replace(/-/g, '_')
}

async function main() {
  const args = parseArgs(process.argv, {
    domains: DEFAULT_DOMAINS.join(','),
    'input-dir': 'data/raw',
    'output-dir': 'data/generated',
    'report-path': 'data/generated/qa-reports/generate-all-domains-report.json',
    limit: 0,
    'dry-run': false,
    validate: true,
    strict: false,
    concurrency: 2,
  })

  const domains = String(args.domains)
    .split(',')
    .map((domain) => domain.trim())
    .filter(Boolean)

  const inputDir = resolveFromRoot(String(args['input-dir']))
  const outputDir = resolveFromRoot(String(args['output-dir']))
  const reportPath = resolveFromRoot(String(args['report-path']))
  const limit = Math.max(0, Number(args.limit) || 0)
  const dryRun = Boolean(args['dry-run'])
  const validate = Boolean(args.validate)
  const strict = Boolean(args.strict)
  const concurrency = Math.max(1, Number(args.concurrency) || 2)

  await fs.mkdir(outputDir, { recursive: true })
  await fs.mkdir(path.dirname(reportPath), { recursive: true })

  const results = []

  for (const domainSlug of domains) {
    const startedAt = Date.now()
    const domainKey = toUnderscoreDomain(domainSlug)
    const inputPath = path.join(inputDir, `${domainSlug}.json`)
    const outputPath = path.join(outputDir, `${domainSlug}.jsonl`)

    const result = {
      domain: domainSlug,
      domainKey,
      inputPath,
      outputPath,
      ok: false,
      generated: false,
      validated: false,
      dryRun,
      durationMs: 0,
      steps: [],
    }

    if (!(await exists(inputPath))) {
      result.steps.push({
        name: 'preflight',
        ok: false,
        error: `input file missing: ${inputPath}`,
      })
      result.durationMs = Date.now() - startedAt
      results.push(result)
      if (strict) {
        const report = {
          generatedAt: new Date().toISOString(),
          inputDir,
          outputDir,
          domains,
          dryRun,
          validate,
          strict,
          concurrency,
          results,
          pass: false,
        }
        await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
        process.exit(1)
      }
      continue
    }

    const generateArgs = [
      '--input', inputPath,
      '--domain', domainKey,
      '--output', outputPath,
      '--concurrency', String(concurrency),
    ]

    if (limit > 0) {
      generateArgs.push('--limit', String(limit))
    }

    if (dryRun) {
      generateArgs.push('--dry-run')
    }

    try {
      const run = await runNodeScript('scripts/content-pipeline/generate/batch-generate.mjs', generateArgs)
      result.steps.push({ name: 'generate', ok: true, stdout: run.stdout, stderr: run.stderr })
      result.generated = true
    } catch (error) {
      result.steps.push({
        name: 'generate',
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
      result.durationMs = Date.now() - startedAt
      results.push(result)
      if (strict) {
        break
      }
      continue
    }

    if (validate) {
      try {
        const run = await runNodeScript('scripts/content-pipeline/generate/validate-output.mjs', [
          '--input',
          outputPath,
          '--strict',
        ])
        result.steps.push({ name: 'validate', ok: true, stdout: run.stdout, stderr: run.stderr })
        result.validated = true
      } catch (error) {
        result.steps.push({
          name: 'validate',
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
        result.durationMs = Date.now() - startedAt
        results.push(result)
        if (strict) {
          break
        }
        continue
      }
    }

    result.ok = true
    result.durationMs = Date.now() - startedAt
    results.push(result)
  }

  const report = {
    generatedAt: new Date().toISOString(),
    inputDir,
    outputDir,
    domains,
    dryRun,
    validate,
    strict,
    concurrency,
    limit: limit || null,
    results,
    pass: results.length > 0 && results.every((result) => result.ok),
  }

  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  console.log(JSON.stringify({
    ok: report.pass,
    reportPath,
    totalDomains: results.length,
    passedDomains: results.filter((result) => result.ok).length,
  }, null, 2))

  if (strict && !report.pass) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('[generate-all-domains] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
