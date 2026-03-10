#!/usr/bin/env node
/**
 * Camp art pipeline (AR-30):
 * - prepare: emits worker prompt/task bundles for camp sprite generation
 * - ingest: normalizes worker outputs into /public/assets/camp
 * - manifest: rebuilds /public/assets/camp/manifest.json
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')

const generatedRoot = path.join(root, 'data', 'generated', 'camp-art')
const workerPackageDir = path.join(generatedRoot, 'worker-packages')
const workerPromptsDir = path.join(workerPackageDir, 'prompts')
const workerTasksDir = path.join(workerPackageDir, 'tasks')
const defaultWorkerOutputDir = path.join(generatedRoot, 'worker-output')
const defaultManifestPath = path.join(workerPackageDir, 'manifest.json')

const campAssetRoot = path.join(root, 'public', 'assets', 'camp')
const campManifestPath = path.join(campAssetRoot, 'manifest.json')

const ELEMENT_TIER_THEMES = {
  tent: [
    'worn bedroll and simple travel tarp',
    'small canvas expedition tent with rope ties',
    'reinforced leather tent with supply satchels',
    'decorated pavilion tent with lantern accents',
  ],
  seating: [
    'rough log seat beside the fire',
    'sturdy wooden bench with carved legs',
    'cushioned adventurer bench with blankets',
    'ornate carved throne bench with rune motifs',
  ],
  campfire: [
    'small ember fire with sparse stones',
    'ringed stone fire pit with brighter flame',
    'iron brazier with steady orange fire',
    'arcane brazier with magical blue-violet flame',
  ],
  decor: [
    'weathered signpost and supply crate',
    'improved signpost with map board and banner strip',
    'decorative banner stand and stacked books',
    'heroic trophy post with banners, books, and relic trinkets',
  ],
}

const ELEMENT_LAYOUT_HINTS = {
  tent: 'left side of camp scene near the archive crate',
  seating: 'right side of camp scene near the workshop area',
  campfire: 'center foreground as main focal camp object',
  decor: 'right edge near settings signpost and trophy area',
}

const OUTFIT_THEMES = {
  scout: 'light traveler armor with practical cloth layers',
  warden: 'heavy guardian armor with shield-bearing silhouette',
  scholar: 'learned explorer robes with satchel and scroll motifs',
  vanguard: 'battle-ready frontliner armor with bold plating',
}

const PET_THEMES = {
  cat: 'camp cat companion with alert stance',
  owl: 'wise owl companion perched and watchful',
  fox: 'curious fox companion with curled tail',
  dragon_whelp: 'small dragon whelp companion, friendly not threatening',
}

const ELEMENT_ORDER = ['tent', 'seating', 'campfire', 'decor']
const OUTFIT_ORDER = ['scout', 'warden', 'scholar', 'vanguard']
const PET_ORDER = ['cat', 'owl', 'fox', 'dragon_whelp']
const IMAGE_EXTENSIONS = ['png', 'webp', 'jpg', 'jpeg']

function parseArgs(rawArgs) {
  const command = rawArgs[0] || 'help'
  const flags = rawArgs.slice(1)
  const getArg = (name, fallback = null) => {
    const index = flags.indexOf(`--${name}`)
    if (index === -1) return fallback
    return flags[index + 1] ?? fallback
  }
  const hasFlag = (name) => flags.includes(`--${name}`)
  return { command, getArg, hasFlag }
}

function toRelative(absolutePath) {
  return path.relative(root, absolutePath).replaceAll('\\', '/')
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath))
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf-8'))
}

function resolvePath(candidate, fallback) {
  if (!candidate) return fallback
  return path.isAbsolute(candidate) ? candidate : path.resolve(root, candidate)
}

function buildTaskRecords() {
  const tasks = []

  for (const element of ELEMENT_ORDER) {
    const tiers = ELEMENT_TIER_THEMES[element]
    for (let index = 0; index < tiers.length; index += 1) {
      const tier = index + 1
      const id = `camp-${element}-tier-${tier}`
      tasks.push({
        id,
        kind: 'element',
        element,
        tier,
        theme: tiers[index],
        locationHint: ELEMENT_LAYOUT_HINTS[element],
        width: 256,
        height: 256,
        assetPath: `elements/${element}-tier-${tier}`,
      })
    }
  }

  for (const outfit of OUTFIT_ORDER) {
    tasks.push({
      id: `camp-outfit-${outfit}`,
      kind: 'outfit',
      outfit,
      theme: OUTFIT_THEMES[outfit],
      locationHint: 'player avatar slot near center-lower camp scene',
      width: 256,
      height: 256,
      assetPath: `outfits/outfit-${outfit}`,
    })
  }

  for (const pet of PET_ORDER) {
    tasks.push({
      id: `camp-pet-${pet}`,
      kind: 'pet',
      pet,
      theme: PET_THEMES[pet],
      locationHint: 'pet slot in lower-right camp foreground',
      width: 192,
      height: 192,
      assetPath: `pets/pet-${pet}`,
    })
  }

  return tasks
}

function buildPrompt(task) {
  const roleLine = task.kind === 'element'
    ? `Generate a standalone pixel-art camp ${task.element} at tier ${task.tier}.`
    : task.kind === 'outfit'
      ? `Generate a standalone pixel-art player outfit sprite (${task.outfit}).`
      : `Generate a standalone pixel-art camp pet sprite (${task.pet}).`

  const detailLine = `Theme detail: ${task.theme}. Scene placement intent: ${task.locationHint}.`
  const sizeLine = `Target size: ${task.width}x${task.height}.`

  return [
    '# Camp Sprite Worker Task',
    '',
    `ID: ${task.id}`,
    `Asset path: /assets/camp/${task.assetPath}.(png|webp)`,
    '',
    roleLine,
    detailLine,
    sizeLine,
    '',
    'Style constraints:',
    '- 2D pixel art, fantasy roguelite, readable silhouette',
    '- Transparent background only',
    '- No text, no UI, no watermark, no logos',
    '- Keep object centered with modest padding',
    '- Lighting direction from upper-left to match camp scene',
    '',
    'Prompt:',
    `"pixel art sprite, fantasy dungeon camp, ${task.theme}, centered object, transparent background, crisp edges, coherent 16-bit palette, no text, no watermark"`,
    '',
    'Negative prompt:',
    '"photorealistic, blurry, 3d render, text, logo, watermark, low detail, cropped, cut-off object"',
    '',
  ].join('\n')
}

async function prepare() {
  const tasks = buildTaskRecords()
  await ensureDir(workerPromptsDir)
  await ensureDir(workerTasksDir)
  await ensureDir(defaultWorkerOutputDir)

  for (const task of tasks) {
    await writeJson(path.join(workerTasksDir, `${task.id}.json`), task)
    await fs.writeFile(path.join(workerPromptsDir, `${task.id}.md`), buildPrompt(task), 'utf-8')
  }

  const byKind = tasks.reduce((acc, task) => {
    acc[task.kind] = (acc[task.kind] ?? 0) + 1
    return acc
  }, {})

  const manifest = {
    generatedAt: new Date().toISOString(),
    command: 'camp:art:prepare',
    taskCount: tasks.length,
    countsByKind: byKind,
    workerOutputDir: toRelative(defaultWorkerOutputDir),
    tasksDir: toRelative(workerTasksDir),
    promptsDir: toRelative(workerPromptsDir),
    tasks,
    usage: [
      '1) Run: npm run camp:art:prepare',
      `2) Generate images externally and save outputs to ${toRelative(defaultWorkerOutputDir)}/<task-id>.png`,
      '3) Run: npm run camp:art:ingest',
      '4) Manifest is written to public/assets/camp/manifest.json',
    ],
  }

  await writeJson(defaultManifestPath, manifest)
  console.log(`[camp-art] prepared ${tasks.length} tasks.`)
  console.log(`[camp-art] prompt bundles: ${toRelative(workerPromptsDir)}`)
  console.log(`[camp-art] task bundles: ${toRelative(workerTasksDir)}`)
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function findWorkerImage(task, inputDir) {
  const baseCandidates = [
    task.id,
    path.basename(task.assetPath),
    task.assetPath,
  ]
  for (const base of baseCandidates) {
    for (const ext of IMAGE_EXTENSIONS) {
      const fullPath = path.join(inputDir, `${base}.${ext}`)
      if (await fileExists(fullPath)) return fullPath
    }
  }
  return null
}

async function normalizeImage(inputPath, task, outputBasePath) {
  await ensureDir(path.dirname(outputBasePath))

  const resized = sharp(inputPath)
    .ensureAlpha()
    .resize(task.width, task.height, {
      fit: 'contain',
      kernel: sharp.kernel.nearest,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })

  const pngBuffer = await resized.png({ compressionLevel: 9 }).toBuffer()
  const webpBuffer = await sharp(pngBuffer).webp({ quality: 92, alphaQuality: 100, effort: 4 }).toBuffer()

  await fs.writeFile(`${outputBasePath}.png`, pngBuffer)
  await fs.writeFile(`${outputBasePath}.webp`, webpBuffer)
}

async function safeReadDir(dirPath) {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true })
  } catch {
    return []
  }
}

async function emitManifest() {
  const elements = {}
  const outfits = {}
  const pets = {}

  const elementFiles = await safeReadDir(path.join(campAssetRoot, 'elements'))
  for (const entry of elementFiles) {
    if (!entry.isFile() || !entry.name.endsWith('.webp')) continue
    const match = entry.name.match(/^(tent|seating|campfire|decor)-tier-(\d+)\.webp$/)
    if (!match) continue
    const element = match[1]
    const tier = Number.parseInt(match[2], 10)
    if (!Number.isFinite(tier)) continue
    if (!elements[element]) elements[element] = {}
    elements[element][String(tier)] = `/assets/camp/elements/${entry.name}`
  }

  const outfitFiles = await safeReadDir(path.join(campAssetRoot, 'outfits'))
  for (const entry of outfitFiles) {
    if (!entry.isFile() || !entry.name.endsWith('.webp')) continue
    const match = entry.name.match(/^outfit-(scout|warden|scholar|vanguard)\.webp$/)
    if (!match) continue
    outfits[match[1]] = `/assets/camp/outfits/${entry.name}`
  }

  const petFiles = await safeReadDir(path.join(campAssetRoot, 'pets'))
  for (const entry of petFiles) {
    if (!entry.isFile() || !entry.name.endsWith('.webp')) continue
    const match = entry.name.match(/^pet-(cat|owl|fox|dragon_whelp)\.webp$/)
    if (!match) continue
    pets[match[1]] = `/assets/camp/pets/${entry.name}`
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    version: 1,
    elements,
    outfits,
    pets,
    stats: {
      elementVariants: Object.values(elements).reduce((sum, tiers) => sum + Object.keys(tiers).length, 0),
      outfitVariants: Object.keys(outfits).length,
      petVariants: Object.keys(pets).length,
    },
  }

  await writeJson(campManifestPath, manifest)
  await writeJson(path.join(generatedRoot, 'manifest-report.json'), manifest)

  return manifest
}

async function ingest(getArg, hasFlag) {
  const manifestFile = resolvePath(getArg('manifest'), defaultManifestPath)
  const inputDir = resolvePath(getArg('input-dir'), defaultWorkerOutputDir)
  const strict = hasFlag('strict')
  const overwrite = hasFlag('overwrite')

  if (!(await fileExists(manifestFile))) {
    throw new Error(`worker manifest missing: ${toRelative(manifestFile)} (run camp:art:prepare first)`)
  }
  const manifest = await readJson(manifestFile)
  const tasks = Array.isArray(manifest.tasks) ? manifest.tasks : []
  if (tasks.length === 0) {
    throw new Error('worker manifest has no tasks')
  }

  let imported = 0
  let missing = 0
  const missingTasks = []

  for (const task of tasks) {
    const sourcePath = await findWorkerImage(task, inputDir)
    if (!sourcePath) {
      missing += 1
      missingTasks.push(task.id)
      continue
    }

    const outputBasePath = path.join(campAssetRoot, task.assetPath)
    if (!overwrite && (await fileExists(`${outputBasePath}.webp`))) {
      continue
    }
    await normalizeImage(sourcePath, task, outputBasePath)
    imported += 1
  }

  const outManifest = await emitManifest()
  const summary = {
    generatedAt: new Date().toISOString(),
    imported,
    missing,
    strict,
    overwrite,
    inputDir: toRelative(inputDir),
    manifestFile: toRelative(manifestFile),
    missingTasks,
    outputManifest: toRelative(campManifestPath),
    available: outManifest.stats,
  }
  await writeJson(path.join(generatedRoot, 'ingest-report.json'), summary)

  console.log(`[camp-art] imported ${imported} assets, missing ${missing}.`)
  console.log(`[camp-art] manifest updated: ${toRelative(campManifestPath)}`)

  if (strict && missing > 0) {
    throw new Error(`strict mode failed: ${missing} expected outputs missing`)
  }
}

function printHelp() {
  console.log('Camp art pipeline')
  console.log('')
  console.log('Usage:')
  console.log('  node scripts/camp-art/pipeline.mjs prepare')
  console.log('  node scripts/camp-art/pipeline.mjs ingest [--input-dir <path>] [--manifest <path>] [--strict] [--overwrite]')
  console.log('  node scripts/camp-art/pipeline.mjs manifest')
}

async function main() {
  const { command, getArg, hasFlag } = parseArgs(process.argv.slice(2))

  if (command === 'prepare') {
    await prepare()
    return
  }
  if (command === 'ingest') {
    await ingest(getArg, hasFlag)
    return
  }
  if (command === 'manifest') {
    const manifest = await emitManifest()
    console.log(`[camp-art] manifest emitted (${manifest.stats.elementVariants} element, ${manifest.stats.outfitVariants} outfit, ${manifest.stats.petVariants} pet variants).`)
    return
  }

  printHelp()
}

main().catch((error) => {
  console.error('[camp-art] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})

