import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import {
  auditLog,
  delegation,
  hierarchyNode,
  person,
  roleAssignment,
  sodException,
  workflowInstance,
} from '../../../common/database/schema';
import { DEFAULT_ORGANIZATION_ID } from '../../../common/database/schema';

/** Typed set of person credential columns an admin/self update may write. */
export interface PersonCredentialUpdate {
  licenceNumber?: string;
  licenceExpiry?: string;
  licenceSource?: string;
  licenceVerified?: boolean;
  licenceUpdatedByPersonId?: string;
  emiratesId?: string;
  emiratesIdExpiry?: string;
  emiratesIdSource?: string;
  emiratesIdVerified?: boolean;
  emiratesIdUpdatedByPersonId?: string;
}

/** Data access for the platform module (hides Drizzle; enforces active windows). */
@Injectable()
export class PlatformRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  /** Finds a person by id, or undefined. */
  async findPerson(id: string) {
    const rows = await this.db.select().from(person).where(eq(person.id, id)).limit(1);
    return rows[0];
  }

  /** Applies a manual credential update (licence / Emirates ID + provenance). */
  async updatePersonCredentials(personId: string, set: PersonCredentialUpdate) {
    await this.db
      .update(person)
      .set({ ...set, updatedAtUtc: new Date() })
      .where(eq(person.id, personId));
  }

  /** Active role assignments for a person, joined to their scope node name. */
  async listActiveRoles(personId: string, at = new Date()) {
    return this.db
      .select({
        role: roleAssignment.role,
        scopeNodeId: roleAssignment.scopeNodeId,
        scopeName: hierarchyNode.name,
      })
      .from(roleAssignment)
      .leftJoin(hierarchyNode, eq(hierarchyNode.id, roleAssignment.scopeNodeId))
      .where(and(
        eq(roleAssignment.personId, personId),
        lte(roleAssignment.validFrom, at),
        or(isNull(roleAssignment.validTo), gt(roleAssignment.validTo, at)),
      ));
  }

  /** All currently-effective hierarchy nodes, ordered by depth. */
  async listHierarchy(organizationId = DEFAULT_ORGANIZATION_ID, at = new Date()) {
    return this.db
      .select()
      .from(hierarchyNode)
      .where(
        and(
          eq(hierarchyNode.organizationId, organizationId),
          lte(hierarchyNode.validFrom, at),
          or(isNull(hierarchyNode.validTo), gt(hierarchyNode.validTo, at)),
        ),
      )
      .orderBy(hierarchyNode.levelIndex);
  }

  /** Inserts a delegation row and returns it. */
  async insertDelegation(values: typeof delegation.$inferInsert) {
    const rows = await this.db.insert(delegation).values(values).returning();
    return rows[0];
  }

  /** Resolves an active one-hop delegation in the workflow instance organization. */
  async findActiveWorkflowDelegation(input: {
    workflowInstanceId: string;
    delegatorPersonId: string;
    delegatePersonId: string;
    requestType: string;
    at: Date;
  }) {
    const rows = await this.db
      .select({ id: delegation.id })
      .from(delegation)
      .innerJoin(
        workflowInstance,
        eq(workflowInstance.organizationId, delegation.organizationId),
      )
      .where(and(
        eq(workflowInstance.id, input.workflowInstanceId),
        eq(delegation.delegatorPersonId, input.delegatorPersonId),
        eq(delegation.delegatePersonId, input.delegatePersonId),
        eq(delegation.requestType, input.requestType),
        eq(delegation.oneHopOnly, true),
        lte(delegation.validFrom, input.at),
        gt(delegation.validTo, input.at),
      ))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Most-recent audit entries (Internal Audit read-only view). */
  async listAudit(organizationId: string, limit: number, offset: number) {
    return this.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.organizationId, organizationId))
      .orderBy(desc(auditLog.id))
      .limit(limit)
      .offset(offset);
  }

  /** SoD override exceptions for the standing exception report. */
  async listSodExceptions(organizationId: string) {
    return this.db.select().from(sodException).where(eq(sodException.organizationId, organizationId)).orderBy(desc(sodException.createdAtUtc));
  }

  /**
   * Upserts a person from HCM keyed by `hcm_employee_id` (the sync reconciler).
   * Bumps `updated_at_utc` so the eligibility gate can assess data freshness.
   */
  async upsertPersonFromHcm(values: typeof person.$inferInsert) {
    const rows = await this.db
      .insert(person)
      .values(values)
      .onConflictDoUpdate({
        target: person.hcmEmployeeId,
        set: {
          fullName: values.fullName,
          email: values.email ?? null,
          grade: values.grade ?? null,
          employmentStatus: values.employmentStatus ?? 'Active',
          licenceNumber: values.licenceNumber ?? null,
          licenceExpiry: values.licenceExpiry ?? null,
          isProfessionalDriver: values.isProfessionalDriver ?? false,
          sponsor: values.sponsor ?? null,
          updatedAtUtc: new Date(),
        },
      })
      .returning({ id: person.id });
    return rows[0];
  }
}
