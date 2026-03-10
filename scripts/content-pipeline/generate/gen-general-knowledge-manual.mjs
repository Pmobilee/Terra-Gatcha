#!/usr/bin/env node
/**
 * Manual fact generator for general_knowledge domain.
 * Reads raw Wikidata items, generates quiz facts using template logic,
 * and appends to the JSONL output file. Resume-safe.
 */

import { appendFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSourceInput, loadJsonl, toJsonlLine } from './shared.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const RAW_PATH = join(ROOT, 'data', 'raw', 'general_knowledge.json');
const OUTPUT_PATH = join(ROOT, 'data', 'generated', 'general_knowledge.jsonl');
const ERROR_PATH = join(ROOT, 'data', 'generated', 'errors-general_knowledge-manual.json');

// ── Helpers ──────────────────────────────────────────────────────────────

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function pickRandom(arr, n, exclude = []) {
  const excludeSet = new Set(exclude);
  const filtered = arr.filter(x => !excludeSet.has(x));
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

/** Truncate text to at most `maxWords` words and `maxChars` characters. */
function truncate(text, maxWords = 5, maxChars = 35) {
  const trimmed = text.split(/\s+/).slice(0, maxWords).join(' ');
  return trimmed.length > maxChars ? trimmed.slice(0, maxChars) : trimmed;
}

// ── Location / Type Extraction ───────────────────────────────────────────

function parseDescription(desc) {
  // Extract location from "X in Y" patterns
  const inMatch = desc.match(/\bin\s+(.+?)(?:,\s*(?:located|built|dedicated|dating))?\s*$/i);
  const location = inMatch ? inMatch[1].replace(/,?\s*$/, '') : null;

  // Extract type
  const typePatterns = [
    { re: /\btemple\b/i, type: 'temple' },
    { re: /\bchurch\b/i, type: 'church' },
    { re: /\bmosque\b/i, type: 'mosque' },
    { re: /\bcathedral\b/i, type: 'cathedral' },
    { re: /\bpalace\b/i, type: 'palace' },
    { re: /\bcastle\b/i, type: 'castle' },
    { re: /\bfortress\b/i, type: 'fortress' },
    { re: /\bmonument\b/i, type: 'monument' },
    { re: /\barchaeological site\b/i, type: 'archaeological site' },
    { re: /\bsanctuary\b/i, type: 'sanctuary' },
    { re: /\bruin/i, type: 'ruins' },
    { re: /\bbuilding\b/i, type: 'building' },
    { re: /\bmuseum\b/i, type: 'museum' },
    { re: /\bbridge\b/i, type: 'bridge' },
    { re: /\btower\b/i, type: 'tower' },
    { re: /\bstatue\b/i, type: 'statue' },
    { re: /\bmonastery\b/i, type: 'monastery' },
    { re: /\bshrine\b/i, type: 'shrine' },
    { re: /\bsettlement\b/i, type: 'settlement' },
    { re: /\bcomplex\b/i, type: 'complex' },
  ];

  let itemType = 'landmark';
  for (const { re, type } of typePatterns) {
    if (re.test(desc)) { itemType = type; break; }
  }

  // Extract country
  const countryMatch = desc.match(
    /\b(Italy|France|Germany|Spain|Greece|Turkey|Egypt|China|Japan|India|Cambodia|Vietnam|Iraq|Syria|Jordan|Croatia|Israel|Mexico|Peru|Iran|Lebanon|Indonesia|Thailand|Myanmar|Nepal|Sri Lanka|Portugal|Morocco|Tunisia|Libya|Algeria|Yemen|Sardinia|Saudi Arabia|South Korea|Taiwan|Philippines|Malaysia|Bangladesh|Pakistan|Afghanistan|Brazil|Argentina|Chile|Colombia|Ecuador|Bolivia|England|Scotland|Wales|Ireland|Kenya|Ethiopia|Tanzania|Nigeria|South Africa|Australia|New Zealand|Russia|Ukraine|Poland|Czech Republic|Hungary|Austria|Switzerland|Netherlands|Belgium|Denmark|Sweden|Norway|Finland|Romania|Bulgaria|Serbia)\b/i,
  );
  const country = countryMatch ? countryMatch[1] : null;

  return { location, itemType, country };
}

// ── Distractor Pools ─────────────────────────────────────────────────────

const LOCATION_DISTRACTORS = {
  easy: [
    'Paris, France', 'London, England', 'New York, USA', 'Tokyo, Japan',
    'Sydney, Australia', 'Cairo, Egypt', 'Berlin, Germany', 'Madrid, Spain',
    'Moscow, Russia', 'Beijing, China', 'Rio de Janeiro', 'Mumbai, India',
    'Bangkok, Thailand', 'Istanbul, Turkey', 'Mexico City', 'Buenos Aires',
  ],
  medium: [
    'Luxor, Egypt', 'Kyoto, Japan', 'Florence, Italy', 'Cusco, Peru',
    'Angkor, Cambodia', 'Varanasi, India', 'Fez, Morocco', 'Petra, Jordan',
    'Ephesus, Turkey', 'Delphi, Greece', 'Pompeii, Italy', 'Olympia, Greece',
    'Thebes, Egypt', 'Carthage, Tunisia', 'Persepolis, Iran', 'Palmyra, Syria',
  ],
  hard: [
    'Girsu, Iraq', 'Priene, Turkey', 'Tegea, Greece', 'Aigina, Greece',
    'Paestum, Italy', 'Selinunte, Italy', 'Segesta, Italy', 'Didyma, Turkey',
    'Baalbek, Lebanon', 'Jerash, Jordan', 'Leptis Magna', 'Volubilis, Morocco',
    'Hampi, India', 'Bagan, Myanmar', 'Sukhothai, Thailand', 'Borobudur, Indonesia',
  ],
};

const TYPE_DISTRACTORS = {
  easy: [
    'museum', 'library', 'stadium', 'hotel', 'school', 'hospital',
    'park', 'theater', 'market', 'factory',
  ],
  medium: [
    'basilica', 'citadel', 'colosseum', 'amphitheater', 'aqueduct',
    'mausoleum', 'ziggurat', 'pagoda', 'minaret', 'obelisk',
  ],
  hard: [
    'stupa', 'dolmen', 'tumulus', 'tholos', 'propylaea',
    'megaron', 'mastaba', 'gopuram', 'vimana', 'hypostyle hall',
  ],
};

// ── Visual Description Templates ─────────────────────────────────────────

function generateVisualDescription(name, itemType, location) {
  const scenes = [
    `Ancient ${itemType} with weathered stone columns and carved reliefs, surrounded by ${location ? location.split(',')[0] + "'s" : 'ancient'} landscape under a golden sunset sky.`,
    `Grand ${itemType} facade with ornate architectural details and worn steps, pixel-art style with warm earth tones and scattered fallen leaves.`,
    `Majestic ${itemType} rising against a twilight sky, intricate stonework glowing in amber light, ancient trees framing the scene.`,
    `Crumbling yet beautiful ${itemType} with moss-covered walls, mysterious archways, and scattered archaeological fragments in pixel-art style.`,
    `Imposing ${itemType} entrance with towering pillars and detailed carvings, bathed in warm golden light with dust motes floating in the air.`,
  ];
  return scenes[Math.floor(Math.random() * scenes.length)];
}

// ── Wow Factor Templates ─────────────────────────────────────────────────

function generateWowFactor(name, itemType) {
  const wows = [
    `${name} stands as a timeless testament to ancient architectural mastery`,
    `This remarkable ${itemType} has witnessed centuries of human history unfold`,
    `${name} reveals the extraordinary craftsmanship of its builders`,
    `A breathtaking ${itemType} preserving irreplaceable cultural heritage`,
    `${name} offers a window into a fascinating lost civilization`,
  ];
  return wows[Math.floor(Math.random() * wows.length)];
}

// ── Fact Generator ───────────────────────────────────────────────────────

function generateFact(item, index) {
  const { item: uri, itemLabel: name, itemDescription: desc } = item;
  const { location, itemType, country } = parseDescription(desc);
  const slug = slugify(name);
  const id = `gk-${slug}-${String(index).padStart(3, '0')}`;

  // Determine the core question angle
  const hasLocation = !!location;
  const shortDesc = desc.length <= 100 ? desc : desc.slice(0, 97) + '...';

  // Statement (max 20 words)
  let statement;
  if (hasLocation) {
    statement = `${name} is a ${itemType} located in ${location}.`;
  } else {
    statement = `${name} is described as ${shortDesc}.`;
  }
  // Trim to 20 words
  const stWords = statement.split(/\s+/);
  if (stWords.length > 20) statement = stWords.slice(0, 19).join(' ') + '.';

  // Quiz question (max 12 words)
  let quizQuestion, correctAnswer;
  if (hasLocation) {
    quizQuestion = `Where is ${name} located?`;
    correctAnswer = location;
  } else {
    quizQuestion = `What type of structure is ${name}?`;
    correctAnswer = itemType;
  }

  // Trim correctAnswer to 5 words / 35 chars
  correctAnswer = truncate(correctAnswer);

  // Trim quizQuestion to 12 words
  const qqWords = quizQuestion.split(/\s+/);
  if (qqWords.length > 12) quizQuestion = qqWords.slice(0, 12).join(' ') + '?';

  // Build top-level distractors (8 total: 3 easy, 3 medium, 2 hard)
  let distractorPool;
  if (hasLocation) {
    distractorPool = LOCATION_DISTRACTORS;
  } else {
    distractorPool = TYPE_DISTRACTORS;
  }

  const easyD = pickRandom(distractorPool.easy, 3, [correctAnswer]);
  const medD = pickRandom(distractorPool.medium, 3, [correctAnswer]);
  const hardD = pickRandom(distractorPool.hard, 2, [correctAnswer]);

  const distractors = [
    ...easyD.map(t => ({ text: t.slice(0, 30), difficultyTier: 'easy' })),
    ...medD.map(t => ({ text: t.slice(0, 30), difficultyTier: 'medium' })),
    ...hardD.map(t => ({ text: t.slice(0, 30), difficultyTier: 'hard' })),
  ];

  // Build 5 variants
  const allDistractorTexts = [...easyD, ...medD, ...hardD];

  // forward variant
  const fwdDistractors = pickRandom(allDistractorTexts, 3);
  const fwdQuestion = hasLocation
    ? `${name} is a ${itemType} in which location?`
    : `What kind of structure is ${name}?`;

  // reverse variant
  const revDistractors = hasLocation
    ? pickRandom(['Parthenon', 'Colosseum', 'Taj Mahal', 'Angkor Wat', 'Hagia Sophia', 'Great Wall', 'Stonehenge', 'Machu Picchu'], 3, [name])
    : pickRandom(['Parthenon', 'Colosseum', 'Taj Mahal', 'Angkor Wat', 'Hagia Sophia'], 3, [name]);
  const revQuestion = hasLocation
    ? `Which ${itemType} is located in ${location}?`.split(/\s+/).slice(0, 15).join(' ')
    : `Which is classified as a ${itemType}?`;
  const revAnswer = truncate(name);

  // negative variant
  const negDistractors = pickRandom(allDistractorTexts.slice(0, 3), 3).map(d => d.slice(0, 30));
  // For negative, correct answer is something NOT matching
  const negCorrect = pickRandom(
    hasLocation ? LOCATION_DISTRACTORS.hard : TYPE_DISTRACTORS.hard,
    1, [correctAnswer, ...allDistractorTexts]
  )[0] || 'Antarctica';
  const negQuestion = hasLocation
    ? `Which location is NOT in ${country || 'this region'}?`
    : `Which is NOT a type of ${itemType}?`;

  // fill_blank variant
  const blankAnswer = hasLocation ? location.split(',')[0].trim() : itemType;
  const blankQuestion = hasLocation
    ? `${name} is a ${itemType} in _____.`
    : `${name} is a _____ of historical importance.`;
  const blankDistractors = pickRandom(
    hasLocation
      ? ['Athens', 'Babylon', 'Memphis', 'Thebes', 'Carthage', 'Damascus', 'Jerusalem']
      : ['museum', 'library', 'stadium', 'marketplace', 'amphitheater', 'aqueduct', 'obelisk'],
    3,
    [blankAnswer]
  );

  // true_false variant
  const tfCorrect = Math.random() > 0.5;
  let tfQuestion;
  if (tfCorrect) {
    tfQuestion = hasLocation
      ? `${name} is located in ${location}.`
      : `${name} is a type of ${itemType}.`;
  } else {
    const fakeLocation = pickRandom(LOCATION_DISTRACTORS.easy, 1, [correctAnswer])[0];
    tfQuestion = hasLocation
      ? `${name} is located in ${fakeLocation}.`
      : `${name} is a type of museum.`;
  }

  /** Truncate question to max 15 words. */
  const q15 = (s) => s.split(/\s+/).slice(0, 15).join(' ');
  const d30 = (arr) => arr.map(d => d.slice(0, 30));

  const variants = [
    {
      question: q15(fwdQuestion),
      type: 'forward',
      correctAnswer: truncate(correctAnswer),
      distractors: d30(fwdDistractors),
    },
    {
      question: q15(revQuestion),
      type: 'reverse',
      correctAnswer: revAnswer,
      distractors: d30(revDistractors),
    },
    {
      question: q15(negQuestion),
      type: 'negative',
      correctAnswer: negCorrect.slice(0, 35),
      distractors: negDistractors,
    },
    {
      question: q15(blankQuestion),
      type: 'fill_blank',
      correctAnswer: truncate(blankAnswer),
      distractors: d30(blankDistractors),
    },
    {
      question: q15(tfQuestion),
      type: 'true_false',
      correctAnswer: tfCorrect ? 'True' : 'False',
      distractors: [tfCorrect ? 'False' : 'True'],
    },
  ];

  // Difficulty based on description richness and location obscurity
  const difficulty = Math.min(5, Math.max(1,
    (desc.length < 30 ? 3 : desc.length < 60 ? 2 : 1) +
    (hasLocation ? 0 : 1) +
    (country && ['Italy', 'France', 'Egypt', 'Greece'].includes(country) ? 0 : 1)
  ));

  const funScore = Math.min(10, Math.max(1,
    (desc.length > 80 ? 7 : desc.length > 40 ? 5 : 3) +
    (itemType === 'temple' || itemType === 'archaeological site' ? 2 : 0)
  ));

  const tags = [itemType];
  if (country) tags.push(country);
  if (hasLocation) tags.push('architecture');
  tags.push('history', 'landmark');

  return {
    id,
    statement,
    quizQuestion,
    correctAnswer,
    variants,
    distractors,
    difficulty,
    funScore,
    wowFactor: generateWowFactor(name, itemType),
    visualDescription: generateVisualDescription(name, itemType, location),
    ageRating: 'kid',
    sourceName: 'Wikidata',
    sourceUrl: uri,
    category: 'general_knowledge',
    contentType: 'knowledge',
    tags,
    sourceRecordId: uri,
    generationRetries: 0,
    generationRetryFlagged: false,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('Reading raw data...');
  const raw = await readSourceInput(RAW_PATH);
  console.log(`  Raw items: ${raw.length}`);

  // Build skip set from existing output
  let existing = [];
  try { existing = await loadJsonl(OUTPUT_PATH); } catch { /* first run */ }
  const existingIds = new Set(existing.map(o => o.sourceRecordId));
  console.log(`  Already generated: ${existingIds.size}`);

  // Filter valid unprocessed items
  const valid = raw.filter(item => {
    if (existingIds.has(item.item)) return false;
    const desc = item.itemDescription || '';
    if (!desc || desc.length < 5) return false;
    if (['item', 'entity', 'thing', 'concept', 'temple', 'building'].includes(desc.trim().toLowerCase())) return false;
    return true;
  });

  console.log(`  Valid unprocessed: ${valid.length}`);
  const toProcess = valid.slice(0, 50);
  console.log(`  Processing: ${toProcess.length}`);

  const errors = [];
  let generated = 0;

  // Process in chunks of 25
  for (let chunk = 0; chunk < toProcess.length; chunk += 25) {
    const batch = toProcess.slice(chunk, chunk + 25);
    const lines = [];

    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      const idx = existingIds.size + generated + 1;
      try {
        const fact = generateFact(item, idx);
        lines.push(toJsonlLine(fact));
        generated++;
      } catch (err) {
        errors.push({
          item: item.item,
          label: item.itemLabel,
          error: err.message,
        });
        console.error(`  ERROR: ${item.itemLabel}: ${err.message}`);
      }
    }

    if (lines.length > 0) {
      appendFileSync(OUTPUT_PATH, lines.join(''));
      console.log(`  Chunk ${Math.floor(chunk / 25) + 1}: wrote ${lines.length} facts`);
    }
  }

  // Write errors
  if (errors.length > 0) {
    writeFileSync(ERROR_PATH, JSON.stringify(errors, null, 2));
    console.log(`  Errors logged: ${errors.length}`);
  }

  console.log(`\nDone! Generated ${generated} facts, ${errors.length} errors.`);
  console.log(`Total in output: ${existingIds.size + generated}`);
}

main().catch(err => { console.error(err); process.exit(1); });
