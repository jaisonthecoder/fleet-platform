import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, lte, ne } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import { consentTemplate } from '../../../common/database/schema';
import type { ConsentDomain } from '../../../contracts/consent-administration.contract';

type Executor = Pick<DrizzleDatabase, 'insert' | 'select' | 'update'>;

@Injectable()
export class ConsentTemplateRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  transaction<T>(work: (tx: DrizzleDatabase) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  /** Lists immutable versions for one organization and optional domain. */
  list(organizationId: string, domain?: ConsentDomain) {
    return this.db.select().from(consentTemplate).where(and(
      eq(consentTemplate.organizationId, organizationId),
      ...(domain ? [eq(consentTemplate.domain, domain)] : []),
    )).orderBy(desc(consentTemplate.createdAtUtc));
  }

  /** Resolves the currently effective Active version. */
  async current(organizationId: string, domain: ConsentDomain) {
    const rows = await this.db.select().from(consentTemplate).where(and(
      eq(consentTemplate.organizationId, organizationId),
      eq(consentTemplate.domain, domain),
      eq(consentTemplate.status, 'Active'),
      lte(consentTemplate.effectiveAtUtc, new Date()),
    )).orderBy(desc(consentTemplate.effectiveAtUtc)).limit(1);
    return rows[0];
  }

  async find(id: string, organizationId: string, executor: Executor = this.db) {
    const rows = await executor.select().from(consentTemplate).where(and(
      eq(consentTemplate.id, id),
      eq(consentTemplate.organizationId, organizationId),
    )).limit(1);
    return rows[0];
  }

  async insert(values: typeof consentTemplate.$inferInsert, executor: Executor = this.db) {
    const rows = await executor.insert(consentTemplate).values(values).returning();
    return rows[0];
  }

  /** Retires any prior Active version for a domain. */
  retireOtherActive(organizationId: string, domain: ConsentDomain, exceptId: string, actorPersonId: string, at: Date, executor: Executor) {
    return executor.update(consentTemplate).set({ status: 'Retired', retiredByPersonId: actorPersonId, retiredAtUtc: at, updatedAtUtc: at }).where(and(
      eq(consentTemplate.organizationId, organizationId),
      eq(consentTemplate.domain, domain),
      eq(consentTemplate.status, 'Active'),
      ne(consentTemplate.id, exceptId),
    ));
  }

  async activate(id: string, organizationId: string, actorPersonId: string, at: Date, executor: Executor) {
    const rows = await executor.update(consentTemplate).set({
      status: 'Active', activatedByPersonId: actorPersonId, activatedAtUtc: at, updatedAtUtc: at,
    }).where(and(eq(consentTemplate.id, id), eq(consentTemplate.organizationId, organizationId), eq(consentTemplate.status, 'Draft'))).returning();
    return rows[0];
  }

  async retire(id: string, organizationId: string, actorPersonId: string, at: Date, executor: Executor) {
    const rows = await executor.update(consentTemplate).set({
      status: 'Retired', retiredByPersonId: actorPersonId, retiredAtUtc: at, updatedAtUtc: at,
    }).where(and(eq(consentTemplate.id, id), eq(consentTemplate.organizationId, organizationId), eq(consentTemplate.status, 'Active'))).returning();
    return rows[0];
  }
}
