/**
 * Server-side feature flags — static configuration object.
 * Controls feature rollout and A/B testing.
 *
 * @deprecated (Phase 41.1) — Use the database-backed `featureFlagService` instead.
 * This static object is kept for backwards compatibility and will be removed once
 * all callers have been migrated to `resolveFlag()` / `resolveAllFlags()` from
 * `server/src/services/featureFlagService.ts`.
 */

export const FEATURES = {
  /** Opt-in rewarded ads — disabled at launch (DD-V2-146) */
  REWARDED_ADS: false,

  /** Terra Pass subscriptions — gated on 3,000 facts (DD-V2-154) */
  SUBSCRIPTIONS_ENABLED: false,

  /** Season pass system */
  SEASON_PASS_ENABLED: true,

  /** Pioneer Pack offer */
  PIONEER_PACK_ENABLED: true,

  /** A/B test: pioneer pack timing */
  AB_PIONEER_PACK_TIMING: true,

  /** Patron tier features */
  PATRON_FEATURES_ENABLED: true,

  /** Economy: dome maintenance costs */
  DOME_MAINTENANCE_ENABLED: true,

  /** Economy: spending bonus */
  SPENDING_BONUS_ENABLED: true,
} as const

export type FeatureFlag = keyof typeof FEATURES
