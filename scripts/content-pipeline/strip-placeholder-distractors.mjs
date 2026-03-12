#!/usr/bin/env node
/**
 * strip-placeholder-distractors.mjs
 *
 * Removes placeholder/garbage distractors from the seed file.
 * Run this ONCE to clean existing data, then rely on build-time validation
 * to prevent reintroduction.
 *
 * Usage: node scripts/content-pipeline/strip-placeholder-distractors.mjs [--dry-run]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isPlaceholderDistractor } from './qa/shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '../..')
const SEED_FILE = path.join(ROOT, 'src', 'data', 'seed', 'facts-generated.json')

const dryRun = process.argv.includes('--dry-run')

console.log(`[strip-placeholders] Reading ${path.relative(ROOT, SEED_FILE)}...`)
const raw = fs.readFileSync(SEED_FILE, 'utf8')
const facts = JSON.parse(raw)

let factsModified = 0
let distractorsRemoved = 0
let variantDistractorsRemoved = 0

for (const fact of facts) {
  let modified = false

  // Clean top-level distractors
  if (Array.isArray(fact.distractors)) {
    const before = fact.distractors.length
    const cleaned = fact.distractors.filter(d => {
      const text = typeof d === 'string' ? d : String(d?.text ?? d ?? '')
      return text && !isPlaceholderDistractor(text)
    })
    if (cleaned.length < before) {
      distractorsRemoved += before - cleaned.length
      fact.distractors = cleaned
      modified = true
    }
  }

  // Clean variant distractors
  if (Array.isArray(fact.variants)) {
    for (const variant of fact.variants) {
      if (!Array.isArray(variant.distractors)) continue
      const before = variant.distractors.length
      const cleaned = variant.distractors.filter(d => {
        const text = typeof d === 'string' ? d : String(d?.text ?? d ?? '')
        return text && !isPlaceholderDistractor(text)
      })
      if (cleaned.length < before) {
        variantDistractorsRemoved += before - cleaned.length
        variant.distractors = cleaned
        modified = true
      }
    }
  }

  if (modified) factsModified++
}

console.log(`\n=== Cleanup Summary ===`)
console.log(`Total facts:                 ${facts.length}`)
console.log(`Facts modified:              ${factsModified}`)
console.log(`Distractors removed:         ${distractorsRemoved}`)
console.log(`Variant distractors removed: ${variantDistractorsRemoved}`)

if (dryRun) {
  console.log(`\n[DRY RUN] No changes written.`)
} else {
  console.log(`\nWriting cleaned data...`)
  fs.writeFileSync(SEED_FILE, JSON.stringify(facts, null, 2) + '\n', 'utf8')
  console.log(`[OK] ${path.relative(ROOT, SEED_FILE)} updated.`)
}
