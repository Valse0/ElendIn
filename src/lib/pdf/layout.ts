import type { ExtractedPage, PdfTextItem } from '../../types/index.ts';
import { THRESHOLDS } from '../../engine/config.ts';

/**
 * Pure geometry helpers for turning positioned PDF text fragments into reading-order lines
 * and for diagnosing multi-column layouts. No pdf.js dependency, so it is fully unit-testable.
 *
 * A two-column CV is NOT automatically a problem. We report:
 *   - columnCount / gutterX          → what the page looks like
 *   - interleaved / sideSwitches     → whether the extraction ORDER hops between columns
 *                                      (that is what actually scrambles naive parsers)
 * and always rebuild the text in column order for our own analysis.
 */

export interface LayoutResult {
  columnCount: 1 | 2;
  gutterX: number | null;
  interleaved: boolean;
  sideSwitches: number;
  lines: string[];
}

interface Line {
  y: number;
  items: PdfTextItem[];
}

const BINS = 100;

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Group fragments that share a baseline into lines (top → bottom, left → right). */
export function groupIntoLines(items: PdfTextItem[]): Line[] {
  const clean = items.filter((i) => i.str.trim().length > 0);
  if (clean.length === 0) return [];
  const tol = Math.max(1.5, median(clean.map((i) => i.height || 10)) * 0.5);
  const sorted = [...clean].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: Line[] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= tol) {
      last.items.push(it);
      last.y = (last.y * (last.items.length - 1) + it.y) / last.items.length;
    } else lines.push({ y: it.y, items: [it] });
  }
  for (const l of lines) l.items.sort((a, b) => a.x - b.x);
  return lines;
}

function joinItems(items: PdfTextItem[]): string {
  let out = '';
  let prev: PdfTextItem | null = null;
  for (const it of items) {
    if (prev) {
      const gap = it.x - (prev.x + prev.width);
      const charW = prev.width / Math.max(1, prev.str.length);
      const needsSpace = gap > Math.max(0.8, charW * 0.25) && !out.endsWith(' ') && !it.str.startsWith(' ');
      if (needsSpace) out += ' ';
    }
    out += it.str;
    prev = it;
  }
  return out.replace(/\s+/g, ' ').trim();
}

export function linesToText(lines: Line[]): string[] {
  return lines.map((l) => joinItems(l.items)).filter((t) => t.length > 0);
}

export interface ColumnDetection {
  columnCount: 1 | 2;
  gutterX: number | null;
  gutterStart: number | null;
  gutterEnd: number | null;
}

/**
 * Look for a vertical band between 18% and 82% of the page width that (almost) no text crosses,
 * with a meaningful amount of text on both sides.
 */
export function detectColumns(items: PdfTextItem[], pageWidth: number): ColumnDetection {
  const none: ColumnDetection = { columnCount: 1, gutterX: null, gutterStart: null, gutterEnd: null };
  const clean = items.filter((i) => i.str.trim().length > 0 && i.width > 0);
  if (clean.length < THRESHOLDS.layout.minItemsPerSide * 2 || pageWidth <= 0) return none;

  const cover = new Array<number>(BINS).fill(0);
  for (const it of clean) {
    const a = Math.max(0, Math.floor((it.x / pageWidth) * BINS));
    const b = Math.min(BINS - 1, Math.floor(((it.x + it.width) / pageWidth) * BINS));
    for (let k = a; k <= b; k++) cover[k] += 1;
  }
  const allowed = Math.max(2, Math.floor(clean.length * 0.05));

  let best: [number, number] | null = null;
  let runStart = -1;
  for (let k = 18; k <= 82; k++) {
    const open = cover[k] <= allowed;
    if (open && runStart < 0) runStart = k;
    if ((!open || k === 82) && runStart >= 0) {
      const runEnd = open && k === 82 ? k : k - 1;
      if (runEnd - runStart + 1 >= THRESHOLDS.layout.gutterMinBins && (!best || runEnd - runStart > best[1] - best[0])) best = [runStart, runEnd];
      runStart = -1;
    }
  }
  if (!best) return none;

  const gutterStart = (best[0] / BINS) * pageWidth;
  const gutterEnd = ((best[1] + 1) / BINS) * pageWidth;
  const centre = (gutterStart + gutterEnd) / 2;
  let left = 0;
  let right = 0;
  for (const it of clean) {
    const mid = it.x + it.width / 2;
    if (mid < centre) left++;
    else right++;
  }
  const need = THRESHOLDS.layout.minItemsPerSide;
  if (left < need || right < need) return none;
  // The two sides must run side by side vertically (not a narrow single column plus a footer).
  const leftYs = clean.filter((i) => i.x + i.width / 2 < centre).map((i) => i.y);
  const rightYs = clean.filter((i) => i.x + i.width / 2 >= centre).map((i) => i.y);
  const overlap = Math.min(Math.max(...leftYs), Math.max(...rightYs)) - Math.max(Math.min(...leftYs), Math.min(...rightYs));
  const span = Math.max(Math.max(...leftYs), Math.max(...rightYs)) - Math.min(Math.min(...leftYs), Math.min(...rightYs));
  if (span <= 0 || overlap / span < 0.4) return none;

  return { columnCount: 2, gutterX: centre, gutterStart, gutterEnd };
}

