import type { CvDocument, EducationLevel, SectionKey } from '../types/index.ts';
import { claimedYears, findGaps, findOpenEndedStarts, formatsUsed, parseDateRanges, toPeriods, totalYears } from './dates.ts';
import type { DateFormat, DateRange, Gap } from './dates.ts';
import { EDUCATION_RANK, EDUCATION_TERMS, UNIVERSITY_WORDS } from './lexicon.ts';
import { foldText, termRegex, tokenize } from './text.ts';

/**
 * Structural parse of a CV: sections, dates, experience length, contact presence.
 * Everything here is derived from extracted text only.
 */

const HEADINGS: Array<[SectionKey, RegExp]> = [
  ['summary', /^(summary|professional summary|executive summary|profile|professional profile|about me|about|objective|career objective|career summary|overview|personal summary|ozet|profil|hakkimda|kariyer hedefi|ozgecmis ozeti|kisisel ozet|perfil|perfil profesional|resumen|resumen profesional|sobre mi|objetivo|objetivo profesional)$/],
  ['experience', /^(experience|work experience|professional experience|employment|employment history|work history|career history|relevant experience|experience history|relevant work experience|internships & experience|is deneyimi|deneyim|deneyimler|calisma gecmisi|profesyonel deneyim|is tecrubesi|kariyer|is ve staj deneyimi|experiencia|experiencia laboral|experiencia profesional|historial laboral|trayectoria profesional|trayectoria|experiencia laboral y profesional)$/],
  ['education', /^(education|academic background|education and training|education & training|academic history|degrees|studies|egitim|egitim bilgileri|egitim durumu|egitim ve ogretim|akademik gecmis|educacion|formacion|formacion academica|estudios|estudios realizados)$/],
  ['skills', /^(skills|technical skills|key skills|core competencies|competencies|tools|technologies|tech stack|technical stack|technical proficiencies|tools & technologies|tools and technologies|skills & tools|skills and tools|skills & technologies|skills and technologies|technical skills & tools|core skills|technical competencies|programming languages|software skills|computer skills|stack|yetenekler|beceriler|teknik beceriler|yetkinlikler|teknik yetkinlikler|araclar|araclar ve teknolojiler|yetenekler ve araclar|habilidades|habilidades tecnicas|competencias|conocimientos|herramientas|conocimientos tecnicos|habilidades y herramientas)$/],
  ['languages', /^(languages|language|language skills|foreign languages|languages & tools|diller|yabanci dil|yabanci diller|dil bilgisi|idiomas|lenguas)$/],
  ['certifications', /^(certifications|certificates|licenses|courses|training|trainings|certifications and courses|certifications & courses|certificates & licenses|licenses & certifications|sertifikalar|sertifikalar ve kurslar|kurslar|egitimler ve sertifikalar|certificaciones|certificados|cursos|capacitaciones)$/],
  ['projects', /^(projects|selected projects|key projects|personal projects|academic projects|projects & portfolio|projeler|kisisel projeler|proyectos|proyectos personales|proyectos destacados)$/],
  ['other', /^(interests|hobbies|references|volunteer|volunteering|awards|publications|achievements|honors & awards|ilgi alanlari|hobiler|referanslar|gonulluluk|oduller|yayinlar|basarilar|intereses|aficiones|referencias|voluntariado|premios|publicaciones|logros)$/],
];

export interface CvSection {
  key: SectionKey;
  headingLine: number;
  lines: string[];
  /** index (into the CV's line array) of the first content line */
  startLine: number;
}

export interface ParsedCv {
  lines: string[];
  foldedFull: string;
  sections: Partial<Record<SectionKey, CvSection>>;
  headingsFound: SectionKey[];
  hasEmail: boolean;
  hasPhone: boolean;
  /** Date ranges inside the experience section (or whole CV when no experience heading exists). */
  experienceRanges: DateRange[];
  experienceLines: string[];
  dateFormats: DateFormat[];
  openEnded: number[];
  periodsYears: number;
  claimedYears: number;
  gaps: Gap[];
  educationRank: number;
  /** Lines of the experience section that look like bullet / description lines. */
  experienceBullets: Array<{ text: string; lineIndex: number }>;
}

