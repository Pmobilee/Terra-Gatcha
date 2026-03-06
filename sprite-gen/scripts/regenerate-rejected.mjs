#!/usr/bin/env node
/**
 * regenerate-rejected.mjs — Regenerate rejected sprites using Flux Schnell via local ComfyUI
 *
 * Fetches all rejected sprites from the review tool API, generates new versions
 * using the Flux Schnell GGUF model through ComfyUI, downscales to game
 * resolutions (256x256 hires, 64x64 lowres), and updates the review status.
 *
 * Usage:
 *   node sprite-gen/scripts/regenerate-rejected.mjs           # Regenerate all rejected sprites
 *   node sprite-gen/scripts/regenerate-rejected.mjs --dry-run  # Preview what would be generated
 *   node sprite-gen/scripts/regenerate-rejected.mjs --key painting_flame  # Regenerate a single sprite
 *   node sprite-gen/scripts/regenerate-rejected.mjs --keys k1,k2,k3      # Regenerate specific sprites
 *
 * Requirements:
 *   - ComfyUI running at http://localhost:8188
 *   - Review tool running at http://localhost:5174
 *   - Sharp (npm install sharp)
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

// Load environment variables
try {
  const dotenv = await import('dotenv');
  dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../.env') });
} catch { /* dotenv not required if env vars already set */ }

// =============================================================================
// STYLE GUIDE — Sprite Generation
// =============================================================================
// FLAT CEL-SHADED (2D sprites on black/transparent bg):
//   - Icons (icon_*): clean simple UI icons, glowing, black bg
//   - Items (mineral_*, relic_*): game inventory items, black bg
//   - Dome objects (obj_*): sci-fi furniture/machines, black bg
//   - Dome decorations (deco_*): wall/ceiling decorations, black bg
//   - Companions (comp_*): pet creatures, black bg
//
// FRAMED PAINTINGS (decorative wall art):
//   - Paintings (painting_*): ornate golden frame, dark wall background
//
// 3D TEXTURED BLOCK FACES (cube surfaces for mine blocks):
//   - Blocks (block_*): front face of 3D cube, fills entire image, rocky textures
//   - Mine tiles (tile_*): base rock types, fills entire image
//
// SEAMLESS TILEABLE TEXTURES (repeating backgrounds):
//   - Autotiles (autotile_*): cave/rock tile patterns
//   - Floor backgrounds (floor_bg_*): dome floor surfaces
//   - Dome surfaces (sky_*, stone_*, wood_*, etc.): walls/floors/ceilings
//
// CHARACTERS (requires reference images — skip in automated regen):
//   - GAIA (gaia_*): holographic AI character expressions
//   - Miner (miner_*): player character poses
// =============================================================================

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../..');

const COMFYUI_URL = 'http://localhost:8188';
const REVIEW_API_URL = 'http://localhost:5174';
const COMFYUI_OUTPUT_DIR = '/opt/ComfyUI/output';

// Flux Schnell settings
const UNET_NAME = 'flux1-schnell-Q4_K_S.gguf';
const CLIP_NAME1 = 'clip_l.safetensors';
const CLIP_NAME2 = 't5-v1_1-xxl-encoder-Q4_K_S.gguf';
const CLIP_TYPE = 'flux';
const VAE_NAME = 'ae.safetensors';
const KSAMPLER_STEPS = 4;
const KSAMPLER_CFG = 1.0;
const KSAMPLER_SAMPLER = 'euler';
const KSAMPLER_SCHEDULER = 'simple';
const KSAMPLER_DENOISE = 1.0;
const GEN_WIDTH = 512;
const GEN_HEIGHT = 512;

// OpenRouter settings (for tileable textures — NB1 does seamless tiling natively)
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = 'google/gemini-2.5-flash-image';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const HIRES_SIZE = 256;
const LOWRES_SIZE = 64;

/** Mandatory cel-shaded art style prefix for ALL prompts */
const CEL_STYLE = 'cartoon cel-shaded 2D game art, thick black ink outlines around every shape, flat solid color fills, 2-3 color tones only per material, NO gradients, NO realism, NO photographs, hand-drawn style, bold lines, simple clean shapes, retro 16-bit SNES style';

/** Art style suffix for NB1 tile generation — appended at end of tile prompts */
const NB1_TILE_STYLE = 'Fill entire 32x32 tile with texture, no background, seamless tileable pattern. Cel-shaded 2D pixel art, bold black outlines, flat color shading with 2-3 tones per color, no gradients, no anti-aliasing, high contrast, vibrant saturated colors, clean crisp edges, top-left lighting, retro 16-bit game style, visible chunky pixels. NO text, NO labels, NO letters.';

