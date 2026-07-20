import type { Me } from './auth.contract'

/** The closed set of platform roles — mirrors the backend DB enum `fleet_role`. */
export const PLATFORM_ROLES = [
  'Employee',
  'Approver',
  'Delegate',
  'FleetManager',
  'ClusterFleetLead',
  'GroupFleetLead',
  'ClusterCEO',
  'Procurement',
  'Finance',
  'HR',
  'InsuranceLead',
  'HSE',
  'InternalAudit',
  'Executive',
  'DataSteward',
  'SystemAdmin',
  'SubstituteDriver',
  'ProfessionalDriver',
] as const

export type PlatformRole = (typeof PLATFORM_ROLES)[number]

/** Roles that can reach reference-data / configuration surfaces. */
export const ADMIN_ROLES: PlatformRole[] = ['SystemAdmin', 'DataSteward']

/** Roles that can reach the read-only audit / governance consoles. */
export const AUDIT_ROLES: PlatformRole[] = ['InternalAudit', 'SystemAdmin']

/** The set of role names the principal currently holds (across all scopes). */
export function heldRoles(me: Me | null): Set<string> {
  return new Set((me?.roles ?? []).map((r) => r.role))
}

/** True when the principal holds at least one of the given roles (any scope). */
export function hasAnyRole(
  me: Me | null,
  roles: readonly PlatformRole[],
): boolean {
  if (roles.length === 0) return true
  const held = heldRoles(me)
  return roles.some((role) => held.has(role))
}

/** True when the principal belongs to the admin / governance family. */
export function isAdminFamily(me: Me | null): boolean {
  return hasAnyRole(me, ['SystemAdmin', 'DataSteward', 'InternalAudit'])
}
