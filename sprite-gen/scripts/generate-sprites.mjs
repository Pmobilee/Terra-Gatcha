/**
 * generate-sprites.mjs — Automated sprite generation via OpenRouter image models
 *
 * Reads sprite definitions from sprite-gen/sprite-registry.json, generates images
 * via the OpenRouter API, removes green-screen backgrounds using Sharp, and
 * downscales to game resolutions (256px hi-res, 32px lo-res).
 *
 * Usage:
 *   node sprite-gen/scripts/generate-sprites.mjs --all                  # Generate all pending sprites
 *   node sprite-gen/scripts/generate-sprites.mjs --category dome        # Generate one category
 *   node sprite-gen/scripts/generate-sprites.mjs --key obj_workbench    # Generate a single sprite
 *   node sprite-gen/scripts/generate-sprites.mjs --dry-run              # Preview what would run
 *   node sprite-gen/scripts/generate-sprites.mjs --force --all          # Regenerate everything
 *   node sprite-gen/scripts/generate-sprites.mjs --model google/gemini-3-pro-image-preview --key miner_idle
 *
 * Environment:
 *   OPENROUTER_API_KEY — required, loaded from .env at project root
 *
 * Dependencies:
 *   npm install sharp dotenv
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../..');
const DEFAULT_REGISTRY_PATH = join(PROJECT_ROOT, 'sprite-gen/sprite-registry.json');
const ENV_PATH = join(PROJECT_ROOT, '.env');

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
// MANDATORY: Always use Nano Banana 1 (cheapest model at $0.04/img)
// Do NOT use NB2 or NB Pro — they are 2-3x more expensive
const DEFAULT_MODEL = 'google/gemini-2.5-flash-image';
const PREMIUM_MODEL = 'google/gemini-2.5-flash-image';

/** Max API requests per minute (OpenRouter rate-limit safety) */
const RATE_LIMIT_RPM = 10;
/** Minimum delay between requests in ms (60s / RPM) */
const MIN_REQUEST_INTERVAL_MS = Math.ceil(60_000 / RATE_LIMIT_RPM);
/** Max retry attempts per sprite */
const MAX_RETRIES = 3;
/** Base delay for exponential backoff (ms) */
const BACKOFF_BASE_MS = 2_000;

// ---------------------------------------------------------------------------
// Dependency check
// ---------------------------------------------------------------------------

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error(
    '\n[ERROR] "sharp" is not installed.\n' +
      '  Run:  npm install sharp\n' +
      '  Then re-run this script.\n'
  );
  process.exit(1);
}