/** Poll interval for ComfyUI queue status (ms) */
const POLL_INTERVAL_MS = 1000;
/** Max wait time for a single generation (ms) */
const MAX_WAIT_MS = 120_000;

// ---------------------------------------------------------------------------
// Sharp import
// ---------------------------------------------------------------------------

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error(
    '\n[ERROR] "sharp" is not installed.\n' +
    '  Run: npm install sharp\n'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    key: { type: 'string' },
    keys: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
  allowPositionals: false,
});

if (args.help) {
  console.log(`
Usage: node sprite-gen/scripts/regenerate-rejected.mjs [options]

Options:
  --dry-run          Show what would be generated without calling ComfyUI
  --key <name>       Regenerate a single sprite by key
  --keys k1,k2,k3   Regenerate specific sprites by comma-separated keys
  -h, --help         Show this help message
`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Prompt Strategy — maps sprite keys to tailored Flux prompts
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Painting subject descriptions — derive framed painting prompts from these
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} */
const PAINTING_SUBJECTS = {
  painting_atlas: 'ancient world map with compass rose and sea monsters',
  painting_century: 'timeline of a hundred years, from past to future',
  painting_complete_atlas: 'completed detailed world map glowing with discovery',
  painting_crystal_garden: 'underground garden of glowing crystals and bioluminescent plants',
  painting_deep_dive: 'a miner descending into a deep glowing cavern',
  painting_family: 'a family of miners gathered around a campfire underground',
  painting_first_light: 'sunrise breaking through cave entrance, first light of dawn',
  painting_flame: 'a magical eternal flame burning in a mystical brazier',
  painting_golem: 'a massive stone golem awakening in a dark cave',
  painting_home: 'a cozy underground home with warm firelight',
  painting_library: 'a grand ancient library with towering bookshelves',
  painting_locked: 'a mysterious locked door covered in ancient glowing runes',
  painting_omniscient: 'an all-seeing cosmic eye surrounded by constellations',
  painting_perfect_year: 'all four seasons in perfect harmony',
  painting_relic_hunter: 'a daring explorer discovering a golden relic in ancient ruins',
  painting_scholar: 'a wise scholar reading a book by candlelight',
  painting_seasons: 'four-season landscape split into quadrants',
  painting_sentinel: 'an armored guardian standing watch at a fortress gate',
  painting_tree: 'a majestic ancient tree with glowing golden leaves',
  painting_wyrm_tame: 'a brave miner befriending a massive crystal wyrm dragon',
};

// ---------------------------------------------------------------------------
// Dome object descriptions — sci-fi space station interior objects
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} */
const DOME_OBJECT_SUBJECTS = {
  obj_achievement_wall: 'sci-fi trophy wall display case with medals and plaques, space station interior',
  obj_blueprint_board: 'holographic blueprint display board with technical schematics, sci-fi',
  obj_bookshelf: 'futuristic bookshelf with data tablets and glowing books, space station',
  obj_cosmetics_vendor: 'alien cosmetics shop kiosk with colorful bottles, sci-fi market',
  obj_data_disc_reader: 'sci-fi data disc reading terminal with holographic display',
  obj_decorator: 'interior decorator station with wallpaper/paint samples, sci-fi',
  obj_display_case: 'glass display case with glowing artifact inside, museum style',
  obj_dive_hatch: 'reinforced metal hatch door leading underground, with warning lights',
  obj_experiment_bench: 'science experiment workbench with bubbling potions and equipment',
  obj_farm_plot: 'hydroponic farm plot with growing plants under UV lights',
  obj_feeding_station: 'pet feeding station with food bowls and water dispenser',
  obj_fossil_display: 'fossil display stand with preserved ancient creature skeleton',
  obj_fossil_tank: 'glass preservation tank with floating fossil specimen, sci-fi',
  obj_gaia_report: 'holographic report screen showing data charts and graphs',
  obj_gaia_terminal: 'glowing AI communication terminal with holographic face display',
  obj_gallery_frame: 'ornate picture frame on wall, empty gallery display',
  obj_knowledge_tree: 'mystical glowing tree growing from a sci-fi planter, medium size',
  obj_knowledge_tree_stage0: 'tiny seedling in a sci-fi planter pot, just planted',
  obj_knowledge_tree_stage1: 'small sapling with a few leaves in sci-fi planter',
  obj_knowledge_tree_stage2: 'young tree with spreading branches in sci-fi planter',
  obj_knowledge_tree_stage3: 'growing tree with many leaves and some glowing buds',
  obj_knowledge_tree_stage4: 'large flourishing tree with glowing fruits and leaves',
  obj_knowledge_tree_stage5: 'magnificent fully grown tree radiating golden light, majestic',
  obj_locked_silhouette: 'dark mysterious silhouette outline with question mark, locked content',
  obj_market_stall: 'trading market stall with goods and price tags, bazaar',
  obj_premium_workbench: 'deluxe golden crafting workbench with rare tools, premium',
  obj_seed_station: 'seed dispensing station with plant seed compartments, botanical',
  obj_star_map: 'holographic star map showing constellations and planets, space navigation',
  obj_streak_board: 'daily streak tracking scoreboard with flame counter',
  obj_streak_shrine: 'small glowing shrine with eternal flame for daily devotion',
  obj_study_alcove: 'cozy study nook with desk, lamp, and open book, library corner',
  obj_telescope: 'large brass telescope on tripod pointing at stars',
  obj_upgrade_anvil: 'glowing upgrade anvil with hammer and sparks, blacksmith',
  obj_wallpaper_kiosk: 'wallpaper/decoration selection kiosk with color swatches',
  obj_workbench: 'crafting workbench with tools, hammer, and materials',
};

