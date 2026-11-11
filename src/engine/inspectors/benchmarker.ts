import type { Finding } from '../../types/index.ts';
import { makeFinding } from './types.ts';
import type { Inspector, InspectorContext } from './types.ts';

export const benchmarkerInspector: Inspector = {
  id: 'benchmarker',
  status: 'active',
  run(ctx: InspectorContext): Finding[] {
    const out: Finding[] = [];
    const missing = ctx.requirements.filter((r) => r.priority === 'required' && r.status === 'missing');
    if (missing.length > 0) {
      out.push(
        makeFinding({
          id: 'benchmarker.unsupported-requirements',
          inspector: 'benchmarker',
          dimension: 'jobMatch',
          severity: 'low',
          neutral: true,
          intensity: missing.length / Math.max(1, ctx.requirements.length),
          fixability: 0.8,
          dedupGroup: 'benchmarker-missing',
          sections: ['skills'],
          params: { count: missing.length, list: missing.slice(0, 4).map((r) => r.label).join(', ') },
          evidence: missing.slice(0, 2).map((r) => ({ source: 'job' as const, text: r.label, label: 'requirement' })),
        }),
      );
    }
    return out;
  },
};
