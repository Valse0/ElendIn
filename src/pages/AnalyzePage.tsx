import { useEffect, useRef, useState } from 'react';
import type { AnalysisErrorCode, AnalysisResult, CvDocument } from '../types/index.ts';
import { AnalysisError, validateInputs } from '../engine/analysisEngine.ts';
import { runAnalysis } from '../app/runAnalysis.ts';
import type { AnalysisHandle } from '../app/runAnalysis.ts';
import { useI18n } from '../app/i18n-context.tsx';
import { ErrorBanner } from '../components/ui.tsx';
import { JobInput } from '../components/JobInput.tsx';
import { UploadCard } from '../components/UploadCard.tsx';

interface Props {
  cv: CvDocument | null;
  setCv: (cv: CvDocument | null) => void;
  jobText: string;
  setJobText: (v: string) => void;
  onResult: (r: AnalysisResult) => void;
  onReset: () => void;
}

export function AnalyzePage({ cv, setCv, jobText, setJobText, onResult, onReset }: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AnalysisErrorCode | null>(null);
  const handle = useRef<AnalysisHandle | null>(null);

  useEffect(() => () => handle.current?.cancel(), []);

  async function run() {
    setError(null);
    try {
      validateInputs(cv, jobText); // instant, friendly errors before any work starts
    } catch (e) {
      setError(e instanceof AnalysisError ? e.code : 'ANALYSIS_FAILED');
      return;
    }
    setBusy(true);
    const h = runAnalysis(cv!, jobText);
    handle.current = h;
    try {
      const result = await h.promise;
      onResult(result);
    } catch (e) {
      const code = e instanceof AnalysisError ? e.code : 'ANALYSIS_FAILED';
      if (code !== 'CANCELLED') setError(code);
    } finally {
      if (handle.current === h) {
        handle.current = null;
        setBusy(false);
      }
    }
  }

  function cancel() {
    handle.current?.cancel();
    handle.current = null;
    setBusy(false);
  }

  return (
    <main className="wrap">
      <div className="page-title">
        <p className="eyebrow">{t('hero.eyebrow')}</p>
        <h1 className="display">{t('form.title')}</h1>
      </div>
      <div className="cards">
        <UploadCard cv={cv} onCv={setCv} />
        <JobInput value={jobText} onChange={setJobText} />
      </div>
      {error && (
        <ErrorBanner onDismiss={() => setError(null)}>
          <p>{t(`err.${error}`)}</p>
        </ErrorBanner>
      )}
      <div className="run">
        {!busy ? (
          <button type="button" className="btn" onClick={() => void run()} disabled={!cv || cv.status !== 'ok'}>
            {t('form.analyze')}
          </button>
        ) : (
          <>
            <span className="progress" role="status" aria-live="polite">
              <span>{t('form.analyzing')}</span>
              <span className="bar" aria-hidden="true" />
            </span>
            <button type="button" className="btn secondary" onClick={cancel}>
              {t('form.cancel')}
            </button>
          </>
        )}
        <button type="button" className="btn secondary" onClick={onReset} disabled={busy}>
          {t('form.reset')}
        </button>
      </div>
    </main>
  );
}
