import type { CvDocument, ExtractedPage } from '../../types/index.ts';
import { assembleCvDocument } from './assemble.ts';

/**
 * Build a CvDocument from plain text (one page per form-feed or per call).
 * Used by the unit tests and as the integration point for any future text-paste fallback.
 */
export function cvFromText(text: string, fileName = 'sample.pdf'): CvDocument {
  const chunks = text.split('\f');
  const pages: ExtractedPage[] = chunks.map((chunk, i) => {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    const joined = lines.join('\n');
    const charCount = joined.replace(/\s+/g, '').length;
    return {
      pageNumber: i + 1,
      width: 595,
      height: 842,
      lines,
      text: joined,
      charCount,
      hasText: charCount >= 5,
      columnCount: 1,
      gutterX: null,
      interleaved: false,
      sideSwitches: 0,
    };
  });
  return assembleCvDocument(fileName, pages.length, pages, false);
}
