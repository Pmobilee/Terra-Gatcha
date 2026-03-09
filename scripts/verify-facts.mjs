#!/usr/bin/env node
/**
 * Mark fact records as verified by setting verifiedAt ISO timestamps.
 *
 * Usage:
 *   node scripts/verify-facts.mjs --file src/data/seed/facts-general.json --ids geo-001,geo-002
 *   node scripts/verify-facts.mjs --file src/data/seed/facts-general.json --all
 */

import fs from 'node:fs'
import path from 'node:path'

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      args[key] = next
      i += 1
    } else {
      args[key] = true
    }
  }
  return args
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const fileArg = args.file
  if (!fileArg || typeof fileArg !== 'string') {
    console.error('Usage: node scripts/verify-facts.mjs --file <seed.json> [--all | --ids id1,id2]')
    process.exit(1)
  }

  const filePath = path.resolve(process.cwd(), fileArg)
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  if (!Array.isArray(payload)) {
    console.error('Target file must contain a top-level JSON array.')
    process.exit(1)
  }

  const markAll = Boolean(args.all)
  const idSet = new Set(
    String(args.ids ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  )

  if (!markAll && idSet.size === 0) {
    console.error('Provide either --all or --ids id1,id2')
    process.exit(1)
  }

  const now = new Date().toISOString()
  let updated = 0
  const next = payload.map((fact) => {
    const shouldMark = markAll || idSet.has(String(fact.id))
    if (!shouldMark) return fact
    updated += 1
    return {
      ...fact,
      verifiedAt: now,
    }
  })

  fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`)
  console.log(`Verified ${updated} fact(s) in ${filePath}`)
}

main()
