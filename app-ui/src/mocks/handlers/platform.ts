import { http, HttpResponse } from 'msw'

/** Default principal for authenticated renders (tests override via `server.use`). */
export const mockMe = {
  organizationId: '00000000-0000-4000-8000-000000000001',
  personId: 'p-dev',
  fullName: 'Dev User',
  email: 'dev@example.com',
  grade: 'G12',
  employmentStatus: 'Active',
  homePoolNodeId: 'node-pool',
  roles: [] as { role: string; scopeNodeId: string; scopeName: string | null }[],
}

/** A small three-level hierarchy (Group → Cluster → Pool) for the Scope Switcher. */
export const mockHierarchy = [
  {
    id: 'node-group',
    parentId: null,
    levelIndex: 0,
    levelLabel: 'Group',
    name: 'AD Ports Group',
    path: 'group',
    children: [
      {
        id: 'node-cluster',
        parentId: 'node-group',
        levelIndex: 1,
        levelLabel: 'Cluster',
        name: 'Ports Cluster',
        path: 'group.cluster',
        children: [
          {
            id: 'node-pool',
            parentId: 'node-cluster',
            levelIndex: 2,
            levelLabel: 'Pool',
            name: 'GS Pool · Mina Zayed',
            path: 'group.cluster.pool',
            children: [],
          },
        ],
      },
    ],
  },
]

/** Platform / identity read handlers used across authenticated screens. */
export const platformHandlers = [
  http.get('/api/v1/me', () => HttpResponse.json(mockMe)),
  http.get('/api/v1/hierarchy', () => HttpResponse.json(mockHierarchy)),
]