// ---------------------------------------------------------------------------
// Dome decoration descriptions
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} */
const DOME_DECO_SUBJECTS = {
  deco_ceiling_light: 'hanging sci-fi ceiling light fixture, futuristic lamp',
  deco_plant_pot: 'decorative potted plant in futuristic planter',
  deco_wall_monitor: 'wall-mounted monitor screen showing data readouts',
};

// ---------------------------------------------------------------------------
// Dome surface/background tile descriptions — seamless tileable textures
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} */
const DOME_SURFACE_SUBJECTS = {
  crystal_floor: 'crystalline floor tiles, translucent blue crystal surface',
  crystal_wall: 'crystal wall surface, faceted gem-like wall texture',
  dirt_ground: 'packed dirt ground, earthy brown soil surface',
  dome_frame: 'metallic dome structural frame, steel girder cross-section',
  dome_glass: 'transparent dome glass panel, sci-fi window',
  dome_glass_curved: 'curved transparent dome glass, panoramic window',
  interior_wall: 'sci-fi interior wall panel, metal plating with rivets',
  metal_platform: 'metal grating platform, industrial steel floor',
  sky_stars: 'dark night sky with twinkling stars and faint nebula, deep space',
  stone_floor: 'grey cobblestone floor tiles, worn ancient stone',
  stone_wall: 'grey stone brick wall, rough hewn castle blocks',
  surface_ground: 'barren rocky alien planet surface, dusty with pebbles',
  wood_planks: 'warm brown wooden plank flooring, cabin timber boards',
};

// ---------------------------------------------------------------------------
// Explicit prompt overrides (icons, items, etc.)
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} */
const EXPLICIT_PROMPTS = {
  // Icons
  icon_crystal: `${CEL_STYLE}. Single glowing blue crystal gem icon on solid black background, centered, game UI icon, clean simple design, glowing`,
  icon_dust: `${CEL_STYLE}. Single pile of sparkling dust particles icon on solid black background, centered, game UI icon, clean simple design, glowing`,
  icon_essence: `${CEL_STYLE}. Single swirling purple magical essence orb icon on solid black background, centered, game UI icon, clean simple design, glowing`,
  icon_flame: `${CEL_STYLE}. Single bright orange fire flame icon on solid black background, centered, game UI icon, clean simple design, glowing`,
  icon_geode: `${CEL_STYLE}. Single cracked open geode with crystals inside icon on solid black background, centered, game UI icon, clean simple design, glowing`,
  icon_oxygen: `${CEL_STYLE}. Single blue oxygen tank or O2 bubble icon on solid black background, centered, game UI icon, clean simple design, glowing`,
  icon_shard: `${CEL_STYLE}. Single sharp crystalline shard fragment icon on solid black background, centered, game UI icon, clean simple design, glowing`,

  // Items
  mineral_blue: `${CEL_STYLE}. Single blue glowing mineral rock chunk on solid black background, centered, game item, detailed`,
  mineral_green: `${CEL_STYLE}. Single green emerald mineral rock chunk on solid black background, centered, game item, detailed`,
  mineral_red: `${CEL_STYLE}. Single red ruby mineral rock chunk on solid black background, centered, game item, detailed`,
  relic_gold: `${CEL_STYLE}. Single ornate golden ancient relic artifact on solid black background, centered, game item, detailed`,

  // Autotile
  autotile_rock_14: `Seamless tileable rock texture, cave wall stone surface, uniform pattern. ${NB1_TILE_STYLE}`,
};

