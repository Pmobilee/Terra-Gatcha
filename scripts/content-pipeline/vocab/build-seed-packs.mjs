#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { parseArgs, readJson, writeJson } from './shared.mjs'

const execFileAsync = promisify(execFile)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

const DEFAULT_LANGUAGES = ['ja', 'es', 'fr', 'de', 'ko', 'zh', 'nl', 'cs']

function resolveFromRoot(relativePath) {
  return path.resolve(root, relativePath)
}

async function runNodeScript(scriptRelativePath, args = []) {
  const scriptPath = resolveFromRoot(scriptRelativePath)
  const cmdArgs = [scriptPath, ...args]
  await execFileAsync(process.execPath, cmdArgs, {
    cwd: root,
    env: process.env,
    maxBuffer: 1024 * 1024 * 20,
  })
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

async function countRows(filePath) {
  const rows = await readJson(filePath)
  return Array.isArray(rows) ? rows.length : 0
}

async function mergeHskOutputs(tempDir, outputDir) {
  const hsk2Path = path.join(tempDir, 'vocab-zh-hsk2.json')
  const hsk3Path = path.join(tempDir, 'vocab-zh-hsk3.json')
  const hsk2 = await readJson(hsk2Path)
  const hsk3 = await readJson(hsk3Path)

  const seen = new Set()
  const merged = []
  for (const row of [...(Array.isArray(hsk2) ? hsk2 : []), ...(Array.isArray(hsk3) ? hsk3 : [])]) {
    const word = String(row?.word || '').trim()
    if (!word) continue
    const key = word.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const hskLevel = Number(row?.hskLevel || 1)
    merged.push({
      ...row,
      word,
      language: 'zh',
      hskLevel,
      difficulty: Math.max(1, Math.min(5, Math.ceil(hskLevel / 2))),
    })
  }

  const outputPath = path.join(outputDir, 'vocab-zh.json')
  await writeJson(outputPath, merged)
  return { path: outputPath, count: merged.length }
}

async function buildKoreanPack(languageLimit, outputDir, tempDir, args) {
  const explicitWordlist = String(args['korean-wordlist'] || '')

  if (explicitWordlist) {
    const wordlistPath = resolveFromRoot(explicitWordlist)
    const enrichedPath = path.join(tempDir, 'ko-enriched.json')
    const outputPath = path.join(outputDir, 'vocab-ko.json')

    await runNodeScript('scripts/content-pipeline/vocab/enrich-wordlist.mjs', [
      '--input',
      wordlistPath,
      '--language',
      'ko',
      '--output',
      enrichedPath,
      '--limit',
      String(languageLimit),
      '--dry-run',
    ])

    await runNodeScript('scripts/content-pipeline/vocab/level-mapper.mjs', [
      '--input',
      enrichedPath,
      '--output',
      outputPath,
      '--language',
      'ko',
    ])

    return { path: outputPath, count: await countRows(outputPath), strategy: 'wordlist+enrichment' }
  }

  const lexemePath = path.join(tempDir, 'ko-lexemes.json')
  const outputPath = path.join(outputDir, 'vocab-ko.json')

  await runNodeScript('scripts/content-pipeline/vocab/import-wikidata-lexemes.mjs', [
    '--languages',
    'ko',
    '--limit',
    String(languageLimit),
    '--output',
    lexemePath,
  ])

  await runNodeScript('scripts/content-pipeline/vocab/level-mapper.mjs', [
    '--input',
    lexemePath,
    '--output',
    outputPath,
    '--language',
    'ko',
  ])

  return { path: outputPath, count: await countRows(outputPath), strategy: 'wikidata-lexemes' }
}

async function main() {
  const args = parseArgs(process.argv, {
    languages: DEFAULT_LANGUAGES.join(','),
    limit: 5000,
    'output-dir': 'src/data/seed',
    'temp-dir': 'data/generated/vocab-build',
  })

  const languageLimit = Math.max(1, Number(args.limit) || 5000)
  const outputDir = resolveFromRoot(String(args['output-dir']))
  const tempDir = resolveFromRoot(String(args['temp-dir']))
  const languages = String(args.languages)
    .split(',')
    .map((code) => code.trim().toLowerCase())
    .filter(Boolean)

  await ensureDir(outputDir)
  await ensureDir(tempDir)

  const report = {
    generatedAt: new Date().toISOString(),
    outputDir,
    requestedLanguages: languages,
    files: {},
  }

  if (languages.includes('ja')) {
    await runNodeScript('scripts/content-pipeline/vocab/import-jmdict.mjs', [
      '--output-dir',
      outputDir,
      '--limit',
      String(Math.max(languageLimit, 20000)),
    ])

    report.files['ja'] = {
      'vocab-n5.json': await countRows(path.join(outputDir, 'vocab-n5.json')),
      'vocab-n4.json': await countRows(path.join(outputDir, 'vocab-n4.json')),
      'vocab-n3.json': await countRows(path.join(outputDir, 'vocab-n3.json')),
      'vocab-n2.json': await countRows(path.join(outputDir, 'vocab-n2.json')),
      'vocab-n1.json': await countRows(path.join(outputDir, 'vocab-n1.json')),
    }
  }

  for (const code of ['es', 'fr', 'de', 'nl', 'cs']) {
    if (!languages.includes(code)) continue

    await runNodeScript('scripts/content-pipeline/vocab/import-european-vocab.mjs', [
      '--language',
      code,
      '--limit',
      String(languageLimit),
      '--output-dir',
      outputDir,
    ])

    const fileName = `vocab-${code}.json`
    report.files[code] = {
      [fileName]: await countRows(path.join(outputDir, fileName)),
    }
  }

  if (languages.includes('ko')) {
    const koReport = await buildKoreanPack(languageLimit, outputDir, tempDir, args)
    report.files['ko'] = {
      'vocab-ko.json': koReport.count,
      strategy: koReport.strategy,
    }
  }

  if (languages.includes('zh')) {
    await runNodeScript('scripts/content-pipeline/vocab/import-hsk-vocabulary.mjs', [
      '--output-dir',
      tempDir,
      '--limit',
      String(languageLimit),
    ])
    const zh = await mergeHskOutputs(tempDir, outputDir)
    report.files['zh'] = {
      'vocab-zh.json': zh.count,
    }
  }

  const reportPath = path.join(tempDir, 'vocab-build-report.json')
  await writeJson(reportPath, report)
  console.log(JSON.stringify({
    ok: true,
    reportPath,
    outputDir,
    generatedLanguages: Object.keys(report.files),
  }, null, 2))
}

main().catch((error) => {
  console.error('[build-seed-packs] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
