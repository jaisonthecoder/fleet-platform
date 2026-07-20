import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ne } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import {
  accessBlock,
  complianceItem,
  eligibilityEvaluation,
  person,
  vehicle,
} from '../../../common/database/schema';

/** Data access for the compliance / eligibility gate. */
@Injectable()
export class ComplianceRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async findPerson(id: string) {
    const rows = await this.db
      .select({
        id: person.id,
        licenceExpiry: person.licenceExpiry,
        employmentStatus: person.employmentStatus,
        updatedAtUtc: person.updatedAtUtc,
      })
      .from(person)
      .where(eq(person.id, id))
      .limit(1);
    return rows[0];
  }

  async findVehicle(id: string) {
    const rows = await this.db
      .select({
        id: vehicle.id,
        mulkiyaExpiry: vehicle.mulkiyaExpiry,
        insuranceExpiry: vehicle.insuranceExpiry,
        lifecycleStatus: vehicle.lifecycleStatus,
        bookingPoolFlag: vehicle.bookingPoolFlag,
      })
      .from(vehicle)
      .where(eq(vehicle.id, id))
      .limit(1);
    return rows[0];
  }

  async activeBlock(personId: string) {
    const rows = await this.db
      .select()
      .from(accessBlock)
      .where(and(eq(accessBlock.personId, personId), eq(accessBlock.active, true)))
      .limit(1);
    return rows[0];
  }

  async insertEvaluation(values: typeof eligibilityEvaluation.$inferInsert) {
    await this.db.insert(eligibilityEvaluation).values(values);
  }

  async listExpiries() {
    return this.db
      .select()
      .from(complianceItem)
      .where(ne(complianceItem.status, 'Expired'))
      .orderBy(asc(complianceItem.expiryDate));
  }

  async listActiveBlocks() {
    return this.db
      .select()
      .from(accessBlock)
      .where(eq(accessBlock.active, true))
      .orderBy(desc(accessBlock.blockedAtUtc));
  }

  async insertBlock(values: typeof accessBlock.$inferInsert) {
    const rows = await this.db.insert(accessBlock).values(values).returning();
    return rows[0];
  }

  async liftBlock(id: string) {
    await this.db
      .update(accessBlock)
      .set({ active: false, liftedAtUtc: new Date() })
      .where(eq(accessBlock.id, id));
  }

  async insertComplianceItem(values: typeof complianceItem.$inferInsert) {
    const rows = await this.db.insert(complianceItem).values(values).returning();
    return rows[0];
  }
}
