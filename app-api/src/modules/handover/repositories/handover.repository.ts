import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import {
  booking,
  consentRecord,
  damagePin,
  handover,
  handoverAmendment,
  handoverCommandLedger,
  handoverEvidence,
  handoverInspectionItem,
  hierarchyNode,
  keyLog,
  person,
  vehicle,
  vehicleHierarchyAssignment,
} from '../../../common/database/schema';
import type { HandoverRegisterQuery } from '../../../contracts/handover.contract';

/** An executor that can write — the base db or an open transaction. */
type Executor = Pick<DrizzleDatabase, 'insert' | 'select' | 'update'>;

/** Data access for the handover module (hides Drizzle). */
@Injectable()
export class HandoverRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  transaction<T>(work: (tx: DrizzleDatabase) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  /** Returns one deterministic page of historical and open custody source facts. */
  async listRegister(
    organizationId: string,
    authorizedNodeIds: string[],
    query: HandoverRegisterQuery,
  ) {
    if (authorizedNodeIds.length === 0) return [];
    const filter = query.filter === 'OnTrip'
      ? eq(handover.phase, 'Handover')
      : query.filter === 'OnTime'
        ? sql`${handover.phase} = 'Returned' AND ${handover.lateReturn} = false AND ${handover.fuelDeviationFlagged} = false AND ${handover.odometerConflict} = false AND NOT EXISTS (SELECT 1 FROM fleet.damage_pin dp WHERE dp.handover_id = ${handover.id} AND dp.state = 'new')`
        : query.filter === 'ChargesDamage'
          ? sql`${handover.fuelDeviationFlagged} = true OR ${handover.odometerConflict} = true OR EXISTS (SELECT 1 FROM fleet.damage_pin dp WHERE dp.handover_id = ${handover.id} AND dp.state = 'new')`
          : undefined;
    return this.db
      .select({
        handoverId: handover.id,
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        driverName: person.fullName,
        vehicleId: vehicle.id,
        vehiclePlate: vehicle.plate,
        makeCode: vehicle.makeCode,
        modelCode: vehicle.modelCode,
        phase: handover.phase,
        issuedAtUtc: handover.handoverAtUtc,
        returnedAtUtc: handover.returnAtUtc,
        distanceKm: sql<string | null>`CASE WHEN ${handover.endOdometer} IS NULL OR ${handover.startOdometer} IS NULL THEN NULL ELSE (${handover.endOdometer} - ${handover.startOdometer})::text END`,
        lateReturn: handover.lateReturn,
        fuelDeviationFlagged: handover.fuelDeviationFlagged,
        odometerConflict: handover.odometerConflict,
        keyOutcome: handover.keyOutcome,
        newDamageCount: sql<number>`(SELECT count(*)::int FROM fleet.damage_pin dp WHERE dp.handover_id = ${handover.id} AND dp.state = 'new')`,
        activityAtUtc: sql<Date>`COALESCE(${handover.returnAtUtc}, ${handover.handoverAtUtc})`,
      })
      .from(handover)
      .innerJoin(booking, eq(booking.id, handover.bookingId))
      .innerJoin(vehicle, eq(vehicle.id, handover.vehicleId))
      .innerJoin(person, eq(person.id, handover.driverPersonId))
      .where(and(
        eq(handover.organizationId, organizationId),
        inArray(booking.bookingScopeNodeId, authorizedNodeIds),
        filter,
      ))
      .orderBy(desc(sql`COALESCE(${handover.returnAtUtc}, ${handover.handoverAtUtc})`), desc(handover.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  }

  /** Counts the same scoped register filter used by listRegister. */
  async countRegister(
    organizationId: string,
    authorizedNodeIds: string[],
    filterName: HandoverRegisterQuery['filter'],
  ): Promise<number> {
    if (authorizedNodeIds.length === 0) return 0;
    const filter = filterName === 'OnTrip'
      ? eq(handover.phase, 'Handover')
      : filterName === 'OnTime'
        ? sql`${handover.phase} = 'Returned' AND ${handover.lateReturn} = false AND ${handover.fuelDeviationFlagged} = false AND ${handover.odometerConflict} = false AND NOT EXISTS (SELECT 1 FROM fleet.damage_pin dp WHERE dp.handover_id = ${handover.id} AND dp.state = 'new')`
        : filterName === 'ChargesDamage'
          ? sql`${handover.fuelDeviationFlagged} = true OR ${handover.odometerConflict} = true OR EXISTS (SELECT 1 FROM fleet.damage_pin dp WHERE dp.handover_id = ${handover.id} AND dp.state = 'new')`
          : undefined;
    const rows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(handover)
      .innerJoin(booking, eq(booking.id, handover.bookingId))
      .where(and(
        eq(handover.organizationId, organizationId),
        inArray(booking.bookingScopeNodeId, authorizedNodeIds),
        filter,
      ));
    return rows[0]?.count ?? 0;
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

  /** Locks one organization-bound Handover for a revision-checked Return. */
  async findByIdForUpdate(id: string, organizationId: string, executor: DrizzleDatabase) {
    const rows = await executor
      .select()
      .from(handover)
      .where(and(eq(handover.id, id), eq(handover.organizationId, organizationId)))
      .limit(1)
      .for('update');
    return rows[0];
  }

  /** Resolves one active organization person used as a witnessed signer. */
  async findPersonInOrganization(personId: string, organizationId: string) {
    const rows = await this.db
      .select({ id: person.id })
      .from(person)
      .where(and(eq(person.id, personId), eq(person.organizationId, organizationId), eq(person.employmentStatus, 'Active')))
      .limit(1);
    return rows[0];
  }

  /** Captures event-time location identity so later hierarchy renames do not rewrite receipts. */
  async findLocationSnapshot(nodeId: string, organizationId: string) {
    const rows = await this.db
      .select({ id: hierarchyNode.id, code: hierarchyNode.code, name: hierarchyNode.name })
      .from(hierarchyNode)
      .where(and(eq(hierarchyNode.id, nodeId), eq(hierarchyNode.organizationId, organizationId), isNull(hierarchyNode.validTo)))
      .limit(1);
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
        approvalSuspendedAtUtc: booking.approvalSuspendedAtUtc,
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
      .innerJoin(consentRecord, and(
        eq(consentRecord.id, booking.consentRecordId),
        eq(consentRecord.bookingId, booking.id),
      ))
      .leftJoin(handover, eq(handover.bookingId, booking.id))
      .leftJoin(hierarchyNode, eq(hierarchyNode.id, booking.bookingScopeNodeId))
      .where(and(
        eq(booking.organizationId, organizationId),
        inArray(booking.bookingScopeNodeId, authorizedNodeIds),
        inArray(booking.status, ['Approved', 'Active']),
        sql`(${booking.status} = 'Active' OR ${booking.approvalSuspendedAtUtc} IS NULL)`,
      ))
      .orderBy(booking.pickupAtUtc)
      .limit(200);
  }

  /** Loads only persisted facts required to render one Handover/Return capture. */
  async findCaptureContext(bookingId: string, organizationId: string) {
    const rows = await this.db
      .select({
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        bookingRevision: booking.revision,
        bookingStatus: booking.status,
        approvalSuspendedAtUtc: booking.approvalSuspendedAtUtc,
        pickupAtUtc: booking.pickupAtUtc,
        returnAtUtc: booking.returnAtUtc,
        vehicleId: vehicle.id,
        vehiclePlate: vehicle.plate,
        makeCode: vehicle.makeCode,
        modelCode: vehicle.modelCode,
        gpsStatus: vehicle.gpsStatus,
        lastConfirmedOdometer: vehicle.lastConfirmedOdometer,
        driverPersonId: person.id,
        driverName: person.fullName,
        scopeNodeId: hierarchyNode.id,
        scopeName: hierarchyNode.name,
        consentVersion: consentRecord.consentDocumentVersion,
        consentSignedAtUtc: consentRecord.signedAtUtc,
        eligibilityDecision: sql<string | null>`(
          SELECT ee.decision FROM fleet.eligibility_evaluation ee
          WHERE ee.organization_id = ${organizationId}::uuid
            AND ee.driver_person_id = ${booking.driverPersonId}
            AND ee.vehicle_id = ${booking.vehicleId}
          ORDER BY ee.evaluated_at_utc DESC LIMIT 1
        )`,
        eligibilityReasons: sql<string[] | null>`(
          SELECT ee.reasons FROM fleet.eligibility_evaluation ee
          WHERE ee.organization_id = ${organizationId}::uuid
            AND ee.driver_person_id = ${booking.driverPersonId}
            AND ee.vehicle_id = ${booking.vehicleId}
          ORDER BY ee.evaluated_at_utc DESC LIMIT 1
        )`,
        eligibilityEvaluatedAtUtc: sql<Date | null>`(
          SELECT ee.evaluated_at_utc FROM fleet.eligibility_evaluation ee
          WHERE ee.organization_id = ${organizationId}::uuid
            AND ee.driver_person_id = ${booking.driverPersonId}
            AND ee.vehicle_id = ${booking.vehicleId}
          ORDER BY ee.evaluated_at_utc DESC LIMIT 1
        )`,
        handoverId: handover.id,
        handoverPhase: handover.phase,
        handoverRevision: handover.revision,
        handoverAtUtc: handover.handoverAtUtc,
        startOdometer: handover.startOdometer,
        startFuelEighths: handover.startFuelEighths,
        keyIssueRef: handover.keyIssueRef,
        releaseLocationNodeId: handover.releaseLocationNodeId,
        releaseLocationCode: handover.releaseLocationCode,
        releaseLocationName: handover.releaseLocationName,
      })
      .from(booking)
      .innerJoin(vehicle, eq(vehicle.id, booking.vehicleId))
      .innerJoin(person, eq(person.id, booking.driverPersonId))
      .innerJoin(hierarchyNode, eq(hierarchyNode.id, booking.bookingScopeNodeId))
      .innerJoin(consentRecord, eq(consentRecord.id, booking.consentRecordId))
      .leftJoin(handover, eq(handover.bookingId, booking.id))
      .where(and(eq(booking.id, bookingId), eq(booking.organizationId, organizationId)))
      .limit(1);
    return rows[0];
  }

  /** Returns unresolved physical marks for the Vehicle without prior Booking identity. */
  async listUnresolvedVehicleDamage(vehicleId: string) {
    return this.db
      .select({ pin: damagePin })
      .from(damagePin)
      .innerJoin(handover, eq(handover.id, damagePin.handoverId))
      .where(and(eq(handover.vehicleId, vehicleId), eq(damagePin.lifecycleStatus, 'Open')))
      .orderBy(asc(damagePin.atUtc), asc(damagePin.id));
  }

  /** Loads the Booking and event-time snapshots needed for a completion receipt. */
  async findReceiptContext(handoverId: string, organizationId: string) {
    const rows = await this.db
      .select({
        row: handover,
        bookingNumber: booking.bookingNumber,
        bookingStatus: booking.status,
      })
      .from(handover)
      .innerJoin(booking, eq(booking.id, handover.bookingId))
      .where(and(eq(handover.id, handoverId), eq(handover.organizationId, organizationId)))
      .limit(1);
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

  /** Persists one immutable versioned inspection result. */
  async insertInspection(values: typeof handoverInspectionItem.$inferInsert, executor: Executor) {
    const rows = await executor.insert(handoverInspectionItem).values(values).returning();
    return rows[0];
  }

  /** Lists inspection evidence in stable capture/code order. */
  async listInspections(handoverId: string, executor: Executor = this.db) {
    return executor
      .select()
      .from(handoverInspectionItem)
      .where(eq(handoverInspectionItem.handoverId, handoverId))
      .orderBy(asc(handoverInspectionItem.capturePhase), asc(handoverInspectionItem.itemCode));
  }

  /** Stages private evidence metadata after durable object storage succeeds. */
  async insertEvidence(values: typeof handoverEvidence.$inferInsert, executor: Executor = this.db) {
    const rows = await executor.insert(handoverEvidence).values(values).returning();
    return rows[0];
  }

  /** Loads evidence metadata in deterministic capture order. */
  async listEvidence(handoverId: string, executor: Executor = this.db) {
    return executor
      .select()
      .from(handoverEvidence)
      .where(eq(handoverEvidence.handoverId, handoverId))
      .orderBy(asc(handoverEvidence.stagedAtUtc), asc(handoverEvidence.id));
  }

  /** Loads caller-owned staged refs before an atomic Open/Return claim. */
  async findStagedEvidence(
    ids: string[],
    organizationId: string,
    uploadedByPersonId: string,
    executor: Executor = this.db,
  ) {
    if (ids.length === 0) return [];
    return executor
      .select()
      .from(handoverEvidence)
      .where(and(
        inArray(handoverEvidence.id, ids),
        eq(handoverEvidence.organizationId, organizationId),
        eq(handoverEvidence.uploadedByPersonId, uploadedByPersonId),
        eq(handoverEvidence.status, 'Staged'),
        sql`${handoverEvidence.expiresAtUtc} > now()`,
      ));
  }

  /** Claims verified staged refs inside the custody transaction. */
  async claimEvidence(ids: string[], handoverId: string, executor: Executor) {
    if (ids.length === 0) return [];
    return executor
      .update(handoverEvidence)
      .set({ status: 'Claimed', handoverId, claimedAtUtc: new Date(), updatedAtUtc: new Date() })
      .where(and(inArray(handoverEvidence.id, ids), eq(handoverEvidence.status, 'Staged')))
      .returning();
  }

  /** Marks expired unclaimed metadata for object-store cleanup reconciliation. */
  async expireUnclaimedEvidence(limit = 200) {
    const candidates = await this.db
      .select({ id: handoverEvidence.id })
      .from(handoverEvidence)
      .where(and(eq(handoverEvidence.status, 'Staged'), sql`${handoverEvidence.expiresAtUtc} <= now()`))
      .orderBy(handoverEvidence.expiresAtUtc)
      .limit(Math.max(1, Math.min(limit, 1000)));
    if (candidates.length === 0) return [];
    return this.db
      .update(handoverEvidence)
      .set({ status: 'Expired', updatedAtUtc: new Date() })
      .where(inArray(handoverEvidence.id, candidates.map(({ id }) => id)))
      .returning({ id: handoverEvidence.id, objectKey: handoverEvidence.objectKey });
  }

  /** Lists expired object keys for idempotent deletion retries. */
  async listExpiredEvidence(limit = 200) {
    return this.db
      .select({ id: handoverEvidence.id, objectKey: handoverEvidence.objectKey })
      .from(handoverEvidence)
      .where(eq(handoverEvidence.status, 'Expired'))
      .orderBy(handoverEvidence.expiresAtUtc, handoverEvidence.id)
      .limit(Math.max(1, Math.min(limit, 1000)));
  }

  /** Appends one optimistic correction record without mutating custody facts. */
  async insertAmendment(values: typeof handoverAmendment.$inferInsert, executor: Executor = this.db) {
    const rows = await executor.insert(handoverAmendment).values(values).returning();
    return rows[0];
  }

  /** Lists append-only corrections in revision order. */
  async listAmendments(handoverId: string, executor: Executor = this.db) {
    return executor
      .select()
      .from(handoverAmendment)
      .where(eq(handoverAmendment.handoverId, handoverId))
      .orderBy(asc(handoverAmendment.revision));
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

  /** Lists key custody events belonging to one Handover chain only. */
  async listHandoverKeys(handoverId: string, executor: Executor = this.db) {
    return executor
      .select()
      .from(keyLog)
      .where(eq(keyLog.handoverId, handoverId))
      .orderBy(asc(keyLog.atUtc), asc(keyLog.id));
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
        sql`${vehicleHierarchyAssignment.validFrom} <= now()`,
        sql`(${vehicleHierarchyAssignment.validTo} IS NULL OR ${vehicleHierarchyAssignment.validTo} > now())`,
      ))
      .orderBy(desc(vehicleHierarchyAssignment.validFrom))
      .limit(1);
    return rows[0]?.nodeId ?? null;
  }
}