// ---------------------------------------------------------------------------
// Prompt builder — assembles the final prompt from category-specific templates
// ---------------------------------------------------------------------------

/**
 * Build a generation prompt for a sprite key.
 * Uses explicit overrides first, then category-based templates, then a generic fallback.
 * @param {string} key
 * @returns {string | null} The prompt text, or null if the key should be skipped (e.g. characters)
 */
function getPromptForSprite(key) {
  // 1. Explicit override takes priority
  if (EXPLICIT_PROMPTS[key]) return EXPLICIT_PROMPTS[key];

  // 2. Paintings — framed painting on dark wall
  if (key.startsWith('painting_')) {
    const subject = PAINTING_SUBJECTS[key]
      || key.replace('painting_', '').replace(/_/g, ' ');
    return `${CEL_STYLE}. Framed painting of ${subject}, ornate golden picture frame with decorative corners, hanging on a dark wall, museum gallery style`;
  }

  // 3. Dome objects — sci-fi items on black background
  if (key.startsWith('obj_')) {
    const subject = DOME_OBJECT_SUBJECTS[key]
      || key.replace('obj_', '').replace(/_/g, ' ') + ', sci-fi space station interior';
    return `${CEL_STYLE}. ${subject}, on solid black background, centered, game sprite`;
  }

  // 4. Dome decorations — on black background
  if (key.startsWith('deco_')) {
    const subject = DOME_DECO_SUBJECTS[key]
      || key.replace('deco_', '').replace(/_/g, ' ') + ', futuristic decoration';
    return `${CEL_STYLE}. ${subject}, on solid black background, centered, game sprite`;
  }

  // 5. Characters (gaia_, miner_) — skip for now, need reference images
  if (key.startsWith('gaia_') || key.startsWith('miner_')) {
    return null;
  }

  // 6. Dome surfaces / background tiles — seamless tileable
  if (DOME_SURFACE_SUBJECTS[key]) {
    return `Seamless tileable ${DOME_SURFACE_SUBJECTS[key]} surface texture, viewed from directly above. ${NB1_TILE_STYLE}`;
  }

  // 7. floor_bg_* patterns — derive from name
  if (key.startsWith('floor_bg_')) {
    const desc = key.replace('floor_bg_', '').replace(/_/g, ' ');
    return `Seamless tileable ${desc} floor surface texture, viewed from directly above. ${NB1_TILE_STYLE}`;
  }

  // 8. Autotile patterns
  if (key.startsWith('autotile_')) {
    const desc = key.replace(/^autotile_/, '').replace(/_\d+$/, '').replace(/_/g, ' ');
    return `Seamless tileable ${desc} surface texture, uniform pattern, viewed from directly above. ${NB1_TILE_STYLE}`;
  }

  // 8b. Biome tiles (e.g. limestone_caves_soil_08, crystal_depths_rock_03)
  // Format: {biome}_{terrain}_{variant} — category is biome_tile
  {
    const biomeMatch = key.match(/^(.+)_(rock|soil|sand|ice|crystal|moss|mud|clay|gravel|ore)_(\d+)$/);
    if (biomeMatch) {
      const biome = biomeMatch[1].replace(/_/g, ' ');
      const terrain = biomeMatch[2];
      return `Seamless tileable underground ${biome} ${terrain} texture, uniform pattern, viewed from directly above. ${NB1_TILE_STYLE}`;
    }
  }

  // 9. Icons (any not in explicit map)
  if (key.startsWith('icon_')) {
    const desc = key.replace('icon_', '').replace(/_/g, ' ');
    return `${CEL_STYLE}. Single ${desc} icon on solid black background, centered, game UI icon, clean simple design, glowing`;
  }

  // 10. Block sprites — these are faces of 3D cubes, need textured surface look
  if (key.startsWith('block_') || key.startsWith('tile_')) {
    const BLOCK_SUBJECTS = {
      block_artifact: 'ancient relic embedded in rock, mysterious glowing artifact in stone',
      block_data_disc: 'data disc embedded in rock wall, glowing tech disc in stone',
      block_descent_shaft: 'dark vertical shaft opening, deep hole in rock floor',
      block_exit_ladder: 'metal ladder rungs on rock wall, escape route',
      block_fossil: 'fossilized bones embedded in sedimentary rock',
      block_gas: 'toxic green gas seeping from cracked rock, poisonous fumes',
      block_lava: 'molten lava rock surface, glowing orange magma cracks',
      block_mineral_crystal: 'blue crystal vein in rock, sparkling mineral deposit',
      block_mineral_dust: 'dusty mineral deposit in rock, sparkling particles',
      block_mineral_essence: 'purple glowing essence seeping through rock cracks',
      block_mineral_geode: 'cracked geode in rock wall, crystals visible inside',
      block_mineral_shard: 'sharp crystal shards protruding from rock surface',
      block_mineral_shimmer: 'shimmering iridescent mineral vein in rock',
      block_oxygen_cache: 'oxygen bubbles trapped in translucent rock, air pocket',
      block_oxygen_tank: 'buried oxygen tank partially visible in rock',
      block_quiz_gate: 'mysterious locked stone gate with glowing question mark symbol',
      block_quote_stone: 'stone tablet with ancient carved inscription',
      block_relic_shrine: 'small sacred shrine carved into rock wall, glowing relic',
      block_send_up: 'upward transport pad, glowing arrow pointing up in rock',
      block_unstable: 'cracked unstable rock with visible fracture lines, about to crumble',
      block_upgrade_crate: 'wooden supply crate embedded in rock wall',
      tile_dirt: 'packed brown dirt and soil, earthy texture',
      tile_hard_rock: 'dense dark grey granite rock surface, very hard',
      tile_soft_rock: 'lighter tan sandstone rock surface, crumbly',
      tile_stone: 'medium grey stone rock surface, standard',
      tile_unbreakable: 'ultra-dense obsidian-like black rock, impenetrable, metallic sheen',
    };

    // Strip variant numbers (e.g., block_lava_03 → block_lava)
    const baseKey = key.replace(/_\d+$/, '');
    const subject = BLOCK_SUBJECTS[baseKey] || baseKey.replace(/^(block_|tile_)/, '').replace(/_/g, ' ') + ' rock surface';

    return `${subject}, flat front-facing texture, square tile filling entire image edge to edge, viewed straight-on, NOT a 3D cube, NOT isometric, just the flat surface texture, underground mine. ${NB1_TILE_STYLE}`;
  }

  // 11. Generic fallback — derive from key name, use black background
  const desc = key.replace(/_/g, ' ');
  return `${CEL_STYLE}. ${desc}, on solid black background, centered, game sprite`;
}

