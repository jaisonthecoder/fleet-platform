import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import type { Principal } from '../src/common/auth/principal';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import {
  DEFAULT_ORGANIZATION_ID,
  delegation,
  domainDecisionComparison,
  domainDecisionSelector,
  person,
  roleAssignment,
  vehicle,
  vehicleHierarchyAssignment,
} from '../src/common/database/schema';
import { AuditService } from '../src/modules/platform/services/audit.service';
import { OutboxService } from '../src/common/messaging/outbox.service';
import { BookingService } from '../src/modules/bookings/services/booking.service';
import { DomainDecisionSelectorService } from '../src/modules/policy/services/domain-decision.service';
import { createCoreHierarchyFixture, type CoreHierarchyFixture } from './support/core-fixtures';

/**
 * Integration proof of the booking core loop (M4). Requires a live DB + Redis.
 * Proves the three correctness guarantees:
 *   1. consent atomicity — the booking number is issued only with a committed
 *      consent record (P1B-R2-3);
 *   2. no double-booking — a concurrent overlap is a 409 via the `btree_gist`
 *      exclusion (P1B-R2-1);
 *   3. zero bookings on expired documents — an expired Mulkiya hard-blocks with
 *      no override path (P1B-R2-9).
 * Also proves the end-to-end book → consent → submit → approve loop and audit.
 */
