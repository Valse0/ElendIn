import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnalysisError, analyze } from '../src/engine/analysisEngine.ts';
import { cvFromText } from '../src/lib/pdf/fromText.ts';
import { foldText, termRegex, tokenEquivalent, redactPII, detectLanguage } from '../src/engine/text.ts';
import { parseJobDescription } from '../src/engine/jobDescriptionParser.ts';
import { parseDateRanges, findGaps, toPeriods, totalYears } from '../src/engine/dates.ts';
import { buildCvIndex, matchRequirement } from '../src/lib/matching/matcher.ts';
import { scoreFindings } from '../src/engine/scoringEngine.ts';
import { makeFinding } from '../src/engine/inspectors/types.ts';
import { scanCliches } from '../src/engine/inspectors/copypaste.ts';
import { splitSentences } from '../src/engine/text.ts';
import { SCORING_CONFIG } from '../src/engine/config.ts';
import type { JobRequirement, PdfTextItem } from '../src/types/index.ts';
import * as S from './fixtures/samples.ts';

const run = (cv: string, job: string) => analyze(cvFromText(cv), job, { now: S.NOW });
const ids = (r: ReturnType<typeof run>) => r.findings.map((f) => f.id);

/* ------------------------------ text utilities ------------------------------ */

test('foldText normalises Turkish and Spanish diacritics', () => {
  assert.equal(foldText('İŞÇİ ığüşöç'), 'isci igusoc');
  assert.equal(foldText('Ingeniería Años'), 'ingenieria anos');
});

test('termRegex matches whole terms only', () => {
  assert.ok(termRegex('java').test('experience with java and sql'));
  assert.ok(!termRegex('java').test('experience with javascript'));
  assert.ok(!termRegex('sql').test('mysql'));
  assert.ok(termRegex('c++').test('strong c++ skills'));
  assert.ok(termRegex('node.js').test('uses node.js daily'));
});

test('tokenEquivalent tolerates suffixes and typos but not short words', () => {
  assert.ok(tokenEquivalent('kubernetes', 'kubernetesde'));
  assert.ok(tokenEquivalent('pipeline', 'pipelines'));
  assert.ok(tokenEquivalent('analytics', 'analytcs'));
  assert.ok(!tokenEquivalent('go', 'gone'));
  assert.ok(!tokenEquivalent('sql', 'sqs'));
});

test('detectLanguage separates Turkish, English and Spanish CV text', () => {
  assert.equal(detectLanguage(S.CV_TR).lang, 'tr');
  assert.equal(detectLanguage(S.CV_STRONG_EN).lang, 'en');
  assert.equal(detectLanguage(S.CV_ES).lang, 'es');
});

test('redactPII removes e-mail, phone and profile links', () => {
  const out = redactPII('Mail me at a.b@example.com or +1 555 010 2030, see linkedin.com/in/someone');
  assert.ok(!out.includes('@example.com'));
  assert.ok(!out.includes('555 010'));
  assert.ok(!out.includes('linkedin.com/in'));
});

/* ------------------------------ job description ------------------------------ */

test('job parser: priorities come from headings and cues; company blurb and benefits are ignored', () => {
  const job = parseJobDescription(S.JOB_EN);
  const byId = new Map(job.requirements.map((r) => [r.id, r]));
  assert.equal(job.title, 'Data Engineer');
  assert.deepEqual(job.yearsRequired, { min: 3, max: null });
  assert.equal(byId.get('python')?.priority, 'required');
  assert.equal(byId.get('airflow')?.priority, 'required');
  assert.equal(byId.get('kafka')?.priority, 'preferred');
  assert.equal(byId.get('dbt')?.priority, 'preferred');
  assert.equal(byId.get('lang-english')?.kind, 'language');
  assert.equal(job.educationLevel, 'bachelor');
  assert.ok(job.hasExplicitSections);
  // "data pipelines" appears only in Responsibilities → must NOT become an ETL requirement.
  assert.ok(!byId.has('etl'));
});

test('job parser: Turkish and Spanish listings are understood', () => {
  const tr = parseJobDescription(S.JOB_TR);
  assert.equal(tr.language, 'tr');
  assert.deepEqual(tr.yearsRequired, { min: 3, max: null });
  assert.equal(tr.requirements.find((r) => r.id === 'kafka')?.priority, 'preferred');
  assert.equal(tr.requirements.find((r) => r.id === 'aws')?.priority, 'required');
  const es = parseJobDescription(S.JOB_ES);
  assert.equal(es.language, 'es');
  assert.deepEqual(es.yearsRequired, { min: 3, max: null });
  assert.equal(es.requirements.find((r) => r.id === 'kafka')?.priority, 'preferred');
});