/**
 * Determine which sprite type a key belongs to (for post-processing decisions).
 * @param {string} key
 * @returns {'painting' | 'tile' | 'icon' | 'item' | 'autotile' | 'object' | 'deco' | 'character' | 'block'}
 */
function getSpriteType(key) {
  if (key.startsWith('painting_')) return 'painting';
  if (key.startsWith('obj_')) return 'object';
  if (key.startsWith('deco_')) return 'deco';
  if (key.startsWith('gaia_') || key.startsWith('miner_')) return 'character';
  if (key.startsWith('autotile_')) return 'autotile';
  if (key.startsWith('icon_')) return 'icon';
  if (key.startsWith('block_') || key.startsWith('tile_')) return 'block';
  if (/^.+_(rock|soil|sand|ice|crystal|moss|mud|clay|gravel|ore)_\d+$/.test(key)) return 'tile';
  if (key.startsWith('floor_bg_')) return 'tile';
  if (DOME_SURFACE_SUBJECTS[key]) return 'tile';
  return 'item';
}

// ---------------------------------------------------------------------------
// ComfyUI API interaction
// ---------------------------------------------------------------------------

/**
 * Build the ComfyUI workflow prompt for Flux Schnell.
 * @param {string} prompt - Text prompt for the image
 * @param {string} filenamePrefix - Prefix for the output filename
 * @returns {object} ComfyUI API prompt payload
 */
