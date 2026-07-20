import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import {
  vehicle,
  vehicleDocument,
  vehicleHierarchyAssignment,
  vehicleLifecycleHistory,
  vehicleTransfer,
} from '../../../common/database/schema';

/** An executor that can insert — the base db or an open transaction. */
type Executor = Pick<DrizzleDatabase, 'insert' | 'update'>;

/** Data access for the vehicle master (hides Drizzle). */
@Injectable()
export class VehicleRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async insert(values: typeof vehicle.$inferInsert, executor: Executor = this.db) {
    const rows = await executor.insert(vehicle).values(values).returning();
    return rows[0];
  }

  async findById(id: string) {
    const rows = await this.db.select().from(vehicle).where(eq(vehicle.id, id)).limit(1);
    return rows[0];
  }

  async list(limit = 50, offset = 0, organizationId?: string) {
    return this.db
      .select()
      .from(vehicle)
      .where(organizationId ? eq(vehicle.organizationId, organizationId) : undefined)
      .orderBy(desc(vehicle.createdAtUtc))
      .limit(limit)
      .offset(offset);
  }

  async update(id: string, set: Partial<typeof vehicle.$inferInsert>, executor: Executor = this.db) {
    const rows = await executor
      .update(vehicle)
      .set({ ...set, updatedAtUtc: new Date() })
      .where(eq(vehicle.id, id))
      .returning();
    return rows[0];
  }

  async insertHistory(values: typeof vehicleLifecycleHistory.$inferInsert, executor: Executor = this.db) {
    await executor.insert(vehicleLifecycleHistory).values(values);
  }

  async listHistory(vehicleId: string) {
    return this.db
      .select()
      .from(vehicleLifecycleHistory)
      .where(eq(vehicleLifecycleHistory.vehicleId, vehicleId))
      .orderBy(desc(vehicleLifecycleHistory.atUtc));
  }

  /** Next version number for a document type on a vehicle (versioned vault). */
  async nextDocumentVersion(vehicleId: string, docTypeCode: string): Promise<number> {
    const rows = await this.db
      .select({ version: vehicleDocument.version })
      .from(vehicleDocument)
      .where(
        and(
          eq(vehicleDocument.vehicleId, vehicleId),
          eq(vehicleDocument.docTypeCode, docTypeCode),
        ),
      )
      .orderBy(desc(vehicleDocument.version))
      .limit(1);
    return (rows[0]?.version ?? 0) + 1;
  }

  async insertDocument(values: typeof vehicleDocument.$inferInsert) {
    const rows = await this.db.insert(vehicleDocument).values(values).returning();
    return rows[0];
  }

  async insertTransfer(values: typeof vehicleTransfer.$inferInsert, executor: Executor = this.db) {
    const rows = await executor.insert(vehicleTransfer).values(values).returning();
    return rows[0];
  }

  /** The currently-active hierarchy assignment for a vehicle, if any. */
  async activeAssignment(vehicleId: string) {
    const rows = await this.db
      .select()
      .from(vehicleHierarchyAssignment)
      .where(
        and(
          eq(vehicleHierarchyAssignment.vehicleId, vehicleId),
          isNull(vehicleHierarchyAssignment.validTo),
        ),
      )
      .limit(1);
    return rows[0];
  }

  async expireAssignment(id: string, executor: Executor = this.db, at: Date = new Date()) {
    await executor
      .update(vehicleHierarchyAssignment)
      .set({ validTo: at, updatedAtUtc: new Date() })
      .where(eq(vehicleHierarchyAssignment.id, id));
  }

  async insertAssignment(
    values: typeof vehicleHierarchyAssignment.$inferInsert,
    executor: Executor = this.db,
  ) {
    await executor.insert(vehicleHierarchyAssignment).values(values);
  }

  /** Runs a set of writes in one transaction (state + history + outbox atomicity). */
  transaction<T>(work: (tx: DrizzleDatabase) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }
}
