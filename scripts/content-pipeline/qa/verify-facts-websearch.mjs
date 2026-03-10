#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, readJson, writeJson, normalizeText } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

const WIKI_API = 'https://en.wikipedia.org/w/api.php'
const USER_AGENT = 'recall-rogue-verify/1.0 (educational game fact checker)'

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
  const normalizedSource = normalizeText(sourceText)
  const matched = tokens.filter((token) => normalizedSource.includes(token))
  return {
    score: matched.length / tokens.length,
    matched,
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const RATE_LIMIT_ERROR = Symbol('RATE_LIMIT_ERROR')

async function fetchWithBackoff(url, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: { 'user-agent': USER_AGENT },
    })
    if (response.status === 429) {
      if (attempt < maxRetries) {
        const backoffMs = 1000 * Math.pow(2, attempt) // 1s, 2s, 4s
        console.warn(`[verify-facts-websearch] HTTP 429 rate limited, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`)
        await delay(backoffMs)
        continue
      }
      // All retries exhausted
      const err = new Error(`Wikipedia HTTP 429 after ${maxRetries} retries`)
      err[RATE_LIMIT_ERROR] = true
      throw err
    }
    if (!response.ok) {
      throw new Error(`Wikipedia HTTP ${response.status}`)
    }
    return response
  }
}

async function wikiSearch(query) {
  const url = `${WIKI_API}?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=3`
  const response = await fetchWithBackoff(url)
  const data = await response.json()
  return data?.query?.search || []
}

async function wikiExtract(title) {
  const url = `${WIKI_API}?action=query&prop=extracts&exintro=true&explaintext=true&titles=${encodeURIComponent(title)}&format=json`
  const response = await fetchWithBackoff(url)
  const data = await response.json()
  const pages = data?.query?.pages || {}
  const page = Object.values(pages)[0]
  return page?.extract || ''
}

async function loadFacts(inputPath) {
  const payload = await readJson(inputPath)
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.facts)) return payload.facts
  return []
}

