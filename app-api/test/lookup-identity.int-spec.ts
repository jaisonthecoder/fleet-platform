import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import {
  hierarchyNode,
  lookupType,
  lookupValue,
  person,
  roleAssignment,
} from '../src/common/database/schema';
import { LookupService } from '../src/modules/config/services/lookup.service';
import { UserAdminService } from '../src/modules/identity/services/user-admin.service';
import { UserProvisioningService } from '../src/modules/identity/services/user-provisioning.service';

/**
 * Integration proof of Sub-Phase 1A₂ (lookup engine + user/access management).
 * Requires a live DB + Redis. Proves bilingual code-keyed lookups (flat, tree,
 * cascading) with cache invalidation on admin change; SoD enforced at role
 * assignment (LU-2); and JIT SSO provisioning idempotency.
 */
describe('lookup + identity (integration — requires DB + Redis)', () => {
  let ctx: INestApplicationContext;
  let lookups: LookupService;
  let userAdmin: UserAdminService;
  let provisioning: UserProvisioningService;
  let db: DrizzleDatabase;

  const suffix = randomUUID().slice(0, 8);
  const typeCode = `it-make-${suffix}`;
  const hcmId = `it-emp-${suffix}`;
  const entraId = `it-entra-${suffix}`;
  const personEmail = `it-${suffix}@example.ae`;
  let typeId = '';
  let personId = '';
  let scopeNodeId = '';

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
    lookups = ctx.get(LookupService);
    userAdmin = ctx.get(UserAdminService);
    provisioning = ctx.get(UserProvisioningService);
    db = ctx.get<DrizzleDatabase>(DRIZZLE);

    // Seed a hierarchical lookup type (Make → Model) with values.
    const [type] = await db
      .insert(lookupType)
      .values({ code: typeCode, labelEn: 'Make', labelAr: 'الصانع', isHierarchical: true, isSystem: false })
      .returning({ id: lookupType.id });
    typeId = type.id;
    const [toyota] = await db
      .insert(lookupValue)
      .values({ lookupTypeId: typeId, code: 'TOYOTA', labelEn: 'Toyota', labelAr: 'تويوتا', sortOrder: 0 })
      .returning({ id: lookupValue.id });
    await db.insert(lookupValue).values([
      { lookupTypeId: typeId, code: 'LANDCRUISER', labelEn: 'Land Cruiser', labelAr: 'لاند كروزر', parentId: toyota.id, sortOrder: 0 },
      { lookupTypeId: typeId, code: 'HILUX', labelEn: 'Hilux', labelAr: 'هايلوكس', parentId: toyota.id, sortOrder: 1 },
    ]);

    // Seed a person + a scope node for role-assignment SoD.
    const [node] = await db
      .insert(hierarchyNode)
      .values({ parentId: 'a0000000-0000-4000-8000-000000000003', code: `IT-${suffix.toUpperCase()}`, levelIndex: 3, levelLabel: 'Location', levelCode: 'LOCATION', name: `IT Location ${suffix}`, nameAr: `موقع ${suffix}`, path: sql`${`group.ports.khalifa.it_${suffix}`}::ltree` })
      .returning({ id: hierarchyNode.id });
    scopeNodeId = node.id;
    const [p] = await db
      .insert(person)
      .values({ hcmEmployeeId: hcmId, fullName: `IT Person ${suffix}`, email: personEmail, employmentStatus: 'Active' })
      .returning({ id: person.id });
    personId = p.id;
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM fleet.role_assignment WHERE person_id = ${personId}`);
    await db.execute(sql`DELETE FROM fleet.user_account WHERE entra_object_id = ${entraId}`);
    await db.execute(sql`DELETE FROM fleet.lookup_value WHERE lookup_type_id = ${typeId}`);
    await db.execute(sql`DELETE FROM fleet.lookup_type WHERE id = ${typeId}`);
    await db.execute(sql`DELETE FROM fleet.person WHERE id = ${personId}`);
    await db.execute(sql`DELETE FROM fleet.hierarchy_node WHERE id = ${scopeNodeId}`);
    await ctx?.close();
  });

  it('serves bilingual values, a cascading tree, and children by parent code', async () => {
    const flat = await lookups.getValues(typeCode);
    expect(flat.map((v) => v.code).sort()).toEqual(['HILUX', 'LANDCRUISER', 'TOYOTA']);
    expect(flat.find((v) => v.code === 'TOYOTA')?.labelAr).toBe('تويوتا');

    const tree = await lookups.getValues(typeCode, true);
    const toyota = tree.find((v) => v.code === 'TOYOTA')!;
    expect(toyota.children?.map((c) => c.code).sort()).toEqual(['HILUX', 'LANDCRUISER']);

    const children = await lookups.getChildren(typeCode, 'TOYOTA');
    expect(children.map((c) => c.code).sort()).toEqual(['HILUX', 'LANDCRUISER']);
  });

  it('admin create invalidates the cache and is visible on the next read', async () => {
    await lookups.getValues(typeCode); // warm cache
    await lookups.createValue(typeCode, { code: 'NISSAN', labelEn: 'Nissan', labelAr: 'نيسان', sortOrder: 5 });
    const after = await lookups.getValues(typeCode);
    expect(after.map((v) => v.code)).toContain('NISSAN');
  });

  it('enforces SoD at role assignment (Finance + FleetManager rejected)', async () => {
    await userAdmin.assignRole({ organizationId: '00000000-0000-4000-8000-000000000001', personId, role: 'Finance', scopeNodeId });
    let caught: unknown;
    try {
      await userAdmin.assignRole({ organizationId: '00000000-0000-4000-8000-000000000001', personId, role: 'FleetManager', scopeNodeId });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ForbiddenException);

    const active = await db
      .select({ r: roleAssignment.role })
      .from(roleAssignment)
      .where(and(eq(roleAssignment.personId, personId), isNull(roleAssignment.validTo)));
    expect(active.map((a) => a.r).sort()).toEqual(['Finance']);
  });

  it('provisions a user JIT (matching the person by email) and is idempotent on re-login', async () => {
    const first = await provisioning.provisionOnLogin({ entraObjectId: entraId, email: personEmail, displayName: 'IT' });
    expect(first.personId).toBe(personId);
    const second = await provisioning.provisionOnLogin({ entraObjectId: entraId });
    expect(second.id).toBe(first.id);
    const rows = await db.execute(
      sql`SELECT count(*)::int AS c FROM fleet.user_account WHERE entra_object_id = ${entraId}`,
    );
    expect((rows as unknown as Array<{ c: number }>)[0].c).toBe(1);
  });

  it('admin type catalogue reports active/total value counts', async () => {
    const types = await lookups.listTypesForAdmin();
    const mine = types.find((t) => t.code === typeCode);
    expect(mine).toBeDefined();
    expect(mine?.isSystem).toBe(false);
    expect(mine?.totalCount).toBeGreaterThanOrEqual(3);
    expect(mine?.activeCount).toBeGreaterThanOrEqual(3);
  });

  it('admin values are paged + enriched (parent code/label, status, hasChildren)', async () => {
    const page = await lookups.listValuesForAdmin(typeCode, { page: 1, pageSize: 50 });
    expect(page.total).toBeGreaterThanOrEqual(3);
    const toyota = page.items.find((v) => v.code === 'TOYOTA');
    expect(toyota?.hasChildren).toBe(true);
    expect(toyota?.status).toBe('Active');
    const hilux = page.items.find((v) => v.code === 'HILUX');
    expect(hilux?.parentCode).toBe('TOYOTA');
    expect(hilux?.parentLabelEn).toBe('Toyota');
  });

  it('admin children view returns enriched children including parent code', async () => {
    const children = await lookups.listChildrenForAdmin(typeCode, 'TOYOTA');
    expect(children.map((c) => c.code).sort()).toEqual(['HILUX', 'LANDCRUISER']);
    expect(children.every((c) => c.parentCode === 'TOYOTA')).toBe(true);
  });

  it('reorders a value up among its siblings', async () => {
    const before = await lookups.listChildrenForAdmin(typeCode, 'TOYOTA');
    const moved = before[1];
    await lookups.reorderValue(moved.id, 'up');
    const after = await lookups.listChildrenForAdmin(typeCode, 'TOYOTA');
    expect(after[0].id).toBe(moved.id);
  });

  it('creates and updates a non-system lookup type', async () => {
    const code = `it-type-${suffix}`;
    const created = await lookups.createType({ code, labelEn: 'IT Type', labelAr: 'نوع', isHierarchical: false });
    expect(created.code).toBe(code);
    const updated = await lookups.updateType(created.id, { labelEn: 'IT Type v2', isHierarchical: true });
    expect(updated.labelEn).toBe('IT Type v2');
    expect(updated.isHierarchical).toBe(true);
    await db.execute(sql`DELETE FROM fleet.lookup_type WHERE id = ${created.id}`);
  });

  it('lists the workforce directory paged with roles, cluster and last-login', async () => {
    await provisioning.provisionOnLogin({ entraObjectId: entraId, email: personEmail, displayName: 'IT' });
    const page = await userAdmin.listUsers({ search: suffix, page: 1, pageSize: 25 });
    const mine = page.items.find((u) => u.personId === personId);
    expect(mine).toBeDefined();
    expect(mine?.roles).toContain('Finance');
    expect(mine?.cluster).toBe(`IT Location ${suffix}`);
    expect(typeof mine?.lastLoginAt).toBe('string');
  });

  it('summary returns the four role-family tiles as numbers', async () => {
    const summary = await userAdmin.summary();
    for (const key of ['employees', 'fleetManagers', 'executives', 'administrators'] as const) {
      expect(typeof summary[key]).toBe('number');
    }
  });

  it("lists a person's active roles with assignment id + scope name", async () => {
    const roles = await userAdmin.listPersonRoles(personId);
    const finance = roles.find((r) => r.role === 'Finance');
    expect(finance?.assignmentId).toBeTruthy();
    expect(finance?.scopeName).toBe(`IT Location ${suffix}`);
  });
});
