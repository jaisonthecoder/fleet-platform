import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import {
  DEFAULT_ORGANIZATION_ID,
  hierarchyNode,
  policyRule,
  policyVersion,
} from '../../../common/database/schema';
import type { DecisionTable } from '../internal/decision-table';

/**
 * Data access for the policy engine (PAP write side + PDP read-through). Hides
 * Drizzle and the `policy_rule` / `policy_version` governance lifecycle: only
 * one rule per type is `Active` at a time, and every version is immutable.
 */
@Injectable()
export class PolicyRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  /**
   * Loads the compiled decision table for the currently-active rule of a type,
   * or null if none is active. The full compiled table is stored verbatim in
   * the immutable `policy_version.decision_table` JSONB, so the PDP reads it
   * back without recompiling.
   */
  async loadActiveTable(
    ruleType: string,
    organizationId = DEFAULT_ORGANIZATION_ID,
    requestedScopeNodeId?: string | null,
    effectiveAt = new Date(),
  ): Promise<{ table: DecisionTable; resolvedScopeNodeId: string | null; policyRuleId: string; policyVersionId: string } | null> {
    const target = requestedScopeNodeId
      ? await this.db
          .select({ path: hierarchyNode.path })
          .from(hierarchyNode)
          .where(
            and(
              eq(hierarchyNode.id, requestedScopeNodeId),
              eq(hierarchyNode.organizationId, organizationId),
              lte(hierarchyNode.validFrom, effectiveAt),
              or(isNull(hierarchyNode.validTo), gt(hierarchyNode.validTo, effectiveAt)),
            ),
          )
          .limit(1)
      : [];
    if (requestedScopeNodeId && !target[0]) return null;

    const rows = await this.db
      .select({
        policyRuleId: policyRule.id,
        policyVersionId: policyVersion.id,
        decisionTable: policyVersion.decisionTable,
        scopeNodeId: policyRule.scopeNodeId,
      })
      .from(policyRule)
      .innerJoin(policyVersion, eq(policyVersion.policyRuleId, policyRule.id))
      .leftJoin(hierarchyNode, eq(hierarchyNode.id, policyRule.scopeNodeId))
      .where(
        and(
          eq(policyRule.organizationId, organizationId),
          eq(policyRule.ruleType, ruleType),
          eq(policyRule.status, 'Active'),
          or(isNull(policyRule.effectiveFrom), lte(policyRule.effectiveFrom, effectiveAt)),
          or(isNull(policyRule.effectiveTo), gt(policyRule.effectiveTo, effectiveAt)),
          requestedScopeNodeId
            ? or(
                isNull(policyRule.scopeNodeId),
                sql`${hierarchyNode.path} @> ${target[0].path}::ltree`,
              )
            : isNull(policyRule.scopeNodeId),
        ),
      )
      .orderBy(
        desc(sql`coalesce(nlevel(${hierarchyNode.path}), -1)`),
        desc(policyVersion.version),
      )
      .limit(1);

    const row = rows[0];
    return row
      ? {
          table: row.decisionTable as DecisionTable,
          resolvedScopeNodeId: row.scopeNodeId ?? null,
          policyRuleId: row.policyRuleId,
          policyVersionId: row.policyVersionId,
        }
      : null;
  }

  /**
   * Activates a compiled decision table (PAP): supersedes any currently-active
   * rule of the same type and inserts a new immutable, monotonically-versioned
   * `Active` rule + version — atomically, so no window has two active rules.
   */
  async activate(
    compiled: DecisionTable,
    organizationId = DEFAULT_ORGANIZATION_ID,
    scopeNodeId?: string | null,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const now = new Date();

      const latest = await tx
        .select({ version: policyVersion.version })
        .from(policyVersion)
        .innerJoin(policyRule, eq(policyRule.id, policyVersion.policyRuleId))
        .where(
          and(
            eq(policyRule.organizationId, organizationId),
            eq(policyRule.ruleType, compiled.ruleType),
          ),
        )
        .orderBy(desc(policyVersion.version))
        .limit(1);
      const nextVersion = (latest[0]?.version ?? 0) + 1;

      await tx
        .update(policyRule)
        .set({ status: 'Superseded', effectiveTo: now })
        .where(
          and(
            eq(policyRule.organizationId, organizationId),
            eq(policyRule.ruleType, compiled.ruleType),
            scopeNodeId
              ? eq(policyRule.scopeNodeId, scopeNodeId)
              : isNull(policyRule.scopeNodeId),
            eq(policyRule.status, 'Active'),
          ),
        );

      const inserted = await tx
        .insert(policyRule)
        .values({
          organizationId,
          ruleType: compiled.ruleType,
          scopeNodeId: scopeNodeId ?? null,
          status: 'Active',
          effectiveFrom: now,
        })
        .returning({ id: policyRule.id });

      await tx.insert(policyVersion).values({
        policyRuleId: inserted[0].id,
        version: nextVersion,
        decisionTable: compiled,
        activatedAt: now,
      });
    });
  }
}
