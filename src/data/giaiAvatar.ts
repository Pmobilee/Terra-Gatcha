/**
 * GIAI visual identity — expression states and metadata.
 * All avatar presentation is emoji-based; no image assets required.
 */

export interface GiaiExpression {
  id: string
  /** Primary emoji used to represent this expression */
  emoji: string
  label: string
}

/** All available GIAI expression states */
export const GIAI_EXPRESSIONS: Record<string, GiaiExpression> = {
  neutral:   { id: 'neutral',   emoji: '🤖', label: 'Neutral' },
  happy:     { id: 'happy',     emoji: '😊', label: 'Happy' },
  excited:   { id: 'excited',   emoji: '🤩', label: 'Excited' },
  thinking:  { id: 'thinking',  emoji: '🤔', label: 'Thinking' },
  worried:   { id: 'worried',   emoji: '😟', label: 'Worried' },
  proud:     { id: 'proud',     emoji: '😤', label: 'Proud' },
  snarky:    { id: 'snarky',    emoji: '😏', label: 'Snarky' },
  surprised: { id: 'surprised', emoji: '😲', label: 'Surprised' },
}

/** Maps known trigger names to an expression id. */
const EXPRESSION_MAP: Record<string, string> = {
  mine_entry:      'excited',
  mineEntry:       'excited',
  depth_25:        'neutral',
  depthMilestone25: 'neutral',
  depth_50:        'thinking',
  depthMilestone50: 'thinking',
  depth_75:        'worried',
  depthMilestone75: 'worried',
  low_oxygen:      'worried',
  lowOxygen:       'worried',
  exit_reached:    'happy',
  exitReached:     'happy',
  artifact_found:  'surprised',
  artifactFound:   'surprised',
  upgrade_found:   'excited',
  descent_shaft:   'thinking',
  cave_in:         'worried',
  caveIn:          'worried',
  earthquake:      'worried',
  fossil_found:    'excited',
  relic_found:     'proud',
  quiz_correct:    'happy',
  quiz_wrong:      'thinking', // overridden below for snarky mood
  idle:            'neutral',  // overridden below for snarky mood
}

/**
 * Resolve the GIAI expression for a given trigger and current mood.
 * Falls back to `neutral` for unknown triggers.
 *
 * @param trigger - Event/trigger name (camelCase or snake_case both work)
 * @param mood    - Current player-selected GIAI mood
 */
export function getGiaiExpression(trigger: string, mood: string): GiaiExpression {
  let exprId = EXPRESSION_MAP[trigger] ?? 'neutral'

  // Mood-based overrides for neutral/ambiguous triggers
  if ((trigger === 'quiz_wrong' || trigger === 'idle') && mood === 'snarky') {
    exprId = 'snarky'
  }

  return GIAI_EXPRESSIONS[exprId] ?? GIAI_EXPRESSIONS.neutral
}

/** Short display name shown in UI headers */
export const GIAI_NAME = 'G.I.A.I.'

/** Full expanded name shown in tooltip / About section */
export const GIAI_FULL_NAME = 'Geological Intelligence & Analytical Interface'

/** One-line tagline shown below the full name */
export const GIAI_TAGLINE = 'Your AI companion, since the crash...'
