import type { Finding } from '../../types/index.ts';
import { makeFinding } from './types.ts';
import type { Inspector, InspectorContext } from './types.ts';

export const securityInspector: Inspector = {
  id: 'security',
  status: 'active',
  run(ctx: InspectorContext): Finding[] {
    const out: Finding[] = [];
    const invalidRanges = ctx.parsed.experienceRanges.filter((r) => r.invalid);
    if (invalidRanges.length > 0) {
      out.push(
        makeFinding({
          id: 'security.date-contradiction',
          inspector: 'security',
          dimension: 'consistency',
          severity: 'low',
          neutral: true,
          intensity: 0.5,
          fixability: 1.0,
          dedupGroup: 'security-dates',
          sections: ['experience'],
          params: { count: invalidRanges.length },
          evidence: invalidRanges.slice(0, 2).map((r) => ({ source: 'cv' as const, text: r.line, label: 'date' })),
        }),
      );
    }
    return out;
  },
};
