import { useI18n } from '../app/i18n-context.tsx';
import { APP_VERSION } from '../app/version.ts';

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="footer">
      <div className="wrap footer-in">
        <p>{t('footer.privacy')}</p>
        <p className="mono">{t('footer.version', { v: APP_VERSION })}</p>
      </div>
    </footer>
  );
}
