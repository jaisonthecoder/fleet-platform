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
const DedicatedVehiclePage = lazy(() =>
  import('@/features/dedicated-vehicle/dedicated-vehicle-page').then((m) => ({
    default: m.DedicatedVehiclePage,
  })),
)
const DedicatedAllocationPage = lazy(() =>
  import('@/features/dedicated-vehicle/dedicated-allocation-page').then((m) => ({ default: m.DedicatedAllocationPage })),
)
const OperationsPage = lazy(() =>
  import('@/features/operations/operations-page').then((m) => ({ default: m.OperationsPage })),
)
const BookingApprovalsPage = lazy(() =>
  import('@/features/approvals/booking-approvals-page').then((m) => ({ default: m.BookingApprovalsPage })),
)
const BookingPreparationPage = lazy(() =>
  import('@/features/approvals/booking-preparation-page').then((m) => ({ default: m.BookingPreparationPage })),
)
const HandoverCapturePage = lazy(() =>
  import('@/features/handover/handover-capture-page').then((m) => ({ default: m.HandoverCapturePage })),
)
const HandoverRegisterPage = lazy(() =>
  import('@/features/handover/handover-register-page').then((m) => ({ default: m.HandoverRegisterPage })),
)
const HandoverChainPage = lazy(() =>
  import('@/features/handover/handover-chain-page').then((m) => ({ default: m.HandoverChainPage })),
)
const VehicleOnboardingPage = lazy(() =>
  import('@/features/vehicles/vehicle-onboarding-page').then((m) => ({
    default: m.VehicleOnboardingPage,
  })),
)
const VehicleManagementPage = lazy(() =>
  import('@/features/vehicles/vehicle-management-page').then((m) => ({
    default: m.VehicleManagementPage,
  })),
)
const VehicleImportPage = lazy(() =>
  import('@/features/vehicles/vehicle-import-page').then((m) => ({
    default: m.VehicleImportPage,
  })),
)
const LiveMapPage = lazy(() =>
  import('@/features/telematics/live-map-page').then((m) => ({
    default: m.LiveMapPage,
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
const ConsentAdministrationPage = lazy(() =>
  import('@/features/consent-administration/consent-administration-page').then((m) => ({ default: m.ConsentAdministrationPage })),
)
const OrganizationPage = lazy(() =>
  import('@/features/organization/organization-page').then((m) => ({
    default: m.OrganizationPage,
  })),
)
const VendorsPage = lazy(() =>
  import('@/features/vendors/vendors-page').then((m) => ({
    default: m.VendorsPage,
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
          { path: 'home', element: page(<HomePage />) },
          { path: 'design', element: page(<DesignShowcasePage />) },
          { path: 'book-sample', element: page(<BookingSamplePage />) },
          {
            path: 'booking',
            element: (
              <RequireRole roles={['Employee', 'SubstituteDriver', 'ProfessionalDriver']}>
                {page(<BookVehiclePage />)}
              </RequireRole>
            ),
          },
          {
            path: 'dedicated-vehicle',
            element: (
              <RequireRole roles={['Employee', 'ProfessionalDriver']}>
                {page(<DedicatedVehiclePage />)}
              </RequireRole>
            ),
          },
          {
            path: 'approvals',
            element: (
              <RequireRole roles={['Approver', 'Delegate', 'FleetManager', 'ClusterFleetLead', 'GroupFleetLead', 'ClusterCEO']}>
                {page(<BookingApprovalsPage />)}
              </RequireRole>
            ),
          },
          {
            path: 'booking-preparation',
            element: (
              <RequireRole roles={['FleetManager', 'ClusterFleetLead', 'GroupFleetLead']}>
                {page(<BookingPreparationPage />)}
              </RequireRole>
            ),
          },
          {
            path: 'dedicated-allocation',
            element: (
              <RequireRole roles={['FleetManager', 'ClusterFleetLead', 'GroupFleetLead']}>
                {page(<DedicatedAllocationPage />)}
              </RequireRole>
            ),
          },
          {
            path: 'handover',
            element: (
              <RequireRole roles={['FleetManager', 'ClusterFleetLead', 'GroupFleetLead']}>
                {page(<HandoverRegisterPage />)}
              </RequireRole>
            ),
          },
          {
            path: 'handover/new',
            element: (
              <RequireRole roles={['FleetManager', 'ClusterFleetLead', 'GroupFleetLead']}>
                {page(<HandoverCapturePage />)}
              </RequireRole>
            ),
          },
          {
            path: 'handover/return',
            element: (
              <RequireRole roles={['FleetManager', 'ClusterFleetLead', 'GroupFleetLead']}>
                {page(<HandoverCapturePage />)}
              </RequireRole>
            ),
          },
          {
            path: 'handover/work',
            element: (
              <RequireRole roles={['FleetManager', 'ClusterFleetLead', 'GroupFleetLead']}>
                {page(<HandoverCapturePage />)}
              </RequireRole>
            ),
          },
          {
            path: 'handover/:handoverId',
            element: (
              <RequireRole roles={['FleetManager', 'ClusterFleetLead', 'GroupFleetLead']}>
                {page(<HandoverChainPage />)}
              </RequireRole>
            ),
          },
          {
            path: 'vehicles',
            element: (
              <RequireRole
                roles={[
                  'FleetManager',
                  'ClusterFleetLead',
                  'GroupFleetLead',
                  'DataSteward',
                ]}
              >
                {page(<VehicleManagementPage />)}
              </RequireRole>
            ),
          },
          {
            path: 'vehicles/onboard',
            element: (
              <RequireRole
                roles={[
                  'FleetManager',
                  'ClusterFleetLead',
                  'GroupFleetLead',
                  'DataSteward',
                ]}
              >
                {page(<VehicleOnboardingPage />)}
              </RequireRole>
            ),
          },
          {
            path: 'vehicles/import',
            element: (
              <RequireRole
                roles={[
                  'FleetManager',
                  'ClusterFleetLead',
                  'GroupFleetLead',
                  'DataSteward',
                ]}
              >
                {page(<VehicleImportPage />)}
              </RequireRole>
            ),
          },
          {
            path: 'vehicle-onboarding',
            element: <LocaleRedirect to="vehicles/onboard" />,
          },
          {
            path: 'live-map',
            element: (
              <RequireRole
                roles={['FleetManager', 'ClusterFleetLead', 'GroupFleetLead']}
              >
                {page(<LiveMapPage />)}
              </RequireRole>
            ),
          },
          {
            path: 'operations',
            element: (
              <RequireRole roles={['Approver', 'Delegate', 'FleetManager', 'ClusterFleetLead', 'GroupFleetLead', 'Executive', 'InternalAudit', 'SystemAdmin']}>
                {page(<OperationsPage />)}
              </RequireRole>
            ),
          },
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
            path: 'admin/consents',
            element: (
              <RequireRole roles={['SystemAdmin', 'DataSteward']}>
                {page(<ConsentAdministrationPage />)}
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
          {
            path: 'admin/vendors-leases',
            element: (
              <RequireRole roles={['SystemAdmin', 'Procurement', 'DataSteward']}>
                {page(<VendorsPage />)}
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
                item.segment !== 'dedicated-vehicle' &&
                item.segment !== 'handover' &&
                item.segment !== 'vehicles' &&
                item.segment !== 'home' &&
                item.segment !== 'approvals' &&
                item.segment !== 'booking-preparation' &&
                item.segment !== 'dedicated-allocation' &&
                item.segment !== 'live-map' &&
                item.segment !== 'operations',
            )
            .map((item) => ({
              path: item.segment,
              element: (
                <RequireRole roles={item.roles ?? []}>
                  {page(<ComingSoonPage />)}
                </RequireRole>
              ),
            })),
          // Governance + administration areas are role-guarded (placeholder until built).
          ...navItems
            .filter(
              (item) =>
                item.group !== 'operations' &&
                !item.disabled &&
                item.segment !== 'admin/reference-data' &&
                item.segment !== 'admin/access' &&
                item.segment !== 'admin/policy' &&
                item.segment !== 'admin/consents' &&
                item.segment !== 'admin/organization' &&
                item.segment !== 'admin/vendors-leases',
            )
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
