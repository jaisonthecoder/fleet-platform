import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import {
  leaseContract,
  vendor,
  vendorDocument,
  vendorOnboardingProfile,
  vehicle,
  vehicleLifecycleHistory,
} from '../../../common/database/schema';

/** An executor that can write — the base db or an open transaction. */
type Executor = Pick<DrizzleDatabase, 'insert' | 'update'>;

/** Data access for the vendor master and lease contracts (hides Drizzle). */
@Injectable()
export class VendorRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  // --- vendor ---

  async insertVendor(
    values: typeof vendor.$inferInsert,
    executor: Executor = this.db,
  ) {
    const rows = await executor.insert(vendor).values(values).returning();
    return rows[0];
  }

  async findVendorById(id: string, organizationId: string) {
    const rows = await this.db
      .select()
      .from(vendor)
      .where(and(eq(vendor.id, id), eq(vendor.organizationId, organizationId)))
      .limit(1);
    return rows[0];
  }

  async listVendors(
    limit = 50,
    offset = 0,
    organizationId?: string,
    status?: string,
  ) {
    return this.db
      .select()
      .from(vendor)
      .where(
        and(
          organizationId
            ? eq(vendor.organizationId, organizationId)
            : undefined,
          status ? eq(vendor.status, status as never) : undefined,
        ),
      )
      .orderBy(desc(vendor.createdAtUtc))
      .limit(limit)
      .offset(offset);
  }

  async updateVendor(
    id: string,
    set: Partial<typeof vendor.$inferInsert>,
    executor: Executor = this.db,
    organizationId: string,
  ) {
    const rows = await executor
      .update(vendor)
      .set({ ...set, updatedAtUtc: new Date() })
      .where(and(eq(vendor.id, id), eq(vendor.organizationId, organizationId)))
      .returning();
    return rows[0];
  }

  /** Finds the persisted onboarding defaults for one Vendor in its organization. */
  async findOnboardingProfile(vendorId: string, organizationId: string) {
    const rows = await this.db
      .select()
      .from(vendorOnboardingProfile)
      .where(
        and(
          eq(vendorOnboardingProfile.vendorId, vendorId),
          eq(vendorOnboardingProfile.organizationId, organizationId),
        ),
      )
      .limit(1);
    return rows[0];
  }

  /** Creates or updates reusable Vendor onboarding defaults atomically. */
  async upsertOnboardingProfile(
    values: typeof vendorOnboardingProfile.$inferInsert,
    executor: Executor = this.db,
  ) {
    const rows = await executor
      .insert(vendorOnboardingProfile)
      .values(values)
      .onConflictDoUpdate({
        target: vendorOnboardingProfile.vendorId,
        set: {
          standardOffHireNoticeDays: values.standardOffHireNoticeDays,
          earlyTerminationPenalty: values.earlyTerminationPenalty,
          renewalOptions: values.renewalOptions,
          escalationClause: values.escalationClause,
          replacementClause: values.replacementClause,
          alertLadder: values.alertLadder,
          accessMode: values.accessMode,
          updatedAtUtc: new Date(),
        },
      })
      .returning();
    return rows[0];
  }

  // --- lease contract ---

  async insertLease(
    values: typeof leaseContract.$inferInsert,
    executor: Executor = this.db,
  ) {
    const rows = await executor
      .insert(leaseContract)
      .values(values)
      .returning();
    return rows[0];
  }

  async findLeaseById(id: string, organizationId: string) {
    const rows = await this.db
      .select()
      .from(leaseContract)
      .where(
        and(
          eq(leaseContract.id, id),
          eq(leaseContract.organizationId, organizationId),
        ),
      )
      .limit(1);
    return rows[0];
  }

  async listLeases(
    limit = 50,
    offset = 0,
    organizationId?: string,
    vendorId?: string,
  ) {
    return this.db
      .select()
      .from(leaseContract)
      .where(
        and(
          organizationId
            ? eq(leaseContract.organizationId, organizationId)
            : undefined,
          vendorId ? eq(leaseContract.vendorId, vendorId) : undefined,
        ),
      )
      .orderBy(desc(leaseContract.createdAtUtc))
      .limit(limit)
      .offset(offset);
  }

  async updateLease(
    id: string,
    set: Partial<typeof leaseContract.$inferInsert>,
    executor: Executor = this.db,
    organizationId: string,
  ) {
    const rows = await executor
      .update(leaseContract)
      .set({ ...set, updatedAtUtc: new Date() })
      .where(
        and(
          eq(leaseContract.id, id),
          eq(leaseContract.organizationId, organizationId),
        ),
      )
      .returning();
    return rows[0];
  }

  /** Lists leased Vehicles with the current health of both governed dependencies. */
  async listLinkedVehicleHealth(
    executor: DrizzleDatabase = this.db,
    organizationId?: string,
    vendorId?: string,
    leaseId?: string,
  ) {
    return executor
      .select({
        vehicle,
        vendorStatus: vendor.status,
        leaseStatus: leaseContract.status,
        leaseEndDate: leaseContract.endDate,
      })
      .from(vehicle)
      .innerJoin(
        vendor,
        and(
          eq(vehicle.organizationId, vendor.organizationId),
          eq(vehicle.vendorId, vendor.id),
        ),
      )
      .innerJoin(
        leaseContract,
        and(
          eq(vehicle.organizationId, leaseContract.organizationId),
          eq(vehicle.leaseContractId, leaseContract.id),
        ),
      )
      .where(
        and(
          eq(vehicle.ownership, 'Leased'),
          organizationId
            ? eq(vehicle.organizationId, organizationId)
            : undefined,
          vendorId || leaseId
            ? or(
                vendorId ? eq(vehicle.vendorId, vendorId) : undefined,
                leaseId ? eq(vehicle.leaseContractId, leaseId) : undefined,
              )
            : undefined,
        ),
      );
  }

  /** Updates one linked Vehicle only within its owning organization. */
  async updateLinkedVehicle(
    id: string,
    organizationId: string,
    set: Partial<typeof vehicle.$inferInsert>,
    executor: Executor = this.db,
  ) {
    const rows = await executor
      .update(vehicle)
      .set({ ...set, updatedAtUtc: new Date() })
      .where(
        and(eq(vehicle.id, id), eq(vehicle.organizationId, organizationId)),
      )
      .returning();
    return rows[0];
  }

  /** Appends operational health-hold evidence to Vehicle history. */
  async insertVehicleHealthHistory(
    values: typeof vehicleLifecycleHistory.$inferInsert,
    executor: Executor = this.db,
  ): Promise<void> {
    await executor.insert(vehicleLifecycleHistory).values(values);
  }

  /** Serializes global scheduled reconciliation across API replicas. */
  async acquireVehicleHealthLock(executor: DrizzleDatabase): Promise<void> {
    await executor.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('vendor-vehicle-health-reconcile'))`,
    );
  }

  // --- vendor documents ---

  /** Returns all versions for one Vendor, newest first. */
  async listDocuments(vendorId: string, organizationId: string) {
    return this.db
      .select()
      .from(vendorDocument)
      .where(
        and(
          eq(vendorDocument.vendorId, vendorId),
          eq(vendorDocument.organizationId, organizationId),
        ),
      )
      .orderBy(
        desc(vendorDocument.documentTypeCode),
        desc(vendorDocument.version),
      );
  }

  /** Finds one Vendor document only inside its organization and Vendor parent. */
  async findDocumentById(id: string, vendorId: string, organizationId: string) {
    const rows = await this.db
      .select()
      .from(vendorDocument)
      .where(
        and(
          eq(vendorDocument.id, id),
          eq(vendorDocument.vendorId, vendorId),
          eq(vendorDocument.organizationId, organizationId),
        ),
      )
      .limit(1);
    return rows[0];
  }

  /** Allocates the next version number inside the caller's transaction. */
  async nextDocumentVersion(
    vendorId: string,
    documentTypeCode: string,
    organizationId: string,
    executor: DrizzleDatabase = this.db,
  ): Promise<number> {
    const rows = await executor
      .select({
        version: sql<number>`coalesce(max(${vendorDocument.version}), 0)::int`,
      })
      .from(vendorDocument)
      .where(
        and(
          eq(vendorDocument.vendorId, vendorId),
          eq(vendorDocument.documentTypeCode, documentTypeCode),
          eq(vendorDocument.organizationId, organizationId),
        ),
      );
    return (rows[0]?.version ?? 0) + 1;
  }

  /** Inserts one immutable Vendor document version. */
  async insertDocument(
    values: typeof vendorDocument.$inferInsert,
    executor: Executor = this.db,
  ) {
    const rows = await executor
      .insert(vendorDocument)
      .values(values)
      .returning();
    return rows[0];
  }

  /** Updates only the lifecycle/evidence fields allowed by the service. */
  async updateDocument(
    id: string,
    organizationId: string,
    set: Partial<typeof vendorDocument.$inferInsert>,
    executor: Executor = this.db,
    expectedStatuses?: Array<typeof vendorDocument.$inferSelect.status>,
  ) {
    const rows = await executor
      .update(vendorDocument)
      .set({ ...set, updatedAtUtc: new Date() })
      .where(
        and(
          eq(vendorDocument.id, id),
          eq(vendorDocument.organizationId, organizationId),
          expectedStatuses
            ? inArray(vendorDocument.status, expectedStatuses)
            : undefined,
        ),
      )
      .returning();
    return rows[0];
  }

  /** Finds the current confirmed version for a Vendor document type. */
  async currentConfirmedDocument(
    vendorId: string,
    documentTypeCode: string,
    organizationId: string,
    excludeId?: string,
    executor: DrizzleDatabase = this.db,
  ) {
    const rows = await executor
      .select()
      .from(vendorDocument)
      .where(
        and(
          eq(vendorDocument.vendorId, vendorId),
          eq(vendorDocument.documentTypeCode, documentTypeCode),
          eq(vendorDocument.organizationId, organizationId),
          eq(vendorDocument.status, 'Confirmed'),
          excludeId ? ne(vendorDocument.id, excludeId) : undefined,
        ),
      )
      .limit(1);
    return rows[0];
  }

  /** Finds the confirmed version currently pointing at a replacement version. */
  async predecessorDocument(
    replacementId: string,
    organizationId: string,
    executor: DrizzleDatabase = this.db,
  ) {
    const rows = await executor
      .select()
      .from(vendorDocument)
      .where(
        and(
          eq(vendorDocument.supersededById, replacementId),
          eq(vendorDocument.organizationId, organizationId),
          eq(vendorDocument.status, 'Confirmed'),
        ),
      )
      .limit(1);
    return rows[0];
  }

  /** Runs a set of writes in one transaction (state + audit + outbox atomicity). */
  transaction<T>(work: (tx: DrizzleDatabase) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }
}
