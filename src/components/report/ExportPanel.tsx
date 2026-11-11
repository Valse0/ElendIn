import { useRef, useState } from 'react';
import type { AnalysisResult } from '../../types/index.ts';
import { useI18n } from '../../app/i18n-context.tsx';
import { APP_VERSION } from '../../app/version.ts';
import { dataUrlToBlob, downloadBlob } from '../../lib/export/download.ts';
import { ErrorBanner } from '../ui.tsx';
import { ShareCard } from './ShareCard.tsx';

type Busy = 'png' | 'pdf' | null;

/** Exports are explicit, user-initiated downloads. Nothing is uploaded or shared automatically. */
export function ExportPanel({ result }: { result: AnalysisResult }) {
  const { lang, t } = useI18n();
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [failed, setFailed] = useState(false);

  async function exportPng() {
    if (!cardRef.current || busy) return;
    setFailed(false);
    setBusy('png');
    try {
      const [{ toPng }] = await Promise.all([import('html-to-image'), document.fonts?.ready]);
      const dataUrl = await toPng(cardRef.current, { width: 1080, height: 1350, pixelRatio: 1, backgroundColor: '#21232E', cacheBust: false });
      downloadBlob(dataUrlToBlob(dataUrl), 'elendin-report-card.png');
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  async function exportPdf() {
    if (busy) return;
    setFailed(false);
    setBusy('pdf');
    try {
      const { exportReportPdf } = await import('../../lib/export/exportPdf.ts');
      await exportReportPdf(result, lang, APP_VERSION);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="block export" aria-labelledby="exp-h">
      <h2 id="exp-h">{t('export.title')}</h2>
      <div className="export-grid">
        <div className="card-preview" aria-hidden="true">
          <div className="scaler">
            <ShareCard ref={cardRef} result={result} />
          </div>
        </div>
        <div>
          <div className="btns">
            <button type="button" className="btn" onClick={() => void exportPng()} disabled={busy !== null}>
              {busy === 'png' ? t('export.busy') : t('export.png')}
            </button>
            <button type="button" className="btn secondary" onClick={() => void exportPdf()} disabled={busy !== null}>
              {busy === 'pdf' ? t('export.busy') : t('export.pdf')}
            </button>
          </div>
          <p className="sub" style={{ margin: 0 }}>
            {t('export.privacy')}
          </p>
          {failed && (
            <ErrorBanner onDismiss={() => setFailed(false)}>
              <p>{t('err.EXPORT_FAILED')}</p>
            </ErrorBanner>
          )}
        </div>
      </div>
    </section>
  );
}
