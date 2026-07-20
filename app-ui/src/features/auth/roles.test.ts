import { describe, expect, it } from 'vitest'
import type { Me } from './auth.contract'
import { hasAnyRole, isAdminFamily, heldRoles } from './roles'
import { resolveLanding } from './landing'

function me(roles: string[]): Me {
  return {
    organizationId: '00000000-0000-4000-8000-000000000001',
    personId: 'p1',
    fullName: 'Test User',
    email: null,
    grade: null,
    employmentStatus: 'Active',
    homePoolNodeId: null,
    roles: roles.map((role) => ({ role, scopeNodeId: 's1', scopeName: null })),
  }
}

describe('roles helpers', () => {
  it('heldRoles collects the role names', () => {
    expect(heldRoles(me(['SystemAdmin', 'FleetManager']))).toEqual(
      new Set(['SystemAdmin', 'FleetManager']),
    )
    expect(heldRoles(null).size).toBe(0)
  })

  it('hasAnyRole matches at least one role; empty required = allowed', () => {
    expect(hasAnyRole(me(['DataSteward']), ['SystemAdmin', 'DataSteward'])).toBe(true)
    expect(hasAnyRole(me(['Employee']), ['SystemAdmin'])).toBe(false)
    expect(hasAnyRole(me(['Employee']), [])).toBe(true)
    expect(hasAnyRole(null, ['SystemAdmin'])).toBe(false)
  })

  it('isAdminFamily is true for admin/steward/audit only', () => {
    expect(isAdminFamily(me(['InternalAudit']))).toBe(true)
    expect(isAdminFamily(me(['DataSteward']))).toBe(true)
    expect(isAdminFamily(me(['FleetManager']))).toBe(false)
  })
})

describe('resolveLanding', () => {
  it('sends each actor to its landing, most-privileged first', () => {
    expect(resolveLanding(me(['SystemAdmin', 'DataSteward']))).toBe('admin')
    expect(resolveLanding(me(['DataSteward']))).toBe('data-quality')
    expect(resolveLanding(me(['InternalAudit']))).toBe('audit')
    expect(resolveLanding(me(['FleetManager']))).toBe('')
    expect(resolveLanding(null)).toBe('')
  })
})
