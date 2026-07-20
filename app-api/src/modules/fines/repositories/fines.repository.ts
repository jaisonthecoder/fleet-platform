import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, lt, ne, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import {
  accident,
  blackPoint,
  fine,
  recoveryRecord,
  substitutionWindow,
  vehicle,
} from '../../../common/database/schema';

type Executor = Pick<DrizzleDatabase, 'insert' | 'update'>;

/** Data access for the fines module (hides Drizzle). */
@Injectable()
export class FinesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  transaction<T>(work: (tx: DrizzleDatabase) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  async insertFine(values: typeof fine.$inferInsert, executor: Executor = this.db) {
    const rows = await executor.insert(fine).values(values).returning();
    return rows[0];
  }

  async findFine(id: string) {
    const rows = await this.db.select().from(fine).where(eq(fine.id, id)).limit(1);
    return rows[0];
  }

  async updateFine(id: string, set: Partial<typeof fine.$inferInsert>, executor: Executor = this.db) {
    const rows = await executor
      .update(fine)
      .set({ ...set, updatedAtUtc: new Date() })
      .where(eq(fine.id, id))
      .returning();
    return rows[0];
  }

  async listFines(limit = 50, offset = 0) {
    return this.db.select().from(fine).orderBy(desc(fine.eventTimeUtc)).limit(limit).offset(offset);
  }

  async insertAccident(values: typeof accident.$inferInsert) {
    const rows = await this.db.insert(accident).values(values).returning();
    return rows[0];
  }

  async insertBlackPoint(values: typeof blackPoint.$inferInsert, executor: Executor = this.db) {
    const rows = await executor.insert(blackPoint).values(values).returning();
    return rows[0];
  }

  async updateBlackPoint(id: string, set: Partial<typeof blackPoint.$inferInsert>) {
    await this.db.update(blackPoint).set({ ...set, updatedAtUtc: new Date() }).where(eq(blackPoint.id, id));
  }

  /** Open black points whose transfer deadline has passed (candidates for a platform block). */
  async findOverdueOpenBlackPoints(now: Date) {
    return this.db
      .select({ id: blackPoint.id, subjectPersonId: blackPoint.subjectPersonId, points: blackPoint.points })
      .from(blackPoint)
      .where(and(eq(blackPoint.transferStatus, 'Open'), ne(blackPoint.transferStatus, 'Transferred'), lt(blackPoint.transferDeadline, now)));
  }

  async insertRecovery(values: typeof recoveryRecord.$inferInsert, executor: Executor = this.db) {
    const rows = await executor.insert(recoveryRecord).values(values).returning();
    return rows[0];
  }

  /** True when a recovery instruction already exists for the fine (idempotence guard). */
  async hasRecovery(fineId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: recoveryRecord.id })
      .from(recoveryRecord)
      .where(eq(recoveryRecord.fineId, fineId))
      .limit(1);
    return rows.length > 0;
  }

  async insertSubstitutionWindow(values: typeof substitutionWindow.$inferInsert) {
    const rows = await this.db.insert(substitutionWindow).values(values).returning();
    return rows[0];
  }

  /** Substitution windows covering an instant for a vehicle ([start, end)). */
  async coveringSubstitutionWindows(vehicleId: string, at: Date) {
    return this.db
      .select({ substitutePersonId: substitutionWindow.substitutePersonId, start: substitutionWindow.windowStart, end: substitutionWindow.windowEnd })
      .from(substitutionWindow)
      .where(
        and(
          eq(substitutionWindow.vehicleId, vehicleId),
          sql`${substitutionWindow.windowStart} <= ${at.toISOString()}::timestamptz`,
          sql`${substitutionWindow.windowEnd} > ${at.toISOString()}::timestamptz`,
        ),
      );
  }

  /** The vehicle's assigned driver (the attribution fallback). */
  async findVehicle(id: string) {
    const rows = await this.db
      .select({ id: vehicle.id, assignedDriverPersonId: vehicle.assignedDriverPersonId })
      .from(vehicle)
      .where(eq(vehicle.id, id))
      .limit(1);
    return rows[0];
  }

  /** Count of fines attributed to a person since a cutoff (fines-per-user threshold). */
  async countFinesForPersonSince(personId: string, since: Date): Promise<number> {
    const rows = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(fine)
      .where(and(eq(fine.attributedPersonId, personId), gte(fine.eventTimeUtc, since)));
    return rows[0]?.n ?? 0;
  }
}
