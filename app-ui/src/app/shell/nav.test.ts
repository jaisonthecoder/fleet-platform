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
  it('shows only the approved Employee modules to an employee', () => {
    const items = segments(me(['Employee']))
    expect(items).toEqual(['home', 'booking', 'dedicated-vehicle'])
  })

  it('shows the approved Fleet Manager operational modules', () => {
    expect(segments(me(['FleetManager']))).toEqual([
      'operations',
      'handover',
      'approvals',
      'booking-preparation',
      'dedicated-allocation',
      'vehicles',
      'compliance',
      'fines',
      'live-map',
    ])
  })

  it.each(['Approver', 'Delegate'])('shows the approval inbox to %s roles', (role) => {
    expect(segments(me([role]))).toEqual(['operations', 'approvals'])
  })

  it('shows only the approval inbox to Cluster CEO', () => {
    expect(segments(me(['ClusterCEO']))).toEqual(['approvals'])
  })

  it('shows only the approved Administrator modules to a System Admin', () => {
    expect(segments(me(['SystemAdmin']))).toEqual([
      'operations',
      'admin',
      'admin/access',
      'admin/organization',
      'admin/policy',
      'admin/consents',
      'admin/vendors-leases',
      'admin/reference-data',
      'admin/integrations',
    ])
  })

  it.each(['Executive', 'InternalAudit'])('shows the read-only operations view to %s', (role) => {
    expect(segments(me([role]))).toEqual(['operations'])
  })

  it('gives a Data Steward the governed data modules', () => {
    const items = segments(me(['DataSteward']))
    expect(items).toContain('vehicles')
    expect(items).toContain('admin/vendors-leases')
    expect(items).toContain('admin/reference-data')
    expect(items).toContain('admin/consents')
    expect(items).not.toContain('admin/access')
    expect(items).not.toContain('admin')
  })

  it('gives Procurement access to the Vendor and lease module', () => {
    expect(segments(me(['Procurement']))).toEqual(['admin/vendors-leases'])
  })

  it('combines approved modules when one principal holds multiple personas', () => {
    const items = segments(me(['Employee', 'FleetManager']))
    expect(items).toContain('booking')
    expect(items).toContain('vehicles')
  })
})
