import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import {
  accessBlock,
  booking,
  complianceItem,
  devicePairing,
  entitlementRequest,
  fine,
  vehicle,
  vehicleHierarchyAssignment,
} from '../../../common/database/schema';

/** Unavailable lifecycle states for the availability read model. */
const UNAVAILABLE_LIFECYCLE = ['UnderMaintenance', 'OffHirePending', 'Decommissioned', 'Sold', 'Transferred'];
const RESERVED_STATUSES = ['PendingApproval', 'Approved'];

const toInt = (rows: Array<{ n: number }>): number => Number(rows[0]?.n ?? 0);

/**
 * Read-optimised aggregate queries over the committed slice tables (M9). Never
 * re-implements domain rules — it only reads. A `null` vehicle-id scope means
 * the whole organization; an empty array means an empty scope (returns zero).
 */
@Injectable()
export class DashboardsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  /** Distinct vehicles currently assigned to any node in the scope subtree. */
  async vehicleIdsInNodes(nodeIds: string[]): Promise<string[]> {
    if (nodeIds.length === 0) {
      return [];
    }
    const rows = await this.db
      .selectDistinct({ id: vehicleHierarchyAssignment.vehicleId })
      .from(vehicleHierarchyAssignment)
      .where(and(inArray(vehicleHierarchyAssignment.nodeId, nodeIds), isNull(vehicleHierarchyAssignment.validTo)));
    return rows.map((r) => r.id);
  }

  async countVehicles(ids: string[] | null): Promise<number> {
    if (ids && ids.length === 0) {
      return 0;
    }
    const rows = await this.db
      .select({ n: sql<number>`cast(count(*) as int)` })
      .from(vehicle)
      .where(ids ? inArray(vehicle.id, ids) : undefined);
    return toInt(rows);
  }

  async countUnavailableVehicles(ids: string[] | null): Promise<number> {
    if (ids && ids.length === 0) {
      return 0;
    }
    const unavailable = sql`(${vehicle.lifecycleStatus} in ('UnderMaintenance','OffHirePending','Decommissioned','Sold','Transferred') or ${vehicle.bookingPoolFlag} = false)`;
    const rows = await this.db
      .select({ n: sql<number>`cast(count(*) as int)` })
      .from(vehicle)
      .where(ids ? and(inArray(vehicle.id, ids), unavailable) : unavailable);
    return toInt(rows);
  }

  /** Distinct vehicles with a booking in one of the given statuses. */
  async countVehiclesWithBookingStatus(ids: string[] | null, statuses: string[]): Promise<number> {
    if (ids && ids.length === 0) {
      return 0;
    }
    const conditions = [inArray(booking.status, statuses as never)];
    if (ids) {
      conditions.push(inArray(booking.vehicleId, ids));
    }
    const rows = await this.db
      .select({ n: sql<number>`cast(count(distinct ${booking.vehicleId}) as int)` })
      .from(booking)
      .where(and(...conditions));
    return toInt(rows);
  }

  /** Bookings whose pick-up falls within [from, to) — "today". */
  async countBookingsInWindow(ids: string[] | null, from: Date, to: Date): Promise<number> {
    if (ids && ids.length === 0) {
      return 0;
    }
    const conditions = [gte(booking.pickupAtUtc, from), lt(booking.pickupAtUtc, to)];
    if (ids) {
      conditions.push(inArray(booking.vehicleId, ids));
    }
    const rows = await this.db
      .select({ n: sql<number>`cast(count(*) as int)` })
      .from(booking)
      .where(and(...conditions));
    return toInt(rows);
  }

  /** Fines grouped by attributed driver (count + total amount). */
  async finesPerUser(ids: string[] | null): Promise<Array<{ personId: string; fineCount: number; totalAmount: string }>> {
    if (ids && ids.length === 0) {
      return [];
    }
    const conditions = [sql`${fine.attributedPersonId} is not null`];
    if (ids) {
      conditions.push(inArray(fine.vehicleId, ids));
    }
    const rows = await this.db
      .select({
        personId: fine.attributedPersonId,
        fineCount: sql<number>`cast(count(*) as int)`,
        totalAmount: sql<string>`cast(coalesce(sum(${fine.amount}), 0) as text)`,
      })
      .from(fine)
      .where(and(...conditions))
      .groupBy(fine.attributedPersonId)
      .orderBy(desc(sql`sum(${fine.amount})`));
    return rows.map((r) => ({ personId: r.personId as string, fineCount: r.fineCount, totalAmount: r.totalAmount }));
  }

  /** Compliance item counts by status over the scope (vehicle subjects). */
  async complianceCounts(ids: string[] | null): Promise<{ valid: number; expiringSoon: number; expired: number }> {
    if (ids && ids.length === 0) {
      return { valid: 0, expiringSoon: 0, expired: 0 };
    }
    const rows = await this.db
      .select({ status: complianceItem.status, n: sql<number>`cast(count(*) as int)` })
      .from(complianceItem)
      .where(ids ? inArray(complianceItem.subjectRef, ids) : undefined)
      .groupBy(complianceItem.status);
    const out = { valid: 0, expiringSoon: 0, expired: 0 };
    for (const r of rows) {
      if (r.status === 'Valid') out.valid = r.n;
      else if (r.status === 'ExpiringSoon') out.expiringSoon = r.n;
      else if (r.status === 'Expired') out.expired = r.n;
    }
    return out;
  }

  async countActiveBlocks(): Promise<number> {
    const rows = await this.db
      .select({ n: sql<number>`cast(count(*) as int)` })
      .from(accessBlock)
      .where(eq(accessBlock.active, true));
    return toInt(rows);
  }

  /** Entitlement counts by status + a by-category breakdown (scoped by location node). */
  async entitlementInventory(nodeIds: string[] | null): Promise<{ allocated: number; pendingApproval: number; byCategory: Array<{ justificationCategory: string; count: number }> }> {
    if (nodeIds && nodeIds.length === 0) {
      return { allocated: 0, pendingApproval: 0, byCategory: [] };
    }
    const scope = nodeIds ? inArray(entitlementRequest.locationNodeId, nodeIds) : undefined;
    const statusRows = await this.db
      .select({ status: entitlementRequest.status, n: sql<number>`cast(count(*) as int)` })
      .from(entitlementRequest)
      .where(scope)
      .groupBy(entitlementRequest.status);
    let allocated = 0;
    let pendingApproval = 0;
    for (const r of statusRows) {
      if (r.status === 'Allocated') allocated = r.n;
      else if (r.status === 'PendingApproval') pendingApproval = r.n;
    }
    const catRows = await this.db
      .select({ justificationCategory: entitlementRequest.justificationCategory, count: sql<number>`cast(count(*) as int)` })
      .from(entitlementRequest)
      .where(scope ? and(scope, eq(entitlementRequest.status, 'Allocated')) : eq(entitlementRequest.status, 'Allocated'))
      .groupBy(entitlementRequest.justificationCategory);
    return { allocated, pendingApproval, byCategory: catRows };
  }

  /** Distinct vehicles with an active device pairing (telematics reporting). */
  async devicesReporting(ids: string[] | null): Promise<number> {
    if (ids && ids.length === 0) {
      return 0;
    }
    const conditions = [isNull(devicePairing.validTo)];
    if (ids) {
      conditions.push(inArray(devicePairing.vehicleId, ids));
    }
    const rows = await this.db
      .select({ n: sql<number>`cast(count(distinct ${devicePairing.vehicleId}) as int)` })
      .from(devicePairing)
      .where(and(...conditions));
    return toInt(rows);
  }

  /** A few compliance items nearing/at expiry, for the operations attention list. */
  async expiringItems(ids: string[] | null, limit: number) {
    if (ids && ids.length === 0) {
      return [];
    }
    const notValid = inArray(complianceItem.status, ['ExpiringSoon', 'Expired'] as never);
    return this.db
      .select({ id: complianceItem.id, subjectRef: complianceItem.subjectRef, itemType: complianceItem.itemType, status: complianceItem.status, expiryDate: complianceItem.expiryDate })
      .from(complianceItem)
      .where(ids ? and(inArray(complianceItem.subjectRef, ids), notValid) : notValid)
      .orderBy(complianceItem.expiryDate)
      .limit(limit);
  }

  /** Upcoming reserved/approved bookings for the operations overview. */
  async upcomingBookings(ids: string[] | null, limit: number) {
    if (ids && ids.length === 0) {
      return [];
    }
    const conditions = [inArray(booking.status, ['PendingApproval', 'Approved'] as never)];
    if (ids) {
      conditions.push(inArray(booking.vehicleId, ids));
    }
    return this.db
      .select({ id: booking.id, pickupAtUtc: booking.pickupAtUtc, destination: booking.destination, vehicleId: booking.vehicleId, status: booking.status })
      .from(booking)
      .where(and(...conditions))
      .orderBy(booking.pickupAtUtc)
      .limit(limit);
  }

  /** The plate of a vehicle (for attention/upcoming display). */
  async plateOf(vehicleId: string): Promise<string> {
    const rows = await this.db.select({ plate: vehicle.plate }).from(vehicle).where(eq(vehicle.id, vehicleId)).limit(1);
    return rows[0]?.plate ?? vehicleId;
  }
}

export { UNAVAILABLE_LIFECYCLE, RESERVED_STATUSES };