test('job parser: a listing with no recognisable skills yields no requirements (nothing is invented)', () => {
  const job = parseJobDescription('Office Helper\nWe need a friendly person to greet visitors, answer the phone and keep the reception area tidy. The team is warm and welcoming and enjoys long lunches together.');
  assert.equal(job.requirements.length, 0);
});

/* ------------------------------ dates ------------------------------ */

test('date parser handles MM/YYYY, Month YYYY (TR/EN/ES), YYYY and present markers', () => {
  const lines = ['03/2021 - Present', 'Mart 2019 - Aralık 2020', 'enero 2015 - marzo 2017', '2012 - 2014', 'Jan 2010 – Mar 2011', '07/2018 - Halen'];
  const r = parseDateRanges(lines, S.NOW);
  assert.equal(r.length, 6);
  assert.equal(r[0].end, 'present');
  assert.equal(r[1].start.format, 'Month YYYY');
  assert.equal(r[3].start.format, 'YYYY');
  assert.equal(r[5].end, 'present');
  assert.ok(r.every((x) => !x.invalid));
});

test('date parser flags impossible ranges', () => {
  const r = parseDateRanges(['05/2020 - 03/2019'], S.NOW);
  assert.equal(r.length, 1);
  assert.equal(r[0].invalid, true);
});

test('employment gaps over six months are found; overlapping jobs are not double counted', () => {
  const ranges = parseDateRanges(['01/2015 - 12/2016', '01/2018 - 12/2019'], S.NOW);
  const periods = toPeriods(ranges, S.NOW);
  const gaps = findGaps(periods);
  assert.equal(gaps.length, 1);
  assert.ok(gaps[0].months >= 12);
  const overlap = toPeriods(parseDateRanges(['01/2015 - 12/2017', '01/2016 - 12/2016'], S.NOW), S.NOW);
  assert.equal(totalYears(overlap), 3);
});

/* ------------------------------ matching ------------------------------ */

const req = (id: string, label: string, terms: string[], impliedBy: string[] = []): JobRequirement => ({
  id, kind: 'skill', label, terms: terms.map(foldText), impliedBy, priority: 'required', sourceLine: '',
});

test('matcher: found / alias / related / fuzzy / missing', () => {
  const idx = buildCvIndex(['Deployed services on k8s', 'Tuned PostgreSQL queries', 'Wrote pipelines with Airflo', 'Excel dashboards']);
  assert.equal(matchRequirement(req('kubernetes', 'Kubernetes', ['kubernetes', 'k8s']), idx).status, 'alias');
  assert.equal(matchRequirement(req('sql', 'SQL', ['sql'], ['postgresql']), idx).status, 'related');
  assert.equal(matchRequirement(req('airflow', 'Airflow', ['airflow']), idx).status, 'fuzzy');
  assert.equal(matchRequirement(req('excel', 'Excel', ['excel']), idx).status, 'found');
  assert.equal(matchRequirement(req('rust', 'Rust', ['rust']), idx).status, 'missing');
});

test('matcher: short skill names never match fuzzily', () => {
  const idx = buildCvIndex(['Experienced in SQS queues and cargo logistics']);
  assert.equal(matchRequirement(req('sql', 'SQL', ['sql']), idx).status, 'missing');
  assert.equal(matchRequirement(req('rust', 'Rust', ['rust']), idx).status, 'missing');
});

/* ------------------------------ end-to-end analysis ------------------------------ */

test('strong, well-aligned CV scores very high and has no critical or medium findings', () => {
  const r = run(S.CV_STRONG_EN, S.JOB_EN);
  assert.ok(r.scoring.score >= 95, `score ${r.scoring.score}`);
  assert.equal(r.summary.critical, 0);
  assert.equal(r.summary.medium, 0);
  assert.equal(r.summary.clicheDensity, 0);
  assert.equal(r.requirements.filter((q) => q.priority === 'required' && q.status === 'missing').length, 0);
});

