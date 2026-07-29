import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import {
  vehicle,
  vehicleDocument,
  vehicleHierarchyAssignment,
  vehicleLifecycleHistory,
  vehicleTransfer,
  hierarchyNode,
} from '../../../common/database/schema';

/** An executor that can insert — the base db or an open transaction. */type Executor = Pick<DrizzleDatabase, 'insert' | 'update'>;

/** Data access for the vehicle master (hides Drizzle). */
@Injectable()
export class VehicleRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async insert(
    values: typeof vehicle.$inferInsert,
    executor: Executor = this.db,
  ) {
    const rows = await executor.insert(vehicle).values(values).returning();
    return rows[0];
  }

  async findById(id: string) {
    const rows = await this.db
      .select()
      .from(vehicle)
      .where(eq(vehicle.id, id))
      .limit(1);
    return rows[0];
  }

  async list(
    limit = 50,
    offset = 0,
    organizationId?: string,
    authorizedNodeIds?: string[],
    includeUnassigned = false,
    search?: string,
    sort?: string,
  ) {
    if (authorizedNodeIds && authorizedNodeIds.length === 0) return [];
    const term = search?.trim() ? `%${search.trim()}%` : undefined;
    const sortColumns = {
      plate: vehicle.plate,
      make: vehicle.makeCode,
      lifecycle: vehicle.lifecycleStatus,
      mulkiyaExpiry: vehicle.mulkiyaExpiry,
      createdAt: vehicle.createdAtUtc,
    } as const;
    const [sortField, sortDir] = (sort ?? 'createdAt:desc').split(':');
    const sortColumn =
      sortColumns[sortField as keyof typeof sortColumns] ?? vehicle.createdAtUtc;
    const orderBy = sortDir === 'asc' ? asc(sortColumn) : desc(sortColumn);
    return this.db
      .select({
        vehicle,
        hierarchyNodeId: hierarchyNode.id,
        hierarchyNodeName: hierarchyNode.name,
        hierarchyNodeNameAr: hierarchyNode.nameAr,
      })
      .from(vehicle)
      .leftJoin(
        vehicleHierarchyAssignment,
        and(
          eq(vehicleHierarchyAssignment.vehicleId, vehicle.id),
          isNull(vehicleHierarchyAssignment.validTo),
        ),
      )
      .leftJoin(
        hierarchyNode,
        eq(hierarchyNode.id, vehicleHierarchyAssignment.nodeId),
      )
      .where(
        and(
          organizationId
            ? eq(vehicle.organizationId, organizationId)
            : undefined,
          authorizedNodeIds
            ? or(
                inArray(vehicleHierarchyAssignment.nodeId, authorizedNodeIds),
                includeUnassigned
                  ? isNull(vehicleHierarchyAssignment.id)
                  : undefined,
              )
            : undefined,
          term
            ? or(
                ilike(vehicle.plate, term),
                ilike(vehicle.chassisVin, term),
                ilike(vehicle.makeCode, term),
                ilike(vehicle.modelCode, term),
              )
            : undefined,
        ),
      )
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);
  }

  /** Count of scoped vehicles matching an optional search (for pagination). */
  async count(
    organizationId?: string,
    authorizedNodeIds?: string[],
    includeUnassigned = false,
    search?: string,
  ): Promise<number> {
    if (authorizedNodeIds && authorizedNodeIds.length === 0) return 0;
    const term = search?.trim() ? `%${search.trim()}%` : undefined;
    const rows = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(vehicle)
      .leftJoin(
        vehicleHierarchyAssignment,
        and(
          eq(vehicleHierarchyAssignment.vehicleId, vehicle.id),
          isNull(vehicleHierarchyAssignment.validTo),
        ),
      )
      .where(
        and(
          organizationId
            ? eq(vehicle.organizationId, organizationId)
            : undefined,
          authorizedNodeIds
            ? or(
                inArray(vehicleHierarchyAssignment.nodeId, authorizedNodeIds),
                includeUnassigned
                  ? isNull(vehicleHierarchyAssignment.id)
                  : undefined,
              )
            : undefined,
          term
            ? or(
                ilike(vehicle.plate, term),
                ilike(vehicle.chassisVin, term),
                ilike(vehicle.makeCode, term),
                ilike(vehicle.modelCode, term),
              )
            : undefined,
        ),
      );
    return rows[0]?.total ?? 0;
  }

  /** Scoped fleet counts for the registry summary tiles. */
  async summary(
    organizationId?: string,
    authorizedNodeIds?: string[],
    includeUnassigned = false,
  ) {
    if (authorizedNodeIds && authorizedNodeIds.length === 0) {
      return { total: 0, active: 0, inUse: 0, maintenance: 0, blocked: 0 };
    }
    const rows = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${vehicle.lifecycleStatus} = 'Active')::int`,
        inUse: sql<number>`count(*) filter (where ${vehicle.lifecycleStatus} = 'InUse')::int`,
        maintenance: sql<number>`count(*) filter (where ${vehicle.lifecycleStatus} = 'UnderMaintenance')::int`,
        blocked: sql<number>`count(*) filter (where ${vehicle.mulkiyaExpiry} is null or ${vehicle.mulkiyaExpiry} < current_date or ${vehicle.insuranceExpiry} is null or ${vehicle.insuranceExpiry} < current_date)::int`,
      })
      .from(vehicle)
      .leftJoin(
        vehicleHierarchyAssignment,
        and(
          eq(vehicleHierarchyAssignment.vehicleId, vehicle.id),
          isNull(vehicleHierarchyAssignment.validTo),
        ),
      )
      .where(
        and(
          organizationId
            ? eq(vehicle.organizationId, organizationId)
            : undefined,
          authorizedNodeIds
            ? or(
                inArray(vehicleHierarchyAssignment.nodeId, authorizedNodeIds),
                includeUnassigned
                  ? isNull(vehicleHierarchyAssignment.id)
                  : undefined,
              )
            : undefined,
        ),
      );
    return rows[0];
  }

  async update(
    id: string,
    set: Partial<typeof vehicle.$inferInsert>,
    executor: Executor = this.db,
  ) {
    const rows = await executor
      .update(vehicle)
      .set({ ...set, updatedAtUtc: new Date() })
      .where(eq(vehicle.id, id))
      .returning();
    return rows[0];
  }

  async insertHistory(
    values: typeof vehicleLifecycleHistory.$inferInsert,
    executor: Executor = this.db,
  ) {
    await executor.insert(vehicleLifecycleHistory).values(values);
  }

  async listHistory(vehicleId: string) {
    return this.db
      .select()
      .from(vehicleLifecycleHistory)
      .where(eq(vehicleLifecycleHistory.vehicleId, vehicleId))
      .orderBy(desc(vehicleLifecycleHistory.atUtc));
  }

  /** Next version number for a document type on a vehicle (versioned vault). */
  async nextDocumentVersion(
    vehicleId: string,
    docTypeCode: string,
  ): Promise<number> {
    const rows = await this.db
      .select({ version: vehicleDocument.version })
      .from(vehicleDocument)
      .where(
        and(
          eq(vehicleDocument.vehicleId, vehicleId),
          eq(vehicleDocument.docTypeCode, docTypeCode),
        ),
      )
      .orderBy(desc(vehicleDocument.version))
      .limit(1);
    return (rows[0]?.version ?? 0) + 1;
  }

  async insertDocument(values: typeof vehicleDocument.$inferInsert) {
    const rows = await this.db
      .insert(vehicleDocument)
      .values(values)
      .returning();
    return rows[0];
  }

  /** All document versions for a vehicle (newest per type first). */
  async listDocuments(vehicleId: string) {
    return this.db
      .select()
      .from(vehicleDocument)
      .where(eq(vehicleDocument.vehicleId, vehicleId))
      .orderBy(
        desc(vehicleDocument.docTypeCode),
        desc(vehicleDocument.version),
      );
  }

  async insertTransfer(
    values: typeof vehicleTransfer.$inferInsert,
    executor: Executor = this.db,
  ) {
    const rows = await executor
      .insert(vehicleTransfer)
      .values(values)
      .returning();
    return rows[0];
  }

  /** Transfer history (newest first), enriched with from/to node names. */
  async listTransfers(vehicleId: string) {
    const fromNode = alias(hierarchyNode, 'transfer_from_node');
    const toNode = alias(hierarchyNode, 'transfer_to_node');
    return this.db
      .select({
        id: vehicleTransfer.id,
        fromNodeId: vehicleTransfer.fromNodeId,
        toNodeId: vehicleTransfer.toNodeId,
        fromNodeName: fromNode.name,
        toNodeName: toNode.name,
        reason: vehicleTransfer.reason,
        effectiveDate: vehicleTransfer.effectiveDate,
      })
      .from(vehicleTransfer)
      .leftJoin(fromNode, eq(fromNode.id, vehicleTransfer.fromNodeId))
      .innerJoin(toNode, eq(toNode.id, vehicleTransfer.toNodeId))
      .where(eq(vehicleTransfer.vehicleId, vehicleId))
      .orderBy(desc(vehicleTransfer.effectiveDate));
  }

  /** The currently-active hierarchy assignment for a vehicle, if any. */
  async activeAssignment(vehicleId: string) {
    const rows = await this.db
      .select()
      .from(vehicleHierarchyAssignment)
      .where(
        and(
          eq(vehicleHierarchyAssignment.vehicleId, vehicleId),
          isNull(vehicleHierarchyAssignment.validTo),
        ),
      )
      .limit(1);
    return rows[0];
  }

  async expireAssignment(
    id: string,
    executor: Executor = this.db,
    at: Date = new Date(),
  ) {
    await executor
      .update(vehicleHierarchyAssignment)
      .set({ validTo: at, updatedAtUtc: new Date() })
      .where(eq(vehicleHierarchyAssignment.id, id));
  }

  async insertAssignment(
    values: typeof vehicleHierarchyAssignment.$inferInsert,
    executor: Executor = this.db,
  ) {
    await executor.insert(vehicleHierarchyAssignment).values(values);
  }

  /** Runs a set of writes in one transaction (state + history + outbox atomicity). */
  transaction<T>(work: (tx: DrizzleDatabase) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }
}
