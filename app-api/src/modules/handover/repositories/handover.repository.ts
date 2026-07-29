import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import { booking, damagePin, handover, handoverCommandLedger, hierarchyNode, keyLog, person, vehicle, vehicleHierarchyAssignment } from '../../../common/database/schema';

/** An executor that can write — the base db or an open transaction. */
type Executor = Pick<DrizzleDatabase, 'insert' | 'select' | 'update'>;

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

  async findByIdInOrganization(id: string, organizationId: string) {
    const rows = await this.db.select().from(handover).where(and(eq(handover.id, id), eq(handover.organizationId, organizationId))).limit(1);
    return rows[0];
  }

  async findByBooking(bookingId: string, organizationId?: string) {
    const rows = await this.db.select().from(handover).where(and(
      eq(handover.bookingId, bookingId),
      ...(organizationId ? [eq(handover.organizationId, organizationId)] : []),
    )).limit(1);
    return rows[0];
  }

  async findCommand(organizationId: string, actorPersonId: string, commandType: string, idempotencyKey: string) {
    const rows = await this.db.select().from(handoverCommandLedger).where(and(
      eq(handoverCommandLedger.organizationId, organizationId),
      eq(handoverCommandLedger.actorPersonId, actorPersonId),
      eq(handoverCommandLedger.commandType, commandType),
      eq(handoverCommandLedger.idempotencyKey, idempotencyKey),
    )).limit(1);
    return rows[0];
  }

  async claimCommand(values: typeof handoverCommandLedger.$inferInsert, executor: Executor) {
    const rows = await executor.insert(handoverCommandLedger).values(values).onConflictDoNothing().returning();
    return rows[0];
  }

  async completeCommand(id: string, resultHandoverId: string, resultBody: unknown, executor: Executor) {
    await executor.update(handoverCommandLedger).set({ resultHandoverId, resultBody, updatedAtUtc: new Date() }).where(eq(handoverCommandLedger.id, id));
  }

  /** Lists Approved releases and Active custody inside authorized hierarchy scopes. */
  async listWorklist(organizationId: string, authorizedNodeIds: string[]) {
    if (authorizedNodeIds.length === 0) return [];
    return this.db
      .select({
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        handoverId: handover.id,
        bookingStatus: booking.status,
        vehicleId: booking.vehicleId,
        vehiclePlate: vehicle.plate,
        driverPersonId: booking.driverPersonId,
        driverName: person.fullName,
        pickupAtUtc: booking.pickupAtUtc,
        returnAtUtc: booking.returnAtUtc,
        scopeName: hierarchyNode.name,
      })
      .from(booking)
      .innerJoin(vehicle, eq(vehicle.id, booking.vehicleId))
      .innerJoin(person, eq(person.id, booking.driverPersonId))
      .leftJoin(handover, eq(handover.bookingId, booking.id))
      .leftJoin(hierarchyNode, eq(hierarchyNode.id, booking.bookingScopeNodeId))
      .where(and(
        eq(booking.organizationId, organizationId),
        inArray(booking.bookingScopeNodeId, authorizedNodeIds),
        inArray(booking.status, ['Approved', 'Active']),
      ))
      .orderBy(booking.pickupAtUtc)
      .limit(200);
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

  async listDamage(handoverId: string, executor: Executor = this.db) {
    return executor
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

  /** Returns the Vehicle's active hierarchy scope for Fleet authorization. */
  async findVehicleScope(vehicleId: string, organizationId: string): Promise<string | null> {
    const rows = await this.db
      .select({ nodeId: vehicleHierarchyAssignment.nodeId })
      .from(vehicle)
      .innerJoin(vehicleHierarchyAssignment, eq(vehicleHierarchyAssignment.vehicleId, vehicle.id))
      .where(and(
        eq(vehicle.id, vehicleId),
        eq(vehicle.organizationId, organizationId),
        isNull(vehicleHierarchyAssignment.validTo),
      ))
      .orderBy(desc(vehicleHierarchyAssignment.validFrom))
      .limit(1);
    return rows[0]?.nodeId ?? null;
  }
}
