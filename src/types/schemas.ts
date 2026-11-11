import { z } from 'zod';
import type { AnalysisResult, CvDocument } from './index.ts';

/**
 * Runtime validation at the two boundaries where data crosses a trust or thread boundary:
 *   1. CvDocument going into the analysis worker
 *   2. AnalysisResult coming back out
 * Only the basic zod API is used (object / enum / array / record / union / nullable), which behaves
 * the same in zod 3.25 and zod 4.
 */

const lang = z.enum(['tr', 'en', 'es']);
const severity = z.enum(['critical', 'medium', 'low']);
const inspectorId = z.enum(['ats', 'hr', 'murat', 'security', 'benchmarker', 'copypaste']);
const dimension = z.enum(['jobMatch', 'structure', 'language', 'consistency']);
const sectionKey = z.enum(['summary', 'experience', 'education', 'skills', 'languages', 'certifications', 'projects', 'other']);
const param = z.union([z.string(), z.number()]);
const params = z.record(z.string(), param);

export const ExtractedPageSchema = z.object({
  pageNumber: z.number(),
  width: z.number(),
  height: z.number(),
  lines: z.array(z.string()),
  text: z.string(),
  charCount: z.number(),
  hasText: z.boolean(),
  columnCount: z.union([z.literal(1), z.literal(2)]),
  gutterX: z.number().nullable(),
  interleaved: z.boolean(),
  sideSwitches: z.number(),
});

export const CvDocumentSchema = z.object({
  fileName: z.string(),
  pageCount: z.number(),
  pages: z.array(ExtractedPageSchema),
  truncated: z.boolean(),
  emptyPages: z.array(z.number()),
  lines: z.array(z.string()),
  fullText: z.string(),
  status: z.enum(['ok', 'no_text']),
});

const evidence = z.object({
  source: z.enum(['cv', 'job']),
  text: z.string(),
  label: z.string().optional(),
  page: z.number().optional(),
});

export const FindingSchema = z.object({
  id: z.string(),
  inspector: inspectorId,
  dimension,
  severity,
  neutral: z.boolean(),
  intensity: z.number(),
  fixability: z.number(),
  dedupGroup: z.string().nullable(),
  params,
  evidence: z.array(evidence),
  justificationKey: z.string().nullable(),
  beforeAfter: z
    .object({ before: z.string().nullable(), afterKey: z.string(), afterParams: params })
    .nullable(),
  sections: z.array(sectionKey),
});

const dimBucket = z.object({ raw: z.number(), counted: z.number(), cap: z.number() });

export const AnalysisResultSchema = z.object({
  engineVersion: z.string(),
  generatedAt: z.string(),
  cvLanguages: z.array(lang),
  job: z.object({
    title: z.string().nullable(),
    language: lang,
    seniority: z.enum(['junior', 'mid', 'senior', 'lead', 'unknown']),
    yearsRequired: z.object({ min: z.number(), max: z.number().nullable() }).nullable(),
    requirementCount: z.number(),
    hasExplicitSections: z.boolean(),
  }),
  findings: z.array(FindingSchema),
  requirements: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      kind: z.enum(['skill', 'language', 'education', 'certification']),
      priority: z.enum(['required', 'preferred', 'unspecified']),
      status: z.enum(['found', 'alias', 'fuzzy', 'related', 'missing']),
      credit: z.number(),
      evidence: z.string().nullable(),
    }),
  ),
  cliches: z.array(z.object({ sentence: z.string(), phrase: z.string(), match: z.enum(['exact', 'similar']), lang })),
  scoring: z.object({
    score: z.number(),
    potentialScore: z.number(),
    partial: z.boolean(),
    deductions: z.array(
      z.object({
        findingId: z.string(),
        severity,
        dimension,
        rawPoints: z.number(),
        points: z.number(),
        dedupedBy: z.string().nullable(),
      }),
    ),
    dimensions: z.object({ jobMatch: dimBucket, structure: dimBucket, language: dimBucket, consistency: dimBucket }),
  }),
  summary: z.object({
    critical: z.number(),
    medium: z.number(),
    low: z.number(),
    neutral: z.number(),
    requirementsTotal: z.number(),
    requirementsFound: z.number(),
    requirementsPartial: z.number(),
    requirementsMissing: z.number(),
    requiredTotal: z.number(),
    requiredFound: z.number(),
    clicheDensity: z.number().nullable(),
    sentencesAnalyzed: z.number(),
    clicheSentences: z.number(),
  }),
  improvement: z.object({
    firstFixId: z.string().nullable(),
    requirementsNeedingEvidence: z.array(z.string()),
    sectionsToReview: z.array(sectionKey),
  }),
  inspectors: z.array(z.object({ id: inspectorId, status: z.enum(['active', 'planned']), findings: z.number() })),
  warnings: z.array(
    z.enum(['no_requirements_detected', 'priorities_not_explicit', 'cv_truncated', 'empty_pages', 'job_language_differs']),
  ),
});

export function parseCvDocument(value: unknown): CvDocument | null {
  const r = CvDocumentSchema.safeParse(value);
  return r.success ? (r.data as CvDocument) : null;
}

export function parseAnalysisResult(value: unknown): AnalysisResult | null {
  const r = AnalysisResultSchema.safeParse(value);
  return r.success ? (r.data as AnalysisResult) : null;
}
