import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import sharp from 'sharp';

const dotenv = await import('dotenv');
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../.env') });

const API_KEY = process.env.OPENROUTER_API_KEY;
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash-image';

const NB1_STYLE = 'Fill entire 32x32 tile with texture, no background, seamless tileable pattern. Cel-shaded 2D pixel art, bold black outlines, flat color shading with 2-3 tones per color, no gradients, no anti-aliasing, high contrast, vibrant saturated colors, clean crisp edges, top-left lighting, retro 16-bit game style, visible chunky pixels. NO text, NO labels, NO letters.';

const BIOME_TILES = [
  // Shallow tier (layers 1-5)
  { id: 'limestone_caves', soil: 'Crumbly pale beige limestone soil with embedded shell fossil fragments and white calcium deposits, warm sandy brown tones', rock: 'Solid limestone cave wall, pale grey-beige stacked stone blocks with visible sedimentary layers and tiny fossil imprints, cream and tan tones' },
  { id: 'clay_basin', soil: 'Wet reddish-brown clay earth, smooth dense packed mud with moisture sheen and tiny cracks, terracotta and sienna tones', rock: 'Hardened clay and mudstone wall, layers of orange-brown and dark red compressed earth with horizontal striations' },
  { id: 'iron_seam', soil: 'Dark rusty-brown iron-rich soil with orange oxidized patches and metallic red-brown granules scattered throughout', rock: 'Iron ore rock face, dark grey stone with bright rust-orange iron veins running through, heavy dark metallic chunks' },
  { id: 'root_tangle', soil: 'Dark brown forest soil packed with twisted pale roots and organic matter, rich humus earth with small root tendrils', rock: 'Root-wrapped stone, grey-brown rock surface with thick woody roots growing across and through cracks, mossy patches' },
  { id: 'peat_bog', soil: 'Waterlogged dark brown peat soil, spongy wet bog earth with decomposed plant matter, very dark brown almost black', rock: 'Compacted peat and mudstone, dark grey-brown dense layered sediment with preserved twig and leaf imprints' },
  // Mid tier (layers 6-10)
  { id: 'basalt_maze', soil: 'Dark volcanic basalt gravel and ash soil, charcoal grey fine fragments with occasional glassy obsidian chips', rock: 'Columnar basalt wall, dark blue-grey hexagonal stone columns packed together, geometric volcanic rock face' },
  { id: 'salt_flats', soil: 'White crystalline salt crust over pale tan sand, bright white salt crystals on sandy surface, sparkly', rock: 'Solid halite rock salt wall, translucent white and pink salt crystal chunks with clear cubic crystal faces' },
  { id: 'coal_veins', soil: 'Black coal-rich soil with shiny coal fragments mixed in dark brown earth, glossy black chips in dirt', rock: 'Coal seam wall, shiny black coal layers alternating with dark grey shale bands, reflective surfaces' },
  { id: 'granite_canyon', soil: 'Coarse granite gravel soil, speckled black and white and pink mineral grains in sandy base', rock: 'Granite wall face, coarse-grained pink and grey and white speckled stone with visible quartz and feldspar crystals' },
  { id: 'sulfur_springs', soil: 'Yellow-stained volcanic soil, bright sulfur-yellow deposits on dark volcanic earth, toxic-looking fumarole ground', rock: 'Sulfur-encrusted rock wall, grey volcanic stone with bright yellow sulfur crystal deposits and green mineral stains' },
];

async function callNB1(prompt, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const resp = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content: prompt }],
          modalities: ['image', 'text'],
          stream: false,
        }),
      });
      const json = await resp.json();
      const img = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!img) throw new Error('No image in response');
      return Buffer.from(img.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    } catch (e) {
      if (i < retries) { console.log(`    Retry ${i+1}...`); await new Promise(r => setTimeout(r, 2000)); }
      else throw e;
    }
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const hiresDir = join(root, 'public/assets/sprites-hires/tiles/biomes');
const lowresDir = join(root, 'public/assets/sprites/tiles/biomes');

if (!existsSync(hiresDir)) await mkdir(hiresDir, { recursive: true });
if (!existsSync(lowresDir)) await mkdir(lowresDir, { recursive: true });

let success = 0;
let failed = 0;

for (const biome of BIOME_TILES) {
  for (const [category, desc] of [['soil', biome.soil], ['rock', biome.rock]]) {
    const name = `${biome.id}_${category}_00`;
    console.log(`[${success+failed+1}/${BIOME_TILES.length*2}] Generating ${name}...`);
    
    const prompt = `${desc}. Underground mine texture. ${NB1_STYLE}`;
    
    try {
      const raw = await callNB1(prompt);
      
      const hires = await sharp(raw).resize(256, 256, { kernel: 'nearest' }).png().toBuffer();
      await writeFile(join(hiresDir, `${name}.png`), hires);
      
      const lowres = await sharp(raw).resize(32, 32, { kernel: 'nearest' }).png().toBuffer();
      await writeFile(join(lowresDir, `${name}.png`), lowres);
      
      console.log(`  ✓ Saved ${name}`);
      success++;
    } catch (e) {
      console.log(`  ✗ FAILED: ${e.message}`);
      failed++;
    }
  }
}

console.log(`\nDone! ${success} generated, ${failed} failed.`);

// Regenerate sprite keys
if (success > 0) {
  console.log('\nRegenerating spriteKeys.ts...');
  const { execSync } = await import('node:child_process');
  execSync('node scripts/gen-sprite-keys.mjs', { cwd: root, stdio: 'inherit' });
}
