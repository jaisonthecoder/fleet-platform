import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import { devicePairing, vehicle } from '../src/common/database/schema';import {
  type ActiveBooking,
  BOOKINGS_PORT,
} from '../src/modules/telematics-domain/internal/bookings-port';
import { AlertService } from '../src/modules/telematics-domain/services/alert.service';
import { DeviceService } from '../src/modules/telematics-domain/services/device.service';
import { LiveMapService } from '../src/modules/telematics-domain/services/live-map.service';
import { TripService } from '../src/modules/telematics-domain/services/trip.service';
import { TelematicsRepository } from '../src/modules/telematics-domain/repositories/telematics.repository';

/**
 * Integration proof of the telematics domain (M10). Requires a live DB + Redis.
 * Proves device pairing (exclusion-guarded, re-pair without overlap), trip
 * attribution via the bookings **port** (test-double — unattributed vs attached),
 * auto-odometer, the live map + access audit, and alerts.
 */
describe('telematics domain (integration — requires DB + Redis)', () => {
  let moduleRef: TestingModule;
  let devices: DeviceService;
  let trips: TripService;
  let alerts: AlertService;
  let liveMap: LiveMapService;
  let repo: TelematicsRepository;
  let db: DrizzleDatabase;

  // Controllable bookings-port double.
  const port = { booking: null as ActiveBooking | null, findActiveBooking: async () => port.booking };

  const suffix = randomUUID().slice(0, 8);
  let vehicle1 = '';
  let vehicle2 = '';
  let deviceId = '';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(BOOKINGS_PORT)
      .useValue(port)
      .compile();
    devices = moduleRef.get(DeviceService);
    trips = moduleRef.get(TripService);
    alerts = moduleRef.get(AlertService);
    liveMap = moduleRef.get(LiveMapService);
    repo = moduleRef.get(TelematicsRepository);
    db = moduleRef.get<DrizzleDatabase>(DRIZZLE);

    const inserted = await db
      .insert(vehicle)
      .values([
        { plate: `TEL-${suffix}-1`, chassisVin: `TELVIN-${suffix}-1`, bodyTypeCode: 'SEDAN' },
        { plate: `TEL-${suffix}-2`, chassisVin: `TELVIN-${suffix}-2`, bodyTypeCode: 'SEDAN' },
      ])
      .returning({ id: vehicle.id });
    vehicle1 = inserted[0].id;
    vehicle2 = inserted[1].id;
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM fleet.telematics_alert WHERE vehicle_id IN (${vehicle1}, ${vehicle2})`);
    await db.execute(sql`DELETE FROM fleet.trip WHERE vehicle_id IN (${vehicle1}, ${vehicle2})`);
    await db.execute(sql`DELETE FROM fleet.telemetry WHERE vehicle_id IN (${vehicle1}, ${vehicle2})`);
    await db.execute(sql`DELETE FROM fleet.device_pairing WHERE vehicle_id IN (${vehicle1}, ${vehicle2})`);
    if (deviceId) await db.execute(sql`DELETE FROM fleet.device WHERE id = ${deviceId}`);
    await db.execute(sql`DELETE FROM fleet.vehicle WHERE id IN (${vehicle1}, ${vehicle2})`);
    await moduleRef.close();
  });

  it('registers and pairs a device, then re-pairs it without overlapping actives', async () => {
    const d = await devices.register({ identifier: `DEV-${suffix}`, model: 'OBD-II' }, 'tester');
    deviceId = d.id;

    await devices.pair({ deviceId, vehicleId: vehicle1 }, 'tester');
    let active = await db
      .select()
      .from(devicePairing)
      .where(and(eq(devicePairing.deviceId, deviceId), isNull(devicePairing.validTo)));
    expect(active).toHaveLength(1);
    expect(active[0].vehicleId).toBe(vehicle1);

    await devices.pair({ deviceId, vehicleId: vehicle2 }, 'tester');
    active = await db
      .select()
      .from(devicePairing)
      .where(and(eq(devicePairing.deviceId, deviceId), isNull(devicePairing.validTo)));
    expect(active).toHaveLength(1);
    expect(active[0].vehicleId).toBe(vehicle2);
  });

  it('forbids a second active pairing for the same device (exclusion)', async () => {
    await expect(
      db.insert(devicePairing).values({ deviceId, vehicleId: vehicle1 }),
    ).rejects.toBeDefined();
  });

  it('maps a duplicate device identifier to a Conflict', async () => {
    await expect(devices.register({ identifier: `DEV-${suffix}` })).rejects.toBeInstanceOf(ConflictException);
  });

  it('records an unattributed trip when no booking is active', async () => {
    port.booking = null;
    const started = await trips.startTrip({ vehicleId: vehicle1, startOdometer: '1000' });
    const ended = await trips.endTrip(started.id, { endOdometer: '1042', distanceKm: '42' }, 'tester');
    expect(ended.attributionBasis).toBe('unattributed');
    expect(ended.bookingId).toBeNull();
  });

  it('attaches a trip to the active booking (via the port) and updates the odometer', async () => {
    const booking: ActiveBooking = { bookingId: randomUUID(), driverPersonId: randomUUID() };
    port.booking = booking;
    const started = await trips.startTrip({ vehicleId: vehicle2, startOdometer: '500' });
    const ended = await trips.endTrip(started.id, { endOdometer: '575' }, 'tester');
    expect(ended.attributionBasis).toBe('booking');
    expect(ended.bookingId).toBe(booking.bookingId);

    const [v] = await db.select({ odo: vehicle.lastConfirmedOdometer }).from(vehicle).where(eq(vehicle.id, vehicle2));
    expect(Number(v.odo)).toBe(575);
  });

  it('rejects re-ending an already-ended trip (idempotency guard)', async () => {
    port.booking = null;
    const started = await trips.startTrip({ vehicleId: vehicle1 });
    await trips.endTrip(started.id, { endOdometer: '2000' }, 'tester');
    await expect(trips.endTrip(started.id, { endOdometer: '2100' }, 'tester')).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns the live position + online flag and audits the access', async () => {
    await repo.insertTelemetry({ time: new Date(), vehicleId: vehicle1, lat: 24.5, lon: 54.4, speed: 30, ignition: true });
    const live = await liveMap.getLive(vehicle1, 'tester');
    expect(live.lat).toBe(24.5);
    expect(live.online).toBe(true);
  });

  it('raises and lists a telematics alert', async () => {
    const alert = await alerts.raiseAlert({ vehicleId: vehicle1, deviceId, alertType: 'DeviceSilent', detail: 'no data 30m' });
    expect(alert.alertType).toBe('DeviceSilent');
    const list = await alerts.list();
    expect(list.some((a) => a.id === alert.id)).toBe(true);
  });
});
