import { THRESHOLDS } from './config.ts';
import { foldText } from './text.ts';

/**
 * Date parsing for CV experience entries. Handles:
 *   DD/MM/YYYY · MM/YYYY · YYYY-MM · "Month YYYY" (Turkish, English, Spanish) · YYYY
 * and "present" markers in all three languages. No single format is treated as the "correct" one;
 * the engine only reports MIXED formats and ranges that cannot be interpreted.
 */

export type DateFormat = 'DD/MM/YYYY' | 'MM/YYYY' | 'YYYY-MM' | 'Month YYYY' | 'YYYY';

export interface ParsedDate {
  year: number;
  month: number | null;
  format: DateFormat;
}

export interface DateRange {
  start: ParsedDate;
  /** null when the range has no end marker */
  end: ParsedDate | 'present' | null;
  lineIndex: number;
  line: string;
  /** end < start, future start, or an implausible span */
  invalid: boolean;
}

const MONTH_NAMES: Record<string, number> = {
  // English
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  // Turkish (folded)
  ocak: 1, subat: 2, mart: 3, nisan: 4, mayis: 5, haziran: 6, temmuz: 7, agustos: 8, eylul: 9, ekim: 10, kasim: 11, aralik: 12,
  oca: 1, sub: 2, nis: 4, haz: 6, tem: 7, agu: 8, eyl: 9, eki: 10, kas: 11, ara: 12,
  // Spanish (folded)
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, abr: 4, ago: 8, dic: 12,
};

const MONTH_ALT = Object.keys(MONTH_NAMES)
  .sort((a, b) => b.length - a.length)
  .join('|');

export const PRESENT_RX = /(?<![\p{L}])(present|current|currently|now|ongoing|halen|devam ediyor|devam|gunumuz|su an|presente|actualidad|actualmente|hoy|vigente)(?![\p{L}])/u;

interface Token {
  index: number;
  end: number;
  date: ParsedDate | 'present';
}

const SEP_BETWEEN = /^\s*(?:-|to|until|till|a|al|hasta|ile|→|>)?\s*$/;

