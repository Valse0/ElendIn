import type { Finding, RequirementReport, SectionKey } from '../../types/index.ts';
import { EDUCATION_RANK } from '../lexicon.ts';
import { PRIORITY_WEIGHT, THRESHOLDS } from '../config.ts';
import { cvEvidence, cvTextEvidence, jobEvidence } from '../evidenceExtractor.ts';
import {
  classifyDateFormats,
  classifyEducation,
  classifyExperience,
  classifyLanguages,
  classifyRequiredCoverage,
  classifySections,
} from '../severityEngine.ts';
import { truncate } from '../text.ts';
import { fromDecision, makeFinding } from './types.ts';
import type { Inspector, InspectorContext } from './types.ts';

/**
 * INSPECTOR 01 — ATS INSPECTOR.
 * Machine-readability (extraction order, headings, dates) and job-description coverage.
 * Wording of every message lives in the i18n files; this module only decides WHAT is found.
 */

const SKILL_KINDS = new Set(['skill', 'certification']);
const found = (r: RequirementReport) => r.status === 'found' || r.status === 'alias' || r.status === 'fuzzy';

function layoutFindings(ctx: InspectorContext): Finding[] {
  const out: Finding[] = [];
  const pages = ctx.cv.pages;
  const interleavedPages = pages.filter((p) => p.interleaved).map((p) => p.pageNumber);
  const twoColPages = pages.filter((p) => p.columnCount === 2).map((p) => p.pageNumber);

  if (interleavedPages.length > 0) {
    out.push(
      makeFinding({
        id: 'ats.reading-order',
        inspector: 'ats',
        dimension: 'structure',
        severity: 'medium',
        intensity: Math.min(1, 0.5 + interleavedPages.length / Math.max(1, pages.length) / 2),
        fixability: 0.9,
        sections: [],
        params: { pages: interleavedPages.join(', '), switches: pages.filter((p) => p.interleaved).reduce((s, p) => s + p.sideSwitches, 0) },
        evidence: [cvTextEvidence(`${pages.length} page(s) · columns detected on page(s) ${twoColPages.join(', ')}`, 'layout')],
      }),
    );
  } else if (twoColPages.length > 0) {
    out.push(
      makeFinding({
        id: 'ats.two-columns-info',
        inspector: 'ats',
        dimension: 'structure',
        severity: 'low',
        neutral: true,
        intensity: 0,
        fixability: 0,
        sections: [],
        params: { pages: twoColPages.join(', ') },
        evidence: [cvTextEvidence(`${pages.length} page(s) · 2 columns on page(s) ${twoColPages.join(', ')} · reading order OK`, 'layout')],
      }),
    );
  }

  const spaced = ctx.cv.lines.filter((l) => /^(?:\p{L}\s){3,}\p{L}$/u.test(l.trim()));
  if (spaced.length >= THRESHOLDS.glyphSpacing.minLines) {
    out.push(
      makeFinding({
        id: 'ats.spaced-letters',
        inspector: 'ats',
        dimension: 'structure',
        severity: 'low',
        intensity: Math.min(1, spaced.length / 5),
        fixability: 0.9,
        sections: [],
        params: { count: spaced.length },
        evidence: spaced.slice(0, 2).map((l) => cvTextEvidence(l, 'text')),
      }),
    );
  }
  return out;
}

function sectionFindings(ctx: InspectorContext): Finding[] {
  const expected: SectionKey[] = ['experience', 'education', 'skills'];
  const missing = expected.filter((k) => !ctx.parsed.headingsFound.includes(k));
  if (missing.length === 0) return [];
  const d = classifySections(missing, ctx.parsed.headingsFound.length);
  return [
    makeFinding({
      id: 'ats.sections-missing',
      inspector: 'ats',
      dimension: 'structure',
      ...fromDecision(d),
      fixability: 0.9,
      sections: missing,
      params: { missing: missing.join(', '), count: missing.length },
      evidence: [cvTextEvidence(ctx.parsed.headingsFound.length ? ctx.parsed.headingsFound.join(', ') : '—', 'headings')],
    }),
  ];
}

