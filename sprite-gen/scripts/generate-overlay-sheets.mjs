/**
 * generate-overlay-sheets.mjs — Generate 5x5 sprite sheets for mine block overlays
 *
 * Generates overlay sprite sheets via OpenRouter image API, then slices each
 * 5x5 grid into 25 individual PNGs at both hi-res (256x256) and lo-res (32x32).
 *
 * Usage:
 *   node sprite-gen/scripts/generate-overlay-sheets.mjs --sheet minerals  # Generate one sheet
 *   node sprite-gen/scripts/generate-overlay-sheets.mjs --all             # Generate all 6 sheets
 *   node sprite-gen/scripts/generate-overlay-sheets.mjs --dry-run         # Preview what would run
 *   node sprite-gen/scripts/generate-overlay-sheets.mjs --force --all     # Regenerate everything
 *
 * Environment:
 *   OPENROUTER_API_KEY — required, loaded from .env at project root
 *
 * Dependencies:
 *   npm install sharp dotenv
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../..');
const ENV_PATH = join(PROJECT_ROOT, '.env');

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
// MANDATORY: Always use Nano Banana 1 (cheapest model at $0.04/img)
const DEFAULT_MODEL = 'google/gemini-2.5-flash-image';

const GRID_ROWS = 5;
const GRID_COLS = 5;

/** Max API requests per minute (OpenRouter rate-limit safety) */
const RATE_LIMIT_RPM = 10;
/** Minimum delay between requests in ms (60s / RPM) */
const MIN_REQUEST_INTERVAL_MS = Math.ceil(60_000 / RATE_LIMIT_RPM);
/** Max retry attempts per sheet */
const MAX_RETRIES = 3;
/** Base delay for exponential backoff (ms) */
const BACKOFF_BASE_MS = 2_000;

const HIRES_SIZE = 256;
const LOWRES_SIZE = 32;

const OUTPUT_DIR_SHEETS = 'sprite-gen/output/tiles/overlays';
const OUTPUT_DIR_HIRES = 'public/assets/sprites-hires/tiles/overlays';
const OUTPUT_DIR_LOWRES = 'public/assets/sprites/tiles/overlays';

// ---------------------------------------------------------------------------
// Art style prompt fragment
// ---------------------------------------------------------------------------

const ART_STYLE = 'cel-shaded 2D pixel art, bold black outlines, flat color shading with 2-3 tones per color, no gradients, no anti-aliasing, high contrast, vibrant saturated colors, clean crisp edges, top-left lighting, retro 16-bit game style, visible chunky pixels';

// ---------------------------------------------------------------------------
// Sheet definitions (6 sheets, 5 rows x 5 cols = 25 sprites each = 150 total)
// ---------------------------------------------------------------------------