test('CV missing every required skill: one justified CRITICAL, wording never claims certainty', () => {
  const r = run(S.CV_WEAK_EN, S.JOB_EN);
  const f = r.findings.find((x) => x.id === 'ats.required-coverage')!;
  assert.equal(f.severity, 'critical');
  assert.equal(f.justificationKey, 'finding.ats.required-coverage.critical');
  assert.ok(r.scoring.score < 70);
  assert.ok(r.scoring.potentialScore > r.scoring.score);
  assert.ok(r.scoring.potentialScore <= 100);
});

test('a missing keyword alone never produces CRITICAL', () => {
  const r = run(S.CV_MIXED_DATES_EN, S.JOB_EN); // misses Airflow only among the required skills
  assert.ok(r.findings.every((f) => f.severity !== 'critical'));
});

test('every critical finding carries a justification; every finding carries evidence', () => {
  for (const [cv, job] of [[S.CV_STRONG_EN, S.JOB_EN], [S.CV_WEAK_EN, S.JOB_EN], [S.CV_CLICHE_HEAVY_EN, S.JOB_EN], [S.CV_MIXED_DATES_EN, S.JOB_EN], [S.CV_TR, S.JOB_TR], [S.CV_ES, S.JOB_ES]] as const) {
    const r = run(cv, job);
    for (const f of r.findings) {
      assert.ok(f.evidence.length > 0, `${f.id} has no evidence`);
      if (f.severity === 'critical') assert.ok(f.justificationKey, `${f.id} critical without justification`);
    }
  }
});

test('no evidence snippet leaks e-mail addresses or phone numbers', () => {
  const r = run(S.CV_STRONG_EN, S.JOB_EN);
  const blob = JSON.stringify(r);
  assert.ok(!blob.includes('alex.sample@example.com'));
  assert.ok(!blob.includes('555 010 2030'));
});

test('cliché-heavy CV: density follows (cliché sentences / analysed sentences) × 100', () => {
  const r = run(S.CV_CLICHE_HEAVY_EN, S.JOB_EN);
  const { clicheSentences, sentencesAnalyzed, clicheDensity } = r.summary;
  assert.ok(clicheDensity !== null && clicheDensity >= 30);
  assert.equal(clicheDensity, Math.round((clicheSentences / sentencesAnalyzed) * 1000) / 10);
  const f = r.findings.find((x) => x.id === 'cp.cliche-density')!;
  assert.ok(f && f.severity === 'medium');
  assert.ok(f.beforeAfter && f.beforeAfter.before);
});

test('cliché detection uses independent dictionaries per language', () => {
  const tr = scanCliches(splitSentences(['Ekip çalışmasına yatkın ve sorumluluk sahibi biriyim.']), ['tr']);
  assert.equal(tr.clicheSentences, 1);
  const es = scanCliches(splitSentences(['Persona proactiva con capacidad de adaptación al cambio.']), ['es']);
  assert.equal(es.clicheSentences, 1);
  // The English phrase list must not fire on Turkish text, and vice versa.
  const cross = scanCliches(splitSentences(['Ekip çalışmasına yatkın ve sorumluluk sahibi biriyim.']), ['en']);
  assert.equal(cross.clicheSentences, 0);
  const crossEs = scanCliches(splitSentences(['Results-driven team player with strong communication skills.']), ['es']);
  assert.equal(crossEs.clicheSentences, 0);
});

test('ordinary concrete language is not flagged as cliché', () => {
  const lines = [
    'Built Airflow pipelines on AWS that load 40 million rows per day into the warehouse.',
    'Reduced average query time by 62 percent after redesigning SQL models and partitioning tables.',
    'Migrated fourteen Python batch jobs to a streaming architecture over six months.',
    'Wrote transformations that analysts use in their daily reporting every morning.',
  ];
  const scan = scanCliches(splitSentences(lines), ['en']);
  assert.equal(scan.clicheSentences, 0);
  assert.equal(scan.vagueSentences.length, 0);
});

test('mixed date formats are reported once, as a consistency finding', () => {
  const r = run(S.CV_MIXED_DATES_EN, S.JOB_EN);
  assert.ok(ids(r).includes('ats.date-formats-mixed'));
  assert.equal(ids(r).filter((x) => x === 'ats.date-formats-mixed').length, 1);
});

