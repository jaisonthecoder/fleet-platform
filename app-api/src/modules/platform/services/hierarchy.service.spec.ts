import type { Principal } from '../../../common/auth/principal';
import { HierarchyService } from './hierarchy.service';

const nodes = [
  { id: 'root', organizationId: 'org-1', parentId: null, code: 'ROOT', levelIndex: 0, levelLabel: 'Group', levelCode: 'GROUP', name: 'Root', nameAr: 'Root', path: 'root', validFrom: new Date(), validTo: null, revision: 1, createdAtUtc: new Date(), updatedAtUtc: new Date() },
  { id: 'cluster-a', organizationId: 'org-1', parentId: 'root', code: 'A', levelIndex: 1, levelLabel: 'Cluster', levelCode: 'CLUSTER', name: 'A', nameAr: 'A', path: 'root.a', validFrom: new Date(), validTo: null, revision: 1, createdAtUtc: new Date(), updatedAtUtc: new Date() },
  { id: 'pool-a', organizationId: 'org-1', parentId: 'cluster-a', code: 'A-POOL', levelIndex: 2, levelLabel: 'Pool', levelCode: 'POOL', name: 'A Pool', nameAr: 'A Pool', path: 'root.a.pool', validFrom: new Date(), validTo: null, revision: 1, createdAtUtc: new Date(), updatedAtUtc: new Date() },
  { id: 'location-a', organizationId: 'org-1', parentId: 'pool-a', code: 'A-LOC', levelIndex: 3, levelLabel: 'Location', levelCode: 'LOCATION', name: 'A Location', nameAr: 'A Location', path: 'root.a.pool.location', validFrom: new Date(), validTo: null, revision: 1, createdAtUtc: new Date(), updatedAtUtc: new Date() },
  { id: 'cluster-b', organizationId: 'org-1', parentId: 'root', code: 'B', levelIndex: 1, levelLabel: 'Cluster', levelCode: 'CLUSTER', name: 'B', nameAr: 'B', path: 'root.b', validFrom: new Date(), validTo: null, revision: 1, createdAtUtc: new Date(), updatedAtUtc: new Date() },
];

const principal = (scopeNodeId: string): Principal => ({
  organizationId: 'org-1',
  userId: null,
  personId: 'person',
  entraObjectId: null,
  email: null,
  roles: [{ role: 'Employee', scopeNodeId }],
  isDevLogin: true,
});

describe('HierarchyService authorized tree', () => {
  it('returns assigned subtree plus ancestors but excludes sibling scopes', async () => {
    const repo = { listHierarchy: jest.fn().mockResolvedValue(nodes) };
    const service = new HierarchyService(repo as never);
    const tree = await service.getAuthorizedTree(principal('pool-a'));
    expect(repo.listHierarchy).toHaveBeenCalledWith('org-1');
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('root');
    expect(tree[0].children.map((node) => node.id)).toEqual(['cluster-a']);
    expect(tree[0].children[0].children[0].id).toBe('pool-a');
    expect(tree[0].children[0].children[0].children[0].id).toBe('location-a');
  });

  it('returns no hierarchy for a principal without scoped roles', async () => {
    const repo = { listHierarchy: jest.fn().mockResolvedValue(nodes) };
    const service = new HierarchyService(repo as never);
    await expect(
      service.getAuthorizedTree({ ...principal('pool-a'), roles: [] }),
    ).resolves.toEqual([]);
  });
});
