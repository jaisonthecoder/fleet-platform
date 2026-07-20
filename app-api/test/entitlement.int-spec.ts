import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import { hierarchyNode, person, vehicle } from '../src/common/database/schema';
import { AuditService } from '../src/modules/platform/services/audit.service';
import { EntitlementService } from '../src/modules/entitlements/services/entitlement.service';

/**
 * Integration proof of dedicated-vehicle entitlements (M5). Requires DB + Redis.
 * Proves the loop create → submit (PDP eligibility + chain) → approve (SoD-02)
 * → consent → allocate, that allocation is refused without consent, and that
 * the audit chain stays intact.
 */
describe('entitlement loop (integration — requires DB + Redis)', () => {
  let ctx: INestApplicationContext;
  let entitlements: EntitlementService;
  let audit: AuditService;
  let db: DrizzleDatabase;

  const suffix = randomUUID().slice(0, 8);
  let poolNode = '';
  let requesterId = '';
  let managerId = '';
  let vehicleId = '';
  let entitlementId = '';

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
    entitlements = ctx.get(EntitlementService);
    audit = ctx.get(AuditService);
    db = ctx.get<DrizzleDatabase>(DRIZZLE);

    const [node] = await db
      .insert(hierarchyNode)
      .values({ parentId: 'a0000000-0000-4000-8000-000000000003', code: `EN-${suffix.toUpperCase()}`, levelIndex: 3, levelLabel: 'Location', levelCode: 'LOCATION', name: `En Location ${suffix}`, nameAr: `En Location ${suffix}`, path: sql`${`group.ports.khalifa.en_${suffix}`}::ltree` })
      .returning({ id: hierarchyNode.id });
    poolNode = node.id;

    const [manager] = await db
      .insert(person)
      .values({ hcmEmployeeId: `en-mgr-${suffix}`, fullName: `Manager ${suffix}`, employmentStatus: 'Active' })
      .returning({ id: person.id });
    managerId = manager.id;

    const [requester] = await db
      .insert(person)
      .values({ hcmEmployeeId: `en-req-${suffix}`, fullName: `Requester ${suffix}`, employmentStatus: 'Active', grade: 'Director', lineManagerPersonId: managerId })
      .returning({ id: person.id });
    requesterId = requester.id;

    const [veh] = await db
      .insert(vehicle)
      .values({ plate: `EN-${suffix}`, chassisVin: `VIN-EN-${suffix}`, bodyTypeCode: 'SEDAN', useCategoryCode: 'DEDICATED', assignmentModel: 'Dedicated', lifecycleStatus: 'Active', bookingPoolFlag: false })
      .returning({ id: vehicle.id });
    vehicleId = veh.id;
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM fleet.bsd_return_window WHERE entitlement_request_id = ${entitlementId}`);
    await db.execute(sql`DELETE FROM fleet.outbox_event WHERE aggregate_id = ${entitlementId}`);
    await db.execute(sql`DELETE FROM fleet.workflow_step WHERE workflow_instance_id IN (SELECT id FROM fleet.workflow_instance WHERE subject_ref = ${`entitlement:${entitlementId}`})`);
    await db.execute(sql`DELETE FROM fleet.workflow_instance WHERE subject_ref = ${`entitlement:${entitlementId}`}`);
    await db.execute(sql`DELETE FROM fleet.entitlement_request WHERE id = ${entitlementId}`);
    await db.execute(sql`DELETE FROM fleet.vehicle WHERE id = ${vehicleId}`);
    await db.execute(sql`DELETE FROM fleet.person WHERE id IN (${requesterId}, ${managerId})`);
    await db.execute(sql`DELETE FROM fleet.hierarchy_node WHERE id = ${poolNode}`);
    await ctx?.close();
  });

  it('runs create → submit → approve → consent → allocate', async () => {
    const created = await entitlements.create({
      requestType: 'LongTerm',
      requesterPersonId: requesterId,
      justificationCategory: 'executive-assignment',
      justificationText: 'Cluster director dedicated vehicle',
      durationStart: '2026-08-01',
      durationEnd: '2026-12-31',
      locationNodeId: poolNode,
    });
    entitlementId = created.id;
    expect(created.status).toBe('Draft');

    const submitted = await entitlements.submit(entitlementId);
    expect(submitted.status).toBe('PendingApproval');
    expect(submitted.workflowInstanceId).not.toBeNull();

    // Approve every step of the resolved chain (its length depends on which
    // approver roles resolve in the shared DB, so drive it generically).
    const steps = (await db.execute(sql`
      SELECT s.assignee_person_id AS assignee
      FROM fleet.workflow_step s
      JOIN fleet.workflow_instance i ON i.id = s.workflow_instance_id
      WHERE i.subject_ref = ${`entitlement:${entitlementId}`}
      ORDER BY s.sequence
    `)) as unknown as Array<{ assignee: string }>;
    for (const step of steps) {
      if ((await entitlements.get(entitlementId)).status !== 'PendingApproval') {
        break;
      }
      await entitlements.decide(entitlementId, { actorPersonId: step.assignee }, 'APPROVED');
    }
    const approved = await entitlements.get(entitlementId);
    expect(approved.status).toBe('Approved');

    // Allocation is refused before consent.
    await expect(entitlements.allocate(entitlementId, { vehicleId })).rejects.toBeDefined();

    await entitlements.consent(entitlementId, { driverPersonId: requesterId, consentDocumentVersion: 'consent-v0' });
    const allocated = await entitlements.allocate(entitlementId, { vehicleId });
    expect(allocated.status).toBe('Allocated');
    expect(allocated.vehicleId).toBe(vehicleId);

    const bsd = await entitlements.addBsdWindow(entitlementId, { vehicleId, windowStart: '2026-09-01T00:00:00.000Z', windowEnd: '2026-09-15T00:00:00.000Z', reason: 'annual leave' });
    expect(bsd.status).toBe('Proposed');

    expect(await audit.verifyChain()).toBe(true);
  });

  it('enforces SoD-02: the requester cannot approve their own entitlement', async () => {
    const created = await entitlements.create({
      requestType: 'Temporary',
      requesterPersonId: requesterId,
      justificationCategory: 'project-support',
      justificationText: 'temp',
      durationStart: '2026-08-01',
      durationEnd: '2026-08-31',
    });
    await entitlements.submit(created.id);
    await expect(entitlements.decide(created.id, { actorPersonId: requesterId }, 'APPROVED')).rejects.toBeInstanceOf(ForbiddenException);
    // cleanup this second request
    await db.execute(sql`DELETE FROM fleet.outbox_event WHERE aggregate_id = ${created.id}`);
    await db.execute(sql`DELETE FROM fleet.workflow_step WHERE workflow_instance_id IN (SELECT id FROM fleet.workflow_instance WHERE subject_ref = ${`entitlement:${created.id}`})`);
    await db.execute(sql`DELETE FROM fleet.workflow_instance WHERE subject_ref = ${`entitlement:${created.id}`}`);
    await db.execute(sql`DELETE FROM fleet.entitlement_request WHERE id = ${created.id}`);
  });
});
