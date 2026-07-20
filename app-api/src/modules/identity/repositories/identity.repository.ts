import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, inArray, isNotNull, isNull, or, type SQL, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import {
  hierarchyNode,
  person,
  type PlatformRole,
  roleAssignment,
  userAccount,
} from '../../../common/database/schema';

/** Filter/paging options for the admin users grid. */
export interface ListUsersPagedOptions {
  search?: string;
  status?: string;
  role?: PlatformRole;
  page: number;
  pageSize: number;
}

/** Data access for user accounts + role assignments (identity/access admin). */
@Injectable()
export class IdentityRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  /** Finds a user account by its Entra object id, or undefined. */
  async findUserByEntraId(entraObjectId: string) {
    const rows = await this.db
      .select()
      .from(userAccount)
      .where(eq(userAccount.entraObjectId, entraObjectId))
      .limit(1);
    return rows[0];
  }

  /** Finds a user account by id, or undefined. */
  async findUserById(id: string) {
    const rows = await this.db.select().from(userAccount).where(eq(userAccount.id, id)).limit(1);
    return rows[0];
  }

  /** Finds the (login) user account linked to a person, or undefined. */
  async findUserByPersonId(personId: string) {
    const rows = await this.db
      .select()
      .from(userAccount)
      .where(eq(userAccount.personId, personId))
      .limit(1);
    return rows[0];
  }

  /** Finds an HR person by email (JIT provisioning identity match), or undefined. */
  async findPersonByEmail(email: string) {
    const rows = await this.db
      .select({ id: person.id })
      .from(person)
      .where(eq(person.email, email))
      .limit(1);
    return rows[0];
  }

  /** Finds an HR person by HCM employee id (JIT provisioning identity match). */
  async findPersonByHcmId(hcmEmployeeId: string) {
    const rows = await this.db
      .select({ id: person.id })
      .from(person)
      .where(eq(person.hcmEmployeeId, hcmEmployeeId))
      .limit(1);
    return rows[0];
  }

  /** Creates a user account and returns it (JIT provisioning). */
  async insertUser(values: typeof userAccount.$inferInsert) {
    const rows = await this.db.insert(userAccount).values(values).returning();
    return rows[0];
  }

  /** Updates a user account and returns it. */
  async updateUser(id: string, set: Partial<typeof userAccount.$inferInsert>) {
    const rows = await this.db
      .update(userAccount)
      .set({ ...set, updatedAtUtc: new Date() })
      .where(eq(userAccount.id, id))
      .returning();
    return rows[0];
  }

  /** Lists user accounts (admin view). */
  async listUsers() {
    return this.db.select().from(userAccount).orderBy(desc(userAccount.createdAtUtc));
  }

  /**
   * Paged, filtered admin view of the **workforce directory**. The base table
   * is `person` (the HR master — every employee, whether or not they have ever
   * signed in via SSO); the `user_account` (created just-in-time on first login)
   * is LEFT-joined so people with no login yet still appear. Each person's
   * ACTIVE role assignments are aggregated into `roles` + the distinct
   * `scopeNames` they are granted on.
   */
  async listUsersPaged(opts: ListUsersPagedOptions) {
    const where = this.usersWhere(opts);
    const rows = await this.db
      .select({
        personId: person.id,
        userId: userAccount.id,
        fullName: person.fullName,
        personEmail: person.email,
        accountEmail: userAccount.email,
        hcmEmployeeId: person.hcmEmployeeId,
        grade: person.grade,
        accountStatus: userAccount.status,
        lastLoginAt: userAccount.lastLoginAt,
      })
      .from(person)
      .leftJoin(userAccount, eq(userAccount.personId, person.id))
      .where(where)
      .orderBy(person.fullName)
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize);

    const personIds = [...new Set(rows.map((r) => r.personId))];
    const roleRows = personIds.length
      ? await this.db
          .select({
            personId: roleAssignment.personId,
            role: roleAssignment.role,
            scopeName: hierarchyNode.name,
          })
          .from(roleAssignment)
          .leftJoin(hierarchyNode, eq(hierarchyNode.id, roleAssignment.scopeNodeId))
          .where(and(inArray(roleAssignment.personId, personIds), isNull(roleAssignment.validTo)))
          .orderBy(roleAssignment.validFrom)
      : [];
    const byPerson = new Map<string, { roles: string[]; scopeNames: string[] }>();
    for (const r of roleRows) {
      const entry = byPerson.get(r.personId) ?? { roles: [], scopeNames: [] };
      if (!entry.roles.includes(r.role)) {
        entry.roles.push(r.role);
      }
      if (r.scopeName && !entry.scopeNames.includes(r.scopeName)) {
        entry.scopeNames.push(r.scopeName);
      }
      byPerson.set(r.personId, entry);
    }

    const total = await this.countUsers(opts);
    return {
      items: rows.map((r) => {
        const agg = byPerson.get(r.personId);
        // Account state (raw), or a synthetic 'NoLogin' when JIT-provisioning
        // has never fired for this person.
        const accountStatus = r.accountStatus ?? 'NoLogin';
        return {
          personId: r.personId,
          userId: r.userId,
          name: r.fullName,
          email: r.personEmail ?? r.accountEmail ?? null,
          employeeId: r.hcmEmployeeId ?? r.personId.slice(0, 8),
          grade: r.grade ?? null,
          roles: agg?.roles ?? [],
          cluster: agg?.scopeNames[0] ?? null,
          lastLoginAt: r.lastLoginAt,
          accountStatus,
          status: accountStatus,
        };
      }),
      total,
    };
  }

  /** Total directory persons matching the same filters as `listUsersPaged`. */
  async countUsers(opts: ListUsersPagedOptions): Promise<number> {
    const where = this.usersWhere(opts);
    const rows = await this.db
      .select({ n: sql<number>`cast(count(distinct ${person.id}) as int)` })
      .from(person)
      .leftJoin(userAccount, eq(userAccount.personId, person.id))
      .where(where);
    return Number(rows[0]?.n ?? 0);
  }

  /** Distinct-person counts per role across the workforce directory — bucketed by the caller into tiles. */
  async summaryCounts(): Promise<Array<{ role: string; count: number }>> {
    const rows = await this.db
      .select({
        role: roleAssignment.role,
        count: sql<number>`cast(count(distinct ${roleAssignment.personId}) as int)`,
      })
      .from(roleAssignment)
      .where(isNull(roleAssignment.validTo))
      .groupBy(roleAssignment.role);
    return rows.map((r) => ({ role: r.role as string, count: Number(r.count) }));
  }

  /** The active role assignments a person holds, with scope names (per-user view). */
  async listRolesForPerson(personId: string) {
    return this.db
      .select({
        assignmentId: roleAssignment.id,
        role: roleAssignment.role,
        scopeNodeId: roleAssignment.scopeNodeId,
        scopeName: hierarchyNode.name,
        source: roleAssignment.source,
      })
      .from(roleAssignment)
      .leftJoin(hierarchyNode, eq(hierarchyNode.id, roleAssignment.scopeNodeId))
      .where(and(eq(roleAssignment.personId, personId), isNull(roleAssignment.validTo)))
      .orderBy(roleAssignment.validFrom);
  }

  /** Shared WHERE for the workforce directory grid (status + search + role). */
  private usersWhere(opts: ListUsersPagedOptions): SQL | undefined {
    // Real workforce members carry an email; role-less test artifacts do not
    // (matches the dev-login picker convention in `listPeopleWithRoles`).
    const conditions: SQL[] = [isNotNull(person.email)];
    if (opts.status) {
      // 'NoLogin' is synthetic — it means this person has never been JIT-provisioned.
      if (opts.status === 'NoLogin') {
        conditions.push(isNull(userAccount.id));
      } else {
        conditions.push(eq(userAccount.status, opts.status));
      }
    }
    if (opts.search) {
      const term = `%${opts.search}%`;
      const match = or(
        ilike(person.fullName, term),
        ilike(person.email, term),
        ilike(userAccount.email, term),
        ilike(person.hcmEmployeeId, term),
      );
      if (match) {
        conditions.push(match);
      }
    }
    if (opts.role) {
      conditions.push(
        sql`exists (select 1 from fleet.role_assignment ra where ra.person_id = ${person.id} and ra.role::text = ${opts.role} and ra.valid_to is null)`,
      );
    }
    return conditions.length ? and(...conditions) : undefined;
  }

  /** The active roles a person holds on a given scope (for SoD-at-assignment). */
  async listActiveRolesOnScope(personId: string, scopeNodeId: string): Promise<PlatformRole[]> {
    const rows = await this.db
      .select({ role: roleAssignment.role })
      .from(roleAssignment)
      .where(
        and(
          eq(roleAssignment.personId, personId),
          eq(roleAssignment.scopeNodeId, scopeNodeId),
          isNull(roleAssignment.validTo),
        ),
      );
    return rows.map((r) => r.role);
  }

  /** Inserts a role assignment and returns it. */
  async insertRoleAssignment(values: typeof roleAssignment.$inferInsert) {
    const rows = await this.db.insert(roleAssignment).values(values).returning();
    return rows[0];
  }

  /** Effective-date-expires (revokes) a role assignment; returns the row. */
  async expireRoleAssignment(id: string) {
    const rows = await this.db
      .update(roleAssignment)
      .set({ validTo: new Date(), updatedAtUtc: new Date() })
      .where(eq(roleAssignment.id, id))
      .returning();
    return rows[0];
  }

  /** All currently-active role assignments (access-review export). */
  async listActiveAssignments() {
    return this.db
      .select({
        id: roleAssignment.id,
        personId: roleAssignment.personId,
        role: roleAssignment.role,
        scopeNodeId: roleAssignment.scopeNodeId,
        source: roleAssignment.source,
        assignedByPersonId: roleAssignment.assignedByPersonId,
      })
      .from(roleAssignment)
      .where(isNull(roleAssignment.validTo))
      .orderBy(roleAssignment.personId);
  }

  /** People + their active roles/scopes (backs the dev-login user picker). */
  async listPeopleWithRoles() {
    return this.db
      .select({
        personId: person.id,
        fullName: person.fullName,
        email: person.email,
        grade: person.grade,
        role: roleAssignment.role,
        scopeName: hierarchyNode.name,
      })
      .from(person)
      .leftJoin(
        roleAssignment,
        and(
          eq(roleAssignment.personId, person.id),
          isNull(roleAssignment.validTo),
        ),
      )
      .leftJoin(hierarchyNode, eq(hierarchyNode.id, roleAssignment.scopeNodeId))
      // Only real, seeded users (with an email) — excludes role-less test artifacts.
      .where(isNotNull(person.email))
      .orderBy(person.fullName);
  }
}