function buildWorkflow(prompt, filenamePrefix, width = GEN_WIDTH, height = GEN_HEIGHT) {
  const seed = Math.floor(Math.random() * 2 ** 32);
  return {
    prompt: {
      '1': {
        class_type: 'UnetLoaderGGUF',
        inputs: { unet_name: UNET_NAME },
      },
      '2': {
        class_type: 'DualCLIPLoaderGGUF',
        inputs: { clip_name1: CLIP_NAME1, clip_name2: CLIP_NAME2, type: CLIP_TYPE },
      },
      '3': {
        class_type: 'CLIPTextEncode',
        inputs: { text: prompt, clip: ['2', 0] },
      },
      '4': {
        class_type: 'EmptySD3LatentImage',
        inputs: { width, height, batch_size: 1 },
      },
      '5': {
        class_type: 'KSampler',
        inputs: {
          model: ['1', 0],
          positive: ['3', 0],
          negative: ['3', 0],
          latent_image: ['4', 0],
          seed,
          steps: KSAMPLER_STEPS,
          cfg: KSAMPLER_CFG,
          sampler_name: KSAMPLER_SAMPLER,
          scheduler: KSAMPLER_SCHEDULER,
          denoise: KSAMPLER_DENOISE,
        },
      },
      '6': {
        class_type: 'VAELoader',
        inputs: { vae_name: VAE_NAME },
      },
      '7': {
        class_type: 'VAEDecode',
        inputs: { samples: ['5', 0], vae: ['6', 0] },
      },
      '8': {
        class_type: 'SaveImage',
        inputs: { images: ['7', 0], filename_prefix: filenamePrefix },
      },
    },
  };
}

/**
 * Submit a workflow to ComfyUI and return the prompt_id.
 * @param {object} workflow
 * @returns {Promise<string>} prompt_id
 */