let dotenv;
try {
  dotenv = await import('dotenv');
} catch {
  console.error(
    '\n[ERROR] "dotenv" is not installed.\n' +
      '  Run:  npm install dotenv\n' +
      '  Then re-run this script.\n'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    all:      { type: 'boolean', default: false },
    category: { type: 'string' },
    key:      { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    force:    { type: 'boolean', default: false },
    model:    { type: 'string' },
    registry: { type: 'string' },
    help:     { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
  allowPositionals: false,
});

if (args.help) {
  console.log(`
Usage: node sprite-gen/scripts/generate-sprites.mjs [options]

Options:
  --all              Generate all sprites that need (re)generation
  --category <name>  Generate sprites in a specific category
  --key <name>       Generate a single sprite by its registry key
  --dry-run          Show what would be generated without calling the API
  --force            Regenerate even if already generated
  --model <id>       Override the model for this run
  --registry <path>  Use a custom registry file (default: sprite-gen/sprite-registry.json)
  -h, --help         Show this help message
`);
  process.exit(0);
}

if (!args.all && !args.category && !args.key) {
  console.error('[ERROR] Specify --all, --category <name>, or --key <name>. Use --help for usage.');
  process.exit(1);
}

const REGISTRY_PATH = args.registry
  ? resolve(PROJECT_ROOT, args.registry)
  : DEFAULT_REGISTRY_PATH;

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

dotenv.config({ path: ENV_PATH });
const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY && !args['dry-run']) {
  console.error('[ERROR] OPENROUTER_API_KEY not found. Add it to .env at the project root.');
  process.exit(1);
}

const modelOverride = args.model ?? null;

// ---------------------------------------------------------------------------
// Registry I/O
// ---------------------------------------------------------------------------

/**
 * Load and parse the sprite registry JSON.
 * @returns {Promise<object>} Parsed registry object
 */
async function loadRegistry() {
  const raw = await readFile(REGISTRY_PATH, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Persist the registry back to disk (pretty-printed).
 * @param {object} registry
 */
async function saveRegistry(registry) {
  if (registry.meta) {
    registry.meta.updatedAt = new Date().toISOString();
  } else {
    registry.updatedAt = new Date().toISOString();
  }
  await writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// Sprite selection
// ---------------------------------------------------------------------------

/**
 * Filter the sprite list based on CLI flags.
 * @param {object[]} sprites
 * @returns {object[]} Sprites to process
 */
function selectSprites(sprites) {
  let selected;

  if (args.key) {
    selected = sprites.filter((s) => s.key === args.key);
    if (selected.length === 0) {
      console.error(`[ERROR] No sprite with key "${args.key}" found in registry.`);
      process.exit(1);
    }
  } else if (args.category) {
    selected = sprites.filter((s) => s.category === args.category);
    if (selected.length === 0) {
      console.error(`[ERROR] No sprites in category "${args.category}".`);
      process.exit(1);
    }
  } else {
    // --all
    selected = sprites;
  }

  // Unless --force, skip already-generated sprites
  if (!args.force) {
    selected = selected.filter((s) => !s.generatedAt);
  }

  return selected;
}

// ---------------------------------------------------------------------------
// API interaction
// ---------------------------------------------------------------------------

/**
 * Call the OpenRouter API to generate a sprite image.
 * Returns the raw PNG Buffer decoded from the base64 response.
 *
 * @param {string} prompt  The generation prompt
 * @param {string} model   Model ID to use
 * @returns {Promise<{buffer: Buffer, model: string}>}
 */
async function callOpenRouter(prompt, model) {
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    modalities: ['image', 'text'],
    stream: false,
  };

  const res = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '(no body)');
    throw new Error(`API ${res.status}: ${text}`);
  }

  const data = await res.json();

  // Navigate the response to find the base64 image
  const imageUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imageUrl) {
    // Some models return inline_data instead
    const inlineB64 = data?.choices?.[0]?.message?.content?.[0]?.inline_data?.data
      ?? data?.choices?.[0]?.message?.images?.[0]?.b64_json;
    if (inlineB64) {
      return { buffer: Buffer.from(inlineB64, 'base64'), model };
    }
    throw new Error(
      'No image found in API response. Keys: ' +
        JSON.stringify(Object.keys(data?.choices?.[0]?.message ?? {}))
    );
  }

  // Extract base64 from data URI ("data:image/png;base64,...")
  const b64Match = imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (!b64Match) {
    throw new Error('Image URL is not a base64 data URI.');
  }

  return { buffer: Buffer.from(b64Match[1], 'base64'), model };
}

/**
 * Call the API with retry + exponential backoff.
 * @param {string} prompt
 * @param {string} model
 * @returns {Promise<{buffer: Buffer, model: string}>}
 */