function coverageFindings(ctx: InspectorContext): Finding[] {
  const out: Finding[] = [];
  const skillReqs = ctx.requirements.filter((r) => SKILL_KINDS.has(r.kind));
  const weighted = skillReqs.filter((r) => PRIORITY_WEIGHT[r.priority] > 0);
  const totalWeight = weighted.reduce((s, r) => s + PRIORITY_WEIGHT[r.priority], 0);

  if (totalWeight > 0) {
    const credit = weighted.reduce((s, r) => s + PRIORITY_WEIGHT[r.priority] * r.credit, 0);
    const coverage = credit / totalWeight;
    const missing = weighted.filter((r) => r.status === 'missing');
    const partial = weighted.filter((r) => r.status === 'related');
    const explicitRequired = weighted.filter((r) => r.priority === 'required').length;
    const foundCount = weighted.filter(found).length;

    if (coverage < 1 && (missing.length > 0 || partial.length > 0)) {
      const d = classifyRequiredCoverage({ explicitRequired, missing: missing.length, coverage });
      const needing = [...missing, ...partial];
      const jobReqById = new Map(ctx.job.requirements.map((r) => [r.id, r]));
      out.push(
        makeFinding({
          id: 'ats.required-coverage',
          inspector: 'ats',
          dimension: 'jobMatch',
          ...fromDecision(d),
          fixability: 0.6,
          dedupGroup: 'job-coverage',
          sections: ['skills', 'experience'],
          params: {
            found: foundCount,
            total: weighted.length,
            partial: partial.length,
            missing: missing.length,
            list: needing.slice(0, 6).map((r) => r.label).join(', '),
            skill: needing[0].label,
            coveragePct: Math.round(coverage * 100),
          },
          evidence: needing.slice(0, 3).flatMap((r) => {
            const jr = jobReqById.get(r.id);
            return jr ? [jobEvidence(jr)] : [];
          }),
          beforeAfter: {
            before: null,
            afterKey: 'finding.ats.required-coverage.after',
            afterParams: { skill: needing[0].label },
          },
        }),
      );
    }
  }

  const preferred = skillReqs.filter((r) => r.priority === 'preferred');
  const prefMissing = preferred.filter((r) => r.status === 'missing');
  if (prefMissing.length > 0) {
    const jobReqById = new Map(ctx.job.requirements.map((r) => [r.id, r]));
    out.push(
      makeFinding({
        id: 'ats.preferred-missing',
        inspector: 'ats',
        dimension: 'jobMatch',
        severity: 'low',
        intensity: prefMissing.length / preferred.length,
        fixability: 0.5,
        sections: ['skills'],
        params: { missing: prefMissing.length, total: preferred.length, list: prefMissing.slice(0, 6).map((r) => r.label).join(', '), skill: prefMissing[0].label },
        evidence: prefMissing.slice(0, 3).flatMap((r) => {
          const jr = jobReqById.get(r.id);
          return jr ? [jobEvidence(jr)] : [];
        }),
        beforeAfter: { before: null, afterKey: 'finding.ats.required-coverage.after', afterParams: { skill: prefMissing[0].label } },
      }),
    );
  }
  return out;
}

