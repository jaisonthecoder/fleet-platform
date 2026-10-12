import { useTranslation } from 'react-i18next';

import { Globe2 } from 'lucide-react';
import i18n from '../../../i18n';
import loginEnglish from '../../auth/i18n/en-US.json';
import loginSpanish from '../../auth/i18n/es-ES.json';
import chrome from '../../auth/pages/LoginPage.module.css';
import english from '../i18n/en-US.json';
import spanish from '../i18n/es-ES.json';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { SetPasswordPage } from './SetPasswordPage';

i18n.addResourceBundle('en-US', 'localAuth', english);
i18n.addResourceBundle('es-ES', 'localAuth', spanish);
i18n.addResourceBundle('en-US', 'login', loginEnglish);
i18n.addResourceBundle('es-ES', 'login', loginSpanish);

/** Matches the four paths handled here; the token is everything after the segment. */
const ROUTES = [
  { prefix: '/invitation/', purpose: 'activation' },
  { prefix: '/portal-admin-setup/', purpose: 'bootstrap' },
  { prefix: '/reset-password/', purpose: 'reset' },
] as const;

export function matchLocalAuthRoute(pathname: string) {
  if (pathname.replace(/\/+$/, '') === '/forgot-password') return { kind: 'forgot' } as const;
  for (const route of ROUTES) {
    if (pathname.startsWith(route.prefix)) {
      const token = decodeURIComponent(pathname.slice(route.prefix.length).replace(/\/+$/, ''));
      if (token) return { kind: 'setPassword', purpose: route.purpose, token } as const;
    }
  }
  return null;
}

export default function LocalAuthPage() {
  const { t } = useTranslation('login');
  const route = matchLocalAuthRoute(window.location.pathname);

  return (
    <div className={chrome.loginPage}>
      <section className={chrome.brandPane} aria-labelledby="auth-page-heading">
        <a href="/login" className={chrome.brandLogo} aria-label="Noatum Logistics">
          NOATUM <small>LOGISTICS</small>
        </a>

        <div className={chrome.brandMessage}>
          <p className={chrome.eyebrow}>{t('eyebrow')}</p>
          <h1 id="auth-page-heading">{t('headline')}</h1>
          <div className={chrome.rule} />
          <p className={chrome.description}>{t('intro')}</p>
        </div>

        <footer className={chrome.brandFooter}>
          <span>{t('group')}</span>
          <span>{t('copyright', { year: new Date().getFullYear() })}</span>
        </footer>
      </section>

      <section className={chrome.authPane}>
        <header className={chrome.authHeader}>
          <span>{t('signInLabel')}</span>
          <label className={chrome.languageSelect}>
            <Globe2 aria-hidden="true" />
            <span className="noa-visually-hidden">{t('language')}</span>
            <select value={i18n.language} onChange={(event) => void i18n.changeLanguage(event.target.value)}>
              <option value="en-US">{t('english')}</option>
              <option value="es-ES">{t('spanish')}</option>
            </select>
          </label>
        </header>

        <main className={chrome.authMain}>
          <div className={chrome.recoveryWorkspace}>
            <div className={chrome.customerSignIn}>
              {route?.kind === 'setPassword' ? (
                <SetPasswordPage purpose={route.purpose} token={route.token} />
              ) : (
                <ForgotPasswordPage />
              )}
            </div>
          </div>
        </main>

        <footer className={chrome.authFooter}>
          <span>{t('copyright', { year: new Date().getFullYear() })}</span>
          <a href="/login">{t('backToSignIn')}</a>
        </footer>
      </section>
    </div>
  );
}
