#!/usr/bin/env node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { parseArgs } from 'node:util'
import { normalizeText } from './qa/shared.mjs'

const execFileAsync = promisify(execFile)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../..')

const VALID_VARIANT_TYPES = new Set(['forward', 'reverse', 'negative', 'fill_blank', 'true_false'])

function parseBoolean(value, fallback = false) {
  if (value == null) return fallback
  const normalized = String(value).trim().toLowerCase()
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true
  if (['false', '0', 'no', 'n'].includes(normalized)) return false
  return fallback
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function ensureParentDir(filePath) {
  return fs.mkdir(path.dirname(filePath), { recursive: true })
}

function wordCount(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length
}

function truncate(value, limit = 280) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= limit) return text
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`
}

function factDomain(fact) {
  if (typeof fact?.domain === 'string' && fact.domain.trim()) {
    return fact.domain.trim().replaceAll('-', '_')
  }
  if (Array.isArray(fact?.category) && typeof fact.category[0] === 'string' && fact.category[0].trim()) {
    return fact.category[0].trim().replaceAll('-', '_')
  }
  if (typeof fact?.category === 'string' && fact.category.trim()) {
    return fact.category.trim().replaceAll('-', '_')
  }
  return 'unknown'
}

function isKnowledgeFact(fact) {
  return String(fact?.type || '').trim().toLowerCase() !== 'vocabulary'
}

function needsVariants(fact, overwrite) {
  if (overwrite) return true
  return !(Array.isArray(fact?.variants) && fact.variants.length >= 3)
}

function extractTags(fact) {
  if (!Array.isArray(fact?.tags)) return []
  return fact.tags
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 6)
}

function compactFactForPrompt(fact) {
  return {
    id: String(fact.id || '').trim(),
    domain: factDomain(fact),
    categoryL2: String(fact.categoryL2 || '').trim(),
    statement: truncate(fact.statement, 260),
    quizQuestion: truncate(fact.quizQuestion, 180),
    correctAnswer: truncate(fact.correctAnswer, 80),
    explanation: truncate(fact.explanation, 240),
    distractors: Array.isArray(fact.distractors)
      ? fact.distractors
        .slice(0, 4)
        .map((item) => typeof item === 'string' ? item : String(item?.text || item?.value || ''))
        .filter(Boolean)
      : [],
    tags: extractTags(fact),
  }
}

function buildBatchPrompt(facts) {
  const serializedFacts = JSON.stringify(facts.map(compactFactForPrompt), null, 2)
  return [
    'You are writing high-quality quiz variants for Recall Rogue.',
    '',
    'Return STRICT JSON only with this shape:',
    '{"results":[{"id":"<fact-id>","variants":[{"question":"...","type":"forward|reverse|negative|fill_blank|true_false","correctAnswer":"...","distractors":["...","...","..."]}]}]}',
    '',
    'Hard rules:',
    '- Output one result for every input fact id.',
    '- Generate exactly 5 variants per fact unless a true_false variant would weaken quality. Minimum 4 is acceptable only if one type would be forced.',
    '- Prefer forward, reverse, negative, and fill_blank. Use true_false only when it is genuinely strong.',
    '- Each variant must test the SAME fact from a different angle.',
    '- Do NOT restate or lightly rephrase the base quizQuestion.',
    '- The first variant must be a genuinely new angle, not the original question again.',
    '- Each variant correctAnswer must directly answer that variant question.',
    '- Do not copy the base correctAnswer into a different question unless it still directly answers that question.',
    '- Do not include the exact correctAnswer text inside the variant question unless it is a true_false statement.',
    '- correctAnswer should usually be 1-5 words. Keep it concise.',
    '- Distractors must come from world knowledge, not database answer pools.',
    '- Distractors must be plausible, wrong, semantically coherent, unique, and format-matched.',
    '- For normal variants, provide exactly 3 distractors.',
    '- For true_false, use correctAnswer of "True" or "False" and a single distractor with the opposite value.',
    '- For negative variants, the question must explicitly include NOT or FALSE. The correctAnswer must be the FALSE option and the distractors must all be TRUE options.',
    '- Keep questions concise and playable.',
    '- Do not include markdown fences or commentary.',
    '',
    'Input facts:',
    serializedFacts,
  ].join('\n')
}

async function runSubscriptionWorker(prompt, model, timeoutMs) {
  const outputPath = path.join(
    os.tmpdir(),
    `variant-gen-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`,
  )

  try {
    await ensureParentDir(outputPath)
    await execFileAsync(
      'codex',
      [
        'exec',
        '-m',
        model,
        '-s',
        'read-only',
        '--skip-git-repo-check',
        '--color',
        'never',
        '-o',
        outputPath,
        prompt,
      ],
      {
        cwd: root,
        env: process.env,
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024 * 40,
      },
    )
    return (await fs.readFile(outputPath, 'utf8')).trim()
  } finally {
    await fs.rm(outputPath, { force: true }).catch(() => {})
  }
}

function extractJsonPayload(text) {
  const raw = String(text || '').trim()
  if (!raw) return null

  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim())
    } catch {
      // continue
    }
  }

  try {
    return JSON.parse(raw)
  } catch {
    // continue
  }

  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1))
    } catch {
      return null
    }
  }

  return null
}

function normalizeDistractorList(variant) {
  if (!Array.isArray(variant?.distractors)) return []
  return variant.distractors
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

function validateVariant(baseFact, variant, index) {
  const errors = []
  if (!variant || typeof variant !== 'object') {
    return [`variant[${index}] is not an object`]
  }

  const question = String(variant.question || '').trim()
  const type = String(variant.type || '').trim()
  const answer = String(variant.correctAnswer || '').trim()
  const distractors = normalizeDistractorList(variant)

  if (!question) errors.push(`variant[${index}] missing question`)
  if (!VALID_VARIANT_TYPES.has(type)) errors.push(`variant[${index}] invalid type`)
  if (!answer) errors.push(`variant[${index}] missing correctAnswer`)

  if (type === 'true_false') {
    if (!['True', 'False'].includes(answer)) {
      errors.push(`variant[${index}] true_false answer must be True or False`)
    }
    if (distractors.length !== 1) {
      errors.push(`variant[${index}] true_false must have exactly 1 distractor`)
    }
  } else if (distractors.length !== 3) {
    errors.push(`variant[${index}] must have exactly 3 distractors`)
  }

  if (type !== 'true_false') {
    const answerWords = wordCount(answer)
    if (answerWords === 0 || answerWords > 8) {
      errors.push(`variant[${index}] answer length is out of range`)
    }
  }

  const normalizedAnswer = normalizeText(answer)
  const normalizedQuestion = normalizeText(question)

  if (normalizedAnswer && normalizedAnswer.length >= 5 && normalizedQuestion.includes(normalizedAnswer)) {
    errors.push(`variant[${index}] question leaks answer`)
  }

  const seen = new Set()
  for (let i = 0; i < distractors.length; i += 1) {
    const distractor = distractors[i]
    const normalizedDistractor = normalizeText(distractor)
    if (!normalizedDistractor) {
      errors.push(`variant[${index}] distractor[${i}] empty`)
      continue
    }
    if (normalizedDistractor === normalizedAnswer) {
      errors.push(`variant[${index}] distractor[${i}] matches answer`)
    }
    if (seen.has(normalizedDistractor)) {
      errors.push(`variant[${index}] distractor[${i}] duplicated`)
    }
    seen.add(normalizedDistractor)
  }

  if (type === 'negative' && !/\bnot\b|\bfalse\b/i.test(question)) {
    errors.push(`variant[${index}] negative question should clearly signal NOT/FALSE`)
  }

  if (type === 'reverse' && wordCount(answer) > 6) {
    errors.push(`variant[${index}] reverse answer should be noun-like and concise`)
  }

  if (type === 'fill_blank' && !question.includes('_____')) {
    if (!/_{3,}/.test(question)) {
      errors.push(`variant[${index}] fill_blank question must include a visible blank`)
    }
  }

  if (question && question.length > 160) {
    errors.push(`variant[${index}] question too long`)
  }

  return errors
}

function validateFactVariants(baseFact, variants) {
  const errors = []
  if (!Array.isArray(variants)) {
    return ['variants is not an array']
  }
  if (variants.length < 4 || variants.length > 5) {
    errors.push(`variant count must be 4-5, got ${variants.length}`)
  }

  const typeCounts = new Map()
  const seenQuestions = new Set()
  const baseQuestion = normalizeText(String(baseFact.quizQuestion || ''))
  for (let i = 0; i < variants.length; i += 1) {
    const variant = variants[i]
    const type = String(variant?.type || '')
    const question = normalizeText(String(variant?.question || ''))
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1)
    errors.push(...validateVariant(baseFact, variant, i))
    if (question) {
      if (question === baseQuestion) {
        errors.push(`variant[${i}] repeats base question`)
      }
      if (seenQuestions.has(question)) {
        errors.push(`variant[${i}] duplicates another variant question`)
      }
      seenQuestions.add(question)
    }
  }

  if ((typeCounts.get('forward') || 0) === 0) {
    errors.push('missing forward variant')
  }
  if ((typeCounts.get('reverse') || 0) === 0) {
    errors.push('missing reverse variant')
  }
  if ((typeCounts.get('fill_blank') || 0) === 0) {
    errors.push('missing fill_blank variant')
  }

  return [...new Set(errors)]
}

function coerceResults(parsed) {
  if (Array.isArray(parsed)) return parsed
  if (Array.isArray(parsed?.results)) return parsed.results
  return []
}

async function generateBatch(batchFacts, model, timeoutMs) {
  const prompt = buildBatchPrompt(batchFacts)
  const rawOutput = await runSubscriptionWorker(prompt, model, timeoutMs)
  const parsed = extractJsonPayload(rawOutput)
  const rows = coerceResults(parsed)
  const byId = new Map()

  for (const row of rows) {
    const id = String(row?.id || '').trim()
    if (!id) continue
    byId.set(id, row?.variants)
  }

  const valid = new Map()
  const invalid = []

  for (const fact of batchFacts) {
    const variants = byId.get(fact.id)
    const errors = validateFactVariants(fact, variants)
    if (errors.length === 0) {
      valid.set(fact.id, variants)
    } else {
      invalid.push({
        id: fact.id,
        model,
        errors,
        rawOutputPreview: truncate(rawOutput, 600),
      })
    }
  }

  return { valid, invalid, rawOutput }
}

async function generateWithFallback(batchFacts, options) {
  const primary = await generateBatch(batchFacts, options.model, options.timeoutMs)
  const accepted = new Map(primary.valid)
  let invalidFacts = batchFacts.filter((fact) => !accepted.has(fact.id))
  const failures = [...primary.invalid]

  if (invalidFacts.length > 0 && batchFacts.length > 1) {
    for (const fact of invalidFacts) {
      // eslint-disable-next-line no-await-in-loop
      const retried = await generateBatch([fact], options.model, options.timeoutMs)
      if (retried.valid.has(fact.id)) {
        accepted.set(fact.id, retried.valid.get(fact.id))
      } else {
        failures.push(...retried.invalid)
      }
    }
    invalidFacts = batchFacts.filter((fact) => !accepted.has(fact.id))
  }

  if (invalidFacts.length > 0 && options.fallbackModel && options.fallbackModel !== options.model) {
    for (const fact of invalidFacts) {
      // eslint-disable-next-line no-await-in-loop
      const fallback = await generateBatch([fact], options.fallbackModel, options.timeoutMs)
      if (fallback.valid.has(fact.id)) {
        accepted.set(fact.id, fallback.valid.get(fact.id))
      } else {
        failures.push(...fallback.invalid)
      }
    }
  }

  const uniqueFailures = []
  const failureKeyed = new Set()
  for (const failure of failures) {
    const key = `${failure.id}:${failure.model}:${failure.errors.join('|')}`
    if (failureKeyed.has(key)) continue
    failureKeyed.add(key)
    uniqueFailures.push(failure)
  }

  return {
    accepted,
    failures: uniqueFailures.filter((failure) => !accepted.has(failure.id)),
  }
}

function chunk(items, size) {
  const chunks = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function selectStratified(items, limit) {
  if (!limit || limit >= items.length) return [...items]

  const groups = new Map()
  for (const item of items) {
    const key = factDomain(item)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }

  const orderedGroups = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const selected = []
  let added = true

  while (selected.length < limit && added) {
    added = false
    for (const [, group] of orderedGroups) {
      if (selected.length >= limit) break
      if (group.length === 0) continue
      selected.push(group.shift())
      added = true
    }
  }

  return selected
}

async function loadFacts(inputPath) {
  const raw = JSON.parse(await fs.readFile(inputPath, 'utf8'))
  if (!Array.isArray(raw)) throw new Error(`Expected array in ${inputPath}`)
  return raw
}

async function syncWorkerOutputVariants(workerOutputDir, updatedById) {
  let changedFiles = 0
  let changedFacts = 0
  let fileNames = []

  try {
    fileNames = (await fs.readdir(workerOutputDir))
      .filter((name) => name.endsWith('.jsonl'))
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return { changedFiles, changedFacts }
  }

  for (const name of fileNames) {
    const filePath = path.join(workerOutputDir, name)
    const text = await fs.readFile(filePath, 'utf8')
    const lines = text.split(/\r?\n/)
    let fileChanged = false

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i].trim()
      if (!line) continue
      let row = null
      try {
        row = JSON.parse(line)
      } catch {
        continue
      }

      if (!updatedById.has(row.id)) continue
      row.variants = updatedById.get(row.id)
      lines[i] = JSON.stringify(row)
      fileChanged = true
      changedFacts += 1
    }

    if (fileChanged) {
      await fs.writeFile(filePath, `${lines.filter((line) => line.trim().length > 0).join('\n')}\n`, 'utf8')
      changedFiles += 1
    }
  }

  return { changedFiles, changedFacts }
}

async function rebuildDb() {
  await execFileAsync(process.execPath, [path.join(root, 'scripts/build-facts-db.mjs')], {
    cwd: root,
    env: process.env,
    maxBuffer: 1024 * 1024 * 20,
  })
}

async function main() {
  const { values } = parseArgs({
    options: {
      input: { type: 'string', default: 'src/data/seed/facts-generated.json' },
      report: { type: 'string', default: 'data/generated/qa-reports/knowledge-variants-report.json' },
      model: { type: 'string', default: 'gpt-5.4' },
      'fallback-model': { type: 'string', default: 'gpt-5.2' },
      limit: { type: 'string', default: '50' },
      'batch-size': { type: 'string', default: '8' },
      concurrency: { type: 'string', default: '4' },
      timeout: { type: 'string', default: '240000' },
      selection: { type: 'string', default: 'stratified' },
      overwrite: { type: 'string', default: 'false' },
      'sync-worker-output': { type: 'string', default: 'true' },
      'worker-output-dir': { type: 'string', default: 'data/generated/worker-output' },
      'rebuild-db': { type: 'string', default: 'false' },
    },
  })

  const inputPath = path.resolve(root, String(values.input))
  const reportPath = path.resolve(root, String(values.report))
  const workerOutputDir = path.resolve(root, String(values['worker-output-dir']))
  const limit = Math.max(0, Number.parseInt(String(values.limit || '0'), 10) || 0)
  const batchSize = parsePositiveInt(values['batch-size'], 8)
  const concurrency = parsePositiveInt(values.concurrency, 4)
  const timeoutMs = parsePositiveInt(values.timeout, 240000)
  const overwrite = parseBoolean(values.overwrite, false)
  const syncWorkerOutput = parseBoolean(values['sync-worker-output'], true)
  const shouldRebuildDb = parseBoolean(values['rebuild-db'], false)

  const facts = await loadFacts(inputPath)
  const candidates = facts.filter((fact) => isKnowledgeFact(fact) && needsVariants(fact, overwrite))
  const selected = values.selection === 'sequential'
    ? (limit > 0 ? candidates.slice(0, limit) : [...candidates])
    : selectStratified(candidates, limit)

  const batches = chunk(selected, batchSize)
  const updatedById = new Map()
  const failures = []
  const startedAt = new Date().toISOString()

  let batchIndex = 0
  async function worker() {
    while (batchIndex < batches.length) {
      const currentIndex = batchIndex
      batchIndex += 1
      const batch = batches[currentIndex]
      // eslint-disable-next-line no-await-in-loop
      const generated = await generateWithFallback(batch, {
        model: String(values.model),
        fallbackModel: String(values['fallback-model']),
        timeoutMs,
      })

      for (const [id, variants] of generated.accepted.entries()) {
        updatedById.set(id, variants)
      }
      failures.push(...generated.failures)
      console.log(`[variants] batch ${currentIndex + 1}/${batches.length}: accepted=${generated.accepted.size}/${batch.length} failed=${generated.failures.length}`)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, batches.length)) }, () => worker()))

  let updatedFacts = 0
  for (const fact of facts) {
    if (!updatedById.has(fact.id)) continue
    fact.variants = updatedById.get(fact.id)
    updatedFacts += 1
  }

  await fs.writeFile(inputPath, `${JSON.stringify(facts, null, 2)}\n`, 'utf8')

  let workerOutputSummary = { changedFiles: 0, changedFacts: 0 }
  if (syncWorkerOutput && updatedById.size > 0) {
    workerOutputSummary = await syncWorkerOutputVariants(workerOutputDir, updatedById)
  }

  if (shouldRebuildDb && updatedById.size > 0) {
    await rebuildDb()
  }

  const uniqueFailureIds = [...new Set(failures.map((failure) => failure.id).filter(Boolean))]

  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    inputPath,
    reportPath,
    model: String(values.model),
    fallbackModel: String(values['fallback-model']),
    totalFacts: facts.length,
    candidateFacts: candidates.length,
    selectedFacts: selected.length,
    updatedFacts,
    failedFacts: uniqueFailureIds.length,
    failureAttempts: failures.length,
    batchCount: batches.length,
    batchSize,
    concurrency,
    syncWorkerOutput,
    workerOutputSummary,
    rebuiltDb: shouldRebuildDb && updatedById.size > 0,
    samples: selected.slice(0, 8).map((fact) => ({
      id: fact.id,
      domain: factDomain(fact),
      updated: updatedById.has(fact.id),
    })),
    failures,
  }

  await ensureParentDir(reportPath)
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  console.log(JSON.stringify({
    selectedFacts: selected.length,
    updatedFacts,
    failedFacts: uniqueFailureIds.length,
    failureAttempts: failures.length,
    batchCount: batches.length,
    model: String(values.model),
    fallbackModel: String(values['fallback-model']),
    workerOutputSummary,
    rebuiltDb: shouldRebuildDb && updatedById.size > 0,
    reportPath,
  }, null, 2))
}

main().catch((error) => {
  console.error('[generate-knowledge-variants] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
