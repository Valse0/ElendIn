import type { CvDocument, ExtractedPage } from '../../types/index.ts';

/** Combine per-page results into a CvDocument (pure; shared by the real extractor and the test helpers). */
export function assembleCvDocument(fileName: string, pageCount: number, pages: ExtractedPage[], truncated: boolean): CvDocument {
  const lines = pages.flatMap((p) => p.lines);
  const fullText = pages.map((p) => p.text).join('\n\n');
  const totalChars = pages.reduce((s, p) => s + p.charCount, 0);
  return {
    fileName,
    pageCount,
    pages,
    truncated,
    emptyPages: pages.filter((p) => !p.hasText).map((p) => p.pageNumber),
    lines,
    fullText,
    status: totalChars < 20 ? 'no_text' : 'ok',
  };
}
