import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import type { PlatformRole } from '../../../common/database/schema';
import { BOOKABLE_VEHICLE_LIFECYCLE } from '../../../common/domain/vehicle-bookability';
import {
  booking,
  bookingApprovalRoute,
  bookingApprovalRouteStep,
  bookingCommandLedger,
  bookingEvent,
  bookingPolicyDecision,
  consentLifecycleEvent,
  consentRecord,
  hierarchyNode,
  person,
  roleAssignment,
  vehicle,
  vehicleHierarchyAssignment,
  workflowDecisionCommand,
  workflowInstance,
  workflowStep,
} from '../../../common/database/schema';

/** An executor backed by the base database or an open transaction. */
type Executor = Pick<DrizzleDatabase, 'insert' | 'select' | 'update' | 'execute'>;

/** Data access for the bookings module (hides Drizzle; shares one reservation range). */
@Injectable()
export class BookingsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  /** Runs a set of writes in one transaction (booking + consent + audit + outbox atomicity). */
  transaction<T>(work: (tx: DrizzleDatabase) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  async insert(values: typeof booking.$inferInsert, executor: Executor = this.db) {
    const rows = await executor.insert(booking).values(values).returning();
    return rows[0];
  }

  async findById(id: string) {
    const rows = await this.db.select().from(booking).where(eq(booking.id, id)).limit(1);
    return rows[0];
  }

  /** Locks one Booking row so a command can serialize aggregate mutations. */
  async findByIdForUpdate(id: string, executor: Executor = this.db) {
    const rows = await executor
      .select()
      .from(booking)
      .where(eq(booking.id, id))
      .limit(1)
      .for('update');
    return rows[0];
  }

  /** Locks one Vehicle so reservation commit serializes with Dedicated allocation. */
  async findVehicleForUpdate(id: string, executor: Executor) {
    const rows = await executor.select().from(vehicle).where(eq(vehicle.id, id)).limit(1).for('update');
    return rows[0];
  }

  async update(id: string, set: Partial<typeof booking.$inferInsert>, executor: Executor = this.db) {
    const rows = await executor
      .update(booking)
      .set({ ...set, updatedAtUtc: new Date() })
      .where(eq(booking.id, id))
      .returning();
    return rows[0];
  }

  /** Updates a Booking only when the caller still holds its current revision. */
  async updateAtRevision(
    id: string,
    expectedRevision: number,
    set: Partial<typeof booking.$inferInsert>,
    executor: Executor = this.db,
  ) {
    const rows = await executor
      .update(booking)
      .set({ ...set, updatedAtUtc: new Date() })
      .where(and(eq(booking.id, id), eq(booking.revision, expectedRevision)))
      .returning();
    return rows[0] ?? null;
  }

  /** Finds a previously claimed Booking command key. */
  async findCommand(
    organizationId: string,
    actorPersonId: string,
    commandType: string,
    idempotencyKey: string,
  ) {
    const rows = await this.db
      .select()
      .from(bookingCommandLedger)
      .where(and(
        eq(bookingCommandLedger.organizationId, organizationId),
        eq(bookingCommandLedger.actorPersonId, actorPersonId),
        eq(bookingCommandLedger.commandType, commandType),
        eq(bookingCommandLedger.idempotencyKey, idempotencyKey),
      ))
      .limit(1);
    return rows[0];
  }

  /** Claims a command key inside the aggregate transaction. */
  async claimCommand(
    values: typeof bookingCommandLedger.$inferInsert,
    executor: Executor = this.db,
  ) {
    const rows = await executor
      .insert(bookingCommandLedger)
      .values(values)
      .onConflictDoNothing()
      .returning();
    return rows[0] ?? null;
  }

  /** Completes a claimed command with its stable Booking result. */
  async completeCommand(
    id: string,
    resultBookingId: string,
    result: unknown,
    executor: Executor = this.db,
  ) {
    await executor
      .update(bookingCommandLedger)
      .set({ resultBookingId, result, updatedAtUtc: new Date() })
      .where(eq(bookingCommandLedger.id, id));
  }

  /** Persists immutable Booking approval route evidence from the pinned workflow. */
  async insertApprovalRoute(input: {
    bookingId: string;
    workflowInstanceId: string;
    definitionDeploymentId: string;
    steps: Array<{ id: string; assigneePersonId: string | null; sequence: number; slaDueAt: Date | null }>;
  }, executor: Executor = this.db) {
    const [route] = await executor.insert(bookingApprovalRoute).values({
      bookingId: input.bookingId,
      workflowInstanceId: input.workflowInstanceId,
      definitionDeploymentId: input.definitionDeploymentId,
    }).returning();
    if (!route) throw new Error('booking approval route creation failed');
    await executor.insert(bookingApprovalRouteStep).values(input.steps.map((step) => ({
      routeId: route.id,
      workflowStepId: step.id,
      stepKey: `step-${step.sequence + 1}`,
      ordinal: step.sequence + 1,
      requiredApproverPersonId: step.assigneePersonId!,
      assignmentSelectorSnapshot: { mode: 'resolved-person', personId: step.assigneePersonId },
      slaDueAtUtc: step.slaDueAt,
    })));
  }

  /** Finds a prior durable workflow decision command. */
  async findDecisionCommand(organizationId: string, principalPersonId: string, idempotencyKey: string, executor: Executor = this.db) {
    const rows = await executor.select().from(workflowDecisionCommand).where(and(
      eq(workflowDecisionCommand.organizationId, organizationId),
      eq(workflowDecisionCommand.principalPersonId, principalPersonId),
      eq(workflowDecisionCommand.idempotencyKey, idempotencyKey),
    )).limit(1);
    return rows[0];
  }

  /** Loads the current workflow step for command attribution before locking. */
  async findCurrentWorkflowStep(instanceId: string) {
    const rows = await this.db.select({ step: workflowStep })
      .from(workflowInstance)
      .innerJoin(workflowStep, and(eq(workflowStep.workflowInstanceId, workflowInstance.id), eq(workflowStep.sequence, workflowInstance.currentStep)))
      .where(eq(workflowInstance.id, instanceId)).limit(1);
    return rows[0]?.step;
  }

  /** Claims one workflow decision key inside the decision transaction. */
  async claimDecisionCommand(values: typeof workflowDecisionCommand.$inferInsert, executor: Executor) {
    const rows = await executor.insert(workflowDecisionCommand).values(values).onConflictDoNothing().returning();
    return rows[0] ?? null;
  }

  /** Completes a workflow decision command with its stable Booking result. */
  async completeDecisionCommand(id: string, resultBookingId: string, resultBody: unknown, executor: Executor) {
    await executor.update(workflowDecisionCommand).set({ resultBookingId, resultBody }).where(eq(workflowDecisionCommand.id, id));
  }

  /** Safe projection only: never add raw HR, licence, consent IP/device/signature, or policy internals. */
  async listApprovalWorklist(actorPersonId: string) {
    const now = new Date();
    return this.db.select({
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      requesterName: person.fullName,
      requesterEmployeeId: person.hcmEmployeeId,
      requesterLineManagerPersonId: person.lineManagerPersonId,
      plate: vehicle.plate,
      makeCode: vehicle.makeCode,
      modelCode: vehicle.modelCode,
      pickupAtUtc: booking.pickupAtUtc,
      returnAtUtc: booking.returnAtUtc,
      purpose: booking.purpose,
      destination: booking.destination,
      passengerCount: booking.passengerCount,
      consentVersion: consentRecord.consentDocumentVersion,
      consentSignedAtUtc: consentRecord.signedAtUtc,
      eligibilityDecision: sql<string | null>`(
        SELECT ee.decision FROM fleet.eligibility_evaluation ee
        WHERE ee.organization_id = ${booking.organizationId}
          AND ee.driver_person_id = ${booking.driverPersonId}
          AND ee.vehicle_id = ${booking.vehicleId}
          AND ee.evaluated_at_utc <= ${consentRecord.signedAtUtc}
        ORDER BY ee.evaluated_at_utc DESC LIMIT 1
      )`,
      eligibilityReasons: sql<string[] | null>`(
        SELECT ee.reasons FROM fleet.eligibility_evaluation ee
        WHERE ee.organization_id = ${booking.organizationId}
          AND ee.driver_person_id = ${booking.driverPersonId}
          AND ee.vehicle_id = ${booking.vehicleId}
          AND ee.evaluated_at_utc <= ${consentRecord.signedAtUtc}
        ORDER BY ee.evaluated_at_utc DESC LIMIT 1
      )`,
      eligibilityPolicyVersion: sql<string | null>`(
        SELECT ee.policy_version FROM fleet.eligibility_evaluation ee
        WHERE ee.organization_id = ${booking.organizationId}
          AND ee.driver_person_id = ${booking.driverPersonId}
          AND ee.vehicle_id = ${booking.vehicleId}
          AND ee.evaluated_at_utc <= ${consentRecord.signedAtUtc}
        ORDER BY ee.evaluated_at_utc DESC LIMIT 1
      )`,
      eligibilityEvaluatedAtUtc: sql<Date | string | null>`(
        SELECT ee.evaluated_at_utc FROM fleet.eligibility_evaluation ee
        WHERE ee.organization_id = ${booking.organizationId}
          AND ee.driver_person_id = ${booking.driverPersonId}
          AND ee.vehicle_id = ${booking.vehicleId}
          AND ee.evaluated_at_utc <= ${consentRecord.signedAtUtc}
        ORDER BY ee.evaluated_at_utc DESC LIMIT 1
      )`,
      behaviorBookingCount: sql<number>`(SELECT count(*)::int FROM fleet.booking b WHERE b.organization_id = ${booking.organizationId} AND b.requested_by_person_id = ${booking.requestedByPersonId} AND b.created_at_utc >= date_trunc('year', now()))`,
      behaviorNoShowCount: sql<number>`(SELECT count(*)::int FROM fleet.booking b WHERE b.organization_id = ${booking.organizationId} AND b.requested_by_person_id = ${booking.requestedByPersonId} AND b.status = 'NoShow' AND b.created_at_utc >= date_trunc('year', now()))`,
      behaviorLateReturnCount: sql<number>`(SELECT count(*)::int FROM fleet.booking_event be JOIN fleet.booking b ON b.id = be.booking_id WHERE b.organization_id = ${booking.organizationId} AND b.requested_by_person_id = ${booking.requestedByPersonId} AND be.event_type = 'Returned' AND (be.detail->>'lateReturn')::boolean = true AND be.at_utc >= date_trunc('year', now()))`,
      workflowStepId: workflowStep.id,
      bookingVersion: booking.revision,
      stepVersion: workflowStep.stateVersion,
      dueAtUtc: workflowStep.dueAtUtc,
      delegated: sql<boolean>`${workflowStep.assigneePersonId} <> ${actorPersonId}::uuid`,
    }).from(workflowStep)
      .innerJoin(workflowInstance, eq(workflowInstance.id, workflowStep.workflowInstanceId))
      .innerJoin(booking, eq(booking.workflowInstanceId, workflowInstance.id))
      .innerJoin(person, eq(person.id, booking.requestedByPersonId))
      .innerJoin(vehicle, eq(vehicle.id, booking.vehicleId))
      .innerJoin(consentRecord, eq(consentRecord.id, booking.consentRecordId))
      .where(and(
        eq(workflowInstance.status, 'Pending'),
        eq(workflowStep.sequence, workflowInstance.currentStep),
        isNull(workflowStep.decision),
        sql`(
          ${workflowStep.assigneePersonId} = ${actorPersonId}::uuid OR EXISTS (
            SELECT 1 FROM fleet.delegation d
            WHERE d.organization_id = ${workflowInstance.organizationId}
              AND d.delegator_person_id = ${workflowStep.assigneePersonId}
              AND d.delegate_person_id = ${actorPersonId}::uuid
              AND d.request_type = ${workflowInstance.workflowType}
              AND d.one_hop_only = true
              AND d.valid_from <= ${now.toISOString()}::timestamptz
              AND d.valid_to >= ${now.toISOString()}::timestamptz
          )
        )`,
      )).orderBy(workflowStep.dueAtUtc, booking.pickupAtUtc).limit(100);
  }

  /** Lists Approved upcoming Bookings in authorized Vehicle scopes for preparation. */
  async listPreparationWorklist(authorizedNodeIds: string[]) {
    if (authorizedNodeIds.length === 0) return [];
    return this.db.select({
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      vehiclePlate: vehicle.plate,
      pickupAtUtc: booking.pickupAtUtc,
      returnAtUtc: booking.returnAtUtc,
      scopeName: hierarchyNode.name,
    }).from(booking)
      .innerJoin(vehicle, eq(vehicle.id, booking.vehicleId))
      .leftJoin(hierarchyNode, eq(hierarchyNode.id, booking.bookingScopeNodeId))
      .where(and(
        eq(booking.status, 'Approved'),
        gte(booking.pickupAtUtc, new Date()),
        inArray(booking.bookingScopeNodeId, authorizedNodeIds),
      )).orderBy(booking.pickupAtUtc).limit(100);
  }

  /** Lists one person's own requested/driver Bookings with safe Vehicle details. */
  async listOwnBookings(personId: string) {
    return this.db.select({
      booking,
      plate: vehicle.plate,
      makeCode: vehicle.makeCode,
      modelCode: vehicle.modelCode,
      bodyTypeCode: vehicle.bodyTypeCode,
      fuelTypeCode: vehicle.fuelTypeCode,
      seatingCapacity: vehicle.seatingCapacity,
      scopeName: hierarchyNode.name,
    }).from(booking)
      .innerJoin(vehicle, eq(vehicle.id, booking.vehicleId))
      .leftJoin(hierarchyNode, eq(hierarchyNode.id, booking.bookingScopeNodeId))
      .where(sql`${booking.requestedByPersonId} = ${personId}::uuid OR ${booking.driverPersonId} = ${personId}::uuid`)
      .orderBy(desc(booking.pickupAtUtc))
      .limit(100);
  }

  async insertEvent(values: typeof bookingEvent.$inferInsert, executor: Executor = this.db) {
    await executor.insert(bookingEvent).values(values);
  }

  /** Appends immutable decision provenance in the booking transaction. */
  async insertPolicyDecision(
    values: typeof bookingPolicyDecision.$inferInsert,
    executor: Executor = this.db,
  ) {
    await executor.insert(bookingPolicyDecision).values(values).onConflictDoNothing();
  }

  async listEvents(bookingId: string) {
    return this.db
      .select()
      .from(bookingEvent)
      .where(eq(bookingEvent.bookingId, bookingId))
      .orderBy(desc(bookingEvent.atUtc));
  }

  async insertConsent(values: typeof consentRecord.$inferInsert, executor: Executor = this.db) {
    const rows = await executor.insert(consentRecord).values(values).returning();
    return rows[0];
  }

  async insertConsentEvent(
    values: typeof consentLifecycleEvent.$inferInsert,
    executor: Executor = this.db,
  ) {
    await executor.insert(consentLifecycleEvent).values(values);
  }

  /** The booking-relevant slice of a vehicle (classification + bookability + docs). */
  async findVehicle(id: string) {
    const rows = await this.db
      .select({
        id: vehicle.id,
        organizationId: vehicle.organizationId,
        plate: vehicle.plate,
        bodyTypeCode: vehicle.bodyTypeCode,
        useCategoryCode: vehicle.useCategoryCode,
        seatingCapacity: vehicle.seatingCapacity,
        fuelTypeCode: vehicle.fuelTypeCode,
        bookingPoolFlag: vehicle.bookingPoolFlag,
        lifecycleStatus: vehicle.lifecycleStatus,
        assignmentModel: vehicle.assignmentModel,
      })
      .from(vehicle)
      .where(eq(vehicle.id, id))
      .limit(1);
    return rows[0];
  }

  /** Returns the active hierarchy scope used for scoped policy resolution. */
  async findVehicleScope(vehicleId: string): Promise<string | null> {
    const rows = await this.db
      .select({ nodeId: vehicleHierarchyAssignment.nodeId })
      .from(vehicleHierarchyAssignment)
      .where(
        and(
          eq(vehicleHierarchyAssignment.vehicleId, vehicleId),
          isNull(vehicleHierarchyAssignment.validTo),
        ),
      )
      .limit(1);
    return rows[0]?.nodeId ?? null;
  }

  /** A person's id + line manager (the default booking approver, FR-BOOK-03). */
  async findPerson(id: string) {
    const rows = await this.db
      .select({ id: person.id, lineManagerPersonId: person.lineManagerPersonId })
      .from(person)
      .where(eq(person.id, id))
      .limit(1);
    return rows[0];
  }

  /** Person identity and home scope used for booking authorization/pickers. */
  async findPersonBookingProfile(id: string) {
    const rows = await this.db
      .select({
        personId: person.id,
        organizationId: person.organizationId,
        fullName: person.fullName,
        employeeId: person.hcmEmployeeId,
        grade: person.grade,
        employmentStatus: person.employmentStatus,
        homeScopeNodeId: person.homePoolNodeId,
        homeScopeName: hierarchyNode.name,
        isProfessionalDriver: person.isProfessionalDriver,
      })
      .from(person)
      .leftJoin(hierarchyNode, eq(hierarchyNode.id, person.homePoolNodeId))
      .where(eq(person.id, id))
      .limit(1);
    return rows[0];
  }

  /** Active people in an organization for a scope-filtered booking picker. */
  async listActiveBookingPeople(organizationId: string) {
    return this.db
      .select({
        personId: person.id,
        fullName: person.fullName,
        employeeId: person.hcmEmployeeId,
        grade: person.grade,
        homeScopeNodeId: person.homePoolNodeId,
        homeScopeName: hierarchyNode.name,
        isProfessionalDriver: person.isProfessionalDriver,
      })
      .from(person)
      .innerJoin(hierarchyNode, eq(hierarchyNode.id, person.homePoolNodeId))
      .where(
        and(
          eq(person.organizationId, organizationId),
          eq(person.employmentStatus, 'Active'),
          isNull(hierarchyNode.validTo),
        ),
      )
      .orderBy(person.fullName)
      .limit(500);
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

  /**
   * The booking active for a vehicle at an instant (approved or in-use), used by
   * the telematics trip-attach port (P1B-R1-1). Newest matching window wins.
   */
  async findActiveBookingForVehicle(
    vehicleId: string,
    at: Date,
  ): Promise<{ bookingId: string; driverPersonId: string } | null> {
    const rows = await this.db
      .select({ bookingId: booking.id, driverPersonId: booking.driverPersonId })
      .from(booking)
      .where(
        and(
          eq(booking.vehicleId, vehicleId),
          inArray(booking.status, ['Approved', 'Active']),
          lte(booking.pickupAtUtc, at),
          gte(booking.returnAtUtc, at),
        ),
      )
      .orderBy(desc(booking.pickupAtUtc))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * The booking that COVERED a (possibly historical) event time — including
   * already-**Completed** trips — used for fine/accident attribution, which
   * usually arrives after the booking has ended. Excludes never-realised
   * statuses (Draft/Declined/Cancelled/Expired/NoShow). Newest window wins.
   */
  async findBookingCoveringEvent(
    vehicleId: string,
    at: Date,
  ): Promise<{ bookingId: string; driverPersonId: string } | null> {
    const rows = await this.db
      .select({ bookingId: booking.id, driverPersonId: booking.driverPersonId })
      .from(booking)
      .where(
        and(
          eq(booking.vehicleId, vehicleId),
          inArray(booking.status, ['Approved', 'Active', 'Completed']),
          lte(booking.pickupAtUtc, at),
          gte(booking.returnAtUtc, at),
        ),
      )
      .orderBy(desc(booking.pickupAtUtc))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Bookable vehicles with no active booking overlapping the requested window —
   * computed from the exact same persisted reservation ranges the commit uses,
   * so availability can never disagree with the exclusion constraint (P1B-R2-1).
   */
  async listAvailable(
    start: Date,
    end: Date,
    seatingCapacity?: number,
    authorizedNodeIds?: string[],
  ) {
    const noOverlap = sql`NOT EXISTS (
      SELECT 1 FROM fleet.booking b
      WHERE b.vehicle_id = ${vehicle.id}
        AND b.status IN ('PendingApproval', 'Approved', 'Active')
        AND tstzrange(b.reservation_start, b.reservation_end)
            && tstzrange(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz)
    )`;
    const conditions = [
      eq(vehicle.bookingPoolFlag, true),
      eq(vehicle.lifecycleStatus, BOOKABLE_VEHICLE_LIFECYCLE),
      noOverlap,
    ];
    if (seatingCapacity && seatingCapacity > 0) {
      conditions.push(gte(vehicle.seatingCapacity, seatingCapacity));
    }
    if (authorizedNodeIds) {
      if (authorizedNodeIds.length === 0) return [];
      const authorizedNodes = sql.join(
        authorizedNodeIds.map((nodeId) => sql`${nodeId}::uuid`),
        sql`, `,
      );
      conditions.push(sql`EXISTS (
        SELECT 1 FROM fleet.vehicle_hierarchy_assignment vha
        WHERE vha.vehicle_id = ${vehicle.id}
          AND vha.valid_to IS NULL
          AND vha.node_id IN (${authorizedNodes})
      )`);
    }
    return this.db
      .select({
        vehicleId: vehicle.id,
        plate: vehicle.plate,
        makeCode: vehicle.makeCode,
        modelCode: vehicle.modelCode,
        bodyTypeCode: vehicle.bodyTypeCode,
        useCategoryCode: vehicle.useCategoryCode,
        seatingCapacity: vehicle.seatingCapacity,
        fuelTypeCode: vehicle.fuelTypeCode,
        locationName: sql<string | null>`(
          SELECT hn.name
          FROM fleet.vehicle_hierarchy_assignment vha
          JOIN fleet.hierarchy_node hn ON hn.id = vha.node_id
          WHERE vha.vehicle_id = fleet.vehicle.id
            AND vha.valid_to IS NULL
          LIMIT 1
        )`,
      })
      .from(vehicle)
      .where(and(...conditions))
      .orderBy(vehicle.plate)
      .limit(100);
  }

  /** Checks whether a reserving Booking currently overlaps one Vehicle window. */
  async hasActiveOverlap(vehicleId: string, start: Date, end: Date, executor: Executor = this.db): Promise<boolean> {
    const rows = await executor
      .select({ id: booking.id })
      .from(booking)
      .where(and(
        eq(booking.vehicleId, vehicleId),
        inArray(booking.status, ['PendingApproval', 'Approved', 'Active']),
        sql`tstzrange(${booking.reservationStart}, ${booking.reservationEnd})
            && tstzrange(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz)`,
      ))
      .limit(1);
    return rows.length > 0;
  }

  /** Verifies an entire Booking range fits an Active BSD window for a Dedicated Vehicle. */
  async isWithinActiveBsdWindow(vehicleId: string, start: Date, end: Date, executor: Executor = this.db): Promise<boolean> {
    const rows = await executor.execute(sql`
      SELECT 1
      FROM fleet.bsd_return_window window
      WHERE window.vehicle_id = ${vehicleId}
        AND window.status = 'Active'
        AND window.window_start <= ${start.toISOString()}::timestamptz
        AND window.window_end >= ${end.toISOString()}::timestamptz
      LIMIT 1
    `) as unknown as Array<Record<string, unknown>>;
    return rows.length > 0;
  }

  /** Lists scoped pool Vehicles with masked reservation ownership for a bounded timeline. */
  async listAvailabilityTimeline(
    start: Date,
    end: Date,
    actorPersonId: string,
    authorizedNodeIds: string[],
  ) {
    if (authorizedNodeIds.length === 0) return [];
    const authorizedNodes = sql.join(
      authorizedNodeIds.map((nodeId) => sql`${nodeId}::uuid`),
      sql`, `,
    );
    return this.db
      .select({
        vehicleId: vehicle.id,
        plate: vehicle.plate,
        makeCode: vehicle.makeCode,
        modelCode: vehicle.modelCode,
        bodyTypeCode: vehicle.bodyTypeCode,
        seatingCapacity: vehicle.seatingCapacity,
        fuelTypeCode: vehicle.fuelTypeCode,
        locationName: hierarchyNode.name,
        lifecycleStatus: vehicle.lifecycleStatus,
        bookingPoolFlag: vehicle.bookingPoolFlag,
        reservationStart: booking.reservationStart,
        reservationEnd: booking.reservationEnd,
        isOwn: sql<boolean>`COALESCE(
          ${booking.requestedByPersonId} = ${actorPersonId}::uuid
          OR ${booking.driverPersonId} = ${actorPersonId}::uuid,
          false
        )`,
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
      .leftJoin(
        booking,
        and(
          eq(booking.vehicleId, vehicle.id),
          inArray(booking.status, ['PendingApproval', 'Approved', 'Active']),
          sql`tstzrange(${booking.reservationStart}, ${booking.reservationEnd})
              && tstzrange(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz)`,
        ),
      )
      .where(and(
        eq(vehicle.assignmentModel, 'Pool'),
        sql`${vehicleHierarchyAssignment.nodeId} IN (${authorizedNodes})`,
      ))
      .orderBy(vehicle.plate, booking.reservationStart)
      .limit(500);
  }
}
