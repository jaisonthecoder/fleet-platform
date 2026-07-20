import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import { hierarchyNode, person, vehicle } from '../src/common/database/schema';
import { BookingService } from '../src/modules/bookings/services/booking.service';
import { EligibilityService } from '../src/modules/compliance/services/eligibility.service';

/**
 * Phase 1 binding load / concurrency validation (Sub-Phase 1G). Requires a live
 * migrated DB + Redis. Proves the two correctness-critical guarantees under
 * concurrency with the REAL modules (not the Phase-0 floor):
 *   1. **No double-booking / no lost consent** — N concurrent consent commits on
 *      one vehicle + overlapping window resolve to exactly ONE reservation; the
 *      rest are 409 (the `btree_gist` exclusion serialises them). No booking
 *      number is ever issued without a committed consent.
 *   2. **Eligibility gate p95 < 500 ms** — the single-truth gate over the live DB.
 * (The full 5,000-vehicle telemetry burst + 500-user HTTP soak + timed DR
 * restore are ops-run pre-go-live gates — see 09_production-readiness-gate.md.)
 */
describe('Phase 1 binding load/concurrency (1G — requires DB + Redis)', () => {
  let ctx: INestApplicationContext;
  let bookings: BookingService;
  let eligibility: EligibilityService;
  let db: DrizzleDatabase;

  const suffix = randomUUID().slice(0, 8);
  let poolNode = '';
  let driverId = '';
  let managerId = '';
  let vehicleId = '';
  const bookingIds: string[] = [];

  const CONCURRENCY = 30;

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
    bookings = ctx.get(BookingService);
    eligibility = ctx.get(EligibilityService);
    db = ctx.get<DrizzleDatabase>(DRIZZLE);

    const [node] = await db
      .insert(hierarchyNode)
      .values({ parentId: 'a0000000-0000-4000-8000-000000000003', code: `LD-${suffix.toUpperCase()}`, levelIndex: 3, levelLabel: 'Location', levelCode: 'LOCATION', name: `Ld Location ${suffix}`, nameAr: `Ld Location ${suffix}`, path: sql`${`group.ports.khalifa.ld_${suffix}`}::ltree` })
      .returning({ id: hierarchyNode.id });
    poolNode = node.id;
    const [manager] = await db
      .insert(person)
      .values({ hcmEmployeeId: `ld-mgr-${suffix}`, fullName: `Mgr ${suffix}`, employmentStatus: 'Active' })
      .returning({ id: person.id });
    managerId = manager.id;
    const [driver] = await db
      .insert(person)
      .values({ hcmEmployeeId: `ld-drv-${suffix}`, fullName: `Drv ${suffix}`, employmentStatus: 'Active', licenceExpiry: '2999-01-01', lineManagerPersonId: managerId })
      .returning({ id: person.id });
    driverId = driver.id;
    const [veh] = await db
      .insert(vehicle)
      .values({ plate: `LD-${suffix}`, chassisVin: `VIN-LD-${suffix}`, bodyTypeCode: 'SEDAN', useCategoryCode: 'POOL', mulkiyaExpiry: '2999-01-01', insuranceExpiry: '2999-01-01', lifecycleStatus: 'Active', bookingPoolFlag: true })
      .returning({ id: vehicle.id });
    vehicleId = veh.id;
  });

  afterAll(async () => {
    for (const id of bookingIds) {
      await db.execute(sql`DELETE FROM fleet.consent_lifecycle_event WHERE booking_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.consent_record WHERE booking_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.booking_event WHERE booking_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.outbox_event WHERE aggregate_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.booking WHERE id = ${id}`);
    }
    await db.execute(sql`DELETE FROM fleet.eligibility_evaluation WHERE driver_person_id = ${driverId}`);
    await db.execute(sql`DELETE FROM fleet.vehicle WHERE id = ${vehicleId}`);
    await db.execute(sql`DELETE FROM fleet.person WHERE id IN (${driverId}, ${managerId})`);
    await db.execute(sql`DELETE FROM fleet.hierarchy_node WHERE id = ${poolNode}`);
    await ctx?.close();
  }, 30_000);

  it(`resolves ${CONCURRENCY} concurrent consents on one overlapping slot to exactly one reservation (no double-book, no lost consent)`, async () => {
    // Every draft targets the SAME vehicle + identical window ⇒ all overlap.
    const drafts = await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        const dto = await bookings.create({
          vehicleId,
          driverPersonId: driverId,
          requestedByPersonId: driverId,
          pickupAtUtc: '2999-03-01T08:00:00.000Z',
          returnAtUtc: '2999-03-01T10:00:00.000Z',
        });
        bookingIds.push(dto.id);
        return dto.id;
      }),
    );

    const results = await Promise.allSettled(
      drafts.map((id) => bookings.signConsent(id, { driverPersonId: driverId, consentDocumentVersion: 'consent-v0' })),
    );
    const winners = results.filter((r) => r.status === 'fulfilled');
    const losers = results.filter((r) => r.status === 'rejected');

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(CONCURRENCY - 1);
    // Every loser is a 409 conflict (the exclusion), not a 500.
    for (const l of losers as PromiseRejectedResult[]) {
      expect(l.reason?.status).toBe(409);
    }

    // Exactly one reservation holds the slot, with exactly one committed consent.
    const active = (await db.execute(
      sql`SELECT count(*)::int AS n FROM fleet.booking WHERE vehicle_id = ${vehicleId} AND status = 'PendingApproval' AND booking_number IS NOT NULL`,
    )) as unknown as Array<{ n: number }>;
    expect(active[0].n).toBe(1);

    const consents = (await db.execute(
      sql`SELECT count(*)::int AS n FROM fleet.consent_record WHERE vehicle_id = ${vehicleId}`,
    )) as unknown as Array<{ n: number }>;
    expect(consents[0].n).toBe(1);
  }, 60_000);

  it('keeps the eligibility gate p95 < 500 ms over 300 evaluations (binding, real module + DB)', async () => {
    const BUDGET_MS = 500;
    const ITERATIONS = 300;
    const wave = 30;
    const durations: number[] = [];
    // warm
    await eligibility.evaluate({ driverPersonId: driverId, vehicleId });
    for (let i = 0; i < ITERATIONS; i += wave) {
      await Promise.all(
        Array.from({ length: wave }, async () => {
          const start = performance.now();
          await eligibility.evaluate({ driverPersonId: driverId, vehicleId });
          durations.push(performance.now() - start);
        }),
      );
    }
    durations.sort((a, b) => a - b);
    const p95 = durations[Math.floor(durations.length * 0.95)];
    // eslint-disable-next-line no-console
    console.log(`eligibility gate: n=${durations.length} p95=${p95.toFixed(1)}ms`);
    expect(p95).toBeLessThan(BUDGET_MS);
  }, 60_000);
});
