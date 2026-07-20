import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import { hierarchyNode, person, vehicle } from '../src/common/database/schema';
import { AuditService } from '../src/modules/platform/services/audit.service';
import { BookingService } from '../src/modules/bookings/services/booking.service';
import { HandoverService } from '../src/modules/handover/services/handover.service';

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
  let db: DrizzleDatabase;

  const suffix = randomUUID().slice(0, 8);
  const future = (day: number, hour: number) => `2999-02-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;

  let poolNode = '';
  let driverId = '';
  let managerId = '';
  let vehicleId = '';
  let bookingId = '';
  let handoverId = '';

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
    bookings = ctx.get(BookingService);
    handovers = ctx.get(HandoverService);
    audit = ctx.get(AuditService);
    db = ctx.get<DrizzleDatabase>(DRIZZLE);

    const [node] = await db
      .insert(hierarchyNode)
      .values({ parentId: 'a0000000-0000-4000-8000-000000000003', code: `HO-${suffix.toUpperCase()}`, levelIndex: 3, levelLabel: 'Location', levelCode: 'LOCATION', name: `Ho Location ${suffix}`, nameAr: `Ho Location ${suffix}`, path: sql`${`group.ports.khalifa.ho_${suffix}`}::ltree` })
      .returning({ id: hierarchyNode.id });
    poolNode = node.id;

    const [manager] = await db
      .insert(person)
      .values({ hcmEmployeeId: `ho-mgr-${suffix}`, fullName: `Manager ${suffix}`, employmentStatus: 'Active' })
      .returning({ id: person.id });
    managerId = manager.id;

    const [driver] = await db
      .insert(person)
      .values({ hcmEmployeeId: `ho-drv-${suffix}`, fullName: `Driver ${suffix}`, employmentStatus: 'Active', licenceExpiry: '2999-01-01', lineManagerPersonId: managerId })
      .returning({ id: person.id });
    driverId = driver.id;

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

    // Drive a booking to Approved.
    const draft = await bookings.create({ vehicleId, driverPersonId: driverId, requestedByPersonId: driverId, pickupAtUtc: future(2, 8), returnAtUtc: future(2, 10) });
    bookingId = draft.id;
    await bookings.signConsent(bookingId, { driverPersonId: driverId, consentDocumentVersion: 'consent-v0' });
    await bookings.submit(bookingId);
    await bookings.decide(bookingId, { actorPersonId: managerId, decision: 'APPROVED' });
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM fleet.damage_pin WHERE handover_id IN (SELECT id FROM fleet.handover WHERE booking_id = ${bookingId})`);
    await db.execute(sql`DELETE FROM fleet.key_log WHERE vehicle_id = ${vehicleId}`);
    await db.execute(sql`DELETE FROM fleet.outbox_event WHERE aggregate_id IN (SELECT id::text FROM fleet.handover WHERE booking_id = ${bookingId})`);
    await db.execute(sql`DELETE FROM fleet.handover WHERE booking_id = ${bookingId}`);
    await db.execute(sql`DELETE FROM fleet.consent_lifecycle_event WHERE booking_id = ${bookingId}`);
    await db.execute(sql`DELETE FROM fleet.consent_record WHERE booking_id = ${bookingId}`);
    await db.execute(sql`DELETE FROM fleet.booking_event WHERE booking_id = ${bookingId}`);
    await db.execute(sql`DELETE FROM fleet.outbox_event WHERE aggregate_id = ${bookingId}`);
    await db.execute(sql`DELETE FROM fleet.workflow_step WHERE workflow_instance_id IN (SELECT id FROM fleet.workflow_instance WHERE subject_ref = ${`booking:${bookingId}`})`);
    await db.execute(sql`DELETE FROM fleet.workflow_instance WHERE subject_ref = ${`booking:${bookingId}`}`);
    await db.execute(sql`DELETE FROM fleet.booking WHERE id = ${bookingId}`);
    await db.execute(sql`DELETE FROM fleet.eligibility_evaluation WHERE driver_person_id = ${driverId}`);
    await db.execute(sql`DELETE FROM fleet.vehicle WHERE id = ${vehicleId}`);
    await db.execute(sql`DELETE FROM fleet.person WHERE id IN (${driverId}, ${managerId})`);
    await db.execute(sql`DELETE FROM fleet.hierarchy_node WHERE id = ${poolNode}`);
    await ctx?.close();
  });

  it('opens a handover for the approved booking → booking becomes Active + key issued', async () => {
    const dto = await handovers.open({
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
    });
    handoverId = dto.id;
    expect(dto.phase).toBe('Handover');
    expect(dto.damage.some((d) => d.state === 'existing')).toBe(true);

    const booking = await bookings.get(bookingId);
    expect(booking.status).toBe('Active');

    const keys = await handovers.keys(vehicleId);
    expect(keys.some((k) => k.custodyState === 'Issued')).toBe(true);
  });

  it('records the return with reconciliation, odometer conflict, and completes the booking', async () => {
    const dto = await handovers.recordReturn(handoverId, {
      endOdometer: 1300, // 300 km; expected 30 L at 10 km/L
      endFuelEighths: 2,
      returnCondition: 'clean',
      keyReturnRef: 'KEY-01',
      signatureRef: 'sig-return',
      observedFuelConsumedLitres: 50, // ~66% deviation → advisory flag
      offlineCaptured: false,
      newDamage: [{ x: 0.6, y: 0.4, region: 'front-bumper', templateVersion: 1, state: 'new' }],
    });

    expect(dto.phase).toBe('Returned');
    expect(dto.fuelDeviationFlagged).toBe(true);
    expect(dto.odometerConflict).toBe(true); // manual 1300 vs telematics 9999
    expect(dto.damage.length).toBe(2); // existing + new

    // Telematics remains the system of record — the vehicle odometer is not the manual value.
    const [veh] = await db.execute(sql`SELECT last_confirmed_odometer FROM fleet.vehicle WHERE id = ${vehicleId}`) as unknown as Array<{ last_confirmed_odometer: string }>;
    expect(Number(veh.last_confirmed_odometer)).toBe(9999);

    const booking = await bookings.get(bookingId);
    expect(booking.status).toBe('Completed');

    const keys = await handovers.keys(vehicleId);
    expect(keys.some((k) => k.custodyState === 'Returned')).toBe(true);

    expect(await audit.verifyChain()).toBe(true);
  });
});