/** Count how often the raw extraction order jumps between the left and right column. */
export function countSideSwitches(items: PdfTextItem[], gutterX: number): number {
  let switches = 0;
  let prev: 'L' | 'R' | null = null;
  for (const it of items) {
    if (it.str.trim().length === 0) continue;
    const side: 'L' | 'R' = it.x + it.width / 2 < gutterX ? 'L' : 'R';
    if (prev && side !== prev) switches++;
    prev = side;
  }
  return switches;
}

export function analyzeLayout(items: PdfTextItem[], pageWidth: number): LayoutResult {
  const det = detectColumns(items, pageWidth);
  if (det.columnCount === 1 || det.gutterX === null || det.gutterStart === null || det.gutterEnd === null) {
    return { columnCount: 1, gutterX: null, interleaved: false, sideSwitches: 0, lines: linesToText(groupIntoLines(items)) };
  }
  const { gutterX, gutterStart, gutterEnd } = det;
  const sideSwitches = countSideSwitches(items, gutterX);
  const sided = items.filter((i) => i.str.trim().length > 0).length;
  const interleaved =
    sideSwitches > THRESHOLDS.layout.interleaveMinSwitches && sideSwitches > sided * THRESHOLDS.layout.interleaveRatio;

  const spanning: PdfTextItem[] = [];
  const left: PdfTextItem[] = [];
  const right: PdfTextItem[] = [];
  for (const it of items) {
    if (it.x < gutterStart && it.x + it.width > gutterEnd) spanning.push(it);
    else if (it.x + it.width / 2 < gutterX) left.push(it);
    else right.push(it);
  }
  const columnTop = Math.min(...[...left, ...right].filter((i) => i.str.trim()).map((i) => i.y));
  const topSpan = spanning.filter((i) => i.y < columnTop);
  const otherSpan = spanning.filter((i) => i.y >= columnTop);
  const lines = [
    ...linesToText(groupIntoLines(topSpan)),
    ...linesToText(groupIntoLines(left)),
    ...linesToText(groupIntoLines(right)),
    ...linesToText(groupIntoLines(otherSpan)),
  ];
  return { columnCount: 2, gutterX, interleaved, sideSwitches, lines };
}

export function buildPage(items: PdfTextItem[], pageNumber: number, width: number, height: number): ExtractedPage {
  const layout = analyzeLayout(items, width);
  const text = layout.lines.join('\n');
  const charCount = text.replace(/\s+/g, '').length;
  return {
    pageNumber,
    width,
    height,
    lines: layout.lines,
    text,
    charCount,
    hasText: charCount >= 5,
    columnCount: layout.columnCount,
    gutterX: layout.gutterX,
    interleaved: layout.interleaved,
    sideSwitches: layout.sideSwitches,
  };
}
