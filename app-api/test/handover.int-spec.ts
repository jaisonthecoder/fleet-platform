import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import type { Principal } from '../src/common/auth/principal';
import type { OpenHandover, RecordReturn } from '../src/contracts/handover.contract';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import {
  DEFAULT_ORGANIZATION_ID,
  domainDecisionComparison,
  domainDecisionSelector,
  person,
  vehicle,
  vehicleHierarchyAssignment,
} from '../src/common/database/schema';
import { AuditService } from '../src/modules/platform/services/audit.service';
import { OutboxService } from '../src/common/messaging/outbox.service';
import { BookingService } from '../src/modules/bookings/services/booking.service';
import { HandoverService } from '../src/modules/handover/services/handover.service';
import { createCoreHierarchyFixture, type CoreHierarchyFixture } from './support/core-fixtures';

/**
 * Integration proof of the handover / return loop (M6). Requires a live DB +
 * Redis. Drives a booking to Approved, then proves: employee-verified handover
 * moves the booking Active + logs the key; return reconciles fuel (advisory
 * flag), flags the odometer conflict against the telematics system of record
 * (never overwriting it), records damage + key return, and completes the
 * booking — with the audit chain intact.
 */
describe('handover loop (integration — requires DB + Redis)', () => {
  let ctx: INestApplicationContext;
  let bookings: BookingService;
  let handovers: HandoverService;
  let audit: AuditService;
  let outbox: OutboxService;
  let db: DrizzleDatabase;

  const suffix = randomUUID().slice(0, 8);
  const future = (day: number, hour: number) => `2999-02-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;

  let hierarchy: CoreHierarchyFixture;
  let poolNode = '';
  let driverId = '';
  let managerId = '';
  let vehicleId = '';
  let bookingId = '';
  let handoverId = '';
  let driverPrincipal: Principal;
  let fleetPrincipal: Principal;
  const selectorIds: string[] = [];
  const shadowDecisionKeys = ['booking-buffer', 'max-booking-duration'];

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
    bookings = ctx.get(BookingService);
    handovers = ctx.get(HandoverService);
    audit = ctx.get(AuditService);
    outbox = ctx.get(OutboxService);
    db = ctx.get<DrizzleDatabase>(DRIZZLE);

    hierarchy = await createCoreHierarchyFixture(db, { suiteCode: `handover_${suffix}` });
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
        updatedBy: `handover-${suffix}`,
      })))
      .returning({ id: domainDecisionSelector.id });
    selectorIds.push(...selectors.map(({ id }) => id));

    const [manager] = await db
      .insert(person)
      .values({ hcmEmployeeId: `ho-mgr-${suffix}`, fullName: `Manager ${suffix}`, employmentStatus: 'Active' })
      .returning({ id: person.id });
    managerId = manager.id;

    const [driver] = await db
      .insert(person)
      .values({ hcmEmployeeId: `ho-drv-${suffix}`, fullName: `Driver ${suffix}`, employmentStatus: 'Active', licenceExpiry: '2999-01-01', lineManagerPersonId: managerId, homePoolNodeId: poolNode })
      .returning({ id: person.id });
    driverId = driver.id;
    driverPrincipal = {
      organizationId: DEFAULT_ORGANIZATION_ID,
      userId: null,
      personId: driverId,
      entraObjectId: null,
      email: `handover-${suffix}@example.test`,
      roles: [{ role: 'Employee', scopeNodeId: poolNode }],
      isDevLogin: true,
    };
    fleetPrincipal = {
      ...driverPrincipal,
      personId: managerId,
      roles: [{ role: 'FleetManager', scopeNodeId: poolNode }],
    };

    const [veh] = await db
      .insert(vehicle)
      .values({
        plate: `HO-${suffix}`,
        chassisVin: `VIN-HO-${suffix}`,
        bodyTypeCode: 'SEDAN',
        useCategoryCode: 'POOL',
        seatingCapacity: 5,
        fuelTypeCode: 'PETROL',
        fuelEfficiencyKmpl: '10',
        lastConfirmedOdometer: '9999', // telematics system of record — far from the manual reading
        mulkiyaExpiry: '2999-01-01',
        insuranceExpiry: '2999-01-01',
        lifecycleStatus: 'Active',
        bookingPoolFlag: true,
      })
      .returning({ id: vehicle.id });
    vehicleId = veh.id;
    await db.insert(vehicleHierarchyAssignment).values({ vehicleId, nodeId: poolNode });

    // Drive a booking to Approved.
    const draft = await bookings.create(
      { vehicleId, driverPersonId: driverId, requestedByPersonId: driverId, pickupAtUtc: future(2, 8), returnAtUtc: future(2, 10) },
      `person:${driverId}`,
      driverPrincipal,
      `handover-int-${randomUUID()}`,
    );
    bookingId = draft.id;
    await bookings.signConsent(bookingId, { driverPersonId: driverId, consentDocumentVersion: 'booking-consent-test-v1' }, `person:${driverId}`, driverPrincipal, `handover-consent-${randomUUID()}`);
    await bookings.submit(
      bookingId,
      `person:${driverId}`,
      driverPrincipal,
      `handover-submit-${randomUUID()}`,
    );
    const submitted = await bookings.get(bookingId, driverPrincipal);
    await bookings.decide(
      bookingId,
      { actorPersonId: managerId, expectedBookingVersion: submitted.revision, expectedStepVersion: 1, decision: 'APPROVED' },
      { ...driverPrincipal, personId: managerId, roles: [{ role: 'Approver', scopeNodeId: poolNode }] },
      `handover-decision-${randomUUID()}`,
    );
  });

  afterAll(async () => {
    if (bookingId) {
      await db.execute(sql`DELETE FROM fleet.booking_command_ledger WHERE result_booking_id = ${bookingId}`);
      await db.execute(sql`DELETE FROM fleet.handover_command_ledger WHERE actor_person_id = ${managerId}`);
      await db.execute(sql`DELETE FROM fleet.damage_pin WHERE handover_id IN (SELECT id FROM fleet.handover WHERE booking_id = ${bookingId})`);
      await db.execute(sql`DELETE FROM fleet.key_log WHERE handover_id IN (SELECT id FROM fleet.handover WHERE booking_id = ${bookingId})`);
      await db.execute(sql`DELETE FROM fleet.outbox_event WHERE aggregate_id IN (SELECT id::text FROM fleet.handover WHERE booking_id = ${bookingId})`);
      await db.execute(sql`DELETE FROM fleet.handover WHERE booking_id = ${bookingId}`);
      await db.execute(sql`DELETE FROM fleet.consent_lifecycle_event WHERE booking_id = ${bookingId}`);
      await db.execute(sql`DELETE FROM fleet.consent_record WHERE booking_id = ${bookingId}`);
      await db.execute(sql`DELETE FROM fleet.booking_event WHERE booking_id = ${bookingId}`);
      await db.execute(sql`DELETE FROM fleet.outbox_event WHERE aggregate_id = ${bookingId}`);
      await db.execute(sql`DELETE FROM fleet.workflow_decision_command WHERE result_booking_id = ${bookingId} OR workflow_instance_id IN (SELECT id FROM fleet.workflow_instance WHERE subject_ref = ${`booking:${bookingId}`})`);
      await db.execute(sql`ALTER TABLE fleet.booking_approval_route_step DISABLE TRIGGER booking_route_step_immutable_trg`);
      await db.execute(sql`ALTER TABLE fleet.booking_approval_route DISABLE TRIGGER booking_route_immutable_trg`);
      await db.execute(sql`DELETE FROM fleet.booking_approval_route_step WHERE route_id IN (SELECT id FROM fleet.booking_approval_route WHERE booking_id = ${bookingId})`);
      await db.execute(sql`DELETE FROM fleet.booking_approval_route WHERE booking_id = ${bookingId}`);
      await db.execute(sql`ALTER TABLE fleet.booking_approval_route_step ENABLE TRIGGER booking_route_step_immutable_trg`);
      await db.execute(sql`ALTER TABLE fleet.booking_approval_route ENABLE TRIGGER booking_route_immutable_trg`);
      await db.execute(sql`DELETE FROM fleet.workflow_step WHERE workflow_instance_id IN (SELECT id FROM fleet.workflow_instance WHERE subject_ref = ${`booking:${bookingId}`})`);
      await db.execute(sql`DELETE FROM fleet.workflow_instance WHERE subject_ref = ${`booking:${bookingId}`}`);
      await db.execute(sql`DELETE FROM fleet.booking_policy_decision WHERE booking_id = ${bookingId}`);
      await db.execute(sql`DELETE FROM fleet.booking WHERE id = ${bookingId}`);
    }
    if (vehicleId) {
      await db.execute(sql`DELETE FROM fleet.vehicle_hierarchy_assignment WHERE vehicle_id = ${vehicleId}`);
      await db.execute(sql`DELETE FROM fleet.vehicle WHERE id = ${vehicleId}`);
    }
    if (driverId) {
      await db.execute(sql`DELETE FROM fleet.eligibility_evaluation WHERE driver_person_id = ${driverId}`);
    }
    for (const id of [driverId, managerId].filter(Boolean)) {
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

  it('records relevant booking setup comparisons in shadow mode for the fixture scope', async () => {
    const comparisons = await db
      .select({ decisionKey: domainDecisionComparison.decisionKey, mode: domainDecisionComparison.mode })
      .from(domainDecisionComparison)
      .where(and(
        eq(domainDecisionComparison.organizationId, DEFAULT_ORGANIZATION_ID),
        eq(domainDecisionComparison.consumer, 'bookings'),
        eq(domainDecisionComparison.requestedScopeNodeId, poolNode),
        inArray(domainDecisionComparison.decisionKey, shadowDecisionKeys),
      ));
    expect(comparisons).toEqual(expect.arrayContaining(shadowDecisionKeys.map((decisionKey) => ({
      decisionKey,
      mode: 'shadow',
    }))));
  });

  it('opens a handover for the approved booking → booking becomes Active + key issued', async () => {
    const awaiting = await handovers.worklist(fleetPrincipal);
    expect(awaiting).toEqual(expect.arrayContaining([
      expect.objectContaining({ bookingId, phase: 'AwaitingHandover', handoverId: null, vehicleId, driverPersonId: driverId }),
    ]));
    await expect(handovers.worklist(driverPrincipal)).rejects.toThrow();

    const originalEnqueue = outbox.enqueue.bind(outbox);
    const outboxSpy = jest.spyOn(outbox, 'enqueue')
      .mockImplementationOnce(originalEnqueue)
      .mockRejectedValueOnce(new Error('injected-booking-transition-outbox-failure'));
    await expect(handovers.open({
      bookingId,
      employeePersonId: driverId,
      startOdometer: 1000,
      startFuelEighths: 8,
      keyIssueRef: 'KEY-ROLLBACK',
      signatureRef: 'sig-rollback',
      checklist: [{ item: 'Tyres', pass: true }],
      offlineCaptured: false,
      existingDamage: [],
    }, fleetPrincipal, `handover-rollback-${suffix}`)).rejects.toThrow('injected-booking-transition-outbox-failure');
    outboxSpy.mockRestore();
    const rolledBackHandovers = await db.execute(sql`SELECT count(*)::int AS count FROM fleet.handover WHERE booking_id = ${bookingId}`) as unknown as Array<{ count: number }>;
    expect(rolledBackHandovers[0]?.count).toBe(0);
    expect((await bookings.get(bookingId, driverPrincipal)).status).toBe('Approved');

    const openInput: OpenHandover = {
      bookingId,
      employeePersonId: driverId,
      startOdometer: 1000,
      startFuelEighths: 8,
      gpsStatus: 'Online',
      keyIssueRef: 'KEY-01',
      signatureRef: 'sig-driver',
      checklist: [{ item: 'Tyres', pass: true }],
      offlineCaptured: false,
      existingDamage: [{ x: 0.2, y: 0.3, region: 'left-door', templateVersion: 1, state: 'existing' }],
    };
    const openKey = `handover-open-${suffix}`;
    const concurrentOpen = await Promise.allSettled([
      handovers.open(openInput, fleetPrincipal, openKey),
      handovers.open(openInput, fleetPrincipal, openKey),
    ]);
    expect(concurrentOpen.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(concurrentOpen.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const rejectedOpen = concurrentOpen.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(rejectedOpen?.reason).toMatchObject({ response: { reasons: ['handover-command-in-progress'] } });
    const fulfilledOpen = concurrentOpen.find((result): result is PromiseFulfilledResult<Awaited<ReturnType<HandoverService['open']>>> => result.status === 'fulfilled');
    const dto = fulfilledOpen!.value;
    handoverId = dto.id;
    expect(dto.phase).toBe('Handover');
    expect(dto.damage.some((d) => d.state === 'existing')).toBe(true);
    const openReplay = await handovers.open(openInput, fleetPrincipal, openKey);
    expect(openReplay.id).toBe(dto.id);
    await expect(handovers.open({ ...openInput, startOdometer: 1001 }, fleetPrincipal, openKey)).rejects.toMatchObject({
      response: { reasons: ['handover-idempotency-key-reused'] },
    });

    const booking = await bookings.get(bookingId, driverPrincipal);
    expect(booking.status).toBe('Active');
    const activeCustody = await handovers.worklist(fleetPrincipal);
    expect(activeCustody).toEqual(expect.arrayContaining([
      expect.objectContaining({ bookingId, phase: 'ActiveCustody', handoverId: dto.id }),
    ]));

    const keys = await handovers.keys(vehicleId, fleetPrincipal);
    expect(keys.some((k) => k.custodyState === 'Issued')).toBe(true);
  });

  it('records the return with reconciliation, odometer conflict, and completes the booking', async () => {
    const returnInput: RecordReturn = {
      endOdometer: 1300, // 300 km; expected 30 L at 10 km/L
      endFuelEighths: 2,
      returnCondition: 'clean',
      keyReturnRef: 'KEY-01',
      signatureRef: 'sig-return',
      observedFuelConsumedLitres: 50, // ~66% deviation → advisory flag
      offlineCaptured: false,
      newDamage: [{ x: 0.6, y: 0.4, region: 'front-bumper', templateVersion: 1, state: 'new' }],
    };
    const returnKey = `handover-return-${suffix}`;
    const dto = await handovers.recordReturn(handoverId, returnInput, fleetPrincipal, returnKey);

    expect(dto.phase).toBe('Returned');
    expect(dto.fuelDeviationFlagged).toBe(true);
    expect(dto.odometerConflict).toBe(true); // manual 1300 vs telematics 9999
    expect(dto.damage.length).toBe(2); // existing + new
    const returnReplay = await handovers.recordReturn(handoverId, returnInput, fleetPrincipal, returnKey);
    expect(returnReplay.id).toBe(dto.id);
    await expect(handovers.recordReturn(handoverId, { ...returnInput, endOdometer: 1301 }, fleetPrincipal, returnKey)).rejects.toMatchObject({
      response: { reasons: ['handover-idempotency-key-reused'] },
    });
    const originalOpenReplay = await handovers.open({
      bookingId,
      employeePersonId: driverId,
      startOdometer: 1000,
      startFuelEighths: 8,
      gpsStatus: 'Online',
      keyIssueRef: 'KEY-01',
      signatureRef: 'sig-driver',
      checklist: [{ item: 'Tyres', pass: true }],
      offlineCaptured: false,
      existingDamage: [{ x: 0.2, y: 0.3, region: 'left-door', templateVersion: 1, state: 'existing' }],
    }, fleetPrincipal, `handover-open-${suffix}`);
    expect(originalOpenReplay.phase).toBe('Handover');
    expect(originalOpenReplay.returnAtUtc).toBeNull();

    // Telematics remains the system of record — the vehicle odometer is not the manual value.
    const [veh] = await db.execute(sql`SELECT last_confirmed_odometer FROM fleet.vehicle WHERE id = ${vehicleId}`) as unknown as Array<{ last_confirmed_odometer: string }>;
    expect(Number(veh.last_confirmed_odometer)).toBe(9999);

    const booking = await bookings.get(bookingId, driverPrincipal);
    expect(booking.status).toBe('Completed');

    const keys = await handovers.keys(vehicleId, fleetPrincipal);
    expect(keys.some((k) => k.custodyState === 'Returned')).toBe(true);

    expect(await audit.verifyChain()).toBe(true);
  });
});
