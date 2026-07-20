import { type ReactNode } from 'react'
import { RouteFallback } from '@/app/routing/route-fallback'
import { useAuth } from './auth-context'
import { AccessDenied } from './access-denied'
import { hasAnyRole, type PlatformRole } from './roles'

interface RequireRoleProps {
  roles: PlatformRole[]
  children: ReactNode
}

/**
 * Route guard: renders children only when the principal holds one of `roles`,
 * else an {@link AccessDenied} screen. Runs after `RequireAuth`, so a principal
 * is present; while auth is still resolving it shows the neutral fallback.
 * Defence-in-depth only — the backend `RolesGuard` remains the security boundary.
 */
export function RequireRole({ roles, children }: RequireRoleProps) {
  const { status, me } = useAuth()
  if (status === 'loading') return <RouteFallback />
  if (!hasAnyRole(me, roles)) return <AccessDenied requiredRoles={roles} />
  return <>{children}</>
}
