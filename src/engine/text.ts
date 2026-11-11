import type { Lang } from '../types/index.ts';

/**
 * Text utilities shared by every inspector.
 * `foldText` produces a diacritic-free, case-free form so that Turkish (İ ı ş ğ ç ö ü),
 * Spanish (ñ á é í ó ú ü) and English text can be compared with one set of patterns.
 */

const DASHES = /[‐-―−]/g;
const QUOTES = /[‘’‚‛′]/g;
const DQUOTES = /[“”„‟]/g;
const SPACES = /[  -​  　]/g;

export function foldText(input: string): string {
  return input
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .replace(DASHES, '-')
    .replace(QUOTES, "'")
    .replace(DQUOTES, '"')
    .replace(SPACES, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/ß/g, 'ss');
}

/** Escape a string for use inside a RegExp. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/**
 * Whole-term regex over folded text. A term must not be glued to letters or digits,
 * so "java" does not match "javascript" and "sql" does not match "mysql".
 */
export function termRegex(foldedTerm: string, flags = 'u'): RegExp {
  const body = escapeRegExp(foldedTerm).replace(/\s+/g, '\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, flags);
}

export function tokenize(folded: string): string[] {
  return folded.match(/[\p{L}\p{N}]+(?:[+#]+|\.[\p{L}\p{N}]+)*/gu) ?? [];
}

export function wordCount(s: string): number {
  return tokenize(foldText(s)).length;
}

/** Optimal-string-alignment (restricted Damerau–Levenshtein) distance with an early cut-off. */
export function editDistance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  let prev2: number[] = new Array(lb + 1).fill(0);
  let prev: number[] = Array.from({ length: lb + 1 }, (_, j) => j);
  for (let i = 1; i <= la; i++) {
    const cur: number[] = new Array(lb + 1).fill(0);
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[lb];
}

/**
 * Are two folded tokens "the same word" for matching purposes?
 * - identical, or
 * - one typo/transposition apart for words of 6+ letters (two for 10+), or
 * - a suffixed form (covers Turkish agglutination, Spanish/English plurals and -ing/-ment forms):
 *   `b` starts with `a` (len >= 5) and carries at most 5 extra letters.
 */
export function tokenEquivalent(a: string, b: string): boolean {
  if (a === b) return true;
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  if (short.length >= 5 && long.startsWith(short) && long.length - short.length <= 5) return true;
  if (short.length >= 6 && short[0] === long[0]) {
    const max = short.length >= 10 ? 2 : 1;
    return editDistance(a, b, max) <= max;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Language detection                                                  */
/* ------------------------------------------------------------------ */

const STOP: Record<Lang, Set<string>> = {
  tr: new Set(
    've ile icin bir bu olarak gibi daha cok da de ki ise veya olan uzerinde tarafindan deneyim yil calistim gelistirdim yonettim sorumlu sirket proje musteri ekip alaninda en az sonra kadar hem ama ya'.split(' '),
  ),
  en: new Set(
    'the and of to in for with on a an is as by at from that this was were are be have has experience managed developed worked team years including using across over into their our your'.split(' '),
  ),
  es: new Set(
    'de la el en y que los las con para por un una del se al su como mas experiencia empresa gestion desarrolle trabaje equipo anos incluyendo mediante sobre entre sus nuestro tu es fue son'.split(' '),
  ),
};

export interface LanguageGuess {
  lang: Lang;
  shares: Record<Lang, number>;
}

export function detectLanguage(text: string): LanguageGuess {
  const raw = text;
  const tokens = tokenize(foldText(text));
  const score: Record<Lang, number> = { tr: 0, en: 0, es: 0 };
  for (const t of tokens) {
    if (STOP.tr.has(t)) score.tr += 1;
    if (STOP.en.has(t)) score.en += 1;
    if (STOP.es.has(t)) score.es += 1;
  }
  // Letters that are (near) unique to one language are strong evidence.
  score.tr += 3 * (raw.match(/[ışğİŞĞ]/g)?.length ?? 0);
  score.es += 3 * (raw.match(/[ñ¿¡]/gi)?.length ?? 0) + 0.5 * (raw.match(/[áéíóú]/gi)?.length ?? 0);
  const total = score.tr + score.en + score.es;
  if (total === 0) return { lang: 'en', shares: { tr: 0, en: 1, es: 0 } };
  const shares: Record<Lang, number> = { tr: score.tr / total, en: score.en / total, es: score.es / total };
  const lang = (Object.keys(shares) as Lang[]).reduce((best, k) => (shares[k] > shares[best] ? k : best), 'en' as Lang);
  return { lang, shares };
}

/** Languages worth scanning with language-specific dictionaries: the dominant one plus any with >= 30% share. */
export function activeLanguages(guess: LanguageGuess): Lang[] {
  const out: Lang[] = [guess.lang];
  (Object.keys(guess.shares) as Lang[]).forEach((l) => {
    if (l !== guess.lang && guess.shares[l] >= 0.3) out.push(l);
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Sentences                                                           */
/* ------------------------------------------------------------------ */

export interface SentenceUnit {
  text: string;
  folded: string;
  lineIndex: number;
}

const BULLET = /^[\s•·▪●■►‣⁃◦*\-–—>»▪●■►•]+/u;

/** True for lines that are not prose: contact details, dates only, skill lists, short headings. */
export function isNonProse(line: string): boolean {
  const f = foldText(line);
  const tokens = tokenize(f);
  if (tokens.length < 4) return true;
  if (/@|https?:\/\/|www\./.test(f)) return true;
  const commas = (line.match(/[,;|]/g) ?? []).length;
  if (commas >= 3 && commas >= tokens.length / 3) return true;
  const digits = (f.match(/\d/g) ?? []).length;
  if (digits > f.length * 0.35) return true;
  return false;
}

/** Split CV lines into analysable sentences (prose only). */
export function splitSentences(lines: string[]): SentenceUnit[] {
  const out: SentenceUnit[] = [];
  lines.forEach((line, lineIndex) => {
    const stripped = line.replace(BULLET, '').trim();
    if (!stripped) return;
    const parts = stripped.length > 110 ? stripped.split(/(?<=[.!?…])\s+(?=[\p{Lu}\d])/u) : [stripped];
    for (const part of parts) {
      const text = part.trim();
      if (!text || isNonProse(text)) continue;
      out.push({ text, folded: foldText(text), lineIndex });
    }
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* PII redaction (evidence snippets must not leak contact details)     */
/* ------------------------------------------------------------------ */

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PROFILE_URL_RX = /\b((?:linkedin|github|gitlab)\.com)\/\S+/gi;
const URL_RX = /\b(?:https?:\/\/|www\.)\S+/gi;
const PHONE = /(?<!\d)\+?\d[\d\s().-]{7,}\d(?!\d)/g;

export function redactPII(text: string): string {
  return text
    .replace(EMAIL, '[email]')
    .replace(PROFILE_URL_RX, '$1/[profile]')
    .replace(URL_RX, '[link]')
    .replace(PHONE, (m) => ((m.match(/\d/g)?.length ?? 0) >= 9 ? '[phone]' : m));
}

export function truncate(s: string, max = 220): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}
