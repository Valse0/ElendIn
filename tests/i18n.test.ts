import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { analyze } from '../src/engine/analysisEngine.ts';
import { cvFromText } from '../src/lib/pdf/fromText.ts';
import { CATALOGS, findingText, translate, detectBrowserLanguage, interpolate } from '../src/i18n/index.ts';
import { en } from '../src/i18n/en.ts';
import type { Lang } from '../src/types/index.ts';
import * as S from './fixtures/samples.ts';

const LANGS: Lang[] = ['tr', 'en', 'es'];
const ALL_IDS = [
  'ats.reading-order', 'ats.two-columns-info', 'ats.spaced-letters', 'ats.sections-missing', 'ats.required-coverage',
  'ats.preferred-missing', 'ats.experience-short', 'ats.experience-unverified', 'ats.dates-missing', 'ats.dates-invalid',
  'ats.date-formats-mixed', 'ats.date-open-ended', 'ats.employment-gap', 'ats.language-missing', 'ats.education-missing',
  'cp.cliche-density', 'cp.generic-summary', 'cp.vague-claims',
  'hr.contact-missing', 'murat.seniority-gap', 'security.date-contradiction', 'benchmarker.unsupported-requirements',
];
const placeholders = (s: string) => Array.from(s.matchAll(/\{(\w+)\}/g)).map((m) => m[1]).sort();

test('all three catalogues have exactly the same keys', () => {
  const ref = Object.keys(en).sort();
  for (const l of LANGS) assert.deepEqual(Object.keys(CATALOGS[l]).sort(), ref, `keys differ in ${l}`);
});

test('no message is empty and placeholders match the English reference', () => {
  for (const [key, ref] of Object.entries(en)) {
    for (const l of LANGS) {
      const msg = (CATALOGS[l] as Record<string, string>)[key];
      assert.ok(msg && msg.trim().length > 0, `${l}:${key} is empty`);
      assert.deepEqual(placeholders(msg), placeholders(ref), `${l}:${key} placeholders differ from en`);
    }
  }
});

test('Turkish and Spanish are real translations, not copies of the English text', () => {
  const identicalAllowed = new Set(['app.name', 'report.score.of', 'footer.version', 'export.pdf.page', 'insp.status.active']);
  for (const l of ['tr', 'es'] as Lang[]) {
    let same = 0;
    for (const [key, ref] of Object.entries(en)) {
      if ((CATALOGS[l] as Record<string, string>)[key] === ref && !identicalAllowed.has(key)) same++;
    }
    assert.ok(same <= 6, `${l}: ${same} messages are identical to English`);
  }
});

function sourceFiles(dir: string, ext: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, ext, out);
    else if (ext.test(name)) out.push(p);
  }
  return out;
}

test('every finding id emitted by an inspector has title, why and fix in every language', () => {
  const files = sourceFiles('src/engine/inspectors', /\.ts$/);
  const ids = new Set<string>();
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(/\bid: '((?:ats|cp|hr|murat|security|benchmarker)\.[a-z-]+)'/g)) ids.add(m[1]);
  }
  assert.ok(ids.size >= 18, `only found ${ids.size} ids`);
  for (const id of ids) {
    for (const part of ['title', 'why', 'fix']) {
      assert.ok(`finding.${id}.${part}` in en, `missing finding.${id}.${part}`);
    }
  }
});

test('every afterKey and justificationKey referenced in the inspectors exists', () => {
  const files = sourceFiles('src/engine', /\.ts$/);
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(/'(finding\.[a-z.-]+\.(?:after|critical))'/g)) {
      assert.ok(m[1] in en, `${f}: unknown key ${m[1]}`);
    }
  }
});

