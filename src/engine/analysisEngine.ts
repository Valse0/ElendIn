import type {
  AnalysisErrorCode,
  AnalysisResult,
  AnalysisSummary,
  AnalysisWarning,
  CvDocument,
  Finding,
  ImprovementSummary,
  RequirementReport,
  SectionKey,
} from '../types/index.ts';
import { buildCvIndex, matchRequirement } from '../lib/matching/matcher.ts';
import type { RequirementMatch } from '../lib/matching/matcher.ts';
import { ENGINE_VERSION, INPUT_LIMITS, PRIORITY_WEIGHT } from './config.ts';
import { parseCv } from './cvParser.ts';
import { EDUCATION_RANK } from './lexicon.ts';
import { buildRequirementReport } from './evidenceExtractor.ts';
import { inspectorInfo, runInspectors } from './inspectors/index.ts';
import { scanCliches } from './inspectors/copypaste.ts';
import type { InspectorContext } from './inspectors/types.ts';
import { parseJobDescription } from './jobDescriptionParser.ts';
import { scoreFindings } from './scoringEngine.ts';
import { activeLanguages, detectLanguage, splitSentences, wordCount } from './text.ts';

/**
 * UI-independent entry point. Pure function of (CvDocument, job text, clock):
 * same input ⇒ same output, no I/O, safe to run in a Web Worker.
 */

export class AnalysisError extends Error {
  code: AnalysisErrorCode;
  constructor(code: AnalysisErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AnalysisError';
    this.code = code;
  }
}

export interface AnalyzeOptions {
  /** Injected clock (tests / reproducibility). */
  now?: Date;
}

const SEV_ORDER = { critical: 0, medium: 1, low: 2 } as const;
const SECTION_ORDER: SectionKey[] = ['summary', 'experience', 'skills', 'education', 'languages', 'certifications', 'projects', 'other'];

export function validateInputs(cv: CvDocument | null | undefined, jobText: string): void {
  if (!cv) throw new AnalysisError('CV_MISSING');
  if (cv.status === 'no_text') throw new AnalysisError('CV_NO_TEXT');
  if (wordCount(cv.fullText) < INPUT_LIMITS.minCvWords) throw new AnalysisError('CV_TOO_SHORT');
  const trimmed = jobText.trim();
  if (!trimmed) throw new AnalysisError('JOB_EMPTY');
  if (trimmed.length < INPUT_LIMITS.minJobChars || wordCount(trimmed) < INPUT_LIMITS.minJobWords) throw new AnalysisError('JOB_TOO_SHORT');
}

