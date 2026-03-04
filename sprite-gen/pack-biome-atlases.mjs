// sprite-gen/pack-biome-atlases.mjs
// Usage: node sprite-gen/pack-biome-atlases.mjs
//
// Packs per-tier tile sprites into Phaser-compatible texture atlases.
// Requires free-tex-packer: npm install -g free-tex-packer
// Falls back to creating placeholder atlases if not available.

import { execSync, spawnSync } from 'child_process'
import { readdirSync, existsSync, writeFileSync, mkdirSync } from 'fs'

const TIERS = {
  shallow:  ['limestone_caves', 'clay_basin', 'iron_seam', 'root_tangle', 'peat_bog'],
  mid:      ['basalt_maze', 'salt_flats', 'coal_veins', 'granite_canyon', 'sulfur_springs'],
  deep:     ['obsidian_rift', 'magma_shelf', 'crystal_geode', 'fossil_layer', 'quartz_halls'],
  extreme:  ['primordial_mantle', 'iron_core_fringe', 'pressure_dome', 'deep_biolume', 'tectonic_scar'],
  anomaly:  ['temporal_rift', 'alien_intrusion', 'bioluminescent', 'void_pocket', 'echo_chamber'],
}

const INPUT_ROOT = 'src/assets/sprites/tiles/biomes'
const OUTPUT_DIR = 'src/assets/sprites/atlases'

mkdirSync(OUTPUT_DIR, { recursive: true })

// Check if free-tex-packer is available
function hasFreeTexPacker() {
  const result = spawnSync('npx', ['free-tex-packer', '--version'], { encoding: 'utf8' })
  return result.status === 0
}

for (const [tier, biomes] of Object.entries(TIERS)) {
  const atlasName = `atlas_${tier}`
  const pngOut = `${OUTPUT_DIR}/${atlasName}.png`
  const jsonOut = `${OUTPUT_DIR}/${atlasName}.json`

  // Collect all PNG files for this tier's biomes
  const inputFiles = biomes.flatMap(b => {
    if (!existsSync(INPUT_ROOT)) return []
    try {
      return readdirSync(INPUT_ROOT)
        .filter(f => f.startsWith(`${b}_`) && f.endsWith('.png'))
        .map(f => `${INPUT_ROOT}/${f}`)
    } catch {
      return []
    }
  })

  if (inputFiles.length === 0) {
    console.log(`SKIP ${atlasName}: no input sprites found`)
    continue
  }

  if (hasFreeTexPacker()) {
    // Use free-tex-packer for real atlas packing
    const inputGlob = biomes.map(b => `${INPUT_ROOT}/${b}_*.png`).join(' ')
    try {
      execSync(
        `npx free-tex-packer --input ${inputGlob} --output ${OUTPUT_DIR}/ --name ${atlasName} --format phaser3`,
        { stdio: 'inherit' }
      )
      console.log(`Packed ${tier}: ${atlasName}.png + ${atlasName}.json`)
    } catch (err) {
      console.warn(`free-tex-packer failed for ${tier}:`, err.message)
      writePlaceholderAtlas(pngOut, jsonOut, atlasName)
    }
  } else {
    // Fallback: write placeholder atlas files
    writePlaceholderAtlas(pngOut, jsonOut, atlasName)
    console.log(`Placeholder ${atlasName} (free-tex-packer not available)`)
  }
}

/**
 * Writes a minimal 1×1 placeholder atlas PNG and Phaser-compatible JSON.
 */
function writePlaceholderAtlas(pngPath, jsonPath, atlasName) {
  // Minimal PNG: 1×1 transparent pixel
  const pngData = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR length + type
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // width=1, height=1
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, // bitdepth, color, crc
    0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, // IDAT
    0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82, // IEND
  ])
  writeFileSync(pngPath, pngData)
  const atlasJson = JSON.stringify({
    frames: {},
    meta: {
      image: `${atlasName}.png`,
      size: { w: 1, h: 1 },
      scale: '1',
    },
  }, null, 2)
  writeFileSync(jsonPath, atlasJson)
}
