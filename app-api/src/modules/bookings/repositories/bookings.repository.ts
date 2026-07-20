import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, inArray, isNull, lte, notInArray, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import type { PlatformRole } from '../../../common/database/schema';
import {
  booking,
  bookingEvent,
  bookingPolicyDecision,
  consentLifecycleEvent,
  consentRecord,
  hierarchyNode,
  person,
  roleAssignment,
  vehicle,
  vehicleHierarchyAssignment,
} from '../../../common/database/schema';

/** An executor that can write — the base db or an open transaction. */
type Executor = Pick<DrizzleDatabase, 'insert' | 'update'>;

/** Lifecycle states that make a vehicle wholly unavailable for booking. */
const UNAVAILABLE_LIFECYCLE = [
  'Decommissioned',
  'Sold',
  'Transferred',
  'UnderMaintenance',
  'OffHirePending',
] as const;

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

  async update(id: string, set: Partial<typeof booking.$inferInsert>, executor: Executor = this.db) {
    const rows = await executor
      .update(booking)
      .set({ ...set, updatedAtUtc: new Date() })
      .where(eq(booking.id, id))
      .returning();
    return rows[0];
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
      notInArray(vehicle.lifecycleStatus, [...UNAVAILABLE_LIFECYCLE]),
      noOverlap,
    ];
    if (seatingCapacity && seatingCapacity > 0) {
      conditions.push(gte(vehicle.seatingCapacity, seatingCapacity));
    }
    if (authorizedNodeIds) {
      if (authorizedNodeIds.length === 0) return [];
      conditions.push(sql`EXISTS (
        SELECT 1 FROM fleet.vehicle_hierarchy_assignment vha
        WHERE vha.vehicle_id = ${vehicle.id}
          AND vha.valid_to IS NULL
          AND vha.node_id = ANY(${authorizedNodeIds}::uuid[])
      )`);
    }
    return this.db
      .select({
        vehicleId: vehicle.id,
        plate: vehicle.plate,
        bodyTypeCode: vehicle.bodyTypeCode,
        useCategoryCode: vehicle.useCategoryCode,
        seatingCapacity: vehicle.seatingCapacity,
        fuelTypeCode: vehicle.fuelTypeCode,
      })
      .from(vehicle)
      .where(and(...conditions))
      .orderBy(vehicle.plate)
      .limit(100);
  }
}
