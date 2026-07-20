import { ForbiddenException } from '@nestjs/common';
import type { AuditService } from '../../platform/services/audit.service';
import { SodGuardService } from '../../platform/services/sod-guard.service';
import type { PlatformRole } from '../../../common/database/schema';
import { bucketUserSummary } from '../../../contracts/user-admin.contract';
import type { IdentityRepository } from '../repositories/identity.repository';
import { UserAdminService } from './user-admin.service';

class FakeRepo {
  rolesOnScope: PlatformRole[] = [];
  inserted: Record<string, unknown>[] = [];
  expired: string[] = [];
  listActiveRolesOnScope = async () => this.rolesOnScope;
  insertRoleAssignment = async (values: Record<string, unknown>) => {
    this.inserted.push(values);
    return { id: 'ra1', ...values };
  };
  expireRoleAssignment = async (id: string) => {
    this.expired.push(id);
    return { id, validTo: new Date() };
  };
}

function make(existing: PlatformRole[] = []) {
  const repo = new FakeRepo();
  repo.rolesOnScope = existing;
  const audit = { record: async () => {} };
  const service = new UserAdminService(
    repo as unknown as IdentityRepository,
    new SodGuardService(),
    audit as unknown as AuditService,
  );
  return { service, repo };
}

describe('UserAdminService — SoD at role assignment (LU-2)', () => {
  it('grants a role when the resulting co-hold is SoD-legal', async () => {
    const { service, repo } = make([]);
    const result = await service.assignRole({
      organizationId: '00000000-0000-4000-8000-000000000001',
      personId: '00000000-0000-4000-8000-0000000000p1',
      role: 'Approver',
      scopeNodeId: '00000000-0000-4000-8000-0000000000s1',
      assignedByPersonId: '00000000-0000-4000-8000-0000000000a1',
    });
    expect(result.id).toBe('ra1');
    expect(repo.inserted).toHaveLength(1);
    expect(repo.inserted[0].source).toBe('manual');
  });

  it('rejects a grant that would co-hold Finance + FleetManager (SoD-04)', async () => {
    const { service, repo } = make(['Finance']);
    let caught: unknown;
    try {
      await service.assignRole({
        organizationId: '00000000-0000-4000-8000-000000000001',
        personId: '00000000-0000-4000-8000-0000000000p1',
        role: 'FleetManager',
        scopeNodeId: '00000000-0000-4000-8000-0000000000s1',
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ForbiddenException);
    const body = (caught as ForbiddenException).getResponse() as { reasons?: string[] };
    expect(body.reasons?.some((r) => r.includes('SoD-04'))).toBe(true);
    expect(repo.inserted).toHaveLength(0);
  });

  it('rejects System Admin co-held with an operational approver role (SoD-05)', async () => {
    const { service } = make(['SystemAdmin']);
    await expect(
      service.assignRole({
        organizationId: '00000000-0000-4000-8000-000000000001',
        personId: '00000000-0000-4000-8000-0000000000p1',
        role: 'FleetManager',
        scopeNodeId: '00000000-0000-4000-8000-0000000000s1',
      }),
    ).rejects.toThrow();
  });

  it('revokes by effective-date expiry (never hard delete)', async () => {
    const { service, repo } = make();
    await service.revokeRole('ra-9');
    expect(repo.expired).toContain('ra-9');
  });
});

describe('bucketUserSummary — role-family tiles', () => {
  it('buckets each role family into its tile', () => {
    const summary = bucketUserSummary([
      { role: 'Employee', count: 12 },
      { role: 'FleetManager', count: 3 },
      { role: 'Executive', count: 1 },
      { role: 'ClusterCEO', count: 2 },
      { role: 'SystemAdmin', count: 1 },
      { role: 'DataSteward', count: 1 },
      { role: 'HSE', count: 5 },
    ]);
    expect(summary).toEqual({
      employees: 12,
      fleetManagers: 3,
      executives: 3, // Executive + ClusterCEO
      administrators: 2, // SystemAdmin + DataSteward
    });
  });

  it('returns zeros when no roles are held', () => {
    expect(bucketUserSummary([])).toEqual({
      employees: 0,
      fleetManagers: 0,
      executives: 0,
      administrators: 0,
    });
  });
});
