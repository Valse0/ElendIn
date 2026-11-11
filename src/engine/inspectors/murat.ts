import type { Finding } from '../../types/index.ts';
import { makeFinding } from './types.ts';
import type { Inspector, InspectorContext } from './types.ts';

export const muratInspector: Inspector = {
  id: 'murat',
  status: 'active',
  run(ctx: InspectorContext): Finding[] {
    const out: Finding[] = [];
    const need = ctx.job.yearsRequired;
    const p = ctx.parsed;
    if (need && need.min >= 4 && p.periodsYears < need.min) {
      out.push(
        makeFinding({
          id: 'murat.seniority-gap',
          inspector: 'murat',
          dimension: 'jobMatch',
          severity: 'medium',
          intensity: 0.7,
          fixability: 0.2,
          dedupGroup: 'seniority-gap',
          sections: ['experience'],
          params: { required: need.min, found: p.periodsYears },
          evidence: [{ source: 'cv' as const, text: `Calculated experience: ${p.periodsYears} years (Required: ${need.min} years)`, label: 'experience' }],
        }),
      );
    }
    return out;
  },
};
