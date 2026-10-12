import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import './i18n';
import './design-system/styles/foundation.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element missing');
const root = createRoot(rootElement);

function PendingPortal() {
  const { t } = useTranslation();
  return (
    <main className="noa-production-state">
      <h1>{t('brand')}</h1>
      <p>{t('portalPending')}</p>
    </main>
  );
}

// Set a password, or ask for a link to do so. Reached from an email, never from a menu.
const LOCAL_AUTH_PATH =
  /^\/(?:forgot-password|(?:invitation|portal-admin-setup|reset-password)\/[^/]+)\/?$/;

/**
 * A portal session survives in its cookie across tabs and restarts, but the CSRF token
 * that goes with it may not be cached yet. Ask the API for one before the portal decides
 * whether anybody is signed in.
 *
 * `restore` is false on the public sign-in page: there is nothing to recover there, and
 * an unauthenticated probe would only delay the first paint.
 */
async function restorePortalSession(restore: boolean): Promise<void> {
  const { csrfToken, forgetCsrf, restoreLocalSession } = await import('./features/local-auth/api/local-auth');
  // Switched off, so any leftover token would only divert staff requests to cookie auth.
  if (import.meta.env.VITE_LOCAL_AUTH_ENABLED !== 'true') {
    forgetCsrf();
    return;
  }
  if (!restore && !csrfToken()) return;
  await restoreLocalSession();
}

if (LOCAL_AUTH_PATH.test(window.location.pathname)) {
  void import('./features/local-auth/pages/LocalAuthPage').then(({ default: LocalAuthPage }) => {
    root.render(
      <StrictMode>
        <LocalAuthPage />
      </StrictMode>,
    );
  });
} else if (window.location.pathname === '/' || /^\/login(?:\/(?:customer|staff))?\/?$/.test(window.location.pathname)) {
  void restorePortalSession(false)
    .then(() => import('./features/auth/pages/LoginPage'))
    .then(({ default: LoginPage }) => {
      root.render(<StrictMode><LoginPage /></StrictMode>);
    });
} else if (/^\/(?:portal|app)(?:\/|$)/.test(window.location.pathname) || import.meta.env.DEV) {
  void restorePortalSession(true)
    .then(() => import('./app/App'))
    .then(({ default: App }) => {
      root.render(
        <StrictMode>
          <App />
        </StrictMode>,
      );
    });
} else {
  root.render(
    <StrictMode>
      <PendingPortal />
    </StrictMode>,
  );
}
