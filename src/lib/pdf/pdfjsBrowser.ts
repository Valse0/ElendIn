import type { CvDocument } from '../../types/index.ts';
import { ExtractionError, extractPdf } from './extract.ts';
import type { ExtractOptions, PdfJsLike } from './extract.ts';

/**
 * Browser wiring for pdf.js. The library and its worker are bundled by Vite (`?url` gives the hashed
 * asset URL of the worker file), so extraction works offline and never contacts a CDN.
 * pdf.js parses inside its own Web Worker, which keeps the UI thread responsive.
 */

let cached: Promise<PdfJsLike> | null = null;

async function loadPdfJs(): Promise<PdfJsLike> {
  if (!cached) {
    cached = (async () => {
      const lib = await import('pdfjs-dist');
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib as unknown as PdfJsLike;
    })();
    cached.catch(() => {
      cached = null; // allow a retry after a failed dynamic import
    });
  }
  return cached;
}

export async function extractPdfFile(file: File, opts: ExtractOptions = {}): Promise<CvDocument> {
  const looksPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!looksPdf) throw new ExtractionError('NOT_PDF');
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    throw new ExtractionError('EXTRACTION_FAILED');
  }
  const pdfjs = await loadPdfJs().catch(() => {
    throw new ExtractionError('EXTRACTION_FAILED');
  });
  return extractPdf(pdfjs, bytes, file.name, opts);
}
