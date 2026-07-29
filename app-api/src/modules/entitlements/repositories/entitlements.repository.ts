import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import type { PlatformRole } from '../../../common/database/schema';
import {
  bsdReturnWindow,
  entitlementCommandLedger,
  entitlementEligibilityPreview,
  entitlementAllocation,
  entitlementEvent,
  entitlementRequest,
  hierarchyNode,
  person,
  roleAssignment,
  vehicle,
  vehicleHierarchyAssignment,
  workflowInstance,
  workflowStep,
} from '../../../common/database/schema';

/** An executor that can write — the base db or an open transaction. */
type Executor = Pick<DrizzleDatabase, 'insert' | 'select' | 'update' | 'execute'>;

/** Data access for the entitlements module (hides Drizzle). */
@Injectable()
export class EntitlementsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  /** Lists active professional drivers whose editable role scope covers a location. */
  async listProfessionalDrivers(organizationId: string, locationNodeId: string) {
    return this.db
      .selectDistinct({
        personId: person.id,
        fullName: person.fullName,
        employeeId: person.hcmEmployeeId,
        scopeName: hierarchyNode.name,
      })
      .from(person)
      .innerJoin(roleAssignment, and(
        eq(roleAssignment.personId, person.id),
        eq(roleAssignment.role, 'ProfessionalDriver'),
        sql`${roleAssignment.validFrom} <= now()`,
        sql`(${roleAssignment.validTo} IS NULL OR ${roleAssignment.validTo} >= now())`,
      ))
      .innerJoin(hierarchyNode, eq(hierarchyNode.id, roleAssignment.scopeNodeId))
      .where(and(
        eq(person.organizationId, organizationId),
        eq(person.employmentStatus, 'Active'),
        sql`EXISTS (
          SELECT 1 FROM fleet.hierarchy_node target
          WHERE target.id = ${locationNodeId}::uuid
            AND target.organization_id = ${organizationId}::uuid
            AND target.path <@ ${hierarchyNode.path}
        )`,
      ))
      .orderBy(asc(person.fullName));
  }

  transaction<T>(work: (tx: DrizzleDatabase) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  /** Serializes BSD activation/restoration cycles across API replicas. */
  withBsdCycleLock<T>(work: (tx: DrizzleDatabase) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('entitlement-bsd-cycle'))`);
      return work(tx);
    });
  }

  async insert(values: typeof entitlementRequest.$inferInsert, executor: Executor = this.db) {
    const rows = await executor.insert(entitlementRequest).values(values).returning();
    return rows[0];
  }

  async findById(id: string) {
    const rows = await this.db.select().from(entitlementRequest).where(eq(entitlementRequest.id, id)).limit(1);
    return rows[0];
  }

  async findByIdInOrganization(id: string, organizationId: string) {
    const rows = await this.db
      .select()
      .from(entitlementRequest)
      .where(and(eq(entitlementRequest.id, id), eq(entitlementRequest.organizationId, organizationId)))
      .limit(1);
    return rows[0];
  }

  /** Privacy-minimized read-only inconsistency projection for one organization. */
  async listReconciliationFindings(organizationId: string, limit: number) {
    return this.db.execute(sql`
      WITH findings AS (
        SELECT 'terminal-entitlement-active-allocation'::text AS reason_code,
               entitlement.id AS entitlement_id, allocation.vehicle_id, allocation.id AS related_id
        FROM fleet.entitlement_request entitlement
        JOIN fleet.entitlement_allocation allocation
          ON allocation.entitlement_request_id = entitlement.id
          AND allocation.organization_id = entitlement.organization_id
          AND allocation.status = 'Active'
        WHERE entitlement.organization_id = ${organizationId}::uuid
          AND entitlement.status IN ('Returned', 'Declined', 'Cancelled', 'Expired')

        UNION ALL

        SELECT 'allocated-entitlement-missing-active-allocation', entitlement.id, entitlement.vehicle_id, NULL::uuid
        FROM fleet.entitlement_request entitlement
        WHERE entitlement.organization_id = ${organizationId}::uuid
          AND entitlement.status = 'Allocated'
          AND NOT EXISTS (
            SELECT 1 FROM fleet.entitlement_allocation allocation
            WHERE allocation.entitlement_request_id = entitlement.id AND allocation.status = 'Active'
          )

        UNION ALL

        SELECT 'dedicated-vehicle-pool-outside-active-bsd', entitlement.id, vehicle.id, NULL::uuid
        FROM fleet.entitlement_request entitlement
        JOIN fleet.entitlement_allocation allocation
          ON allocation.entitlement_request_id = entitlement.id
          AND allocation.organization_id = entitlement.organization_id
          AND allocation.status = 'Active'
        JOIN fleet.vehicle vehicle ON vehicle.id = allocation.vehicle_id
        WHERE entitlement.organization_id = ${organizationId}::uuid
          AND entitlement.status = 'Allocated'
          AND vehicle.assignment_model = 'Pool' AND vehicle.booking_pool_flag = true
          AND NOT EXISTS (
            SELECT 1 FROM fleet.bsd_return_window bsd
            WHERE bsd.entitlement_request_id = entitlement.id AND bsd.status = 'Active'
          )

        UNION ALL

        SELECT 'open-bsd-window-missing-active-allocation', bsd.entitlement_request_id, bsd.vehicle_id, bsd.id
        FROM fleet.bsd_return_window bsd
        WHERE bsd.organization_id = ${organizationId}::uuid
          AND bsd.status IN ('Active', 'Conflict')
          AND NOT EXISTS (
            SELECT 1 FROM fleet.entitlement_allocation allocation
            WHERE allocation.entitlement_request_id = bsd.entitlement_request_id
              AND allocation.organization_id = bsd.organization_id
              AND allocation.status = 'Active'
          )

        UNION ALL

        SELECT 'renewal-predecessor-invalid', renewal.id, renewal.vehicle_id, renewal.renewed_from_entitlement_id
        FROM fleet.entitlement_request renewal
        LEFT JOIN fleet.entitlement_request predecessor ON predecessor.id = renewal.renewed_from_entitlement_id
        WHERE renewal.organization_id = ${organizationId}::uuid
          AND renewal.renewed_from_entitlement_id IS NOT NULL
          AND (predecessor.id IS NULL OR predecessor.organization_id <> renewal.organization_id)

        UNION ALL

        SELECT 'referenced-eligibility-preview-missing', entitlement.id, entitlement.vehicle_id, entitlement.eligibility_preview_id
        FROM fleet.entitlement_request entitlement
        LEFT JOIN fleet.entitlement_eligibility_preview preview ON preview.id = entitlement.eligibility_preview_id
        WHERE entitlement.organization_id = ${organizationId}::uuid
          AND entitlement.eligibility_preview_id IS NOT NULL AND preview.id IS NULL
      )
      SELECT reason_code AS "reasonCode", entitlement_id AS "entitlementId",
             vehicle_id AS "vehicleId", related_id AS "relatedId"
      FROM findings
      ORDER BY reason_code, entitlement_id
      LIMIT ${limit}
    `) as unknown as Array<{
      reasonCode: string;
      entitlementId: string;
      vehicleId: string | null;
      relatedId: string | null;
    }>;
  }

  /** Aggregates only persisted, organization-scoped operational evidence. */
  async entitlementMetrics(organizationId: string) {
    const rows = await this.db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM fleet.entitlement_request WHERE organization_id = ${organizationId}::uuid AND eligibility_result->>'decision' = 'ALLOW') AS "eligibilityAllow",
        (SELECT count(*)::int FROM fleet.entitlement_request WHERE organization_id = ${organizationId}::uuid AND eligibility_result->>'decision' = 'DENY') AS "eligibilityDeny",
        (SELECT count(*)::int FROM fleet.workflow_step step JOIN fleet.workflow_instance instance ON instance.id = step.workflow_instance_id WHERE instance.organization_id = ${organizationId}::uuid AND instance.workflow_type = 'entitlement-approval' AND step.decision IS NULL AND step.due_at_utc < now()) AS "approvalOverdue",
        (SELECT count(*)::int FROM fleet.workflow_step step JOIN fleet.workflow_instance instance ON instance.id = step.workflow_instance_id WHERE instance.organization_id = ${organizationId}::uuid AND instance.workflow_type = 'entitlement-approval' AND step.escalated_at_utc IS NOT NULL) AS "approvalEscalated",
        (SELECT count(*)::int FROM fleet.entitlement_allocation WHERE organization_id = ${organizationId}::uuid AND preference_honoured) AS "preferenceHonoured",
        (SELECT count(*)::int FROM fleet.entitlement_allocation WHERE organization_id = ${organizationId}::uuid AND NOT preference_honoured) AS "preferenceVariance",
        (SELECT count(*)::int FROM fleet.bsd_return_window WHERE organization_id = ${organizationId}::uuid AND status = 'Active') AS "bsdActive",
        (SELECT count(*)::int FROM fleet.bsd_return_window WHERE organization_id = ${organizationId}::uuid AND status = 'Conflict') AS "bsdConflict",
        (SELECT count(*)::int FROM fleet.entitlement_command_ledger WHERE organization_id = ${organizationId}::uuid AND result_entitlement_id IS NOT NULL) AS "completedCommands"
    `) as unknown as Array<Record<string, number>>;
    return rows[0] ?? {};
  }

  /** Locks one Entitlement row for an atomic command transaction. */
  async findByIdForUpdate(
    id: string,
    organizationId: string,
    executor: Executor,
  ) {
    const rows = await executor
      .select()
      .from(entitlementRequest)
      .where(and(
        eq(entitlementRequest.id, id),
        eq(entitlementRequest.organizationId, organizationId),
      ))
      .limit(1)
      .for('update');
    return rows[0];
  }

  async update(id: string, set: Partial<typeof entitlementRequest.$inferInsert>, executor: Executor = this.db) {
    const rows = await executor
      .update(entitlementRequest)
      .set({ ...set, updatedAtUtc: new Date() })
      .where(eq(entitlementRequest.id, id))
      .returning();
    return rows[0];
  }

  async updateOwnAtRevision(
    id: string,
    organizationId: string,
    requesterPersonId: string,
    expectedRevision: number,
    set: Partial<typeof entitlementRequest.$inferInsert>,
    executor: Executor = this.db,
  ) {
    const rows = await executor
      .update(entitlementRequest)
      .set({ ...set, updatedAtUtc: new Date() })
      .where(and(
        eq(entitlementRequest.id, id),
        eq(entitlementRequest.organizationId, organizationId),
        eq(entitlementRequest.requesterPersonId, requesterPersonId),
        eq(entitlementRequest.revision, expectedRevision),
      ))
      .returning();
    return rows[0] ?? null;
  }

  /** Updates one organization-scoped Entitlement only at the expected revision. */
  async updateAtRevision(
    id: string,
    organizationId: string,
    expectedRevision: number,
    set: Partial<typeof entitlementRequest.$inferInsert>,
    executor: Executor,
  ) {
    const rows = await executor
      .update(entitlementRequest)
      .set({ ...set, updatedAtUtc: new Date() })
      .where(and(
        eq(entitlementRequest.id, id),
        eq(entitlementRequest.organizationId, organizationId),
        eq(entitlementRequest.revision, expectedRevision),
      ))
      .returning();
    return rows[0] ?? null;
  }

  async listOwn(organizationId: string, personId: string, limit = 50, offset = 0) {
    return this.db
      .select()
      .from(entitlementRequest)
      .where(and(
        eq(entitlementRequest.organizationId, organizationId),
        eq(entitlementRequest.requesterPersonId, personId),
      ))
      .orderBy(desc(entitlementRequest.createdAtUtc))
      .limit(limit)
      .offset(offset);
  }

  async findCommand(organizationId: string, actorPersonId: string, commandType: string, idempotencyKey: string) {
    const rows = await this.db
      .select()
      .from(entitlementCommandLedger)
      .where(and(
        eq(entitlementCommandLedger.organizationId, organizationId),
        eq(entitlementCommandLedger.actorPersonId, actorPersonId),
        eq(entitlementCommandLedger.commandType, commandType),
        eq(entitlementCommandLedger.idempotencyKey, idempotencyKey),
      ))
      .limit(1);
    return rows[0];
  }

  async claimCommand(values: typeof entitlementCommandLedger.$inferInsert, executor: Executor) {
    const rows = await executor.insert(entitlementCommandLedger).values(values).onConflictDoNothing().returning();
    return rows[0] ?? null;
  }

  async completeCommand(id: string, resultEntitlementId: string, resultBody: unknown, executor: Executor) {
    await executor
      .update(entitlementCommandLedger)
      .set({ resultEntitlementId, resultBody, updatedAtUtc: new Date() })
      .where(eq(entitlementCommandLedger.id, id));
  }

  /** Loads the current workflow step for a version-bound decision command. */
  async findCurrentWorkflowStep(instanceId: string) {
    const rows = await this.db
      .select({ step: workflowStep })
      .from(workflowInstance)
      .innerJoin(
        workflowStep,
        and(
          eq(workflowStep.workflowInstanceId, workflowInstance.id),
          eq(workflowStep.sequence, workflowInstance.currentStep),
        ),
      )
      .where(eq(workflowInstance.id, instanceId))
      .limit(1);
    return rows[0]?.step;
  }

  /** Returns only current assigned/delegated Dedicated approval tasks for one actor. */
  async listApprovalWorklist(actorPersonId: string, organizationId: string) {
    const now = new Date().toISOString();
    return this.db
      .select({
        entitlementId: entitlementRequest.id,
        revision: entitlementRequest.revision,
        workflowInstanceId: workflowInstance.id,
        workflowStepId: workflowStep.id,
        workflowStepVersion: workflowStep.stateVersion,
        assigneePersonId: workflowStep.assigneePersonId,
        requesterName: person.fullName,
        requestType: entitlementRequest.requestType,
        driverOption: entitlementRequest.driverOption,
        justificationCategory: entitlementRequest.justificationCategory,
        justificationText: entitlementRequest.justificationText,
        vehicleCategoryCode: entitlementRequest.vehicleCategoryCode,
        preferredVehicleId: entitlementRequest.preferredVehicleId,
        preferenceNote: entitlementRequest.preferenceNote,
        durationStart: entitlementRequest.durationStart,
        durationEnd: entitlementRequest.durationEnd,
        locationName: hierarchyNode.name,
        eligibilityResult: entitlementRequest.eligibilityResult,
        dueAtUtc: workflowStep.slaDueAt,
      })
      .from(workflowStep)
      .innerJoin(workflowInstance, eq(workflowInstance.id, workflowStep.workflowInstanceId))
      .innerJoin(entitlementRequest, eq(entitlementRequest.workflowInstanceId, workflowInstance.id))
      .innerJoin(person, eq(person.id, entitlementRequest.requesterPersonId))
      .leftJoin(hierarchyNode, eq(hierarchyNode.id, entitlementRequest.locationNodeId))
      .where(and(
        eq(entitlementRequest.organizationId, organizationId),
        eq(workflowInstance.organizationId, organizationId),
        eq(workflowInstance.status, 'Pending'),
        eq(workflowStep.sequence, workflowInstance.currentStep),
        isNull(workflowStep.decision),
        sql`(
          ${workflowStep.assigneePersonId} = ${actorPersonId}::uuid OR EXISTS (
            SELECT 1 FROM fleet.delegation d
            WHERE d.organization_id = ${organizationId}::uuid
              AND d.delegator_person_id = ${workflowStep.assigneePersonId}
              AND d.delegate_person_id = ${actorPersonId}::uuid
              AND d.request_type = ${workflowInstance.workflowType}
              AND d.one_hop_only = true
              AND d.valid_from <= ${now}::timestamptz
              AND d.valid_to >= ${now}::timestamptz
          )
        )`,
      ))
      .orderBy(workflowStep.slaDueAt, entitlementRequest.createdAtUtc)
      .limit(100);
  }

  /** Persists one short-lived preview evidence record without creating a Vehicle hold. */
  async insertEligibilityPreview(
    values: typeof entitlementEligibilityPreview.$inferInsert,
  ) {
    const rows = await this.db
      .insert(entitlementEligibilityPreview)
      .values(values)
      .returning();
    return rows[0];
  }

  /** Loads preview evidence only for its owning organization and requester. */
  async findEligibilityPreview(
    id: string,
    organizationId: string,
    requesterPersonId: string,
  ) {
    const rows = await this.db
      .select()
      .from(entitlementEligibilityPreview)
      .where(and(
        eq(entitlementEligibilityPreview.id, id),
        eq(entitlementEligibilityPreview.organizationId, organizationId),
        eq(entitlementEligibilityPreview.requesterPersonId, requesterPersonId),
      ))
      .limit(1);
    return rows[0];
  }

  /** Deletes expired preview evidence only when no Entitlement still references it. */
  async deleteExpiredUnreferencedPreviews(before: Date): Promise<number> {
    const rows = await this.db.execute(sql`
      DELETE FROM fleet.entitlement_eligibility_preview preview
      WHERE preview.expires_at_utc < ${before.toISOString()}::timestamptz
        AND NOT EXISTS (
          SELECT 1 FROM fleet.entitlement_request request
          WHERE request.eligibility_preview_id = preview.id
        )
      RETURNING preview.id
    `) as unknown as Array<{ id: string }>;
    return rows.length;
  }

  /** Returns bounded Employee-safe Vehicles that satisfy current preview constraints. */
  async listEligibleVehicleOptions(input: {
    organizationId: string;
    authorizedNodeIds: string[];
    permittedVehicleClasses: string[];
    durationStart: Date;
    durationEndExclusive: Date;
  }, executor: Executor = this.db) {
    if (
      input.authorizedNodeIds.length === 0 ||
      input.permittedVehicleClasses.length === 0
    ) return [];
    const requiredThrough = input.durationEndExclusive.toISOString().slice(0, 10);
    return executor
      .select({
        vehicleId: vehicle.id,
        plate: vehicle.plate,
        makeCode: vehicle.makeCode,
        modelCode: vehicle.modelCode,
        vehicleClass: vehicle.bodyTypeCode,
        fuelTypeCode: vehicle.fuelTypeCode,
        locationName: hierarchyNode.name,
      })
      .from(vehicle)
      .innerJoin(
        vehicleHierarchyAssignment,
        and(
          eq(vehicleHierarchyAssignment.vehicleId, vehicle.id),
          isNull(vehicleHierarchyAssignment.validTo),
        ),
      )
      .innerJoin(hierarchyNode, eq(hierarchyNode.id, vehicleHierarchyAssignment.nodeId))
      .where(and(
        eq(vehicle.organizationId, input.organizationId),
        eq(vehicle.lifecycleStatus, 'Active'),
        eq(vehicle.assignmentModel, 'Pool'),
        eq(vehicle.vendorHealthHold, false),
        inArray(vehicleHierarchyAssignment.nodeId, input.authorizedNodeIds),
        inArray(vehicle.bodyTypeCode, input.permittedVehicleClasses),
        sql`${vehicle.mulkiyaNumber} IS NOT NULL`,
        sql`${vehicle.mulkiyaExpiry} >= ${requiredThrough}::date`,
        sql`${vehicle.insurancePolicyNumber} IS NOT NULL`,
        sql`${vehicle.insuranceExpiry} >= ${requiredThrough}::date`,
        sql`NOT EXISTS (
          SELECT 1 FROM fleet.booking booking
          WHERE booking.vehicle_id = ${vehicle.id}
            AND booking.status IN ('PendingApproval', 'Approved', 'Active')
            AND tstzrange(booking.reservation_start, booking.reservation_end)
              && tstzrange(
                ${input.durationStart.toISOString()}::timestamptz,
                ${input.durationEndExclusive.toISOString()}::timestamptz
              )
        )`,
        sql`NOT EXISTS (
          SELECT 1 FROM fleet.entitlement_request entitlement
          WHERE entitlement.vehicle_id = ${vehicle.id}
            AND entitlement.status IN ('Allocated', 'Approved', 'AwaitingConsent')
            AND daterange(entitlement.duration_start, entitlement.duration_end, '[]')
              && daterange(${input.durationStart.toISOString().slice(0, 10)}::date, ${input.durationEndExclusive.toISOString().slice(0, 10)}::date, '[)')
        )`,
      ))
      .orderBy(asc(vehicle.plate))
      .limit(50);
  }

  /** Locks one organization Vehicle before final allocation qualification. */
  async findVehicleForUpdate(id: string, organizationId: string, executor: Executor) {
    const rows = await executor.select().from(vehicle).where(and(
      eq(vehicle.id, id),
      eq(vehicle.organizationId, organizationId),
    )).limit(1).for('update');
    return rows[0];
  }

  /** Inserts immutable effective-range Dedicated allocation evidence. */
  async insertAllocation(values: typeof entitlementAllocation.$inferInsert, executor: Executor) {
    const rows = await executor.insert(entitlementAllocation).values(values).returning();
    return rows[0];
  }

  /** Locks the active allocation for lifecycle return/expiry operations. */
  async findActiveAllocationForUpdate(entitlementRequestId: string, executor: Executor) {
    const rows = await executor.select().from(entitlementAllocation).where(and(
      eq(entitlementAllocation.entitlementRequestId, entitlementRequestId),
      eq(entitlementAllocation.status, 'Active'),
    )).limit(1).for('update');
    return rows[0];
  }

  /** Closes one active allocation with an immutable terminal allocation status. */
  async closeAllocation(id: string, status: 'Returned' | 'Cancelled' | 'Expired', executor: Executor) {
    const rows = await executor.update(entitlementAllocation).set({ status, endedAtUtc: new Date(), updatedAtUtc: new Date() }).where(and(
      eq(entitlementAllocation.id, id),
      eq(entitlementAllocation.status, 'Active'),
    )).returning();
    return rows[0] ?? null;
  }

  /** Appends one immutable Entitlement lifecycle event. */
  async insertEvent(values: typeof entitlementEvent.$inferInsert, executor: Executor = this.db) {
    const rows = await executor.insert(entitlementEvent).values(values).returning();
    return rows[0];
  }

  /** Returns owner-safe lifecycle chronology for one request. */
  async listEvents(entitlementRequestId: string) {
    return this.db.select().from(entitlementEvent).where(eq(entitlementEvent.entitlementRequestId, entitlementRequestId)).orderBy(asc(entitlementEvent.atUtc));
  }

  /** Updates Vehicle assignment state inside the allocation transaction. */
  async updateVehicle(
    id: string,
    organizationId: string,
    set: Partial<typeof vehicle.$inferInsert>,
    executor: Executor,
  ) {
    const rows = await executor.update(vehicle).set({ ...set, updatedAtUtc: new Date() }).where(and(
      eq(vehicle.id, id),
      eq(vehicle.organizationId, organizationId),
    )).returning();
    return rows[0] ?? null;
  }

  /** Returns approved and consented requests contained by Fleet-authorized nodes. */
  async listAllocationCandidates(organizationId: string, authorizedNodeIds: string[]) {
    if (!authorizedNodeIds.length) return [];
    return this.db.select().from(entitlementRequest).where(and(
      eq(entitlementRequest.organizationId, organizationId),
      inArray(entitlementRequest.status, ['AwaitingConsent', 'Allocated']),
      inArray(entitlementRequest.locationNodeId, authorizedNodeIds),
      sql`${entitlementRequest.consentSignedAtUtc} IS NOT NULL`,
    )).orderBy(entitlementRequest.durationStart).limit(100);
  }

  /** Resolves one safe Vehicle plate for advisory preference display. */
  async findVehiclePlate(id: string | null) {
    if (!id) return null;
    const rows = await this.db.select({ plate: vehicle.plate }).from(vehicle).where(eq(vehicle.id, id)).limit(1);
    return rows[0]?.plate ?? null;
  }

  /** Returns active hierarchy nodes contained by one organization-scoped request location. */
  async descendantNodeIds(organizationId: string, scopeNodeId: string) {
    const target = await this.db
      .select({ path: hierarchyNode.path })
      .from(hierarchyNode)
      .where(and(
        eq(hierarchyNode.id, scopeNodeId),
        eq(hierarchyNode.organizationId, organizationId),
        isNull(hierarchyNode.validTo),
      ))
      .limit(1);
    if (!target[0]) return [];
    const rows = await this.db
      .select({ id: hierarchyNode.id })
      .from(hierarchyNode)
      .where(and(
        eq(hierarchyNode.organizationId, organizationId),
        isNull(hierarchyNode.validTo),
        sql`${target[0].path}::ltree @> ${hierarchyNode.path}`,
      ));
    return rows.map((row) => row.id);
  }

  async insertBsdWindow(values: typeof bsdReturnWindow.$inferInsert, executor: Executor = this.db) {
    const rows = await executor.insert(bsdReturnWindow).values(values).returning();
    return rows[0];
  }

  async listBsdWindows(entitlementRequestId: string) {
    return this.db
      .select()
      .from(bsdReturnWindow)
      .where(eq(bsdReturnWindow.entitlementRequestId, entitlementRequestId))
      .orderBy(desc(bsdReturnWindow.windowStart));
  }

  /** Locks one BSD window for a Fleet confirmation command. */
  async findBsdWindowForUpdate(id: string, executor: Executor) {
    const rows = await executor.select().from(bsdReturnWindow).where(eq(bsdReturnWindow.id, id)).limit(1).for('update');
    return rows[0];
  }

  /** Updates one BSD window state inside the owning transaction. */
  async updateBsdWindow(id: string, set: Partial<typeof bsdReturnWindow.$inferInsert>, executor: Executor) {
    const rows = await executor.update(bsdReturnWindow).set({ ...set, updatedAtUtc: new Date() }).where(eq(bsdReturnWindow.id, id)).returning();
    return rows[0] ?? null;
  }

  /** Lists due BSD candidates; the service locks Entitlement then window to avoid lifecycle deadlocks. */
  async listDueBsdWindows(now: Date, executor: Executor) {
    return executor.select().from(bsdReturnWindow).where(sql`(
      (${bsdReturnWindow.status} = 'Confirmed' AND ${bsdReturnWindow.windowStart} <= ${now.toISOString()}::timestamptz)
      OR (${bsdReturnWindow.status} IN ('Active', 'Conflict') AND ${bsdReturnWindow.windowEnd} <= ${now.toISOString()}::timestamptz)
    )`).orderBy(asc(bsdReturnWindow.windowStart));
  }

  /** Terminalizes every open BSD window when its owning allocation closes. */
  async terminalizeOpenBsdWindows(entitlementRequestId: string, at: Date, executor: Executor) {
    return executor.execute(sql`
      UPDATE fleet.bsd_return_window
      SET status = CASE WHEN status IN ('Active', 'Conflict') THEN 'Completed' ELSE 'Cancelled' END,
          completed_at_utc = CASE WHEN status IN ('Active', 'Conflict') THEN ${at.toISOString()}::timestamptz ELSE completed_at_utc END,
          updated_at_utc = ${at.toISOString()}::timestamptz
      WHERE entitlement_request_id = ${entitlementRequestId}
        AND status IN ('Proposed', 'Confirmed', 'Active', 'Conflict')
      RETURNING id, status
    `) as unknown as Array<{ id: string; status: string }>;
  }

  /** Checks whether an active Pool Booking still occupies a BSD Vehicle at restoration time. */
  async hasBlockingBooking(vehicleId: string, at: Date, executor: Executor) {
    const rows = await executor.execute(sql`
      SELECT id FROM fleet.booking
      WHERE vehicle_id = ${vehicleId}
        AND status IN ('PendingApproval', 'Approved', 'Active')
        AND reservation_start < ${at.toISOString()}::timestamptz
        AND reservation_end > ${at.toISOString()}::timestamptz
      LIMIT 1
    `) as unknown as Array<{ id: string }>;
    return rows.length > 0;
  }

  /** A person's id + grade + line manager (drives eligibility + the approval chain). */
  async findPerson(id: string) {
    const rows = await this.db
      .select({
        id: person.id,
        organizationId: person.organizationId,
        fullName: person.fullName,
        grade: person.grade,
        employmentStatus: person.employmentStatus,
        lineManagerPersonId: person.lineManagerPersonId,
        homePoolNodeId: person.homePoolNodeId,
        homePoolName: hierarchyNode.name,
      })
      .from(person)
      .leftJoin(hierarchyNode, eq(hierarchyNode.id, person.homePoolNodeId))
      .where(eq(person.id, id))
      .limit(1);
    return rows[0];
  }

  /** First active holder of a platform role (optionally at a scope) — chain resolution. */
  async findApproverForRole(role: PlatformRole, scopeNodeId?: string | null): Promise<string | null> {
    const conditions = [eq(roleAssignment.role, role), isNull(roleAssignment.validTo)];
    if (scopeNodeId) {
      conditions.push(eq(roleAssignment.scopeNodeId, scopeNodeId));
    }
    const rows = await this.db
      .select({ personId: roleAssignment.personId })
      .from(roleAssignment)
      .where(and(...conditions))
      .limit(1);
    return rows[0]?.personId ?? null;
  }
}
