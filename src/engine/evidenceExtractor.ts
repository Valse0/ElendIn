import type { Evidence, RequirementReport } from '../types/index.ts';
import type { RequirementMatch } from '../lib/matching/matcher.ts';
import type { JobRequirement } from '../types/index.ts';
import { redactPII, truncate } from './text.ts';

/**
 * Evidence snippets always quote the user's own document or the pasted listing.
 * CV snippets are PII-redacted (emails, phones, profile links) before they reach any report.
 */

export function cvEvidence(lines: string[], lineIndex: number | null, label?: string): Evidence | null {
  if (lineIndex === null || lineIndex < 0 || lineIndex >= lines.length) return null;
  const text = truncate(redactPII(lines[lineIndex]));
  return text ? { source: 'cv', text, label } : null;
}

export function cvTextEvidence(text: string, label?: string): Evidence {
  return { source: 'cv', text: truncate(redactPII(text)), label };
}

export function jobEvidence(req: JobRequirement): Evidence {
  return { source: 'job', text: truncate(req.sourceLine), label: req.label };
}

export function buildRequirementReport(req: JobRequirement, match: RequirementMatch, cvLines: string[]): RequirementReport {
  const ev = cvEvidence(cvLines, match.lineIndex);
  return {
    id: req.id,
    label: req.label,
    kind: req.kind,
    priority: req.priority,
    status: match.status,
    credit: match.credit,
    evidence: ev ? ev.text : null,
  };
}
