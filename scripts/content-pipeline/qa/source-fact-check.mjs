#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, readJson, writeJson, loadJsonl, listJsonlFiles, normalizeText } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

const STOPWORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'from', 'what', 'which', 'where', 'when', 'into', 'over',
  'under', 'about', 'is', 'are', 'was', 'were', 'it', 'its', 'for', 'than', 'then', 'their', 'there',
  'have', 'has', 'had', 'can', 'could', 'would', 'should', 'not', 'true', 'false', 'who', 'why',
])

function splitTokens(value) {
  return normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token))
}

function extractSignalTokens(fact) {
  const answerTokens = splitTokens(fact?.correctAnswer || '')
  const questionTokens = splitTokens(fact?.quizQuestion || '')
  const statementTokens = splitTokens(fact?.statement || '')

  const ranked = [...answerTokens, ...questionTokens, ...statementTokens]
  const unique = []
  const seen = new Set()
  for (const token of ranked) {
    if (seen.has(token)) continue
    seen.add(token)
    unique.push(token)
    if (unique.length >= 12) break
  }

  return unique
}

function scoreEvidence(tokens, sourceText) {
  if (tokens.length === 0) return { score: 0, matched: [] }
  const matched = tokens.filter((token) => sourceText.includes(token))
  return {
    score: matched.length / tokens.length,
    matched,
  }
}

function stripHtml(html) {
  return normalizeText(
    String(html || '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'recall-rogue-source-check/1.0',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const contentType = String(response.headers.get('content-type') || '')
    if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/json')) {
      throw new Error(`unsupported_content_type:${contentType || 'unknown'}`)
    }

    const text = await response.text()
    return stripHtml(text)
  } finally {
    clearTimeout(timeout)
  }
}

async function loadFacts(inputPath) {
  if (inputPath.endsWith('.jsonl')) {
    return loadJsonl(inputPath)
  }

  if (inputPath.endsWith('.json')) {
    const payload = await readJson(inputPath)
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.facts)) return payload.facts
    return []
  }

  const files = await listJsonlFiles(inputPath)
  const all = []
  for (const file of files) {
    const rows = await loadJsonl(file)
    all.push(...rows)
  }
  return all
}

async function main() {
  const args = parseArgs(process.argv, {
    input: 'data/generated',
    output: 'data/generated/qa-reports/source-fact-check.json',
    sample: 0,
    'max-fetch': 250,
    'timeout-ms': 8000,
    'min-score': 0.35,
    strict: false,
  })

  const inputPath = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output))
  const sample = Math.max(0, Number(args.sample) || 0)
  const maxFetch = Math.max(1, Number(args['max-fetch']) || 250)
  const timeoutMs = Math.max(1000, Number(args['timeout-ms']) || 8000)
  const minScore = Math.max(0, Math.min(1, Number(args['min-score']) || 0.35))
  const strict = Boolean(args.strict)

  const allFacts = await loadFacts(inputPath)
  const facts = sample > 0 ? allFacts.slice(0, sample) : allFacts

  const urlCache = new Map()
  const items = []

  for (const fact of facts) {
    const factId = String(fact?.id || '')
    const sourceName = String(fact?.sourceName || '').trim()
    const sourceUrl = String(fact?.sourceUrl || '').trim()

    if (!sourceName) {
      items.push({
        id: factId,
        status: 'missing_source_name',
        sourceUrl,
      })
      continue
    }

    if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
      items.push({
        id: factId,
        status: 'missing_source_url',
        sourceName,
      })
      continue
    }

    if (!urlCache.has(sourceUrl) && urlCache.size < maxFetch) {
      try {
        const text = await fetchWithTimeout(sourceUrl, timeoutMs)
        urlCache.set(sourceUrl, { ok: true, text })
      } catch (error) {
        urlCache.set(sourceUrl, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          text: '',
        })
      }
    }

    const cache = urlCache.get(sourceUrl)
    if (!cache?.ok) {
      items.push({
        id: factId,
        status: 'source_fetch_failed',
        sourceName,
        sourceUrl,
        reason: cache?.error || 'fetch_limit_reached',
      })
      continue
    }

    const tokens = extractSignalTokens(fact)
    const evidence = scoreEvidence(tokens, cache.text)
    const status = evidence.score >= minScore ? 'cross_reference_match' : 'low_evidence_match'

    items.push({
      id: factId,
      status,
      sourceName,
      sourceUrl,
      tokenCount: tokens.length,
      matchedTokens: evidence.matched,
      matchScore: Number(evidence.score.toFixed(4)),
    })
  }

  const summary = {
    totalFacts: items.length,
    matched: items.filter((item) => item.status === 'cross_reference_match').length,
    lowEvidence: items.filter((item) => item.status === 'low_evidence_match').length,
    missingSourceName: items.filter((item) => item.status === 'missing_source_name').length,
    missingSourceUrl: items.filter((item) => item.status === 'missing_source_url').length,
    fetchFailed: items.filter((item) => item.status === 'source_fetch_failed').length,
    fetchedUrls: urlCache.size,
  }

  const report = {
    generatedAt: new Date().toISOString(),
    inputPath,
    sampleSize: sample || null,
    maxFetch,
    timeoutMs,
    minScore,
    summary,
    items,
  }

  await writeJson(outputPath, report)
  console.log(JSON.stringify({ ok: true, outputPath, summary }, null, 2))

  if (strict && (summary.lowEvidence > 0 || summary.fetchFailed > 0 || summary.missingSourceName > 0 || summary.missingSourceUrl > 0)) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('[source-fact-check] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
