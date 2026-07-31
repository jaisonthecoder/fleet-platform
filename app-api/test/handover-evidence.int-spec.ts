import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { eq, inArray, or, sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import type { Principal } from '../src/common/auth/principal';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import {
  booking,
  bookingEvent,
  damagePin,
  DEFAULT_ORGANIZATION_ID,
  handoverAmendment,
  handover,
  handoverCommandLedger,
  handoverEvidence,
  handoverInspectionItem,
  keyLog,
  outboxEvent,
  person,
  roleAssignment,
  vehicle,
  vehicleHierarchyAssignment,
} from '../src/common/database/schema';
import { HandoverRepository } from '../src/modules/handover/repositories/handover.repository';
import { HandoverService } from '../src/modules/handover/services/handover.service';
import { BookingService } from '../src/modules/bookings/services/booking.service';
import { createCoreHierarchyFixture, type CoreHierarchyFixture } from './support/core-fixtures';

/** Extracts PostgreSQL error codes wrapped by the driver. */
function pgCode(error: unknown): string | undefined {
  return (error as { cause?: { code?: string }; code?: string }).cause?.code ??
    (error as { code?: string }).code;
}

/** Requires a database command to fail through the HAPR check-violation guard. */
async function expectImmutable(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
    throw new Error('expected immutable evidence mutation to fail');
  } catch (error) {
    expect(pgCode(error)).toBe('23514');
  }
}

