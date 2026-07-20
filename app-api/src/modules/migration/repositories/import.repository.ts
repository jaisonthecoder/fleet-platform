import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import {
  dedupCandidate,
  importBatch,
  importRow,
  vehicle,
} from '../../../common/database/schema';

/** Data access for the migration import pipeline. */
@Injectable()
export class ImportRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async insertBatch(values: typeof importBatch.$inferInsert) {
    const rows = await this.db.insert(importBatch).values(values).returning();
    return rows[0];
  }

  async insertRows(rows: (typeof importRow.$inferInsert)[]) {
    return this.db.insert(importRow).values(rows).returning();
  }

  async findBatch(id: string) {
    const rows = await this.db.select().from(importBatch).where(eq(importBatch.id, id)).limit(1);
    return rows[0];
  }

  async listRows(batchId: string) {
    return this.db.select().from(importRow).where(eq(importRow.batchId, batchId));
  }

  async findRow(id: string) {
    const rows = await this.db.select().from(importRow).where(eq(importRow.id, id)).limit(1);
    return rows[0];
  }

  async updateRow(id: string, set: Partial<typeof importRow.$inferInsert>) {
    await this.db.update(importRow).set(set).where(eq(importRow.id, id));
  }

  async updateBatch(id: string, set: Partial<typeof importBatch.$inferInsert>) {
    await this.db.update(importBatch).set(set).where(eq(importBatch.id, id));
  }

  async insertDedup(values: typeof dedupCandidate.$inferInsert) {
    await this.db.insert(dedupCandidate).values(values);
  }

  /** Existing plates + VINs in the vehicle master (for uniqueness checks). */
  async existingIdentifiers(): Promise<{ plates: Set<string>; vins: Set<string> }> {
    const rows = await this.db
      .select({ plate: vehicle.plate, vin: vehicle.chassisVin })
      .from(vehicle);
    return {
      plates: new Set(rows.map((r) => r.plate)),
      vins: new Set(rows.map((r) => r.vin)),
    };
  }
}
