import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import { person, vehicle } from '../src/common/database/schema';
import { ComplianceService } from '../src/modules/compliance/services/compliance.service';
import { EligibilityService } from '../src/modules/compliance/services/eligibility.service';

/**
 * Integration proof of the eligibility gate (M7). Requires a live DB + Redis.
 * Proves ALLOW for a compliant driver+vehicle, the no-override hard blocks
 * (expired insurance, active access block), the append-only evaluation record,
 * and "data as of" surfacing.
 */
describe('eligibility gate (integration — requires DB + Redis)', () => {
  let ctx: INestApplicationContext;
  let eligibility: EligibilityService;
  let compliance: ComplianceService;
  let db: DrizzleDatabase;

  const suffix = randomUUID().slice(0, 8);
  let driverId = '';
  let goodVehicle = '';
  let expiredVehicle = '';

  const future = '2035-01-01';
  const past = '2020-01-01';

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
    eligibility = ctx.get(EligibilityService);
    compliance = ctx.get(ComplianceService);
    db = ctx.get<DrizzleDatabase>(DRIZZLE);

    const [p] = await db
      .insert(person)
      .values({ hcmEmployeeId: `elig-${suffix}`, fullName: `Driver ${suffix}`, employmentStatus: 'Active', licenceExpiry: future })
      .returning({ id: person.id });
    driverId = p.id;

    const vehicles = await db
      .insert(vehicle)
      .values([
        { plate: `EL-${suffix}-G`, chassisVin: `ELVIN-${suffix}-G`, bodyTypeCode: 'SEDAN', mulkiyaExpiry: future, insuranceExpiry: future },
        { plate: `EL-${suffix}-X`, chassisVin: `ELVIN-${suffix}-X`, bodyTypeCode: 'SEDAN', mulkiyaExpiry: future, insuranceExpiry: past },
      ])
      .returning({ id: vehicle.id });
    goodVehicle = vehicles[0].id;
    expiredVehicle = vehicles[1].id;
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM fleet.eligibility_evaluation WHERE driver_person_id = ${driverId}`);
    await db.execute(sql`DELETE FROM fleet.access_block WHERE person_id = ${driverId}`);
    await db.execute(sql`DELETE FROM fleet.vehicle WHERE id IN (${goodVehicle}, ${expiredVehicle})`);
    await db.execute(sql`DELETE FROM fleet.person WHERE id = ${driverId}`);
    await ctx?.close();
  });

  it('ALLOWs a compliant driver + vehicle and surfaces data-as-of', async () => {
    const result = await eligibility.evaluate({ driverPersonId: driverId, vehicleId: goodVehicle });
    expect(result.decision).toBe('ALLOW');
    expect(result.dataAsOf).not.toBeNull();
  });

  it('hard-blocks an expired-insurance vehicle (no override)', async () => {
    const result = await eligibility.evaluate({ driverPersonId: driverId, vehicleId: expiredVehicle });
    expect(result.decision).toBe('DENY');
    expect(result.reasons).toContain('hard-block-insurance-expired');
  });

  it('blocks a driver with an active platform access block', async () => {
    await compliance.raiseBlock({ personId: driverId, reason: 'black-point-overdue' }, 'hse');
    const result = await eligibility.evaluate({ driverPersonId: driverId, vehicleId: goodVehicle });
    expect(result.decision).toBe('DENY');
    expect(result.reasons.some((r) => r.startsWith('access-blocked'))).toBe(true);
  });

  it('records every evaluation append-only', async () => {
    const rows = await db.execute(
      sql`SELECT count(*)::int AS c FROM fleet.eligibility_evaluation WHERE driver_person_id = ${driverId}`,
    );
    expect((rows as unknown as Array<{ c: number }>)[0].c).toBeGreaterThanOrEqual(3);
  });
});
