import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import type { PlatformRole } from '../../../common/database/schema';
import {
  bsdReturnWindow,
  entitlementRequest,
  person,
  roleAssignment,
} from '../../../common/database/schema';

/** An executor that can write — the base db or an open transaction. */
type Executor = Pick<DrizzleDatabase, 'insert' | 'update'>;

/** Data access for the entitlements module (hides Drizzle). */
@Injectable()
export class EntitlementsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  transaction<T>(work: (tx: DrizzleDatabase) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  async insert(values: typeof entitlementRequest.$inferInsert, executor: Executor = this.db) {
    const rows = await executor.insert(entitlementRequest).values(values).returning();
    return rows[0];
  }

  async findById(id: string) {
    const rows = await this.db.select().from(entitlementRequest).where(eq(entitlementRequest.id, id)).limit(1);
    return rows[0];
  }

  async update(id: string, set: Partial<typeof entitlementRequest.$inferInsert>, executor: Executor = this.db) {
    const rows = await executor
      .update(entitlementRequest)
      .set({ ...set, updatedAtUtc: new Date() })
      .where(eq(entitlementRequest.id, id))
      .returning();
    return rows[0];
  }

  async list(limit = 50, offset = 0) {
    return this.db
      .select()
      .from(entitlementRequest)
      .orderBy(desc(entitlementRequest.createdAtUtc))
      .limit(limit)
      .offset(offset);
  }

  async insertBsdWindow(values: typeof bsdReturnWindow.$inferInsert) {
    const rows = await this.db.insert(bsdReturnWindow).values(values).returning();
    return rows[0];
  }

  async listBsdWindows(entitlementRequestId: string) {
    return this.db
      .select()
      .from(bsdReturnWindow)
      .where(eq(bsdReturnWindow.entitlementRequestId, entitlementRequestId))
      .orderBy(desc(bsdReturnWindow.windowStart));
  }

  /** A person's id + grade + line manager (drives eligibility + the approval chain). */
  async findPerson(id: string) {
    const rows = await this.db
      .select({ id: person.id, grade: person.grade, lineManagerPersonId: person.lineManagerPersonId })
      .from(person)
      .where(eq(person.id, id))
      .limit(1);
    return rows[0];
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
}
