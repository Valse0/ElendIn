import type { ClicheHit, Finding, Lang } from '../../types/index.ts';
import { THRESHOLDS } from '../config.ts';
import { CLICHES, EVIDENCE_HINT } from '../cliches.ts';
import { cvTextEvidence } from '../evidenceExtractor.ts';
import { classifyClicheDensity, classifyVague } from '../severityEngine.ts';
import { redactPII, termRegex, tokenEquivalent, tokenize, truncate } from '../text.ts';
import type { SentenceUnit } from '../text.ts';
import { fromDecision, makeFinding } from './types.ts';
import type { Inspector, InspectorContext } from './types.ts';

/**
 * INSPECTOR 06 — COPY-PASTE DETECTOR.
 * Language-specific dictionaries (see cliches.ts), exact + similar phrase detection,
 * cliché density = cliché sentences / analysed sentences × 100.
 */

export interface ClicheScan {
  hits: ClicheHit[];
  clicheSentences: number;
  vagueSentences: SentenceUnit[];
  sentencesAnalyzed: number;
  /** null when there are too few prose sentences to say anything meaningful */
  density: number | null;
  flaggedLineIndexes: Set<number>;
}

/** All phrase tokens present near each other in the sentence, tolerating inflection / typos. */
function phraseSimilar(phraseTokens: string[], sentTokens: string[]): boolean {
  if (phraseTokens.length < 2) return false;
  const span = phraseTokens.length + 2;
  for (let i = 0; i < sentTokens.length; i++) {
    const first = phraseTokens[0];
    const eq0 = first.length >= 4 ? tokenEquivalent(first, sentTokens[i]) : first === sentTokens[i];
    if (!eq0) continue;
    let ok = true;
    for (let k = 1; k < phraseTokens.length && ok; k++) {
      const t = phraseTokens[k];
      let hit = false;
      for (let j = Math.max(0, i - span); j <= Math.min(sentTokens.length - 1, i + span); j++) {
        if (j === i) continue;
        if (t.length >= 4 ? tokenEquivalent(t, sentTokens[j]) : t === sentTokens[j]) {
          hit = true;
          break;
        }
      }
      ok = hit;
    }
    if (ok) return true;
  }
  return false;
}

export function scanCliches(sentences: SentenceUnit[], languages: Lang[]): ClicheScan {
  const hits: ClicheHit[] = [];
  const flagged = new Set<number>();
  const vagueSentences: SentenceUnit[] = [];
  let clicheSentences = 0;

  sentences.forEach((s, si) => {
    const tokens = tokenize(s.folded);
    const hasEvidence = EVIDENCE_HINT.test(s.folded);
    let clicheHit: ClicheHit | null = null;
    let vagueHit = false;

    for (const lang of languages) {
      const dict = CLICHES[lang];
      for (const phrase of dict.phrases) {
        if (termRegex(phrase).test(s.folded)) {
          clicheHit = { sentence: s.text, phrase, match: 'exact', lang };
          break;
        }
      }
      if (!clicheHit) {
        for (const phrase of dict.phrases) {
          if (phraseSimilar(tokenize(phrase), tokens)) {
            clicheHit = { sentence: s.text, phrase, match: 'similar', lang };
            break;
          }
        }
      }
      if (!clicheHit && tokens.length <= THRESHOLDS.cliche.singleWordMaxTokens && !hasEvidence) {
        for (const w of dict.words) {
          if (termRegex(w).test(s.folded)) {
            clicheHit = { sentence: s.text, phrase: w, match: 'exact', lang };
            break;
          }
        }
      }
      if (!vagueHit && !hasEvidence) {
        vagueHit = dict.vague.some((v) => termRegex(v).test(s.folded));
      }
      if (clicheHit) break;
    }

    if (clicheHit) {
      hits.push(clicheHit);
      clicheSentences += 1;
      flagged.add(s.lineIndex);
    } else if (vagueHit) {
      vagueSentences.push(s);
      flagged.add(s.lineIndex);
    }
    void si;
  });

  const n = sentences.length;
  const density = n >= THRESHOLDS.cliche.minSentences ? Math.round((clicheSentences / n) * 1000) / 10 : null;
  return { hits, clicheSentences, vagueSentences, sentencesAnalyzed: n, density, flaggedLineIndexes: flagged };
}

export const copyPasteInspector: Inspector = {
  id: 'copypaste',
  status: 'active',
  run(ctx: InspectorContext): Finding[] {
    const out: Finding[] = [];
    const scan = scanCliches(ctx.sentences, ctx.cvLanguages);
    const hits = scan.hits;

    if (scan.density !== null) {
      const d = classifyClicheDensity(scan.density);
      if (d) {
        const first = hits[0];
        out.push(
          makeFinding({
            id: 'cp.cliche-density',
            inspector: 'copypaste',
            dimension: 'language',
            ...fromDecision(d),
            fixability: 0.9,
            dedupGroup: 'cliche',
            sections: ['summary', 'experience'],
            params: {
              density: scan.density,
              sentences: scan.clicheSentences,
              total: scan.sentencesAnalyzed,
              high: scan.density >= THRESHOLDS.cliche.highFrom ? 1 : 0,
              phrase: first?.phrase ?? '',
            },
            evidence: hits.slice(0, 3).map((h) => cvTextEvidence(h.sentence, h.phrase)),
            beforeAfter: first
              ? { before: truncate(redactPII(first.sentence)), afterKey: 'finding.cp.cliche-density.after', afterParams: {} }
              : null,
          }),
        );
      }
    }

    // Summary section dominated by clichés: reported once, never on top of the density finding.
    const summaryLines = ctx.parsed.sections.summary?.lines ?? [];
    if (summaryLines.length > 0) {
      const summaryStart = ctx.parsed.sections.summary!.startLine;
      const inSummary = hits.filter((h) => ctx.sentences.some((s) => s.text === h.sentence && s.lineIndex >= summaryStart && s.lineIndex < summaryStart + summaryLines.length));
      if (inSummary.length > 0) {
        const summaryText = summaryLines.join(' ');
        const hasSubstance = /\d/.test(summaryText) || tokenize(summaryText.toLowerCase()).length > 60;
        out.push(
          makeFinding({
            id: 'cp.generic-summary',
            inspector: 'copypaste',
            dimension: 'language',
            severity: hasSubstance ? 'low' : 'medium',
            intensity: Math.min(1, 0.4 + inSummary.length / 4),
            fixability: 0.95,
            dedupGroup: 'cliche',
            sections: ['summary'],
            params: { count: inSummary.length, phrase: inSummary[0].phrase },
            evidence: inSummary.slice(0, 2).map((h) => cvTextEvidence(h.sentence, h.phrase)),
            beforeAfter: { before: truncate(redactPII(inSummary[0].sentence)), afterKey: 'finding.cp.generic-summary.after', afterParams: {} },
          }),
        );
      }
    }

    const vd = classifyVague(scan.vagueSentences.length);
    if (vd) {
      out.push(
        makeFinding({
          id: 'cp.vague-claims',
          inspector: 'copypaste',
          dimension: 'language',
          ...fromDecision(vd),
          fixability: 0.8,
          sections: ['experience'],
          params: { count: scan.vagueSentences.length },
          evidence: scan.vagueSentences.slice(0, 3).map((s) => cvTextEvidence(s.text, 'vague')),
          beforeAfter: { before: truncate(redactPII(scan.vagueSentences[0].text)), afterKey: 'finding.cp.vague-claims.after', afterParams: {} },
        }),
      );
    }
    return out;
  },
};
