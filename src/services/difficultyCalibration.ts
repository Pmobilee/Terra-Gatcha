/**
 * Difficulty Calibration Service
 *
 * Pure logic service for managing per-domain difficulty distributions
 * based on global knowledge level, manual overrides, and auto-calibration
 * from run accuracy data.
 */

// ---------------------------------------------------------------------------
// Constants (will be moved to ../data/balance.ts and imported later)
// ---------------------------------------------------------------------------

const AUTO_CALIBRATE_MAX_OFFSET = 0.20;
const AUTO_CALIBRATE_STEP = 0.05;
const AUTO_CALIBRATE_ACCURACY_HIGH = 80;
const AUTO_CALIBRATE_ACCURACY_LOW = 50;

/** Minimum sample size before auto-calibration kicks in for a domain. */
const AUTO_CALIBRATE_MIN_ANSWERS = 5;

/** Floor/ceiling for any single distribution bucket after adjustment. */
const DIST_CLAMP_MIN = 0.05;
const DIST_CLAMP_MAX = 0.90;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Global knowledge level set during first launch. */
export type KnowledgeLevel = 'casual' | 'normal' | 'scholar';

/** Per-domain difficulty distribution (percentages must sum to ~1.0). */
export interface DifficultyDistribution {
  easyPct: number;   // fraction for difficulty 1-2
  mediumPct: number;  // fraction for difficulty 3
  hardPct: number;    // fraction for difficulty 4-5
}

/** Per-domain calibration data stored in PlayerSave. */
export interface DomainCalibration {
  /** Manual override: player-set preference (null = use global). */
  manualLevel: KnowledgeLevel | null;
  /** Auto-calibrate offset applied to easy/hard percentages. Range: -0.20 to +0.20. */
  autoOffset: number;
  /** Last run accuracy for this domain (0-100). */
  lastAccuracy: number | null;
  /** Number of runs contributing to this domain's calibration. */
  calibrationRuns: number;
}

/** Full calibration state stored in PlayerSave. */
export interface CalibrationState {
  globalLevel: KnowledgeLevel;
  autoCalibrate: boolean;
  hasSeenAutoCalibExplanation: boolean;
  domains: Record<string, DomainCalibration>;
}

// ---------------------------------------------------------------------------
// Preset distributions
// ---------------------------------------------------------------------------

export const KNOWLEDGE_LEVEL_DISTRIBUTIONS: Record<KnowledgeLevel, DifficultyDistribution> = {
  casual: { easyPct: 0.55, mediumPct: 0.35, hardPct: 0.10 },
  normal: { easyPct: 0.30, mediumPct: 0.45, hardPct: 0.25 },
  scholar: { easyPct: 0.15, mediumPct: 0.35, hardPct: 0.50 },
};

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/** Clamp a number to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Normalize three bucket values so they sum to 1.0 while preserving ratios. */
function normalizeDistribution(easy: number, medium: number, hard: number): DifficultyDistribution {
  const sum = easy + medium + hard;
  if (sum === 0) {
    return { easyPct: 1 / 3, mediumPct: 1 / 3, hardPct: 1 / 3 };
  }
  return {
    easyPct: easy / sum,
    mediumPct: medium / sum,
    hardPct: hard / sum,
  };
}

