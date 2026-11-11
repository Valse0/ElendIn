import type { Finding, InspectorId, InspectorInfo } from '../../types/index.ts';
import { atsInspector } from './ats.ts';
import { hrInspector } from './hr.ts';
import { muratInspector } from './murat.ts';
import { securityInspector } from './security.ts';
import { benchmarkerInspector } from './benchmarker.ts';
import { copyPasteInspector } from './copypaste.ts';
import type { Inspector, InspectorContext } from './types.ts';

/**
 * Inspector registry. All six specialized inspectors are fully active.
 */
export const ACTIVE_INSPECTORS: Inspector[] = [
  atsInspector,
  hrInspector,
  muratInspector,
  securityInspector,
  benchmarkerInspector,
  copyPasteInspector,
];

export const PLANNED_INSPECTORS: InspectorId[] = [];

export const INSPECTOR_ORDER: InspectorId[] = ['ats', 'hr', 'murat', 'security', 'benchmarker', 'copypaste'];

export function runInspectors(ctx: InspectorContext): Finding[] {
  return ACTIVE_INSPECTORS.flatMap((i) => i.run(ctx));
}

export function inspectorInfo(findings: Finding[]): InspectorInfo[] {
  return INSPECTOR_ORDER.map((id) => ({
    id,
    status: PLANNED_INSPECTORS.includes(id) ? 'planned' : 'active',
    findings: findings.filter((f) => f.inspector === id).length,
  }));
}
