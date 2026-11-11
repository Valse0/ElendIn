import type { AnalysisResult, Finding, InspectorId, Lang } from '../../types/index.ts';
import { findingText, translate } from '../../i18n/index.ts';

/**
 * Diagnostic report as a PDF.
 *
 * `composeReport` only talks to the tiny `PdfDocLike` interface (the subset of the jsPDF API we use), so the
 * layout logic — wrapping, page breaks, page numbers, what is and is not printed — is unit-tested with a fake
 * document. `exportReportPdf` (further down) is the thin jsPDF adapter.
 *
 * Privacy: the report contains the score, findings and short, PII-redacted quotes from the user's own CV
 * as evidence. It never contains the file name, e-mail, phone number or links.
 */

export interface PdfDocLike {
  internal: { pageSize: { getWidth(): number; getHeight(): number } };
  setFont(family: string, style: 'normal' | 'bold'): unknown;
  setFontSize(size: number): unknown;
  setTextColor(r: number, g: number, b: number): unknown;
  setFillColor(r: number, g: number, b: number): unknown;
  setDrawColor(r: number, g: number, b: number): unknown;
  setLineWidth(w: number): unknown;
  rect(x: number, y: number, w: number, h: number, style?: string): unknown;
  line(x1: number, y1: number, x2: number, y2: number): unknown;
  text(text: string | string[], x: number, y: number, opts?: { align?: 'left' | 'center' | 'right' }): unknown;
  splitTextToSize(text: string, maxWidth: number): string[];
  addPage(): unknown;
  setPage(n: number): unknown;
  getNumberOfPages(): number;
}

type RGB = [number, number, number];
const INK: RGB = [0x21, 0x23, 0x2e];
const PAPER: RGB = [0xf0, 0xf0, 0xf0];
const BLUE: RGB = [0x10, 0x5b, 0xff];
const RED: RGB = [0xff, 0x2d, 0x2d];
const GREY: RGB = [0x55, 0x58, 0x67];

const MARGIN = 48;
const INSPECTOR_KEY: Record<InspectorId, string> = {
  ats: 'insp.ats.name',
  hr: 'insp.hr.name',
  murat: 'insp.murat.name',
  security: 'insp.security.name',
  benchmarker: 'insp.benchmarker.name',
  copypaste: 'insp.copypaste.name',
};

export interface ComposeOptions {
  fontFamily: string;
  now?: Date;
  version?: string;
}

class Cursor {
  y = MARGIN;
  readonly w: number;
  readonly h: number;
  private doc: PdfDocLike;
  constructor(doc: PdfDocLike) {
    this.doc = doc;
    this.w = doc.internal.pageSize.getWidth();
    this.h = doc.internal.pageSize.getHeight();
  }
  get contentWidth() {
    return this.w - MARGIN * 2;
  }
  ensure(space: number) {
    if (this.y + space > this.h - MARGIN - 18) {
      this.doc.addPage();
      this.y = MARGIN;
    }
  }
}

