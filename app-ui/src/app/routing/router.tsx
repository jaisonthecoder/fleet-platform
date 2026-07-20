import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  useParams,
  type RouteObject,
} from 'react-router-dom'
import { AppShell } from '@/app/shell/app-shell'
import { navItems } from '@/app/shell/nav'
import { RequireAuth } from '@/features/auth/require-auth'
import { RequireRole } from '@/features/auth/require-role'
import { useAuth } from '@/features/auth/auth-context'
import { ADMIN_ROLES } from '@/features/auth/roles'
import { resolveLanding } from '@/features/auth/landing'
import { RouteError } from './route-error'
import { RouteFallback } from './route-fallback'
import i18n, {
  defaultLanguage,
  supportedLanguages,
  type AppLanguage,
} from '@/i18n/config'

// Route components are code-split so each screen (and its heavy libraries) load
// on demand instead of shipping in the initial bundle.
const HomePage = lazy(() =>
  import('@/features/home/home-page').then((m) => ({ default: m.HomePage })),
)
const DesignShowcasePage = lazy(() =>
  import('@/features/design/design-showcase').then((m) => ({
    default: m.DesignShowcasePage,
  })),
)
const BookingSamplePage = lazy(() =>
  import('@/features/samples/booking-sample').then((m) => ({
    default: m.BookingSamplePage,
  })),
)
const BookVehiclePage = lazy(() =>
  import('@/features/booking/book-vehicle-page').then((m) => ({
    default: m.BookVehiclePage,
  })),
)
const HandoverPage = lazy(() =>
  import('@/features/handover/handover-page').then((m) => ({
    default: m.HandoverPage,
  })),
)
const ReferenceDataPage = lazy(() =>
  import('@/features/config/reference-data-page').then((m) => ({
    default: m.ReferenceDataPage,
  })),
)
const AccessManagementPage = lazy(() =>
  import('@/features/identity/access-management-page').then((m) => ({
    default: m.AccessManagementPage,
  })),
)
const PolicyStudioPage = lazy(() =>
  import('@/features/policy/policy-studio-page').then((m) => ({
    default: m.PolicyStudioPage,
  })),
)
const OrganizationPage = lazy(() =>
  import('@/features/organization/organization-page').then((m) => ({
    default: m.OrganizationPage,
  })),
)
const ComingSoonPage = lazy(() =>
  import('@/features/misc/coming-soon').then((m) => ({
    default: m.ComingSoonPage,
  })),
)
const NotFoundPage = lazy(() =>
  import('@/features/misc/not-found').then((m) => ({
    default: m.NotFoundPage,
  })),
)
const LoginPage = lazy(() =>
  import('@/features/auth/login-page').then((m) => ({ default: m.LoginPage })),
)
const AuthCallback = lazy(() =>
  import('@/features/auth/auth-callback').then((m) => ({
    default: m.AuthCallback,
  })),
)

/** Wraps a lazy route element in a Suspense boundary with a neutral fallback. */
function page(node: ReactNode): ReactNode {
  return <Suspense fallback={<RouteFallback />}>{node}</Suspense>
}

/** Validates the URL locale + syncs i18next, then renders nested routes. */
function LocaleLayout() {
  const { lang } = useParams()
  const isSupported = supportedLanguages.includes(lang as AppLanguage)

  useEffect(() => {
    if (isSupported && lang && i18n.language !== lang) {
      void i18n.changeLanguage(lang)
    }
  }, [lang, isSupported])

  if (!isSupported) return <Navigate to={`/${defaultLanguage}`} replace />
  return <Outlet />
}

/** Sends the index route to the actor's role-appropriate landing (or Home). */
function IndexRedirect() {
  const { me } = useAuth()
  const { lang } = useParams()
  const landing = resolveLanding(me)
  if (!landing) return page(<HomePage />)
  return <Navigate to={`/${lang ?? defaultLanguage}/${landing}`} replace />
}

/** Locale-aware redirect used for route-compatibility shims. */
function LocaleRedirect({ to }: { to: string }) {
  const { lang } = useParams()
  return <Navigate to={`/${lang ?? defaultLanguage}/${to}`} replace />
}

/**
 * Route table. The active locale lives in the URL (`/en`, `/ar`); `/` and any
 * unsupported locale redirect to the default language. Route render errors are
 * caught by `RouteError`.
 */
export const appRoutes: RouteObject[] = [
  { index: true, element: <Navigate to={`/${defaultLanguage}`} replace /> },
  // Azure AD redirect URI (registered as the SPA redirect) — outside the locale tree.
  { path: 'auth/callback', element: page(<AuthCallback />) },
  {
    path: ':lang',
    element: <LocaleLayout />,
    errorElement: <RouteError />,
    children: [
      // Public sign-in (rendered without the app shell).
      { path: 'login', element: page(<LoginPage />) },
      // Everything else requires an authenticated session + the app shell.
      {
        element: (
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <IndexRedirect /> },
          { path: 'design', element: page(<DesignShowcasePage />) },
          { path: 'book-sample', element: page(<BookingSamplePage />) },
          { path: 'booking', element: page(<BookVehiclePage />) },
          { path: 'handover', element: page(<HandoverPage />) },
          // Administration: reference data (lookups) is built (U1).
          {
            path: 'admin/reference-data',
            element: (
              <RequireRole roles={ADMIN_ROLES}>
                {page(<ReferenceDataPage />)}
              </RequireRole>
            ),
          },
          {
            path: 'admin/access',
            element: (
              <RequireRole roles={['SystemAdmin']}>
                {page(<AccessManagementPage />)}
              </RequireRole>
            ),
          },
          {
            path: 'admin/policy',
            element: (
              <RequireRole roles={['SystemAdmin']}>
                {page(<PolicyStudioPage />)}
              </RequireRole>
            ),
          },
          {
            path: 'admin/organization',
            element: (
              <RequireRole roles={['SystemAdmin']}>
                {page(<OrganizationPage />)}
              </RequireRole>
            ),
          },
          // Operational areas not yet built show "coming soon".
          ...navItems
            .filter(
              (item) =>
                item.group === 'operations' &&
                !item.disabled &&
                item.segment !== 'booking' &&
                item.segment !== 'handover',
            )
            .map((item) => ({
              path: item.segment,
              element: page(<ComingSoonPage />),
            })),
          // Governance + administration areas are role-guarded (placeholder until built).
          ...navItems
            .filter((item) => item.group !== 'operations' && !item.disabled && item.segment !== 'admin/reference-data' && item.segment !== 'admin/access' && item.segment !== 'admin/policy' && item.segment !== 'admin/organization')
            .map((item) => ({
              path: item.segment,
              element: (
                <RequireRole roles={item.roles ?? []}>
                  {page(<ComingSoonPage />)}
                </RequireRole>
              ),
            })),
          // Compatibility: the old flat policy route now lives under admin.
          { path: 'policy', element: <LocaleRedirect to="admin/policy" /> },
          // Anything else under a valid locale is a genuine 404.
          { path: '*', element: page(<NotFoundPage />) },
        ],
      },
    ],
  },
]

/** Builds the browser router used by the running app. */
export function createAppRouter() {
  return createBrowserRouter(appRoutes)
}
