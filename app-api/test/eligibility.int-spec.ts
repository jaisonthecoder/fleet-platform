import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import {
  DEFAULT_ORGANIZATION_ID,
  domainDecisionComparison,
  domainDecisionSelector,
  person,
  vehicle,
  vehicleHierarchyAssignment,
} from '../src/common/database/schema';
import { ComplianceService } from '../src/modules/compliance/services/compliance.service';
import { EligibilityService } from '../src/modules/compliance/services/eligibility.service';
import { DomainDecisionSelectorService } from '../src/modules/policy/services/domain-decision.service';
import { createCoreHierarchyFixture, type CoreHierarchyFixture } from './support/core-fixtures';

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
  let selectorService: DomainDecisionSelectorService;

  const suffix = randomUUID().slice(0, 8);
  let driverId = '';
  let goodVehicle = '';
  let expiredVehicle = '';

  const future = '2035-01-01';
  const past = '2020-01-01';
  let hierarchy: CoreHierarchyFixture;
  let scopeNodeId = '';
  let selectorId = '';

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
    eligibility = ctx.get(EligibilityService);
    compliance = ctx.get(ComplianceService);
    db = ctx.get<DrizzleDatabase>(DRIZZLE);
    selectorService = ctx.get(DomainDecisionSelectorService);
    hierarchy = await createCoreHierarchyFixture(db, { suiteCode: `eligibility_${suffix}` });
    [scopeNodeId] = hierarchy.locationIds;

    const [p] = await db
      .insert(person)
      .values({ hcmEmployeeId: `elig-${suffix}`, fullName: `Driver ${suffix}`, employmentStatus: 'Active', licenceExpiry: future })
      .returning({ id: person.id });
    driverId = p.id;

    const vehicles = await db
      .insert(vehicle)
      .values([
        { plate: `EL-${suffix}-G`, chassisVin: `ELVIN-${suffix}-G`, bodyTypeCode: 'SEDAN', lifecycleStatus: 'Active', bookingPoolFlag: true, mulkiyaExpiry: future, insuranceExpiry: future },
        { plate: `EL-${suffix}-X`, chassisVin: `ELVIN-${suffix}-X`, bodyTypeCode: 'SEDAN', lifecycleStatus: 'Active', bookingPoolFlag: true, mulkiyaExpiry: future, insuranceExpiry: past },
      ])
      .returning({ id: vehicle.id });
    goodVehicle = vehicles[0].id;
    expiredVehicle = vehicles[1].id;
    await db.insert(vehicleHierarchyAssignment).values([
      { vehicleId: goodVehicle, nodeId: scopeNodeId },
      { vehicleId: expiredVehicle, nodeId: scopeNodeId },
    ]);
    const [selector] = await db.insert(domainDecisionSelector).values({
      organizationId: DEFAULT_ORGANIZATION_ID,
      decisionKey: 'driver-eligibility-gate',
      scopeNodeId,
      environment: 'default',
      mode: 'shadow',
      comparisonSamplePercentage: 100,
      updatedBy: `eligibility-${suffix}`,
    }).returning({ id: domainDecisionSelector.id });
    selectorId = selector.id;
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM fleet.eligibility_evaluation WHERE driver_person_id = ${driverId}`);
    await db.delete(domainDecisionComparison).where(sql`${domainDecisionComparison.decisionKey} = 'driver-eligibility-gate' AND ${domainDecisionComparison.consumer} = 'compliance'`);
    if (selectorId) await db.delete(domainDecisionSelector).where(sql`${domainDecisionSelector.id} = ${selectorId}::uuid`);
    await db.execute(sql`DELETE FROM fleet.access_block WHERE person_id = ${driverId}`);
    await db.execute(sql`DELETE FROM fleet.vehicle_hierarchy_assignment WHERE vehicle_id IN (${goodVehicle}, ${expiredVehicle})`);
    await db.execute(sql`DELETE FROM fleet.vehicle WHERE id IN (${goodVehicle}, ${expiredVehicle})`);
    await db.execute(sql`DELETE FROM fleet.person WHERE id = ${driverId}`);
    await hierarchy?.cleanupHierarchy();
    await ctx?.close();
  });

  it('ALLOWs a compliant driver + vehicle and surfaces data-as-of', async () => {
    const correlationId = `eligibility-allow-${suffix}`;
    const result = await eligibility.evaluate(
      { driverPersonId: driverId, vehicleId: goodVehicle },
      DEFAULT_ORGANIZATION_ID,
      { correlationId, effectiveAtUtc: new Date().toISOString() },
    );
    expect(result.decision).toBe('ALLOW');
    expect(result.dataAsOf).not.toBeNull();
    const rows = await db.execute(sql`
      SELECT source_classification AS "sourceClassification",
             decision_provenance->>'source' AS source,
             requested_scope_node_id AS "requestedScopeNodeId",
             correlation_id AS "correlationId"
      FROM fleet.eligibility_evaluation
      WHERE driver_person_id = ${driverId} AND correlation_id = ${correlationId}
    `) as unknown as Array<{ sourceClassification: string; source: string; requestedScopeNodeId: string; correlationId: string }>;
    expect(rows[0]).toEqual({ sourceClassification: 'configurable', source: 'legacy', requestedScopeNodeId: scopeNodeId, correlationId });
    const comparisons = await db.execute(sql`
      SELECT category FROM fleet.domain_decision_comparison
      WHERE organization_id = ${DEFAULT_ORGANIZATION_ID}::uuid
        AND decision_key = 'driver-eligibility-gate'
        AND consumer = 'compliance'
    `) as unknown as Array<{ category: string }>;
    expect(comparisons).toContainEqual({ category: 'MATCH' });
  });

  it('hard-blocks an expired-insurance vehicle (no override)', async () => {
    const result = await eligibility.evaluate({ driverPersonId: driverId, vehicleId: expiredVehicle }, DEFAULT_ORGANIZATION_ID);
    expect(result.decision).toBe('DENY');
    expect(result.reasons).toContain('hard-block-insurance-expired');
    const rows = await db.execute(sql`
      SELECT source_classification AS "sourceClassification", decision_provenance AS provenance
      FROM fleet.eligibility_evaluation
      WHERE driver_person_id = ${driverId} AND vehicle_id = ${expiredVehicle}
      ORDER BY evaluated_at_utc DESC LIMIT 1
    `) as unknown as Array<{ sourceClassification: string; provenance: unknown }>;
    expect(rows[0]).toEqual({ sourceClassification: 'hard-block', provenance: null });
  });

  it('blocks a driver with an active platform access block', async () => {
    await compliance.raiseBlock({ personId: driverId, reason: 'black-point-overdue' }, 'hse', DEFAULT_ORGANIZATION_ID);
    const result = await eligibility.evaluate({ driverPersonId: driverId, vehicleId: goodVehicle }, DEFAULT_ORGANIZATION_ID);
    expect(result.decision).toBe('DENY');
    expect(result.reasons.some((r) => r.startsWith('access-blocked'))).toBe(true);
  });

  it('records every evaluation append-only', async () => {
    const rows = await db.execute(
      sql`SELECT count(*)::int AS c FROM fleet.eligibility_evaluation WHERE driver_person_id = ${driverId}`,
    );
    expect((rows as unknown as Array<{ c: number }>)[0].c).toBeGreaterThanOrEqual(3);
  });

  it('rolls configurable eligibility back while structural hard blocks remain authoritative', async () => {
    await db.execute(sql`DELETE FROM fleet.access_block WHERE person_id = ${driverId}`);
    let revision = 1;
    try {
      await selectorService.setMode(
        DEFAULT_ORGANIZATION_ID, 'driver-eligibility-gate', scopeNodeId, 'default',
        'new-primary-with-legacy-shadow', 100, 100, 'eligibility-rollback', revision,
      );
      revision += 1;
      await eligibility.evaluate(
        { driverPersonId: driverId, vehicleId: goodVehicle }, DEFAULT_ORGANIZATION_ID,
        { correlationId: `eligibility-new-${suffix}`, effectiveAtUtc: new Date().toISOString() },
      );

      await selectorService.setMode(
        DEFAULT_ORGANIZATION_ID, 'driver-eligibility-gate', scopeNodeId, 'default',
        'legacy-only', 0, 0, 'eligibility-rollback', revision,
      );
      revision += 1;
      await eligibility.evaluate(
        { driverPersonId: driverId, vehicleId: goodVehicle }, DEFAULT_ORGANIZATION_ID,
        { correlationId: `eligibility-legacy-${suffix}`, effectiveAtUtc: new Date().toISOString() },
      );

      await selectorService.setMode(
        DEFAULT_ORGANIZATION_ID, 'driver-eligibility-gate', scopeNodeId, 'default',
        'new-only', 100, 0, 'eligibility-rollback', revision,
      );
      revision += 1;
      const blocked = await eligibility.evaluate(
        { driverPersonId: driverId, vehicleId: expiredVehicle }, DEFAULT_ORGANIZATION_ID,
        { correlationId: `eligibility-hard-block-${suffix}`, effectiveAtUtc: new Date().toISOString() },
      );
      expect(blocked.reasons).toContain('hard-block-insurance-expired');

      const rows = await db.execute(sql`
        SELECT correlation_id AS "correlationId",
               source_classification AS "classification",
               decision_provenance->>'source' AS source
        FROM fleet.eligibility_evaluation
        WHERE correlation_id IN (
          ${`eligibility-new-${suffix}`},
          ${`eligibility-legacy-${suffix}`},
          ${`eligibility-hard-block-${suffix}`}
        )
      `) as unknown as Array<{ correlationId: string; classification: string; source: string | null }>;
      expect(rows).toEqual(expect.arrayContaining([
        { correlationId: `eligibility-new-${suffix}`, classification: 'configurable', source: 'new' },
        { correlationId: `eligibility-legacy-${suffix}`, classification: 'configurable', source: 'legacy' },
        { correlationId: `eligibility-hard-block-${suffix}`, classification: 'hard-block', source: null },
      ]));
    } finally {
      const current = await db.select({ revision: domainDecisionSelector.revision }).from(domainDecisionSelector)
        .where(sql`${domainDecisionSelector.id} = ${selectorId}::uuid`).limit(1);
      await selectorService.setMode(
        DEFAULT_ORGANIZATION_ID, 'driver-eligibility-gate', scopeNodeId, 'default',
        'shadow', 0, 100, 'eligibility-rollback', current[0]!.revision,
      );
    }
  });
});
