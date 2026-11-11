import type { ReactNode } from 'react';
import type { Severity } from '../types/index.ts';
import { useI18n } from '../app/i18n-context.tsx';

/** Typographic logo: the dot over the capital I is the restricted brand red. */
export function Logo({ href = '#/', label = 'ElendIn' }: { href?: string; label?: string }) {
  return (
    <a className="logo" href={href} aria-label={label}>
      <span aria-hidden="true">
        Elend<span className="logo-i">I</span>n
      </span>
    </a>
  );
}

export function SeverityChip({ severity, neutral }: { severity: Severity; neutral?: boolean }) {
  const { t } = useI18n();
  const kind = neutral ? 'neutral' : severity;
  return <span className={`chip ${kind}`}>{neutral ? t('sev.neutral') : t(`sev.${severity}`)}</span>;
}

export function ErrorBanner({ children, onDismiss, tone = 'error' }: { children: ReactNode; onDismiss?: () => void; tone?: 'error' | 'warn' }) {
  const { t } = useI18n();
  return (
    <div className={`banner ${tone === 'warn' ? 'warn' : ''}`} role={tone === 'error' ? 'alert' : 'status'}>
      <div>{children}</div>
      {onDismiss && (
        <button type="button" className="btn secondary small" onClick={onDismiss}>
          {t('err.dismiss')}
        </button>
      )}
    </div>
  );
}