test('Turkish and Spanish CVs are analysed with their own rules', () => {
  const tr = run(S.CV_TR, S.JOB_TR);
  assert.deepEqual(tr.cvLanguages, ['tr']);
  assert.ok(tr.cliches.some((c) => c.lang === 'tr'));
  assert.equal(tr.requirements.find((q) => q.id === 'lang-english')?.status, 'alias'); // "İngilizce" ↔ English
  const es = run(S.CV_ES, S.JOB_ES);
  assert.deepEqual(es.cvLanguages, ['es']);
  assert.ok(es.cliches.some((c) => c.lang === 'es'));
});

test('unreadable or too-short input is rejected with explicit error codes', () => {
  const code = (fn: () => unknown) => {
    try { fn(); } catch (e) { return e instanceof AnalysisError ? e.code : 'OTHER'; }
    return 'NONE';
  };
  assert.equal(code(() => run(S.CV_SHORT, S.JOB_EN)), 'CV_TOO_SHORT');
  assert.equal(code(() => run(S.CV_STRONG_EN, '   ')), 'JOB_EMPTY');
  assert.equal(code(() => run(S.CV_STRONG_EN, 'We need a Python person.')), 'JOB_TOO_SHORT');
  const empty = cvFromText('\n\f\n');
  assert.equal(empty.status, 'no_text');
  assert.equal(code(() => analyze(empty, S.JOB_EN)), 'CV_NO_TEXT');
});

test('analysis is deterministic', () => {
  const a = run(S.CV_WEAK_EN, S.JOB_EN);
  const b = run(S.CV_WEAK_EN, S.JOB_EN);
  assert.deepEqual(a, b);
});

/* ------------------------------ scoring ------------------------------ */

const mk = (id: string, severity: 'critical' | 'medium' | 'low', o: Partial<Parameters<typeof makeFinding>[0]> = {}) =>
  makeFinding({ id, inspector: 'ats', dimension: 'jobMatch', severity, intensity: 1, fixability: 0.5, sections: [], justificationKey: severity === 'critical' ? 'k' : null, ...o });

test('scoring: severity weights, neutral findings and dedup groups', () => {
  const base = scoreFindings([], { jobMatchAvailable: true });
  assert.equal(base.score, 100);

  const one = scoreFindings([mk('a', 'medium')], { jobMatchAvailable: true });
  assert.equal(one.score, 100 - SCORING_CONFIG.severityPoints.medium);

  const neutral = scoreFindings([mk('n', 'critical', { neutral: true })], { jobMatchAvailable: true });
  assert.equal(neutral.score, 100);

  const grouped = scoreFindings([mk('a', 'medium', { dedupGroup: 'g' }), mk('b', 'low', { dedupGroup: 'g' })], { jobMatchAvailable: true });
  assert.equal(grouped.score, 100 - SCORING_CONFIG.severityPoints.medium);
  assert.equal(grouped.deductions.find((d) => d.findingId === 'b')?.dedupedBy, 'a');
});

test('scoring: dimension caps hold and potential score never exceeds 100 or drops below the score', () => {
  const many = Array.from({ length: 10 }, (_, i) => mk(`c${i}`, 'critical'));
  const r = scoreFindings(many, { jobMatchAvailable: true });
  assert.equal(r.dimensions.jobMatch.counted, SCORING_CONFIG.dimensionCaps.jobMatch);
  assert.equal(r.score, 100 - SCORING_CONFIG.dimensionCaps.jobMatch);
  assert.ok(r.potentialScore >= r.score && r.potentialScore <= 100);
  const sum = r.deductions.reduce((s, d) => s + d.points, 0);
  assert.ok(Math.abs(sum - SCORING_CONFIG.dimensionCaps.jobMatch) < 0.6);
});

test('scoring: unfixable findings are not recovered in the potential score', () => {
  const r = scoreFindings([mk('x', 'critical', { fixability: 0 })], { jobMatchAvailable: true });
  assert.equal(r.potentialScore, r.score);
});

test('scoring is marked partial when the listing has no identifiable requirements', () => {
  const job = 'Office Helper\nWe need a friendly person to greet visitors, answer the phone and keep the reception area tidy. The team is warm and welcoming and enjoys long lunches together.';
  const r = run(S.CV_STRONG_EN, job);
  assert.equal(r.scoring.partial, true);
  assert.ok(r.warnings.includes('no_requirements_detected'));
});

