#!/usr/bin/env node

import sharp from 'sharp';
import { writeFile, mkdir } from 'fs/promises';
import { readdirSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';

// Target resolutions (longest edge) by category
const RESOLUTION_MAP = {
  common: { standard: 256, lowEnd: 128 },
  elite: { standard: 320, lowEnd: 160 },
  miniboss: { standard: 320, lowEnd: 160 },
  boss: { standard: 384, lowEnd: 192 },
};

// Source and output paths
const SOURCE_ROOT = 'data/generated/enemies';
const OUTPUT_ROOT = 'public/assets/sprites/enemies';

// Sprite to skip (no roster match)
const SKIP_SPRITES = new Set(['archive_moth_clean']);

/**
 * Walk the source directory tree and collect all PNG files with their metadata
 * @returns {Array<{path: string, category: string, filename: string}>}
 */
function collectSprites() {
  const sprites = [];

  if (!statSync(SOURCE_ROOT, { throwIfNoEntry: false })) {
    console.error(`Source directory not found: ${SOURCE_ROOT}`);
    process.exit(1);
  }

  const zones = readdirSync(SOURCE_ROOT);

  for (const zone of zones) {
    const zonePath = join(SOURCE_ROOT, zone);
    const zoneStats = statSync(zonePath);

    if (!zoneStats.isDirectory()) continue;

    const categories = readdirSync(zonePath);

    for (const category of categories) {
      const categoryPath = join(zonePath, category);
      const categoryStats = statSync(categoryPath);

      if (!categoryStats.isDirectory()) continue;

      // Validate category
      if (!RESOLUTION_MAP[category]) {
        console.warn(`Skipping unknown category: ${category} (zone: ${zone})`);
        continue;
      }

      const files = readdirSync(categoryPath);

      for (const file of files) {
        if (!file.endsWith('.png')) continue;

        const filename = basename(file, '.png');

        // Skip orphan sprites
        if (SKIP_SPRITES.has(filename)) {
          console.log(`⊘ Skipping orphan sprite: ${filename}`);
          continue;
        }

        sprites.push({
          path: join(categoryPath, file),
          category,
          filename,
        });
      }
    }
  }

  return sprites;
}

/**
 * Calculate resize dimensions to fit within target longest edge
 * @param {number} width - Original width
 * @param {number} height - Original height
 * @param {number} targetEdge - Target longest edge
 * @returns {{width: number, height: number}}
 */
function calculateDimensions(width, height, targetEdge) {
  const longestEdge = Math.max(width, height);
  const scale = targetEdge / longestEdge;

  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * Process a single sprite: read, resize, and output 4 files
 * @param {string} sourcePath - Path to source PNG
 * @param {string} category - Sprite category (common/elite/miniboss/boss)
 * @param {string} filename - Sprite name (without extension)
 */
async function processSprite(sourcePath, category, filename) {
  const { standard: standardEdge, lowEnd: lowEndEdge } = RESOLUTION_MAP[category];

  try {
    // Read source metadata
    const metadata = await sharp(sourcePath).metadata();
    const { width: origWidth, height: origHeight } = metadata;

    // Calculate standard resolution dimensions
    const standardDims = calculateDimensions(origWidth, origHeight, standardEdge);
    const lowEndDims = {
      width: Math.round(standardDims.width / 2),
      height: Math.round(standardDims.height / 2),
    };

    // Standard resolution outputs
    const pngStandardBuf = await sharp(sourcePath)
      .resize(standardDims.width, standardDims.height, {
        fit: 'inside',
        kernel: sharp.kernel.nearest,
      })
      .png({ compressionLevel: 9 })
      .toBuffer();

    const webpStandardBuf = await sharp(sourcePath)
      .resize(standardDims.width, standardDims.height, {
        fit: 'inside',
        kernel: sharp.kernel.nearest,
      })
      .webp({ lossless: true })
      .toBuffer();

    // Low-end (1x) resolution outputs
    const pngLowEndBuf = await sharp(sourcePath)
      .resize(lowEndDims.width, lowEndDims.height, {
        fit: 'inside',
        kernel: sharp.kernel.nearest,
      })
      .png({ compressionLevel: 9 })
      .toBuffer();

    const webpLowEndBuf = await sharp(sourcePath)
      .resize(lowEndDims.width, lowEndDims.height, {
        fit: 'inside',
        kernel: sharp.kernel.nearest,
      })
      .webp({ lossless: true })
      .toBuffer();

    // Write files
    await mkdir(OUTPUT_ROOT, { recursive: true });

    const pngStandardPath = join(OUTPUT_ROOT, `${filename}_idle.png`);
    const webpStandardPath = join(OUTPUT_ROOT, `${filename}_idle.webp`);
    const pngLowEndPath = join(OUTPUT_ROOT, `${filename}_idle_1x.png`);
    const webpLowEndPath = join(OUTPUT_ROOT, `${filename}_idle_1x.webp`);

    await writeFile(pngStandardPath, pngStandardBuf);
    await writeFile(webpStandardPath, webpStandardBuf);
    await writeFile(pngLowEndPath, pngLowEndBuf);
    await writeFile(webpLowEndPath, webpLowEndBuf);

    return {
      filename,
      category,
      success: true,
      standardDims,
      lowEndDims,
      outputSize: pngStandardBuf.length + webpStandardBuf.length + pngLowEndBuf.length + webpLowEndBuf.length,
    };
  } catch (error) {
    console.error(`✗ Error processing ${filename}: ${error.message}`);
    return {
      filename,
      category,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log('Collecting enemy sprites...\n');

  const sprites = collectSprites();
  console.log(`Found ${sprites.length} sprites to process\n`);

  if (sprites.length === 0) {
    console.log('No sprites found. Exiting.');
    process.exit(0);
  }

  const results = [];
  let totalOutputSize = 0;
  const categoryCounts = {};

  for (const sprite of sprites) {
    process.stdout.write(`Processing ${sprite.filename}... `);

    const result = await processSprite(sprite.path, sprite.category, sprite.filename);
    results.push(result);

    if (result.success) {
      console.log(`✓ (${result.standardDims.width}×${result.standardDims.height}px)`);
      totalOutputSize += result.outputSize;
      categoryCounts[result.category] = (categoryCounts[result.category] || 0) + 1;
    } else {
      console.log(`✗ (${result.error})`);
    }
  }

  // Print summary
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;

  console.log('\n' + '='.repeat(60));
  console.log('PROCESSING SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total sprites processed: ${successCount}/${results.length}`);
  if (failureCount > 0) {
    console.log(`Failures: ${failureCount}`);
  }
  console.log(`Total output size: ${(totalOutputSize / 1024 / 1024).toFixed(2)} MB`);
  console.log('\nSprites by category:');
  for (const [category, count] of Object.entries(categoryCounts).sort()) {
    console.log(`  ${category}: ${count}`);
  }
  console.log('='.repeat(60));

  process.exit(failureCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
