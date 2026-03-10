/**
 * convert-to-webp.mjs
 *
 * Converts all PNG files in public/assets/ and public/cutscene/ to lossless WebP
 * using sharp. Places .webp files alongside the originals (same directory, same name).
 *
 * Skips miner_sheet.png spritesheets — Phaser needs exact pixel dimensions for
 * frame extraction and WebP re-encoding could shift pixels.
 *
 * Usage: node scripts/convert-to-webp.mjs
 */
import { readdir, rename, rm, stat } from 'node:fs/promises'
import { join, parse } from 'node:path'
import { existsSync } from 'node:fs'
import sharp from 'sharp'

/** Filenames to skip (spritesheets that must stay pixel-exact PNG). */
const SKIP_FILENAMES = new Set([
  'miner_sheet.png',
])

function parseBoolean(value, fallback) {
  if (value == null) return fallback
  const normalized = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function parseCli(argv) {
  const options = {
    force: false,
    strict: true,
  }

  for (const token of argv.slice(2)) {
    if (token === '--force') options.force = true
    else if (token === '--no-force') options.force = false
    else if (token.startsWith('--force=')) options.force = parseBoolean(token.split('=').slice(1).join('='), options.force)
    else if (token === '--strict') options.strict = true
    else if (token === '--no-strict') options.strict = false
    else if (token.startsWith('--strict=')) options.strict = parseBoolean(token.split('=').slice(1).join('='), options.strict)
    else if (token === '--help' || token === '-h') {
      console.log([
        'Usage: node scripts/convert-to-webp.mjs [options]',
        '',
        'Options:',
        '  --force            Reconvert all PNG files even when .webp is up to date.',
        '  --strict           Exit non-zero if any conversion fails (default: true).',
        '  --no-strict        Continue on conversion failures and exit zero.',
      ].join('\n'))
      process.exit(0)
    }
  }

  return options
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`
  return `${(bytes / 1024).toFixed(1)}KB`
}

/**
 * Recursively find all .png files under a directory.
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function findPngs(dir) {
  const results = []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return results
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...await findPngs(full))
    } else if (entry.name.endsWith('.png')) {
      results.push(full)
    }
  }
  return results
}

async function main() {
  const options = parseCli(process.argv)
  const dirs = ['public/assets', 'public/cutscene']
  let totalPngs = 0
  let converted = 0
  let skippedSpritesheet = 0
  let skippedUpToDate = 0
  let failed = 0
  let totalPngBytes = 0
  let totalWebpBytes = 0

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      console.log(`  [skip] ${dir} does not exist`)
      continue
    }

    const pngs = await findPngs(dir)
    totalPngs += pngs.length

    for (const pngPath of pngs) {
      const { name, base, dir: fileDir } = parse(pngPath)

      // Skip spritesheets
      if (SKIP_FILENAMES.has(base)) {
        console.log(`  [skip] ${pngPath} (spritesheet)`)
        skippedSpritesheet++
        continue
      }

      const webpPath = join(fileDir, `${name}.webp`)
      const tempWebpPath = `${webpPath}.tmp`
      const pngStat = await stat(pngPath)
      const pngSize = pngStat.size

      if (!options.force && existsSync(webpPath)) {
        const existingWebpStat = await stat(webpPath)
        if (existingWebpStat.size > 0 && existingWebpStat.mtimeMs >= pngStat.mtimeMs) {
          totalPngBytes += pngSize
          totalWebpBytes += existingWebpStat.size
          skippedUpToDate++
          continue
        }
      }

      try {
        await sharp(pngPath)
          .webp({ lossless: true })
          .toFile(tempWebpPath)

        const [pngMeta, webpMeta] = await Promise.all([
          sharp(pngPath).metadata(),
          sharp(tempWebpPath).metadata(),
        ])

        if (
          pngMeta.width !== webpMeta.width
          || pngMeta.height !== webpMeta.height
        ) {
          throw new Error(
            `dimension mismatch (${pngMeta.width}x${pngMeta.height} -> ${webpMeta.width}x${webpMeta.height})`,
          )
        }

        await rename(tempWebpPath, webpPath)

        const webpStat = await stat(webpPath)
        const webpSize = webpStat.size
        if (webpSize <= 0) {
          throw new Error('webp output is empty')
        }

        const savings = pngSize - webpSize
        const pct = pngSize > 0 ? ((savings / pngSize) * 100).toFixed(1) : '0.0'

        totalPngBytes += pngSize
        totalWebpBytes += webpSize
        converted++

        console.log(`  ${pngPath} -> ${formatSize(pngSize)} -> ${formatSize(webpSize)} (${pct}% saved)`)
      } catch (err) {
        failed++
        await rm(tempWebpPath, { force: true }).catch(() => {})
        console.error(`  [error] ${pngPath}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  console.log('')
  console.log('=== WebP Conversion Summary ===')
  console.log(`  Total PNGs found:    ${totalPngs}`)
  console.log(`  Converted:           ${converted}`)
  console.log(`  Up-to-date skipped:  ${skippedUpToDate}`)
  console.log(`  Spritesheet skipped: ${skippedSpritesheet}`)
  console.log(`  Failed:              ${failed}`)
  console.log(`  Total PNG size:      ${formatSize(totalPngBytes)}`)
  console.log(`  Total WebP size:     ${formatSize(totalWebpBytes)}`)
  const totalSaved = totalPngBytes - totalWebpBytes
  const totalPct = totalPngBytes > 0 ? (Math.abs(totalSaved) / totalPngBytes) * 100 : 0
  const sign = totalSaved < 0 ? '-' : ''
  console.log(`  Total saved:         ${formatSize(Math.abs(totalSaved))} (${sign}${totalPct.toFixed(1)}%)`)

  if (failed > 0 && options.strict) {
    console.error(`\nWebP conversion failed for ${failed} file(s) in strict mode.`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