export function composeReport(doc: PdfDocLike, result: AnalysisResult, lang: Lang, opts: ComposeOptions): void {
  const t = (k: string, p?: Record<string, string | number>) => translate(lang, k, p);
  const font = opts.fontFamily;
  const cur = new Cursor(doc);

  const style = (size: number, bold: boolean, color: RGB) => {
    doc.setFont(font, bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const para = (text: string, o: { size?: number; bold?: boolean; color?: RGB; indent?: number; after?: number } = {}) => {
    const size = o.size ?? 10;
    const indent = o.indent ?? 0;
    style(size, o.bold ?? false, o.color ?? INK);
    const lines = doc.splitTextToSize(text, cur.contentWidth - indent);
    const lh = size * 1.35;
    for (const line of lines) {
      cur.ensure(lh);
      doc.text(line, MARGIN + indent, cur.y + size);
      cur.y += lh;
    }
    cur.y += o.after ?? 4;
  };

  const rule = () => {
    cur.ensure(10);
    doc.setDrawColor(...INK);
    doc.setLineWidth(1.2);
    doc.line(MARGIN, cur.y, cur.w - MARGIN, cur.y);
    cur.y += 10;
  };

  const heading = (text: string) => {
    cur.ensure(40);
    cur.y += 8;
    para(text, { size: 12, bold: true, after: 2 });
    rule();
  };

  /* ---------- header band ---------- */
  doc.setFillColor(...INK);
  doc.rect(0, 0, cur.w, 92, 'F');
  doc.setFillColor(...RED);
  doc.rect(MARGIN + 54, 30, 7, 7, 'F'); // the logo's red dot over the capital I
  style(26, true, PAPER);
  doc.text('ElendIn', MARGIN, 66);
  style(9, false, PAPER);
  doc.text(t('report.title'), cur.w - MARGIN, 66, { align: 'right' });
  cur.y = 112;

  const date = (opts.now ?? new Date()).toISOString().slice(0, 10);
  para(t('export.pdf.generated', { date }), { size: 8, color: GREY, after: 2 });
  para(result.job.title ? t('report.for', { title: result.job.title }) : t('report.forUnknown'), { size: 10, bold: true, after: 10 });

  /* ---------- score ---------- */
  style(54, true, INK);
  cur.ensure(70);
  doc.text(`${result.scoring.score}`, MARGIN, cur.y + 50);
  style(14, false, GREY);
  doc.text(t('report.score.of'), MARGIN + 82, cur.y + 50);
  style(9, true, INK);
  doc.text(t('report.score'), MARGIN + 150, cur.y + 24);
  const stamp = result.summary.critical + result.summary.medium > 0 ? t('report.stamp') : t('report.stamp.clean');
  const stampColor = result.summary.critical + result.summary.medium > 0 ? RED : INK;
  doc.setDrawColor(...stampColor);
  doc.setLineWidth(2.5);
  doc.rect(cur.w - MARGIN - 190, cur.y + 8, 190, 30);
  style(11, true, stampColor);
  doc.text(stamp, cur.w - MARGIN - 95, cur.y + 28, { align: 'center' });
  cur.y += 66;
  para(t('report.potential', { n: result.scoring.potentialScore }), { size: 10, bold: true, after: 2 });
  para(t('report.potential.note'), { size: 8.5, color: GREY, after: 4 });
  para(t('report.simulated'), { size: 8.5, color: GREY, after: 4 });
  if (result.scoring.partial) para(t('report.partial'), { size: 8.5, color: GREY });

  /* ---------- summary ---------- */
  heading(t('report.summary'));
  const s = result.summary;
  para(`${t('report.summary.critical')}: ${s.critical}    ${t('report.summary.medium')}: ${s.medium}    ${t('report.summary.low')}: ${s.low}`, { bold: true });
  para(`${t('report.summary.evidence')}: ${s.requirementsMissing + s.requirementsPartial}`);
  para(`${t('report.summary.cliche')}: ${s.clicheDensity === null ? t('report.summary.cliche.na') : `${s.clicheDensity}%`}`);
  para(s.requirementsTotal > 0 ? t('report.summary.required', { found: s.requiredFound, total: s.requiredTotal }) : t('report.summary.noReq'));
  for (const w of result.warnings) para(t(`report.warn.${w}`), { size: 8.5, color: GREY, indent: 8 });

  /* ---------- findings ---------- */
  const real = result.findings.filter((f) => !f.neutral);
  const context = result.findings.filter((f) => f.neutral);
  heading(t('report.findings'));
  if (real.length === 0) para(t('report.findings.none'));
  const pointsOf = new Map(result.scoring.deductions.map((d) => [d.findingId, d]));
  real.forEach((f, i) => writeFinding(f, i + 1));
  if (context.length > 0) {
    heading(t('report.context'));
    para(t('report.context.sub'), { size: 8.5, color: GREY });
    context.forEach((f, i) => writeFinding(f, i + 1, true));
  }

  function writeFinding(f: Finding, n: number, isContext = false) {
    const text = findingText(lang, f);
    const d = pointsOf.get(f.id);
    cur.ensure(70);
    const sev = isContext ? t('sev.neutral') : t(`sev.${f.severity}`);
    const label = `${n}. [${sev}] ${text.title}`;
    para(label, { size: 11, bold: true, color: !isContext && f.severity === 'critical' ? RED : INK, after: 2 });
    const meta = [t(INSPECTOR_KEY[f.inspector]), t(`dim.${f.dimension}`)];
    if (d) meta.push(d.dedupedBy ? t('report.deduped') : d.points > 0 ? t('report.points', { n: d.points }) : t('report.points.none'));
    para(meta.join('  ·  '), { size: 8, color: GREY, after: 3 });
    para(`${t('report.why')}: ${text.why}`, { indent: 8 });
    if (text.justification) para(`${t('report.justify')}: ${text.justification}`, { indent: 8, bold: true });
    para(`${t('report.fix')}: ${text.fix}`, { indent: 8 });
    for (const ev of f.evidence.slice(0, 2)) {
      para(`${ev.source === 'cv' ? t('report.evidence.cv') : t('report.evidence.job')}: “${ev.text}”`, { size: 8.5, color: GREY, indent: 8, after: 2 });
    }
    if (f.beforeAfter && text.after) {
      para(`${t('report.before')}: ${f.beforeAfter.before ?? t('report.beforeNone')}`, { size: 9, indent: 8, after: 2 });
      para(`${t('report.after')}: ${text.after}`, { size: 9, indent: 8, color: BLUE, after: 2 });
    }
    cur.y += 8;
  }

  /* ---------- requirements ---------- */
  if (result.requirements.length > 0) {
    heading(t('report.requirements'));
    para(t('report.requirements.sub'), { size: 8.5, color: GREY });
    for (const r of result.requirements) {
      const label = r.kind === 'education' ? t(`edu.${r.label}`) : r.label;
      para(`${label}  (${t(`report.req.${r.priority}`)})  —  ${t(`report.req.${r.status}`)}`, { size: 9, after: 1 });
    }
  }

  /* ---------- improvement + limits ---------- */
  heading(t('report.improve'));
  const first = result.findings.find((f) => f.id === result.improvement.firstFixId);
  if (first) para(`${t('report.improve.first')}: ${findingText(lang, first).title}`, { bold: true });
  else para(t('report.improve.none'));
  if (result.improvement.requirementsNeedingEvidence.length > 0) {
    para(`${t('report.improve.evidence')}: ${result.improvement.requirementsNeedingEvidence.join(', ')}`);
  }
  if (result.improvement.sectionsToReview.length > 0) {
    para(`${t('report.improve.sections')}: ${result.improvement.sectionsToReview.map((k) => t(`section.${k}`)).join(', ')}`);
  }
  heading(t('report.limits.title'));
  para(t('report.limits.body'), { size: 9 });

  /* ---------- footer on every page ---------- */
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    style(8, false, GREY);
    doc.text(`ElendIn${opts.version ? ` ${opts.version}` : ''}  ·  ${t('report.simulated').split(' — ')[0]}`, MARGIN, cur.h - 28);
    doc.text(t('export.pdf.page', { n: p, total }), cur.w - MARGIN, cur.h - 28, { align: 'right' });
  }
}