async function callWithRetry(prompt, model) {
  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await callOpenRouter(prompt, model);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        const delay = BACKOFF_BASE_MS * Math.pow(2, attempt);
        console.warn(`    Retry ${attempt + 1}/${MAX_RETRIES - 1} in ${(delay / 1000).toFixed(1)}s — ${err.message}`);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Green screen removal
// ---------------------------------------------------------------------------

/**
 * Remove green-screen background from a raw PNG buffer.
 *
 * Algorithm:
 *   1. Decode to raw RGBA pixels
 *   2. Sample corner pixels to detect the actual green-screen color
 *   3. For each pixel, compute color distance to the detected green
 *   4. Within a tight tolerance, set alpha to 0 (fully transparent)
 *   5. Near the boundary (edge zone), blend alpha based on distance
 *   6. Auto-crop to content bounds with small padding
 *
 * @param {Buffer} pngBuffer  Raw generated PNG
 * @returns {Promise<Buffer>}  Processed PNG with transparent background
 */
async function removeGreenScreen(pngBuffer) {
  const image = sharp(pngBuffer).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info; // channels === 4 (RGBA)

  // --- Step 1: Sample corners to detect the green-screen color ---
  const cornerOffsets = [
    0,                                    // top-left
    (width - 1) * channels,              // top-right
    (height - 1) * width * channels,     // bottom-left
    ((height - 1) * width + (width - 1)) * channels, // bottom-right
  ];

  let gr = 0, gg = 0, gb = 0, count = 0;
  for (const off of cornerOffsets) {
    // Only average corners that look "greenish" (G channel dominant)
    const r = data[off], g = data[off + 1], b = data[off + 2];
    if (g > r && g > b && g > 50) {
      gr += r; gg += g; gb += b;
      count++;
    }
  }

  // Fallback to classic chroma green if corners are not green
  if (count === 0) {
    gr = 0; gg = 255; gb = 0; count = 1;
  } else {
    gr = Math.round(gr / count);
    gg = Math.round(gg / count);
    gb = Math.round(gb / count);
  }

  // --- Step 2: Thresholds ---
  const HARD_TOLERANCE = 80;   // Below this distance → fully transparent
  const EDGE_TOLERANCE = 130;  // Between hard and edge → alpha blending

  // --- Step 3: Process pixels ---
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dist = Math.sqrt((r - gr) ** 2 + (g - gg) ** 2 + (b - gb) ** 2);

    if (dist < HARD_TOLERANCE) {
      // Core green — fully transparent
      data[i + 3] = 0;
    } else if (dist < EDGE_TOLERANCE) {
      // Edge zone — blend alpha proportionally
      const alpha = Math.round(((dist - HARD_TOLERANCE) / (EDGE_TOLERANCE - HARD_TOLERANCE)) * 255);
      data[i + 3] = Math.min(data[i + 3], alpha);
    }
    // else: keep original alpha
  }

  // --- Step 4: Auto-crop to content bounds ---
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alphaIdx = (y * width + x) * channels + 3;
      if (data[alphaIdx] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Add small padding (4px or 2% of dimension, whichever is larger)
  const pad = Math.max(4, Math.round(Math.max(width, height) * 0.02));
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  // Rebuild the image from processed raw data, then extract/crop
  return sharp(data, { raw: { width, height, channels } })
    .extract({ left: minX, top: minY, width: cropW, height: cropH })
    .png()
    .toBuffer();
}

// ---------------------------------------------------------------------------
// Downscaling
// ---------------------------------------------------------------------------

/**
 * Resize a PNG buffer to exact target dimensions using nearest-neighbor
 * resampling (preserves pixel art crispness).
 *
 * @param {Buffer} pngBuffer
 * @param {number} targetW
 * @param {number} targetH
 * @returns {Promise<Buffer>}
 */
async function downscale(pngBuffer, targetW, targetH) {
  return sharp(pngBuffer)
    .resize(targetW, targetH, {
      kernel: sharp.kernel.nearest,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

/**
 * Ensure a directory exists, creating it recursively if needed.
 * @param {string} filePath  Path to a file (its parent dir will be ensured)
 */
async function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * Resolve a path relative to the project root.
 * @param {string} relPath
 * @returns {string}
 */
function absPath(relPath) {
  return join(PROJECT_ROOT, relPath);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** @param {number} ms */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Format elapsed time in seconds.
 * @param {number} startMs  performance.now() or Date.now() start
 * @param {number} endMs
 * @returns {string}  e.g. "10.2s"
 */
function elapsed(startMs, endMs) {
  return ((endMs - startMs) / 1000).toFixed(1) + 's';
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

async function main() {
  // Load registry
  const registry = await loadRegistry();
  const sprites = registry.sprites;

  if (sprites.length === 0) {
    console.log('[INFO] Registry is empty. Add sprites to sprite-gen/sprite-registry.json first.');
    process.exit(0);
  }

  // Select sprites to process
  const toProcess = selectSprites(sprites);

  if (toProcess.length === 0) {
    console.log('[INFO] All matching sprites are already generated. Use --force to regenerate.');
    process.exit(0);
  }

  // Dry-run mode
  if (args['dry-run']) {
    console.log(`\n[DRY RUN] Would generate ${toProcess.length} sprite(s):\n`);
    for (const s of toProcess) {
      const model = modelOverride ?? s.model ?? DEFAULT_MODEL;
      console.log(`  - ${s.key} (${s.category}/${s.subcategory}) via ${model}`);
      console.log(`    Prompt: ${s.prompt.slice(0, 80)}...`);
      console.log(`    Outputs: ${s.outputPaths.hires}, ${s.outputPaths.lowres}`);
    }
    console.log(`\nTotal: ${toProcess.length} sprite(s). Remove --dry-run to execute.`);
    process.exit(0);
  }

  // Run generation
  console.log(`\n[START] Generating ${toProcess.length} sprite(s)...\n`);

  const failures = [];
  const categoryStats = {};
  let lastRequestTime = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const sprite = toProcess[i];
    const rawModel = modelOverride ?? sprite.model ?? 'default';
    const model = rawModel === 'premium' ? PREMIUM_MODEL
      : rawModel === 'default' ? DEFAULT_MODEL
      : rawModel;
    const tag = `[${i + 1}/${toProcess.length}]`;

    process.stdout.write(`${tag} Generating ${sprite.key}... `);
    const startTime = Date.now();

    // Rate limiting: ensure minimum interval between requests
    const timeSinceLast = Date.now() - lastRequestTime;
    if (timeSinceLast < MIN_REQUEST_INTERVAL_MS && lastRequestTime > 0) {
      const waitMs = MIN_REQUEST_INTERVAL_MS - timeSinceLast;
      process.stdout.write(`(rate limit, waiting ${(waitMs / 1000).toFixed(1)}s) `);
      await sleep(waitMs);
    }

    try {
      // 1. Call the API
      lastRequestTime = Date.now();
      const { buffer: rawBuffer } = await callWithRetry(sprite.prompt, model);

      // 2. Save original (before any processing)
      const originalPath = absPath(sprite.outputPaths.original);
      await ensureDir(originalPath);
      await writeFile(originalPath, rawBuffer);

      // 3. Remove green screen
      const cleanBuffer = await removeGreenScreen(rawBuffer);

      // 4. Downscale to hi-res
      const [hiW, hiH] = sprite.targetSizes.hires;
      const hiresBuffer = await downscale(cleanBuffer, hiW, hiH);
      const hiresPath = absPath(sprite.outputPaths.hires);
      await ensureDir(hiresPath);
      await writeFile(hiresPath, hiresBuffer);

      // 5. Downscale to lo-res
      const [loW, loH] = sprite.targetSizes.lowres;
      const lowresBuffer = await downscale(cleanBuffer, loW, loH);
      const lowresPath = absPath(sprite.outputPaths.lowres);
      await ensureDir(lowresPath);
      await writeFile(lowresPath, lowresBuffer);

      // 6. Update registry entry
      sprite.generatedAt = new Date().toISOString();
      sprite.model = model;
      sprite.generationMethod = 'openrouter';
      sprite.version = (sprite.version ?? 0) + 1;

      const elapsedStr = elapsed(startTime, Date.now());
      console.log(`done (${elapsedStr})`);

      // Track category stats
      if (!categoryStats[sprite.category]) {
        categoryStats[sprite.category] = { count: 0, timeMs: 0 };
      }
      categoryStats[sprite.category].count++;
      categoryStats[sprite.category].timeMs += Date.now() - startTime;
    } catch (err) {
      const elapsedStr = elapsed(startTime, Date.now());
      console.log(`FAILED (${elapsedStr})`);
      console.error(`    Error: ${err.message}`);
      failures.push({ key: sprite.key, error: err.message });
    }
  }

  // Persist updated registry
  await saveRegistry(registry);
  console.log('\n[SAVE] Registry updated.\n');

  // Category summaries
  const categories = Object.entries(categoryStats);
  if (categories.length > 0) {
    console.log('--- Category Summaries ---');
    for (const [cat, stats] of categories) {
      console.log(`  ${cat}: ${stats.count} sprite(s) in ${(stats.timeMs / 1000).toFixed(1)}s`);
    }
  }

  // Final summary
  const successCount = toProcess.length - failures.length;
  console.log(`\n[DONE] ${successCount}/${toProcess.length} sprites generated successfully.`);

  // Auto-regenerate sprite keys so new sprites are live in-game
  if (successCount > 0) {
    console.log('\n[SPRITE KEYS] Regenerating spriteKeys.ts...');
    try {
      execSync('node scripts/gen-sprite-keys.mjs', { cwd: resolve(dirname(fileURLToPath(import.meta.url)), '../..'), stdio: 'inherit' });
    } catch (e) {
      console.error('[SPRITE KEYS] Failed to regenerate:', e.message);
    }
  }

  if (failures.length > 0) {
    console.log(`\n[FAILURES] ${failures.length} sprite(s) failed:`);
    for (const f of failures) {
      console.log(`  - ${f.key}: ${f.error}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
