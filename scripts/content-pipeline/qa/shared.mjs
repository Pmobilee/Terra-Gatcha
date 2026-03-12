import fs from 'node:fs/promises'
import path from 'node:path'

export function parseArgs(argv, defaults = {}) {
  const out = { ...defaults }
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next == null || next.startsWith('--')) {
      out[key] = true
      continue
    }
    if (next === 'true') out[key] = true
    else if (next === 'false') out[key] = false
    else if (!Number.isNaN(Number(next)) && next.trim() !== '') out[key] = Number(next)
    else out[key] = next
    i += 1
  }
  return out
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}

export async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function loadJsonl(filePath) {
  const text = await fs.readFile(filePath, 'utf8')
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

export function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function listJsonlFiles(directory) {
  const names = await fs.readdir(directory)
  return names
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(directory, name))
}

const PLACEHOLDER_RE = /^(alternative option \d+|alternative \d+|option [a-z\d]+|distractor \d+|unknown option \d*|unknown option|not applicable|invalid answer|unrelated concept|incorrect claim|false statement|similar concept|related term|alternative word|different word|misleading choice|incorrect term|unrelated option|alternative theory|related concept|other meaning|alternative sense|another option|additional meaning|related idea|another word|different meaning|similar term|plausible option.*|wrong answer|test option|placeholder|sample answer|alternative|unrelated|incorrect|invalid|misleading|sample|unknown)$/i

export function isPlaceholderDistractor(text) {
  return PLACEHOLDER_RE.test(String(text || '').trim())
}

export function parseDistractorsColumn(raw) {
  if (!raw) return []
  try {
    const parsed = JSON.parse(String(raw))
    if (!Array.isArray(parsed)) return []
    return parsed.map(d => typeof d === 'string' ? d : String(d?.text ?? d ?? '')).filter(Boolean)
  } catch {
    return []
  }
}

export const GARBAGE_DISTRACTORS = new Set([
  // Generic concept words (995+ reuses each)
  'approach', 'concept', 'method', 'practice', 'process',
  'system', 'theory', 'technique',
  'aspect', 'element', 'idea', 'item',
  'action', 'condition', 'feeling', 'object', 'quality',
  'consequence', 'opposite meaning', 'unclassified', 'undetermined',
  // Generic verb distractors (749+ reuses)
  'to change', 'to find', 'to know', 'to make', 'to move',
  'to be', 'to do', 'to give', 'to go', 'to have',
  'to accomplish or complete', 'to alter', 'to use',
  // Generic English noun distractors (248+ reuses)
  'book', 'chair', 'door', 'flower', 'house', 'tree', 'table',
  // Generic German distractors (244+ reuses)
  'beispiel', 'grund', 'kraft', 'muster', 'raum',
  // Generic meta-category distractors (132+ reuses)
  'a quality or characteristic', 'a state or condition', 'a type of object or tool',
  'a concept or idea', 'a feeling or emotion', 'a location or place',
  'a problem or challenge',
  'a person', 'a place', 'a quality', 'a time', 'an action',
  // Generic history distractors (362+ reuses)
  'a cultural revolution in eastern europe',
  'a military campaign against the roman empire',
  'a naval expedition to explore new territories',
  'a political uprising against monarchy',
  'a religious movement that spread across asia',
  'a scientific discovery that changed mathematics',
  'a trade agreement between european nations',
  // Other high-frequency garbage
  'alternate meaning 8',
  'hate', 'an exercise', 'falsehood', 'a food group', 'a medication',
  'a vitamin', 'roast',
  'vitamin', 'hormone', 'enzyme', 'antibody',
])

/**
 * Check if a distractor is in the known garbage set (normalized).
 * Garbage distractors are generic template words that appear 100+ times
 * and make questions trivially easy because they're obviously unrelated.
 * @param {string} text - The distractor text to check
 * @returns {boolean} True if the text is a known garbage distractor
 */
export function isGarbageDistractor(text) {
  return GARBAGE_DISTRACTORS.has(normalizeText(text))
}

/**
 * Check if a distractor is either a placeholder or garbage distractor.
 * @param {string} text - The distractor text to check
 * @returns {boolean} True if the text is placeholder or garbage
 */
export function isBadDistractor(text) {
  return isPlaceholderDistractor(text) || isGarbageDistractor(text)
}

/**
 * Check if the answer appears verbatim in the question text.
 * This is a common quality issue that makes questions trivially easy.
 * Filters out short answers (< 5 chars) to avoid false positives.
 * @param {string} question - The question text
 * @param {string} answer - The answer text
 * @returns {boolean} True if the answer appears in the question
 */
export function hasAnswerInQuestion(question, answer) {
  const qNorm = normalizeText(question)
  const aNorm = normalizeText(answer)
  if (!aNorm || aNorm.length < 5) return false
  return qNorm.includes(aNorm)
}