describe('booking core loop (integration — requires DB + Redis)', () => {
  let ctx: INestApplicationContext;
  let bookings: BookingService;
  let audit: AuditService;
  let outbox: OutboxService;
  let db: DrizzleDatabase;
  let selector: DomainDecisionSelectorService;

  const suffix = randomUUID().slice(0, 8);
  const future = (day: number, hour: number) => `2999-01-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;

  let hierarchy: CoreHierarchyFixture;
  let poolNode = '';
  let driverId = '';
  let managerId = '';
  let delegateId = '';
  let okVehicleId = '';
  let inUseVehicleId = '';
  let expiredVehicleId = '';
  let driverPrincipal: Principal;
  const bookingIds: string[] = [];
  const selectorIds: string[] = [];
  const delegationIds: string[] = [];
  const draftShadowDecisionKeys = ['booking-buffer', 'max-booking-duration'];
  const shadowDecisionKeys = [...draftShadowDecisionKeys, 'booking-approval-chain'];

  const approverPrincipal = (personId: string, role: Principal['roles'][number]['role'] = 'Approver'): Principal => ({
    organizationId: DEFAULT_ORGANIZATION_ID,
    userId: null,
    personId,
    entraObjectId: null,
    email: `${personId}@example.test`,
    roles: [{ role, scopeNodeId: poolNode }],
    isDevLogin: true,
  });

  beforeAll(async () => {
    process.env.BOOKING_TEST_CONSENT_VERSION = 'booking-consent-test-v1';
    process.env.BOOKING_TEST_CONSENT_EFFECTIVE_AT_UTC = '2026-07-26T00:00:00.000Z';
    process.env.BOOKING_TEST_CONSENT_EN = 'TEST ONLY booking consent';
    process.env.BOOKING_TEST_CONSENT_AR = 'موافقة حجز تجريبية فقط';
    process.env.BOOKING_LOCAL_DUMMY_CONSENT_ENABLED = 'true';
    process.env.BOOKING_LOCAL_DUMMY_CONSENT_VERSION = 'booking-consent-test-v1';
    process.env.BOOKING_LOCAL_DUMMY_CONSENT_EFFECTIVE_AT_UTC = '2026-07-26T00:00:00.000Z';
    process.env.BOOKING_LOCAL_DUMMY_CONSENT_EN = 'TEST ONLY booking consent';
    process.env.BOOKING_LOCAL_DUMMY_CONSENT_AR = 'موافقة حجز تجريبية فقط';
    ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
    bookings = ctx.get(BookingService);
    audit = ctx.get(AuditService);
    outbox = ctx.get(OutboxService);
    db = ctx.get<DrizzleDatabase>(DRIZZLE);
    selector = ctx.get(DomainDecisionSelectorService);

    hierarchy = await createCoreHierarchyFixture(db, { suiteCode: `booking_${suffix}` });
    [poolNode] = hierarchy.locationIds;
    const selectors = await db
      .insert(domainDecisionSelector)
      .values(shadowDecisionKeys.map((decisionKey) => ({
        organizationId: DEFAULT_ORGANIZATION_ID,
        decisionKey,
        scopeNodeId: poolNode,
        environment: 'default',
        mode: 'shadow',
        comparisonSamplePercentage: 100,
        updatedBy: `booking-${suffix}`,
      })))
      .returning({ id: domainDecisionSelector.id });
    selectorIds.push(...selectors.map(({ id }) => id));

    const [manager] = await db
      .insert(person)
      .values({ hcmEmployeeId: `bk-mgr-${suffix}`, fullName: `Manager ${suffix}`, employmentStatus: 'Active' })
      .returning({ id: person.id });
    managerId = manager.id;

    const [delegate] = await db
      .insert(person)
      .values({ hcmEmployeeId: `bk-del-${suffix}`, fullName: `Delegate ${suffix}`, employmentStatus: 'Active' })
      .returning({ id: person.id });
    delegateId = delegate.id;

    const [driver] = await db
      .insert(person)
      .values({
        hcmEmployeeId: `bk-drv-${suffix}`,
        fullName: `Driver ${suffix}`,
        employmentStatus: 'Active',
        licenceExpiry: '2999-01-01',
        lineManagerPersonId: managerId,
        homePoolNodeId: poolNode,
      })
      .returning({ id: person.id });
    driverId = driver.id;
    driverPrincipal = {
      organizationId: DEFAULT_ORGANIZATION_ID,
      userId: null,
      personId: driverId,
      entraObjectId: null,
      email: `booking-${suffix}@example.test`,
      roles: [{ role: 'Employee', scopeNodeId: poolNode }],
      isDevLogin: true,
    };

    const [okVehicle] = await db
      .insert(vehicle)
      .values({
        plate: `BK-${suffix}`,
        chassisVin: `VIN-BK-${suffix}`,
        bodyTypeCode: 'SEDAN',
        useCategoryCode: 'POOL',
        seatingCapacity: 5,
        fuelTypeCode: 'PETROL',
        mulkiyaExpiry: '2999-01-01',
        insuranceExpiry: '2999-01-01',
        lifecycleStatus: 'Active',
        bookingPoolFlag: true,
      })
      .returning({ id: vehicle.id });
    okVehicleId = okVehicle.id;

    const [inUseVehicle] = await db
      .insert(vehicle)
      .values({
        plate: `BK-INUSE-${suffix}`,
        chassisVin: `VIN-BK-INUSE-${suffix}`,
        bodyTypeCode: 'SEDAN',
        useCategoryCode: 'POOL',
        seatingCapacity: 5,
        fuelTypeCode: 'PETROL',
        mulkiyaExpiry: '2999-01-01',
        insuranceExpiry: '2999-01-01',
        lifecycleStatus: 'InUse',
        bookingPoolFlag: true,
      })
      .returning({ id: vehicle.id });
    inUseVehicleId = inUseVehicle.id;

    const [expiredVehicle] = await db
      .insert(vehicle)
      .values({
        plate: `BK-EXP-${suffix}`,
        chassisVin: `VIN-BK-EXP-${suffix}`,
        bodyTypeCode: 'SEDAN',
        useCategoryCode: 'POOL',
        seatingCapacity: 5,
        fuelTypeCode: 'PETROL',
        mulkiyaExpiry: '2020-01-01', // expired → hard block
        insuranceExpiry: '2999-01-01',
        lifecycleStatus: 'Active',
        bookingPoolFlag: true,
      })
      .returning({ id: vehicle.id });
    expiredVehicleId = expiredVehicle.id;
    await db.insert(vehicleHierarchyAssignment).values([
      { vehicleId: okVehicleId, nodeId: poolNode },
      { vehicleId: inUseVehicleId, nodeId: poolNode },
      { vehicleId: expiredVehicleId, nodeId: poolNode },
    ]);
  });

  afterAll(async () => {
    for (const id of bookingIds) {
      await db.execute(sql`DELETE FROM fleet.booking_command_ledger WHERE result_booking_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.consent_lifecycle_event WHERE booking_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.consent_record WHERE booking_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.booking_event WHERE booking_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.outbox_event WHERE aggregate_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.workflow_decision_command WHERE result_booking_id = ${id} OR workflow_instance_id IN (SELECT id FROM fleet.workflow_instance WHERE subject_ref = ${`booking:${id}`})`);
      await db.execute(sql`ALTER TABLE fleet.booking_approval_route_step DISABLE TRIGGER booking_route_step_immutable_trg`);
      await db.execute(sql`ALTER TABLE fleet.booking_approval_route DISABLE TRIGGER booking_route_immutable_trg`);
      await db.execute(sql`DELETE FROM fleet.booking_approval_route_step WHERE route_id IN (SELECT id FROM fleet.booking_approval_route WHERE booking_id = ${id})`);
      await db.execute(sql`DELETE FROM fleet.booking_approval_route WHERE booking_id = ${id}`);
      await db.execute(sql`ALTER TABLE fleet.booking_approval_route_step ENABLE TRIGGER booking_route_step_immutable_trg`);
      await db.execute(sql`ALTER TABLE fleet.booking_approval_route ENABLE TRIGGER booking_route_immutable_trg`);
      await db.execute(sql`DELETE FROM fleet.workflow_step WHERE workflow_instance_id IN (SELECT id FROM fleet.workflow_instance WHERE subject_ref = ${`booking:${id}`})`);
      await db.execute(sql`DELETE FROM fleet.workflow_instance WHERE subject_ref = ${`booking:${id}`}`);
      await db.execute(sql`DELETE FROM fleet.booking_policy_decision WHERE booking_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.booking WHERE id = ${id}`);
    }
    if (driverId) {
      await db.execute(sql`DELETE FROM fleet.eligibility_evaluation WHERE driver_person_id = ${driverId}`);
    }
    if (delegationIds.length) {
      await db.delete(delegation).where(inArray(delegation.id, delegationIds));
    }
    for (const id of [okVehicleId, inUseVehicleId, expiredVehicleId].filter(Boolean)) {
      await db.execute(sql`DELETE FROM fleet.vehicle_hierarchy_assignment WHERE vehicle_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.vehicle WHERE id = ${id}`);
    }
    for (const id of [driverId, delegateId, managerId].filter(Boolean)) {
      await db.execute(sql`DELETE FROM fleet.person WHERE id = ${id}`);
    }
    const ownedScopeNodeIds = hierarchy
      ? [hierarchy.clusterId, hierarchy.poolId, ...hierarchy.locationIds]
      : [];
    if (ownedScopeNodeIds.length) {
      await db.delete(domainDecisionComparison).where(and(
        eq(domainDecisionComparison.organizationId, DEFAULT_ORGANIZATION_ID),
        or(
          inArray(domainDecisionComparison.requestedScopeNodeId, ownedScopeNodeIds),
          inArray(domainDecisionComparison.resolvedScopeNodeId, ownedScopeNodeIds),
        ),
      ));
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(domainDecisionComparison)
        .where(and(
          eq(domainDecisionComparison.organizationId, DEFAULT_ORGANIZATION_ID),
          or(
            inArray(domainDecisionComparison.requestedScopeNodeId, ownedScopeNodeIds),
            inArray(domainDecisionComparison.resolvedScopeNodeId, ownedScopeNodeIds),
          ),
        ));
      expect(count).toBe(0);
    }
    if (selectorIds.length) {
      await db.delete(domainDecisionSelector).where(inArray(domainDecisionSelector.id, selectorIds));
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(domainDecisionSelector)
        .where(inArray(domainDecisionSelector.id, selectorIds));
      expect(count).toBe(0);
    }
    await hierarchy?.cleanupHierarchy();
    await ctx?.close();
  });

  async function draft(vehicleId: string, pickup: string, ret: string): Promise<string> {
    const dto = await bookings.create(
      {
        vehicleId,
        driverPersonId: driverId,
        requestedByPersonId: driverId,
        pickupAtUtc: pickup,
        returnAtUtc: ret,
      },
      `person:${driverId}`,
      driverPrincipal,
      `booking-int-${randomUUID()}`,
    );
    bookingIds.push(dto.id);
    return dto.id;
  }

  it('returns a scoped privacy-safe timeline with own and unavailable states', async () => {
    const id = await draft(okVehicleId, future(21, 8), future(21, 10));
    await bookings.signConsent(
      id,
      { driverPersonId: driverId, consentDocumentVersion: 'booking-consent-test-v1' },
      `person:${driverId}`,
      driverPrincipal,
      `booking-consent-${randomUUID()}`,
    );

    const result = await bookings.availabilityTimeline(
      { startAtUtc: future(21, 6), endAtUtc: future(21, 18) },
      driverPrincipal,
    );

    const ownVehicle = result.rows.find((row) => row.vehicleId === okVehicleId);
    expect(ownVehicle?.segments.map((segment) => segment.state)).toEqual([
      'OPEN',
      'OWN',
      'OPEN',
    ]);
    const unavailableVehicle = result.rows.find((row) => row.vehicleId === inUseVehicleId);
    expect(unavailableVehicle?.segments).toEqual([{
      startAtUtc: future(21, 6),
      endAtUtc: future(21, 18),
      state: 'UNAVAILABLE',
    }]);
    expect(JSON.stringify(result)).not.toMatch(/driver|requester|destination|purpose/i);
  });

  it('rejects a Draft when passenger capacity exceeds the selected Vehicle', async () => {
    await expect(bookings.create(
      {
        vehicleId: okVehicleId,
        driverPersonId: driverId,
        requestedByPersonId: driverId,
        pickupAtUtc: future(22, 8),
        returnAtUtc: future(22, 10),
        passengerCount: 6,
      },
      `person:${driverId}`,
      driverPrincipal,
      `booking-int-${randomUUID()}`,
    )).rejects.toMatchObject({
      status: 409,
      response: { reasons: ['booking-vehicle-capacity-insufficient'] },
    });
  });

  it('rejects a stale Vehicle that became non-bookable after search', async () => {
    const query = { pickupAtUtc: future(23, 8), returnAtUtc: future(23, 10) };
    const available = await bookings.availability(query, driverPrincipal);
    expect(available.some((row) => row.vehicleId === okVehicleId)).toBe(true);
    await db.update(vehicle).set({ bookingPoolFlag: false }).where(eq(vehicle.id, okVehicleId));
    try {
      await expect(bookings.create(
        {
          vehicleId: okVehicleId,
          driverPersonId: driverId,
          requestedByPersonId: driverId,
          ...query,
        },
        `person:${driverId}`,
        driverPrincipal,
        `booking-int-${randomUUID()}`,
      )).rejects.toMatchObject({
        status: 409,
        response: { reasons: ['booking-vehicle-not-bookable'] },
      });
    } finally {
      await db.update(vehicle).set({ bookingPoolFlag: true }).where(eq(vehicle.id, okVehicleId));
    }
  });

  it('rejects a stale consent template version without reservation side effects', async () => {
    const id = await draft(okVehicleId, future(24, 8), future(24, 10));

    await expect(bookings.signConsent(
      id,
      { driverPersonId: driverId, consentDocumentVersion: 'client-stale-v0' },
      `person:${driverId}`,
      driverPrincipal,
      `booking-consent-${randomUUID()}`,
    )).rejects.toMatchObject({
      status: 409,
      response: { reasons: ['booking-consent-version-changed'] },
    });

    const booking = await bookings.get(id, driverPrincipal);
    expect(booking).toMatchObject({
      status: 'Draft',
      bookingNumber: null,
      consentRecordId: null,
    });
    const rows = await db.execute(sql`
      SELECT count(*)::int AS count
      FROM fleet.consent_record
      WHERE booking_id = ${id}
    `) as unknown as Array<{ count: number }>;
    expect(rows[0]?.count).toBe(0);
  });

  it('rolls back consent, number, event, audit, outbox, and command when outbox fails', async () => {
    const id = await draft(okVehicleId, future(26, 8), future(26, 10));
    const key = `booking-consent-${randomUUID()}`;
    const outboxFailure = jest
      .spyOn(outbox, 'enqueue')
      .mockRejectedValueOnce(new Error('injected-consent-outbox-failure'));
    try {
      await expect(bookings.signConsent(
        id,
        { driverPersonId: driverId, consentDocumentVersion: 'booking-consent-test-v1' },
        `person:${driverId}`,
        driverPrincipal,
        key,
      )).rejects.toThrow('injected-consent-outbox-failure');
    } finally {
      outboxFailure.mockRestore();
    }

    const failed = await bookings.get(id, driverPrincipal);
    expect(failed).toMatchObject({ status: 'Draft', bookingNumber: null, consentRecordId: null });
    const sideEffects = await db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM fleet.consent_record WHERE booking_id = ${id}) AS consent_count,
        (SELECT count(*)::int FROM fleet.booking_event WHERE booking_id = ${id} AND event_type = 'Reserved') AS event_count,
        (SELECT count(*)::int FROM fleet.booking_command_ledger WHERE idempotency_key = ${key}) AS command_count,
        (SELECT count(*)::int FROM fleet.outbox_event WHERE aggregate_id = ${id} AND event_type = 'ConsentSigned') AS outbox_count
    `) as unknown as Array<{
      consent_count: number;
      event_count: number;
      command_count: number;
      outbox_count: number;
    }>;
    expect(sideEffects[0]).toMatchObject({
      consent_count: 0,
      event_count: 0,
      command_count: 0,
      outbox_count: 0,
    });

    const retried = await bookings.signConsent(
      id,
      { driverPersonId: driverId, consentDocumentVersion: 'booking-consent-test-v1' },
      `person:${driverId}`,
      driverPrincipal,
      key,
    );
    expect(retried).toMatchObject({ status: 'PendingApproval', bookingNumber: expect.any(String) });
  });

  it('runs the loop: draft → consent (number issued) → submit → approve', async () => {
    const id = await draft(okVehicleId, future(2, 8), future(2, 10));

    const drafted = await bookings.get(id, driverPrincipal);
    expect(drafted.status).toBe('Draft');
    expect(drafted.bookingNumber).toBeNull();
    const decisionRows = await db.execute(sql`
      SELECT decision_key FROM fleet.booking_policy_decision
      WHERE booking_id = ${id} ORDER BY decision_key
    `) as unknown as Array<{ decision_key: string }>;
    expect(decisionRows.map((row) => row.decision_key)).toEqual([
      'booking-buffer',
      'max-booking-duration',
    ]);
    const comparisons = await db
      .select({ decisionKey: domainDecisionComparison.decisionKey, mode: domainDecisionComparison.mode })
      .from(domainDecisionComparison)
      .where(and(
        eq(domainDecisionComparison.organizationId, DEFAULT_ORGANIZATION_ID),
        eq(domainDecisionComparison.consumer, 'bookings'),
        eq(domainDecisionComparison.requestedScopeNodeId, poolNode),
        inArray(domainDecisionComparison.decisionKey, draftShadowDecisionKeys),
      ));
    expect(comparisons).toEqual(expect.arrayContaining(draftShadowDecisionKeys.map((decisionKey) => ({
      decisionKey,
      mode: 'shadow',
    }))));

    const consentKey = `booking-consent-${randomUUID()}`;
    const reserved = await bookings.signConsent(
      id,
      { driverPersonId: driverId, consentDocumentVersion: 'booking-consent-test-v1' },
      `person:${driverId}`,
      driverPrincipal,
      consentKey,
    );
    expect(reserved.status).toBe('PendingApproval');
    expect(reserved.bookingNumber).toMatch(/^BK-\d{4}-\d{6}$/);
    expect(reserved.consentRecordId).not.toBeNull();
    const retriedConsent = await bookings.signConsent(
      id,
      { driverPersonId: driverId, consentDocumentVersion: 'booking-consent-test-v1' },
      `person:${driverId}`,
      driverPrincipal,
      consentKey,
    );
    expect(retriedConsent.id).toBe(id);
    expect(retriedConsent.consentRecordId).toBe(reserved.consentRecordId);

    // Consent is committed alongside the number.
    const consent = await db.execute(sql`SELECT id FROM fleet.consent_record WHERE booking_id = ${id}`);
    expect((consent as unknown as unknown[]).length).toBe(1);

    const submitKey = `booking-submit-${randomUUID()}`;
    const submitted = await bookings.submit(
      id,
      `person:${driverId}`,
      driverPrincipal,
      submitKey,
    );
    const retriedSubmit = await bookings.submit(
      id,
      `person:${driverId}`,
      driverPrincipal,
      submitKey,
    );
    expect(retriedSubmit.workflowInstanceId).toBe(submitted.workflowInstanceId);
    const submitRows = await db.execute(sql`
      SELECT
        (SELECT count(*)::int
           FROM fleet.workflow_instance
          WHERE subject_ref = ${`booking:${id}`}) AS workflow_count,
        (SELECT count(*)::int
           FROM fleet.booking_command_ledger
          WHERE command_type = 'SUBMIT'
            AND idempotency_key = ${submitKey}
            AND result_booking_id = ${id}) AS command_count
    `) as unknown as Array<{ workflow_count: number; command_count: number }>;
    expect(submitRows[0]).toMatchObject({ workflow_count: 1, command_count: 1 });
    const approvalComparison = await db.select({
      category: domainDecisionComparison.category,
      mode: domainDecisionComparison.mode,
    }).from(domainDecisionComparison).where(and(
      eq(domainDecisionComparison.organizationId, DEFAULT_ORGANIZATION_ID),
      eq(domainDecisionComparison.decisionKey, 'booking-approval-chain'),
      eq(domainDecisionComparison.consumer, 'bookings'),
      eq(domainDecisionComparison.requestedScopeNodeId, poolNode),
    ));
    expect(approvalComparison).toContainEqual({ category: 'MATCH', mode: 'shadow' });
    const approvalDecision = await db.execute(sql`
      SELECT count(*)::int AS count
      FROM fleet.booking_policy_decision
      WHERE booking_id = ${id} AND decision_key = 'booking-approval-chain'
    `) as unknown as Array<{ count: number }>;
    expect(approvalDecision[0]?.count).toBe(1);
    const lineage = await db.execute(sql`
      SELECT wi.definition_deployment_id, count(bars.id)::int AS route_steps
      FROM fleet.workflow_instance wi
      JOIN fleet.booking_approval_route bar ON bar.workflow_instance_id = wi.id
      JOIN fleet.booking_approval_route_step bars ON bars.route_id = bar.id
      WHERE bar.booking_id = ${id}
      GROUP BY wi.definition_deployment_id
    `) as unknown as Array<{ definition_deployment_id: string; route_steps: number }>;
    expect(lineage[0]).toMatchObject({ definition_deployment_id: expect.any(String), route_steps: 1 });
    const worklist = await bookings.approvalWorklist(approverPrincipal(managerId));
    const task = worklist.find((item) => item.bookingId === id);
    expect(task).toMatchObject({
      bookingNumber: submitted.bookingNumber,
      expectedBookingVersion: submitted.revision,
      expectedStepVersion: 1,
      delegated: false,
      evidence: { eligibility: 'VERIFIED_AT_CONSENT', consent: 'SIGNED', reservation: 'HELD', forecast: 'NOT_AVAILABLE' },
    });
    expect(JSON.stringify(task)).not.toMatch(/"(?:ip|device|signatureRef|licence(?:Number|Expiry))"/i);
    const decisionKey = `booking-decision-${randomUUID()}`;
    const decisionInput = { actorPersonId: managerId, expectedBookingVersion: submitted.revision, expectedStepVersion: 1, decision: 'APPROVED' as const };
    const approved = await bookings.decide(id, decisionInput, approverPrincipal(managerId), decisionKey);
    expect(approved.status).toBe('Approved');
    const replayed = await bookings.decide(id, decisionInput, approverPrincipal(managerId), decisionKey);
    expect(replayed).toEqual(approved);
    await expect(bookings.decide(id, { ...decisionInput, decision: 'REJECTED' }, approverPrincipal(managerId), decisionKey)).rejects.toMatchObject({
      status: 409,
      response: { reasons: ['booking-idempotency-key-reused'] },
    });
    const [decidedStep] = await db.execute(sql`
      SELECT workflow_step_id FROM fleet.workflow_decision_command
      WHERE result_booking_id = ${id} LIMIT 1
    `) as unknown as Array<{ workflow_step_id: string }>;
    await expect(db.execute(sql`
      UPDATE fleet.workflow_step SET reason = 'tampered'
      WHERE id = ${decidedStep.workflow_step_id}
    `)).rejects.toMatchObject({ cause: { code: '23514' } });
    expect((await bookings.approvalWorklist(approverPrincipal(managerId))).some((item) => item.bookingId === id)).toBe(false);

    // The tamper-evident audit chain stays intact across the loop.
    expect(await audit.verifyChain()).toBe(true);
  });

  it('rolls back new Booking routes while an in-flight workflow remains pinned', async () => {
    const selectorRow = await db.select().from(domainDecisionSelector).where(and(
      eq(domainDecisionSelector.organizationId, DEFAULT_ORGANIZATION_ID),
      eq(domainDecisionSelector.decisionKey, 'booking-approval-chain'),
      eq(domainDecisionSelector.scopeNodeId, poolNode),
      eq(domainDecisionSelector.environment, 'default'),
    )).limit(1);
    expect(selectorRow[0]).toBeDefined();
    let selectorRevision = selectorRow[0]!.revision;

    const reserveAndSubmit = async (pickupAtUtc: string, returnAtUtc: string, keyPrefix: string) => {
      const id = await draft(okVehicleId, pickupAtUtc, returnAtUtc);
      await bookings.signConsent(id, {
        driverPersonId: driverId,
        consentDocumentVersion: 'booking-consent-test-v1',
      }, `person:${driverId}`, driverPrincipal, `${keyPrefix}-consent-${randomUUID()}`);
      return bookings.submit(id, `person:${driverId}`, driverPrincipal, `${keyPrefix}-submit-${randomUUID()}`);
    };

    try {
      await selector.setMode(
        DEFAULT_ORGANIZATION_ID, 'booking-approval-chain', poolNode, 'default',
        'new-primary-with-legacy-shadow', 100, 100, 'rollback-test', selectorRevision,
      );
      selectorRevision += 1;
      const newPrimary = await reserveAndSubmit('2999-03-01T08:00:00.000Z', '2999-03-01T10:00:00.000Z', 'new-primary');
      const beforeRollback = await db.execute(sql`
        SELECT status, definition_deployment_id AS "deploymentId"
        FROM fleet.workflow_instance WHERE id = ${newPrimary.workflowInstanceId}::uuid
      `) as unknown as Array<{ status: string; deploymentId: string }>;

      await selector.setMode(
        DEFAULT_ORGANIZATION_ID, 'booking-approval-chain', poolNode, 'default',
        'legacy-only', 0, 0, 'rollback-test', selectorRevision,
      );
      selectorRevision += 1;
      const legacyAfterRollback = await reserveAndSubmit('2999-03-02T08:00:00.000Z', '2999-03-02T10:00:00.000Z', 'legacy-rollback');
      const afterRollback = await db.execute(sql`
        SELECT status, definition_deployment_id AS "deploymentId"
        FROM fleet.workflow_instance WHERE id = ${newPrimary.workflowInstanceId}::uuid
      `) as unknown as Array<{ status: string; deploymentId: string }>;
      expect(afterRollback[0]).toEqual(beforeRollback[0]);

      const sources = await db.execute(sql`
        SELECT booking_id AS "bookingId", provenance->>'source' AS source
        FROM fleet.booking_policy_decision
        WHERE booking_id IN (${newPrimary.id}::uuid, ${legacyAfterRollback.id}::uuid)
          AND decision_key = 'booking-approval-chain'
      `) as unknown as Array<{ bookingId: string; source: string }>;
      expect(sources).toEqual(expect.arrayContaining([
        { bookingId: newPrimary.id, source: 'new' },
        { bookingId: legacyAfterRollback.id, source: 'legacy' },
      ]));
    } finally {
      const current = await db.select({ revision: domainDecisionSelector.revision }).from(domainDecisionSelector).where(and(
        eq(domainDecisionSelector.organizationId, DEFAULT_ORGANIZATION_ID),
        eq(domainDecisionSelector.decisionKey, 'booking-approval-chain'),
        eq(domainDecisionSelector.scopeNodeId, poolNode),
        eq(domainDecisionSelector.environment, 'default'),
      )).limit(1);
      await selector.setMode(
        DEFAULT_ORGANIZATION_ID, 'booking-approval-chain', poolNode, 'default',
        'shadow', 0, 100, 'rollback-test', current[0]!.revision,
      );
    }
  });

  it('records matching route parity but creates no workflow when a required approver is unavailable', async () => {
    const removed = await db.delete(roleAssignment).where(and(
      eq(roleAssignment.organizationId, DEFAULT_ORGANIZATION_ID),
      eq(roleAssignment.scopeNodeId, poolNode),
      eq(roleAssignment.role, 'FleetManager'),
    )).returning();
    let id = '';
    try {
      id = await draft(okVehicleId, '2999-02-01T08:00:00.000Z', '2999-02-02T08:00:00.000Z');
      await bookings.signConsent(id, {
        driverPersonId: driverId,
        consentDocumentVersion: 'booking-consent-test-v1',
      }, `person:${driverId}`, driverPrincipal, `unavailable-consent-${randomUUID()}`);
      await expect(bookings.submit(
        id, `person:${driverId}`, driverPrincipal, `unavailable-submit-${randomUUID()}`,
      )).rejects.toMatchObject({ response: { reasons: expect.arrayContaining(['booking-no-approver-resolvable']) } });
      const comparison = await db.select({ category: domainDecisionComparison.category })
        .from(domainDecisionComparison)
        .where(and(
          eq(domainDecisionComparison.organizationId, DEFAULT_ORGANIZATION_ID),
          eq(domainDecisionComparison.decisionKey, 'booking-approval-chain'),
          eq(domainDecisionComparison.consumer, 'bookings'),
        ));
      expect(comparison).toContainEqual({ category: 'MATCH' });
      const workflows = await db.execute(sql`SELECT count(*)::int AS count FROM fleet.workflow_instance WHERE subject_ref = ${`booking:${id}`}`) as unknown as Array<{ count: number }>;
      expect(workflows[0]?.count).toBe(0);
    } finally {
      if (removed.length) await db.insert(roleAssignment).values(removed);
    }
  });

  it('rejects stale Booking and workflow-step versions before a decision', async () => {
    const id = await draft(okVehicleId, future(29, 8), future(29, 10));
    await bookings.signConsent(id, { driverPersonId: driverId, consentDocumentVersion: 'booking-consent-test-v1' }, `person:${driverId}`, driverPrincipal, `booking-consent-${randomUUID()}`);
    const submitted = await bookings.submit(id, `person:${driverId}`, driverPrincipal, `booking-submit-${randomUUID()}`);
    await expect(bookings.decide(id, {
      actorPersonId: managerId,
      expectedBookingVersion: submitted.revision - 1,
      expectedStepVersion: 1,
      decision: 'APPROVED',
    }, approverPrincipal(managerId), `booking-decision-${randomUUID()}`)).rejects.toMatchObject({
      status: 409,
      response: { reasons: ['booking-state-conflict'] },
    });
    await expect(bookings.decide(id, {
      actorPersonId: managerId,
      expectedBookingVersion: submitted.revision,
      expectedStepVersion: 99,
      decision: 'APPROVED',
    }, approverPrincipal(managerId), `booking-decision-${randomUUID()}`)).rejects.toMatchObject({
      status: 409,
      response: { reasons: ['workflow-version-conflict'] },
    });
    expect((await bookings.get(id, driverPrincipal)).status).toBe('PendingApproval');
  });

  it('serializes cancellation versus approval so exactly one command wins', async () => {
    const id = await draft(okVehicleId, future(30, 8), future(30, 10));
    await bookings.signConsent(id, { driverPersonId: driverId, consentDocumentVersion: 'booking-consent-test-v1' }, `person:${driverId}`, driverPrincipal, `booking-consent-${randomUUID()}`);
    const submitted = await bookings.submit(id, `person:${driverId}`, driverPrincipal, `booking-submit-${randomUUID()}`);
    const results = await Promise.allSettled([
      bookings.decide(id, {
        actorPersonId: managerId,
        expectedBookingVersion: submitted.revision,
        expectedStepVersion: 1,
        decision: 'APPROVED',
      }, approverPrincipal(managerId), `booking-decision-${randomUUID()}`),
      bookings.cancel(id, { expectedRevision: submitted.revision, reason: 'Requester cancelled' }, `person:${driverId}`, driverPrincipal, `booking-cancel-${randomUUID()}`),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(['Approved', 'Cancelled']).toContain((await bookings.get(id, driverPrincipal)).status);
  });

  it('allows only an active organization-bound delegate to decide for the assignee', async () => {
    const activeId = await draft(okVehicleId, future(27, 8), future(27, 10));
    await bookings.signConsent(
      activeId,
      { driverPersonId: driverId, consentDocumentVersion: 'booking-consent-test-v1' },
      `person:${driverId}`,
      driverPrincipal,
      `booking-consent-${randomUUID()}`,
    );
    const activeSubmitted = await bookings.submit(activeId, `person:${driverId}`, driverPrincipal, `booking-submit-${randomUUID()}`);
    const [activeDelegation] = await db.insert(delegation).values({
      delegatorPersonId: managerId,
      delegatePersonId: delegateId,
      requestType: 'booking-approval',
      validFrom: new Date(Date.now() - 60_000),
      validTo: new Date(Date.now() + 60_000),
      oneHopOnly: true,
    }).returning({ id: delegation.id });
    delegationIds.push(activeDelegation.id);

    const approved = await bookings.decide(activeId, {
      actorPersonId: delegateId,
      expectedBookingVersion: activeSubmitted.revision,
      expectedStepVersion: 1,
      onBehalfOfPersonId: managerId,
      decision: 'APPROVED',
    }, approverPrincipal(delegateId, 'Delegate'), `booking-decision-${randomUUID()}`);
    expect(approved.status).toBe('Approved');
    await db.delete(delegation).where(eq(delegation.id, activeDelegation.id));
    delegationIds.splice(delegationIds.indexOf(activeDelegation.id), 1);

    const expiredId = await draft(okVehicleId, future(28, 8), future(28, 10));
    await bookings.signConsent(
      expiredId,
      { driverPersonId: driverId, consentDocumentVersion: 'booking-consent-test-v1' },
      `person:${driverId}`,
      driverPrincipal,
      `booking-consent-${randomUUID()}`,
    );
    const expiredSubmitted = await bookings.submit(expiredId, `person:${driverId}`, driverPrincipal, `booking-submit-${randomUUID()}`);
    const [expiredDelegation] = await db.insert(delegation).values({
      delegatorPersonId: managerId,
      delegatePersonId: delegateId,
      requestType: 'booking-approval',
      validFrom: new Date(Date.now() - 120_000),
      validTo: new Date(Date.now() - 60_000),
      oneHopOnly: true,
    }).returning({ id: delegation.id });
    delegationIds.push(expiredDelegation.id);

    await expect(bookings.decide(expiredId, {
      actorPersonId: delegateId,
      expectedBookingVersion: expiredSubmitted.revision,
      expectedStepVersion: 1,
      onBehalfOfPersonId: managerId,
      decision: 'APPROVED',
    }, approverPrincipal(delegateId, 'Delegate'), `booking-decision-${randomUUID()}`)).rejects.toMatchObject({
      status: 403,
      response: { reasons: ['workflow-delegation-not-active'] },
    });
  });

  it('prevents a double-booking: a concurrent overlap on the same vehicle is a 409', async () => {
    const first = await draft(okVehicleId, future(10, 8), future(10, 10));
    const second = await draft(okVehicleId, future(10, 9), future(10, 11)); // overlaps first

    const reservedFirst = await bookings.signConsent(
      first,
      { driverPersonId: driverId, consentDocumentVersion: 'booking-consent-test-v1' },
      `person:${driverId}`,
      driverPrincipal,
      `booking-consent-${randomUUID()}`,
    );

    expect(reservedFirst.status).toBe('PendingApproval');

    // Consenting the overlapping second booking must be rejected by the exclusion.
    await expect(
      bookings.signConsent(
        second,
        { driverPersonId: driverId, consentDocumentVersion: 'booking-consent-test-v1' },
        `person:${driverId}`,
        driverPrincipal,
        `booking-consent-${randomUUID()}`,
      ),
    ).rejects.toMatchObject({ status: 409 });

    // The loser holds no number and stays a draft (atomic rollback).
    const loser = await bookings.get(second, driverPrincipal);
    expect(loser.status).toBe('Draft');
    expect(loser.bookingNumber).toBeNull();
  });

  it('rolls back the workflow, booking link, and command when submit audit fails', async () => {
    const id = await draft(okVehicleId, future(12, 8), future(12, 10));
    await bookings.signConsent(
      id,
      { driverPersonId: driverId, consentDocumentVersion: 'booking-consent-test-v1' },
      `person:${driverId}`,
      driverPrincipal,
      `booking-consent-${randomUUID()}`,
    );
    const submitKey = `booking-submit-${randomUUID()}`;
    const auditFailure = jest
      .spyOn(audit, 'record')
      .mockRejectedValueOnce(new Error('injected-submit-audit-failure'));

    try {
      await expect(bookings.submit(
        id,
        `person:${driverId}`,
        driverPrincipal,
        submitKey,
      )).rejects.toThrow('injected-submit-audit-failure');
    } finally {
      auditFailure.mockRestore();
    }

    const rows = await db.execute(sql`
      SELECT
        (SELECT count(*)::int
           FROM fleet.workflow_instance
          WHERE subject_ref = ${`booking:${id}`}) AS workflow_count,
        (SELECT count(*)::int
           FROM fleet.booking_command_ledger
          WHERE command_type = 'SUBMIT'
            AND idempotency_key = ${submitKey}) AS command_count,
        (SELECT workflow_instance_id
           FROM fleet.booking
          WHERE id = ${id}) AS workflow_instance_id
    `) as unknown as Array<{
      workflow_count: number;
      command_count: number;
      workflow_instance_id: string | null;
    }>;
    expect(rows[0]).toMatchObject({
      workflow_count: 0,
      command_count: 0,
      workflow_instance_id: null,
    });
  });

  it('starts a fresh workflow after modification requested, edit, and re-consent', async () => {
    const id = await draft(okVehicleId, future(13, 8), future(13, 10));
    await bookings.signConsent(
      id,
      { driverPersonId: driverId, consentDocumentVersion: 'booking-consent-test-v1' },
      `person:${driverId}`,
      driverPrincipal,
      `booking-consent-${randomUUID()}`,
    );
    const firstSubmit = await bookings.submit(
      id,
      `person:${driverId}`,
      driverPrincipal,
      `booking-submit-${randomUUID()}`,
    );
    const returned = await bookings.decide(id, {
      actorPersonId: managerId,
      expectedBookingVersion: firstSubmit.revision,
      expectedStepVersion: 1,
      decision: 'MODIFICATION_REQUESTED',
      reason: 'Clarify destination',
    }, approverPrincipal(managerId), `booking-decision-${randomUUID()}`);
    expect(returned).toMatchObject({
      status: 'Draft',
      consentRecordId: null,
      workflowInstanceId: null,
    });
    const modified = await bookings.modify(
      id,
      { expectedRevision: returned.revision, returnAtUtc: future(13, 11) },
      `person:${driverId}`,
      driverPrincipal,
      `booking-modify-${randomUUID()}`,
    );
    await bookings.signConsent(
      id,
      { driverPersonId: driverId, consentDocumentVersion: 'booking-consent-test-v1' },
      `person:${driverId}`,
      driverPrincipal,
      `booking-consent-${randomUUID()}`,
    );
    const secondSubmit = await bookings.submit(
      id,
      `person:${driverId}`,
      driverPrincipal,
      `booking-submit-${randomUUID()}`,
    );

    expect(secondSubmit.workflowInstanceId).not.toBe(firstSubmit.workflowInstanceId);
    expect(modified.returnAtUtc).toBe(future(13, 11));
    const approved = await bookings.decide(id, {
      actorPersonId: managerId,
      expectedBookingVersion: secondSubmit.revision,
      expectedStepVersion: 1,
      decision: 'APPROVED',
    }, approverPrincipal(managerId), `booking-decision-${randomUUID()}`);
    expect(approved.status).toBe('Approved');
    const workflows = await db.execute(sql`
      SELECT count(*)::int AS count
      FROM fleet.workflow_instance
      WHERE subject_ref = ${`booking:${id}`}
    `) as unknown as Array<{ count: number }>;
    expect(workflows[0]?.count).toBe(2);
  });

  it('persists create idempotency and rejects key reuse with a different payload', async () => {
    const key = `booking-int-retry-${randomUUID()}`;
    const input = {
      vehicleId: okVehicleId,
      driverPersonId: driverId,
      requestedByPersonId: driverId,
      pickupAtUtc: future(15, 8),
      returnAtUtc: future(15, 10),
    };

    const first = await bookings.create(input, `person:${driverId}`, driverPrincipal, key);
    bookingIds.push(first.id);
    const retried = await bookings.create(input, `person:${driverId}`, driverPrincipal, key);

    expect(retried.id).toBe(first.id);
    await expect(bookings.create(
      { ...input, returnAtUtc: future(15, 11) },
      `person:${driverId}`,
      driverPrincipal,
      key,
    )).rejects.toMatchObject({
      status: 409,
      response: { reasons: ['booking-idempotency-key-reused'] },
    });
    const rows = await db.execute(sql`
      SELECT count(*)::int AS count
      FROM fleet.booking_command_ledger
      WHERE idempotency_key = ${key}
    `) as unknown as Array<{ count: number }>;
    expect(rows[0]?.count).toBe(1);
  });

  it('rejects a stale optimistic revision without overwriting the current booking', async () => {
    const id = await draft(okVehicleId, future(18, 8), future(18, 10));
    const modified = await bookings.modify(
      id,
      { expectedRevision: 1, returnAtUtc: future(18, 11) },
      `person:${driverId}`,
      driverPrincipal,
      `booking-modify-${randomUUID()}`,
    );
    expect(modified.revision).toBe(2);

    await expect(bookings.modify(
      id,
      { expectedRevision: 1, returnAtUtc: future(18, 12) },
      `person:${driverId}`,
      driverPrincipal,
      `booking-modify-${randomUUID()}`,
    )).rejects.toMatchObject({
      status: 409,
      response: { reasons: ['booking-revision-conflict'] },
    });
    const current = await bookings.get(id, driverPrincipal);
    expect(current.returnAtUtc).toBe(future(18, 11));
    expect(current.revision).toBe(2);
  });

  it('issues zero bookings on expired documents (hard block, no override)', async () => {
    const id = await draft(expiredVehicleId, future(20, 8), future(20, 10));
    await expect(
      bookings.signConsent(
        id,
        { driverPersonId: driverId, consentDocumentVersion: 'booking-consent-test-v1' },
        `person:${driverId}`,
        driverPrincipal,
        `booking-consent-${randomUUID()}`,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const blocked = await bookings.get(id, driverPrincipal);
    expect(blocked.status).toBe('Draft');
    expect(blocked.bookingNumber).toBeNull();
  });

  it('availability reflects the reserved range (reserved vehicle is not offered)', async () => {
    // The vehicle reserved in the first test (day 2, 08:00–10:00) must not appear
    // as available for an overlapping window.
    const available = await bookings.availability({ pickupAtUtc: future(2, 9), returnAtUtc: future(2, 10) }, driverPrincipal);
    expect(available.some((v) => v.vehicleId === okVehicleId)).toBe(false);
  });

  it('does not offer a pooled vehicle outside the Active lifecycle', async () => {
    const available = await bookings.availability({
      pickupAtUtc: future(25, 9),
      returnAtUtc: future(25, 10),
    }, driverPrincipal);

    expect(available.some((v) => v.vehicleId === inUseVehicleId)).toBe(false);
    expect(available.some((v) => v.vehicleId === okVehicleId)).toBe(true);
  });
});
