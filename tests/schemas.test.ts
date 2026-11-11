import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/engine/analysisEngine.ts';
import { cvFromText } from '../src/lib/pdf/fromText.ts';
import { parseAnalysisResult, parseCvDocument } from '../src/types/schemas.ts';
import * as S from './fixtures/samples.ts';

const CASES = [
  [S.CV_STRONG_EN, S.JOB_EN], [S.CV_WEAK_EN, S.JOB_EN], [S.CV_CLICHE_HEAVY_EN, S.JOB_EN], [S.CV_MIXED_DATES_EN, S.JOB_EN],
  [S.CV_TR, S.JOB_TR], [S.CV_ES, S.JOB_ES], [S.CV_MESSY_EN, S.JOB_SENIOR_EN], [S.CV_NO_DATES_EN, S.JOB_SENIOR_EN], [S.CV_GAP_EN, S.JOB_EN],
] as const;

test('every real analysis result passes the AnalysisResult schema (and survives a JSON round trip)', () => {
  for (const [cv, job] of CASES) {
    const r = analyze(cvFromText(cv), job, { now: S.NOW });
    assert.ok(parseAnalysisResult(r), 'direct');
    assert.ok(parseAnalysisResult(JSON.parse(JSON.stringify(r))), 'json round trip');
    assert.ok(parseAnalysisResult(structuredClone(r)), 'structuredClone (worker boundary)');
  }
});

test('CvDocument schema accepts extracted documents and rejects malformed ones', () => {
  const doc = cvFromText(S.CV_STRONG_EN);
  assert.ok(parseCvDocument(doc));
  assert.equal(parseCvDocument({ ...doc, pages: 'nope' }), null);
  assert.equal(parseCvDocument(null), null);
});

test('AnalysisResult schema rejects tampered results', () => {
  const r = analyze(cvFromText(S.CV_WEAK_EN), S.JOB_EN, { now: S.NOW });
  const bad = structuredClone(r) as unknown as { findings: Array<{ severity: string }> };
  bad.findings[0].severity = 'catastrophic';
  assert.equal(parseAnalysisResult(bad), null);
  const missing = structuredClone(r) as unknown as Record<string, unknown>;
  delete missing.scoring;
  assert.equal(parseAnalysisResult(missing), null);
});
