import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { eq, sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import { hierarchyNode, person, roleAssignment } from '../src/common/database/schema';
import { BookingsRepository } from '../src/modules/bookings/repositories/bookings.repository';
import { EntitlementsRepository } from '../src/modules/entitlements/repositories/entitlements.repository';

/** Proves future/expired role assignments never become Booking or Entitlement approvers. */
describe('approval role effective-time resolution (integration)', () => {
  let ctx: INestApplicationContext;
  let db: DrizzleDatabase;
  let bookings: BookingsRepository;
  let entitlements: EntitlementsRepository;
  const suffix = randomUUID().slice(0, 8);
  let organizationId = '';
  let scopeNodeId = '';
  let currentPersonId = '';
  let futurePersonId = '';

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
    db = ctx.get<DrizzleDatabase>(DRIZZLE);
    bookings = ctx.get(BookingsRepository);
    entitlements = ctx.get(EntitlementsRepository);
    const [scope] = await db.select({ id: hierarchyNode.id, organizationId: hierarchyNode.organizationId }).from(hierarchyNode).where(eq(hierarchyNode.code, 'PORTS-KHALIFA')).limit(1);
    scopeNodeId = scope.id;
    organizationId = scope.organizationId;
    const people = await db.insert(person).values([
      { organizationId, hcmEmployeeId: `approval-current-${suffix}`, fullName: `Current Approver ${suffix}`, employmentStatus: 'Active' },
      { organizationId, hcmEmployeeId: `approval-future-${suffix}`, fullName: `Future Approver ${suffix}`, employmentStatus: 'Active' },
    ]).returning({ id: person.id });
    currentPersonId = people[0].id;
    futurePersonId = people[1].id;
  });

  afterAll(async () => {
    await db.delete(roleAssignment).where(sql`${roleAssignment.personId} IN (${currentPersonId}::uuid, ${futurePersonId}::uuid)`);
    await db.delete(person).where(sql`${person.id} IN (${currentPersonId}::uuid, ${futurePersonId}::uuid)`);
    await ctx?.close();
  });

  it('selects only the currently effective same-organization role holder', async () => {
    const at = new Date('2026-07-31T08:00:00.000Z');
    await db.insert(roleAssignment).values([
      { organizationId, personId: currentPersonId, role: 'Finance', scopeNodeId, validFrom: new Date('2026-07-30T08:00:00.000Z'), validTo: new Date('2026-08-01T08:00:00.000Z') },
      { organizationId, personId: futurePersonId, role: 'Finance', scopeNodeId, validFrom: new Date('2026-08-02T08:00:00.000Z') },
    ]);
    await expect(bookings.findApproverForRole(organizationId, 'Finance', scopeNodeId, at)).resolves.toBe(currentPersonId);
    await expect(entitlements.findApproverForRole(organizationId, 'Finance', scopeNodeId, at)).resolves.toBe(currentPersonId);
    const expiredAt = new Date('2026-08-01T08:00:00.000Z');
    await expect(bookings.findApproverForRole(organizationId, 'Finance', scopeNodeId, expiredAt)).resolves.toBeNull();
    await expect(entitlements.findApproverForRole(organizationId, 'Finance', scopeNodeId, expiredAt)).resolves.toBeNull();
  });
});
