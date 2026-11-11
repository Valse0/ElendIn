import type { Deduction, Dimension, Finding, ScoringResult } from '../types/index.ts';
import { SCORING_CONFIG } from './config.ts';

/**
 * Deterministic, explainable score.
 *
 *   points(finding) = severityPoints[severity] × max(intensityFloor, intensity)
 *
 * - Neutral findings never cost points.
 * - Findings sharing a `dedupGroup` describe the same underlying issue: only the costliest counts.
 * - Each dimension is capped, and over-cap totals are scaled down proportionally.
 * - `potentialScore` simulates honest fixes: it only recovers `fixability` × points. Things the
 *   user cannot change by editing (e.g. too little dated experience) stay deducted.
 */

const DIMENSIONS: Dimension[] = ['jobMatch', 'structure', 'language', 'consistency'];
const round1 = (n: number) => Math.round(n * 10) / 10;

export function rawPoints(f: Finding): number {
  if (f.neutral) return 0;
  const intensity = Math.min(1, Math.max(SCORING_CONFIG.intensityFloor, f.intensity));
  return SCORING_CONFIG.severityPoints[f.severity] * intensity;
}

export function scoreFindings(findings: Finding[], opts: { jobMatchAvailable: boolean }): ScoringResult {
  const raws = findings.map((f) => ({ f, raw: rawPoints(f) }));

  // 1. dedup groups: keep the single costliest member of each group
  const winners = new Map<string, { id: string; raw: number }>();
  for (const { f, raw } of raws) {
    if (!f.dedupGroup || f.neutral) continue;
    const cur = winners.get(f.dedupGroup);
    if (!cur || raw > cur.raw) winners.set(f.dedupGroup, { id: f.id, raw });
  }

  const counted = raws.map(({ f, raw }) => {
    if (f.dedupGroup && !f.neutral) {
      const w = winners.get(f.dedupGroup)!;
      if (w.id !== f.id) return { f, raw, counted: 0, dedupedBy: w.id };
    }
    return { f, raw, counted: raw, dedupedBy: null as string | null };
  });

  // 2. dimension caps
  const dimensions = {} as ScoringResult['dimensions'];
  for (const d of DIMENSIONS) {
    const sum = counted.filter((c) => c.f.dimension === d).reduce((s, c) => s + c.counted, 0);
    const cap = SCORING_CONFIG.dimensionCaps[d];
    dimensions[d] = { raw: round1(sum), counted: round1(Math.min(sum, cap)), cap };
  }

  const deductions: Deduction[] = counted.map(({ f, raw, counted: c, dedupedBy }) => {
    const dim = dimensions[f.dimension];
    const factor = dim.raw > dim.cap && dim.raw > 0 ? dim.cap / dim.raw : 1;
    return {
      findingId: f.id,
      severity: f.severity,
      dimension: f.dimension,
      rawPoints: round1(raw),
      points: round1(c * factor),
      dedupedBy,
    };
  });

  const totalDeducted = DIMENSIONS.reduce((s, d) => s + dimensions[d].counted, 0);
  const score = Math.max(0, Math.round(SCORING_CONFIG.base - totalDeducted));

  let recovered = 0;
  for (const d of deductions) {
    const f = findings.find((x) => x.id === d.findingId)!;
    recovered += d.points * f.fixability;
  }
  const potentialScore = Math.min(SCORING_CONFIG.base, Math.max(score, Math.round(SCORING_CONFIG.base - totalDeducted + recovered)));

  return { score, potentialScore, partial: !opts.jobMatchAvailable, deductions, dimensions };
}
