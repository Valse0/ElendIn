import type { Dimension, Severity } from '../types/index.ts';

/**
 * Single source of truth for every tunable number in the analysis.
 * Nothing else in the engine hard-codes a weight, threshold or cap.
 */

export const ENGINE_VERSION = '0.2.0-beta.1';

export const SCORING_CONFIG = {
  base: 100,
  /** Points a finding costs at full intensity. */
  severityPoints: { critical: 18, medium: 8, low: 3 } satisfies Record<Severity, number>,
  /** A finding never costs less than this share of its severity points. */
  intensityFloor: 0.35,
  /** Maximum total deduction per dimension (prevents one area from sinking the score alone). */
  dimensionCaps: { jobMatch: 50, structure: 20, language: 25, consistency: 15 } satisfies Record<Dimension, number>,
} as const;

export const INPUT_LIMITS = {
  /** Fewer words than this and the CV is treated as unreadable / too short to analyse. */
  minCvWords: 60,
  minJobWords: 25,
  minJobChars: 150,
  maxCvPages: 15,
  maxFileBytes: 10 * 1024 * 1024,
} as const;

export const THRESHOLDS = {
  /** Required-skill coverage (weighted 0..1) */
  coverage: {
    /** Critical needs at least this many EXPLICITLY required items … */
    criticalMinRequired: 4,
    /** … and coverage below this ratio. */
    criticalBelow: 0.35,
    mediumBelow: 0.75,
  },
  experience: {
    /** CV dated experience at or above this share of the requirement counts as demonstrated. */
    okRatio: 0.9,
    /** Below this share (and requirement >= minYearsForCritical) the shortfall is critical. */
    criticalRatio: 0.5,
    minYearsForCritical: 2,
  },
  cliche: {
    lowFrom: 10,
    mediumFrom: 20,
    /** Density this high is described as "high concentration" in the copy. */
    highFrom: 30,
    /** Intensity saturates at this density. */
    intensityAt: 50,
    summaryShare: 0.5,
    /** Fewer prose sentences than this and the density is reported as 'not enough text'. */
    minSentences: 4,
    /** A single-word cliché only counts in sentences at most this long and without numbers. */
    singleWordMaxTokens: 14,
  },
  vague: { mediumFrom: 3 },
  dates: {
    gapMonths: 6,
    minExperienceLinesForNoDates: 6,
    defaultStartMonth: 7,
    defaultEndMonth: 6,
  },
  layout: {
    /** Items needed on each side of the gutter before we call it two columns. */
    minItemsPerSide: 5,
    gutterMinBins: 3,
    interleaveMinSwitches: 6,
    interleaveRatio: 0.1,
  },
  glyphSpacing: { minLines: 2 },
} as const;

/** Share of a requirement's weight given for each match status. */
export const MATCH_CREDIT = {
  found: 1,
  alias: 1,
  fuzzy: 0.9,
  related: 0.6,
  missing: 0,
} as const;

/** Weight of a requirement when computing weighted coverage. */
export const PRIORITY_WEIGHT = {
  required: 1,
  unspecified: 0.8,
  preferred: 0,
} as const;
