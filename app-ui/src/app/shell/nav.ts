import {
  BadgeCheck,
  Building2,
  CalendarDays,
  CalendarPlus,
  Database,
  FileWarning,
  FileCheck2,
  Gauge,
  Handshake,
  House,
  Inbox,
  KeyRound,
  CarFront,
  MapPinned,
  Plug,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Me } from '@/features/auth/auth.contract'
import { hasAnyRole, type PlatformRole } from '@/features/auth/roles'

/** Sidebar section a nav item belongs to. */
export type NavGroup = 'operations' | 'governance' | 'administration'

export interface NavItem {
  /** Path segment relative to the locale root (may be nested, e.g. `admin/access`). */
  segment: string
  /** Icon shown on the rail (compact mode) and beside the label (expanded). */
  icon: LucideIcon
  labelKey: string
  /** Section grouping for the labelled sidebar dividers. */
  group: NavGroup
  /** Roles that may see this item; omitted = visible to any authenticated user. */
  roles?: PlatformRole[]
  end?: boolean
  /** Rendered as a dimmed, non-interactive item (e.g. not-yet-built areas). */
  disabled?: boolean
}

/**
 * Single source of truth for the sidebar. Operational items keep the Wayfinder
 * rail order; governance + administration items are role-gated and only appear
 * for the actors who can reach them (RBAC affordance — the backend still enforces).
 */
export const navItems: NavItem[] = [
  // Employee
  {
    segment: 'home',
    icon: House,
    labelKey: 'nav.home',
    group: 'operations',
    roles: ['Employee', 'SubstituteDriver', 'ProfessionalDriver'],
    end: true,
  },
  {
    segment: 'booking',
    icon: CalendarDays,
    labelKey: 'nav.bookVehicle',
    group: 'operations',
    roles: ['Employee', 'SubstituteDriver', 'ProfessionalDriver'],
  },
  {
    segment: 'dedicated-vehicle',
    icon: BadgeCheck,
    labelKey: 'nav.dedicatedVehicle',
    group: 'operations',
    roles: ['Employee', 'ProfessionalDriver'],
  },

  // Fleet Manager
  {
    segment: 'operations',
    icon: Gauge,
    labelKey: 'nav.opsDashboard',
    group: 'operations',
    roles: ['Approver', 'Delegate', 'FleetManager', 'ClusterFleetLead', 'GroupFleetLead', 'Executive', 'InternalAudit', 'SystemAdmin'],
    end: true,
  },
  {
    segment: 'handover',
    icon: KeyRound,
    labelKey: 'nav.handover',
    group: 'operations',
    roles: ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'],
  },
  {
    segment: 'bookings/create',
    icon: CalendarPlus,
    labelKey: 'nav.createBooking',
    group: 'operations',
    roles: ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'],
    disabled: true,
  },
  {
    segment: 'approvals',
    icon: Inbox,
    labelKey: 'nav.bookingApprovals',
    group: 'operations',
    roles: ['Approver', 'Delegate', 'FleetManager', 'ClusterFleetLead', 'GroupFleetLead', 'ClusterCEO'],
  },
  {
    segment: 'booking-preparation',
    icon: KeyRound,
    labelKey: 'nav.bookingPreparation',
    group: 'operations',
    roles: ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'],
  },
  {
    segment: 'dedicated-allocation',
    icon: CarFront,
    labelKey: 'nav.dedicatedAllocation',
    group: 'operations',
    roles: ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'],
  },
  {
    segment: 'vehicles',
    icon: CarFront,
    labelKey: 'nav.vehicleManagement',
    group: 'operations',
    roles: [
      'FleetManager',
      'ClusterFleetLead',
      'GroupFleetLead',
      'DataSteward',
    ],
    end: true,
  },
  {
    segment: 'compliance',
    icon: ShieldAlert,
    labelKey: 'nav.complianceAlerts',
    group: 'operations',
    roles: ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'],
  },
  {
    segment: 'fines',
    icon: FileWarning,
    labelKey: 'nav.fines',
    group: 'operations',
    roles: ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'],
  },
  {
    segment: 'live-map',
    icon: MapPinned,
    labelKey: 'nav.liveMap',
    group: 'operations',
    roles: ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'],
  },

  // Administrator
  {
    segment: 'admin',
    icon: Settings,
    labelKey: 'nav.adminConsole',
    group: 'administration',
    roles: ['SystemAdmin'],
    end: true,
  },
  {
    segment: 'admin/access',
    icon: Users,
    labelKey: 'nav.usersAccess',
    group: 'administration',
    roles: ['SystemAdmin'],
  },
  {
    segment: 'admin/organization',
    icon: Building2,
    labelKey: 'nav.organization',
    group: 'administration',
    roles: ['SystemAdmin'],
  },
  {
    segment: 'admin/policy',
    icon: SlidersHorizontal,
    labelKey: 'nav.policiesRules',
    group: 'administration',
    roles: ['SystemAdmin'],
  },
  {
    segment: 'admin/consents',
    icon: FileCheck2,
    labelKey: 'nav.consentManagement',
    group: 'administration',
    roles: ['SystemAdmin', 'DataSteward'],
  },
  {
    segment: 'admin/vendors-leases',
    icon: Handshake,
    labelKey: 'nav.vendorsLeases',
    group: 'administration',
    roles: ['SystemAdmin', 'Procurement', 'DataSteward'],
  },
  {
    segment: 'admin/reference-data',
    icon: Database,
    labelKey: 'nav.lookupManagement',
    group: 'administration',
    roles: ['DataSteward', 'SystemAdmin'],
  },
  {
    segment: 'admin/integrations',
    icon: Plug,
    labelKey: 'nav.systemIntegrations',
    group: 'administration',
    roles: ['SystemAdmin'],
  },
]

/** The ordered group sections rendered in the sidebar. */
export const NAV_GROUPS: NavGroup[] = [
  'operations',
  'governance',
  'administration',
]

/** Nav items the given principal is allowed to see (role-filtered). */
export function navFor(me: Me | null): NavItem[] {
  return navItems.filter((item) => !item.disabled && hasAnyRole(me, item.roles ?? []))
}