/** Find all date tokens (non-overlapping) in one line. */
function scanTokens(folded: string): Token[] {
  const taken: Array<[number, number]> = [];
  const tokens: Token[] = [];
  const overlaps = (s: number, e: number) => taken.some(([a, b]) => s < b && e > a);
  const add = (index: number, end: number, date: ParsedDate | 'present') => {
    if (overlaps(index, end)) return;
    taken.push([index, end]);
    tokens.push({ index, end, date });
  };

  for (const m of folded.matchAll(/(?<!\d)(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*((?:19|20)\d{2})(?!\d)/g)) {
    const mo = Number(m[2]) <= 12 ? Number(m[2]) : Number(m[1]) <= 12 ? Number(m[1]) : null;
    add(m.index!, m.index! + m[0].length, { year: Number(m[3]), month: mo, format: 'DD/MM/YYYY' });
  }
  for (const m of folded.matchAll(/(?<!\d)(0?[1-9]|1[0-2])\s*[./-]\s*((?:19|20)\d{2})(?!\d)/g)) {
    add(m.index!, m.index! + m[0].length, { year: Number(m[2]), month: Number(m[1]), format: 'MM/YYYY' });
  }
  for (const m of folded.matchAll(/(?<!\d)((?:19|20)\d{2})\s*[./-]\s*(0?[1-9]|1[0-2])(?![\d])/g)) {
    add(m.index!, m.index! + m[0].length, { year: Number(m[1]), month: Number(m[2]), format: 'YYYY-MM' });
  }
  const monthRx = new RegExp(`(?<![\\p{L}])(${MONTH_ALT})\\.?\\s*,?\\s*((?:19|20)\\d{2})(?!\\d)`, 'gu');
  for (const m of folded.matchAll(monthRx)) {
    add(m.index!, m.index! + m[0].length, { year: Number(m[2]), month: MONTH_NAMES[m[1]], format: 'Month YYYY' });
  }
  for (const m of folded.matchAll(/(?<![\d])((?:19|20)\d{2})(?![\d])/g)) {
    add(m.index!, m.index! + m[0].length, { year: Number(m[1]), month: null, format: 'YYYY' });
  }
  const pres = folded.match(PRESENT_RX);
  if (pres && pres.index !== undefined) add(pres.index, pres.index + pres[0].length, 'present');

  return tokens.sort((a, b) => a.index - b.index);
}

export function monthIndex(d: ParsedDate, edge: 'start' | 'end'): number {
  const month = d.month ?? (edge === 'start' ? THRESHOLDS.dates.defaultStartMonth : THRESHOLDS.dates.defaultEndMonth);
  return d.year * 12 + (month - 1);
}

export function parseDateRanges(lines: string[], now: Date): DateRange[] {
  const out: DateRange[] = [];
  const nowIdx = now.getFullYear() * 12 + now.getMonth();
  lines.forEach((line, lineIndex) => {
    const folded = foldText(line);
    const toks = scanTokens(folded);
    const beforeCount = out.length;
    for (let i = 0; i < toks.length - 1; i++) {
      const a = toks[i];
      const b = toks[i + 1];
      if (a.date === 'present') continue;
      const between = folded.slice(a.end, b.index);
      if (!SEP_BETWEEN.test(between)) continue;
      const start = a.date;
      const end = b.date;
      let invalid = false;
      const startIdx = monthIndex(start, 'start');
      if (startIdx > nowIdx + 12) invalid = true;
      if (end !== 'present') {
        const endIdx = monthIndex(end, 'end');
        // Same-year year-only ranges ("2020 - 2020") are allowed; a strictly earlier end is not.
        if (end.year < start.year || (end.month !== null && start.month !== null && endIdx < startIdx)) invalid = true;
        if (end.year - start.year > 50) invalid = true;
      }
      out.push({ start, end, lineIndex, line, invalid });
      i++; // consume both tokens
    }
    // Single-year or single-date entry in an experience line (e.g. "Intern, Alpha Co 2022")
    if (out.length === beforeCount && toks.length === 1 && toks[0].date !== 'present') {
      const isTrailing = /(?:-|to|a|al|hasta|ile)\s*$/.test(folded.slice(toks[0].end));
      if (!isTrailing) {
        const d = toks[0].date;
        const startIdx = monthIndex(d, 'start');
        const invalid = startIdx > nowIdx + 12;
        out.push({ start: d, end: d, lineIndex, line, invalid });
      }
    }
  });
  return out;
}

/** Single trailing "Month YYYY -" with no end (e.g. "Jan 2021 –"). */
export function findOpenEndedStarts(lines: string[]): number[] {
  const hits: number[] = [];
  lines.forEach((line, i) => {
    const folded = foldText(line);
    const toks = scanTokens(folded);
    if (toks.length === 1 && toks[0].date !== 'present' && /(?:-|to|a|al|hasta|ile)\s*$/.test(folded.slice(toks[0].end))) hits.push(i);
  });
  return hits;
}

export function formatsUsed(ranges: DateRange[]): DateFormat[] {
  const set = new Set<DateFormat>();
  for (const r of ranges) {
    set.add(r.start.format);
    if (r.end && r.end !== 'present') set.add(r.end.format);
  }
  return Array.from(set);
}

export interface Period {
  startIdx: number;
  endIdx: number;
  /** true when both boundaries carry a month (gap maths is reliable) */
  precise: boolean;
}

export function toPeriods(ranges: DateRange[], now: Date): Period[] {
  const nowIdx = now.getFullYear() * 12 + now.getMonth();
  const periods: Period[] = [];
  for (const r of ranges) {
    if (r.invalid) continue;
    const startIdx = monthIndex(r.start, 'start');
    let endIdx: number;
    let preciseEnd = true;
    // `endIdx` is EXCLUSIVE: "01/2015 - 12/2017" covers 36 months, and "present" includes the current month.
    if (r.end === 'present') endIdx = nowIdx + 1;
    else if (r.end === null) continue;
    else {
      endIdx = monthIndex(r.end, 'end') + (r.end.month !== null ? 1 : 0);
      preciseEnd = r.end.month !== null;
      // "2020 - 2020" counts as half a year instead of zero.
      if (endIdx <= startIdx && r.end.month === null) endIdx = startIdx + 6;
    }
    if (endIdx < startIdx) continue;
    periods.push({ startIdx, endIdx: Math.min(endIdx, nowIdx + 1), precise: r.start.month !== null && preciseEnd });
  }
  return periods.sort((a, b) => a.startIdx - b.startIdx);
}

/** Merge overlapping periods so concurrent jobs are not double counted. */
export function mergePeriods(periods: Period[]): Period[] {
  const merged: Period[] = [];
  for (const p of periods) {
    const last = merged[merged.length - 1];
    if (last && p.startIdx <= last.endIdx) {
      last.endIdx = Math.max(last.endIdx, p.endIdx);
      last.precise = last.precise && p.precise;
    } else merged.push({ ...p });
  }
  return merged;
}

export function totalYears(periods: Period[]): number {
  const months = mergePeriods(periods).reduce((s, p) => s + (p.endIdx - p.startIdx), 0);
  return Math.round((months / 12) * 10) / 10;
}

export interface Gap {
  months: number;
  fromIdx: number;
  toIdx: number;
}

/** Gaps longer than the threshold between consecutive periods (only where both boundaries are month-precise). */
export function findGaps(periods: Period[], minMonths = THRESHOLDS.dates.gapMonths): Gap[] {
  const merged = mergePeriods(periods);
  const gaps: Gap[] = [];
  for (let i = 1; i < merged.length; i++) {
    const prev = merged[i - 1];
    const cur = merged[i];
    if (!prev.precise || !cur.precise) continue;
    const months = cur.startIdx - prev.endIdx;
    if (months > minMonths) gaps.push({ months, fromIdx: prev.endIdx, toIdx: cur.startIdx });
  }
  return gaps;
}

/** "I have 8 years of experience" style claims. */
export function claimedYears(foldedText: string): number {
  let best = 0;
  const rx = /(\d{1,2})\s*\+?\s*(?:years?|yrs?|yil(?:lik)?|anos?)\s*(?:of\s*|de\s*)?(?:professional\s*|work\s*)?(?:experience|experiencia|deneyim|tecrube)/g;
  for (const m of foldedText.matchAll(rx)) best = Math.max(best, Number(m[1]));
  return best;
}
