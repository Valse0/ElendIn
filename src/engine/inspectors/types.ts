import type {
  BeforeAfter,
  CvDocument,
  Dimension,
  Evidence,
  Finding,
  InspectorId,
  InspectorStatus,
  JobDescription,
  Lang,
  ParamValue,
  RequirementReport,
  SectionKey,
  Severity,
} from '../../types/index.ts';
import type { ParsedCv } from '../cvParser.ts';
import type { SentenceUnit } from '../text.ts';
import type { CvIndex, RequirementMatch } from '../../lib/matching/matcher.ts';
import type { Decision } from '../severityEngine.ts';

/** Everything an inspector may read. Built once by the analysis engine and shared (read-only). */
export interface InspectorContext {
  cv: CvDocument;
  parsed: ParsedCv;
  idx: CvIndex;
  job: JobDescription;
  matches: Map<string, RequirementMatch>;
  requirements: RequirementReport[];
  cvLanguages: Lang[];
  sentences: SentenceUnit[];
  now: Date;
}

export interface Inspector {
  id: InspectorId;
  status: InspectorStatus;
  run(ctx: InspectorContext): Finding[];
}

export interface FindingInit {
  id: string;
  inspector: InspectorId;
  dimension: Dimension;
  severity: Severity;
  intensity: number;
  fixability: number;
  sections: SectionKey[];
  neutral?: boolean;
  dedupGroup?: string | null;
  params?: Record<string, ParamValue>;
  evidence?: Evidence[];
  justificationKey?: string | null;
  beforeAfter?: BeforeAfter | null;
}

/** Single constructor so every finding has the same shape and a critical finding always carries its justification. */
export function makeFinding(init: FindingInit): Finding {
  if (init.severity === 'critical' && !init.justificationKey) {
    throw new Error(`Critical finding "${init.id}" requires a justificationKey`);
  }
  return {
    id: init.id,
    inspector: init.inspector,
    dimension: init.dimension,
    severity: init.severity,
    neutral: init.neutral ?? false,
    intensity: Math.min(1, Math.max(0, init.intensity)),
    fixability: Math.min(1, Math.max(0, init.fixability)),
    dedupGroup: init.dedupGroup ?? null,
    params: init.params ?? {},
    evidence: init.evidence ?? [],
    justificationKey: init.severity === 'critical' ? (init.justificationKey ?? null) : null,
    beforeAfter: init.beforeAfter ?? null,
    sections: init.sections,
  };
}

export function fromDecision(d: Decision): Pick<FindingInit, 'severity' | 'intensity' | 'justificationKey'> {
  return { severity: d.severity, intensity: d.intensity, justificationKey: d.justificationKey };
}
