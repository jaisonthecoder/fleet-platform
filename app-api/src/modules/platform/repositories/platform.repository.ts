import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import {
  auditLog,
  delegation,
  hierarchyNode,
  person,
  roleAssignment,
  sodException,
} from '../../../common/database/schema';
import { DEFAULT_ORGANIZATION_ID } from '../../../common/database/schema';

/** Data access for the platform module (hides Drizzle; enforces active windows). */
@Injectable()
export class PlatformRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  /** Finds a person by id, or undefined. */
  async findPerson(id: string) {
    const rows = await this.db.select().from(person).where(eq(person.id, id)).limit(1);
    return rows[0];
  }

  /** Active role assignments for a person, joined to their scope node name. */
  async listActiveRoles(personId: string) {
    return this.db
      .select({
        role: roleAssignment.role,
        scopeNodeId: roleAssignment.scopeNodeId,
        scopeName: hierarchyNode.name,
      })
      .from(roleAssignment)
      .leftJoin(hierarchyNode, eq(hierarchyNode.id, roleAssignment.scopeNodeId))
      .where(and(eq(roleAssignment.personId, personId), isNull(roleAssignment.validTo)));
  }

  /** All currently-effective hierarchy nodes, ordered by depth. */
  async listHierarchy(organizationId = DEFAULT_ORGANIZATION_ID) {
    return this.db
      .select()
      .from(hierarchyNode)
      .where(
        and(
          eq(hierarchyNode.organizationId, organizationId),
          isNull(hierarchyNode.validTo),
        ),
      )
      .orderBy(hierarchyNode.levelIndex);
  }

  /** Inserts a delegation row and returns it. */
  async insertDelegation(values: typeof delegation.$inferInsert) {
    const rows = await this.db.insert(delegation).values(values).returning();
    return rows[0];
  }

  /** Most-recent audit entries (Internal Audit read-only view). */
  async listAudit(limit: number, offset: number) {
    return this.db
      .select()
      .from(auditLog)
      .orderBy(desc(auditLog.id))
      .limit(limit)
      .offset(offset);
  }

  /** SoD override exceptions for the standing exception report. */
  async listSodExceptions() {
    return this.db.select().from(sodException).orderBy(desc(sodException.createdAtUtc));
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