const SHEETS = [
  {
    id: 'minerals',
    name: 'Minerals',
    rows: [
      { prefix: 'overlay_mineral_dust', description: 'dust — faint sparkle specks peeking through cracks' },
      { prefix: 'overlay_mineral_shard', description: 'shard — small crystal tips protruding from surface' },
      { prefix: 'overlay_mineral_crystal', description: 'crystal — medium crystal cluster in rock fissure' },
      { prefix: 'overlay_mineral_geode', description: 'geode — cracked-open cavity with purple/pink glow' },
      { prefix: 'overlay_mineral_essence', description: 'essence — radiant golden glow from deep fissures' },
    ],
  },
  {
    id: 'artifacts',
    name: 'Artifacts & Relics',
    rows: [
      { prefix: 'overlay_artifact_common', description: 'artifact common — corner of small trinket in crack' },
      { prefix: 'overlay_artifact_uncommon', description: 'artifact uncommon — glowing circuit pattern through fissure' },
      { prefix: 'overlay_artifact_rare', description: 'artifact rare+ — bright ancient device partially exposed' },
      { prefix: 'overlay_relic_shrine', description: 'relic shrine — golden altar markings, mystical glyphs' },
      { prefix: 'overlay_recipe_frag', description: 'recipe fragment — scroll/blueprint edge poking out' },
    ],
  },
  {
    id: 'hazards',
    name: 'Hazards',
    rows: [
      { prefix: 'overlay_lava_seep', description: 'lava seep — orange-red glow through hairline cracks' },
      { prefix: 'overlay_lava_intense', description: 'lava intense — bright lava veins through deep fissures' },
      { prefix: 'overlay_gas_wisp', description: 'gas wisp — thin green vapor from small holes' },
      { prefix: 'overlay_gas_dense', description: 'gas dense — thick green fog pooling in cracks' },
      { prefix: 'overlay_unstable', description: 'unstable ground — tremor lines, shifting fractures' },
    ],
  },
  {
    id: 'collectibles',
    name: 'Collectibles',
    rows: [
      { prefix: 'overlay_fossil', description: 'fossil — bone/shell imprint in rock face' },
      { prefix: 'overlay_data_disc', description: 'data disc — glowing cyan disc edge in crack' },
      { prefix: 'overlay_oxygen_cache', description: 'oxygen cache — blue O2 bubbles trapped in cavity' },
      { prefix: 'overlay_oxygen_tank', description: 'oxygen tank — metal cap/valve through crack' },
      { prefix: 'overlay_chest', description: 'chest — gold corner/latch peeking through fracture' },
    ],
  },
  {
    id: 'structural',
    name: 'Structural',
    rows: [
      { prefix: 'overlay_exit_ladder', description: 'exit ladder — metal rungs, light from above' },
      { prefix: 'overlay_descent_shaft', description: 'descent shaft — dark hole opening with depth' },
      { prefix: 'overlay_quiz_gate', description: 'quiz gate — glowing question mark, golden runes' },
      { prefix: 'overlay_send_up', description: 'send-up station — pneumatic tube opening, upward arrow' },
      { prefix: 'overlay_upgrade_crate', description: 'upgrade crate — wooden/metal corner with gear emblem' },
    ],
  },
  {
    id: 'text_misc',
    name: 'Text & Misc',
    rows: [
      { prefix: 'overlay_quote_stone', description: 'quote stone — faintly carved text on surface' },
      { prefix: 'overlay_wall_text', description: 'wall text — glowing inscription characters' },
      { prefix: 'overlay_tablet', description: 'tablet — stone tablet edge in crack' },
      { prefix: 'overlay_offering_altar', description: 'offering altar — purple glyph, sacrificial bowl rim' },
      { prefix: 'overlay_locked', description: 'locked/challenge — lock icon, barrier runes' },
    ],
  },
];

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
    all:       { type: 'boolean', default: false },
    sheet:     { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    force:     { type: 'boolean', default: false },
    model:     { type: 'string' },
    help:      { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
  allowPositionals: false,
});

if (args.help) {
  console.log(`
Usage: node sprite-gen/scripts/generate-overlay-sheets.mjs [options]

Options:
  --all              Generate all 6 overlay sheets
  --sheet <id>       Generate a specific sheet (minerals, artifacts, hazards,
                     collectibles, structural, text_misc)
  --dry-run          Show what would be generated without calling the API
  --force            Regenerate even if output files already exist
  --model <id>       Override the model for this run
  -h, --help         Show this help message

Sheets: ${SHEETS.map((s) => s.id).join(', ')}
`);
  process.exit(0);
}

if (!args.all && !args.sheet) {
  console.error('[ERROR] Specify --all or --sheet <id>. Use --help for usage.');
  process.exit(1);
}

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
// Utilities
// ---------------------------------------------------------------------------

/** @param {number} ms */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Format elapsed time in seconds.
 * @param {number} startMs
 * @param {number} endMs
 * @returns {string}
 */
function elapsed(startMs, endMs) {
  return ((endMs - startMs) / 1000).toFixed(1) + 's';
}

/**
 * Ensure a directory exists, creating it recursively if needed.
 * @param {string} dirPath  Absolute directory path
 */
