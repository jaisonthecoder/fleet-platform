import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import {
  accessBlock,
  complianceItem,
  eligibilityEvaluation,
  person,
  vehicle,
  vehicleHierarchyAssignment,
} from '../../../common/database/schema';

/** Data access for the compliance / eligibility gate. */
@Injectable()
export class ComplianceRepository {
    /** Resolves an active Person only inside the authenticated organization. */
    async findPersonInOrganization(id: string, organizationId: string) {
      const rows = await this.db.select({ id: person.id }).from(person).where(and(eq(person.id, id), eq(person.organizationId, organizationId), eq(person.employmentStatus, 'Active'))).limit(1);
      return rows[0];
    }

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async findPerson(id: string, organizationId: string) {
    const rows = await this.db
      .select({
        id: person.id,
        licenceExpiry: person.licenceExpiry,
        licenceNumber: person.licenceNumber,
        licenceSource: person.licenceSource,
        licenceVerified: person.licenceVerified,
        lastHcmSyncedAt: person.lastHcmSyncedAt,
        employmentStatus: person.employmentStatus,
        updatedAtUtc: person.updatedAtUtc,
      })
      .from(person)
      .where(and(eq(person.id, id), eq(person.organizationId, organizationId)))
      .limit(1);
    return rows[0];
  }

  async findVehicle(id: string, organizationId: string) {
    const rows = await this.db
      .select({
        id: vehicle.id,
        mulkiyaExpiry: vehicle.mulkiyaExpiry,
        insuranceExpiry: vehicle.insuranceExpiry,
        lifecycleStatus: vehicle.lifecycleStatus,
        bookingPoolFlag: vehicle.bookingPoolFlag,
      })
      .from(vehicle)
      .where(and(eq(vehicle.id, id), eq(vehicle.organizationId, organizationId)))
      .limit(1);
    return rows[0];
  }

  async activeBlock(personId: string, organizationId: string) {
    const rows = await this.db
      .select()
      .from(accessBlock)
      .where(and(eq(accessBlock.organizationId, organizationId), eq(accessBlock.personId, personId), eq(accessBlock.active, true)))
      .limit(1);
    return rows[0];
  }

  /** Returns the Vehicle's current effective hierarchy scope in its organization. */
  async findVehicleScope(vehicleId: string, organizationId: string): Promise<string | null> {
    const rows = await this.db.select({ nodeId: vehicleHierarchyAssignment.nodeId })
      .from(vehicleHierarchyAssignment)
      .where(and(
        eq(vehicleHierarchyAssignment.organizationId, organizationId),
        eq(vehicleHierarchyAssignment.vehicleId, vehicleId),
        sql`${vehicleHierarchyAssignment.validFrom} <= now()`,
        sql`(${vehicleHierarchyAssignment.validTo} IS NULL OR ${vehicleHierarchyAssignment.validTo} > now())`,
      ))
      .orderBy(desc(vehicleHierarchyAssignment.validFrom))
      .limit(1);
    return rows[0]?.nodeId ?? null;
  }

  async insertEvaluation(values: typeof eligibilityEvaluation.$inferInsert) {
    await this.db.insert(eligibilityEvaluation).values(values);
  }

  async listExpiries(organizationId: string) {
    return this.db
      .select()
      .from(complianceItem)
      .where(and(eq(complianceItem.organizationId, organizationId), ne(complianceItem.status, 'Expired')))
      .orderBy(asc(complianceItem.expiryDate));
  }

  async listActiveBlocks(organizationId: string) {
    return this.db
      .select()
      .from(accessBlock)
      .where(and(eq(accessBlock.organizationId, organizationId), eq(accessBlock.active, true)))
      .orderBy(desc(accessBlock.blockedAtUtc));
  }

  async insertBlock(values: typeof accessBlock.$inferInsert) {
    const rows = await this.db.insert(accessBlock).values(values).returning();
    return rows[0];
  }

  async liftBlock(id: string, organizationId: string) {
    const rows = await this.db
      .update(accessBlock)
      .set({ active: false, liftedAtUtc: new Date() })
      .where(and(eq(accessBlock.id, id), eq(accessBlock.organizationId, organizationId), eq(accessBlock.active, true)))
      .returning({ id: accessBlock.id });
    return rows[0];
  }

  async insertComplianceItem(values: typeof complianceItem.$inferInsert) {
    const rows = await this.db.insert(complianceItem).values(values).returning();
    return rows[0];
  }
}