function collapseSpacedLetters(line: string): string {
  const t = line.trim();
  return /^(?:\p{L}\s){3,}\p{L}$/u.test(t) ? t.replace(/\s+/g, '') : t;
}

function headingKey(line: string): SectionKey | null {
  const t = collapseSpacedLetters(line).replace(/[:：]+$/, '').trim();
  if (!t || t.length > 40) return null;
  if (t.split(/\s+/).length > 5) return null;
  const f = foldText(t)
    .replace(/[/+]/g, ' & ')
    .replace(/[^\p{L}\p{N}\s&]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [key, rx] of HEADINGS) if (rx.test(f)) return key;
  return null;
}

export function splitSections(lines: string[]): { sections: Partial<Record<SectionKey, CvSection>>; found: SectionKey[] } {
  const sections: Partial<Record<SectionKey, CvSection>> = {};
  const found: SectionKey[] = [];
  let current: CvSection | null = null;
  lines.forEach((line, i) => {
    const key = headingKey(line);
    if (key) {
      const sec: CvSection = { key, headingLine: i, lines: [], startLine: i + 1 };
      // The first occurrence of a heading is stored; repeats (e.g. several "other" blocks)
      // still terminate the previous section but their content is not merged.
      if (!sections[key]) {
        sections[key] = sec;
        found.push(key);
      }
      current = sec;
      return;
    }
    if (current) current.lines.push(line);
  });
  return { sections, found };
}

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const PHONE = /(?<!\d)(?:\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]\d{3,4}(?!\d)|(?<!\d)\+\d{9,15}(?!\d)|\b(?:tel|phone|mobil|cep|gsm)\b/i;

function cvEducationRank(folded: string): number {
  let rank = 0;
  (Object.keys(EDUCATION_TERMS) as EducationLevel[]).forEach((lvl) => {
    if (EDUCATION_TERMS[lvl].some((t) => termRegex(foldText(t)).test(folded))) rank = Math.max(rank, EDUCATION_RANK[lvl]);
  });
  if (rank < EDUCATION_RANK.bachelor && UNIVERSITY_WORDS.some((w) => termRegex(w).test(folded))) rank = EDUCATION_RANK.bachelor;
  return rank;
}

export function parseCv(cv: Pick<CvDocument, 'lines'>, now: Date): ParsedCv {
  const lines = cv.lines;
  const foldedFull = foldText(lines.join('\n'));
  const { sections, found } = splitSections(lines);

  const exp = sections.experience;
  const experienceLines = exp ? exp.lines : lines.filter((_, i) => {
    // No experience heading: use every line outside education / projects / certifications.
    const outside = (['education', 'projects', 'certifications'] as SectionKey[]).some((k) => {
      const s = sections[k];
      return s && i >= s.startLine && i < s.startLine + s.lines.length;
    });
    return !outside;
  });

  const experienceRanges = parseDateRanges(experienceLines, now);
  const periods = toPeriods(experienceRanges, now);
  const eduSection = sections.education?.lines.join(' ') ?? '';
  const eduFolded = foldText(eduSection || lines.join(' '));

  const bullets: ParsedCv['experienceBullets'] = [];
  experienceLines.forEach((text, i) => {
    const words = tokenize(foldText(text)).length;
    const isBullet = /^[\s]*[•·▪●■►*\-–—>▪●■►•]/u.test(text);
    const hasDate = parseDateRanges([text], now).length > 0;
    if ((isBullet || words >= 7) && !hasDate && words >= 4) bullets.push({ text: text.replace(/^[\s•·▪●■►*\-–—>▪●■►•]+/u, ''), lineIndex: (exp ? exp.startLine : 0) + i });
  });

  return {
    lines,
    foldedFull,
    sections,
    headingsFound: found,
    hasEmail: EMAIL.test(lines.join('\n')),
    hasPhone: PHONE.test(lines.join('\n')),
    experienceRanges,
    experienceLines,
    dateFormats: formatsUsed(experienceRanges),
    openEnded: findOpenEndedStarts(experienceLines),
    periodsYears: totalYears(periods),
    claimedYears: claimedYears(foldedFull),
    gaps: findGaps(periods),
    educationRank: cvEducationRank(eduFolded),
    experienceBullets: bullets,
  };
}
