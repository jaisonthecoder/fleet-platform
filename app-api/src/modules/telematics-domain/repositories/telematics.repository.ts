import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import {
  device,
  devicePairing,
  telematicsAlert,
  telemetry,
  trip,
  vehicle,
} from '../../../common/database/schema';

type Executor = Pick<DrizzleDatabase, 'insert' | 'update'>;

/** Data access for the telematics domain. */
@Injectable()
export class TelematicsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async insertDevice(values: typeof device.$inferInsert) {
    const rows = await this.db.insert(device).values(values).returning();
    return rows[0];
  }

  async findDevice(id: string) {
    const rows = await this.db.select().from(device).where(eq(device.id, id)).limit(1);
    return rows[0];
  }

  async listDevices() {
    return this.db.select().from(device).orderBy(desc(device.createdAtUtc));
  }

  async activePairingForDevice(deviceId: string) {
    const rows = await this.db
      .select()
      .from(devicePairing)
      .where(and(eq(devicePairing.deviceId, deviceId), isNull(devicePairing.validTo)))
      .limit(1);
    return rows[0];
  }

  async activePairingForVehicle(vehicleId: string) {
    const rows = await this.db
      .select()
      .from(devicePairing)
      .where(and(eq(devicePairing.vehicleId, vehicleId), isNull(devicePairing.validTo)))
      .limit(1);
    return rows[0];
  }

  async expirePairing(id: string, at: Date, executor: Executor = this.db) {
    await executor.update(devicePairing).set({ validTo: at, updatedAtUtc: new Date() }).where(eq(devicePairing.id, id));
  }

  async insertPairing(values: typeof devicePairing.$inferInsert, executor: Executor = this.db) {
    await executor.insert(devicePairing).values(values);
  }

  async insertTrip(values: typeof trip.$inferInsert) {
    const rows = await this.db.insert(trip).values(values).returning();
    return rows[0];
  }

  async findTrip(id: string) {
    const rows = await this.db.select().from(trip).where(eq(trip.id, id)).limit(1);
    return rows[0];
  }

  async updateTrip(id: string, set: Partial<typeof trip.$inferInsert>) {
    const rows = await this.db.update(trip).set(set).where(eq(trip.id, id)).returning();
    return rows[0];
  }

  async updateVehicleOdometer(vehicleId: string, odometer: string) {
    await this.db
      .update(vehicle)
      .set({ lastConfirmedOdometer: odometer, updatedAtUtc: new Date() })
      .where(eq(vehicle.id, vehicleId));
  }

  async insertAlert(values: typeof telematicsAlert.$inferInsert) {
    const rows = await this.db.insert(telematicsAlert).values(values).returning();
    return rows[0];
  }

  async listAlerts(limit = 50) {
    return this.db.select().from(telematicsAlert).orderBy(desc(telematicsAlert.raisedAt)).limit(limit);
  }

  async acknowledgeAlert(id: string) {
    await this.db.update(telematicsAlert).set({ acknowledgedAt: new Date() }).where(eq(telematicsAlert.id, id));
  }

  /** Latest telemetry point for a vehicle (drives the live map). */
  async latestTelemetry(vehicleId: string) {
    const rows = await this.db
      .select()
      .from(telemetry)
      .where(eq(telemetry.vehicleId, vehicleId))
      .orderBy(desc(telemetry.time))
      .limit(1);
    return rows[0];
  }

  /** Inserts a raw telemetry point (used by tests / the ingest path). */
  async insertTelemetry(values: typeof telemetry.$inferInsert) {
    await this.db.insert(telemetry).values(values);
  }

  transaction<T>(work: (tx: DrizzleDatabase) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }
}
