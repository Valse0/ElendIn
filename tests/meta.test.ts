import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOGS } from '../src/i18n/index.ts';
import { en } from '../src/i18n/en.ts';
import { APP_VERSION } from '../src/app/version.ts';
import { ENGINE_VERSION } from '../src/engine/config.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const uiSources = walk(join(ROOT, 'src')).filter((f) => f.endsWith('.tsx'));
const allSource = uiSources.map((f) => readFileSync(f, 'utf8')).join('\n');

test('every static t(\'…\') key used by the UI exists in the English catalogue', () => {
  const used = new Set<string>();
  for (const m of allSource.matchAll(/\bt\(\s*'([^']+)'/g)) used.add(m[1]!);
  assert.ok(used.size > 80, `expected many keys, found ${used.size}`);
  const missing = [...used].filter((k) => !(k in en));
  assert.deepEqual(missing, []);
});

test('every dynamic t(`…${x}…`) key family resolves for each possible value', () => {
  const families: Record<string, string[]> = {
    'dim.': ['jobMatch', 'structure', 'language', 'consistency'],
    'edu.': ['highschool', 'bachelor', 'master', 'phd'],
    'err.': [
      'NOT_PDF', 'FILE_EMPTY', 'FILE_TOO_LARGE', 'PASSWORD', 'INVALID_PDF', 'EXTRACTION_FAILED', 'CANCELLED',
      'CV_MISSING', 'CV_NO_TEXT', 'CV_TOO_SHORT', 'JOB_EMPTY', 'JOB_TOO_SHORT', 'ANALYSIS_FAILED', 'EXPORT_FAILED',
    ],
    'insp.': ['ats', 'hr', 'murat', 'security', 'benchmarker', 'copypaste'].flatMap((i) => [`${i}.name`, `${i}.tag`]),
    'report.req.': ['required', 'preferred', 'unspecified', 'found', 'alias', 'fuzzy', 'related', 'missing'],
    'report.warn.': ['no_requirements_detected', 'priorities_not_explicit', 'cv_truncated', 'empty_pages', 'job_language_differs'],
    'section.': ['summary', 'experience', 'education', 'skills', 'languages', 'certifications', 'projects', 'other'],
    'sev.': ['critical', 'medium', 'low', 'neutral'],
    'how.': [1, 2, 3, 4].flatMap((n) => [`${n}.title`, `${n}.body`]),
  };
  // Make sure each family is actually used in the source, so this list cannot rot silently.
  for (const prefix of Object.keys(families)) {
    assert.ok(allSource.includes('`' + prefix) || allSource.includes(prefix), `family ${prefix} is not used any more`);
  }
  const missing: string[] = [];
  for (const [prefix, values] of Object.entries(families)) {
    for (const v of values) if (!((prefix + v) in en)) missing.push(prefix + v);
  }
  assert.deepEqual(missing, []);
});

test('every dynamic key family used in the source is covered by the test above', () => {
  const used = new Set<string>();
  for (const m of allSource.matchAll(/\bt\(\s*`([a-zA-Z.]+?)\.?\$\{/g)) used.add(m[1]!);
  const covered = new Set(['dim', 'edu', 'err', 'insp', 'report.req', 'report.warn', 'section', 'sev', 'how']);
  const uncovered = [...used].filter((p) => !covered.has(p));
  assert.deepEqual(uncovered, []);
});

test('catalogues stay in sync', () => {
  const keys = Object.keys(en).sort();
  for (const lang of ['tr', 'es'] as const) {
    assert.deepEqual(Object.keys(CATALOGS[lang]).sort(), keys, `${lang} catalogue differs from en`);
  }
});

test('versions agree: VERSION file, package.json, APP_VERSION', () => {
  const file = readFileSync(join(ROOT, 'VERSION'), 'utf8').trim();
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string };
  assert.equal(pkg.version, file);
  assert.equal(APP_VERSION, file);
  assert.match(ENGINE_VERSION, /^\d+\.\d+\.\d+(?:-[\w.]+)?$/);
});

test('PWA manifest is valid and its icons exist', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'public/manifest.webmanifest'), 'utf8')) as {
    name: string; short_name: string; start_url: string; display: string; background_color: string; theme_color: string;
    icons: { src: string; sizes: string; type: string; purpose?: string }[];
  };
  assert.equal(manifest.short_name, 'ElendIn');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color.toLowerCase(), '#21232e');
  const sizes = manifest.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
  assert.ok(manifest.icons.some((i) => i.purpose?.includes('maskable')));
  for (const icon of manifest.icons) assert.ok(existsSync(join(ROOT, 'public', icon.src)), `missing icon ${icon.src}`);
});

test('service worker never touches non-GET or cross-origin requests and holds no CV data', () => {
  const sw = readFileSync(join(ROOT, 'public/sw.js'), 'utf8');
  assert.match(sw, /request\.method\s*!==\s*'GET'/);
  assert.match(sw, /origin/);
  assert.doesNotMatch(sw, /postMessage|FormData|indexedDB|localStorage/);
});

test('brand rules in CSS: no gradients, no shadows, no rounded corners', () => {
  const css = readFileSync(join(ROOT, 'src/styles/main.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /gradient\(/);
  assert.doesNotMatch(css, /box-shadow\s*:\s*[^n\s]/);
  assert.doesNotMatch(css, /border-radius\s*:\s*[^0\s]/);
});

test('the report/share code never prints job title, file name or CV text on the share card', () => {
  const card = readFileSync(join(ROOT, 'src/components/report/ShareCard.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  // Only these fields of the result may be read by the card.
  const reads = [...card.matchAll(/\b(?:result|s)\.([a-zA-Z.]+)/g)].map((m) => m[1]);
  const allowed = new Set(['summary', 'scoring.score', 'critical', 'clicheDensity', 'requirementsMissing', 'requirementsPartial']);
  for (const r of reads) assert.ok(allowed.has(r!), `ShareCard reads unexpected field: ${r}`);
  assert.doesNotMatch(card, /result\.(job|cv|findings|requirements|improvement)\b|\bfileName\b/);
});
