import { describe, expect, it } from 'vitest'
import type { Me } from '@/features/auth/auth.contract'
import { navFor } from './nav'

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

const segments = (me: Me | null) => navFor(me).map((i) => i.segment)

describe('navFor (role-driven nav)', () => {
  it('shows operations items to any authenticated user', () => {
    const items = segments(me(['Employee']))
    expect(items).toContain('booking')
    expect(items).toContain('handover')
  })

  it('hides governance + administration from non-privileged users', () => {
    const items = segments(me(['Employee']))
    expect(items).not.toContain('admin')
    expect(items).not.toContain('admin/reference-data')
    expect(items).not.toContain('data-quality')
    expect(items).not.toContain('audit')
  })

  it('shows the full admin group to a System Admin', () => {
    const items = segments(me(['SystemAdmin']))
    expect(items).toEqual(
      expect.arrayContaining([
        'admin',
        'admin/reference-data',
        'admin/access',
        'admin/organization',
        'admin/policy',
        'admin/integrations',
        'admin/notifications',
        'data-quality',
        'audit',
      ]),
    )
  })

  it('shows reference-data + data-quality (not access) to a Data Steward', () => {
    const items = segments(me(['DataSteward']))
    expect(items).toContain('admin/reference-data')
    expect(items).toContain('data-quality')
    expect(items).not.toContain('admin/access')
    expect(items).not.toContain('admin')
  })

  it('shows only the audit console to an Internal Auditor', () => {
    const items = segments(me(['InternalAudit']))
    expect(items).toContain('audit')
    expect(items).not.toContain('admin/reference-data')
  })
})
