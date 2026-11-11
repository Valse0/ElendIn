import type { CvDocument, ExtractedPage, ExtractionErrorCode, PdfTextItem } from '../../types/index.ts';
import { INPUT_LIMITS } from '../../engine/config.ts';
import { assembleCvDocument } from './assemble.ts';
import { buildPage } from './layout.ts';

/**
 * Local PDF text extraction. The pdf.js module is INJECTED (`PdfJsLike`) so the same code runs in the
 * browser (see pdfjsBrowser.ts), in a worker, and under Node in the tests. Nothing here touches the network.
 */

export class ExtractionError extends Error {
  code: ExtractionErrorCode;
  constructor(code: ExtractionErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ExtractionError';
    this.code = code;
  }
}

/* The small slice of the pdf.js API we use. */
interface PdfTextContentItem {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
}
interface PdfPageProxy {
  getViewport(o: { scale: number }): { width: number; height: number };
  getTextContent(): Promise<{ items: PdfTextContentItem[] }>;
  cleanup?(): void;
}
interface PdfDocumentProxy {
  numPages: number;
  getPage(n: number): Promise<PdfPageProxy>;
  destroy?(): Promise<void>;
}
interface PdfLoadingTask {
  promise: Promise<PdfDocumentProxy>;
  destroy(): Promise<void> | void;
}
export interface PdfJsLike {
  getDocument(src: Record<string, unknown>): PdfLoadingTask;
}

export interface ExtractOptions {
  signal?: AbortSignal;
  onProgress?: (page: number, total: number) => void;
  maxPages?: number;
  maxBytes?: number;
}

export function hasPdfSignature(bytes: Uint8Array): boolean {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 1024)));
  return head.includes('%PDF-');
}

/** Validate before spending any time parsing. Throws ExtractionError. */
export function validatePdfBytes(bytes: Uint8Array, maxBytes: number = INPUT_LIMITS.maxFileBytes): void {
  if (bytes.length === 0) throw new ExtractionError('FILE_EMPTY');
  if (bytes.length > maxBytes) throw new ExtractionError('FILE_TOO_LARGE');
  if (!hasPdfSignature(bytes)) throw new ExtractionError('NOT_PDF');
}

function mapPdfJsError(e: unknown): ExtractionError {
  if (e instanceof ExtractionError) return e;
  const name = (e as { name?: string } | null)?.name ?? '';
  if (name === 'PasswordException') return new ExtractionError('PASSWORD');
  if (name === 'InvalidPDFException' || name === 'MissingPDFException' || name === 'FormatError') return new ExtractionError('INVALID_PDF');
  if (name === 'AbortException') return new ExtractionError('CANCELLED');
  return new ExtractionError('EXTRACTION_FAILED', e instanceof Error ? e.message : String(e));
}

export async function extractPdf(
  pdfjs: PdfJsLike,
  data: Uint8Array,
  fileName: string,
  opts: ExtractOptions = {},
): Promise<CvDocument> {
  validatePdfBytes(data, opts.maxBytes);
  const maxPages = opts.maxPages ?? INPUT_LIMITS.maxCvPages;
  if (opts.signal?.aborted) throw new ExtractionError('CANCELLED');

  // pdf.js transfers (detaches) the buffer it is given, so always hand it a copy.
  const task = pdfjs.getDocument({
    data: data.slice(),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  });
  const onAbort = () => {
    void task.destroy();
  };
  opts.signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const doc = await task.promise;
    const pageCount = doc.numPages;
    if (pageCount === 0) throw new ExtractionError('INVALID_PDF');
    const toRead = Math.min(pageCount, maxPages);
    const pages: ExtractedPage[] = [];

    for (let n = 1; n <= toRead; n++) {
      if (opts.signal?.aborted) throw new ExtractionError('CANCELLED');
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items: PdfTextItem[] = [];
      for (const it of content.items) {
        if (typeof it.str !== 'string' || !it.transform) continue; // marked-content markers carry no text
        const [, , , d, e, f] = it.transform;
        items.push({
          str: it.str,
          x: e,
          // PDF origin is bottom-left; layout code wants y measured from the top.
          y: viewport.height - f,
          width: it.width ?? 0,
          height: it.height || Math.abs(d) || 10,
        });
      }
      pages.push(buildPage(items, n, viewport.width, viewport.height));
      page.cleanup?.();
      opts.onProgress?.(n, toRead);
    }
    await doc.destroy?.();
    return assembleCvDocument(fileName, pageCount, pages, pageCount > toRead);
  } catch (e) {
    if (opts.signal?.aborted) throw new ExtractionError('CANCELLED');
    throw mapPdfJsError(e);
  } finally {
    opts.signal?.removeEventListener('abort', onAbort);
    try {
      await task.destroy();
    } catch {
      /* already destroyed */
    }
  }
}
