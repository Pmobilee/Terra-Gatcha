/**
 * test-biome-tiles.mjs — Generate test seamless biome tiles for limestone_caves
 *
 * Generates 2 tiles (rock + soil) via OpenRouter API, then post-processes each:
 *   1. Green screen removal (corner-sampled, distance-based)
 *   2. Make seamless (edge cross-fade blend)
 *   3. Soft inner glow (subtle dark vignette for natural tile blending)
 *   4. Resize to 256px (hi-res) and 32px (lo-res) with nearest-neighbor
 *   5. Generate 3x3 tiled preview for seamlessness inspection
 *
 * Each intermediate step is saved as a separate PNG for visual inspection.
 *
 * Usage:
 *   node sprite-gen/scripts/test-biome-tiles.mjs
 *
 * Environment:
 *   OPENROUTER_API_KEY — required, loaded from .env at project root
 *
 * Dependencies:
 *   npm install sharp dotenv
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../..');
const OUTPUT_DIR = join(PROJECT_ROOT, 'sprite-gen/output/test-biome');

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
// MANDATORY: Always use Nano Banana 1 (cheapest model)
const DEFAULT_MODEL = 'google/gemini-2.5-flash-image';

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
// Environment
// ---------------------------------------------------------------------------

dotenv.config({ path: join(PROJECT_ROOT, '.env') });
const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) {
  console.error('[ERROR] Missing OPENROUTER_API_KEY in .env');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// API interaction
// ---------------------------------------------------------------------------

/**
 * Call the OpenRouter API to generate an image.
 * Returns the raw PNG Buffer decoded from the base64 response.
 *
 * @param {string} prompt  The generation prompt
 * @param {string} apiKey  OpenRouter API key
 * @returns {Promise<Buffer>}
 */
async function callOpenRouter(prompt, apiKey) {
  const res = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image', 'text'],
      stream: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '(no body)');
    throw new Error(`API ${res.status}: ${text}`);
  }

  const data = await res.json();

  // Try multiple response formats
  const imageUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (imageUrl) {
    const b64 = imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (b64) return Buffer.from(b64[1], 'base64');
  }

  const inline =
    data?.choices?.[0]?.message?.content?.[0]?.inline_data?.data ??
    data?.choices?.[0]?.message?.images?.[0]?.b64_json;
  if (inline) return Buffer.from(inline, 'base64');

  throw new Error(
    'No image found in API response. Keys: ' +
      JSON.stringify(Object.keys(data?.choices?.[0]?.message ?? {}))
  );
}

// ---------------------------------------------------------------------------
// Green screen removal (from generate-overlay-sheets.mjs)
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
 * @param {Buffer} pngBuffer  Raw generated PNG
 * @returns {Promise<Buffer>}  Processed PNG with transparent background
 */
