import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/bootstrap/configure-app';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import {
  hierarchyNode,
  lookupType,
  person,
  roleAssignment,
} from '../src/common/database/schema';

/**
 * End-to-end proof of authentication + RBAC (Sub-Phase 1A₂ G3). Requires a live
 * DB + Redis. Verifies: protected routes deny without auth (401); dev-login
 * authenticates; admin routes enforce roles (403 without, 200/201 with); and an
 * RBAC-gated lookup admin write is visible on the public-ish read.
 */
describe('auth + RBAC over HTTP (integration — requires DB + Redis)', () => {
  let app: NestFastifyApplication;
  let db: DrizzleDatabase;

  const suffix = randomUUID().slice(0, 8);
  const typeCode = `it-auth-type-${suffix}`;
  let scopeNodeId = '';
  let adminPersonId = '';
  let plainPersonId = '';
  let createdHierarchyNodeId = '';
  const moveNodeIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    db = app.get<DrizzleDatabase>(DRIZZLE);

    const [node] = await db
      .insert(hierarchyNode)
      .values({ parentId: 'a0000000-0000-4000-8000-000000000003', code: `AUTH-${suffix.toUpperCase()}`, levelIndex: 3, levelLabel: 'Location', levelCode: 'LOCATION', name: `Auth Location ${suffix}`, nameAr: `موقع ${suffix}`, path: sql`${`group.ports.khalifa.auth_${suffix}`}::ltree` })
      .returning({ id: hierarchyNode.id });
    scopeNodeId = node.id;

    const [admin] = await db
      .insert(person)
      .values({ hcmEmployeeId: `it-admin-${suffix}`, fullName: `Admin ${suffix}`, employmentStatus: 'Active' })
      .returning({ id: person.id });
    adminPersonId = admin.id;
    const [plain] = await db
      .insert(person)
      .values({ hcmEmployeeId: `it-plain-${suffix}`, fullName: `Plain ${suffix}`, employmentStatus: 'Active' })
      .returning({ id: person.id });
    plainPersonId = plain.id;

    await db.insert(roleAssignment).values({ personId: adminPersonId, role: 'SystemAdmin', scopeNodeId });
    await db.insert(lookupType).values({ code: typeCode, labelEn: 'Auth Type', labelAr: 'نوع', isSystem: false });
  });

  afterAll(async () => {
    for (const id of moveNodeIds.reverse()) {
      await db.execute(sql`DELETE FROM fleet.hierarchy_change_event WHERE node_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.outbox_event WHERE aggregate_type = 'hierarchy-node' AND aggregate_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.hierarchy_node WHERE id = ${id}`);
    }
    if (createdHierarchyNodeId) {
      await db.execute(sql`DELETE FROM fleet.hierarchy_change_event WHERE node_id = ${createdHierarchyNodeId}`);
      await db.execute(sql`DELETE FROM fleet.outbox_event WHERE aggregate_type = 'hierarchy-node' AND aggregate_id = ${createdHierarchyNodeId}`);
      await db.execute(sql`DELETE FROM fleet.hierarchy_node WHERE id = ${createdHierarchyNodeId}`);
    }
    await db.execute(sql`DELETE FROM fleet.role_assignment WHERE person_id IN (${adminPersonId}, ${plainPersonId})`);
    await db.execute(sql`DELETE FROM fleet.lookup_value WHERE lookup_type_id IN (SELECT id FROM fleet.lookup_type WHERE code = ${typeCode})`);
    await db.execute(sql`DELETE FROM fleet.lookup_type WHERE code = ${typeCode}`);
    await db.execute(sql`DELETE FROM fleet.person WHERE id IN (${adminPersonId}, ${plainPersonId})`);
    await db.execute(sql`DELETE FROM fleet.hierarchy_node WHERE id = ${scopeNodeId}`);
    await app.close();
  });

  it('denies a protected route without authentication (401)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/hierarchy' });
    expect(res.statusCode).toBe(401);
  });

  it('authenticates via dev-login for a protected route (200)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/hierarchy',
      headers: { 'x-dev-person-id': plainPersonId },
    });
    expect(res.statusCode).toBe(200);
  });

  it('forbids an admin route for a non-admin (403)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/access-review',
      headers: { 'x-dev-person-id': plainPersonId },
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows an admin route for a System Admin (200)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/access-review',
      headers: { 'x-dev-person-id': adminPersonId },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it('serves the enriched organization workspace only to System Admin', async () => {
    const denied = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/organization',
      headers: { 'x-dev-person-id': plainPersonId },
    });
    expect(denied.statusCode).toBe(403);

    const allowed = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/organization',
      headers: { 'x-dev-person-id': adminPersonId },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toMatchObject({
      organization: { code: 'REF', revision: 1 },
      quality: { healthy: false },
    });
    const workspace = allowed.json() as {
      hierarchy: Array<{ code: string; children?: Array<{ code: string; children?: unknown[] }> }>;
    };
    const flattenCodes = (nodes: Array<{ code: string; children?: unknown[] }>): string[] =>
      nodes.flatMap((node) => [
        node.code,
        ...flattenCodes((node.children ?? []) as Array<{ code: string; children?: unknown[] }>),
      ]);
    expect(flattenCodes(workspace.hierarchy).includes(`AUTH-${suffix.toUpperCase()}`)).toBe(true);
  });

  it('creates, previews, renames, and retires a dependency-free hierarchy node', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/organization/nodes',
      headers: { 'x-dev-person-id': adminPersonId },
      payload: {
        parentId: 'a0000000-0000-4000-8000-000000000003',
        code: `AUTH-LOC-${suffix.toUpperCase()}`,
        name: `Auth Location ${suffix}`,
        nameAr: `موقع ${suffix}`,
        levelCode: 'LOCATION',
        levelLabel: 'Location',
        reason: 'HTTP integration hierarchy lifecycle',
      },
    });
    expect(create.statusCode).toBe(201);
    createdHierarchyNodeId = (create.json() as { id: string }).id;
    expect(create.json()).toMatchObject({ revision: 1, levelIndex: 3 });

    const impact = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/organization/nodes/${createdHierarchyNodeId}/impact`,
      headers: { 'x-dev-person-id': adminPersonId },
    });
    expect(impact.statusCode).toBe(200);
    expect(impact.json()).toMatchObject({ blocking: false, childNodes: 0, roles: 0 });

    const rename = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/organization/nodes/${createdHierarchyNodeId}`,
      headers: { 'x-dev-person-id': adminPersonId },
      payload: {
        expectedRevision: 1,
        name: `Renamed Location ${suffix}`,
        nameAr: `موقع محدث ${suffix}`,
        reason: 'Verify bilingual rename',
      },
    });
    expect(rename.statusCode).toBe(200);
    expect(rename.json()).toMatchObject({ revision: 2, name: `Renamed Location ${suffix}` });

    const retire = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/organization/nodes/${createdHierarchyNodeId}/retire`,
      headers: { 'x-dev-person-id': adminPersonId },
      payload: { expectedRevision: 2, reason: 'Verify guarded retirement' },
    });
    expect(retire.statusCode).toBe(201);
    expect(retire.json()).toMatchObject({ revision: 3 });

    const history = await db.execute(sql`
      SELECT action FROM fleet.hierarchy_change_event
      WHERE node_id = ${createdHierarchyNodeId}
      ORDER BY at_utc
    `);
    expect((history as unknown as Array<{ action: string }>).map((row) => row.action)).toEqual([
      'CREATED',
      'RENAMED',
      'RETIRED',
    ]);
  });

  it('moves a subtree with a target-specific impact token and rewrites descendant paths', async () => {
    const create = async (parentId: string, code: string, levelCode: string, levelLabel: string) => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/organization/nodes',
        headers: { 'x-dev-person-id': adminPersonId },
        payload: {
          parentId,
          code,
          name: code,
          nameAr: code,
          levelCode,
          levelLabel,
          reason: 'Move integration fixture',
        },
      });
      expect(response.statusCode).toBe(201);
      const id = (response.json() as { id: string }).id;
      moveNodeIds.push(id);
      return id;
    };

    const targetPool = await create(
      'a0000000-0000-4000-8000-000000000002',
      `MOVE-POOL-${suffix.toUpperCase()}`,
      'POOL',
      'Pool',
    );
    const movingLocation = await create(
      'a0000000-0000-4000-8000-000000000003',
      `MOVE-LOC-${suffix.toUpperCase()}`,
      'LOCATION',
      'Location',
    );
    const descendant = await create(
      movingLocation,
      `MOVE-ZONE-${suffix.toUpperCase()}`,
      'ZONE',
      'Zone',
    );

    const impact = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/organization/nodes/${movingLocation}/impact?targetParentId=${targetPool}`,
      headers: { 'x-dev-person-id': adminPersonId },
    });
    expect(impact.statusCode).toBe(200);
    const impactBody = impact.json() as { impactToken: string; childNodes: number };
    expect(impactBody.childNodes).toBe(1);

    const move = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/organization/nodes/${movingLocation}/move`,
      headers: { 'x-dev-person-id': adminPersonId },
      payload: {
        targetParentId: targetPool,
        expectedRevision: 1,
        impactToken: impactBody.impactToken,
        reason: 'Verify atomic subtree move',
      },
    });
    expect(move.statusCode).toBe(201);
    expect(move.json()).toMatchObject({ parentId: targetPool, revision: 2 });

    const paths = await db.execute(sql`
      SELECT id, path::text AS path FROM fleet.hierarchy_node
      WHERE id IN (${movingLocation}, ${descendant})
    `) as unknown as Array<{ id: string; path: string }>;
    const movedPath = paths.find((row) => row.id === movingLocation)?.path;
    expect(movedPath).toContain(`move_pool_${suffix}.move_loc_${suffix}`);
    expect(paths.find((row) => row.id === descendant)?.path).toBe(
      `${movedPath}.move_zone_${suffix}`,
    );

    const stale = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/organization/nodes/${movingLocation}/move`,
      headers: { 'x-dev-person-id': adminPersonId },
      payload: {
        targetParentId: 'a0000000-0000-4000-8000-000000000003',
        expectedRevision: 1,
        impactToken: impactBody.impactToken,
        reason: 'Stale move must fail',
      },
    });
    expect(stale.statusCode).toBe(409);
  });

  it('lets a System Admin create a lookup value that then reads back', async () => {
    const create = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/lookups/${typeCode}/values`,
      headers: { 'x-dev-person-id': adminPersonId },
      payload: { code: 'ALPHA', labelEn: 'Alpha', labelAr: 'ألفا' },
    });
    expect(create.statusCode).toBe(201);

    const read = await app.inject({
      method: 'GET',
      url: `/api/v1/lookups/${typeCode}`,
      headers: { 'x-dev-person-id': plainPersonId },
    });
    expect(read.statusCode).toBe(200);
    expect((read.json() as Array<{ code: string }>).map((v) => v.code)).toContain('ALPHA');
  });

  it('forbids a non-admin from creating a lookup value (403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/lookups/${typeCode}/values`,
      headers: { 'x-dev-person-id': plainPersonId },
      payload: { code: 'BETA', labelEn: 'Beta', labelAr: 'بيتا' },
    });
    expect(res.statusCode).toBe(403);
  });
});
