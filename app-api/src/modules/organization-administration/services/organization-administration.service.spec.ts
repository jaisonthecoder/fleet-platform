import { OrganizationAdministrationService } from './organization-administration.service';

const now = new Date('2026-07-19T00:00:00Z');

class FakeOrganizationRepository {
  organization = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'AD Ports Group',
    code: 'ADPORTS',
    defaultCurrency: 'AED',
    defaultTimezone: 'Asia/Dubai',
    revision: 1,
    createdAtUtc: now,
    updatedAtUtc: now,
  };
  nodes = [
    { id: 'group', organizationId: this.organization.id, parentId: null, code: 'ADPORTS', levelIndex: 0, levelLabel: 'Group', levelCode: 'GROUP', name: 'AD Ports Group', nameAr: 'مجموعة موانئ أبوظبي', path: 'group', validFrom: now, validTo: null, revision: 1, createdAtUtc: now, updatedAtUtc: now },
    { id: 'cluster', organizationId: this.organization.id, parentId: 'group', code: 'PORTS', levelIndex: 1, levelLabel: 'Cluster', levelCode: 'CLUSTER', name: 'Ports', nameAr: 'الموانئ', path: 'group.ports', validFrom: now, validTo: null, revision: 1, createdAtUtc: now, updatedAtUtc: now },
    { id: 'pool', organizationId: this.organization.id, parentId: 'cluster', code: 'PORTS-KHALIFA', levelIndex: 2, levelLabel: 'Pool', levelCode: 'POOL', name: 'Khalifa Port Pool', nameAr: 'مجمع ميناء خليفة', path: 'group.ports.khalifa', validFrom: now, validTo: null, revision: 1, createdAtUtc: now, updatedAtUtc: now },
  ];
  quality = { activeNodes: 3, activeRoots: 1, missingCodes: 0, missingArabicNames: 0, missingLevelCodes: 0, peopleWithoutHomeScope: 0, activeRoleAssignments: 2, activeVehicleAssignments: 1 };

  async findOrganization() { return this.organization; }
  async listLevels() {
    return [
      { id: 'level-group', code: 'GROUP', position: 0, labelEn: 'Group', labelAr: 'مجموعة', mandatory: true, active: true, revision: 1, nodeCount: 1 },
      { id: 'level-cluster', code: 'CLUSTER', position: 1, labelEn: 'Cluster', labelAr: 'مجموعة فرعية', mandatory: true, active: true, revision: 1, nodeCount: 1 },
      { id: 'level-pool', code: 'POOL', position: 2, labelEn: 'Pool', labelAr: 'مجمع', mandatory: true, active: true, revision: 1, nodeCount: 1 },
    ];
  }
  async listActiveHierarchy() { return this.nodes; }
  async hierarchyMetrics() {
    return [
      { nodeId: 'root', vehicleCount: 4, userCount: 3, utilizedVehicleCount: 2 },
      { nodeId: 'cluster', vehicleCount: 4, userCount: 3, utilizedVehicleCount: 2 },
      { nodeId: 'pool', vehicleCount: 4, userCount: 3, utilizedVehicleCount: 2 },
    ];
  }
  async qualityCounts() { return this.quality; }
}

describe('OrganizationAdministrationService', () => {
  const audit = { record: jest.fn() };
  const outbox = { enqueue: jest.fn() };

  it('builds an enriched arbitrary-depth hierarchy workspace', async () => {
    const repo = new FakeOrganizationRepository();
    const service = new OrganizationAdministrationService(
      repo as never,
      audit as never,
      outbox as never,
    );
    const workspace = await service.workspace();
    expect(workspace.organization).toMatchObject({ code: 'ADPORTS', revision: 1 });
    expect(workspace.levels).toHaveLength(3);
    expect(workspace.hierarchy).toHaveLength(1);
    expect(workspace.hierarchy[0].children[0].children[0]).toMatchObject({
      code: 'PORTS-KHALIFA',
      nameAr: 'مجمع ميناء خليفة',
      levelCode: 'POOL',
      vehicleCount: 4,
      userCount: 3,
      utilizationPercent: 50,
    });
    expect(workspace.hierarchy[0].childCount).toBe(1);
    expect(workspace.quality.healthy).toBe(true);
  });

  it('surfaces actionable quality reasons instead of hiding invalid roots and home scopes', async () => {
    const repo = new FakeOrganizationRepository();
    repo.quality = { ...repo.quality, activeRoots: 4, peopleWithoutHomeScope: 6 };
    const service = new OrganizationAdministrationService(
      repo as never,
      audit as never,
      outbox as never,
    );
    await expect(service.quality()).resolves.toMatchObject({
      healthy: false,
      reasons: ['organization-active-root-count:4', 'people-without-home-scope:6'],
    });
  });
});