async function ensureDirPath(dirPath) {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

/**
 * Ensure parent directory of a file exists.
 * @param {string} filePath  Absolute file path
 */
async function ensureDir(filePath) {
  await ensureDirPath(dirname(filePath));
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
// API interaction
// ---------------------------------------------------------------------------

/**
 * Call the OpenRouter API to generate an image.
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
 *
 * NOTE: Unlike generate-sprites.mjs, we do NOT auto-crop here because
 * we need to preserve the grid layout for slicing.
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
  const HARD_TOLERANCE = 80;
  const EDGE_TOLERANCE = 130;

  // --- Step 3: Process pixels ---
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dist = Math.sqrt((r - gr) ** 2 + (g - gg) ** 2 + (b - gb) ** 2);

    if (dist < HARD_TOLERANCE) {
      data[i + 3] = 0;
    } else if (dist < EDGE_TOLERANCE) {
      const alpha = Math.round(((dist - HARD_TOLERANCE) / (EDGE_TOLERANCE - HARD_TOLERANCE)) * 255);
      data[i + 3] = Math.min(data[i + 3], alpha);
    }
  }

  // Rebuild image from processed raw data (NO auto-crop — preserve grid)
  return sharp(data, { raw: { width, height, channels } })
    .png()
    .toBuffer();
}

// ---------------------------------------------------------------------------
// Sheet slicing
// ---------------------------------------------------------------------------

/**
 * Slice a full sheet image into a grid of individual tile buffers.
 *
 * @param {Buffer} sheetBuffer  The full sheet PNG (after green screen removal)
 * @param {number} rows         Number of rows in the grid
 * @param {number} cols         Number of columns in the grid
 * @returns {Promise<Buffer[]>} Array of individual tile PNG buffers (row-major order)
 */
async function sliceSheet(sheetBuffer, rows, cols) {
  const metadata = await sharp(sheetBuffer).metadata();
  const sheetW = metadata.width;
  const sheetH = metadata.height;

  const cellW = Math.floor(sheetW / cols);
  const cellH = Math.floor(sheetH / rows);

  console.log(`    Sheet size: ${sheetW}x${sheetH}, cell size: ${cellW}x${cellH}`);

  const tiles = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const left = col * cellW;
      const top = row * cellH;

      const tileBuffer = await sharp(sheetBuffer)
        .extract({ left, top, width: cellW, height: cellH })
        .png()
        .toBuffer();

      tiles.push(tileBuffer);
    }
  }

  return tiles;
}

/**
 * Auto-crop a single tile to its content bounds with small padding,
 * then resize to target dimensions.
 *
 * @param {Buffer} tileBuffer  Individual tile PNG
 * @param {number} targetSize  Target width/height (square)
 * @returns {Promise<Buffer>}  Cropped and resized PNG
 */
