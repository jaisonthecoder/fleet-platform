import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import { policyDraft } from '../../../common/database/schema';
import type { AuthoredDecisionTable } from '../../../contracts/policy-authoring.contract';

export type PolicyDraftRow = typeof policyDraft.$inferSelect;

@Injectable()
export class PolicyDraftRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  /** Returns the mutable draft for a rule type, if one exists. */
  async find(
    organizationId: string,
    ruleType: string,
    scopeNodeId?: string | null,
  ): Promise<PolicyDraftRow | null> {
    const rows = await this.db
      .select()
      .from(policyDraft)
      .where(this.scopeWhere(organizationId, ruleType, scopeNodeId))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Returns every current draft for policy-catalog status projection. */
  async list(organizationId: string): Promise<PolicyDraftRow[]> {
    return this.db
      .select()
      .from(policyDraft)
      .where(eq(policyDraft.organizationId, organizationId));
  }

  /** Saves a draft with optimistic revision protection. */
  async save(
    organizationId: string,
    ruleType: string,
    scopeNodeId: string | null | undefined,
    table: AuthoredDecisionTable,
    expectedRevision: number,
    actorRef: string,
  ): Promise<PolicyDraftRow> {
    return this.db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(policyDraft)
        .where(this.scopeWhere(organizationId, ruleType, scopeNodeId))
        .limit(1);
      const current = existing[0];

      if (!current) {
        if (expectedRevision !== 0) {
          throw this.revisionConflict(expectedRevision, 0);
        }
        const inserted = await tx
          .insert(policyDraft)
          .values({
            organizationId,
            ruleType,
            scopeNodeId: scopeNodeId ?? null,
            authoredDefinition: table,
            createdBy: actorRef,
          })
          .returning();
        return inserted[0];
      }

      if (current.revision !== expectedRevision) {
        throw this.revisionConflict(expectedRevision, current.revision);
      }

      const updated = await tx
        .update(policyDraft)
        .set({
          authoredDefinition: table,
          revision: current.revision + 1,
          updatedAtUtc: new Date(),
        })
        .where(
          and(
            eq(policyDraft.id, current.id),
            eq(policyDraft.revision, expectedRevision),
          ),
        )
        .returning();

      if (!updated[0]) {
        throw this.revisionConflict(expectedRevision, current.revision + 1);
      }
      return updated[0];
    });
  }

  /** Removes the mutable draft after successful immutable activation. */
  async remove(
    organizationId: string,
    ruleType: string,
    scopeNodeId?: string | null,
  ): Promise<void> {
    await this.db
      .delete(policyDraft)
      .where(this.scopeWhere(organizationId, ruleType, scopeNodeId));
  }

  /** Builds a null-safe organization/rule/scope predicate. */
  private scopeWhere(
    organizationId: string,
    ruleType: string,
    scopeNodeId?: string | null,
  ) {
    return and(
      eq(policyDraft.organizationId, organizationId),
      eq(policyDraft.ruleType, ruleType),
      scopeNodeId
        ? eq(policyDraft.scopeNodeId, scopeNodeId)
        : isNull(policyDraft.scopeNodeId),
    );
  }

  /** Creates the RFC-7807-compatible optimistic conflict response. */
  private revisionConflict(expected: number, actual: number): ConflictException {
    return new ConflictException({
      title: 'Policy draft changed',
      reasons: [`policy-draft-revision-conflict:expected-${expected}:actual-${actual}`],
    });
  }
}
