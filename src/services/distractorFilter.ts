/**
 * Runtime filter for placeholder/garbage distractors that should never reach the player.
 * Keep in sync with the Node-side regex in scripts/content-pipeline/qa/shared.mjs
 */
const PLACEHOLDER_RE = /^(alternative option \d+|alternative \d+|option [a-z\d]+|distractor \d+|unknown option \d*|unknown option|not applicable|invalid answer|unrelated concept|incorrect claim|false statement|similar concept|related term|alternative word|different word|misleading choice|incorrect term|unrelated option|alternative theory|related concept|other meaning|alternative sense|another option|additional meaning|related idea|another word|different meaning|similar term|plausible option.*|wrong answer|test option|placeholder|sample answer|alternative|unrelated|incorrect|invalid|misleading|sample|unknown)$/i

/** Returns true if the distractor text is obviously placeholder/generated garbage. */
export function isPlaceholderDistractor(text: string): boolean {
  return PLACEHOLDER_RE.test(text.trim())
}
