import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/engine/analysisEngine.ts';
import { cvFromText } from '../src/lib/pdf/fromText.ts';
import { composeReport } from '../src/lib/export/pdfReport.ts';
import type { PdfDocLike } from '../src/lib/export/pdfReport.ts';
import type { Lang } from '../src/types/index.ts';
import * as S from './fixtures/samples.ts';

/** Records what composeReport draws. Approximates glyph width as 0.5 × font size, like a typical proportional font. */
class FakeDoc implements PdfDocLike {
  W = 595.28;
  H = 841.89;
  page = 1;
  pages = 1;
  size = 10;
  calls: Array<{ page: number; text: string; x: number; y: number }> = [];
  fonts: string[] = [];
  internal = { pageSize: { getWidth: () => this.W, getHeight: () => this.H } };
  setFont(f: string, st: 'normal' | 'bold') { this.fonts.push(`${f}:${st}`); return this; }
  setFontSize(s: number) { this.size = s; return this; }
  setTextColor() { return this; }
  setFillColor() { return this; }
  setDrawColor() { return this; }
  setLineWidth() { return this; }
  rect() { return this; }
  line() { return this; }
  text(text: string | string[], x: number, y: number) {
    for (const t of Array.isArray(text) ? text : [text]) this.calls.push({ page: this.page, text: t, x, y });
    return this;
  }
  splitTextToSize(text: string, maxWidth: number): string[] {
    const perLine = Math.max(10, Math.floor(maxWidth / (this.size * 0.5)));
    const words = text.split(/\s+/);
    const out: string[] = [];
    let line = '';
    for (const w of words) {
      if ((line + ' ' + w).trim().length > perLine) { if (line) out.push(line); line = w; } else line = (line + ' ' + w).trim();
    }
    if (line) out.push(line);
    return out;
  }
  addPage() { this.pages++; this.page = this.pages; return this; }
  setPage(n: number) { this.page = n; return this; }
  getNumberOfPages() { return this.pages; }
  all() { return this.calls.map((c) => c.text).join('\n'); }
}

const run = (cv: string, job: string, lang: Lang) => {
  const r = analyze(cvFromText(cv), job, { now: S.NOW });
  const doc = new FakeDoc();
  composeReport(doc, r, lang, { fontFamily: 'DejaVu', now: S.NOW, version: '0.1.0' });
  return { r, doc };
};

test('pdf report: contains score, severity labels, findings and the limitations text', () => {
  const { r, doc } = run(S.CV_WEAK_EN, S.JOB_EN, 'en');
  const all = doc.all();
  assert.ok(all.includes(String(r.scoring.score)));
  assert.ok(all.includes('APPLICATION DIAGNOSTIC REPORT'));
  assert.ok(all.includes('[CRITICAL]'));
  assert.ok(all.includes('Why CRITICAL'));
  assert.ok(all.includes('LIMITATIONS'));
  assert.ok(all.includes('Simulated diagnostic result'));
  assert.ok(all.includes('Potential score after addressing'));
  assert.ok(all.includes('BEFORE') && all.includes('AFTER (template'));
  for (const f of r.findings.filter((x) => !x.neutral)) assert.ok(all.includes('[' + (f.severity === 'critical' ? 'CRITICAL' : f.severity === 'medium' ? 'MEDIUM' : 'LOW') + ']'));
});

test('pdf report: every drawn line stays inside the page and long reports paginate with numbering on every page', () => {
  const { doc } = run(S.CV_WEAK_EN, S.JOB_EN, 'en');
  assert.ok(doc.pages >= 2, `pages: ${doc.pages}`);
  for (const c of doc.calls) {
    assert.ok(c.y > 0 && c.y < doc.H, `y out of page: ${c.y} (${c.text.slice(0, 30)})`);
    assert.ok(c.x >= 0 && c.x < doc.W);
  }
  for (let p = 1; p <= doc.pages; p++) {
    assert.ok(doc.calls.some((c) => c.page === p && c.text === `Page ${p}/${doc.pages}`), `page ${p} has no page number`);
  }
});

test('pdf report: no e-mail, phone number, link or file name is printed', () => {
  for (const [cv, job] of [[S.CV_STRONG_EN, S.JOB_EN], [S.CV_WEAK_EN, S.JOB_EN], [S.CV_TR, S.JOB_TR]] as const) {
    const { doc } = run(cv, job, 'en');
    const all = doc.all();
    assert.ok(!/@example\.com/.test(all));
    assert.ok(!/555 010/.test(all));
    assert.ok(!/sample\.pdf/.test(all));
  }
});

test('pdf report: no unresolved placeholders in any language, and each language is actually used', () => {
  const expected: Record<Lang, string> = { en: 'APPLICATION DIAGNOSTIC REPORT', tr: 'BAŞVURU TEŞHİS RAPORU', es: 'INFORME DE DIAGNÓSTICO DE POSTULACIÓN' };
  for (const lang of ['en', 'tr', 'es'] as Lang[]) {
    const { doc } = run(S.CV_MESSY_EN, S.JOB_SENIOR_EN, lang);
    const all = doc.all();
    assert.ok(all.includes(expected[lang]), lang);
    assert.ok(!/\{\w+\}/.test(all), `${lang}: unresolved placeholder`);
    assert.ok(doc.fonts.every((f) => f.startsWith('DejaVu:')));
  }
});

test('pdf report: a clean CV produces a short report with the “no major issues” stamp', () => {
  const { doc } = run(S.CV_STRONG_EN, S.JOB_EN, 'en');
  assert.ok(doc.all().includes('NO MAJOR ISSUES'));
  assert.ok(doc.pages <= 2);
});

test('pdf report: context items are listed but labelled CONTEXT', () => {
  const { doc } = run(S.CV_GAP_EN, S.JOB_EN, 'en');
  assert.ok(doc.all().includes('[CONTEXT]'));
});
