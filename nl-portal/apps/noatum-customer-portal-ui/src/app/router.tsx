import { Navigate, Route, Routes } from 'react-router-dom';
import { PortalLayout } from './layouts/PortalLayout';
import {
  ControlsPreview,
  DataPreview,
  FoundationPreview,
  OverlaysPreview,
} from '@/features/ui-workspace/WorkspacePages';
import ListingPreview from '@/features/ui-workspace/ListingPreview';
import { Gallery } from '@/design-system/showcase';
import { StaffPortalLayout } from './layouts/StaffPortalLayout';
import StaffPage from '../features/staff/pages/StaffPage';
import { UnassignedPage } from '../features/admin/pages/UnassignedPage';
import { OperatingPage } from '../features/admin/pages/OperatingPage';
import { CustomerDetailPage, CustomersPage } from '../features/admin/pages/CustomersPage';
import { FeatureManagementPage } from '../features/admin/pages/FeatureManagementPage';
import { SettingsPage } from '../features/admin/pages/SettingsPage';
import { PricingQueuePage } from '../features/pricing/pages/PricingQueuePage';
import { PricingDetailPage } from '../features/pricing/pages/PricingDetailPage';
import { QuotesListPage } from '../features/quotes/pages/QuotesListPage';
import { QuoteInstantPage } from '../features/quotes/pages/QuoteInstantPage';
import { QuoteDetailPage } from '../features/quotes/pages/QuoteDetailPage';
import { QuoteRequestPage } from '../features/quotes/pages/QuoteRequestPage';
import { LookupsPage } from '../features/admin/pages/LookupsPage';
import {
  OrganisationDetailPage,
  OrganisationsPage,
} from '../features/admin/pages/OrganisationsPage';
import AccountSecurityPage from '../features/local-auth/pages/AccountSecurityPage';
import { CustomerAccountSecurityPage } from '../features/local-auth/pages/CustomerAccountSecurityPage';
import { TeamPage } from '../features/customer-admin/pages/TeamPage';
import { CustomerPortalLayout, CustomerSectionFallback } from './layouts/CustomerPortalLayout';
import { CustomerDashboardPage } from '../features/dashboard/pages/CustomerDashboardPage';

export function PortalRoutes() {
  return (
    <Routes>
      <Route path="portal" element={<StaffPortalLayout />}>
        <Route index element={<Navigate to="staff" replace />} />
        <Route path="organisations" element={<OrganisationsPage />} />
        <Route path="organisations/:id" element={<OrganisationDetailPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="unassigned" element={<UnassignedPage />} />
        <Route path="lookups" element={<LookupsPage />} />
        <Route path="features" element={<FeatureManagementPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="pricing" element={<PricingQueuePage />} />
        <Route path="pricing/:id" element={<PricingDetailPage />} />
        <Route path="branches" element={<OperatingPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="account" element={<AccountSecurityPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/portal/staff" replace />} />
    </Routes>
  );
}

/**
 * The customer portal, under /app.
 *
 * Separate from PortalRoutes on purpose: /portal is the staff application and
 * keeps its sidebar shell untouched. The two trees never share a layout, so a
 * change to one cannot alter the other.
 *
 * The dashboard is public: a customer can see what the portal is before they
 * have an account. Every other section is behind CustomerSectionFallback, which
 * sends a visitor to sign in. The layout itself sends a staff account to /portal.
 */
export function CustomerRoutes() {
  return (
    <Routes>
      <Route path="app" element={<CustomerPortalLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<CustomerDashboardPage />} />
        {/* Managing your own password and second factor is not a "section", so it
            stays out of the main navigation and hangs off the profile menu. */}
        <Route path="account" element={<CustomerAccountSecurityPage />} />
        {/* Asking for a quotation is what a customer comes here to do far more
            often than reading the list, so asking is what the section opens
            with. The list keeps every one of its behaviours, at /list. */}
        <Route path="quotations" element={<QuoteInstantPage />} />
        {/* Both before ":id", or either would be read as a quote id. */}
        <Route path="quotations/list" element={<QuotesListPage />} />
        <Route path="quotations/new" element={<QuoteRequestPage />} />
        <Route path="quotations/:id" element={<QuoteDetailPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="*" element={<CustomerSectionFallback />} />
      </Route>
      <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
    </Routes>
  );
}

export function WorkspaceRoutes() {
  if (!import.meta.env.DEV) return null;
  return (
    <Routes>
      {/* The design system's own gallery. Deliberately outside PortalLayout:
          it demonstrates the kit, so it must not inherit application chrome. */}
      <Route path="kit" element={<Gallery />} />
      <Route element={<PortalLayout />}>
        <Route index element={<Navigate to="/controls" replace />} />
        <Route path="controls" element={<ControlsPreview />} />
        <Route path="foundation" element={<FoundationPreview />} />
        <Route path="overlays" element={<OverlaysPreview />} />
        <Route path="data" element={<DataPreview />} />
        <Route path="listings" element={<ListingPreview />} />
        <Route path="*" element={<Navigate to="/controls" replace />} />
      </Route>
    </Routes>
  );
}