async function main() {
  const args = parseArgs(process.argv, {
    input: 'src/data/seed/facts-generated.json',
    output: 'data/generated/qa-reports/verification-report.json',
    sample: 0,
    'delay-ms': 500,
    'batch-size': 100,
    stamp: false,
    quarantine: false,
  })

  const inputPath = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output))
  const sample = Math.max(0, Number(args.sample) || 0)
  const delayMs = Math.max(0, Number(args['delay-ms']) || 500)
  const batchSize = Math.max(1, Number(args['batch-size']) || 100)
  const stamp = Boolean(args.stamp)
  const quarantine = Boolean(args.quarantine)

  const allFacts = await loadFacts(inputPath)
  const facts = sample > 0 ? allFacts.slice(0, sample) : allFacts

  console.log(`[verify-facts-websearch] loaded ${allFacts.length} facts, processing ${facts.length} (batch-size=${batchSize}, delay=${delayMs}ms)`)

  const items = []
  let alreadyVerified = 0
  let highConfidence = 0
  let mediumConfidence = 0
  let lowConfidence = 0
  let rateLimited = 0
  let batchCount = 0

  for (let i = 0; i < facts.length; i++) {
    const fact = facts[i]
    const factId = String(fact?.id || `unknown-${i}`)

    // Skip already-verified facts
    if (fact?.verifiedAt) {
      alreadyVerified++
      continue
    }

    // Batch pause: after every batchSize processed facts, pause to avoid rate limits
    batchCount++
    if (batchCount > 0 && batchCount % batchSize === 0) {
      console.log(`[verify-facts-websearch] batch pause after ${batchCount} facts (5s cooldown)...`)
      await delay(5000)
    }

    // Capture sourceUrl as supplementary provenance (but always verify via Wikipedia)
    const sourceUrl = String(fact?.sourceUrl || '').trim()
    const hasSourceUrl = sourceUrl && /^https?:\/\//i.test(sourceUrl)

    // Extract tokens and search Wikipedia
    const tokens = extractSignalTokens(fact)
    if (tokens.length === 0) {
      lowConfidence++
      items.push({
        id: factId,
        confidence: 'low',
        matchScore: 0,
        matchedTokens: [],
        wikiArticle: null,
        reason: 'no_signal_tokens',
        ...(hasSourceUrl ? { sourceUrl } : {}),
      })
      continue
    }

    const searchQuery = tokens.slice(0, 8).join(' ')
    let combinedExtracts = ''
    let bestArticle = null
    let wasRateLimited = false

    try {
      const searchResults = await wikiSearch(searchQuery)

      for (const result of searchResults) {
        try {
          const extract = await wikiExtract(result.title)
          if (extract) {
            combinedExtracts += ' ' + extract
            if (!bestArticle) bestArticle = result.title
          }
          if (delayMs > 0) await delay(delayMs)
        } catch (extractError) {
          if (extractError && extractError[RATE_LIMIT_ERROR]) {
            wasRateLimited = true
            break
          }
          console.error(`[verify-facts-websearch] extract error for "${result.title}":`, extractError instanceof Error ? extractError.message : extractError)
        }
      }

      if (delayMs > 0 && !wasRateLimited) await delay(delayMs)
    } catch (searchError) {
      if (searchError && searchError[RATE_LIMIT_ERROR]) {
        wasRateLimited = true
      } else {
        console.error(`[verify-facts-websearch] search error for fact "${factId}":`, searchError instanceof Error ? searchError.message : searchError)
        items.push({
          id: factId,
          confidence: 'low',
          matchScore: 0,
          matchedTokens: [],
          wikiArticle: null,
          reason: 'search_failed',
          ...(hasSourceUrl ? { sourceUrl } : {}),
        })
        lowConfidence++
        continue
      }
    }

    if (wasRateLimited) {
      rateLimited++
      items.push({
        id: factId,
        confidence: 'skipped',
        matchScore: 0,
        matchedTokens: [],
        wikiArticle: null,
        reason: 'rate_limited',
        ...(hasSourceUrl ? { sourceUrl } : {}),
      })
      continue
    }

    const evidence = scoreEvidence(tokens, combinedExtracts)
    let confidence
    if (evidence.score >= 0.5) {
      confidence = 'high'
      highConfidence++
    } else if (evidence.score >= 0.25) {
      confidence = 'medium'
      mediumConfidence++
    } else {
      confidence = 'low'
      lowConfidence++
    }

    items.push({
      id: factId,
      confidence,
      matchScore: Number(evidence.score.toFixed(4)),
      matchedTokens: evidence.matched,
      wikiArticle: bestArticle,
      ...(hasSourceUrl ? { sourceUrl } : {}),
    })

    if ((i + 1) % 25 === 0) {
      console.log(`[verify-facts-websearch] progress: ${i + 1}/${facts.length}`)
    }
  }

  const summary = {
    total: facts.length,
    alreadyVerified,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    rateLimited,
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary,
    items,
  }

  await writeJson(outputPath, report)
  console.log(JSON.stringify({ ok: true, outputPath, summary }, null, 2))

  // Stamp high-confidence facts with verifiedAt
  if (stamp) {
    const seedData = await readJson(inputPath)
    const seedFacts = Array.isArray(seedData) ? seedData : (seedData?.facts || [])
    const highIds = new Set(items.filter((item) => item.confidence === 'high').map((item) => item.id))

    let stamped = 0
    for (const fact of seedFacts) {
      if (fact?.id && highIds.has(fact.id) && !fact.verifiedAt) {
        fact.verifiedAt = new Date().toISOString()
        stamped++
      }
    }

    if (stamped > 0) {
      await writeJson(inputPath, Array.isArray(seedData) ? seedFacts : { ...seedData, facts: seedFacts })
      console.log(`[verify-facts-websearch] stamped ${stamped} facts with verifiedAt`)
    }
  }

  // Quarantine low-confidence facts
  if (quarantine) {
    const seedData = await readJson(inputPath)
    const seedFacts = Array.isArray(seedData) ? seedData : (seedData?.facts || [])
    const lowIds = new Set(items.filter((item) => item.confidence === 'low').map((item) => item.id))

    let quarantined = 0
    for (const fact of seedFacts) {
      if (fact?.id && lowIds.has(fact.id)) {
        fact.status = 'quarantined'
        quarantined++
      }
    }

    if (quarantined > 0) {
      await writeJson(inputPath, Array.isArray(seedData) ? seedFacts : { ...seedData, facts: seedFacts })
      console.log(`[verify-facts-websearch] quarantined ${quarantined} low-confidence facts`)
    }
  }
}

main().catch((error) => {
  console.error('[verify-facts-websearch] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
