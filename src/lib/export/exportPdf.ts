import type { AnalysisResult, Lang } from '../../types/index.ts';
import regularUrl from '../../assets/fonts/DejaVuSans-Regular.ttf?url';
import boldUrl from '../../assets/fonts/DejaVuSans-Bold.ttf?url';
import { composeReport } from './pdfReport.ts';
import type { PdfDocLike } from './pdfReport.ts';
import { downloadBlob } from './download.ts';

/**
 * jsPDF adapter. jsPDF's built-in fonts cannot draw Turkish letters (ğ ş ı İ), so a subsetted DejaVu Sans
 * (Latin + punctuation, ~30 KB per weight, bundled — no CDN) is embedded and used for every language.
 */

async function fontBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

export async function exportReportPdf(result: AnalysisResult, lang: Lang, version: string): Promise<void> {
  const [{ jsPDF }, regular, bold] = await Promise.all([import('jspdf'), fontBase64(regularUrl), fontBase64(boldUrl)]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  doc.addFileToVFS('DejaVuSans-Regular.ttf', regular);
  doc.addFileToVFS('DejaVuSans-Bold.ttf', bold);
  doc.addFont('DejaVuSans-Regular.ttf', 'DejaVu', 'normal');
  doc.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold');
  composeReport(doc as unknown as PdfDocLike, result, lang, { fontFamily: 'DejaVu', version });
  downloadBlob(doc.output('blob'), 'elendin-report.pdf');
}