export function analyze(cv: CvDocument, jobText: string, opts: AnalyzeOptions = {}): AnalysisResult {
  validateInputs(cv, jobText);
  const now = opts.now ?? new Date();

  try {
    const job = parseJobDescription(jobText);
    const parsed = parseCv(cv, now);
    const idx = buildCvIndex(cv.lines);
    const sentences = splitSentences(cv.lines);
    const langGuess = detectLanguage(cv.fullText);
    const cvLanguages = activeLanguages(langGuess);

    // Requirement ↔ CV matching (education is judged against degree rank; language distinguishes explicit CEFR proof from proficiency claims)
    const matches = new Map<string, RequirementMatch>();
    const requirements: RequirementReport[] = job.requirements.map((req) => {
      let match: RequirementMatch;
      if (req.kind === 'education' && req.meta) {
        const ok = parsed.educationRank >= EDUCATION_RANK[req.meta as keyof typeof EDUCATION_RANK];
        match = { requirementId: req.id, status: ok ? 'found' : 'missing', credit: ok ? 1 : 0, lineIndex: null, matchedTerm: null };
      } else if (req.kind === 'language') {
        const base = matchRequirement(req, idx);
        if (base.status === 'missing') {
          match = base;
        } else {
          const metaStr = typeof req.meta === 'string' ? req.meta : '';
          const line = base.lineIndex !== null ? idx.foldedLines[base.lineIndex] : idx.foldedFull;
          if (metaStr.includes(':')) {
            const reqLevel = metaStr.split(':')[1]?.toLowerCase();
            const hasExactOrHigher = new RegExp(`\\b(${reqLevel}|b2|c1|c2|fluent|fluency|advanced|ileri|anadil|native)\\b`, 'i').test(line);
            const isClaimOnly = /\b(intermediate|orta|intermedio|basic|temel|beginner)\b/i.test(line);
            if (hasExactOrHigher) {
              match = { ...base, status: 'found', credit: 1 };
            } else if (isClaimOnly) {
              match = { ...base, status: 'related', credit: 0.6 };
            } else {
              match = { ...base, status: 'related', credit: 0.6 };
            }
          } else {
            match = base;
          }
        }
      } else {
        match = matchRequirement(req, idx);
      }
      matches.set(req.id, match);
      return buildRequirementReport(req, match, cv.lines);
    });

    const ctx: InspectorContext = { cv, parsed, idx, job, matches, requirements, cvLanguages, sentences, now };
    const raw = runInspectors(ctx);

    const weighted = requirements.filter((r) => (r.kind === 'skill' || r.kind === 'certification') && PRIORITY_WEIGHT[r.priority] > 0);
    const scoring = scoreFindings(raw, { jobMatchAvailable: weighted.length > 0 });

    // Order: severity, then counted points, neutral last
    const points = new Map(scoring.deductions.map((d) => [d.findingId, d.points]));
    const findings = [...raw].sort((a, b) => {
      if (a.neutral !== b.neutral) return a.neutral ? 1 : -1;
      if (a.severity !== b.severity) return SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
      return (points.get(b.id) ?? 0) - (points.get(a.id) ?? 0);
    });

    const scan = scanCliches(sentences, cvLanguages);
    const summary = buildSummary(findings, requirements, scan.clicheSentences, scan.sentencesAnalyzed, scan.density);
    const improvement = buildImprovement(findings, scoring.deductions, requirements);

    const warnings: AnalysisWarning[] = [];
    if (job.requirements.length === 0) warnings.push('no_requirements_detected');
    else if (job.requirements.every((r) => r.priority === 'unspecified')) warnings.push('priorities_not_explicit');
    if (cv.truncated) warnings.push('cv_truncated');
    if (cv.emptyPages.length > 0) warnings.push('empty_pages');
    if (job.language !== langGuess.lang) warnings.push('job_language_differs');

    return {
      engineVersion: ENGINE_VERSION,
      generatedAt: now.toISOString(),
      cvLanguages,
      job: {
        title: job.title,
        language: job.language,
        seniority: job.seniority,
        yearsRequired: job.yearsRequired,
        requirementCount: job.requirements.length,
        hasExplicitSections: job.hasExplicitSections,
      },
      findings,
      requirements,
      cliches: scan.hits,
      scoring,
      summary,
      improvement,
      inspectors: inspectorInfo(findings),
      warnings,
    };
  } catch (e) {
    if (e instanceof AnalysisError) throw e;
    const err = new AnalysisError('ANALYSIS_FAILED', e instanceof Error ? e.message : String(e));
    throw err;
  }
}

function buildSummary(
  findings: Finding[],
  reqs: RequirementReport[],
  clicheSentences: number,
  sentencesAnalyzed: number,
  density: number | null,
): AnalysisSummary {
  const real = findings.filter((f) => !f.neutral);
  const isFound = (r: RequirementReport) => r.status === 'found' || r.status === 'alias' || r.status === 'fuzzy';
  const nonPreferred = reqs.filter((r) => r.priority !== 'preferred');
  return {
    critical: real.filter((f) => f.severity === 'critical').length,
    medium: real.filter((f) => f.severity === 'medium').length,
    low: real.filter((f) => f.severity === 'low').length,
    neutral: findings.filter((f) => f.neutral).length,
    requirementsTotal: reqs.length,
    requirementsFound: reqs.filter(isFound).length,
    requirementsPartial: reqs.filter((r) => r.status === 'related').length,
    requirementsMissing: reqs.filter((r) => r.status === 'missing').length,
    requiredTotal: nonPreferred.length,
    requiredFound: nonPreferred.filter(isFound).length,
    clicheDensity: density,
    sentencesAnalyzed,
    clicheSentences,
  };
}

function buildImprovement(findings: Finding[], deductions: { findingId: string; points: number }[], reqs: RequirementReport[]): ImprovementSummary {
  const pts = new Map(deductions.map((d) => [d.findingId, d.points]));
  const actionable = findings.filter((f) => !f.neutral && (pts.get(f.id) ?? 0) > 0);
  // Biggest honestly-recoverable gain first; issues the user cannot edit away rank by size only as a fallback.
  const ranked = [...actionable].sort((a, b) => (pts.get(b.id) ?? 0) * b.fixability - (pts.get(a.id) ?? 0) * a.fixability);
  const first = ranked.find((f) => f.fixability > 0.2) ?? ranked[0] ?? null;

  const sections = new Set<SectionKey>();
  for (const f of actionable) f.sections.forEach((s) => sections.add(s));

  return {
    firstFixId: first ? first.id : null,
    requirementsNeedingEvidence: reqs.filter((r) => r.status === 'missing' || r.status === 'related').slice(0, 8).map((r) => r.label),
    sectionsToReview: SECTION_ORDER.filter((s) => sections.has(s)),
  };
}
