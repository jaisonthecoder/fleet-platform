import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/bootstrap/configure-app';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import {
  booking,
  bookingEvent,
  person,
  roleAssignment,
  vehicle,
  vehicleHierarchyAssignment,
} from '../src/common/database/schema';

describe('Booking guarded HTTP (integration — requires DB + Redis)', () => {
  let app: NestFastifyApplication;
  let db: DrizzleDatabase;
  const suffix = randomUUID().slice(0, 8);
  const scopeNodeId = 'a0000000-0000-4000-8000-000000000003';
  let ownerId = '';
  let unrelatedId = '';
  let vehicleId = '';
  let bookingId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    db = app.get<DrizzleDatabase>(DRIZZLE);

    const people = await db.insert(person).values([
      {
        hcmEmployeeId: `booking-http-owner-${suffix}`,
        fullName: `Booking Owner ${suffix}`,
        employmentStatus: 'Active',
        homePoolNodeId: scopeNodeId,
      },
      {
        hcmEmployeeId: `booking-http-other-${suffix}`,
        fullName: `Booking Other ${suffix}`,
        employmentStatus: 'Active',
        homePoolNodeId: scopeNodeId,
      },
    ]).returning({ id: person.id });
    [ownerId, unrelatedId] = people.map(({ id }) => id);
    await db.insert(roleAssignment).values([
      { personId: ownerId, role: 'Employee', scopeNodeId },
      { personId: unrelatedId, role: 'Employee', scopeNodeId },
    ]);
    const [createdVehicle] = await db.insert(vehicle).values({
      plate: `BH-${suffix}`,
      chassisVin: `VIN-BH-${suffix}`,
      bodyTypeCode: 'SEDAN',
      useCategoryCode: 'POOL',
      lifecycleStatus: 'Active',
      bookingPoolFlag: true,
    }).returning({ id: vehicle.id });
    vehicleId = createdVehicle.id;
    await db.insert(vehicleHierarchyAssignment).values({ vehicleId, nodeId: scopeNodeId });
    const [createdBooking] = await db.insert(booking).values({
      vehicleId,
      driverPersonId: ownerId,
      requestedByPersonId: ownerId,
      beneficiaryPersonId: ownerId,
      bookingScopeNodeId: scopeNodeId,
      pickupAtUtc: new Date('2999-04-01T08:00:00.000Z'),
      returnAtUtc: new Date('2999-04-01T10:00:00.000Z'),
      reservationStart: new Date('2999-04-01T08:00:00.000Z'),
      reservationEnd: new Date('2999-04-01T10:15:00.000Z'),
      bufferMinutes: 15,
    }).returning({ id: booking.id });
    bookingId = createdBooking.id;
    await db.insert(bookingEvent).values({
      bookingId,
      eventType: 'DraftCreated',
      actorRef: `person:${ownerId}`,
    });
  });

  afterAll(async () => {
    if (bookingId) {
      await db.execute(sql`DELETE FROM fleet.booking_event WHERE booking_id = ${bookingId}`);
      await db.execute(sql`DELETE FROM fleet.booking WHERE id = ${bookingId}`);
    }
    if (vehicleId) {
      await db.execute(sql`DELETE FROM fleet.vehicle_hierarchy_assignment WHERE vehicle_id = ${vehicleId}`);
      await db.execute(sql`DELETE FROM fleet.vehicle WHERE id = ${vehicleId}`);
    }
    if (ownerId && unrelatedId) {
      await db.execute(sql`DELETE FROM fleet.role_assignment WHERE person_id IN (${ownerId}, ${unrelatedId})`);
      await db.execute(sql`DELETE FROM fleet.person WHERE id IN (${ownerId}, ${unrelatedId})`);
    }
    await app?.close();
  });

  it('protects static routes and never parses them as Booking ids', async () => {
    const denied = await app.inject({ method: 'GET', url: '/api/v1/bookings/context' });
    expect(denied.statusCode).toBe(401);

    for (const path of ['context', 'people']) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${path}`,
        headers: { 'x-dev-person-id': ownerId },
      });
      expect(response.statusCode).toBe(200);
    }
  });

  it('allows owner reads and denies non-owner id access and commands', async () => {
    for (const suffixPath of ['', '/events']) {
      const owner = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${bookingId}${suffixPath}`,
        headers: { 'x-dev-person-id': ownerId },
      });
      expect(owner.statusCode).toBe(200);

      const denied = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${bookingId}${suffixPath}`,
        headers: { 'x-dev-person-id': unrelatedId },
      });
      expect(denied.statusCode).toBe(403);
    }

    const consent = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${bookingId}/consent`,
      headers: {
        'x-dev-person-id': unrelatedId,
        'idempotency-key': `booking-http-consent-${suffix}`,
      },
      payload: { driverPersonId: ownerId, consentDocumentVersion: 'v1' },
    });
    expect(consent.statusCode).toBe(403);

    const submit = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${bookingId}/submit`,
      headers: {
        'x-dev-person-id': unrelatedId,
        'idempotency-key': `booking-http-submit-${suffix}`,
      },
    });
    expect(submit.statusCode).toBe(403);
  });

  it('rejects mutating commands without an Idempotency-Key before side effects', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${bookingId}/consent`,
      headers: { 'x-dev-person-id': ownerId },
      payload: { driverPersonId: ownerId, consentDocumentVersion: 'v1' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ reasons: ['booking-idempotency-key-required'] });
  });
});
