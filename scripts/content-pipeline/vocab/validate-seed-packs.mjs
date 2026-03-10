#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, readJson, writeJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

const DEFAULT_LANGUAGES = ['ja', 'es', 'fr', 'de', 'ko', 'zh']
const JLPT_FILES = ['vocab-n5.json', 'vocab-n4.json', 'vocab-n3.json', 'vocab-n2.json', 'vocab-n1.json']

function resolveFromRoot(relativePath) {
  return path.resolve(root, relativePath)
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== ''
}

function validateCommonEntry(entry) {
  const errors = []
  if (!hasValue(entry?.word)) errors.push('missing_word')
  if (!hasValue(entry?.sourceName)) errors.push('missing_source_name')
  if (!hasValue(entry?.language)) errors.push('missing_language')
  return errors
}

function validateLevelFields(entry, languageCode) {
  if (languageCode === 'ja') {
    return hasValue(entry?.jlptLevel) ? [] : ['missing_jlpt_level']
  }

  if (['es', 'fr', 'de', 'nl', 'cs'].includes(languageCode)) {
    return hasValue(entry?.cefrLevel) || hasValue(entry?.mappedLevel)
      ? []
      : ['missing_cefr_level']
  }

  if (languageCode === 'ko') {
    return hasValue(entry?.topikLevel) || hasValue(entry?.mappedLevel) || hasValue(entry?.cefrLevel)
      ? []
      : ['missing_topik_or_mapped_level']
  }

  if (languageCode === 'zh') {
    return hasValue(entry?.hskLevel) || hasValue(entry?.mappedLevel)
      ? []
      : ['missing_hsk_or_mapped_level']
  }

  return []
}

async function validateFile(filePath, languageCode, minRows) {
  const rows = await readJson(filePath)
  if (!Array.isArray(rows)) {
    return {
      ok: false,
      exists: true,
      totalRows: 0,
      failingRows: 1,
      errorCounts: { not_array: 1 },
    }
  }

  const errorCounts = {}
  let failingRows = 0
  for (const entry of rows) {
    const entryErrors = [
      ...validateCommonEntry(entry),
      ...validateLevelFields(entry, languageCode),
    ]

    if (entryErrors.length > 0) {
      failingRows += 1
      for (const error of entryErrors) {
        errorCounts[error] = (errorCounts[error] || 0) + 1
      }
    }
  }

  const meetsCount = rows.length >= minRows
  if (!meetsCount) {
    errorCounts.below_minimum_rows = 1
  }

  return {
    ok: failingRows === 0 && meetsCount,
    exists: true,
    totalRows: rows.length,
    failingRows,
    errorCounts,
  }
}

async function validateLanguage(seedDir, languageCode, minRows) {
  if (languageCode === 'ja') {
    const files = {}
    for (const fileName of JLPT_FILES) {
      const filePath = path.join(seedDir, fileName)
      try {
        files[fileName] = await validateFile(filePath, 'ja', Math.max(1, Math.floor(minRows / 5)))
      } catch {
        files[fileName] = {
          ok: false,
          exists: false,
          totalRows: 0,
          failingRows: 0,
          errorCounts: { file_missing: 1 },
        }
      }
    }

    return {
      ok: Object.values(files).every((file) => file.ok),
      files,
    }
  }

  const fileName = `vocab-${languageCode}.json`
  const filePath = path.join(seedDir, fileName)
  try {
    const result = await validateFile(filePath, languageCode, minRows)
    return {
      ok: result.ok,
      files: {
        [fileName]: result,
      },
    }
  } catch {
    return {
      ok: false,
      files: {
        [fileName]: {
          ok: false,
          exists: false,
          totalRows: 0,
          failingRows: 0,
          errorCounts: { file_missing: 1 },
        },
      },
    }
  }
}

async function main() {
  const args = parseArgs(process.argv, {
    'seed-dir': 'src/data/seed',
    languages: DEFAULT_LANGUAGES.join(','),
    'min-rows': 100,
    strict: false,
    output: 'docs/roadmap/evidence/vocab-validation-report.json',
  })

  const seedDir = resolveFromRoot(String(args['seed-dir']))
  const minRows = Math.max(1, Number(args['min-rows']) || 100)
  const strict = Boolean(args.strict)
  const outputPath = resolveFromRoot(String(args.output))

  const languages = String(args.languages)
    .split(',')
    .map((code) => code.trim().toLowerCase())
    .filter(Boolean)

  const report = {
    generatedAt: new Date().toISOString(),
    seedDir,
    minRows,
    strict,
    languages: {},
    allValid: true,
  }

  for (const languageCode of languages) {
    const result = await validateLanguage(seedDir, languageCode, minRows)
    report.languages[languageCode] = result
    if (!result.ok) {
      report.allValid = false
    }
  }

  await writeJson(outputPath, report)

  console.log(JSON.stringify({
    ok: report.allValid,
    outputPath,
    checkedLanguages: languages,
  }, null, 2))

  if (strict && !report.allValid) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('[validate-seed-packs] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
