import type {
  EducationLevel,
  JobDescription,
  JobRequirement,
  RequirementPriority,
  Seniority,
} from '../types/index.ts';
import {
  CONCEPT_IDS,
  EDUCATION_RANK,
  EDUCATION_TERMS,
  LANGUAGE_CONTEXT,
  LEXICON,
  SPOKEN_LANGUAGES,
} from './lexicon.ts';
import { detectLanguage, foldText, termRegex, tokenize, truncate } from './text.ts';

/**
 * Turns pasted job-listing text into structured requirements.
 *
 * Priority of a requirement comes from (1) cue words on its own line, then (2) the heading of
 * the section it sits in. Sections such as "About us" / "Benefits" are ignored so that a
 * company blurb never creates requirements. Nothing is inferred from a sentence merely
 * because it exists: a skill must be a known term or appear in an explicit skills list.
 */

type SectionKind = 'required' | 'preferred' | 'responsibilities' | 'ignore' | 'none';

const HEADER_REQUIRED =
  /(requirements?|qualifications?|what you'?ll need|must[- ]haves?|minimum qualifications|about you|who you are|key skills|skills|aranan nitelikler|nitelikler|gereksinimler|aranan ozellikler|adayda aranan|beklentiler|sizde|requisitos|requerimientos|perfil buscado|se requiere|lo que buscamos|habilidades requeridas|conocimientos)/;
const HEADER_PREFERRED =
  /(nice[- ]to[- ]haves?|preferred|bonus|good to have|desirable|a plus|tercih|avantaj|artilar|arti olarak|deseable|se valorara|valorable|diferencial|plus points)/;
const HEADER_RESP =
  /(responsibilities|what you'?ll do|duties|the role|your role|sorumluluklar|is tanimi|gorevler|yapacaginiz|responsabilidades|funciones|tareas|lo que haras|tus funciones)/;
const HEADER_IGNORE =
  /(about us|who we are|our company|company overview|benefits|what we offer|perks|why join|hakkimizda|biz kimiz|sirketimiz|yan haklar|sunduklarimiz|neler sunuyoruz|sobre nosotros|quienes somos|que ofrecemos|beneficios|ofrecemos)/;

const CUE_PREFERRED =
  /\b(?:nice to have|preferred|preferably|a plus|is a plus|bonus|desirable|ideally|advantage|good to have|tercih|avantaj|artisi|arti olarak|tercihen|deseable|valorable|se valorara|preferiblemente|diferencial)/;
const CUE_REQUIRED =
  /\b(?:must|required|mandatory|essential|minimum|at least|proven|strong knowledge|zorunlu|sart|gerekli|en az|olmazsa olmaz|mutlaka|imprescindible|obligatorio|indispensable|minimo|debe\b|se requiere|necesario|requirements?|qualifications?|nitelikler?|gereksinimler?|requisitos?|requerimientos?)/;

const BULLET = /^[\s•·▪●■►*\-–—>▪●■►•]+/u;

function classifyHeader(line: string): SectionKind | null {
  const raw = line.replace(BULLET, '').trim();
  if (!raw || raw.length > 60) return null;
  if (BULLET.test(line) && !/:$/.test(raw)) return null;
  const words = raw.split(/\s+/).length;
  const endsColon = /:$/.test(raw);
  if (!endsColon && (words > 6 || /[.,;]/.test(raw))) return null;
  const f = foldText(raw.replace(/:$/, ''));
  // Order matters: "nice to have skills" must be preferred, "about you" required.
  if (HEADER_IGNORE.test(f)) return 'ignore';
  if (HEADER_PREFERRED.test(f)) return 'preferred';
  if (HEADER_RESP.test(f)) return 'responsibilities';
  if (HEADER_REQUIRED.test(f)) return 'required';
  return null;
}

function lineCue(folded: string): RequirementPriority | null {
  if (CUE_PREFERRED.test(folded)) return 'preferred';
  if (CUE_REQUIRED.test(folded)) return 'required';
  return null;
}

const RANK: Record<RequirementPriority, number> = { required: 3, preferred: 2, unspecified: 1 };

/* ------------------------------------------------------------------ */
/* Title, seniority, years, education                                  */
/* ------------------------------------------------------------------ */

const TITLE_LABEL = /^(?:job title|title|position|role|pozisyon|unvan|ilan basligi|puesto|cargo|vacante)\s*[:\-]\s*(.+)$/i;

export function extractTitle(lines: string[]): string | null {
  for (const l of lines.slice(0, 12)) {
    const m = foldText(l).match(TITLE_LABEL);
    if (m) {
      const idx = l.search(/[:\-]/);
      const t = l.slice(idx + 1).trim();
      if (t && t.length <= 90) return t;
    }
  }
  const first = lines[0]?.replace(BULLET, '').trim();
  if (first && first.length <= 70 && first.split(/\s+/).length <= 9 && !/[.!?;]$/.test(first) && !classifyHeader(first) && !/^(we|our|about|join|at |biz|nosotros|somos)/i.test(first)) {
    return first.replace(/\s*[-–|]\s*(remote|hybrid|uzaktan|hibrit|remoto|h[ií]brido)$/i, '').trim();
  }
  return null;
}

const SENIORITY_RULES: Array<[RegExp, Seniority]> = [
  [/\b(intern|internship|stajyer|practicante|trainee|junior|jr\.?|entry[- ]level|yeni mezun|becario)\b/, 'junior'],
  [/\b(head of|director|principal|staff|lead|team lead|tech lead|manager|muduru|mudur|yonetici|takim lideri|lider|gerente|jefe|coordinador|responsable de equipo)\b/, 'lead'],
  [/\b(senior|sr\.?|kidemli|experimentado|sr)\b/, 'senior'],
  [/\b(mid|mid-level|intermediate|uzman|specialist|especialista|analista|analyst)\b/, 'mid'],
];

export function inferSeniority(title: string | null, headLines: string[], yearsMin: number | null): Seniority {
  const hay = foldText([title ?? '', ...headLines.slice(0, 3)].join(' '));
  for (const [rx, s] of SENIORITY_RULES) if (rx.test(hay)) return s;
  if (yearsMin !== null) {
    if (yearsMin >= 8) return 'lead';
    if (yearsMin >= 5) return 'senior';
    if (yearsMin >= 3) return 'mid';
    return 'junior';
  }
  return 'unknown';
}

const YEARS_UNIT = '(?:years?|yrs?|yil(?:lik)?|anos?)';
const EXP_WORD = /(experience|exp\b|deneyim|tecrube|experiencia|trayectoria|background|calisma|work)/;

export function extractYearsRequired(lines: string[]): { min: number; max: number | null } | null {
  for (const line of lines) {
    const f = foldText(line);
    if (!EXP_WORD.test(f)) continue;
    if (/(founded|established|since \d|years ago|yil once|kuruldu|hace \d+ anos|fundada|fundado)/.test(f)) continue;
    let m = f.match(new RegExp(`(\\d{1,2})\\s*(?:-|to|ila|ile|a|y|–)\\s*(\\d{1,2})\\s*\\+?\\s*${YEARS_UNIT}`));
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (b >= a && b <= 40) return { min: a, max: b };
    }
    m = f.match(new RegExp(`(\\d{1,2})\\s*\\+\\s*${YEARS_UNIT}`));
    if (m) return { min: Number(m[1]), max: null };
    m = f.match(new RegExp(`(?:at least|minimum|min\\.?|en az|minimo(?: de)?|al menos|over|more than)\\s*(\\d{1,2})\\s*${YEARS_UNIT}`));
    if (m) return { min: Number(m[1]), max: null };
    m = f.match(new RegExp(`(\\d{1,2})\\s*${YEARS_UNIT}`));
    if (m && Number(m[1]) <= 40) return { min: Number(m[1]), max: null };
  }
  return null;
}

export function extractEducationLevel(lines: string[]): EducationLevel | null {
  let best: EducationLevel | null = null;
  for (const line of lines) {
    const f = foldText(line);
    (Object.keys(EDUCATION_TERMS) as EducationLevel[]).forEach((lvl) => {
      if (EDUCATION_TERMS[lvl].some((t) => termRegex(foldText(t)).test(f))) {
        if (best === null || EDUCATION_RANK[lvl] > EDUCATION_RANK[best]) best = lvl;
      }
    });
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Main parser                                                         */
/* ------------------------------------------------------------------ */

const SOFT_WORDS = /(communicat|iletisim|comunicacion|team|takim|equipo|problem|cozum|solucion|motivat|dinamik|dinamic|analytical|analitik|leader|liderlik|sorumluluk|responsab|adapt|uyum|detail|detay|detalle|creativ|yaratic|creatividad)/;

const GENERIC_SUFFIX = /\s+(bilgisi|deneyimi|tecrubesi|knowledge|experience|skills?|experiencia|conocimientos?|becerisi)$/i;
const NOT_A_SKILL = /\b(years?|yil|yillik|anos?|degree|bachelor|master|lisans|licenciatura|diploma|university|universite|universidad|salary|maas|remote|hybrid|uzaktan|presencial)\b/;

function extraSkillTokens(line: string): string[] {
  const body = line.replace(BULLET, '').replace(/^[^:]{0,40}:\s*/, '');
  if (!/[,;|]/.test(body) && !/\s\/\s/.test(body)) return [];
  const parts = body.split(/[,;|]|\s\/\s/).map((p) => p.trim().replace(/[.)]+$/g, '').replace(/^[(]+/, '').replace(GENERIC_SUFFIX, '').trim());
  if (parts.length < 3) return [];
  const out: string[] = [];
  for (const p of parts) {
    const words = p.split(/\s+/);
    if (p.length < 2 || p.length > 28 || words.length > 3) continue;
    const fp = foldText(p);
    if (SOFT_WORDS.test(fp) || NOT_A_SKILL.test(fp) || /^\d+$/.test(fp)) continue;
    // Tool-like tokens only: Capitalised, or containing digits / + / # / .
    if (!/^\p{Lu}|[0-9+#.]/u.test(p)) continue;
    if (/^(and|or|ve|veya|y|o|etc|vb)\.?$/i.test(p)) continue;
    if (LEXICON.some((e) => e.terms.some((t) => termRegex(t).test(fp)))) continue;
    if (SPOKEN_LANGUAGES.some((l) => l.terms.some((t) => termRegex(t).test(fp)))) continue;
    out.push(p);
  }
  return out.slice(0, 8);
}

function slug(s: string): string {
  return `x-${foldText(s).replace(/[^a-z0-9+#.]+/g, '-').replace(/^-+|-+$/g, '')}`;
}

export function parseJobDescription(rawText: string): JobDescription {
  const text = rawText.replace(/\r\n?/g, '\n');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const guess = detectLanguage(text);

  const reqMap = new Map<string, JobRequirement>();
  const responsibilities: string[] = [];
  let section: SectionKind = 'none';
  let hasExplicitSections = false;

  const upsert = (req: JobRequirement) => {
    const prev = reqMap.get(req.id);
    if (!prev) {
      reqMap.set(req.id, req);
      return;
    }
    if (RANK[req.priority] > RANK[prev.priority]) {
      reqMap.set(req.id, { ...prev, priority: req.priority, sourceLine: req.sourceLine });
    }
  };

  for (const line of lines) {
    const header = classifyHeader(line);
    if (header) {
      section = header;
      if (header === 'required' || header === 'preferred') hasExplicitSections = true;
      continue;
    }
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && colonIdx < 40) {
      const prefix = line.slice(0, colonIdx).replace(BULLET, '').trim();
      const prefHeader = classifyHeader(prefix + ':');
      if (prefHeader) {
        section = prefHeader;
        if (prefHeader === 'required' || prefHeader === 'preferred') hasExplicitSections = true;
      }
    }
    if (section === 'ignore') continue;

    const folded = foldText(line);
    const cue = lineCue(folded);
    const sectionPriority: RequirementPriority | null = section === 'required' ? 'required' : section === 'preferred' ? 'preferred' : null;
    const priority: RequirementPriority = cue ?? sectionPriority ?? 'unspecified';

    if (section === 'responsibilities' && responsibilities.length < 12) responsibilities.push(truncate(line.replace(BULLET, ''), 160));

    // 1. lexicon skills / certifications
    const matchedEntries = LEXICON.filter((entry) => entry.terms.some((t) => termRegex(t).test(folded)));
    const suppressed = new Set<string>();
    if (matchedEntries.some((e) => e.id === 'restapi')) suppressed.add('api');

    for (const entry of matchedEntries) {
      if (suppressed.has(entry.id)) continue;
      if (section === 'responsibilities' && !cue && CONCEPT_IDS.has(entry.id)) continue;
      upsert({
        id: entry.id,
        kind: entry.kind,
        label: entry.label,
        terms: entry.terms,
        impliedBy: entry.impliedBy,
        priority: section === 'responsibilities' && !cue ? 'unspecified' : priority,
        sourceLine: truncate(line, 160),
      });
    }

    // 2. explicit comma-separated skill lists in requirement-like sections
    if (section === 'required' || section === 'preferred' || /(skills|beceriler|yetenekler|habilidades|tools|teknolojiler|stack)\s*:/.test(folded)) {
      for (const tok of extraSkillTokens(line)) {
        const ft = foldText(tok);
        const id = slug(tok);
        upsert({ id, kind: 'skill', label: tok, terms: [ft], impliedBy: [], priority, sourceLine: truncate(line, 160) });
      }
    }

    // 3. spoken languages (only when the line talks about proficiency / level)
    if (LANGUAGE_CONTEXT.test(folded)) {
      for (const lang of SPOKEN_LANGUAGES) {
        if (lang.terms.some((t) => termRegex(t).test(folded))) {
          const cefrMatch = folded.match(/\b(b1|b2|c1|c2|a1|a2)\b/i);
          const levelMeta = cefrMatch ? `${lang.id}:${cefrMatch[1].toLowerCase()}` : lang.id;
          upsert({
            id: `lang-${lang.id}`,
            kind: 'language',
            label: lang.label,
            terms: lang.terms,
            impliedBy: [],
            priority,
            sourceLine: truncate(line, 160),
            meta: levelMeta,
          });
        }
      }
    }
  }

  const yearsRequired = extractYearsRequired(lines.filter((l) => !HEADER_IGNORE.test(foldText(l))));
  const title = extractTitle(lines);
  const educationLevel = extractEducationLevel(lines.filter((l) => !/(about us|hakkimizda|sobre nosotros)/.test(foldText(l))));
  const requirements = Array.from(reqMap.values());

  if (educationLevel) {
    const eduLine = lines.find((l) => EDUCATION_TERMS[educationLevel].some((t) => termRegex(foldText(t)).test(foldText(l)))) ?? '';
    const cue = lineCue(foldText(eduLine));
    requirements.push({
      id: `edu-${educationLevel}`,
      kind: 'education',
      label: educationLevel,
      terms: EDUCATION_TERMS[educationLevel].map(foldText),
      impliedBy: [],
      priority: cue ?? 'unspecified',
      sourceLine: truncate(eduLine, 160),
      meta: educationLevel,
    });
  }

  return {
    charCount: text.length,
    wordCount: tokenize(foldText(text)).length,
    language: guess.lang,
    title,
    seniority: inferSeniority(title, lines, yearsRequired?.min ?? null),
    yearsRequired,
    educationLevel,
    requirements,
    responsibilities,
    hasExplicitSections,
  };
}
