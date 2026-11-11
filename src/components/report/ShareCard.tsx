import { forwardRef } from 'react';
import type { AnalysisResult } from '../../types/index.ts';
import { useI18n } from '../../app/i18n-context.tsx';
import { hasIssues } from './ReportView.tsx';

/**
 * 1080×1350 social card, captured to PNG on explicit user request.
 *
 * PRIVACY CONTRACT — this component receives the whole result but may ONLY print:
 *   brand · a fixed title · the score · the number of critical findings · cliché density ·
 *   the number of requirements without clear evidence · a fixed disclaimer.
 * It never renders the job title, file name, CV text, evidence, or any finding text.
 * (tests/privacy.test.ts renders it with a PII-laden result and checks the markup.)
 */
export const ShareCard = forwardRef<HTMLDivElement, { result: AnalysisResult }>(function ShareCard({ result }, ref) {
  const { t } = useI18n();
  const s = result.summary;
  const issues = hasIssues(result);
  return (
    <div className="share" ref={ref} data-testid="share-card">
      <div>
        <span className="logo" aria-hidden="true">
          Elend<span className="logo-i">I</span>n
        </span>
        <p className="kicker">{t('export.card.kicker')}</p>
        <p className="title">{t('export.card.title')}</p>
      </div>
      <div className="scorebox">
        <div>
          <div className="scorelabel">{t('export.card.score')}</div>
          <div>
            <span className="big">{result.scoring.score}</span>
            <span className="of">{t('report.score.of')}</span>
          </div>
        </div>
        <div className={`stamp ${issues ? '' : 'clean'}`}>{issues ? t('report.stamp') : t('report.stamp.clean')}</div>
      </div>
      <div className="metrics">
        <div className="crit">
          <span className="n">{s.critical}</span>
          <span className="l">{t('export.card.critical')}</span>
        </div>
        <div>
          <span className="n">{s.clicheDensity === null ? '—' : `${s.clicheDensity}%`}</span>
          <span className="l">{t('export.card.cliche')}</span>
        </div>
        <div>
          <span className="n">{s.requirementsMissing + s.requirementsPartial}</span>
          <span className="l">{t('export.card.evidence')}</span>
        </div>
      </div>
      <div className="foot">
        <span>{t('export.card.footer')}</span>
      </div>
    </div>
  );
});
