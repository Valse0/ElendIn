import type { Severity, SectionKey } from '../types/index.ts';
import { THRESHOLDS } from './config.ts';

/**
 * Severity rules in one place. Every function is pure and returns the severity, how hard the
 * measured value breaches the rule (intensity 0..1) and — for CRITICAL only — the i18n key that
 * justifies the rating. CRITICAL is deliberately rare: it needs several independent signals,
 * never a single missing keyword.
 */

export interface Decision {
  severity: Severity;
  intensity: number;
  justificationKey: string | null;
}

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

export function classifyRequiredCoverage(i: {
  explicitRequired: number;
  missing: number;
  coverage: number;
}): Decision {
  const intensity = clamp(1 - i.coverage, 0.25, 1);
  const c = THRESHOLDS.coverage;
  if (i.explicitRequired >= c.criticalMinRequired && i.coverage < c.criticalBelow) {
    return { severity: 'critical', intensity, justificationKey: 'finding.ats.required-coverage.critical' };
  }
  if (i.coverage < c.mediumBelow || i.missing >= 2) return { severity: 'medium', intensity, justificationKey: null };
  return { severity: 'low', intensity, justificationKey: null };
}

export type ExperienceOutcome =
  | { kind: 'ok' }
  | { kind: 'short'; decision: Decision }
  | { kind: 'unverified'; decision: Decision };

/** Compare dated experience in the CV with the years the listing asks for. */
export function classifyExperience(i: { required: number; computed: number; claimed: number }): ExperienceOutcome {
  const e = THRESHOLDS.experience;
  if (i.required <= 0) return { kind: 'ok' };
  if (i.computed >= i.required * e.okRatio) return { kind: 'ok' };
  if (i.computed === 0) {
    // Nothing dated to measure: either a claim without dates, or nothing at all.
    return { kind: 'unverified', decision: { severity: i.claimed >= i.required ? 'low' : 'medium', intensity: 0.5, justificationKey: null } };
  }
  const ratio = i.computed / i.required;
  const intensity = clamp(1 - ratio, 0.3, 1);
  if (ratio < e.criticalRatio && i.required >= e.minYearsForCritical) {
    return { kind: 'short', decision: { severity: 'critical', intensity, justificationKey: 'finding.ats.experience-short.critical' } };
  }
  return { kind: 'short', decision: { severity: 'medium', intensity, justificationKey: null } };
}

export function classifyLanguages(i: { requiredMissing: number; otherMissing: number }): Decision {
  if (i.requiredMissing > 0) return { severity: 'medium', intensity: clamp(i.requiredMissing / 2, 0.5, 1), justificationKey: null };
  return { severity: 'low', intensity: clamp(i.otherMissing / 2, 0.4, 1), justificationKey: null };
}

export function classifyEducation(explicitRequired: boolean): Decision {
  return { severity: explicitRequired ? 'medium' : 'low', intensity: 0.6, justificationKey: null };
}

export function classifyDateFormats(distinct: number): Decision {
  return { severity: distinct >= 3 ? 'medium' : 'low', intensity: clamp(distinct / 3, 0.4, 1), justificationKey: null };
}

export function classifySections(missing: SectionKey[], foundCount: number): Decision {
  if (foundCount === 0) return { severity: 'medium', intensity: 1, justificationKey: null };
  if (missing.includes('experience')) return { severity: 'medium', intensity: 0.7, justificationKey: null };
  return { severity: 'low', intensity: clamp(missing.length / 3, 0.4, 1), justificationKey: null };
}

export function classifyClicheDensity(density: number): Decision | null {
  const c = THRESHOLDS.cliche;
  if (density < c.lowFrom) return null;
  const intensity = clamp(density / c.intensityAt);
  return { severity: density >= c.mediumFrom ? 'medium' : 'low', intensity, justificationKey: null };
}

export function classifyVague(count: number): Decision | null {
  if (count <= 0) return null;
  return { severity: count >= THRESHOLDS.vague.mediumFrom ? 'medium' : 'low', intensity: clamp(count / 6, 0.35, 1), justificationKey: null };
}
