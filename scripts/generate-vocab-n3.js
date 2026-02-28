import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOTAL_ENTRIES = 500;
const POS_BUCKETS = ["Verbs", "Nouns", "Adjectives", "Adverbs"];
const CATEGORY_ROOT = ["Language", "Japanese", "JLPT N3"];
const CATEGORY_BY_POS = Object.fromEntries(
  POS_BUCKETS.map((pos) => [pos, [...CATEGORY_ROOT, pos]])
);
const RARITY_PATTERN = [
  "common",
  "common",
  "common",
  "common",
  "common",
  "uncommon",
  "uncommon",
  "uncommon",
  "common",
  "rare"
];

/**
 * Pads a number to 3 digits for stable IDs.
 * @param {number} value - The number to pad.
 * @returns {string} The padded numeric string.
 */
function padId(value) {
  return String(value).padStart(3, "0");
}

/**
 * Builds synthetic vocab entries matching the game schema.
 * @returns {Array<Record<string, unknown>>} Generated vocab entries.
 */
function generateEntries() {
  const entries = [];

  for (let index = 1; index <= TOTAL_ENTRIES; index += 1) {
    const pos = POS_BUCKETS[(index - 1) % POS_BUCKETS.length];
    const difficulty = ((index - 1) % 5) + 1;
    const rarity = RARITY_PATTERN[(index - 1) % RARITY_PATTERN.length];
    const funScore = 3 + ((index - 1) % 4);
    const token = padId(index);

    entries.push({
      id: `ja-n3-${token}`,
      type: "vocabulary",
      statement: `テスト${token} means 'test ${token}'`,
      explanation: `Synthetic seed entry ${token} for N3 content pipeline testing.`,
      quizQuestion: `What does テスト${token} mean?`,
      correctAnswer: `test ${token}`,
      distractors: [],
      category: CATEGORY_BY_POS[pos],
      rarity,
      difficulty,
      funScore,
      ageRating: "kid",
      language: "ja",
      pronunciation: `テスト${token}`
    });
  }

  const byPos = new Map();
  for (const pos of POS_BUCKETS) {
    byPos.set(pos, entries.filter((entry) => entry.category[3] === pos));
  }

  for (const entry of entries) {
    const bucket = byPos.get(entry.category[3]);
    const origin = bucket.findIndex((candidate) => candidate.id === entry.id);
    const distractors = [];

    for (let step = 1; step <= 10; step += 1) {
      const pick = bucket[(origin + step) % bucket.length].correctAnswer;
      if (!distractors.includes(pick)) {
        distractors.push(pick);
      }
    }

    entry.distractors = distractors;
  }

  return entries;
}

/**
 * Writes generated vocab data to the seed JSON file.
 */
function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const outputPath = path.resolve(scriptDir, "../src/data/seed/vocab-n3.json");
  const data = generateEntries();
  fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  process.stdout.write(`Generated ${data.length} entries at ${outputPath}\n`);
}

main();
