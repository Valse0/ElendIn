import type { Finding, Lang } from '../types/index.ts';
import { en } from './en.ts';
import type { MessageKey } from './en.ts';
import { es } from './es.ts';
import { tr } from './tr.ts';

export type { MessageKey } from './en.ts';

export const CATALOGS: Record<Lang, Record<MessageKey, string>> = { en, tr, es };
export const LANGUAGE_LABELS: Record<Lang, string> = { tr: 'Türkçe', en: 'English', es: 'Español' };

export type Params = Record<string, string | number>;

/** Replace {name} placeholders. Unknown placeholders are left visible so a missing param is noticed in review. */
export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

export function translate(lang: Lang, key: string, params?: Params): string {
  const cat = CATALOGS[lang] as Record<string, string>;
  const msg = cat[key] ?? (en as Record<string, string>)[key] ?? key;
  return interpolate(msg, params);
}

export function hasKey(key: string): key is MessageKey {
  return key in en;
}

export function detectBrowserLanguage(nav: { languages?: readonly string[]; language?: string } | undefined): Lang {
  const list = nav?.languages?.length ? nav.languages : nav?.language ? [nav.language] : [];
  for (const l of list) {
    const code = l.toLowerCase().slice(0, 2);
    if (code === 'tr' || code === 'es' || code === 'en') return code;
  }
  return 'en';
}

const SECTION_KEYS = new Set(['summary', 'experience', 'education', 'skills', 'languages', 'certifications', 'projects', 'other']);

/**
 * Engine params are language-neutral (section ids, education level ids). This turns them into display text
 * for the chosen language right before interpolation.
 */
export function localizeParams(lang: Lang, params: Record<string, string | number>): Params {
  const out: Params = { ...params };
  if (typeof out.missing === 'string' && out.missing.split(', ').every((s) => SECTION_KEYS.has(s))) {
    out.missing = out.missing.split(', ').map((s) => translate(lang, `section.${s}`)).join(', ');
  }
  if (typeof out.level === 'string') out.level = translate(lang, `edu.${out.level}`);
  return out;
}

export interface FindingText {
  title: string;
  why: string;
  fix: string;
  after: string | null;
  justification: string | null;
}

/** All display text for a finding, resolved in one place so the screen, the PDF and the tests agree. */
export function findingText(lang: Lang, f: Finding): FindingText {
  const params = localizeParams(lang, f.params);
  const base = `finding.${f.id}`;
  let why = translate(lang, `${base}.why`, params);
  if (f.id === 'cp.cliche-density' && f.params.high === 1) why += ` ${translate(lang, `${base}.high`)}`;
  return {
    title: translate(lang, `${base}.title`, params),
    why,
    fix: translate(lang, `${base}.fix`, params),
    after: f.beforeAfter ? translate(lang, f.beforeAfter.afterKey, localizeParams(lang, f.beforeAfter.afterParams)) : null,
    justification: f.justificationKey ? translate(lang, f.justificationKey) : null,
  };
}
