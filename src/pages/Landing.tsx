import { INSPECTOR_ORDER, PLANNED_INSPECTORS } from '../engine/inspectors/index.ts';
import { useI18n } from '../app/i18n-context.tsx';
import SpotlightCard from '../components/reactbits/SpotlightCard.tsx';

export function Landing({ onStart }: { onStart: () => void }) {
  const { t } = useI18n();
  return (
    <main>
      <section className="hero">
        <div className="wrap">
          <p className="eyebrow">{t('hero.eyebrow')}</p>
          <h1 className="display">
            <span className="strike">{t('hero.title')}</span>
          </h1>
          <p className="hero-sub">{t('hero.sub')}</p>
          <p className="hero-explain">{t('hero.explain')}</p>
          <div className="cta-row">
            <button type="button" className="btn" onClick={onStart}>
              {t('hero.cta')}
            </button>
            <a className="btn secondary" href="#how" onClick={(e) => { e.preventDefault(); document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' }); }}>
              {t('hero.cta2')}
            </a>
          </div>
          <p className="notice">
            <span className="mark" aria-hidden="true" />
            <strong>{t('hero.privacy')}</strong>
          </p>
          <p className="notice limit" style={{ marginTop: 10 }}>
            <span className="mark" aria-hidden="true" />
            <span>{t('hero.limits')}</span>
          </p>
        </div>
      </section>

      <section className="section" id="how">
        <div className="wrap">
          <h2 className="display">{t('how.title')}</h2>
          <ol className="steps">
            {[1, 2, 3, 4].map((n) => (
              <li key={n} style={{ padding: 0 }}>
                <SpotlightCard
                  spotlightColor="rgba(59, 130, 246, 0.18)"
                  spotlightSize={260}
                  theme="dark"
                  style={{
                    padding: 20,
                    background: 'rgba(33, 35, 46, 0.65)',
                    height: '100%',
                    border: 'none',
                  }}
                >
                  <span className="n">0{n}</span>
                  <h3>{t(`how.${n}.title`)}</h3>
                  <p>{t(`how.${n}.body`)}</p>
                </SpotlightCard>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2 className="display">{t('insp.title')}</h2>
          <p className="hero-explain" style={{ marginTop: -8 }}>{t('insp.sub')}</p>
          <ul className="inspectors">
            {INSPECTOR_ORDER.map((id, i) => {
              const planned = PLANNED_INSPECTORS.includes(id);
              return (
                <li key={id} className={planned ? 'planned' : ''} style={{ listStyle: 'none' }}>
                  <SpotlightCard
                    spotlightColor="rgba(59, 130, 246, 0.22)"
                    spotlightSize={300}
                    theme={planned ? 'dark' : 'light'}
                    style={{
                      border: 'var(--rule) solid',
                      borderColor: planned ? 'var(--ink-line)' : 'var(--paper)',
                      background: planned ? 'rgba(33, 35, 46, 0.65)' : 'var(--paper)',
                      color: planned ? 'var(--paper)' : 'var(--ink)',
                      padding: 18,
                      height: '100%',
                    }}
                  >
                    <span className="num">0{i + 1}</span>
                    <h3>{t(`insp.${id}.name`)}</h3>
                    <p>{t(`insp.${id}.tag`)}</p>
                    <span className="status">{planned ? t('insp.status.planned') : t('insp.status.active')}</span>
                  </SpotlightCard>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </main>
  );
}
