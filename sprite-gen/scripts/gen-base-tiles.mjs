import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Load .env
const dotenv = await import('dotenv');
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../.env') });

const API_KEY = process.env.OPENROUTER_API_KEY;
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash-image';

const NB1_STYLE = 'Fill entire 32x32 tile with texture, no background, seamless tileable pattern. Cel-shaded 2D pixel art, bold black outlines, flat color shading with 2-3 tones per color, no gradients, no anti-aliasing, high contrast, vibrant saturated colors, clean crisp edges, top-left lighting, retro 16-bit game style, visible chunky pixels. NO text, NO labels, NO letters.';

const TILES = [
  {
    name: 'autotile_soil_00',
    prompt: `Underground loose dirt and earth, warm brown tones, scattered small pebbles, crumbly soil texture with occasional darker patches and tiny root fragments. ${NB1_STYLE}`,
  },
  {
    name: 'autotile_rock_00',
    prompt: `Underground stone and rock wall, grey-brown cobblestone chunks with dark mortar lines between angular rock pieces, underground cave rock face. ${NB1_STYLE}`,
  },
];

async function callNB1(prompt) {
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
  if (!img) throw new Error('No image: ' + JSON.stringify(json).slice(0, 300));
  return Buffer.from(img.replace(/^data:image\/\w+;base64,/, ''), 'base64');
}

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

for (const tile of TILES) {
  console.log(`Generating ${tile.name}...`);
  const raw = await callNB1(tile.prompt);
  
  const hires = await sharp(raw).resize(256, 256, { kernel: 'nearest' }).png().toBuffer();
  await writeFile(join(root, `public/assets/sprites-hires/tiles/autotile/${tile.name}.png`), hires);
  
  const lowres = await sharp(raw).resize(32, 32, { kernel: 'nearest' }).png().toBuffer();
  await writeFile(join(root, `public/assets/sprites/tiles/autotile/${tile.name}.png`), lowres);
  
  console.log(`  Saved ${tile.name} (hires + lowres)`);
}

console.log('Done!');