function experienceFindings(ctx: InspectorContext): Finding[] {
  const out: Finding[] = [];
  const need = ctx.job.yearsRequired;
  const p = ctx.parsed;

  if (need && need.min > 0) {
    const outcome = classifyExperience({ required: need.min, computed: p.periodsYears, claimed: p.claimedYears });
    if (outcome.kind === 'short') {
      out.push(
        makeFinding({
          id: 'ats.experience-short',
          inspector: 'ats',
          dimension: 'jobMatch',
          ...fromDecision(outcome.decision),
          fixability: 0.15,
          sections: ['experience'],
          params: { required: need.min, found: p.periodsYears },
          evidence: [cvTextEvidence(`${p.periodsYears} y (dated roles)`, 'cv'), { source: 'job', text: `${need.min}${need.max ? `–${need.max}` : '+'} y`, label: 'job' }],
        }),
      );
    } else if (outcome.kind === 'unverified') {
      out.push(
        makeFinding({
          id: 'ats.experience-unverified',
          inspector: 'ats',
          dimension: 'jobMatch',
          ...fromDecision(outcome.decision),
          fixability: 0.8,
          dedupGroup: 'experience-dates',
          sections: ['experience'],
          params: { required: need.min, claimed: p.claimedYears },
          evidence: [
            { source: 'job', text: `${need.min}${need.max ? `–${need.max}` : '+'} y`, label: 'job' },
            cvTextEvidence(p.claimedYears > 0 ? `${p.claimedYears} y (claimed, no dated roles)` : '0 y (no dated roles found)', 'cv'),
          ],
          beforeAfter: { before: null, afterKey: 'finding.ats.dates-missing.after', afterParams: {} },
        }),
      );
    }
  }

  if (p.experienceRanges.length === 0 && p.experienceLines.length >= THRESHOLDS.dates.minExperienceLinesForNoDates) {
    out.push(
      makeFinding({
        id: 'ats.dates-missing',
        inspector: 'ats',
        dimension: 'structure',
        severity: 'medium',
        intensity: 0.8,
        fixability: 0.9,
        dedupGroup: 'experience-dates',
        sections: ['experience'],
        params: { lines: p.experienceLines.length },
        evidence: p.experienceLines.slice(0, 2).map((l) => cvTextEvidence(l, 'experience')),
        beforeAfter: { before: null, afterKey: 'finding.ats.dates-missing.after', afterParams: {} },
      }),
    );
  }

  const invalid = p.experienceRanges.filter((r) => r.invalid);
  if (invalid.length > 0) {
    out.push(
      makeFinding({
        id: 'ats.dates-invalid',
        inspector: 'ats',
        dimension: 'consistency',
        severity: 'medium',
        intensity: Math.min(1, 0.5 + invalid.length / 4),
        fixability: 1,
        sections: ['experience'],
        params: { count: invalid.length },
        evidence: invalid.slice(0, 3).map((r) => cvTextEvidence(r.line, 'date')),
      }),
    );
  }

  if (p.dateFormats.length >= 2) {
    const d = classifyDateFormats(p.dateFormats.length);
    const examples = new Map<string, string>();
    for (const r of p.experienceRanges) {
      for (const f of [r.start.format, r.end && r.end !== 'present' ? r.end.format : null]) if (f && !examples.has(f)) examples.set(f, r.line);
    }
    out.push(
      makeFinding({
        id: 'ats.date-formats-mixed',
        inspector: 'ats',
        dimension: 'consistency',
        ...fromDecision(d),
        fixability: 1,
        sections: ['experience'],
        params: { formats: p.dateFormats.join(' · '), count: p.dateFormats.length },
        evidence: Array.from(examples.values()).slice(0, 3).map((l) => cvTextEvidence(l, 'date')),
        beforeAfter: { before: truncate(Array.from(examples.values())[0] ?? ''), afterKey: 'finding.ats.date-formats-mixed.after', afterParams: {} },
      }),
    );
  }

  if (p.openEnded.length > 0) {
    out.push(
      makeFinding({
        id: 'ats.date-open-ended',
        inspector: 'ats',
        dimension: 'consistency',
        severity: 'low',
        intensity: Math.min(1, p.openEnded.length / 3),
        fixability: 1,
        sections: ['experience'],
        params: { count: p.openEnded.length },
        evidence: p.openEnded.slice(0, 2).flatMap((i) => cvEvidence(p.experienceLines, i, 'date') ?? []),
      }),
    );
  }

  // Employment gaps are context, never a defect.
  if (p.gaps.length > 0) {
    const longest = Math.max(...p.gaps.map((g) => g.months));
    const ym = (i: number) => `${String((i % 12) + 1).padStart(2, '0')}/${Math.floor(i / 12)}`;
    out.push(
      makeFinding({
        id: 'ats.employment-gap',
        inspector: 'ats',
        dimension: 'consistency',
        severity: 'low',
        neutral: true,
        intensity: 0,
        fixability: 0,
        sections: ['experience'],
        params: { count: p.gaps.length, months: longest },
        evidence: p.gaps.slice(0, 2).map((g) => cvTextEvidence(`${ym(g.fromIdx)} → ${ym(g.toIdx)} (${g.months})`, 'gap')),
      }),
    );
  }
  return out;
}

function languageEducationFindings(ctx: InspectorContext): Finding[] {
  const out: Finding[] = [];
  const jobReqById = new Map(ctx.job.requirements.map((r) => [r.id, r]));

  const langReqs = ctx.requirements.filter((r) => r.kind === 'language');
  const langMissing = langReqs.filter((r) => r.status === 'missing');
  if (langMissing.length > 0) {
    const requiredMissing = langMissing.filter((r) => r.priority !== 'preferred').length;
    const d = classifyLanguages({ requiredMissing, otherMissing: langMissing.length - requiredMissing });
    out.push(
      makeFinding({
        id: 'ats.language-missing',
        inspector: 'ats',
        dimension: 'jobMatch',
        ...fromDecision(d),
        fixability: 0.7,
        sections: ['languages'],
        params: { list: langMissing.map((r) => r.label).join(', '), count: langMissing.length },
        evidence: langMissing.slice(0, 2).flatMap((r) => {
          const jr = jobReqById.get(r.id);
          return jr ? [jobEvidence(jr)] : [];
        }),
      }),
    );
  }

  const eduReq = ctx.job.requirements.find((r) => r.kind === 'education');
  if (eduReq && eduReq.meta) {
    const level = eduReq.meta as keyof typeof EDUCATION_RANK;
    if (ctx.parsed.educationRank < EDUCATION_RANK[level]) {
      const d = classifyEducation(eduReq.priority === 'required');
      out.push(
        makeFinding({
          id: 'ats.education-missing',
          inspector: 'ats',
          dimension: 'jobMatch',
          ...fromDecision(d),
          fixability: 0.5,
          sections: ['education'],
          params: { level },
          evidence: [jobEvidence(eduReq)],
        }),
      );
    }
  }
  return out;
}

export const atsInspector: Inspector = {
  id: 'ats',
  status: 'active',
  run(ctx) {
    return [
      ...layoutFindings(ctx),
      ...sectionFindings(ctx),
      ...coverageFindings(ctx),
      ...experienceFindings(ctx),
      ...languageEducationFindings(ctx),
    ];
  },
};