async function submitWorkflow(workflow) {
  const res = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '(no body)');
    throw new Error(`ComfyUI /prompt returned ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.prompt_id;
}

/**
 * Poll ComfyUI history until the given prompt_id completes.
 * Returns the output filenames from the SaveImage node.
 * @param {string} promptId
 * @returns {Promise<string[]>} Array of output filenames
 */
async function waitForCompletion(promptId) {
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_WAIT_MS) {
    await sleep(POLL_INTERVAL_MS);

    const res = await fetch(`${COMFYUI_URL}/history/${promptId}`);
    if (!res.ok) continue;

    const data = await res.json();
    const entry = data[promptId];

    if (!entry) continue;

    // Check for error status
    if (entry.status?.status_str === 'error') {
      const errorMessages = entry.status?.messages
        ?.filter(m => m[0] === 'execution_error')
        ?.map(m => m[1]?.exception_message || JSON.stringify(m[1]))
        ?.join('; ');
      throw new Error(`ComfyUI execution error: ${errorMessages || 'unknown error'}`);
    }

    // Check if outputs exist (generation complete)
    if (entry.outputs && Object.keys(entry.outputs).length > 0) {
      // Find the SaveImage node output (node "8")
      const saveOutput = entry.outputs['8'];
      if (saveOutput && saveOutput.images) {
        return saveOutput.images.map(img => img.filename);
      }
      // Try any node with images
      for (const nodeOutput of Object.values(entry.outputs)) {
        if (nodeOutput.images && nodeOutput.images.length > 0) {
          return nodeOutput.images.map(img => img.filename);
        }
      }
      throw new Error('Generation completed but no image output found');
    }
  }

  throw new Error(`Timed out waiting for ComfyUI after ${MAX_WAIT_MS / 1000}s`);
}

/**
 * Read the generated image from ComfyUI output directory.
 * @param {string} filename
 * @returns {Promise<Buffer>}
 */
async function readComfyUIOutput(filename) {
  const filePath = join(COMFYUI_OUTPUT_DIR, filename);
  return readFile(filePath);
}

// ---------------------------------------------------------------------------
// OpenRouter API interaction (for tileable textures)
// ---------------------------------------------------------------------------

/**
 * Call OpenRouter API to generate a sprite image via NB1.
 * @param {string} prompt
 * @returns {Promise<Buffer>} Raw PNG buffer
 */
async function callOpenRouter(prompt) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not set in environment');
  }

  const body = {
    model: OPENROUTER_MODEL,
    messages: [{ role: 'user', content: prompt }],
    modalities: ['image', 'text'],
    stream: false,
  };

  const res = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '(no body)');
    throw new Error(`OpenRouter API ${res.status}: ${text}`);
  }

  const data = await res.json();

  // Navigate the response to find the base64 image
  const imageUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (imageUrl) {
    const b64Match = imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (b64Match) {
      return Buffer.from(b64Match[1], 'base64');
    }
  }

  // Fallback: inline_data or b64_json
  const inlineB64 = data?.choices?.[0]?.message?.content?.[0]?.inline_data?.data
    ?? data?.choices?.[0]?.message?.images?.[0]?.b64_json;
  if (inlineB64) {
    return Buffer.from(inlineB64, 'base64');
  }

  throw new Error('No image found in OpenRouter API response');
}

// ---------------------------------------------------------------------------
// Image Post-Processing
// ---------------------------------------------------------------------------

/**
 * Make an image seamlessly tileable using offset-and-blend technique.
 * 1. Create a copy offset by half width/height (so edges meet in the center)
 * 2. Blend the offset copy over the original using a diamond gradient mask
 * This ensures all four edges wrap perfectly.
 * @param {Buffer} pngBuffer
 * @returns {Promise<Buffer>}
 */
async function applySeamlessBlend(pngBuffer) {
  const image = sharp(pngBuffer).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const hw = Math.floor(width / 2);
  const hh = Math.floor(height / 2);

  // Create offset version (shift by half in both axes — edges now meet in center)
  const offset = Buffer.alloc(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcX = (x + hw) % width;
      const srcY = (y + hh) % height;
      const srcIdx = (srcY * width + srcX) * channels;
      const dstIdx = (y * width + x) * channels;
      for (let c = 0; c < channels; c++) {
        offset[dstIdx + c] = data[srcIdx + c];
      }
    }
  }

  // Blend: use a diamond/elliptical gradient mask centered in the image
  // Center = 1.0 (use offset), edges = 0.0 (use original)
  // This hides the seam from the offset in the center where it's blended
  const result = Buffer.from(data);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Normalized distance from center (0 = edge, 1 = center)
      const nx = 1.0 - Math.abs((x - hw) / hw);
      const ny = 1.0 - Math.abs((y - hh) / hh);
      // Smooth blend factor using minimum of x/y distance (diamond shape)
      // Apply smoothstep for nicer transition
      let t = Math.min(nx, ny);
      t = t * t * (3 - 2 * t); // smoothstep

      const idx = (y * width + x) * channels;
      for (let c = 0; c < channels; c++) {
        result[idx + c] = Math.round(data[idx + c] * (1 - t) + offset[idx + c] * t);
      }
    }
  }

  return sharp(result, { raw: { width, height, channels } })
    .png()
    .toBuffer();
}

/**
 * Downscale a PNG buffer to target size using nearest-neighbor for pixel art.
 * @param {Buffer} pngBuffer
 * @param {number} size - Target width and height
 * @returns {Promise<Buffer>}
 */
async function downscale(pngBuffer, size) {
  return sharp(pngBuffer)
    .resize(size, size, {
      kernel: sharp.kernel.nearest,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

// ---------------------------------------------------------------------------
// Review Tool API
// ---------------------------------------------------------------------------

/**
 * Fetch rejected sprites from the review tool.
 * @returns {Promise<object[]>}
 */
async function fetchRejectedSprites() {
  const res = await fetch(`${REVIEW_API_URL}/api/sprites?status=rejected`);
  if (!res.ok) {
    throw new Error(`Review API returned ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch all sprites from the review tool (for --keys filtering).
 * @returns {Promise<object[]>}
 */
async function fetchAllSprites() {
  const res = await fetch(`${REVIEW_API_URL}/api/sprites`);
  if (!res.ok) {
    throw new Error(`Review API returned ${res.status}`);
  }
  return res.json();
}

/**
 * Update a sprite's status in the review tool.
 * @param {string} key
 * @param {string} status
 */
async function updateSpriteStatus(key, status) {
  const res = await fetch(`${REVIEW_API_URL}/api/sprites/${key}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, notes: '' }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '(no body)');
    console.warn(`  [WARN] Failed to update status for ${key}: ${res.status} ${text}`);
  }
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

/**
 * Ensure the parent directory of a file path exists.
 * @param {string} filePath
 */
function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** @param {number} ms */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Format elapsed time.
 * @param {number} startMs
 * @returns {string}
 */
function elapsed(startMs) {
  return ((Date.now() - startMs) / 1000).toFixed(1) + 's';
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

async function main() {
  // Parse --keys flag (comma-separated list of specific keys)
  const specificKeys = args.keys ? args.keys.split(',').filter(Boolean) : null;

  let sprites;
  if (specificKeys) {
    console.log(`[INFO] Fetching specific sprites: ${specificKeys.join(', ')}...`);
    const allSprites = await fetchAllSprites();
    sprites = allSprites.filter(s => specificKeys.includes(s.key));
    if (sprites.length === 0) {
      console.error(`[ERROR] No sprites found matching keys: ${specificKeys.join(', ')}`);
      process.exit(1);
    }
  } else if (args.key) {
    console.log(`[INFO] Fetching sprite "${args.key}" from review tool...`);
    const allSprites = await fetchAllSprites();
    sprites = allSprites.filter(s => s.key === args.key);
    if (sprites.length === 0) {
      console.error(`[ERROR] No sprite found with key "${args.key}".`);
      process.exit(1);
    }
  } else {
    console.log('[INFO] Fetching rejected sprites from review tool...');
    sprites = await fetchRejectedSprites();
  }

  if (sprites.length === 0) {
    console.log('[INFO] No rejected sprites found. Nothing to do.');
    process.exit(0);
  }

  console.log(`[INFO] Found ${sprites.length} rejected sprite(s) to regenerate.\n`);

  // Dry-run mode
  if (args['dry-run']) {
    console.log('[DRY RUN] Would regenerate:\n');
    for (const s of sprites) {
      const prompt = getPromptForSprite(s.key);
      const type = getSpriteType(s.key);
      console.log(`  - ${s.key} (${s.category}, type: ${type})`);
      if (prompt) {
        console.log(`    Prompt: ${prompt.slice(0, 100)}...`);
      } else {
        console.log(`    [WARN] No prompt available (character sprites need reference images) — will be skipped`);
      }
      if (s.notes) {
        console.log(`    Notes: ${s.notes}`);
      }
      console.log(`    Hires: ${s.file_path_hires}`);
      console.log(`    Lowres: ${s.file_path_lowres}`);
    }
    console.log(`\nTotal: ${sprites.length} sprite(s). Remove --dry-run to execute.`);
    process.exit(0);
  }

  // Verify ComfyUI is reachable
  try {
    const res = await fetch(`${COMFYUI_URL}/system_stats`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    console.log('[INFO] ComfyUI is reachable.\n');
  } catch (err) {
    console.error(`[ERROR] Cannot reach ComfyUI at ${COMFYUI_URL}: ${err.message}`);
    process.exit(1);
  }

  const failures = [];
  let successCount = 0;

  for (let i = 0; i < sprites.length; i++) {
    const sprite = sprites[i];
    const tag = `[${i + 1}/${sprites.length}]`;

    // Build prompt for this sprite
    let prompt = getPromptForSprite(sprite.key);
    if (!prompt) {
      console.log(`${tag} Skipping ${sprite.key} — no prompt available (character sprites need reference images)`);
      failures.push({ key: sprite.key, error: 'No prompt available (character sprite)' });
      continue;
    }

    // Append reviewer notes to prompt if present
    if (sprite.notes && sprite.notes.trim()) {
      prompt += `. IMPORTANT: ${sprite.notes.trim()}`;
    }

    process.stdout.write(`${tag} Generating ${sprite.key}... `);
    const startTime = Date.now();

    try {
      // Determine sprite type and generation strategy
      const spriteType = getSpriteType(sprite.key);
      const isTileable = spriteType === 'tile' || spriteType === 'autotile';
      const isBlock = spriteType === 'block';
      const useNB1 = isTileable || isBlock;

      let processedBuffer;

      if (useNB1) {
        // Tiles and blocks use OpenRouter NB1 — better cel-shaded pixel art
        const rawBuffer = await callOpenRouter(prompt);
        processedBuffer = rawBuffer;
      } else {
        // Everything else uses local Flux Schnell via ComfyUI
        const filenamePrefix = `regen_${sprite.key}`;
        const workflow = buildWorkflow(prompt, filenamePrefix);
        const promptId = await submitWorkflow(workflow);

        const outputFiles = await waitForCompletion(promptId);
        if (outputFiles.length === 0) {
          throw new Error('No output files produced');
        }

        const rawBuffer = await readComfyUIOutput(outputFiles[0]);
        processedBuffer = rawBuffer;
      }

      // 5. Downscale and save hires (256x256)
      const hiresBuffer = await downscale(processedBuffer, HIRES_SIZE);
      const hiresPath = sprite.file_path_hires;
      if (hiresPath) {
        ensureDir(hiresPath);
        await writeFile(hiresPath, hiresBuffer);
      }

      // 6. Downscale and save lowres (64x64)
      const lowresBuffer = await downscale(processedBuffer, LOWRES_SIZE);
      const lowresPath = sprite.file_path_lowres;
      if (lowresPath) {
        ensureDir(lowresPath);
        await writeFile(lowresPath, lowresBuffer);
      }

      // 7. Update review status to "pending" (ready for re-review)
      await updateSpriteStatus(sprite.key, 'pending');

      successCount++;
      console.log(`done (${elapsed(startTime)})`);
    } catch (err) {
      console.log(`FAILED (${elapsed(startTime)})`);
      console.error(`    Error: ${err.message}`);
      failures.push({ key: sprite.key, error: err.message });
    }
  }

  // Final summary
  console.log(`\n[DONE] ${successCount}/${sprites.length} sprites regenerated successfully.`);

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
