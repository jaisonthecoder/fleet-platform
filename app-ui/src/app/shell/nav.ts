import {
  BadgeCheck,
  BellRing,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Database,
  FileWarning,
  Gauge,
  Inbox,
  KeyRound,
  LineChart,
  Plug,
  ScrollText,
  Settings,
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
  // Operations
  { segment: 'booking', icon: CalendarDays, labelKey: 'nav.booking', group: 'operations' },
  { segment: 'handover', icon: KeyRound, labelKey: 'nav.handover', group: 'operations' },
  { segment: 'approvals', icon: Inbox, labelKey: 'nav.approvals', group: 'operations' },
  { segment: 'entitlements', icon: BadgeCheck, labelKey: 'nav.entitlements', group: 'operations' },
  { segment: 'console', icon: Gauge, labelKey: 'nav.console', group: 'operations' },
  { segment: 'fines', icon: FileWarning, labelKey: 'nav.fines', group: 'operations' },
  {
    segment: 'executive',
    icon: LineChart,
    labelKey: 'nav.executive',
    group: 'operations',
    disabled: true,
  },

  // Governance
  {
    segment: 'data-quality',
    icon: ClipboardCheck,
    labelKey: 'nav.dataQuality',
    group: 'governance',
    roles: ['DataSteward', 'SystemAdmin'],
  },
  {
    segment: 'audit',
    icon: ScrollText,
    labelKey: 'nav.audit',
    group: 'governance',
    roles: ['InternalAudit', 'SystemAdmin'],
  },

  // Administration
  {
    segment: 'admin',
    icon: Settings,
    labelKey: 'nav.adminHome',
    group: 'administration',
    roles: ['SystemAdmin'],
    end: true,
  },
  {
    segment: 'admin/reference-data',
    icon: Database,
    labelKey: 'nav.referenceData',
    group: 'administration',
    roles: ['DataSteward', 'SystemAdmin'],
  },
  {
    segment: 'admin/access',
    icon: Users,
    labelKey: 'nav.access',
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
    labelKey: 'nav.policyStudio',
    group: 'administration',
    roles: ['SystemAdmin'],
  },
  {
    segment: 'admin/integrations',
    icon: Plug,
    labelKey: 'nav.integrations',
    group: 'administration',
    roles: ['SystemAdmin'],
  },
  {
    segment: 'admin/notifications',
    icon: BellRing,
    labelKey: 'nav.notifications',
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
  return navItems.filter((item) => hasAnyRole(me, item.roles ?? []))
}