/** Create a default DomainCalibration entry. */
function createDefaultDomainCalibration(): DomainCalibration {
  return {
    manualLevel: null,
    autoOffset: 0,
    lastAccuracy: null,
    calibrationRuns: 0,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a fresh calibration state with sensible defaults.
 * Used when no saved calibration exists (first launch).
 */
export function createDefaultCalibrationState(): CalibrationState {
  return {
    globalLevel: 'normal',
    autoCalibrate: false,
    hasSeenAutoCalibExplanation: false,
    domains: {},
  };
}

/**
 * Return the preset difficulty distribution for a given knowledge level.
 */
export function getBaseDistribution(level: KnowledgeLevel): DifficultyDistribution {
  return { ...KNOWLEDGE_LEVEL_DISTRIBUTIONS[level] };
}

/**
 * Resolve the effective difficulty distribution for a specific domain,
 * taking into account manual overrides and auto-calibration offsets.
 *
 * Resolution priority:
 * 1. Domain manual level override (if set)
 * 2. Global knowledge level (fallback)
 * 3. Auto-calibration offset (if enabled and domain has data)
 * 4. Clamp all buckets to [0.05, 0.90]
 * 5. Normalize so buckets sum to 1.0
 */
export function resolveDistributionForDomain(
  domain: string,
  state: CalibrationState,
): DifficultyDistribution {
  const domainCal = state.domains[domain];

  // Step 1-2: pick base level
  const level = domainCal?.manualLevel ?? state.globalLevel;
  const base = getBaseDistribution(level);

  let { easyPct, mediumPct, hardPct } = base;

  // Step 3: apply auto-calibration offset
  if (state.autoCalibrate && domainCal && domainCal.autoOffset !== 0) {
    easyPct -= domainCal.autoOffset;   // positive offset → less easy → harder
    hardPct += domainCal.autoOffset;
    mediumPct = 1.0 - easyPct - hardPct;
  }

  // Step 4: clamp each bucket
  easyPct = clamp(easyPct, DIST_CLAMP_MIN, DIST_CLAMP_MAX);
  mediumPct = clamp(mediumPct, DIST_CLAMP_MIN, DIST_CLAMP_MAX);
  hardPct = clamp(hardPct, DIST_CLAMP_MIN, DIST_CLAMP_MAX);

  // Step 5: normalize to sum to 1.0
  return normalizeDistribution(easyPct, mediumPct, hardPct);
}

/**
 * Update auto-calibration offsets based on accuracy data from a completed run.
 *
 * For each domain with sufficient data (>= 5 answers):
 * - Accuracy > 80%: shift offset toward harder (+0.05)
 * - Accuracy < 50%: shift offset toward easier (-0.05)
 * - Otherwise: no change
 *
 * Returns a new CalibrationState (immutable update).
 */
export function updateAutoCalibration(
  domainAccuracy: Record<string, { answered: number; correct: number }>,
  state: CalibrationState,
): CalibrationState {
  const updatedDomains = { ...state.domains };

  for (const [domain, stats] of Object.entries(domainAccuracy)) {
    // Skip domains with insufficient data
    if (stats.answered < AUTO_CALIBRATE_MIN_ANSWERS) {
      continue;
    }

    const accuracy = (stats.correct / stats.answered) * 100;
    const existing = updatedDomains[domain] ?? createDefaultDomainCalibration();

    let newOffset = existing.autoOffset;

    if (accuracy > AUTO_CALIBRATE_ACCURACY_HIGH) {
      newOffset += AUTO_CALIBRATE_STEP;
    } else if (accuracy < AUTO_CALIBRATE_ACCURACY_LOW) {
      newOffset -= AUTO_CALIBRATE_STEP;
    }

    newOffset = clamp(newOffset, -AUTO_CALIBRATE_MAX_OFFSET, AUTO_CALIBRATE_MAX_OFFSET);

    updatedDomains[domain] = {
      ...existing,
      autoOffset: newOffset,
      lastAccuracy: accuracy,
      calibrationRuns: existing.calibrationRuns + 1,
    };
  }

  return {
    ...state,
    domains: updatedDomains,
  };
}

/**
 * Set the global knowledge level. Returns a new CalibrationState.
 */
export function setGlobalKnowledgeLevel(
  level: KnowledgeLevel,
  state: CalibrationState,
): CalibrationState {
  return {
    ...state,
    globalLevel: level,
  };
}

/**
 * Set or clear a manual difficulty override for a specific domain.
 * Pass `null` to reset the domain to use the global level.
 * Returns a new CalibrationState.
 */
export function setDomainManualLevel(
  domain: string,
  level: KnowledgeLevel | null,
  state: CalibrationState,
): CalibrationState {
  const existing = state.domains[domain] ?? createDefaultDomainCalibration();

  return {
    ...state,
    domains: {
      ...state.domains,
      [domain]: {
        ...existing,
        manualLevel: level,
      },
    },
  };
}

/**
 * Enable or disable auto-calibration globally. Returns a new CalibrationState.
 */
export function setAutoCalibrate(
  enabled: boolean,
  state: CalibrationState,
): CalibrationState {
  return {
    ...state,
    autoCalibrate: enabled,
  };
}
