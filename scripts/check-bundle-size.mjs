#!/usr/bin/env node
/**
 * Post-build bundle size checker.
 *
 * Reads the dist/ directory, sums JS chunk sizes (gzip-estimated via stat),
 * and fails with exit code 1 if any individual chunk exceeds the threshold
 * or if the total initial JS bundle exceeds the total budget.
 *
 * Run: node scripts/check-bundle-size.mjs
 * Called automatically by: npm run build:check
 */

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const DIST = path.resolve(process.cwd(), 'dist/assets')
const CHUNK_MAX_KB = 500
const INITIAL_BUNDLE_MAX_KB = 400 // gzipped estimate

const files = fs.readdirSync(DIST).filter(f => f.endsWith('.js'))
let totalGzip = 0
let failed = false

for (const file of files) {
  const raw = fs.readFileSync(path.join(DIST, file))
  const gzipped = zlib.gzipSync(raw)
  const kb = Math.round(gzipped.length / 1024)
  const rawKb = Math.round(raw.length / 1024)
  const isInitial = !file.includes('phaser') && !file.includes('sql-wasm')
  if (isInitial) totalGzip += gzipped.length
  const overLimit = rawKb > CHUNK_MAX_KB
  const marker = overLimit ? ' [OVER LIMIT]' : ''
  console.log(`  ${file}: ${rawKb} KB raw, ${kb} KB gzip${marker}`)
  if (overLimit) failed = true
}

const totalKb = Math.round(totalGzip / 1024)
console.log(`\nInitial bundle (gzip estimate): ${totalKb} KB (limit: ${INITIAL_BUNDLE_MAX_KB} KB)`)
if (totalKb > INITIAL_BUNDLE_MAX_KB) {
  console.error('FAILED: Initial bundle exceeds budget')
  failed = true
}

if (failed) process.exit(1)
console.log('Bundle size check passed.')
