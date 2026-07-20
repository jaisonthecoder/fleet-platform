import { ForbiddenException } from '@nestjs/common';
import type { Principal } from '../../../common/auth/principal';
import { ScopeAuthorizationService } from './scope-authorization.service';

const nodes = [
  { id: 'root', parentId: null, path: 'root' },
  { id: 'cluster-a', parentId: 'root', path: 'root.a' },
  { id: 'pool-a', parentId: 'cluster-a', path: 'root.a.pool' },
  { id: 'pool-b', parentId: 'root', path: 'root.b.pool' },
];

const principal = (role: Principal['roles'][number]): Principal => ({
  organizationId: 'org-1',
  userId: null,
  personId: 'person',
  entraObjectId: null,
  email: null,
  roles: [role],
  isDevLogin: true,
});

describe('ScopeAuthorizationService', () => {
  const repo = { listHierarchy: jest.fn().mockResolvedValue(nodes) };
  const service = new ScopeAuthorizationService(repo as never);

  it('allows a role over its exact scope and descendants', async () => {
    const actor = principal({ role: 'FleetManager', scopeNodeId: 'cluster-a' });
    await expect(
      service.assertRolesAtScope(actor, ['FleetManager'], 'pool-a'),
    ).resolves.toBeUndefined();
  });

  it('rejects sibling scopes and roles outside the allowed set', async () => {
    const actor = principal({ role: 'FleetManager', scopeNodeId: 'cluster-a' });
    await expect(
      service.assertRolesAtScope(actor, ['FleetManager'], 'pool-b'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.assertRolesAtScope(actor, ['SystemAdmin'], 'pool-a'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires an allowed role at an organization root for organization-wide actions', async () => {
    await expect(
      service.assertRootRole(
        principal({ role: 'SystemAdmin', scopeNodeId: 'root' }),
        ['SystemAdmin'],
      ),
    ).resolves.toBeUndefined();
    await expect(
      service.assertRootRole(
        principal({ role: 'SystemAdmin', scopeNodeId: 'cluster-a' }),
        ['SystemAdmin'],
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
