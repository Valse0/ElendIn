/**
 * Shared, UI-independent data structures.
 * The analysis engine only produces these plain, serialisable shapes
 * (so they can cross a Web Worker boundary) and never produces display text:
 * findings carry i18n message keys + parameters instead.
 */

export type Lang = 'tr' | 'en' | 'es';
export const LANGS: readonly Lang[] = ['tr', 'en', 'es'] as const;

export type Severity = 'critical' | 'medium' | 'low';
export const SEVERITIES: readonly Severity[] = ['critical', 'medium', 'low'] as const;

export type InspectorId = 'ats' | 'hr' | 'murat' | 'security' | 'benchmarker' | 'copypaste';
export type InspectorStatus = 'active' | 'planned';

/** Scoring dimensions. Each dimension has a cap in the central scoring config. */
export type Dimension = 'jobMatch' | 'structure' | 'language' | 'consistency';

export type SectionKey =
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'languages'
  | 'certifications'
  | 'projects'
  | 'other';

/* ------------------------------------------------------------------ */
/* CV document / PDF extraction                                        */
/* ------------------------------------------------------------------ */

/** A positioned text fragment. Coordinates are in PDF points, y measured from the TOP of the page. */
export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedPage {
  pageNumber: number;
  width: number;
  height: number;
  /** Reading-order lines (column aware). */
  lines: string[];
  text: string;
  charCount: number;
  hasText: boolean;
  columnCount: 1 | 2;
  /** x position (points) of the detected gutter, if two columns were detected. */
  gutterX: number | null;
  /** True when the raw extraction order alternates between columns (likely garbled for naive parsers). */
  interleaved: boolean;
  /** Number of left<->right switches in the raw extraction order. */
  sideSwitches: number;
}

export type ExtractionStatus = 'ok' | 'no_text';

export interface CvDocument {
  fileName: string;
  /** Pages present in the file. */
  pageCount: number;
  /** Pages actually analysed (large documents are truncated). */
  pages: ExtractedPage[];
  truncated: boolean;
  emptyPages: number[];
  lines: string[];
  fullText: string;
  status: ExtractionStatus;
}

/* ------------------------------------------------------------------ */
/* Job description                                                     */
/* ------------------------------------------------------------------ */

export type RequirementKind = 'skill' | 'language' | 'education' | 'certification';
export type RequirementPriority = 'required' | 'preferred' | 'unspecified';
export type Seniority = 'junior' | 'mid' | 'senior' | 'lead' | 'unknown';
export type EducationLevel = 'highschool' | 'bachelor' | 'master' | 'phd';

export interface JobRequirement {
  id: string;
  kind: RequirementKind;
  /** Display label, as the lexicon / listing spells it. */
  label: string;
  /** Folded search terms (label + aliases). */
  terms: string[];
  /** Ids of other lexicon skills whose presence in the CV gives partial credit. */
  impliedBy: string[];
  priority: RequirementPriority;
  sourceLine: string;
  /** For language requirements: the language id (e.g. "english"). For education: the level. */
  meta?: string;
}

export interface JobDescription {
  charCount: number;
  wordCount: number;
  language: Lang;
  title: string | null;
  seniority: Seniority;
  yearsRequired: { min: number; max: number | null } | null;
  educationLevel: EducationLevel | null;
  requirements: JobRequirement[];
  responsibilities: string[];
  /** True when the listing has recognisable required / preferred headings. */
  hasExplicitSections: boolean;
}

/* ------------------------------------------------------------------ */
/* Findings, scoring, results                                          */
/* ------------------------------------------------------------------ */

export interface Evidence {
  source: 'cv' | 'job';
  text: string;
  label?: string;
  page?: number;
}

export type ParamValue = string | number;

export interface BeforeAfter {
  /** Original CV wording; null when the CV contains nothing relevant. */
  before: string | null;
  /** i18n key of the template the user must complete with real information. */
  afterKey: string;
  afterParams: Record<string, ParamValue>;
}

