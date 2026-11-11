import type { JobRequirement } from '../../types/index.ts';
import { MATCH_CREDIT } from '../../engine/config.ts';
import { LEXICON, LEXICON_BY_ID } from '../../engine/lexicon.ts';
import { foldText, termRegex, tokenEquivalent, tokenize } from '../../engine/text.ts';

/**
 * Deterministic requirement ↔ CV matching.
 *
 * Stages (first hit wins):
 *   1. found   – the requirement's own label appears as a whole word/phrase
 *   2. alias   – a known alternative spelling appears (e.g. "k8s" for Kubernetes)
 *   3. related – a skill that implies it appears (PostgreSQL → SQL): partial evidence
 *   4. fuzzy   – typo / inflection tolerant token match (Turkish suffixes, plurals, transpositions)
 *   5. missing
 *
 * This is an in-house implementation (no fuse.js): scores are reproducible across library
 * versions and the whole pipeline can be unit-tested without installing dependencies.
 */

export interface CvIndex {
  rawLines: string[];
  foldedLines: string[];
  foldedFull: string;
  tokens: string[];
  tokenSet: Set<string>;
  /** Lexicon skill ids present in the CV (exact/alias matches only). */
  skillsPresent: Set<string>;
}

export type MatchStatus = 'found' | 'alias' | 'fuzzy' | 'related' | 'missing';

export interface RequirementMatch {
  requirementId: string;
  status: MatchStatus;
  credit: number;
  lineIndex: number | null;
  matchedTerm: string | null;
}

export function buildCvIndex(rawLines: string[]): CvIndex {
  const foldedLines = rawLines.map(foldText);
  const foldedFull = foldedLines.join('\n');
  const tokens = tokenize(foldedFull);
  const skillsPresent = new Set<string>();
  for (const entry of LEXICON) {
    if (entry.terms.some((t) => termRegex(t).test(foldedFull))) skillsPresent.add(entry.id);
  }
  return { rawLines, foldedLines, foldedFull, tokens, tokenSet: new Set(tokens), skillsPresent };
}

function findLine(idx: CvIndex, rx: RegExp): number | null {
  for (let i = 0; i < idx.foldedLines.length; i++) {
    const line = idx.foldedLines[i];
    if (rx.test(line) && !/@|\+?\d[\d\s().-]{7,}\d/.test(line)) return i;
  }
  for (let i = 0; i < idx.foldedLines.length; i++) {
    if (rx.test(idx.foldedLines[i])) return i;
  }
  return null;
}

function fuzzyPhrase(termTokens: string[], idx: CvIndex): number | null {
  // Every token of the phrase must have an equivalent CV token inside a small window.
  const window = termTokens.length + 3;
  const cv = idx.tokens;
  for (let i = 0; i < cv.length; i++) {
    if (!tokenEquivalent(termTokens[0], cv[i])) continue;
    let matched = 1;
    for (let k = 1; k < termTokens.length; k++) {
      let ok = false;
      for (let j = Math.max(0, i - window); j <= Math.min(cv.length - 1, i + window); j++) {
        if (j !== i && tokenEquivalent(termTokens[k], cv[j])) {
          ok = true;
          break;
        }
      }
      if (ok) matched++;
    }
    if (matched === termTokens.length) return i;
  }
  return null;
}

function lineOfToken(idx: CvIndex, token: string): number | null {
  for (let i = 0; i < idx.foldedLines.length; i++) {
    if (tokenize(idx.foldedLines[i]).some((t) => tokenEquivalent(token, t))) return i;
  }
  return null;
}

export function matchRequirement(req: JobRequirement, idx: CvIndex): RequirementMatch {
  const base = { requirementId: req.id } as const;
  const [primary, ...aliases] = req.terms;

  // 1. exact label
  const rxPrimary = termRegex(primary);
  if (rxPrimary.test(idx.foldedFull)) {
    return { ...base, status: 'found', credit: MATCH_CREDIT.found, lineIndex: findLine(idx, rxPrimary), matchedTerm: primary };
  }
  // 2. alias
  for (const alias of aliases) {
    const rx = termRegex(alias);
    if (rx.test(idx.foldedFull)) {
      return { ...base, status: 'alias', credit: MATCH_CREDIT.alias, lineIndex: findLine(idx, rx), matchedTerm: alias };
    }
  }
  // 3. related (implied by another skill)
  for (const impliedId of req.impliedBy) {
    if (idx.skillsPresent.has(impliedId)) {
      const entry = LEXICON_BY_ID.get(impliedId);
      const term = entry?.terms[0] ?? impliedId;
      return { ...base, status: 'related', credit: MATCH_CREDIT.related, lineIndex: findLine(idx, termRegex(term)), matchedTerm: term };
    }
  }
  // 4. fuzzy (never for very short terms: "r", "go", "sql" must match exactly)
  for (const term of req.terms) {
    const tt = tokenize(term);
    if (tt.length === 0) continue;
    if (tt.length === 1) {
      if (tt[0].length < 6) continue;
      const hit = idx.tokens.find((t) => tokenEquivalent(tt[0], t));
      if (hit) {
        return { ...base, status: 'fuzzy', credit: MATCH_CREDIT.fuzzy, lineIndex: lineOfToken(idx, tt[0]), matchedTerm: hit };
      }
    } else if (tt.every((t) => t.length >= 4)) {
      const at = fuzzyPhrase(tt, idx);
      if (at !== null) {
        return { ...base, status: 'fuzzy', credit: MATCH_CREDIT.fuzzy, lineIndex: lineOfToken(idx, tt[0]), matchedTerm: idx.tokens[at] };
      }
    }
  }
  return { ...base, status: 'missing', credit: MATCH_CREDIT.missing, lineIndex: null, matchedTerm: null };
}
