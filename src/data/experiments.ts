/**
 * A/B experiment definitions (Phase 41.2).
 * Each experiment has a unique key, two or more variant labels, and a
 * primary metric used to judge success.
 *
 * Experiments are referenced by key everywhere — never by index — so adding or
 * removing experiments never silently shifts bucket assignments.
 */

export interface ExperimentDef {
  /** Unique stable identifier — never rename once launched. */
  key: string
  /** Human-readable name for the dashboard. */
  name: string
  /** Variant labels.  First entry is always the control. */
  variants: [string, string, ...string[]]
  /** The analytics event property used to judge success (e.g. "iap_purchase_completed"). */
  primaryMetric: string
  /** Optional description explaining the hypothesis. */
  hypothesis?: string
}

export const EXPERIMENTS: ExperimentDef[] = [
  {
    key: 'pioneer_pack_timing_v2',
    name: 'Pioneer Pack — offer timing',
    variants: ['control_dive_3', 'treatment_dive_1'],
    primaryMetric: 'iap_purchase_completed',
    hypothesis: 'Showing the pack after dive 1 (while excitement is high) increases conversion vs dive 3.',
  },
  {
    key: 'quiz_button_layout_v1',
    name: 'Quiz — answer button layout',
    variants: ['stacked_2x2', 'list_4x1'],
    primaryMetric: 'quiz_answered',
    hypothesis: 'A 2×2 grid increases taps per session by reducing scroll distance.',
  },
  {
    key: 'onboarding_length_v1',
    name: 'Onboarding — tutorial length',
    variants: ['full_5_panel', 'condensed_3_panel'],
    primaryMetric: 'first_dive_complete',
    hypothesis: 'A shorter cutscene reduces drop-off before the first dive.',
  },
  {
    key: 'terra_pass_modal_copy_v1',
    name: 'Terra Pass — CTA copy',
    variants: ['control_explore_more', 'treatment_unlock_earth'],
    primaryMetric: 'iap_purchase_completed',
    hypothesis: '"Unlock Earth\'s story" framing outperforms "Explore more" on conversion.',
  },
]

export type ExperimentKey = (typeof EXPERIMENTS)[number]['key']