async function removeGreenScreen(pngBuffer) {
  const image = sharp(pngBuffer).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info; // channels === 4 (RGBA)

  // --- Step 1: Sample corners to detect the green-screen color ---
  const cornerOffsets = [
    0,                                                     // top-left
    (width - 1) * channels,                               // top-right
    (height - 1) * width * channels,                      // bottom-left
    ((height - 1) * width + (width - 1)) * channels,     // bottom-right
  ];

  let gr = 0, gg = 0, gb = 0, count = 0;
  for (const off of cornerOffsets) {
    const r = data[off], g = data[off + 1], b = data[off + 2];
    if (g > r && g > b && g > 50) {
      gr += r; gg += g; gb += b;
      count++;
    }
  }

  // If no corners are green, the tile fills the whole square — skip removal
  if (count === 0) {
    console.log('    (no green corners detected — skipping green screen removal)');
    return pngBuffer;
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
      const alpha = Math.round(
        ((dist - HARD_TOLERANCE) / (EDGE_TOLERANCE - HARD_TOLERANCE)) * 255
      );
      data[i + 3] = Math.min(data[i + 3], alpha);
    }
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

// ---------------------------------------------------------------------------
// Make seamless (edge cross-fade blend)
// ---------------------------------------------------------------------------

/**
 * Make a tile seamlessly tileable by cross-fading opposite edges.
 *
 * Takes strips from opposite edges and alpha-blends them with exponential
 * falloff so the left edge matches the right and the top matches the bottom.
 *
 * @param {Buffer} pngBuffer  Input tile PNG
 * @returns {Promise<Buffer>}  Seamless tile PNG
 */
async function makeSeamless(pngBuffer) {
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const blendZone = Math.floor(Math.min(width, height) * 0.25); // 25% blend zone

  // Create a copy for blending
  const result = Buffer.from(data);

  // Horizontal seam blending (left-right wrap)
  for (let y = 0; y < height; y++) {
    for (let bx = 0; bx < blendZone; bx++) {
      const t = bx / blendZone; // 0 at edge -> 1 at blend boundary
      const leftIdx = (y * width + bx) * channels;
      const rightIdx = (y * width + (width - 1 - bx)) * channels;

      // Average the left edge with the right edge
      for (let c = 0; c < channels; c++) {
        const avg = Math.round((data[leftIdx + c] + data[rightIdx + c]) / 2);
        result[leftIdx + c] = Math.round(avg * (1 - t) + data[leftIdx + c] * t);
        result[rightIdx + c] = Math.round(avg * (1 - t) + data[rightIdx + c] * t);
      }
    }
  }

  // Vertical seam blending (top-bottom wrap)
  for (let x = 0; x < width; x++) {
    for (let by = 0; by < blendZone; by++) {
      const t = by / blendZone;
      const topIdx = (by * width + x) * channels;
      const botIdx = ((height - 1 - by) * width + x) * channels;

      for (let c = 0; c < channels; c++) {
        const avg = Math.round((result[topIdx + c] + result[botIdx + c]) / 2);
        result[topIdx + c] = Math.round(avg * (1 - t) + result[topIdx + c] * t);
        result[botIdx + c] = Math.round(avg * (1 - t) + result[botIdx + c] * t);
      }
    }
  }

  return sharp(result, { raw: { width, height, channels } }).png().toBuffer();
}

// ---------------------------------------------------------------------------
// Inner glow / soft vignette
// ---------------------------------------------------------------------------

/**
 * Add a soft dark vignette around tile edges so adjacent tiles blend
 * naturally without hard grid lines.
 *
 * Only darkens non-transparent pixels. Max alpha ~35 at the very edge,
 * fading to 0 at ~22% inward using quadratic falloff.
 *
 * @param {Buffer} pngBuffer  Input tile PNG
 * @returns {Promise<Buffer>}  Tile with inner glow applied
 */
async function addInnerGlow(pngBuffer) {
  const glowStrength = 35; // max alpha at edges (out of 255)
  const fadePercent = 0.22; // fade starts at 22% from edge

  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;

      // Only apply glow to non-transparent pixels
      if (data[idx + 3] < 10) continue;

      // Distance from nearest edge (0 at edge, 0.5 at center)
      const edgeDist =
        Math.min(x, y, width - 1 - x, height - 1 - y) /
        Math.min(width, height);

      if (edgeDist < fadePercent) {
        const t = edgeDist / fadePercent; // 0 at edge -> 1 at fade boundary
        const glowAlpha = glowStrength * (1 - t * t); // quadratic falloff

        // Darken the pixel by blending toward black
        const blend = glowAlpha / 255;
        data[idx] = Math.round(data[idx] * (1 - blend));
        data[idx + 1] = Math.round(data[idx + 1] * (1 - blend));
        data[idx + 2] = Math.round(data[idx + 2] * (1 - blend));
      }
    }
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

// ---------------------------------------------------------------------------
// Tile definitions
// ---------------------------------------------------------------------------

const TILES = [
  {
    name: 'limestone_caves_rock',
    prompt:
      'A seamless tileable rock texture that fills the ENTIRE image edge to edge with NO background visible. Limestone cave wall surface, light beige-grey carbonate rock with subtle fossil impressions and calcite veins, natural stone surface with small cracks and mineral deposits. The texture must cover every single pixel of the image with rock — no gaps, no borders, no margins, no empty space. Cel-shaded 2D pixel art, bold black outlines, flat color shading with 2-3 tones per color, no gradients, no anti-aliasing, high contrast, clean crisp edges, top-left lighting, retro 16-bit game style, visible chunky pixels. Seamless repeating pattern. 32x32 pixel tile. NO text, NO labels, NO letters, NO words, NO numbers, NO writing of any kind.',
  },
  {
    name: 'limestone_caves_soil',
    prompt:
      'A seamless tileable soil texture that fills the ENTIRE image edge to edge with NO background visible. Limestone cave dirt floor, warm brown earth with small pebbles and root fragments, packed clay-like surface with subtle cracks. The texture must cover every single pixel of the image with soil — no gaps, no borders, no margins, no empty space. Cel-shaded 2D pixel art, bold black outlines, flat color shading with 2-3 tones per color, no gradients, no anti-aliasing, high contrast, clean crisp edges, top-left lighting, retro 16-bit game style, visible chunky pixels. Seamless repeating pattern. 32x32 pixel tile. NO text, NO labels, NO letters, NO words, NO numbers, NO writing of any kind.',
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }

  console.log(`[test-biome-tiles] Generating ${TILES.length} limestone cave tiles...`);
  console.log(`  Output: ${OUTPUT_DIR}\n`);

  for (const tile of TILES) {
    console.log(`--- ${tile.name} ---`);

    // 1. Generate via API
    console.log('  [1/6] Calling OpenRouter API...');
    const raw = await callOpenRouter(tile.prompt, API_KEY);
    const rawPath = join(OUTPUT_DIR, `${tile.name}_01_raw.png`);
    await writeFile(rawPath, raw);
    console.log(`    Saved raw (${(raw.length / 1024).toFixed(1)} KB): ${rawPath}`);

    // 2. Remove green screen
    console.log('  [2/6] Removing green screen...');
    const noGreen = await removeGreenScreen(raw);
    const noGreenPath = join(OUTPUT_DIR, `${tile.name}_02_no_green.png`);
    await writeFile(noGreenPath, noGreen);
    console.log(`    Saved: ${noGreenPath}`);

    // 3. Make seamless
    console.log('  [3/6] Making seamless...');
    const seamless = await makeSeamless(noGreen);
    const seamlessPath = join(OUTPUT_DIR, `${tile.name}_03_seamless.png`);
    await writeFile(seamlessPath, seamless);
    console.log(`    Saved: ${seamlessPath}`);

    // 4. Add inner glow
    console.log('  [4/6] Adding inner glow...');
    const glowed = await addInnerGlow(seamless);
    const glowedPath = join(OUTPUT_DIR, `${tile.name}_04_glowed.png`);
    await writeFile(glowedPath, glowed);
    console.log(`    Saved: ${glowedPath}`);

    // 5. Resize to final sizes (nearest-neighbor for pixel art)
    console.log('  [5/6] Resizing to 256px and 32px...');
    const hires = await sharp(glowed)
      .resize(256, 256, { kernel: sharp.kernel.nearest })
      .png()
      .toBuffer();
    const lowres = await sharp(glowed)
      .resize(32, 32, { kernel: sharp.kernel.nearest })
      .png()
      .toBuffer();

    const hiresPath = join(OUTPUT_DIR, `${tile.name}_hires.png`);
    const lowresPath = join(OUTPUT_DIR, `${tile.name}_lowres.png`);
    await writeFile(hiresPath, hires);
    await writeFile(lowresPath, lowres);
    console.log(`    Saved: ${hiresPath}`);
    console.log(`    Saved: ${lowresPath}`);

    // 6. Generate 3x3 tiled preview for seamlessness inspection
    console.log('  [6/6] Creating 3x3 tiled preview...');
    const tileSize = 256;
    const preview = await sharp({
      create: {
        width: tileSize * 3,
        height: tileSize * 3,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 255 },
      },
    })
      .composite(
        Array.from({ length: 9 }, (_, i) => ({
          input: hires,
          left: (i % 3) * tileSize,
          top: Math.floor(i / 3) * tileSize,
        }))
      )
      .png()
      .toBuffer();

    const previewPath = join(OUTPUT_DIR, `${tile.name}_tiled_preview.png`);
    await writeFile(previewPath, preview);
    console.log(`    Saved: ${previewPath}`);

    console.log(`  Done: ${tile.name}\n`);
  }

  console.log('[test-biome-tiles] All done! Check sprite-gen/output/test-biome/');
  console.log('  Key files to inspect:');
  console.log('    *_tiled_preview.png  — 3x3 grid to check seamlessness');
  console.log('    *_04_glowed.png      — inner shadow effect');
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