async function cropAndResize(tileBuffer, targetSize) {
  // First auto-crop to content
  const image = sharp(tileBuffer).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  let minX = width, minY = height, maxX = 0, maxY = 0;
  let hasContent = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alphaIdx = (y * width + x) * channels + 3;
      if (data[alphaIdx] > 10) {
        hasContent = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  let cropped;
  if (!hasContent) {
    // Empty tile — just resize transparent
    cropped = tileBuffer;
  } else {
    // Add small padding
    const pad = Math.max(2, Math.round(Math.max(width, height) * 0.02));
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(width - 1, maxX + pad);
    maxY = Math.min(height - 1, maxY + pad);

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;

    cropped = await sharp(data, { raw: { width, height, channels } })
      .extract({ left: minX, top: minY, width: cropW, height: cropH })
      .png()
      .toBuffer();
  }

  // Resize to target (nearest-neighbor for pixel art)
  return sharp(cropped)
    .resize(targetSize, targetSize, {
      kernel: sharp.kernel.nearest,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

// ---------------------------------------------------------------------------
// Prompt building
// ---------------------------------------------------------------------------

/**
 * Build the full generation prompt for a sheet.
 * @param {object} sheet  Sheet definition from SHEETS array
 * @returns {string}  Complete prompt for the API
 */
function buildSheetPrompt(sheet) {
  const prefix = `A 5x5 grid of mine block overlay sprites on solid bright green (#00FF00) background. ${ART_STYLE}. Each cell shows a TRANSPARENT overlay meant to be placed on top of a rock texture. 5 rows, 5 variants each:`;

  const rowDescs = sheet.rows
    .map((row, i) => `Row ${i + 1}: ${row.description}`)
    .join('\n');

  return `${prefix}\n${rowDescs}`;
}

// ---------------------------------------------------------------------------
// Sheet selection
// ---------------------------------------------------------------------------

/**
 * Select which sheets to process based on CLI flags.
 * @returns {object[]}  Array of sheet definitions to process
 */
function selectSheets() {
  if (args.sheet) {
    const sheet = SHEETS.find((s) => s.id === args.sheet);
    if (!sheet) {
      console.error(`[ERROR] Unknown sheet "${args.sheet}". Available: ${SHEETS.map((s) => s.id).join(', ')}`);
      process.exit(1);
    }
    return [sheet];
  }
  // --all
  return [...SHEETS];
}

/**
 * Check if a sheet has already been generated (all output files exist).
 * @param {object} sheet  Sheet definition
 * @returns {boolean}
 */
function isSheetGenerated(sheet) {
  // Check if the original sheet file exists
  const sheetPath = absPath(`${OUTPUT_DIR_SHEETS}/${sheet.id}_sheet_original.png`);
  if (!existsSync(sheetPath)) return false;

  // Check if all individual tiles exist
  for (const row of sheet.rows) {
    for (let v = 0; v < GRID_COLS; v++) {
      const key = `${row.prefix}_${String(v).padStart(2, '0')}`;
      const hiresPath = absPath(`${OUTPUT_DIR_HIRES}/${key}.png`);
      const lowresPath = absPath(`${OUTPUT_DIR_LOWRES}/${key}.png`);
      if (!existsSync(hiresPath) || !existsSync(lowresPath)) return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Sheet processing pipeline
// ---------------------------------------------------------------------------

/**
 * Process a single sheet: prompt -> API -> green screen -> slice -> save.
 *
 * @param {object} sheet       Sheet definition
 * @param {string} model       Model ID to use
 * @param {number} sheetIndex  Index for progress display
 * @param {number} totalSheets Total sheets being processed
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function processSheet(sheet, model, sheetIndex, totalSheets) {
  const tag = `[${sheetIndex + 1}/${totalSheets}]`;
  console.log(`\n${tag} Processing sheet: ${sheet.name} (${sheet.id})`);
  const startTime = Date.now();

  try {
    // 1. Build prompt
    const prompt = buildSheetPrompt(sheet);
    console.log(`    Prompt length: ${prompt.length} chars`);

    // 2. Call API
    console.log(`    Calling API (model: ${model})...`);
    const { buffer: rawBuffer } = await callWithRetry(prompt, model);
    console.log(`    Received raw image (${(rawBuffer.length / 1024).toFixed(1)} KB)`);

    // 3. Save original sheet
    const originalPath = absPath(`${OUTPUT_DIR_SHEETS}/${sheet.id}_sheet_original.png`);
    await ensureDir(originalPath);
    await writeFile(originalPath, rawBuffer);
    console.log(`    Saved original: ${originalPath}`);

    // 4. Remove green screen from full sheet
    console.log('    Removing green screen...');
    const cleanBuffer = await removeGreenScreen(rawBuffer);

    // Save cleaned sheet too (useful for debugging)
    const cleanPath = absPath(`${OUTPUT_DIR_SHEETS}/${sheet.id}_sheet_clean.png`);
    await writeFile(cleanPath, cleanBuffer);

    // 5. Slice into grid
    console.log('    Slicing into 5x5 grid...');
    const tiles = await sliceSheet(cleanBuffer, GRID_ROWS, GRID_COLS);
    console.log(`    Got ${tiles.length} tiles`);

    // 6. Process each tile: crop, resize, save
    let tileIdx = 0;
    for (let rowIdx = 0; rowIdx < sheet.rows.length; rowIdx++) {
      const row = sheet.rows[rowIdx];
      for (let variantIdx = 0; variantIdx < GRID_COLS; variantIdx++) {
        const key = `${row.prefix}_${String(variantIdx).padStart(2, '0')}`;
        const tileBuffer = tiles[tileIdx];

        // Hi-res (256x256)
        const hiresBuffer = await cropAndResize(tileBuffer, HIRES_SIZE);
        const hiresPath = absPath(`${OUTPUT_DIR_HIRES}/${key}.png`);
        await ensureDir(hiresPath);
        await writeFile(hiresPath, hiresBuffer);

        // Lo-res (32x32)
        const lowresBuffer = await cropAndResize(tileBuffer, LOWRES_SIZE);
        const lowresPath = absPath(`${OUTPUT_DIR_LOWRES}/${key}.png`);
        await ensureDir(lowresPath);
        await writeFile(lowresPath, lowresBuffer);

        tileIdx++;
      }
    }

    const elapsedStr = elapsed(startTime, Date.now());
    console.log(`    Done! ${tiles.length} tiles saved in ${elapsedStr}`);
    return { success: true };
  } catch (err) {
    const elapsedStr = elapsed(startTime, Date.now());
    console.error(`    FAILED (${elapsedStr}): ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Ensure output directories exist
  await ensureDirPath(absPath(OUTPUT_DIR_SHEETS));
  await ensureDirPath(absPath(OUTPUT_DIR_HIRES));
  await ensureDirPath(absPath(OUTPUT_DIR_LOWRES));

  // Select sheets
  let sheetsToProcess = selectSheets();

  // Filter already-generated unless --force
  if (!args.force) {
    const before = sheetsToProcess.length;
    sheetsToProcess = sheetsToProcess.filter((s) => !isSheetGenerated(s));
    const skipped = before - sheetsToProcess.length;
    if (skipped > 0) {
      console.log(`[INFO] Skipping ${skipped} already-generated sheet(s). Use --force to regenerate.`);
    }
  }

  if (sheetsToProcess.length === 0) {
    console.log('[INFO] All matching sheets are already generated. Use --force to regenerate.');
    process.exit(0);
  }

  const model = modelOverride ?? DEFAULT_MODEL;

  // Dry-run mode
  if (args['dry-run']) {
    console.log(`\n[DRY RUN] Would generate ${sheetsToProcess.length} sheet(s):\n`);
    for (const sheet of sheetsToProcess) {
      const prompt = buildSheetPrompt(sheet);
      console.log(`  Sheet: ${sheet.name} (${sheet.id})`);
      console.log(`    Model: ${model}`);
      console.log(`    Tiles: ${sheet.rows.length * GRID_COLS} (${sheet.rows.length} rows x ${GRID_COLS} variants)`);
      console.log(`    Prompt preview: ${prompt.slice(0, 120)}...`);
      console.log(`    Row keys:`);
      for (const row of sheet.rows) {
        console.log(`      ${row.prefix}_00 .. ${row.prefix}_04`);
      }
      console.log();
    }
    const totalTiles = sheetsToProcess.reduce((sum, s) => sum + s.rows.length * GRID_COLS, 0);
    console.log(`Total: ${sheetsToProcess.length} sheet(s), ${totalTiles} tiles. Remove --dry-run to execute.`);
    process.exit(0);
  }

  // Run generation
  const totalTiles = sheetsToProcess.reduce((sum, s) => sum + s.rows.length * GRID_COLS, 0);
  console.log(`\n[START] Generating ${sheetsToProcess.length} sheet(s) (${totalTiles} tiles total)...\n`);

  const failures = [];
  let lastRequestTime = 0;

  for (let i = 0; i < sheetsToProcess.length; i++) {
    const sheet = sheetsToProcess[i];

    // Rate limiting between sheets
    const timeSinceLast = Date.now() - lastRequestTime;
    if (timeSinceLast < MIN_REQUEST_INTERVAL_MS && lastRequestTime > 0) {
      const waitMs = MIN_REQUEST_INTERVAL_MS - timeSinceLast;
      console.log(`  (rate limit, waiting ${(waitMs / 1000).toFixed(1)}s)`);
      await sleep(waitMs);
    }

    lastRequestTime = Date.now();
    const result = await processSheet(sheet, model, i, sheetsToProcess.length);

    if (!result.success) {
      failures.push({ id: sheet.id, name: sheet.name, error: result.error });
    }
  }

  // Final summary
  const successCount = sheetsToProcess.length - failures.length;
  const successTiles = (sheetsToProcess.length - failures.length) * GRID_ROWS * GRID_COLS;
  console.log(`\n[DONE] ${successCount}/${sheetsToProcess.length} sheets generated (${successTiles} tiles).`);

  if (failures.length > 0) {
    console.log(`\n[FAILURES] ${failures.length} sheet(s) failed:`);
    for (const f of failures) {
      console.log(`  - ${f.name} (${f.id}): ${f.error}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
