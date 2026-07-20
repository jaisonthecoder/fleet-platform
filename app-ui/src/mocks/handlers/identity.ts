import { http, HttpResponse } from 'msw'
import type {
  AccessReviewRow,
  UserDirectory,
  UserRole,
  UserSummary,
} from '@/features/identity/user-admin.contract'

/** Workforce-directory rows for the access-management screen + tests. */
export const mockUsers: UserDirectory[] = [
  {
    personId: 'p-aisha',
    userId: 'u1',
    name: 'Aisha Rahman',
    email: 'aisha@adports.ae',
    employeeId: 'HCM-1001',
    grade: 'G12',
    roles: ['FleetManager'],
    cluster: 'Ports Cluster',
    lastLoginAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    accountStatus: 'Active',
    status: 'Active',
  },
  {
    personId: 'p-omar',
    userId: 'u2',
    name: 'Omar Al Blooshi',
    email: 'omar@adports.ae',
    employeeId: 'HCM-1002',
    grade: 'G14',
    roles: ['Finance', 'Executive'],
    cluster: 'Logistics Cluster',
    lastLoginAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    accountStatus: 'Suspended',
    status: 'Suspended',
  },
  {
    personId: 'p-noura',
    userId: 'u3',
    name: 'Noura Abdullah',
    email: 'noura@adports.ae',
    employeeId: 'HCM-1003',
    grade: 'G16',
    roles: ['ClusterCEO'],
    cluster: 'Ports Cluster',
    lastLoginAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    accountStatus: 'Active',
    status: 'Active',
  },
  {
    personId: 'p-sultan',
    userId: null,
    name: 'Sultan Al Nuaimi',
    email: 'sultan@adports.ae',
    employeeId: 'HCM-1004',
    grade: 'G15',
    roles: ['Executive'],
    cluster: 'AD Ports Group',
    lastLoginAt: null,
    accountStatus: 'NoLogin',
    status: 'NoLogin',
  },
  {
    personId: 'p-khalid',
    userId: null,
    name: 'Khalid Rashed',
    email: 'khalid@adports.ae',
    employeeId: 'HCM-1005',
    grade: 'G11',
    roles: [],
    cluster: null,
    lastLoginAt: null,
    accountStatus: 'NoLogin',
    status: 'NoLogin',
  },
]

/** Population summary tiles. */
export const mockUserSummary: UserSummary = {
  employees: 214,
  fleetManagers: 9,
  executives: 4,
  administrators: 3,
}

/** Per-person active role assignments (revoke needs the assignment id) — keyed by personId. */
export const mockUserRoles: Record<string, UserRole[]> = {
  'p-aisha': [
    { assignmentId: 'ra-1', role: 'FleetManager', scopeNodeId: 'node-pool', scopeName: 'GS Pool · Mina Zayed', source: 'manual' },
  ],
  'p-omar': [
    { assignmentId: 'ra-2', role: 'Finance', scopeNodeId: 'node-cluster', scopeName: 'Ports Cluster', source: 'entra-group' },
    { assignmentId: 'ra-3', role: 'Executive', scopeNodeId: 'node-group', scopeName: 'AD Ports Group', source: 'manual' },
  ],
  'p-noura': [
    { assignmentId: 'ra-4', role: 'ClusterCEO', scopeNodeId: 'node-cluster', scopeName: 'Ports Cluster', source: 'manual' },
  ],
  'p-sultan': [
    { assignmentId: 'ra-5', role: 'Executive', scopeNodeId: 'node-group', scopeName: 'AD Ports Group', source: 'manual' },
  ],
}

/** "Who has what, where" export rows (include assignmentId for recertification). */
export const mockAccessReview: AccessReviewRow[] = [
  { assignmentId: 'ra-1', personId: 'p-aisha', role: 'FleetManager', scopeNodeId: 'node-pool', source: 'manual', assignedByPersonId: 'p-admin' },
  { assignmentId: 'ra-2', personId: 'p-omar', role: 'Finance', scopeNodeId: 'node-cluster', source: 'entra-group', assignedByPersonId: null },
]

/** User / access-administration handlers (SystemAdmin surfaces). */
export const identityHandlers = [
  http.get('/api/v1/admin/users', ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const role = url.searchParams.get('role')
    const search = url.searchParams.get('search')?.toLowerCase()
    let items = mockUsers
    if (status) items = items.filter((u) => u.status === status)
    if (role) items = items.filter((u) => u.roles.includes(role))
    if (search)
      items = items.filter(
        (u) =>
          u.name.toLowerCase().includes(search) ||
          (u.email ?? '').toLowerCase().includes(search) ||
          u.employeeId.toLowerCase().includes(search),
      )
    return HttpResponse.json({ items, total: items.length, page: 1, pageSize: 25 })
  }),
  http.get('/api/v1/admin/users/summary', () => HttpResponse.json(mockUserSummary)),
  http.get('/api/v1/admin/users/:personId/roles', ({ params }) =>
    HttpResponse.json(mockUserRoles[params.personId as string] ?? []),
  ),
  http.get('/api/v1/admin/access-review', () => HttpResponse.json(mockAccessReview)),
  http.post('/api/v1/admin/roles', () => HttpResponse.json({ ok: true }, { status: 201 })),
  http.delete('/api/v1/admin/roles/:assignmentId', () => new HttpResponse(null, { status: 204 })),
  http.post('/api/v1/admin/users/:id/suspend', () => HttpResponse.json({ ok: true })),
  http.post('/api/v1/admin/users/:id/reactivate', () => HttpResponse.json({ ok: true })),
]