test('makeFinding refuses a CRITICAL finding without a justification', () => {
  assert.throws(() => makeFinding({ id: 'x', inspector: 'ats', dimension: 'jobMatch', severity: 'critical', intensity: 1, fixability: 0, sections: [] }));
});

/* ------------------------------ PDF layout (synthetic geometry) ------------------------------ */

import { analyzeLayout, buildPage } from '../src/lib/pdf/layout.ts';

function item(str: string, x: number, y: number, width = 180): PdfTextItem {
  return { str, x, y, width, height: 10 };
}

const LEFT = Array.from({ length: 8 }, (_, i) => `Left line ${i + 1}`);
const RIGHT = Array.from({ length: 8 }, (_, i) => `Right line ${i + 1}`);

test('layout: single column page is not flagged', () => {
  const items = LEFT.map((t, i) => item(t, 50, 50 + i * 14, 480));
  const r = analyzeLayout(items, 595);
  assert.equal(r.columnCount, 1);
  assert.equal(r.interleaved, false);
});

test('layout: two columns extracted column by column are reported as 2 columns but NOT interleaved', () => {
  const items = [...LEFT.map((t, i) => item(t, 40, 80 + i * 16)), ...RIGHT.map((t, i) => item(t, 340, 80 + i * 16))];
  const r = analyzeLayout(items, 595);
  assert.equal(r.columnCount, 2);
  assert.equal(r.interleaved, false);
  // our own rebuilt order: whole left column first, then the right column
  assert.deepEqual(r.lines.slice(0, 8), LEFT);
  assert.deepEqual(r.lines.slice(8), RIGHT);
});

test('layout: raw order hopping between columns is detected as interleaved, and reading order is repaired', () => {
  const items: PdfTextItem[] = [];
  for (let i = 0; i < 8; i++) {
    items.push(item(LEFT[i], 40, 80 + i * 16));
    items.push(item(RIGHT[i], 340, 80 + i * 16));
  }
  const r = analyzeLayout(items, 595);
  assert.equal(r.columnCount, 2);
  assert.equal(r.interleaved, true);
  assert.ok(r.sideSwitches >= 10);
  assert.deepEqual(r.lines.slice(0, 8), LEFT);
});

test('layout: an empty page has no text and is reported as such', () => {
  const page = buildPage([], 1, 595, 842);
  assert.equal(page.hasText, false);
  assert.equal(page.charCount, 0);
});

test('an interleaved page produces a reading-order finding (medium, not a failure verdict)', () => {
  const cv = cvFromText(S.CV_STRONG_EN);
  cv.pages[0] = { ...cv.pages[0], columnCount: 2, gutterX: 300, interleaved: true, sideSwitches: 14 };
  const r = analyze(cv, S.JOB_EN, { now: S.NOW });
  const f = r.findings.find((x) => x.id === 'ats.reading-order');
  assert.ok(f);
  assert.equal(f!.severity, 'medium');
});

test('a clean two-column page yields only a neutral informational item', () => {
  const cv = cvFromText(S.CV_STRONG_EN);
  cv.pages[0] = { ...cv.pages[0], columnCount: 2, gutterX: 300, interleaved: false, sideSwitches: 1 };
  const r = analyze(cv, S.JOB_EN, { now: S.NOW });
  const f = r.findings.find((x) => x.id === 'ats.two-columns-info');
  assert.ok(f && f.neutral);
  assert.ok(!r.findings.some((x) => x.id === 'ats.reading-order'));
});

test('employment gaps are neutral context and never reduce the score', () => {
  const cv = `Gap Person\ngap.person@example.com\nExperience\nAnalyst, Alpha Co 01/2015 - 12/2016\n- Produced SQL reports for 5 managers every Monday and improved turnaround by 20%.\nEngineer, Beta Co 01/2019 - Present\n- Built Python and Airflow jobs on AWS handling 3 million rows per day for the finance team.\nEducation\nBSc Mathematics, Example University 2010 - 2014\nSkills\nSQL, Python, Airflow, AWS\nLanguages\nEnglish (fluent)`;
  const r = run(cv, S.JOB_EN);
  const gap = r.findings.find((f) => f.id === 'ats.employment-gap');
  assert.ok(gap && gap.neutral);
  const d = r.scoring.deductions.find((x) => x.findingId === 'ats.employment-gap');
  assert.equal(d?.points, 0);
});

/* ------------------------------ accuracy regression tests ------------------------------ */