export interface Finding {
  /** Stable rule id, e.g. "ats.required-coverage". Also the base of the i18n keys. */
  id: string;
  inspector: InspectorId;
  dimension: Dimension;
  severity: Severity;
  /** Context-only item. Never deducts points (e.g. an employment gap). */
  neutral: boolean;
  /** 0..1 — how strongly the measured metric breaches the rule. */
  intensity: number;
  /** 0..1 — share of the deduction the user could recover by editing the CV honestly. */
  fixability: number;
  /** Findings in the same group are alternatives for the same underlying issue: only the largest counts. */
  dedupGroup: string | null;
  params: Record<string, ParamValue>;
  evidence: Evidence[];
  /** i18n key explaining why a CRITICAL rating is justified. Present on critical findings only. */
  justificationKey: string | null;
  beforeAfter: BeforeAfter | null;
  sections: SectionKey[];
}

export interface Deduction {
  findingId: string;
  severity: Severity;
  dimension: Dimension;
  /** Points before dedup / dimension caps. */
  rawPoints: number;
  /** Points actually subtracted. */
  points: number;
  /** Set when the deduction was fully absorbed because another finding in the same group counts. */
  dedupedBy: string | null;
}

export interface ScoringResult {
  score: number;
  /** Simulated score if the fixable issues were honestly addressed. Not a prediction. */
  potentialScore: number;
  /** True when part of the model could not be evaluated (e.g. no identifiable job requirements). */
  partial: boolean;
  deductions: Deduction[];
  dimensions: Record<Dimension, { raw: number; counted: number; cap: number }>;
}

export interface InspectorInfo {
  id: InspectorId;
  status: InspectorStatus;
  findings: number;
}

export interface RequirementReport {
  id: string;
  label: string;
  kind: RequirementKind;
  priority: RequirementPriority;
  status: 'found' | 'alias' | 'fuzzy' | 'related' | 'missing';
  credit: number;
  evidence: string | null;
}

export interface ClicheHit {
  sentence: string;
  phrase: string;
  match: 'exact' | 'similar';
  lang: Lang;
}

export interface AnalysisSummary {
  critical: number;
  medium: number;
  low: number;
  neutral: number;
  requirementsTotal: number;
  requirementsFound: number;
  requirementsPartial: number;
  requirementsMissing: number;
  requiredTotal: number;
  requiredFound: number;
  /** Cliché sentences / analysed sentences × 100, or null when there was nothing to analyse. */
  clicheDensity: number | null;
  sentencesAnalyzed: number;
  clicheSentences: number;
}

export interface ImprovementSummary {
  firstFixId: string | null;
  requirementsNeedingEvidence: string[];
  sectionsToReview: SectionKey[];
}

export interface AnalysisResult {
  engineVersion: string;
  generatedAt: string;
  cvLanguages: Lang[];
  job: {
    title: string | null;
    language: Lang;
    seniority: Seniority;
    yearsRequired: { min: number; max: number | null } | null;
    requirementCount: number;
    hasExplicitSections: boolean;
  };
  findings: Finding[];
  requirements: RequirementReport[];
  cliches: ClicheHit[];
  scoring: ScoringResult;
  summary: AnalysisSummary;
  improvement: ImprovementSummary;
  inspectors: InspectorInfo[];
  warnings: AnalysisWarning[];
}

export type AnalysisWarning = 'no_requirements_detected' | 'priorities_not_explicit' | 'cv_truncated' | 'empty_pages' | 'job_language_differs';

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export type AnalysisErrorCode =
  | 'CV_MISSING'
  | 'CV_NO_TEXT'
  | 'CV_TOO_SHORT'
  | 'JOB_EMPTY'
  | 'JOB_TOO_SHORT'
  | 'ANALYSIS_FAILED'
  | 'CANCELLED';

export type ExtractionErrorCode =
  | 'NOT_PDF'
  | 'FILE_EMPTY'
  | 'FILE_TOO_LARGE'
  | 'PASSWORD'
  | 'INVALID_PDF'
  | 'EXTRACTION_FAILED'
  | 'CANCELLED';
