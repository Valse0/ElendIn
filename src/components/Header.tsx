import { useEffect, useState } from 'react';
import { LANGS } from '../types/index.ts';
import { LANGUAGE_LABELS } from '../i18n/index.ts';
import { useI18n } from '../app/i18n-context.tsx';
import { Logo } from './ui.tsx';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Offers the browser's own install prompt when the PWA is installable (never forced, never shown otherwise). */
function useInstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setEvt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  return evt
    ? async () => {
        await evt.prompt();
        setEvt(null);
      }
    : null;
}

export function Header({ onHome, onAnalyze }: { onHome: () => void; onAnalyze: () => void }) {
  const { lang, setLang, t } = useI18n();
  const install = useInstallPrompt();
  return (
    <header className="header">
      <div className="wrap header-in">
        <Logo />
        <nav className="nav" aria-label="Main">
          <button type="button" className="linklike" onClick={onHome}>
            {t('nav.home')}
          </button>
          <button type="button" className="linklike" onClick={onAnalyze}>
            {t('nav.analyze')}
          </button>
          {install && (
            <button type="button" className="linklike" onClick={() => void install()}>
              {t('nav.install')}
            </button>
          )}
          <div className="lang" role="group" aria-label={t('nav.language')}>
            {LANGS.map((l) => (
              <button key={l} type="button" aria-pressed={lang === l} lang={l} title={LANGUAGE_LABELS[l]} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}
