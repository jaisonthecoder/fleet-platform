import type { Me } from './auth.contract'
import { hasAnyRole } from './roles'

/**
 * Resolves the best landing segment for a signed-in principal, based on the
 * roles they hold. Returns a path segment relative to the locale root (empty
 * string = the generic home page). Order is most-privileged-first so an admin
 * lands on the admin home rather than a generic dashboard.
 */
export function resolveLanding(me: Me | null): string {
  if (hasAnyRole(me, ['SystemAdmin'])) return 'admin'
  if (hasAnyRole(me, ['DataSteward'])) return 'data-quality'
  if (hasAnyRole(me, ['InternalAudit'])) return 'audit'
  return ''
}
