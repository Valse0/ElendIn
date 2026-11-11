import { useEffect, useId, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import type { CvDocument, ExtractionErrorCode } from '../types/index.ts';
import { INPUT_LIMITS } from '../engine/config.ts';
import { ExtractionError } from '../lib/pdf/extract.ts';
import { extractPdfFile } from '../lib/pdf/pdfjsBrowser.ts';
import { useI18n } from '../app/i18n-context.tsx';
import { ErrorBanner } from './ui.tsx';
import SpotlightCard from './reactbits/SpotlightCard.tsx';

const MB = Math.round(INPUT_LIMITS.maxFileBytes / (1024 * 1024));

/**
 * CV upload + local extraction. The file is read into memory only; "Remove" / "Replace" drops the extracted
 * data, and nothing is written to storage or sent anywhere.
 */
export function UploadCard({ cv, onCv }: { cv: CvDocument | null; onCv: (cv: CvDocument | null) => void }) {
  const { t } = useI18n();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ExtractionErrorCode | null>(null);
  const [over, setOver] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setError(null);
    setBusy(true);
    setPreview(false);
    onCv(null);
    try {
      const doc = await extractPdfFile(file, { signal: ac.signal });
      if (!ac.signal.aborted) onCv(doc);
    } catch (e) {
      if (ac.signal.aborted) return;
      setError(e instanceof ExtractionError ? e.code : 'EXTRACTION_FAILED');
    } finally {
      if (abortRef.current === ac) setBusy(false);
      if (inputRef.current) inputRef.current.value = ''; // allow re-selecting the same file
    }
  }

  function remove() {
    abortRef.current?.abort();
    setBusy(false);
    setError(null);
    setPreview(false);
    onCv(null);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setOver(false);
    void handleFile(e.dataTransfer.files[0]);
  }

  const twoColPages = cv ? cv.pages.filter((p) => p.columnCount === 2).map((p) => p.pageNumber) : [];

  return (
    <section className="card" aria-labelledby={`${inputId}-h`}>
      <h2 id={`${inputId}-h`}>{t('form.step1')}</h2>

      {!cv && !busy && (
        <SpotlightCard
          spotlightColor="rgba(59, 130, 246, 0.22)"
          spotlightSize={320}
          theme="light"
          style={{
            border: 'none',
            background: 'transparent',
            padding: 0,
            width: '100%',
          }}
        >
          <div
            className={`drop ${over ? 'over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            <strong>{t('form.cv.drop')}</strong>
            <span className="or">{t('form.cv.or')}</span>
            <label htmlFor={inputId} className="btn" style={{ cursor: 'pointer' }}>
              {t('form.cv.choose')}
            </label>
            <input
              ref={inputRef}
              id={inputId}
              className="sr-only"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            <span className="hint">{t('form.cv.hint', { mb: MB })}</span>
          </div>
        </SpotlightCard>
      )}

      {busy && (
        <div className="progress" role="status" aria-live="polite">
          <span>{t('form.cv.extracting')}</span>
          <span className="bar" aria-hidden="true" />
        </div>
      )}

      {error && (
        <ErrorBanner onDismiss={() => setError(null)}>
          <p>{t(`err.${error}`, { mb: MB })}</p>
        </ErrorBanner>
      )}

      {cv && (
        <>
          <dl className="kv">
            <dt>{t('form.cv.file')}</dt>
            <dd>{cv.fileName}</dd>
            <dt>{t('form.cv.pages')}</dt>
            <dd>{cv.pageCount}</dd>
            <dt>{t('form.cv.status')}</dt>
            <dd>
              <strong>{cv.status === 'ok' ? t('form.cv.status.ok') : t('form.cv.status.no_text')}</strong>
              {cv.truncated && <div>{t('form.cv.status.truncated', { n: cv.pages.length })}</div>}
              {cv.status === 'ok' && cv.emptyPages.length > 0 && <div>{t('form.cv.status.empty', { pages: cv.emptyPages.join(', ') })}</div>}
            </dd>
            {cv.status === 'ok' && (
              <>
                <dt>{t('form.cv.columns')}</dt>
                <dd>{twoColPages.length ? t('form.cv.columns.two', { pages: twoColPages.join(', ') }) : t('form.cv.columns.one')}</dd>
              </>
            )}
          </dl>

          {cv.status === 'no_text' && (
            <ErrorBanner tone="warn">
              <h3>{t('form.cv.notext.title')}</h3>
              <p style={{ fontWeight: 400 }}>{t('form.cv.notext.body')}</p>
            </ErrorBanner>
          )}

          {cv.status === 'ok' && (
            <>
              <button type="button" className="btn secondary small" style={{ alignSelf: 'flex-start' }} aria-expanded={preview} onClick={() => setPreview((v) => !v)}>
                {preview ? t('form.cv.preview.hide') : t('form.cv.preview.show')}
              </button>
              {preview && (
                <pre className="preview" aria-label={t('form.cv.preview')}>
                  {cv.fullText.slice(0, 2500)}
                  {cv.fullText.length > 2500 ? '\n…' : ''}
                </pre>
              )}
            </>
          )}

          <div className="actions">
            <label htmlFor={inputId} className="btn secondary small" style={{ cursor: 'pointer' }}>
              {t('form.cv.replace')}
            </label>
            <input ref={inputRef} id={inputId} className="sr-only" type="file" accept="application/pdf,.pdf" onChange={(e) => void handleFile(e.target.files?.[0])} />
            <button type="button" className="btn secondary small" onClick={remove}>
              {t('form.cv.remove')}
            </button>
          </div>
        </>
      )}

      <p className="privacy-line">
        <span className="mark" aria-hidden="true" />
        <span>{t('form.cv.privacy')}</span>
      </p>
    </section>
  );
}
