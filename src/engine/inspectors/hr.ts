import type { Finding } from '../../types/index.ts';
import { makeFinding } from './types.ts';
import type { Inspector, InspectorContext } from './types.ts';

export const hrInspector: Inspector = {
  id: 'hr',
  status: 'active',
  run(ctx: InspectorContext): Finding[] {
    const out: Finding[] = [];
    const p = ctx.parsed;
    if (!p.hasEmail && !p.hasPhone) {
      out.push(
        makeFinding({
          id: 'hr.contact-missing',
          inspector: 'hr',
          dimension: 'structure',
          severity: 'medium',
          intensity: 0.8,
          fixability: 1.0,
          dedupGroup: 'hr-contact',
          sections: ['summary'],
          params: {},
          evidence: ctx.cv.lines.slice(0, 1).map((l) => ({ source: 'cv' as const, text: l || 'No contact details found', label: 'contact' })),
        }),
      );
    }
    return out;
  },
};
