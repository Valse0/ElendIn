import type { AnalysisResult } from '../types/index.ts';
import { useI18n } from '../app/i18n-context.tsx';
import { ExportPanel } from '../components/report/ExportPanel.tsx';
import { FindingsSection, ImprovementPanel, LimitsNote, RequirementsTable, ScoreCard, SummaryGrid } from '../components/report/ReportView.tsx';

export function ReportPage({ result, onBack, onNew }: { result: AnalysisResult; onBack: () => void; onNew: () => void }) {
  const { t } = useI18n();
  return (
    <main className="wrap report">
      <div className="report-head">
        <div>
          <p className="eyebrow">ElendIn</p>
          <h1 className="display">{t('report.title')}</h1>
          <p className="for">{result.job.title ? t('report.for', { title: result.job.title }) : t('report.forUnknown')}</p>
        </div>
        <div className="actions">
          <button type="button" className="btn secondary small" onClick={onBack}>
            {t('report.back')}
          </button>
          <button type="button" className="btn small" onClick={onNew}>
            {t('report.new')}
          </button>
        </div>
      </div>
      <ScoreCard result={result} />
      <SummaryGrid result={result} />
      <ImprovementPanel result={result} />
      <FindingsSection result={result} />
      <RequirementsTable result={result} />
      <ExportPanel result={result} />
      <LimitsNote />
    </main>
  );
}
