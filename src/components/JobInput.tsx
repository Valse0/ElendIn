import { useId } from 'react';
import { INPUT_LIMITS } from '../engine/config.ts';
import { useI18n } from '../app/i18n-context.tsx';

export function JobInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  const id = useId();
  const chars = value.trim().length;
  return (
    <section className="card" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>{t('form.step2')}</h2>
      <textarea
        id={id}
        className="job"
        value={value}
        placeholder={t('form.job.placeholder')}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={`${id}-hint`}
        spellCheck={false}
      />
      <div className="row-between">
        <span className="count" aria-live="polite">
          {t('form.job.chars', { n: value.length.toLocaleString() })}
        </span>
        <button type="button" className="btn secondary small" onClick={() => onChange('')} disabled={value.length === 0}>
          {t('form.job.clear')}
        </button>
      </div>
      <p id={`${id}-hint`} className="hint">
        {chars > 0 && chars < INPUT_LIMITS.minJobChars ? t('form.job.short') : t('form.job.hint')}
      </p>
    </section>
  );
}
