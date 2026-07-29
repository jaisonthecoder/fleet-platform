import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import type { Principal } from '../src/common/auth/principal';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import {
  DEFAULT_ORGANIZATION_ID,
  person,
  roleAssignment,
  vehicle,
  vehicleHierarchyAssignment,
} from '../src/common/database/schema';
import { AuditService } from '../src/modules/platform/services/audit.service';
import { EntitlementService } from '../src/modules/entitlements/services/entitlement.service';
import { createCoreHierarchyFixture, type CoreHierarchyFixture } from './support/core-fixtures';

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
  let hierarchy: CoreHierarchyFixture;
  let poolNode = '';
  let requesterId = '';
  let managerId = '';
  const routeApproverIds: string[] = [];
  let vehicleId = '';
  let entitlementId = '';
  const entitlementIds: string[] = [];

  const rolePrincipal = (personId: string, role: Principal['roles'][number]['role']): Principal => ({
    organizationId: DEFAULT_ORGANIZATION_ID,
    userId: null,
    personId,
    entraObjectId: null,
    email: `${role.toLowerCase()}-${suffix}@example.test`,
    roles: [{ role, scopeNodeId: poolNode }],
    isDevLogin: true,
  });

  const requesterPrincipal = (): Principal => ({
    organizationId: DEFAULT_ORGANIZATION_ID,
    userId: null,
    personId: requesterId,
    entraObjectId: null,
    email: `entitlement-${suffix}@example.test`,
    roles: [{ role: 'Employee', scopeNodeId: poolNode }],
    isDevLogin: true,
  });

  beforeAll(async () => {
    process.env.ENTITLEMENT_TEST_CONSENT_VERSION = 'entitlement-test-consent-v1';
    process.env.ENTITLEMENT_TEST_CONSENT_EFFECTIVE_AT_UTC = '2026-07-26T00:00:00.000Z';
    process.env.ENTITLEMENT_TEST_CONSENT_EN = 'TEST ONLY dedicated vehicle consent';
    process.env.ENTITLEMENT_TEST_CONSENT_AR = 'موافقة تجريبية فقط للمركبة المخصصة';
    process.env.ENTITLEMENT_LOCAL_DUMMY_CONSENT_ENABLED = 'true';
    process.env.ENTITLEMENT_LOCAL_DUMMY_CONSENT_VERSION = 'entitlement-test-consent-v1';
    process.env.ENTITLEMENT_LOCAL_DUMMY_CONSENT_EFFECTIVE_AT_UTC = '2026-07-26T00:00:00.000Z';
    process.env.ENTITLEMENT_LOCAL_DUMMY_CONSENT_EN = 'TEST ONLY dedicated vehicle consent';
    process.env.ENTITLEMENT_LOCAL_DUMMY_CONSENT_AR = 'موافقة تجريبية فقط للمركبة المخصصة';
    ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
    entitlements = ctx.get(EntitlementService);
    audit = ctx.get(AuditService);
    db = ctx.get<DrizzleDatabase>(DRIZZLE);

    hierarchy = await createCoreHierarchyFixture(db, { suiteCode: `entitlement_${suffix}` });
    [poolNode] = hierarchy.locationIds;

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

    for (const role of ['FleetManager', 'ClusterFleetLead', 'ClusterCEO'] as const) {
      const [approver] = await db.insert(person).values({
        hcmEmployeeId: `en-${role.toLowerCase()}-${suffix}`,
        fullName: `${role} ${suffix}`,
        employmentStatus: 'Active',
      }).returning({ id: person.id });
      routeApproverIds.push(approver.id);
      await db.insert(roleAssignment).values({
        personId: approver.id,
        role,
        scopeNodeId: poolNode,
      });
    }

    const [veh] = await db
      .insert(vehicle)
      .values({
        plate: `EN-${suffix}`,
        chassisVin: `VIN-EN-${suffix}`,
        bodyTypeCode: 'SEDAN',
        useCategoryCode: 'POOL',
        assignmentModel: 'Pool',
        lifecycleStatus: 'Active',
        bookingPoolFlag: true,
        mulkiyaNumber: `REG-EN-${suffix}`,
        mulkiyaExpiry: '2999-12-31',
        insurancePolicyNumber: `POL-EN-${suffix}`,
        insuranceExpiry: '2999-12-31',
      })
      .returning({ id: vehicle.id });
    vehicleId = veh.id;
    await db.insert(vehicleHierarchyAssignment).values({
      vehicleId,
      nodeId: poolNode,
    });
  });

  afterAll(async () => {
    for (const id of [...entitlementIds].reverse()) {
      await db.execute(sql`DELETE FROM fleet.bsd_return_window WHERE entitlement_request_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.entitlement_allocation WHERE entitlement_request_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.entitlement_event WHERE entitlement_request_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.entitlement_command_ledger WHERE result_entitlement_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.outbox_event WHERE aggregate_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.workflow_step WHERE workflow_instance_id IN (SELECT id FROM fleet.workflow_instance WHERE subject_ref = ${`entitlement:${id}`})`);
      await db.execute(sql`DELETE FROM fleet.workflow_instance WHERE subject_ref = ${`entitlement:${id}`}`);
      await db.execute(sql`DELETE FROM fleet.entitlement_request WHERE id = ${id}`);
    }
    if (requesterId) {
      await db.execute(sql`DELETE FROM fleet.entitlement_eligibility_preview WHERE requester_person_id = ${requesterId}`);
    }
    if (vehicleId) {
      await db.execute(sql`DELETE FROM fleet.vehicle_hierarchy_assignment WHERE vehicle_id = ${vehicleId}`);
      await db.execute(sql`DELETE FROM fleet.vehicle WHERE id = ${vehicleId}`);
    }
    if (routeApproverIds.length) {
      await db.execute(sql`DELETE FROM fleet.role_assignment WHERE person_id IN (${sql.join(routeApproverIds.map((id) => sql`${id}::uuid`), sql`, `)})`);
    }
    for (const id of [requesterId, managerId, ...routeApproverIds].filter(Boolean)) {
      await db.execute(sql`DELETE FROM fleet.person WHERE id = ${id}`);
    }
    await hierarchy?.cleanupHierarchy();
    await ctx?.close();
    delete process.env.ENTITLEMENT_TEST_CONSENT_VERSION;
    delete process.env.ENTITLEMENT_TEST_CONSENT_EFFECTIVE_AT_UTC;
    delete process.env.ENTITLEMENT_TEST_CONSENT_EN;
    delete process.env.ENTITLEMENT_TEST_CONSENT_AR;
    delete process.env.ENTITLEMENT_LOCAL_DUMMY_CONSENT_ENABLED;
    delete process.env.ENTITLEMENT_LOCAL_DUMMY_CONSENT_VERSION;
    delete process.env.ENTITLEMENT_LOCAL_DUMMY_CONSENT_EFFECTIVE_AT_UTC;
    delete process.env.ENTITLEMENT_LOCAL_DUMMY_CONSENT_EN;
    delete process.env.ENTITLEMENT_LOCAL_DUMMY_CONSENT_AR;
  });

  it('persists the DEDICATED-00 Draft identity and preference baseline', async () => {
    const created = await entitlements.create({
      requestType: 'LongTerm',
      driverOption: 'WithoutDriver',
      requesterPersonId: requesterId,
      assignedDriverPersonId: requesterId,
      justificationCategory: 'executive-assignment',
      justificationText: 'Cluster director dedicated vehicle',
      vehicleCategoryCode: 'EXECUTIVE_SUV',
      preferenceNote: 'Toyota Fortuner if available',
      durationStart: '2026-08-01',
      durationEnd: '2026-12-31',
      locationNodeId: poolNode,
    });
    entitlementIds.push(created.id);
    entitlementId = created.id;
    expect(created.status).toBe('Draft');
    // Duration and driver axes are stored and returned independently.
    expect(created.requestType).toBe('LongTerm');
    expect(created.driverOption).toBe('WithoutDriver');
    expect(created.requestedByPersonId).toBe(requesterId);
    expect(created.assignedDriverPersonId).toBe(requesterId);
    expect(created.preferenceNote).toBe('Toyota Fortuner if available');
    expect(created.preferredVehicleId).toBeNull();
    expect(created.vehicleId).toBeNull();
    expect(created.revision).toBe(1);

    expect(await entitlements.get(entitlementId)).toMatchObject({
      status: 'Draft',
      workflowInstanceId: null,
      vehicleId: null,
    });

    expect(await audit.verifyChain()).toBe(true);
  });

  it('evaluates the active manual policy and returns a real safe Vehicle option', async () => {
    const result = await entitlements.eligibilityPreview({
      requestType: 'LongTerm',
      driverOption: 'WithoutDriver',
      justificationCategory: 'OPERATIONAL_REQUIREMENT',
      durationStart: '2026-08-01',
      durationEnd: '2026-12-31',
      locationNodeId: poolNode,
      requestedVehicleClass: 'SEDAN',
    }, requesterPrincipal());

    expect(result).toMatchObject({
      decision: 'ALLOW',
      policyVersion: 'manual-dedicated-eligibility-v1',
      permittedVehicleClasses: ['SEDAN'],
      eligibleVehicleOptions: [{
        vehicleId,
        plate: `EN-${suffix}`,
        vehicleClass: 'SEDAN',
      }],
    });
    expect(result.policyRuleId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.policyVersionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.previewId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(result)).not.toMatch(/vin|vendor|lease|insurance|mulkiya/i);

    const created = await entitlements.create({
      requestType: 'LongTerm',
      driverOption: 'WithoutDriver',
      requesterPersonId: requesterId,
      justificationCategory: 'OPERATIONAL_REQUIREMENT',
      justificationText: 'Manual policy and safe Vehicle evidence',
      vehicleCategoryCode: 'SEDAN',
      preferredVehicleId: vehicleId,
      eligibilityPreviewId: result.previewId!,
      durationStart: '2026-08-01',
      durationEnd: '2026-12-31',
      locationNodeId: poolNode,
    }, requesterId, requesterPrincipal(), `preview-create-${randomUUID()}`);
    entitlementIds.push(created.id);
    expect(created).toMatchObject({
      status: 'Draft',
      preferredVehicleId: vehicleId,
      eligibilityPreviewId: result.previewId,
      policyVersion: 'manual-dedicated-eligibility-v1',
      eligibilityResult: { decision: 'ALLOW' },
    });
    const submitted = await entitlements.submit(
      created.id,
      { expectedRevision: created.revision },
      requesterPrincipal(),
      `preview-submit-${randomUUID()}`,
    );
    expect(submitted).toMatchObject({
      status: 'PendingApproval',
      revision: created.revision + 1,
    });
    expect(submitted.workflowInstanceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(submitted.approvalRouteProvenance).toMatchObject({
      history: [],
      current: {
        definitionDeploymentId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        eligibilityPreviewId: result.previewId,
      },
    });
    const approvalProvenance = submitted.approvalRouteProvenance as { current: { approvers: string[] } };
    expect(approvalProvenance.current.approvers).toEqual([
      managerId,
      ...routeApproverIds,
    ]);

    let current = submitted;
    const approvers = [
      { id: managerId, role: 'Approver' as const },
      { id: routeApproverIds[0]!, role: 'FleetManager' as const },
      { id: routeApproverIds[1]!, role: 'ClusterFleetLead' as const },
      { id: routeApproverIds[2]!, role: 'ClusterCEO' as const },
    ];
    for (const approver of approvers) {
      current = await entitlements.decide(
        created.id,
        { actorPersonId: approver.id, expectedRevision: current.revision, expectedStepVersion: 1 },
        'APPROVED',
        rolePrincipal(approver.id, approver.role),
        `approval-${approver.role}-${randomUUID()}`,
      );
    }
    expect(current.status).toBe('Approved');

    const consented = await entitlements.consent(
      created.id,
      { expectedRevision: current.revision, consentDocumentVersion: 'entitlement-test-consent-v1', signatureRef: 'test-signature-ref' },
      requesterPrincipal(),
      `consent-${randomUUID()}`,
    );
    expect(consented).toMatchObject({ status: 'AwaitingConsent', consentSignedAtUtc: expect.any(String) });

    const allocated = await entitlements.allocate(
      created.id,
      { vehicleId, expectedRevision: consented.revision },
      rolePrincipal(routeApproverIds[0]!, 'FleetManager'),
      `allocate-${randomUUID()}`,
    );
    expect(allocated).toMatchObject({ status: 'Allocated', vehicleId, preferredVehicleId: vehicleId });
    const allocationRows = await db.execute(sql`
      SELECT preference_honoured, status
      FROM fleet.entitlement_allocation
      WHERE entitlement_request_id = ${created.id}
    `) as unknown as Array<{ preference_honoured: boolean; status: string }>;
    expect(allocationRows).toEqual([{ preference_honoured: true, status: 'Active' }]);
    const vehicleRows = await db.execute(sql`
      SELECT assignment_model, booking_pool_flag, assigned_driver_person_id
      FROM fleet.vehicle WHERE id = ${vehicleId}
    `) as unknown as Array<{ assignment_model: string; booking_pool_flag: boolean; assigned_driver_person_id: string }>;
    expect(vehicleRows[0]).toMatchObject({ assignment_model: 'Dedicated', booking_pool_flag: false, assigned_driver_person_id: requesterId });

    const bsd = await entitlements.addBsdWindow(created.id, {
      vehicleId,
      windowStart: '2026-09-01T08:00:00.000Z',
      windowEnd: '2026-09-03T08:00:00.000Z',
      reason: 'Approved absence',
    }, rolePrincipal(routeApproverIds[0]!, 'FleetManager'));
    expect(bsd.status).toBe('Proposed');
    const confirmedBsd = await entitlements.confirmBsdWindow(
      bsd.id,
      'Fleet confirmed absence window',
      rolePrincipal(routeApproverIds[0]!, 'FleetManager'),
    );
    expect(confirmedBsd.status).toBe('Confirmed');
    expect(await entitlements.runBsdCycle(new Date('2026-09-01T08:00:01.000Z'))).toBe(1);
    const bsdPoolVehicle = await db.execute(sql`
      SELECT assignment_model, booking_pool_flag FROM fleet.vehicle WHERE id = ${vehicleId}
    `) as unknown as Array<{ assignment_model: string; booking_pool_flag: boolean }>;
    expect(bsdPoolVehicle[0]).toEqual({ assignment_model: 'Pool', booking_pool_flag: true });
    expect(await entitlements.runBsdCycle(new Date('2026-09-03T08:00:01.000Z'))).toBe(1);
    const restoredDedicatedVehicle = await db.execute(sql`
      SELECT assignment_model, booking_pool_flag FROM fleet.vehicle WHERE id = ${vehicleId}
    `) as unknown as Array<{ assignment_model: string; booking_pool_flag: boolean }>;
    expect(restoredDedicatedVehicle[0]).toEqual({ assignment_model: 'Dedicated', booking_pool_flag: false });
    const bsdRows = await db.execute(sql`
      SELECT status FROM fleet.bsd_return_window WHERE id = ${bsd.id}
    `) as unknown as Array<{ status: string }>;
    expect(bsdRows).toEqual([{ status: 'Completed' }]);

    const futureBsd = await entitlements.addBsdWindow(created.id, {
      vehicleId,
      windowStart: '2026-10-01T08:00:00.000Z',
      windowEnd: '2026-10-03T08:00:00.000Z',
      reason: 'Future approved absence',
    }, rolePrincipal(routeApproverIds[0]!, 'FleetManager'));
    const cancelledBsd = await entitlements.cancelBsdWindow(
      futureBsd.id,
      'Absence withdrawn',
      rolePrincipal(routeApproverIds[0]!, 'FleetManager'),
    );
    expect(cancelledBsd.status).toBe('Cancelled');
    const persistedBsd = await entitlements.bsdWindows(created.id, requesterPrincipal());
    expect(persistedBsd.map((window) => window.status)).toEqual(
      expect.arrayContaining(['Completed', 'Cancelled']),
    );

    const returned = await entitlements.returnVehicle(
      created.id,
      { expectedRevision: allocated.revision, reason: 'Assignment period completed' },
      rolePrincipal(routeApproverIds[0]!, 'FleetManager'),
      `return-${randomUUID()}`,
    );
    expect(returned.status).toBe('Returned');
    const closedAllocation = await db.execute(sql`
      SELECT status FROM fleet.entitlement_allocation
      WHERE entitlement_request_id = ${created.id}
    `) as unknown as Array<{ status: string }>;
    expect(closedAllocation).toEqual([{ status: 'Returned' }]);
    const restoredVehicle = await db.execute(sql`
      SELECT assignment_model, booking_pool_flag, assigned_driver_person_id
      FROM fleet.vehicle WHERE id = ${vehicleId}
    `) as unknown as Array<{ assignment_model: string; booking_pool_flag: boolean; assigned_driver_person_id: string | null }>;
    expect(restoredVehicle[0]).toMatchObject({ assignment_model: 'Pool', booking_pool_flag: true, assigned_driver_person_id: null });

    const renewal = await entitlements.renew(
      created.id,
      { expectedRevision: returned.revision, durationStart: '2027-01-01', durationEnd: '2027-06-30' },
      requesterPrincipal(),
      `renew-${randomUUID()}`,
    );
    entitlementIds.push(renewal.id);
    expect(renewal).toMatchObject({
      status: 'Draft',
      renewedFromEntitlementId: created.id,
      workflowInstanceId: null,
      eligibilityPreviewId: null,
      vehicleId: null,
      consentSignedAtUtc: null,
    });
    const lifecycleEvents = await entitlements.events(created.id, requesterPrincipal());
    expect(lifecycleEvents.map((event) => event.eventType)).toEqual(expect.arrayContaining(['Returned', 'RenewalRequested']));
    const notificationEvents = await db.execute(sql`
      SELECT event_type FROM fleet.outbox_event
      WHERE aggregate_id = ${created.id}
    `) as unknown as Array<{ event_type: string }>;
    expect(notificationEvents.map((event) => event.event_type)).toEqual(expect.arrayContaining([
      'EntitlementConsentRequired',
      'ConsentSigned',
      'EntitlementAllocated',
      'EntitlementBsdActivated',
      'EntitlementBsdRestored',
      'EntitlementReturned',
    ]));
  });

  it('denies self-approval and keeps allocation disabled without side effects', async () => {
    const created = await entitlements.create({
      requestType: 'Temporary',
      requesterPersonId: requesterId,
      justificationCategory: 'project-support',
      justificationText: 'temp',
      durationStart: '2026-08-01',
      durationEnd: '2026-08-31',
      locationNodeId: poolNode,
    });
    entitlementIds.push(created.id);
    await expect(entitlements.decide(
      created.id,
      { actorPersonId: requesterId, expectedRevision: created.revision, expectedStepVersion: 1 },
      'APPROVED',
      requesterPrincipal(),
      `self-decision-${randomUUID()}`,
    )).rejects.toMatchObject({ response: { reasons: ['entitlement-not-pending-approval'] } });
    await expect(entitlements.allocate(created.id, { vehicleId, expectedRevision: created.revision }, rolePrincipal(routeApproverIds[0]!, 'FleetManager'), `allocation-not-ready-${randomUUID()}`)).rejects.toMatchObject({
      response: { reasons: ['entitlement-state-conflict'] },
    });
    expect(await entitlements.get(created.id)).toMatchObject({
      status: 'Draft',
      vehicleId: null,
      workflowInstanceId: null,
    });
    // cleanup this second request
    await db.execute(sql`DELETE FROM fleet.outbox_event WHERE aggregate_id = ${created.id}`);
    await db.execute(sql`DELETE FROM fleet.entitlement_request WHERE id = ${created.id}`);
  });

  it('reports organization-scoped reconciliation findings without mutating state', async () => {
    const [inconsistent] = await db.execute(sql`
      INSERT INTO fleet.entitlement_request (
        organization_id, request_type, driver_option, requester_person_id,
        requested_by_person_id, justification_category, justification_text,
        duration_start, duration_end, status, vehicle_id, location_node_id
      ) VALUES (
        ${DEFAULT_ORGANIZATION_ID}, 'LongTerm', 'WithoutDriver', ${requesterId},
        ${requesterId}, 'OPERATIONAL_REQUIREMENT', 'Reconciliation proof',
        '2027-01-01', '2027-06-30', 'Allocated', ${vehicleId}, ${poolNode}
      ) RETURNING id
    `) as unknown as Array<{ id: string }>;
    entitlementIds.push(inconsistent!.id);

    await expect(entitlements.reconciliation(requesterPrincipal())).rejects.toMatchObject({
      response: { reasons: ['entitlement-scope-not-authorized'] },
    });

    const report = await entitlements.reconciliation(rolePrincipal(routeApproverIds[0]!, 'SystemAdmin'));
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonCode: 'allocated-entitlement-missing-active-allocation',
        entitlementRef: `entitlement:${inconsistent!.id}`,
        vehicleRef: `vehicle:${vehicleId}`,
        relatedRef: null,
        recommendedOwner: 'FleetOperations',
      }),
    ]));
    expect(report.metrics).toEqual(expect.objectContaining({
      eligibilityAllow: expect.any(Number),
      eligibilityDeny: expect.any(Number),
      approvalOverdue: expect.any(Number),
      bsdConflict: expect.any(Number),
      completedCommands: expect.any(Number),
    }));
    expect(report.unavailableMetrics).toEqual(expect.arrayContaining(['command-conflict', 'worker-failure']));

    const rows = await db.execute(sql`
      SELECT status, vehicle_id FROM fleet.entitlement_request WHERE id = ${inconsistent!.id}
    `) as unknown as Array<{ status: string; vehicle_id: string }>;
    expect(rows).toEqual([{ status: 'Allocated', vehicle_id: vehicleId }]);
  });

  it('updates a Draft once, replays safely, and rolls back a stale command', async () => {
    const created = await entitlements.create({
      requestType: 'LongTerm',
      driverOption: 'WithoutDriver',
      requesterPersonId: requesterId,
      justificationCategory: 'operational-need',
      justificationText: 'Initial need',
      preferredVehicleId: vehicleId,
      preferenceNote: 'Toyota Fortuner if available',
      durationStart: '2026-08-01',
      durationEnd: '2026-12-31',
      locationNodeId: poolNode,
    });
    entitlementIds.push(created.id);
    const updateKey = `entitlement-update-${randomUUID()}`;
    const input = {
      expectedRevision: 1,
      justificationText: 'Updated cross-site operational need',
      preferenceNote: 'Left-hand drive preferred',
    };

    const updated = await entitlements.updateDraft(
      created.id,
      input,
      requesterPrincipal(),
      updateKey,
    );
    const replay = await entitlements.updateDraft(
      created.id,
      input,
      requesterPrincipal(),
      updateKey,
    );

    expect(updated).toMatchObject({
      revision: 2,
      preferredVehicleId: null,
      preferenceNote: 'Left-hand drive preferred',
      eligibilityResult: null,
      policyVersion: null,
    });
    expect(replay).toEqual(updated);

    const staleKey = `entitlement-stale-${randomUUID()}`;
    await expect(entitlements.updateDraft(
      created.id,
      { expectedRevision: 1, justificationText: 'Stale overwrite' },
      requesterPrincipal(),
      staleKey,
    )).rejects.toMatchObject({
      response: { reasons: ['entitlement-revision-conflict'] },
    });
    const staleCommands = await db.execute(sql`
      SELECT count(*)::int AS count
      FROM fleet.entitlement_command_ledger
      WHERE idempotency_key = ${staleKey}
    `) as unknown as Array<{ count: number }>;
    expect(staleCommands[0]?.count).toBe(0);
    expect((await entitlements.get(created.id)).justificationText).toBe(
      'Updated cross-site operational need',
    );
  });

  it('commits exactly one revision for concurrent same-key Draft updates', async () => {
    const created = await entitlements.create({
      requestType: 'Temporary',
      driverOption: 'WithoutDriver',
      requesterPersonId: requesterId,
      justificationCategory: 'project-support',
      justificationText: 'Initial temporary need',
      durationStart: '2026-09-01',
      durationEnd: '2026-10-01',
      locationNodeId: poolNode,
    });
    entitlementIds.push(created.id);
    const key = `entitlement-concurrent-${randomUUID()}`;
    const command = () => entitlements.updateDraft(
      created.id,
      { expectedRevision: 1, justificationText: 'Concurrent safe update' },
      requesterPrincipal(),
      key,
    );

    const results = await Promise.allSettled([command(), command()]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await entitlements.get(created.id)).toMatchObject({
      revision: 2,
      justificationText: 'Concurrent safe update',
    });
    const ledger = await db.execute(sql`
      SELECT count(*)::int AS count
      FROM fleet.entitlement_command_ledger
      WHERE idempotency_key = ${key}
    `) as unknown as Array<{ count: number }>;
    expect(ledger[0]?.count).toBe(1);
  });
});