test('rendering real findings in every language leaves no unresolved placeholders', () => {
  const cases = [
    [S.CV_WEAK_EN, S.JOB_EN], [S.CV_CLICHE_HEAVY_EN, S.JOB_EN], [S.CV_MIXED_DATES_EN, S.JOB_EN],
    [S.CV_STRONG_EN, S.JOB_EN], [S.CV_TR, S.JOB_TR], [S.CV_ES, S.JOB_ES],
    [S.CV_MESSY_EN, S.JOB_SENIOR_EN], [S.CV_NO_DATES_EN, S.JOB_SENIOR_EN], [S.CV_WEAK_EN, S.JOB_SENIOR_EN], [S.CV_GAP_EN, S.JOB_EN],
    [S.CV_NO_CONTACT_EN, S.JOB_EN],
  ] as const;
  const seen = new Set<string>();
  const docs = cases.map(([cv, job]) => ({ cv: cvFromText(cv), job }));
  // Layout findings need geometry the plain-text helper cannot produce: mark pages explicitly.
  const interleaved = cvFromText(S.CV_STRONG_EN);
  interleaved.pages[0] = { ...interleaved.pages[0], columnCount: 2, gutterX: 300, interleaved: true, sideSwitches: 12 };
  const twoCol = cvFromText(S.CV_STRONG_EN);
  twoCol.pages[0] = { ...twoCol.pages[0], columnCount: 2, gutterX: 300, interleaved: false, sideSwitches: 1 };
  docs.push({ cv: interleaved, job: S.JOB_EN }, { cv: twoCol, job: S.JOB_EN });
  for (const { cv, job } of docs) {
    const r = analyze(cv, job, { now: S.NOW });
    for (const f of r.findings) {
      seen.add(f.id);
      for (const l of LANGS) {
        const t = findingText(l, f);
        for (const [k, v] of Object.entries(t)) {
          if (typeof v === 'string') assert.ok(!/\{\w+\}/.test(v), `${l}:${f.id}.${k} has unresolved placeholder: ${v}`);
        }
        assert.ok(t.title && t.why && t.fix);
        if (f.severity === 'critical') assert.ok(t.justification);
        if (f.beforeAfter) assert.ok(t.after);
      }
    }
  }
  const notExercised = ALL_IDS.filter((id) => !seen.has(id));
  assert.deepEqual(notExercised, [], `finding types never rendered by the fixtures: ${notExercised.join(', ')}`);
});

test('section names are localised inside finding text', () => {
  const r = analyze(cvFromText(S.CV_WEAK_EN), S.JOB_EN, { now: S.NOW });
  const f = r.findings.find((x) => x.id === 'ats.sections-missing');
  if (f) {
    assert.ok(!findingText('tr', f).why.includes('experience'));
    assert.ok(!findingText('es', f).why.includes('experience'));
  }
});

test('translate falls back to English, then to the key; interpolate keeps unknown placeholders visible', () => {
  assert.equal(translate('tr', 'nav.how'), 'Nasıl çalışır');
  assert.equal(translate('en', 'does.not.exist'), 'does.not.exist');
  assert.equal(interpolate('a {x} b {y}', { x: 1 }), 'a 1 b {y}');
});

test('browser language detection', () => {
  assert.equal(detectBrowserLanguage({ languages: ['tr-TR', 'en'] }), 'tr');
  assert.equal(detectBrowserLanguage({ languages: ['es-PE'] }), 'es');
  assert.equal(detectBrowserLanguage({ languages: ['fr-FR'] }), 'en');
  assert.equal(detectBrowserLanguage(undefined), 'en');
});

test('required brand and privacy messages exist in every language', () => {
  for (const l of LANGS) {
    assert.ok(translate(l, 'hero.privacy').length > 20);
    assert.ok(translate(l, 'hero.limits').length > 40);
    assert.ok(translate(l, 'report.simulated').length > 40);
  }
  assert.equal(translate('tr', 'hero.privacy'), 'CV’n sunucuya gitmiyor, tarayıcıda analiz ediliyor.');
  assert.equal(translate('es', 'hero.privacy'), 'Tu CV nunca se envía a un servidor. Se analiza directamente en tu navegador.');
  assert.equal(translate('en', 'hero.privacy'), 'Your CV never leaves your device. It is analyzed directly in your browser.');
});
