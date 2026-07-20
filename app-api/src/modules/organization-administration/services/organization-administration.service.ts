import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DEFAULT_ORGANIZATION_ID } from '../../../common/database/schema';
import { OutboxService } from '../../../common/messaging/outbox.service';
import type {
  CreateHierarchyNode,
  CreateHierarchyLevel,
  HierarchyImpactDto,
  MoveHierarchyNode,
  OrganizationHierarchyNodeDto,
  OrganizationQualityDto,
  OrganizationWorkspaceDto,
  RenameHierarchyNode,
  ReactivateHierarchyNode,
  ReorderHierarchyLevels,
  RetireHierarchyNode,
  UpdateHierarchyLevel,
} from '../../../contracts/organization.contract';
import { AuditService } from '../../platform/services/audit.service';
import { toDbException } from '../../vehicles/internal/pg-error';
import { OrganizationRepository } from '../repositories/organization.repository';

@Injectable()
export class OrganizationAdministrationService {
  constructor(
    private readonly repo: OrganizationRepository,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  /** Returns organization settings, enriched tree, and quality status. */
  async workspace(
    organizationId = DEFAULT_ORGANIZATION_ID,
  ): Promise<OrganizationWorkspaceDto> {
    const [organization, levels, rows, metrics, quality] = await Promise.all([
      this.repo.findOrganization(organizationId),
      this.repo.listLevels(organizationId),
      this.repo.listActiveHierarchy(organizationId),
      this.repo.hierarchyMetrics(organizationId),
      this.quality(organizationId),
    ]);
    if (!organization) {
      throw new NotFoundException({
        title: 'Organization not found',
        reasons: [`organization-not-found:${organizationId}`],
      });
    }
    return {
      organization: {
        id: organization.id,
        code: organization.code,
        name: organization.name,
        defaultCurrency: organization.defaultCurrency,
        defaultTimezone: organization.defaultTimezone,
        revision: organization.revision,
        createdAtUtc: organization.createdAtUtc.toISOString(),
        updatedAtUtc: organization.updatedAtUtc.toISOString(),
      },
      levels,
      hierarchy: this.buildTree(rows, metrics),
      quality,
    };
  }

  /** Adds an optional hierarchy level after the current configured levels. */
  async createLevel(
    organizationId: string,
    input: CreateHierarchyLevel,
    actorRef: string,
  ) {
    const levels = await this.repo.listLevels(organizationId);
    if (levels.length >= 5) {
      throw new ConflictException({
        title: 'Maximum hierarchy levels reached',
        reasons: ['hierarchy-level-limit:5'],
      });
    }
    try {
      const created = await this.repo.transaction(async (tx) => {
        const row = await this.repo.insertLevel(
          {
            organizationId,
            code: input.code,
            position: levels.length,
            labelEn: input.labelEn,
            labelAr: input.labelAr,
            mandatory: false,
          },
          tx,
        );
        await this.audit.record(
          { organizationId, actorRef, action: 'HIERARCHY_LEVEL_CREATED', entityRef: `hierarchy-level:${row.id}`, after: row, reason: input.reason },
          tx,
        );
        await this.outbox.enqueue(
          { aggregateType: 'hierarchy-level', aggregateId: row.id, eventType: 'HierarchyLevelChanged', payload: { organizationId, code: row.code, change: 'created' } },
          tx,
        );
        return row;
      });
      return created;
    } catch (error) {
      throw toDbException(error);
    }
  }

  /** Updates bilingual hierarchy level labels at an expected revision. */
  async updateLevel(
    levelId: string,
    organizationId: string,
    input: UpdateHierarchyLevel,
    actorRef: string,
  ) {
    return this.repo.transaction(async (tx) => {
      const updated = await this.repo.updateLevel(levelId, organizationId, input.expectedRevision, input.labelEn, input.labelAr, tx);
      if (!updated) throw this.revisionConflict(input.expectedRevision, 0);
      await this.audit.record(
        { organizationId, actorRef, action: 'HIERARCHY_LEVEL_UPDATED', entityRef: `hierarchy-level:${levelId}`, after: updated, reason: input.reason },
        tx,
      );
      await this.outbox.enqueue(
        { aggregateType: 'hierarchy-level', aggregateId: levelId, eventType: 'HierarchyLevelChanged', payload: { organizationId, code: updated.code, change: 'updated' } },
        tx,
      );
      return updated;
    });
  }

  /** Reorders level cards only when populated hierarchy edges remain sequential. */
  async reorderLevels(
    organizationId: string,
    input: ReorderHierarchyLevels,
    actorRef: string,
  ) {
    const [organization, levels, edges] = await Promise.all([
      this.repo.findOrganization(organizationId),
      this.repo.listLevels(organizationId),
      this.repo.hierarchyLevelEdges(organizationId),
    ]);
    if (!organization) throw new NotFoundException({ title: 'Organization not found', reasons: [`organization-not-found:${organizationId}`] });
    const currentCodes = levels.map((level) => level.code).sort();
    const proposedCodes = [...input.orderedCodes].sort();
    if (JSON.stringify(currentCodes) !== JSON.stringify(proposedCodes)) {
      throw new ConflictException({ title: 'Hierarchy level set changed', reasons: ['hierarchy-level-set-mismatch'] });
    }
    const position = new Map(input.orderedCodes.map((code, index) => [code, index]));
    const incompatible = edges.filter(
      (edge) => position.get(edge.childCode) !== (position.get(edge.parentCode) ?? -2) + 1,
    );
    if (incompatible.length) {
      throw new ConflictException({
        title: 'Level reorder would invalidate populated hierarchy',
        reasons: incompatible.map((edge) => `hierarchy-level-edge:${edge.parentCode}:${edge.childCode}`),
      });
    }
    if (organization.revision !== input.expectedOrganizationRevision) {
      throw this.revisionConflict(input.expectedOrganizationRevision, organization.revision);
    }
    await this.repo.transaction(async (tx) => {
      await this.repo.reorderLevels(organizationId, input.orderedCodes, tx);
      const touched = await this.repo.touchOrganization(organizationId, input.expectedOrganizationRevision, tx);
      if (!touched) throw this.revisionConflict(input.expectedOrganizationRevision, organization.revision);
      await this.audit.record(
        { organizationId, actorRef, action: 'HIERARCHY_LEVELS_REORDERED', entityRef: `organization:${organizationId}`, before: levels.map((level) => level.code), after: input.orderedCodes, reason: input.reason },
        tx,
      );
      await this.outbox.enqueue(
        { aggregateType: 'organization', aggregateId: organizationId, eventType: 'HierarchyLevelsReordered', payload: { organizationId, orderedCodes: input.orderedCodes } },
        tx,
      );
    });
    return this.repo.listLevels(organizationId);
  }

  /** Calculates organization hierarchy readiness and stable reason codes. */
  async quality(
    organizationId = DEFAULT_ORGANIZATION_ID,
  ): Promise<OrganizationQualityDto> {
    const counts = await this.repo.qualityCounts(organizationId);
    const reasons: string[] = [];
    if (counts.activeRoots !== 1) {
      reasons.push(`organization-active-root-count:${counts.activeRoots}`);
    }
    if (counts.missingCodes > 0) {
      reasons.push(`hierarchy-missing-codes:${counts.missingCodes}`);
    }
    if (counts.missingArabicNames > 0) {
      reasons.push(`hierarchy-missing-arabic-names:${counts.missingArabicNames}`);
    }
    if (counts.missingLevelCodes > 0) {
      reasons.push(`hierarchy-missing-level-codes:${counts.missingLevelCodes}`);
    }
    if (counts.peopleWithoutHomeScope > 0) {
      reasons.push(`people-without-home-scope:${counts.peopleWithoutHomeScope}`);
    }
    return { ...counts, healthy: reasons.length === 0, reasons };
  }

  /** Returns dependency counts used to guard hierarchy retirement. */
  async impact(
    nodeId: string,
    organizationId: string,
    targetParentId?: string,
  ): Promise<HierarchyImpactDto> {
    const impact = await this.repo.impact(nodeId, organizationId);
    if (!impact) {
      throw new NotFoundException({
        title: 'Hierarchy node not found',
        reasons: [`hierarchy-node-not-found:${nodeId}`],
      });
    }
    const reasons = Object.entries({
      childNodes: impact.childNodes,
      people: impact.people,
      roles: impact.roles,
      vehicles: impact.vehicles,
      entitlements: impact.entitlements,
      policyRules: impact.policyRules,
    })
      .filter(([, count]) => count > 0)
      .map(([key, count]) => `hierarchy-dependency:${key}:${count}`);
    const impactToken = this.impactToken({
      nodeId,
      revision: impact.node.revision,
      targetParentId: targetParentId ?? null,
      counts: reasons,
    });
    return {
      nodeId,
      childNodes: impact.childNodes,
      people: impact.people,
      roles: impact.roles,
      vehicles: impact.vehicles,
      entitlements: impact.entitlements,
      policyRules: impact.policyRules,
      blocking: reasons.length > 0,
      reasons,
      impactToken,
    };
  }

  /** Returns append-only hierarchy change history for one organization node. */
  async history(nodeId: string, organizationId: string) {
    await this.requireNode(nodeId, organizationId);
    return this.repo.listHistory(nodeId, organizationId);
  }

  /** Returns recently retired nodes for governed reactivation. */
  async retired(organizationId: string) {
    return (await this.repo.listRetiredHierarchy(organizationId)).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      nameAr: row.nameAr,
      levelCode: row.levelCode,
      levelLabel: row.levelLabel,
      path: row.path,
      revision: row.revision,
      validTo: row.validTo?.toISOString() ?? null,
    }));
  }

  /** Returns selected-node metrics, scoped roles, transfers, and restructures. */
  async nodeDetail(nodeId: string, organizationId: string) {
    const row = await this.requireNode(nodeId, organizationId);
    const [parent, metric, scopedRoles, transfers, changes] = await Promise.all([
      row.parentId ? this.repo.findNode(row.parentId, organizationId) : Promise.resolve(undefined),
      this.repo.nodeMetrics(nodeId, organizationId),
      this.repo.listScopedRoles(nodeId, organizationId),
      this.repo.listRecentTransfers(nodeId, organizationId),
      this.repo.listHistory(nodeId, organizationId),
    ]);
    const vehicleCount = metric.vehicleCount;
    const node: OrganizationHierarchyNodeDto = {
      id: row.id,
      organizationId: row.organizationId,
      parentId: row.parentId,
      parentCode: parent?.code ?? null,
      parentName: parent?.name ?? null,
      code: row.code,
      levelIndex: row.levelIndex,
      levelCode: row.levelCode,
      levelLabel: row.levelLabel,
      name: row.name,
      nameAr: row.nameAr,
      path: row.path,
      validFrom: row.validFrom.toISOString(),
      validTo: row.validTo?.toISOString() ?? null,
      revision: row.revision,
      childCount: (await this.repo.impact(nodeId, organizationId))?.childNodes ?? 0,
      vehicleCount,
      userCount: metric.userCount,
      utilizedVehicleCount: metric.utilizedVehicleCount,
      utilizationPercent: vehicleCount > 0 ? Math.round((metric.utilizedVehicleCount / vehicleCount) * 100) : 0,
      children: [],
    };
    return {
      node,
      scopedRoles,
      recentTransfers: transfers.map((transfer) => ({
        ...transfer,
        effectiveDate: transfer.effectiveDate.toISOString(),
      })),
      recentChanges: changes.slice(0, 10).map((change) => ({
        id: change.id,
        action: change.action,
        actorRef: change.actorRef,
        reason: change.reason,
        atUtc: change.atUtc.toISOString(),
      })),
    };
  }

  /** Creates a child scope with a stable code and server-computed ltree path. */
  async createNode(
    organizationId: string,
    input: CreateHierarchyNode,
    actorRef: string,
  ) {
    const parent = await this.requireNode(input.parentId, organizationId);
    const pathComponent = input.code.toLowerCase().replaceAll('-', '_');
    try {
      return await this.repo.transaction(async (tx) => {
        const created = await this.repo.insertNode(
          {
            organizationId,
            parentId: parent.id,
            code: input.code,
            levelIndex: parent.levelIndex + 1,
            levelLabel: input.levelLabel,
            levelCode: input.levelCode,
            name: input.name,
            nameAr: input.nameAr,
            path: `${parent.path}.${pathComponent}`,
          },
          tx,
        );
        await this.repo.insertChange(
          {
            organizationId,
            nodeId: created.id,
            action: 'CREATED',
            actorRef,
            reason: input.reason,
            afterSnapshot: created,
          },
          tx,
        );
        await this.audit.record(
          {
            organizationId,
            actorRef,
            action: 'HIERARCHY_NODE_CREATED',
            entityRef: `hierarchy-node:${created.id}`,
            after: created,
            reason: input.reason,
          },
          tx,
        );
        await this.outbox.enqueue(
          {
            aggregateType: 'hierarchy-node',
            aggregateId: created.id,
            eventType: 'HierarchyNodeCreated',
            payload: { organizationId, nodeId: created.id, code: created.code },
          },
          tx,
        );
        return created;
      });
    } catch (error) {
      throw toDbException(error);
    }
  }

  /** Renames bilingual labels without changing stable code or ancestry path. */
  async renameNode(
    nodeId: string,
    organizationId: string,
    input: RenameHierarchyNode,
    actorRef: string,
  ) {
    const before = await this.requireNode(nodeId, organizationId);
    try {
      return await this.repo.transaction(async (tx) => {
        const updated = await this.repo.renameNode(
          nodeId,
          input.expectedRevision,
          input.name,
          input.nameAr,
          tx,
        );
        if (!updated) throw this.revisionConflict(input.expectedRevision, before.revision);
        await this.repo.insertChange(
          { organizationId, nodeId, action: 'RENAMED', actorRef, reason: input.reason, beforeSnapshot: before, afterSnapshot: updated },
          tx,
        );
        await this.audit.record(
          { organizationId, actorRef, action: 'HIERARCHY_NODE_RENAMED', entityRef: `hierarchy-node:${nodeId}`, before, after: updated, reason: input.reason },
          tx,
        );
        await this.outbox.enqueue(
          { aggregateType: 'hierarchy-node', aggregateId: nodeId, eventType: 'HierarchyNodeRenamed', payload: { organizationId, nodeId, revision: updated.revision } },
          tx,
        );
        return updated;
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw toDbException(error);
    }
  }

  /** Retires a leaf node only when no active dependency would be orphaned. */
  async retireNode(
    nodeId: string,
    organizationId: string,
    input: RetireHierarchyNode,
    actorRef: string,
  ) {
    const impact = await this.impact(nodeId, organizationId);
    if (impact.blocking) {
      throw new ConflictException({
        title: 'Hierarchy node has active dependencies',
        reasons: impact.reasons,
      });
    }
    const before = await this.requireNode(nodeId, organizationId);
    try {
      return await this.repo.transaction(async (tx) => {
        const retired = await this.repo.retireNode(nodeId, input.expectedRevision, tx);
        if (!retired) throw this.revisionConflict(input.expectedRevision, before.revision);
        await this.repo.insertChange(
          { organizationId, nodeId, action: 'RETIRED', actorRef, reason: input.reason, beforeSnapshot: before, afterSnapshot: retired },
          tx,
        );
        await this.audit.record(
          { organizationId, actorRef, action: 'HIERARCHY_NODE_RETIRED', entityRef: `hierarchy-node:${nodeId}`, before, after: retired, reason: input.reason },
          tx,
        );
        await this.outbox.enqueue(
          { aggregateType: 'hierarchy-node', aggregateId: nodeId, eventType: 'HierarchyNodeRetired', payload: { organizationId, nodeId, revision: retired.revision } },
          tx,
        );
        return retired;
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw toDbException(error);
    }
  }

  /** Reactivates a retired node when its parent and uniqueness constraints remain valid. */
  async reactivateNode(
    nodeId: string,
    organizationId: string,
    input: ReactivateHierarchyNode,
    actorRef: string,
  ) {
    const before = await this.requireNode(nodeId, organizationId);
    if (!before.validTo) {
      throw new ConflictException({
        title: 'Hierarchy node is already active',
        reasons: [`hierarchy-node-already-active:${nodeId}`],
      });
    }
    if (before.parentId) {
      const parent = await this.requireNode(before.parentId, organizationId);
      if (parent.validTo) {
        throw new ConflictException({
          title: 'Hierarchy parent is retired',
          reasons: [`hierarchy-parent-retired:${parent.id}`],
        });
      }
    }
    const levels = await this.repo.listLevels(organizationId);
    if (!levels.some((level) => level.code === before.levelCode && level.active)) {
      throw new ConflictException({
        title: 'Hierarchy level is not active',
        reasons: [`hierarchy-level-inactive:${before.levelCode}`],
      });
    }
    try {
      return await this.repo.transaction(async (tx) => {
        const reactivated = await this.repo.reactivateNode(nodeId, input.expectedRevision, tx);
        if (!reactivated) throw this.revisionConflict(input.expectedRevision, before.revision);
        await this.repo.insertChange(
          { organizationId, nodeId, action: 'REACTIVATED', actorRef, reason: input.reason, beforeSnapshot: before, afterSnapshot: reactivated },
          tx,
        );
        await this.audit.record(
          { organizationId, actorRef, action: 'HIERARCHY_NODE_REACTIVATED', entityRef: `hierarchy-node:${nodeId}`, before, after: reactivated, reason: input.reason },
          tx,
        );
        await this.outbox.enqueue(
          { aggregateType: 'hierarchy-node', aggregateId: nodeId, eventType: 'HierarchyNodeReactivated', payload: { organizationId, nodeId, revision: reactivated.revision } },
          tx,
        );
        return reactivated;
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw toDbException(error);
    }
  }

  /** Moves a subtree after validating ancestry, level, revision, and impact token. */
  async moveNode(
    nodeId: string,
    organizationId: string,
    input: MoveHierarchyNode,
    actorRef: string,
  ) {
    const [node, target, impact] = await Promise.all([
      this.requireNode(nodeId, organizationId),
      this.requireNode(input.targetParentId, organizationId),
      this.impact(nodeId, organizationId, input.targetParentId),
    ]);
    if (target.path === node.path || target.path.startsWith(`${node.path}.`)) {
      throw new ConflictException({
        title: 'Hierarchy move would create a cycle',
        reasons: [`hierarchy-cycle-detected:${nodeId}:${target.id}`],
      });
    }
    if (target.levelIndex + 1 !== node.levelIndex) {
      throw new ConflictException({
        title: 'Hierarchy move changes the node level',
        reasons: [`hierarchy-move-level-mismatch:${node.levelIndex}:${target.levelIndex}`],
      });
    }
    if (impact.impactToken !== input.impactToken) {
      throw new ConflictException({
        title: 'Hierarchy impact changed',
        reasons: ['hierarchy-impact-token-stale'],
      });
    }
    try {
      return await this.repo.transaction(async (tx) => {
        const moved = await this.repo.moveSubtree(
          nodeId,
          target.id,
          input.expectedRevision,
          organizationId,
          tx,
        );
        if (!moved.node) throw this.revisionConflict(input.expectedRevision, moved.before?.revision ?? 0);
        await this.repo.insertChange(
          { organizationId, nodeId, action: 'MOVED', actorRef, reason: input.reason, beforeSnapshot: node, afterSnapshot: moved.node },
          tx,
        );
        await this.audit.record(
          { organizationId, actorRef, action: 'HIERARCHY_SUBTREE_MOVED', entityRef: `hierarchy-node:${nodeId}`, before: node, after: moved.node, reason: input.reason },
          tx,
        );
        await this.outbox.enqueue(
          { aggregateType: 'hierarchy-node', aggregateId: nodeId, eventType: 'HierarchySubtreeMoved', payload: { organizationId, nodeId, fromParentId: node.parentId, toParentId: target.id, revision: moved.node.revision } },
          tx,
        );
        return moved.node;
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw toDbException(error);
    }
  }

  /** Loads an organization-owned hierarchy node or returns a safe 404. */
  private async requireNode(nodeId: string, organizationId: string) {
    const node = await this.repo.findNode(nodeId, organizationId);
    if (!node) {
      throw new NotFoundException({
        title: 'Hierarchy node not found',
        reasons: [`hierarchy-node-not-found:${nodeId}`],
      });
    }
    return node;
  }

  /** Creates an optimistic concurrency conflict for a stale node revision. */
  private revisionConflict(expected: number, actual: number): ConflictException {
    return new ConflictException({
      title: 'Hierarchy node changed',
      reasons: [`hierarchy-node-revision-conflict:expected-${expected}:actual-${actual}`],
    });
  }

  /** Creates a deterministic preview checksum tied to node revision and dependencies. */
  private impactToken(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  /** Builds a nested enriched hierarchy without assuming a fixed depth. */
  private buildTree(
    rows: Awaited<ReturnType<OrganizationRepository['listActiveHierarchy']>>,
    metrics: Awaited<ReturnType<OrganizationRepository['hierarchyMetrics']>>,
  ): OrganizationHierarchyNodeDto[] {
    const nodes = new Map<string, OrganizationHierarchyNodeDto>();
    const metricsByNode = new Map(metrics.map((metric) => [metric.nodeId, metric]));
    for (const row of rows) {
      nodes.set(row.id, {
        id: row.id,
        organizationId: row.organizationId,
        parentId: row.parentId,
        parentCode: null,
        parentName: null,
        code: row.code,
        levelIndex: row.levelIndex,
        levelCode: row.levelCode ?? row.levelLabel.toUpperCase(),
        levelLabel: row.levelLabel,
        name: row.name,
        nameAr: row.nameAr ?? row.name,
        path: row.path,
        validFrom: row.validFrom.toISOString(),
        validTo: row.validTo?.toISOString() ?? null,
        revision: row.revision,
        childCount: 0,
        vehicleCount: metricsByNode.get(row.id)?.vehicleCount ?? 0,
        userCount: metricsByNode.get(row.id)?.userCount ?? 0,
        utilizedVehicleCount: metricsByNode.get(row.id)?.utilizedVehicleCount ?? 0,
        utilizationPercent:
          (metricsByNode.get(row.id)?.vehicleCount ?? 0) > 0
            ? Math.round(
                ((metricsByNode.get(row.id)?.utilizedVehicleCount ?? 0) /
                  (metricsByNode.get(row.id)?.vehicleCount ?? 1)) *
                  100,
              )
            : 0,
        children: [],
      });
    }
    const roots: OrganizationHierarchyNodeDto[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      if (parent) {
        node.parentCode = parent.code;
        node.parentName = parent.name;
        parent.children.push(node);
        parent.childCount += 1;
      } else {
        roots.push(node);
      }
    }
    return roots;
  }
}
