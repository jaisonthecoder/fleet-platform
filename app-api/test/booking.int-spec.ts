import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import { hierarchyNode, person, vehicle, vehicleHierarchyAssignment } from '../src/common/database/schema';
import { AuditService } from '../src/modules/platform/services/audit.service';
import { BookingService } from '../src/modules/bookings/services/booking.service';

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
  let db: DrizzleDatabase;

  const suffix = randomUUID().slice(0, 8);
  const future = (day: number, hour: number) => `2999-01-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;

  let poolNode = '';
  let driverId = '';
  let managerId = '';
  let okVehicleId = '';
  let expiredVehicleId = '';
  const bookingIds: string[] = [];

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
    bookings = ctx.get(BookingService);
    audit = ctx.get(AuditService);
    db = ctx.get<DrizzleDatabase>(DRIZZLE);

    const [node] = await db
      .insert(hierarchyNode)
      .values({ parentId: 'a0000000-0000-4000-8000-000000000003', code: `BK-${suffix.toUpperCase()}`, levelIndex: 3, levelLabel: 'Location', levelCode: 'LOCATION', name: `Bk Location ${suffix}`, nameAr: `Bk Location ${suffix}`, path: sql`${`group.ports.khalifa.bk_${suffix}`}::ltree` })
      .returning({ id: hierarchyNode.id });
    poolNode = node.id;

    const [manager] = await db
      .insert(person)
      .values({ hcmEmployeeId: `bk-mgr-${suffix}`, fullName: `Manager ${suffix}`, employmentStatus: 'Active' })
      .returning({ id: person.id });
    managerId = manager.id;

    const [driver] = await db
      .insert(person)
      .values({
        hcmEmployeeId: `bk-drv-${suffix}`,
        fullName: `Driver ${suffix}`,
        employmentStatus: 'Active',
        licenceExpiry: '2999-01-01',
        lineManagerPersonId: managerId,
      })
      .returning({ id: person.id });
    driverId = driver.id;

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
      { vehicleId: expiredVehicleId, nodeId: poolNode },
    ]);
  });

  afterAll(async () => {
    for (const id of bookingIds) {
      await db.execute(sql`DELETE FROM fleet.consent_lifecycle_event WHERE booking_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.consent_record WHERE booking_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.booking_event WHERE booking_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.outbox_event WHERE aggregate_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.workflow_step WHERE workflow_instance_id IN (SELECT id FROM fleet.workflow_instance WHERE subject_ref = ${`booking:${id}`})`);
      await db.execute(sql`DELETE FROM fleet.workflow_instance WHERE subject_ref = ${`booking:${id}`}`);
      await db.execute(sql`DELETE FROM fleet.booking_policy_decision WHERE booking_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.booking WHERE id = ${id}`);
    }
    await db.execute(sql`DELETE FROM fleet.eligibility_evaluation WHERE driver_person_id = ${driverId}`);
    await db.execute(sql`DELETE FROM fleet.vehicle_hierarchy_assignment WHERE vehicle_id IN (${okVehicleId}, ${expiredVehicleId})`);
    await db.execute(sql`DELETE FROM fleet.vehicle WHERE id IN (${okVehicleId}, ${expiredVehicleId})`);
    await db.execute(sql`DELETE FROM fleet.person WHERE id IN (${driverId}, ${managerId})`);
    await db.execute(sql`DELETE FROM fleet.hierarchy_node WHERE id = ${poolNode}`);
    await ctx?.close();
  });

  async function draft(vehicleId: string, pickup: string, ret: string): Promise<string> {
    const dto = await bookings.create({
      vehicleId,
      driverPersonId: driverId,
      requestedByPersonId: driverId,
      pickupAtUtc: pickup,
      returnAtUtc: ret,
    });
    bookingIds.push(dto.id);
    return dto.id;
  }

  it('runs the loop: draft → consent (number issued) → submit → approve', async () => {
    const id = await draft(okVehicleId, future(2, 8), future(2, 10));

    const drafted = await bookings.get(id);
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

    const reserved = await bookings.signConsent(id, { driverPersonId: driverId, consentDocumentVersion: 'consent-v0' });
    expect(reserved.status).toBe('PendingApproval');
    expect(reserved.bookingNumber).toMatch(/^BK-\d{4}-\d{6}$/);
    expect(reserved.consentRecordId).not.toBeNull();

    // Consent is committed alongside the number.
    const consent = await db.execute(sql`SELECT id FROM fleet.consent_record WHERE booking_id = ${id}`);
    expect((consent as unknown as unknown[]).length).toBe(1);

    await bookings.submit(id);
    const approved = await bookings.decide(id, { actorPersonId: managerId, decision: 'APPROVED' });
    expect(approved.status).toBe('Approved');

    // The tamper-evident audit chain stays intact across the loop.
    expect(await audit.verifyChain()).toBe(true);
  });

  it('prevents a double-booking: a concurrent overlap on the same vehicle is a 409', async () => {
    const first = await draft(okVehicleId, future(10, 8), future(10, 10));
    const second = await draft(okVehicleId, future(10, 9), future(10, 11)); // overlaps first

    const reservedFirst = await bookings.signConsent(first, { driverPersonId: driverId, consentDocumentVersion: 'consent-v0' });
    expect(reservedFirst.status).toBe('PendingApproval');

    // Consenting the overlapping second booking must be rejected by the exclusion.
    await expect(
      bookings.signConsent(second, { driverPersonId: driverId, consentDocumentVersion: 'consent-v0' }),
    ).rejects.toMatchObject({ status: 409 });

    // The loser holds no number and stays a draft (atomic rollback).
    const loser = await bookings.get(second);
    expect(loser.status).toBe('Draft');
    expect(loser.bookingNumber).toBeNull();
  });

  it('issues zero bookings on expired documents (hard block, no override)', async () => {
    const id = await draft(expiredVehicleId, future(20, 8), future(20, 10));
    await expect(
      bookings.signConsent(id, { driverPersonId: driverId, consentDocumentVersion: 'consent-v0' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const blocked = await bookings.get(id);
    expect(blocked.status).toBe('Draft');
    expect(blocked.bookingNumber).toBeNull();
  });

  it('availability reflects the reserved range (reserved vehicle is not offered)', async () => {
    // The vehicle reserved in the first test (day 2, 08:00–10:00) must not appear
    // as available for an overlapping window.
    const available = await bookings.availability({ pickupAtUtc: future(2, 9), returnAtUtc: future(2, 10) });
    expect(available.some((v) => v.vehicleId === okVehicleId)).toBe(false);
  });
});