/** HAPR-01 real-PostgreSQL proof for register and append-only evidence foundations. */
describe('HAPR handover evidence repositories (integration)', () => {
  let context: INestApplicationContext;
  let db: DrizzleDatabase;
  let repository: HandoverRepository;
  let service: HandoverService;
  let bookingsService: BookingService;
  let hierarchy: CoreHierarchyFixture;
  const suffix = randomUUID().slice(0, 8);
  const personIds: string[] = [];
  const vehicleIds: string[] = [];
  const bookingIds: string[] = [];
  const handoverIds: string[] = [];
  let fleetPrincipal: Principal;
  let v2BookingId = '';

  beforeAll(async () => {
    context = await NestFactory.createApplicationContext(AppModule, { logger: false });
    db = context.get<DrizzleDatabase>(DRIZZLE);
    repository = context.get(HandoverRepository);
    service = context.get(HandoverService);
    bookingsService = context.get(BookingService);
    hierarchy = await createCoreHierarchyFixture(db, { suiteCode: `hapr_${suffix}` });
    const [scopeNodeId] = hierarchy.locationIds;

    const people = await db.insert(person).values([
      { hcmEmployeeId: `hapr-driver-${suffix}`, fullName: `HAPR Driver ${suffix}`, employmentStatus: 'Active', homePoolNodeId: scopeNodeId },
      { hcmEmployeeId: `hapr-fleet-${suffix}`, fullName: `HAPR Fleet ${suffix}`, employmentStatus: 'Active', homePoolNodeId: scopeNodeId },
    ]).returning({ id: person.id });
    personIds.push(...people.map(({ id }) => id));
    await db.insert(roleAssignment).values({
      organizationId: DEFAULT_ORGANIZATION_ID,
      personId: personIds[1],
      role: 'FleetManager',
      scopeNodeId,
    });
    fleetPrincipal = {
      organizationId: DEFAULT_ORGANIZATION_ID,
      userId: null,
      personId: personIds[1],
      entraObjectId: null,
      email: `hapr-fleet-${suffix}@example.test`,
      roles: [{ role: 'FleetManager', scopeNodeId }],
      isDevLogin: true,
    };

    const vehicles = await db.insert(vehicle).values([
      { plate: `HAPR-A-${suffix}`, chassisVin: `HAPR-A-VIN-${suffix}`, bodyTypeCode: 'SEDAN', useCategoryCode: 'POOL', lifecycleStatus: 'Active', bookingPoolFlag: true },
      { plate: `HAPR-B-${suffix}`, chassisVin: `HAPR-B-VIN-${suffix}`, bodyTypeCode: 'SUV', useCategoryCode: 'POOL', lifecycleStatus: 'Active', bookingPoolFlag: true },
      { plate: `HAPR-C-${suffix}`, chassisVin: `HAPR-C-VIN-${suffix}`, bodyTypeCode: 'SUV', useCategoryCode: 'POOL', lifecycleStatus: 'Active', bookingPoolFlag: true, fuelEfficiencyKmpl: '10', lastConfirmedOdometer: '1400' },
    ]).returning({ id: vehicle.id });
    vehicleIds.push(...vehicles.map(({ id }) => id));
    await db.insert(vehicleHierarchyAssignment).values(vehicleIds.map((vehicleId) => ({ vehicleId, nodeId: scopeNodeId })));

    const bookings = await db.insert(booking).values([
      {
        organizationId: DEFAULT_ORGANIZATION_ID,
        bookingNumber: `BK-HAPR-R-${suffix}`,
        vehicleId: vehicleIds[0],
        driverPersonId: personIds[0],
        requestedByPersonId: personIds[0],
        beneficiaryPersonId: personIds[0],
        bookingScopeNodeId: scopeNodeId,
        status: 'Completed',
        pickupAtUtc: new Date('2998-06-01T08:00:00.000Z'),
        returnAtUtc: new Date('2998-06-01T10:00:00.000Z'),
        reservationStart: new Date('2998-06-01T08:00:00.000Z'),
        reservationEnd: new Date('2998-06-01T10:15:00.000Z'),
      },
      {
        organizationId: DEFAULT_ORGANIZATION_ID,
        bookingNumber: `BK-HAPR-O-${suffix}`,
        vehicleId: vehicleIds[1],
        driverPersonId: personIds[0],
        requestedByPersonId: personIds[0],
        beneficiaryPersonId: personIds[0],
        bookingScopeNodeId: scopeNodeId,
        status: 'Active',
        pickupAtUtc: new Date('2998-06-02T08:00:00.000Z'),
        returnAtUtc: new Date('2998-06-02T10:00:00.000Z'),
        reservationStart: new Date('2998-06-02T08:00:00.000Z'),
        reservationEnd: new Date('2998-06-02T10:15:00.000Z'),
      },
      {
        organizationId: DEFAULT_ORGANIZATION_ID,
        bookingNumber: `BK-HAPR-V2-${suffix}`,
        vehicleId: vehicleIds[2],
        driverPersonId: personIds[0],
        requestedByPersonId: personIds[0],
        beneficiaryPersonId: personIds[0],
        bookingScopeNodeId: scopeNodeId,
        status: 'Approved',
        revision: 3,
        pickupAtUtc: new Date('2999-06-03T08:00:00.000Z'),
        returnAtUtc: new Date('2999-06-03T10:00:00.000Z'),
        reservationStart: new Date('2999-06-03T08:00:00.000Z'),
        reservationEnd: new Date('2999-06-03T10:15:00.000Z'),
      },
    ]).returning({ id: booking.id });
    bookingIds.push(...bookings.map(({ id }) => id));
    const [v2Booking] = await db
      .select({ id: booking.id })
      .from(booking)
      .where(eq(booking.bookingNumber, `BK-HAPR-V2-${suffix}`));
    v2BookingId = v2Booking.id;

    const returned = await repository.insert({
      organizationId: DEFAULT_ORGANIZATION_ID,
      bookingId: bookingIds[0],
      vehicleId: vehicleIds[0],
      driverPersonId: personIds[0],
      phase: 'Returned',
      startOdometer: '1000',
      startFuelEighths: 8,
      returnAtUtc: new Date('2998-06-01T10:00:00.000Z'),
      endOdometer: '1124',
      endFuelEighths: 6,
      keyOutcome: 'Returned',
      evidenceCompleteness: 'Complete',
    });
    const open = await repository.insert({
      organizationId: DEFAULT_ORGANIZATION_ID,
      bookingId: bookingIds[1],
      vehicleId: vehicleIds[1],
      driverPersonId: personIds[0],
      phase: 'Handover',
      startOdometer: '2000',
      startFuelEighths: 7,
      evidenceCompleteness: 'Complete',
    });
    handoverIds.push(returned.id, open.id);
  });

  afterAll(async () => {
    for (const table of ['handover_inspection_item', 'handover_evidence', 'handover_amendment', 'handover'] as const) {
      const trigger = table === 'handover_inspection_item'
        ? 'handover_inspection_no_mutate_trg'
        : table === 'handover_evidence'
          ? 'handover_evidence_claimed_immutable_trg'
          : table === 'handover_amendment'
            ? 'handover_amendment_no_mutate_trg'
            : 'handover_completed_immutable_trg';
      await db.execute(sql.raw(`ALTER TABLE fleet.${table} DISABLE TRIGGER ${trigger}`));
    }
    if (bookingIds.length) {
      await db.delete(handoverCommandLedger).where(inArray(handoverCommandLedger.resultHandoverId, handoverIds));
      await db.delete(handoverInspectionItem).where(inArray(handoverInspectionItem.handoverId, handoverIds));
      await db.delete(handoverEvidence).where(or(
        inArray(handoverEvidence.handoverId, handoverIds),
        inArray(handoverEvidence.uploadedByPersonId, personIds),
      ));
      await db.delete(handoverAmendment).where(inArray(handoverAmendment.handoverId, handoverIds));
      await db.delete(damagePin).where(inArray(damagePin.handoverId, handoverIds));
      await db.delete(keyLog).where(inArray(keyLog.handoverId, handoverIds));
      await db.delete(handover).where(inArray(handover.bookingId, bookingIds));
      await db.delete(bookingEvent).where(inArray(bookingEvent.bookingId, bookingIds));
      await db.delete(outboxEvent).where(inArray(outboxEvent.aggregateId, [...bookingIds, ...handoverIds]));
    }
    for (const table of ['handover_inspection_item', 'handover_evidence', 'handover_amendment', 'handover'] as const) {
      const trigger = table === 'handover_inspection_item'
        ? 'handover_inspection_no_mutate_trg'
        : table === 'handover_evidence'
          ? 'handover_evidence_claimed_immutable_trg'
          : table === 'handover_amendment'
            ? 'handover_amendment_no_mutate_trg'
            : 'handover_completed_immutable_trg';
      await db.execute(sql.raw(`ALTER TABLE fleet.${table} ENABLE TRIGGER ${trigger}`));
    }
    if (bookingIds.length) await db.delete(booking).where(inArray(booking.id, bookingIds));
    if (vehicleIds.length) {
      await db.delete(vehicleHierarchyAssignment).where(inArray(vehicleHierarchyAssignment.vehicleId, vehicleIds));
      await db.delete(vehicle).where(inArray(vehicle.id, vehicleIds));
    }
    if (personIds.length) await db.delete(roleAssignment).where(inArray(roleAssignment.personId, personIds));
    if (personIds.length) await db.delete(person).where(inArray(person.id, personIds));
    await hierarchy?.cleanupHierarchy();
    await context?.close();
  });

  it('retains Returned records and filters deterministic register pages', async () => {
    const all = await repository.listRegister(DEFAULT_ORGANIZATION_ID, hierarchy.locationIds, { filter: 'All', page: 1, pageSize: 5, sort: 'ActivityDesc' });
    expect(all).toEqual(expect.arrayContaining([
      expect.objectContaining({ handoverId: handoverIds[0], phase: 'Returned', distanceKm: '124.0' }),
      expect.objectContaining({ handoverId: handoverIds[1], phase: 'Handover' }),
    ]));
    expect(await repository.countRegister(DEFAULT_ORGANIZATION_ID, hierarchy.locationIds, 'All')).toBe(2);
    expect(await repository.countRegister(DEFAULT_ORGANIZATION_ID, hierarchy.locationIds, 'OnTrip')).toBe(1);
    expect(await repository.countRegister(DEFAULT_ORGANIZATION_ID, hierarchy.locationIds, 'OnTime')).toBe(1);
  });

  it('claims caller-owned staged evidence once and protects the claimed row', async () => {
    const staged = await repository.insertEvidence({
      organizationId: DEFAULT_ORGANIZATION_ID,
      uploadedByPersonId: personIds[1],
      evidenceType: 'VehiclePhoto',
      status: 'Staged',
      objectKey: `handover-evidence/${DEFAULT_ORGANIZATION_ID}/${suffix}.jpg`,
      contentSha256: 'a'.repeat(64),
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      expiresAtUtc: new Date(Date.now() + 60_000),
    });
    expect(await repository.findStagedEvidence([staged.id], DEFAULT_ORGANIZATION_ID, personIds[1])).toHaveLength(1);
    expect(await repository.findStagedEvidence([staged.id], DEFAULT_ORGANIZATION_ID, personIds[0])).toHaveLength(0);
    expect(await repository.claimEvidence([staged.id], handoverIds[1], db)).toHaveLength(1);
    expect(await repository.claimEvidence([staged.id], handoverIds[1], db)).toHaveLength(0);
    await expectImmutable(db.update(handoverEvidence).set({ deviceRef: 'changed' }).where(eq(handoverEvidence.id, staged.id)));
  });

  it('enforces insert-only inspections/amendments and completed Handover immutability', async () => {
    const inspection = await repository.insertInspection({
      organizationId: DEFAULT_ORGANIZATION_ID,
      handoverId: handoverIds[1],
      capturePhase: 'Handover',
      definitionVersion: 1,
      itemCode: 'body',
      verdict: 'Pass',
      capturedByPersonId: personIds[1],
    }, db);
    await expectImmutable(db.update(handoverInspectionItem).set({ verdict: 'Fail' }).where(eq(handoverInspectionItem.id, inspection.id)));

    const amendment = await repository.insertAmendment({
      organizationId: DEFAULT_ORGANIZATION_ID,
      handoverId: handoverIds[0],
      revision: 1,
      reason: 'Add supporting evidence reference',
      actorPersonId: personIds[1],
    });
    await expectImmutable(db.update(handoverAmendment).set({ reason: 'Changed' }).where(eq(handoverAmendment.id, amendment.id)));
    await expectImmutable(db.execute(sql`UPDATE fleet.handover SET start_odometer = 999 WHERE id = ${handoverIds[0]}`));
  });

  it('claims V2 evidence and completes an atomic Lost-key return with stable replay', async () => {
    const [scopeNodeId] = hierarchy.locationIds;
    const stageSignature = async (signerPersonId: string) => repository.insertEvidence({
      organizationId: DEFAULT_ORGANIZATION_ID,
      uploadedByPersonId: personIds[1],
      evidenceType: 'Signature',
      status: 'Staged',
      objectKey: `handover-evidence/${DEFAULT_ORGANIZATION_ID}/${suffix}-${randomUUID()}.png`,
      contentSha256: randomUUID().replaceAll('-', '').padEnd(64, '0').slice(0, 64),
      mimeType: 'image/png',
      sizeBytes: 256,
      signerPersonId,
      expiresAtUtc: new Date(Date.now() + 60_000),
    });
    const inspection = (['body', 'tyres', 'lights', 'assets', 'cabin'] as const)
      .map((code) => ({ code, verdict: 'Pass' as const, evidenceRefs: [] }));
    const driverSignature = await stageSignature(personIds[0]);
    const bookingState = await bookingsService.get(v2BookingId, fleetPrincipal);
    expect(bookingState.bookingNumber).toBe(`BK-HAPR-V2-${suffix}`);
    const openInput = {
      schemaVersion: 2 as const,
      bookingId: v2BookingId,
      employeePersonId: personIds[0],
      expectedBookingRevision: bookingState.revision,
      startOdometer: 1000,
      startFuelEighths: 8,
      gpsStatus: 'Online',
      keyIssueRef: `KEY-${suffix}`,
      signatureRef: driverSignature.id,
      checklist: [],
      offlineCaptured: false,
      existingDamage: [],
      checklistDefinitionVersion: 1,
      inspection,
      vehiclePhotoRefs: [],
      signatureEvidenceRef: driverSignature.id,
      releaseLocationNodeId: scopeNodeId,
    };
    const openKey = `hapr-v2-open-${suffix}`;
    const opened = await service.open(openInput, fleetPrincipal, openKey);
    handoverIds.push(opened.id);

    expect(opened).toMatchObject({ schemaVersion: 2, phase: 'Handover' });
    expect((await repository.listInspections(opened.id)).filter(({ capturePhase }) => capturePhase === 'Handover')).toHaveLength(5);
    expect(await repository.listEvidence(opened.id)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: driverSignature.id, status: 'Claimed', signerPersonId: personIds[0] }),
    ]));
    expect((await db.select({ status: booking.status }).from(booking).where(eq(booking.id, v2BookingId)))[0]?.status).toBe('Active');

    const openReplay = await service.open({ ...openInput, inspection: [...inspection].reverse() }, fleetPrincipal, openKey);
    expect(openReplay.id).toBe(opened.id);

    const fleetSignature = await stageSignature(personIds[1]);
    const returnInput = {
      schemaVersion: 2 as const,
      expectedHandoverRevision: 1,
      endOdometer: 1300,
      endFuelEighths: 5,
      returnCondition: 'Good',
      signatureRef: fleetSignature.id,
      offlineCaptured: false,
      newDamage: [],
      checklistDefinitionVersion: 1,
      inspection,
      returnConditionCode: 'Good' as const,
      keyOutcome: 'Lost' as const,
      keyLostReason: 'Key could not be located during return',
      vehiclePhotoRefs: [],
      signatureEvidenceRef: fleetSignature.id,
      returnLocationNodeId: scopeNodeId,
    };
    const returnKey = `hapr-v2-return-${suffix}`;
    const returned = await service.recordReturn(opened.id, returnInput, fleetPrincipal, returnKey);

    expect(returned).toMatchObject({ schemaVersion: 2, phase: 'Returned' });
    expect((await repository.listInspections(opened.id)).filter(({ capturePhase }) => capturePhase === 'Return')).toHaveLength(5);
    expect((await repository.listHandoverKeys(opened.id)).at(-1)).toMatchObject({ custodyState: 'Lost', incidentReason: returnInput.keyLostReason });
    expect((await db.select({ status: booking.status }).from(booking).where(eq(booking.id, v2BookingId)))[0]?.status).toBe('Completed');
    expect(await db.select().from(outboxEvent).where(eq(outboxEvent.aggregateId, opened.id))).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventType: 'VehicleKeyLost' }),
    ]));

    const returnReplay = await service.recordReturn(opened.id, { ...returnInput, inspection: [...inspection].reverse() }, fleetPrincipal, returnKey);
    expect(returnReplay.id).toBe(opened.id);

    const amendmentEvidence = await repository.insertEvidence({
      organizationId: DEFAULT_ORGANIZATION_ID,
      uploadedByPersonId: personIds[1],
      evidenceType: 'VehiclePhoto',
      status: 'Staged',
      objectKey: `handover-evidence/${DEFAULT_ORGANIZATION_ID}/${suffix}-amendment.png`,
      contentSha256: 'b'.repeat(64),
      mimeType: 'image/png',
      sizeBytes: 256,
      expiresAtUtc: new Date(Date.now() + 60_000),
    });
    const amendmentInput = {
      expectedChainRevision: 2,
      reason: 'Attach clearer supporting evidence to the immutable return chain',
      evidenceRefs: [amendmentEvidence.id],
    };
    const amendmentKey = `hapr-v2-amend-${suffix}`;
    const amendment = await service.amend(opened.id, amendmentInput, fleetPrincipal, amendmentKey);
    const amendmentReplay = await service.amend(opened.id, amendmentInput, fleetPrincipal, amendmentKey);

    expect(amendment).toMatchObject({ schemaVersion: 2, handoverId: opened.id, revision: 1, evidenceRefs: [amendmentEvidence.id] });
    expect(amendmentReplay).toEqual(amendment);
    expect((await service.chain(opened.id, fleetPrincipal)).amendments).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: amendment.id, revision: 1 }),
    ]));
  });
});
