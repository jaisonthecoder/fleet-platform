import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import { damagePin, handover, keyLog, vehicle } from '../../../common/database/schema';

/** An executor that can write — the base db or an open transaction. */
type Executor = Pick<DrizzleDatabase, 'insert' | 'update'>;

/** Data access for the handover module (hides Drizzle). */
@Injectable()
export class HandoverRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  transaction<T>(work: (tx: DrizzleDatabase) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  async insert(values: typeof handover.$inferInsert, executor: Executor = this.db) {
    const rows = await executor.insert(handover).values(values).returning();
    return rows[0];
  }

  async findById(id: string) {
    const rows = await this.db.select().from(handover).where(eq(handover.id, id)).limit(1);
    return rows[0];
  }

  async findByBooking(bookingId: string) {
    const rows = await this.db.select().from(handover).where(eq(handover.bookingId, bookingId)).limit(1);
    return rows[0];
  }

  async update(id: string, set: Partial<typeof handover.$inferInsert>, executor: Executor = this.db) {
    const rows = await executor
      .update(handover)
      .set({ ...set, updatedAtUtc: new Date() })
      .where(eq(handover.id, id))
      .returning();
    return rows[0];
  }

  async insertDamage(values: typeof damagePin.$inferInsert, executor: Executor = this.db) {
    const rows = await executor.insert(damagePin).values(values).returning();
    return rows[0];
  }

  async listDamage(handoverId: string) {
    return this.db
      .select()
      .from(damagePin)
      .where(eq(damagePin.handoverId, handoverId))
      .orderBy(desc(damagePin.atUtc));
  }

  async insertKeyLog(values: typeof keyLog.$inferInsert, executor: Executor = this.db) {
    await executor.insert(keyLog).values(values);
  }

  async listKeys(vehicleId: string) {
    return this.db
      .select()
      .from(keyLog)
      .where(eq(keyLog.vehicleId, vehicleId))
      .orderBy(desc(keyLog.atUtc));
  }

  /** The fuel/odometer slice of a vehicle used at return reconciliation. */
  async findVehicle(id: string) {
    const rows = await this.db
      .select({
        id: vehicle.id,
        fuelEfficiencyKmpl: vehicle.fuelEfficiencyKmpl,
        lastConfirmedOdometer: vehicle.lastConfirmedOdometer,
      })
      .from(vehicle)
      .where(eq(vehicle.id, id))
      .limit(1);
    return rows[0];
  }
}