test('regression: professional CV recognizes TypeScript, React, REST API, Figma, Git, GitHub, English B1', () => {
  const r = run(S.CV_PROFESSIONAL_FRONTEND_EN, S.JOB_FRONTEND_EN);
  const byId = new Map(r.requirements.map((req) => [req.id, req]));

  // Explicit evidence checks
  assert.equal(byId.get('typescript')?.status, 'found');
  assert.equal(byId.get('react')?.status, 'found');
  assert.equal(byId.get('restapi')?.status, 'found');
  assert.equal(byId.get('figma')?.status, 'found');
  assert.equal(byId.get('git')?.status, 'found');
  assert.equal(byId.get('github')?.status, 'found');
  assert.equal(byId.get('lang-english')?.status, 'found');

  // Related evidence check: Vitest / RTL is related testing tool, NOT exact Jest
  const jestReq = byId.get('jest');
  assert.equal(jestReq?.status, 'related');
  assert.equal(jestReq?.credit, 0.6);

  // CI/CD is genuinely absent from the CV and correctly flagged missing under preferred
  assert.equal(byId.get('cicd')?.status, 'missing');

  // Overall match must be solid: no critical finding for required coverage
  assert.ok(!r.findings.some((f) => f.id === 'ats.required-coverage' && f.severity === 'critical'));
  assert.ok(r.scoring.score >= 80, `expected score >= 80, got ${r.scoring.score}`);
});

test('regression: amateur CV recognizes Git in skills, intermediate English, work dates, and API as related', () => {
  const r = run(S.CV_AMATEUR_FRONTEND_EN, S.JOB_FRONTEND_EN);
  const byId = new Map(r.requirements.map((req) => [req.id, req]));

  // Git in skills section is recognized
  assert.equal(byId.get('git')?.status, 'found');

  // API is recognized as related evidence for REST API, not completely missing
  assert.equal(byId.get('restapi')?.status, 'related');
  assert.equal(byId.get('restapi')?.credit, 0.6);

  // Intermediate English is recognized as English proficiency claim
  assert.equal(byId.get('lang-english')?.status, 'related');
  assert.equal(byId.get('lang-english')?.credit, 0.6);

  // Section heading "Skills & Tools" was recognized: no sections-missing for skills
  const secFinding = r.findings.find((f) => f.id === 'ats.sections-missing');
  if (secFinding) {
    assert.ok(!String(secFinding.params?.missing ?? '').includes('skills'), 'skills section should be recognized');
  }

  // Work dates (2023 - Present and 2022) were recognized: no dates-missing finding
  assert.ok(!r.findings.some((f) => f.id === 'ats.dates-missing'));

  // CI/CD is genuinely absent
  assert.equal(byId.get('cicd')?.status, 'missing');
});

test('distinctions: REST API vs API, English B1 vs Intermediate, Vitest vs Jest', () => {
  const idxFull = buildCvIndex(['REST API integrations with payment gateway', 'English B1 level', 'Vitest and React Testing Library']);
  const idxPartial = buildCvIndex(['Connected to backend API endpoints', 'English (Intermediate)', 'Unit tests with Selenium']);
  const idxNone = buildCvIndex(['Developed frontend views with HTML and CSS']);

  const restReq: JobRequirement = {
    id: 'restapi', kind: 'skill', label: 'REST APIs', terms: ['rest apis', 'rest api', 'restful'], impliedBy: ['api'], priority: 'required', sourceLine: '',
  };
  const jestReq: JobRequirement = {
    id: 'jest', kind: 'skill', label: 'Jest', terms: ['jest'], impliedBy: ['vitest', 'reacttestinglibrary'], priority: 'required', sourceLine: '',
  };

  // REST API: explicit vs partial vs missing
  const restMatchFull = matchRequirement(restReq, idxFull);
  assert.ok(restMatchFull.status === 'found' || restMatchFull.status === 'alias');
  assert.equal(restMatchFull.credit, 1.0);
  assert.equal(matchRequirement(restReq, idxPartial).status, 'related');
  assert.equal(matchRequirement(restReq, idxNone).status, 'missing');

  // Jest: related vs missing (never found for Vitest)
  assert.equal(matchRequirement(jestReq, idxFull).status, 'related');
  assert.notEqual(matchRequirement(jestReq, idxFull).status, 'found');
  assert.equal(matchRequirement(jestReq, idxNone).status, 'missing');
});

