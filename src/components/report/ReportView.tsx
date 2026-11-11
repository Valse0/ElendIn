import type { AnalysisResult, Dimension, Finding, RequirementReport } from '../../types/index.ts';
import { findingText } from '../../i18n/index.ts';
import { useI18n } from '../../app/i18n-context.tsx';
import { SeverityChip } from '../ui.tsx';
import CountUp from '../reactbits/CountUp.tsx';

const DIMENSIONS: Dimension[] = ['jobMatch', 'structure', 'language', 'consistency'];

export function hasIssues(r: AnalysisResult): boolean {
  return r.summary.critical + r.summary.medium > 0;
}

/* ------------------------------------------------------------------ */

export function ScoreCard({ result }: { result: AnalysisResult }) {
  const { t } = useI18n();
  const { score, potentialScore, partial, dimensions } = result.scoring;
  const issues = hasIssues(result);
  return (
    <section className="score-card" aria-label={t('report.score')}>
      <div>
        <div className="score-label">{t('report.score')}</div>
        <div className="score-num" aria-label={`${score} / 100`}>
          <span className="big">
            <CountUp from={0} to={score} duration={1.2} />
          </span>
          <span className="of">{t('report.score.of')}</span>
        </div>
        <div className="meter" role="img" aria-label={`${score}/100 → ${potentialScore}/100`}>
          <span style={{ width: `${score}%` }} />
          {potentialScore > score && <i style={{ left: `${potentialScore}%` }} />}
        </div>
        <div className="mono" style={{ fontSize: 13, fontWeight: 700 }}>
          {t('report.potential', { n: potentialScore })}
        </div>
      </div>
      <div className={`stamp ${issues ? '' : 'clean'}`} role="img" aria-label={issues ? t('report.stamp') : t('report.stamp.clean')}>
        {issues ? t('report.stamp') : t('report.stamp.clean')}
      </div>
      <div className="score-notes">
        <p>
          <strong>{t('report.simulated')}</strong>
        </p>
        <p className="muted">{t('report.potential.note')}</p>
        {partial && <p className="muted">{t('report.partial')}</p>}
        <details className="how">
          <summary>{t('report.how')}</summary>
          <p>{t('report.how.body')}</p>
          <div className="dimbars">
            {DIMENSIONS.map((d) => (
              <div key={d}>
                <span>{t(`dim.${d}`)}</span>
                <span className="track" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, (dimensions[d].counted / dimensions[d].cap) * 100)}%` }} />
                </span>
                <span>
                  −{dimensions[d].counted}/{dimensions[d].cap}
                </span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function SummaryGrid({ result }: { result: AnalysisResult }) {
  const { t } = useI18n();
  const s = result.summary;
  return (
    <section className="block" aria-labelledby="sum-h">
      <h2 id="sum-h">{t('report.summary')}</h2>
      <div className="summary-grid">
        <div className="crit">
          <span className="n">{s.critical}</span>
          <span className="l">{t('report.summary.critical')}</span>
        </div>
        <div>
          <span className="n">{s.medium}</span>
          <span className="l">{t('report.summary.medium')}</span>
        </div>
        <div>
          <span className="n">{s.low}</span>
          <span className="l">{t('report.summary.low')}</span>
        </div>
        <div>
          <span className="n">{s.requirementsMissing + s.requirementsPartial}</span>
          <span className="l">{t('report.summary.evidence')}</span>
        </div>
        <div>
          <span className="n">{s.clicheDensity === null ? '—' : `${s.clicheDensity}%`}</span>
          <span className="l">{t('report.summary.cliche')}</span>
        </div>
      </div>
      <p className="line">{s.requirementsTotal > 0 ? t('report.summary.required', { found: s.requiredFound, total: s.requiredTotal }) : t('report.summary.noReq')}</p>
      {result.warnings.length > 0 && (
        <div className="warnings">
          {result.warnings.map((w) => (
            <div className="banner warn" role="status" key={w}>
              <p>{t(`report.warn.${w}`)}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function statusClass(r: RequirementReport): string {
  if (r.status === 'missing') return 'none';
  if (r.status === 'related') return 'part';
  return 'ok';
}

export function RequirementsTable({ result }: { result: AnalysisResult }) {
  const { t } = useI18n();
  if (result.requirements.length === 0) return null;
  return (
    <section className="block" aria-labelledby="req-h">
      <h2 id="req-h">{t('report.requirements')}</h2>
      <p className="sub">{t('report.requirements.sub')}</p>
      <div className="table-scroll">
        <table className="reqs">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">{t('report.col.requirement')}</th>
              <th scope="col">{t('report.col.status')}</th>
              <th scope="col">{t('report.col.evidence')}</th>
            </tr>
          </thead>
          <tbody>
            {result.requirements.map((r, i) => (
              <tr key={r.id}>
                <td className="tag">{String(i + 1).padStart(2, '0')}</td>
                <td>
                  <strong>{r.kind === 'education' ? t(`edu.${r.label}`) : r.label}</strong>
                  <div className="tag">{t(`report.req.${r.priority}`)}</div>
                </td>
                <td className={`st ${statusClass(r)}`}>{t(`report.req.${r.status}`)}</td>
                <td className="tag" style={{ textTransform: 'none' }}>
                  {r.evidence ?? ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function FindingCard({ finding, index, result }: { finding: Finding; index: number; result: AnalysisResult }) {
  const { lang, t } = useI18n();
  const text = findingText(lang, finding);
  const d = result.scoring.deductions.find((x) => x.findingId === finding.id);
  const tone = finding.neutral ? 'neutral' : finding.severity;
  return (
    <article className={`finding ${tone}`} aria-labelledby={`f-${finding.id}`}>
      <div className="bar" aria-hidden="true" />
      <div className="finding-body">
        <div className="finding-top">
          <span>{String(index).padStart(2, '0')}</span>
          <SeverityChip severity={finding.severity} neutral={finding.neutral} />
          <span>
            {t('report.inspector')}: {t(`insp.${finding.inspector}.name`)}
          </span>
          <span>· {t(`dim.${finding.dimension}`)}</span>
          {d && (
            <span className="points">{d.dedupedBy ? t('report.deduped') : d.points > 0 ? t('report.points', { n: d.points }) : t('report.points.none')}</span>
          )}
        </div>
        <div>
          <p className="lab">{t('report.problem')}</p>
          <h3 id={`f-${finding.id}`}>{text.title}</h3>
        </div>
        <div>
          <p className="lab">{t('report.why')}</p>
          <p className="t">{text.why}</p>
        </div>
        {text.justification && (
          <div className="justify">
            <p className="lab">{t('report.justify')}</p>
            <p className="t">{text.justification}</p>
          </div>
        )}
        {finding.evidence.length > 0 && (
          <div>
            <p className="lab">{t('report.evidence')}</p>
            <ul className="evidence">
              {finding.evidence.map((ev, i) => (
                <li key={i}>
                  <span>{ev.source === 'cv' ? t('report.evidence.cv') : t('report.evidence.job')}</span>
                  {ev.text}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <p className="lab">{t('report.fix')}</p>
          <p className="t">{text.fix}</p>
        </div>
        {finding.beforeAfter && text.after && (
          <div className="ba">
            <div>
              <p className="lab">{t('report.before')}</p>
              {finding.beforeAfter.before ? <q>{finding.beforeAfter.before}</q> : <p className="none">{t('report.beforeNone')}</p>}
            </div>
            <div className="after">
              <p className="lab">{t('report.after')}</p>
              <p>{text.after}</p>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export function FindingsSection({ result }: { result: AnalysisResult }) {
  const { t } = useI18n();
  const real = result.findings.filter((f) => !f.neutral);
  const context = result.findings.filter((f) => f.neutral);
  return (
    <>
      <section className="block" aria-labelledby="find-h">
        <h2 id="find-h">{t('report.findings')}</h2>
        {real.length === 0 ? <p className="sub">{t('report.findings.none')}</p> : real.map((f, i) => <FindingCard key={f.id} finding={f} index={i + 1} result={result} />)}
      </section>
      {context.length > 0 && (
        <section className="block" aria-labelledby="ctx-h">
          <h2 id="ctx-h">{t('report.context')}</h2>
          <p className="sub">{t('report.context.sub')}</p>
          {context.map((f, i) => (
            <FindingCard key={f.id} finding={f} index={i + 1} result={result} />
          ))}
        </section>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

export function ImprovementPanel({ result }: { result: AnalysisResult }) {
  const { lang, t } = useI18n();
  const imp = result.improvement;
  const first = result.findings.find((f) => f.id === imp.firstFixId);
  return (
    <section className="block" aria-labelledby="imp-h">
      <h2 id="imp-h">{t('report.improve')}</h2>
      <div className="improve">
        {first ? (
          <div>
            <p className="lab">{t('report.improve.first')}</p>
            <p className="first">{findingText(lang, first).title}</p>
          </div>
        ) : (
          <p>{t('report.improve.none')}</p>
        )}
        {imp.requirementsNeedingEvidence.length > 0 && (
          <div>
            <p className="lab">{t('report.improve.evidence')}</p>
            <ul>
              {imp.requirementsNeedingEvidence.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {imp.sectionsToReview.length > 0 && (
          <div>
            <p className="lab">{t('report.improve.sections')}</p>
            <p style={{ margin: 0, fontWeight: 600 }}>{imp.sectionsToReview.map((s) => t(`section.${s}`)).join(' · ')}</p>
          </div>
        )}
      </div>
    </section>
  );
}

export function LimitsNote() {
  const { t } = useI18n();
  return (
    <section className="block limits" aria-labelledby="lim-h">
      <h2 id="lim-h">{t('report.limits.title')}</h2>
      <p>{t('report.limits.body')}</p>
    </section>
  );
}
