import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import {
  hierarchyNode,
  hierarchyChangeEvent,
  organizationHierarchyLevel,
  organization,
  person,
  policyRule,
  roleAssignment,
  entitlementRequest,
  vehicleHierarchyAssignment,
} from '../../../common/database/schema';

@Injectable()
export class OrganizationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  /** Returns one organization by id. */
  async findOrganization(id: string) {
    const rows = await this.db
      .select()
      .from(organization)
      .where(eq(organization.id, id))
      .limit(1);
    return rows[0];
  }

  /** Bumps organization revision only when the caller holds the current revision. */
  async touchOrganization(id: string, revision: number, executor: DrizzleDatabase) {
    const rows = await executor
      .update(organization)
      .set({ updatedAtUtc: new Date() })
      .where(and(eq(organization.id, id), eq(organization.revision, revision)))
      .returning();
    return rows[0];
  }

  /** Returns populated parent-child level-code edges for reorder compatibility. */
  async hierarchyLevelEdges(organizationId: string) {
    const rows = await this.db.execute(sql`
      SELECT DISTINCT p.level_code AS "parentCode", c.level_code AS "childCode"
      FROM fleet.hierarchy_node c
      JOIN fleet.hierarchy_node p ON p.id = c.parent_id
      WHERE c.organization_id = ${organizationId}::uuid
        AND c.valid_to IS NULL AND p.valid_to IS NULL
    `);
    return rows as unknown as Array<{ parentCode: string; childCode: string }>;
  }

  /** Returns currently effective nodes for an organization in path order. */
  async listActiveHierarchy(organizationId: string) {
    const now = new Date();
    return this.db
      .select()
      .from(hierarchyNode)
      .where(
        and(
          eq(hierarchyNode.organizationId, organizationId),
          lte(hierarchyNode.validFrom, now),
          or(isNull(hierarchyNode.validTo), gt(hierarchyNode.validTo, now)),
        ),
      )
      .orderBy(hierarchyNode.path);
  }

  /** Returns active hierarchy level definitions with direct node counts. */
  async listLevels(organizationId: string) {
    return this.db
      .select({
        id: organizationHierarchyLevel.id,
        code: organizationHierarchyLevel.code,
        position: organizationHierarchyLevel.position,
        labelEn: organizationHierarchyLevel.labelEn,
        labelAr: organizationHierarchyLevel.labelAr,
        mandatory: organizationHierarchyLevel.mandatory,
        active: organizationHierarchyLevel.active,
        revision: organizationHierarchyLevel.revision,
        nodeCount: sql<number>`count(${hierarchyNode.id})::int`,
      })
      .from(organizationHierarchyLevel)
      .leftJoin(
        hierarchyNode,
        and(
          eq(hierarchyNode.organizationId, organizationHierarchyLevel.organizationId),
          eq(hierarchyNode.levelCode, organizationHierarchyLevel.code),
          isNull(hierarchyNode.validTo),
        ),
      )
      .where(
        and(
          eq(organizationHierarchyLevel.organizationId, organizationId),
          eq(organizationHierarchyLevel.active, true),
        ),
      )
      .groupBy(organizationHierarchyLevel.id)
      .orderBy(organizationHierarchyLevel.position);
  }

  /** Returns rollup vehicle/user/utilization metrics for every active node. */
  async hierarchyMetrics(organizationId: string) {
    return this.db.execute(sql`
      SELECT ancestor.id AS "nodeId",
        count(DISTINCT vha.vehicle_id)::int AS "vehicleCount",
        count(DISTINCT p.id)::int AS "userCount",
        count(DISTINCT b.vehicle_id) FILTER (
          WHERE b.status IN ('PendingApproval','Approved','Active')
        )::int AS "utilizedVehicleCount"
      FROM fleet.hierarchy_node ancestor
      LEFT JOIN fleet.hierarchy_node descendant
        ON descendant.organization_id = ancestor.organization_id
       AND descendant.path <@ ancestor.path
       AND descendant.valid_to IS NULL
      LEFT JOIN fleet.vehicle_hierarchy_assignment vha
        ON vha.organization_id = ancestor.organization_id
       AND vha.node_id = descendant.id
       AND vha.valid_to IS NULL
      LEFT JOIN fleet.person p
        ON p.organization_id = ancestor.organization_id
       AND p.home_pool_node_id = descendant.id
       AND p.employment_status = 'Active'
      LEFT JOIN fleet.booking b
        ON b.organization_id = ancestor.organization_id
       AND b.vehicle_id = vha.vehicle_id
      WHERE ancestor.organization_id = ${organizationId}::uuid
        AND ancestor.valid_to IS NULL
      GROUP BY ancestor.id
    `) as unknown as Array<{
      nodeId: string;
      vehicleCount: number;
      userCount: number;
      utilizedVehicleCount: number;
    }>;
  }

  /** Returns rollup metrics for one selected node without hydrating the whole tree. */
  async nodeMetrics(nodeId: string, organizationId: string) {
    const rows = await this.db.execute(sql`
      SELECT count(DISTINCT vha.vehicle_id)::int AS "vehicleCount",
        count(DISTINCT p.id)::int AS "userCount",
        count(DISTINCT b.vehicle_id) FILTER (
          WHERE b.status IN ('PendingApproval','Approved','Active')
        )::int AS "utilizedVehicleCount"
      FROM fleet.hierarchy_node ancestor
      LEFT JOIN fleet.hierarchy_node descendant
        ON descendant.organization_id = ancestor.organization_id
       AND descendant.path <@ ancestor.path
       AND descendant.valid_to IS NULL
      LEFT JOIN fleet.vehicle_hierarchy_assignment vha
        ON vha.organization_id = ancestor.organization_id
       AND vha.node_id = descendant.id AND vha.valid_to IS NULL
      LEFT JOIN fleet.person p
        ON p.organization_id = ancestor.organization_id
       AND p.home_pool_node_id = descendant.id
       AND p.employment_status = 'Active'
      LEFT JOIN fleet.booking b
        ON b.organization_id = ancestor.organization_id AND b.vehicle_id = vha.vehicle_id
      WHERE ancestor.id = ${nodeId}::uuid
        AND ancestor.organization_id = ${organizationId}::uuid
      GROUP BY ancestor.id
    `) as unknown as Array<{ vehicleCount: number; userCount: number; utilizedVehicleCount: number }>;
    return rows[0] ?? { vehicleCount: 0, userCount: 0, utilizedVehicleCount: 0 };
  }

  /** Inserts an optional organization hierarchy level. */
  async insertLevel(
    values: typeof organizationHierarchyLevel.$inferInsert,
    executor: DrizzleDatabase,
  ) {
    const rows = await executor.insert(organizationHierarchyLevel).values(values).returning();
    return rows[0];
  }

  /** Updates bilingual level labels with optimistic revision protection. */
  async updateLevel(
    id: string,
    organizationId: string,
    revision: number,
    labelEn: string,
    labelAr: string,
    executor: DrizzleDatabase,
  ) {
    const rows = await executor
      .update(organizationHierarchyLevel)
      .set({ labelEn, labelAr })
      .where(
        and(
          eq(organizationHierarchyLevel.id, id),
          eq(organizationHierarchyLevel.organizationId, organizationId),
          eq(organizationHierarchyLevel.revision, revision),
        ),
      )
      .returning();
    return rows[0];
  }

  /** Reorders hierarchy levels using temporary positions inside one transaction. */
  async reorderLevels(
    organizationId: string,
    orderedCodes: string[],
    executor: DrizzleDatabase,
  ) {
    for (let index = 0; index < orderedCodes.length; index += 1) {
      await executor
        .update(organizationHierarchyLevel)
        .set({ position: 100 + index })
        .where(
          and(
            eq(organizationHierarchyLevel.organizationId, organizationId),
            eq(organizationHierarchyLevel.code, orderedCodes[index]),
          ),
        );
    }
    for (let index = 0; index < orderedCodes.length; index += 1) {
      await executor
        .update(organizationHierarchyLevel)
        .set({ position: index })
        .where(
          and(
            eq(organizationHierarchyLevel.organizationId, organizationId),
            eq(organizationHierarchyLevel.code, orderedCodes[index]),
          ),
        );
    }
  }

  /** Returns recently retired hierarchy nodes for audit/reactivation workflows. */
  async listRetiredHierarchy(organizationId: string, limit = 50) {
    return this.db
      .select()
      .from(hierarchyNode)
      .where(
        and(
          eq(hierarchyNode.organizationId, organizationId),
          sql`${hierarchyNode.validTo} IS NOT NULL`,
        ),
      )
      .orderBy(desc(hierarchyNode.validTo))
      .limit(limit);
  }

  /** Returns one hierarchy node owned by an organization. */
  async findNode(id: string, organizationId: string, executor: DrizzleDatabase = this.db) {
    const rows = await executor
      .select()
      .from(hierarchyNode)
      .where(and(eq(hierarchyNode.id, id), eq(hierarchyNode.organizationId, organizationId)))
      .limit(1);
    return rows[0];
  }

  /** Counts active dependencies that make retirement unsafe. */
  async impact(id: string, organizationId: string) {
    const node = await this.findNode(id, organizationId);
    if (!node) return null;
    const prefix = `${node.path}.`;
    const [children, people, roles, vehicles, entitlements, policies] = await Promise.all([
      this.db.select({ count: sql<number>`count(*)::int` }).from(hierarchyNode).where(and(eq(hierarchyNode.organizationId, organizationId), isNull(hierarchyNode.validTo), sql`${hierarchyNode.path}::text LIKE ${`${prefix}%`}`)),
      this.db.select({ count: sql<number>`count(*)::int` }).from(person).where(and(eq(person.organizationId, organizationId), eq(person.homePoolNodeId, id))),
      this.db.select({ count: sql<number>`count(*)::int` }).from(roleAssignment).where(and(eq(roleAssignment.organizationId, organizationId), eq(roleAssignment.scopeNodeId, id), isNull(roleAssignment.validTo))),
      this.db.select({ count: sql<number>`count(*)::int` }).from(vehicleHierarchyAssignment).where(and(eq(vehicleHierarchyAssignment.organizationId, organizationId), eq(vehicleHierarchyAssignment.nodeId, id), isNull(vehicleHierarchyAssignment.validTo))),
      this.db.select({ count: sql<number>`count(*)::int` }).from(entitlementRequest).where(and(eq(entitlementRequest.organizationId, organizationId), eq(entitlementRequest.locationNodeId, id))),
      this.db.select({ count: sql<number>`count(*)::int` }).from(policyRule).where(and(eq(policyRule.organizationId, organizationId), eq(policyRule.scopeNodeId, id), eq(policyRule.status, 'Active'))),
    ]);
    return {
      node,
      childNodes: children[0]?.count ?? 0,
      people: people[0]?.count ?? 0,
      roles: roles[0]?.count ?? 0,
      vehicles: vehicles[0]?.count ?? 0,
      entitlements: entitlements[0]?.count ?? 0,
      policyRules: policies[0]?.count ?? 0,
    };
  }

  /** Inserts a hierarchy node in an open transaction. */
  async insertNode(values: typeof hierarchyNode.$inferInsert, executor: DrizzleDatabase) {
    const rows = await executor.insert(hierarchyNode).values(values).returning();
    return rows[0];
  }

  /** Renames a node with optimistic revision protection. */
  async renameNode(id: string, revision: number, name: string, nameAr: string, executor: DrizzleDatabase) {
    const rows = await executor
      .update(hierarchyNode)
      .set({ name, nameAr })
      .where(and(eq(hierarchyNode.id, id), eq(hierarchyNode.revision, revision)))
      .returning();
    return rows[0];
  }

  /** Effective-date retires a node with optimistic revision protection. */
  async retireNode(id: string, revision: number, executor: DrizzleDatabase) {
    const rows = await executor
      .update(hierarchyNode)
      .set({ validTo: new Date() })
      .where(and(eq(hierarchyNode.id, id), eq(hierarchyNode.revision, revision), isNull(hierarchyNode.validTo)))
      .returning();
    return rows[0];
  }

  /** Appends hierarchy-specific change evidence in the domain transaction. */
  async insertChange(values: typeof hierarchyChangeEvent.$inferInsert, executor: DrizzleDatabase) {
    await executor.insert(hierarchyChangeEvent).values(values);
  }

  /** Returns append-only hierarchy change events newest first. */
  async listHistory(nodeId: string, organizationId: string) {
    return this.db
      .select()
      .from(hierarchyChangeEvent)
      .where(
        and(
          eq(hierarchyChangeEvent.nodeId, nodeId),
          eq(hierarchyChangeEvent.organizationId, organizationId),
        ),
      )
      .orderBy(desc(hierarchyChangeEvent.atUtc));
  }

  /** Returns direct active role assignments on one node. */
  async listScopedRoles(nodeId: string, organizationId: string) {
    return this.db
      .select({
        assignmentId: roleAssignment.id,
        personId: person.id,
        fullName: person.fullName,
        role: roleAssignment.role,
      })
      .from(roleAssignment)
      .innerJoin(person, eq(person.id, roleAssignment.personId))
      .where(
        and(
          eq(roleAssignment.organizationId, organizationId),
          eq(roleAssignment.scopeNodeId, nodeId),
          isNull(roleAssignment.validTo),
        ),
      )
      .orderBy(roleAssignment.role, person.fullName);
  }

  /** Returns recent vehicle transfers touching the selected subtree. */
  async listRecentTransfers(nodeId: string, organizationId: string, limit = 10) {
    const rows = await this.db.execute(sql`
      SELECT vt.id, vt.vehicle_id AS "vehicleId", v.plate,
        fn.code AS "fromCode", fn.name AS "fromName",
        tn.code AS "toCode", tn.name AS "toName",
        vt.effective_date AS "effectiveDate", vt.reason
      FROM fleet.vehicle_transfer vt
      JOIN fleet.vehicle v ON v.id = vt.vehicle_id AND v.organization_id = ${organizationId}::uuid
      LEFT JOIN fleet.hierarchy_node fn ON fn.id = vt.from_node_id
      JOIN fleet.hierarchy_node tn ON tn.id = vt.to_node_id
      JOIN fleet.hierarchy_node selected ON selected.id = ${nodeId}::uuid
      WHERE fn.path <@ selected.path OR tn.path <@ selected.path
      ORDER BY vt.effective_date DESC
      LIMIT ${limit}
    `);
    return rows as unknown as Array<{
      id: string;
      vehicleId: string;
      plate: string;
      fromCode: string | null;
      fromName: string | null;
      toCode: string;
      toName: string;
      effectiveDate: Date;
      reason: string | null;
    }>;
  }

  /** Reactivates a retired node using optimistic revision protection. */
  async reactivateNode(id: string, revision: number, executor: DrizzleDatabase) {
    const rows = await executor
      .update(hierarchyNode)
      .set({ validTo: null })
      .where(
        and(
          eq(hierarchyNode.id, id),
          eq(hierarchyNode.revision, revision),
          sql`${hierarchyNode.validTo} IS NOT NULL`,
        ),
      )
      .returning();
    return rows[0];
  }

  /** Moves a subtree under a same-level parent with an organization advisory lock. */
  async moveSubtree(
    nodeId: string,
    targetParentId: string,
    expectedRevision: number,
    organizationId: string,
    executor: DrizzleDatabase,
  ) {
    await executor.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${organizationId}, 0))`,
    );
    const node = await this.findNode(nodeId, organizationId, executor);
    const target = await this.findNode(targetParentId, organizationId, executor);
    if (!node || !target || node.revision !== expectedRevision) {
      return { node: undefined, target, before: node };
    }
    const subtree = await executor
      .select()
      .from(hierarchyNode)
      .where(
        and(
          eq(hierarchyNode.organizationId, organizationId),
          sql`${hierarchyNode.path} <@ ${node.path}::ltree`,
        ),
      )
      .orderBy(asc(hierarchyNode.levelIndex));
    const component = node.path.split('.').at(-1) as string;
    const newRootPath = `${target.path}.${component}`;
    let movedRoot: typeof hierarchyNode.$inferSelect | undefined;
    for (const current of subtree) {
      const suffix = current.path.slice(node.path.length);
      const newPath = `${newRootPath}${suffix}`;
      const rows = await executor
        .update(hierarchyNode)
        .set(
          current.id === nodeId
            ? { parentId: targetParentId, path: newPath }
            : { path: newPath },
        )
        .where(eq(hierarchyNode.id, current.id))
        .returning();
      if (current.id === nodeId) movedRoot = rows[0];
    }
    return { node: movedRoot, target, before: node };
  }

  /** Runs hierarchy state, history, audit, and outbox writes atomically. */
  transaction<T>(work: (tx: DrizzleDatabase) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  /** Returns organization data-quality counts used by the admin health panel. */
  async qualityCounts(organizationId: string) {
    const [nodes, people, roles, vehicles] = await Promise.all([
      this.db
        .select({
          activeNodes: sql<number>`count(*)::int`,
          activeRoots: sql<number>`count(*) filter (where ${hierarchyNode.parentId} is null)::int`,
          missingCodes: sql<number>`count(*) filter (where nullif(trim(${hierarchyNode.code}), '') is null)::int`,
          missingArabicNames: sql<number>`count(*) filter (where nullif(trim(${hierarchyNode.nameAr}), '') is null)::int`,
          missingLevelCodes: sql<number>`count(*) filter (where nullif(trim(${hierarchyNode.levelCode}), '') is null)::int`,
        })
        .from(hierarchyNode)
        .where(and(eq(hierarchyNode.organizationId, organizationId), isNull(hierarchyNode.validTo))),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(person)
        .where(and(eq(person.organizationId, organizationId), isNull(person.homePoolNodeId))),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(roleAssignment)
        .where(and(eq(roleAssignment.organizationId, organizationId), isNull(roleAssignment.validTo))),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(vehicleHierarchyAssignment)
        .where(
          and(
            eq(vehicleHierarchyAssignment.organizationId, organizationId),
            isNull(vehicleHierarchyAssignment.validTo),
          ),
        ),
    ]);
    return {
      ...(nodes[0] ?? {
        activeNodes: 0,
        activeRoots: 0,
        missingCodes: 0,
        missingArabicNames: 0,
        missingLevelCodes: 0,
      }),
      peopleWithoutHomeScope: people[0]?.count ?? 0,
      activeRoleAssignments: roles[0]?.count ?? 0,
      activeVehicleAssignments: vehicles[0]?.count ?? 0,
    };
  }
}
