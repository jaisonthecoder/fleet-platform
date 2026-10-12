import {
  Building2,
  Boxes,
  GitPullRequestArrow,
  Layers,
  ListTree,
  Network,
  PanelRight,
  SlidersHorizontal,
  Table2,
  ToggleRight,
  UsersRound,
} from 'lucide-react';

/**
 * Administration destinations.
 *
 * Two groups: the reference and customer data an administrator maintains, and
 * the Noatum operating structure behind it. Every entry is gated on its own
 * permission. Entries marked unavailable are visible but cannot be opened -
 * Phase 1 defines the access, the workflow follows later (FR-NAV-001/003/004).
 */
export const staffNavigation = [
  {
    id: 'organisations',
    href: '/portal/organisations',
    icon: Network,
    permission: 'admin.organisations.link',
    group: 'administration',
    available: true,
  },
  {
    id: 'customers',
    href: '/portal/customers',
    icon: Building2,
    permission: 'admin.customers.read',
    group: 'administration',
    available: true,
  },
  {
    id: 'unassigned',
    href: '/portal/unassigned',
    icon: GitPullRequestArrow,
    permission: 'admin.customers.manage',
    group: 'administration',
    available: true,
  },
  {
    id: 'lookups',
    href: '/portal/lookups',
    icon: ListTree,
    permission: 'admin.lookups.manage',
    group: 'administration',
    available: true,
  },
  {
    id: 'features',
    href: '/portal/features',
    icon: ToggleRight,
    permission: 'admin.flags.manage',
    group: 'administration',
    available: true,
  },
  {
    id: 'settings',
    href: '/portal/settings',
    icon: SlidersHorizontal,
    permission: 'admin.settings.read',
    group: 'administration',
    available: true,
  },

  {
    id: 'branches',
    href: '/portal/branches',
    icon: Layers,
    permission: 'admin.operating.read',
    group: 'operating',
    available: true,
  },
  {
    id: 'pricing',
    href: '/portal/pricing',
    icon: Table2,
    permission: 'pricing.queue.read',
    group: 'operating',
    available: true,
  },
  {
    id: 'staff',
    href: '/portal/staff',
    icon: UsersRound,
    permission: 'admin.staff.read',
    group: 'operating',
    available: true,
  },
] as const;

export const workspaceNavigation = [
  { id: 'kit', icon: Boxes },
  { id: 'foundation', icon: Layers },
  { id: 'controls', icon: SlidersHorizontal },
  { id: 'overlays', icon: PanelRight },
  { id: 'data', icon: Table2 },
  { id: 'listings', icon: Table2 },
] as const;

export const workspaceMobileNavigation = ['kit', 'controls', 'data', 'listings'] as const;

/**
 * Customer destinations.
 *
 * The customer shell is a website, so these are horizontal top-level sections
 * rather than a grouped rail. Only the dashboard has a screen today; the rest
 * are declared and marked unavailable so the navigation shows the whole product
 * from the first release and each one lights up as its slice lands. That is the
 * same treatment the staff rail already gives an unreleased destination.
 *
 * Every entry is gated on a permission the API issues, so a customer never sees
 * a section their role does not carry.
 */
export const customerNavigation = [
  { id: 'dashboard', href: '/app/dashboard', permission: 'dashboard.read', available: true },
  { id: 'shipments', href: '/app/shipments', permission: 'shipments.read', available: false },
  { id: 'quotations', href: '/app/quotations', permission: 'quotes.read', available: true },
  { id: 'bookings', href: '/app/bookings', permission: 'bookings.read', available: false },
  { id: 'invoices', href: '/app/invoices', permission: 'invoices.read', available: false },
  /*
   * The customer's own administration. Last, because it is about the account
   * rather than the work, and gated on users.manage so it appears only for the
   * Customer Admin - the layout already filters on the permission, so an
   * ordinary colleague never sees that it exists.
   */
  { id: 'team', href: '/app/team', permission: 'users.manage', available: true },
] as const;
