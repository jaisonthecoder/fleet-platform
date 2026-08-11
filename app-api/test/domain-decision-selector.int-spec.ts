import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { ConflictException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { and, eq } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import { domainDecisionComparison, domainDecisionSelector } from '../src/common/database/schema';
import { DomainDecisionSelectorService } from '../src/modules/policy/services/domain-decision.service';
import { DomainDecisionAdministrationService } from '../src/modules/policy-administration/services/domain-decision-administration.service';
import { AuditService } from '../src/modules/platform/services/audit.service';

const organizationId = '00000000-0000-4000-8000-000000000001';
const clusterId = 'a0000000-0000-4000-8000-000000000002';
const poolId = 'a0000000-0000-4000-8000-000000000003';
const locationId = 'a0000000-0000-4000-8000-000000000004';

describe('domain decision selector (integration — requires DB)', () => {
  let ctx: INestApplicationContext;
  let db: DrizzleDatabase;
  let selector: DomainDecisionSelectorService;
  let administration: DomainDecisionAdministrationService;
  let audit: AuditService;
  const decisionKey = `selector-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
    db = ctx.get<DrizzleDatabase>(DRIZZLE);
    selector = ctx.get(DomainDecisionSelectorService);
    administration = ctx.get(DomainDecisionAdministrationService);
    audit = ctx.get(AuditService);
  });

  afterAll(async () => {
    await db.delete(domainDecisionComparison).where(eq(domainDecisionComparison.decisionKey, decisionKey));
    await db.delete(domainDecisionSelector).where(
      and(
        eq(domainDecisionSelector.organizationId, organizationId),
        eq(domainDecisionSelector.decisionKey, decisionKey),
      ),
    );
    await ctx.close();
  });

  it('resolves environment-isolated organization default and nearest ancestor overrides', async () => {
    await selector.setMode(
      organizationId,
      decisionKey,
      null,
      'uat',
      'shadow',
      0,
      25,
      'integration-test',
    );
    await selector.setMode(
      organizationId,
      decisionKey,
      clusterId,
      'uat',
      'new-canary',
      30,
      50,
      'integration-test',
    );

    await expect(selector.config(organizationId, decisionKey, locationId, 'uat')).resolves.toMatchObject({
      id: expect.any(String),
      revision: 1,
      mode: 'new-canary',
      canaryPercentage: 30,
      comparisonSamplePercentage: 50,
    });
    await expect(selector.config(organizationId, decisionKey, poolId, 'prod')).resolves.toEqual({
      id: null,
      revision: null,
      mode: 'legacy-only',
      canaryPercentage: 0,
      comparisonSamplePercentage: 0,
    });
    await expect(selector.config('00000000-0000-4000-8000-000000000099', decisionKey, locationId, 'uat')).resolves.toEqual({
      id: null,
      revision: null,
      mode: 'legacy-only',
      canaryPercentage: 0,
      comparisonSamplePercentage: 0,
    });
  });

  it('rolls back one selector to legacy-only without changing policy artifacts', async () => {
    await selector.setMode(
      organizationId,
      decisionKey,
      clusterId,
      'uat',
      'legacy-only',
      0,
      0,
      'integration-test',
    );
    await expect(selector.config(organizationId, decisionKey, locationId, 'uat')).resolves.toMatchObject({
      id: expect.any(String),
      revision: 2,
      mode: 'legacy-only',
      canaryPercentage: 0,
      comparisonSamplePercentage: 0,
    });
  });

  it('rejects a stale selector revision without changing the effective mode', async () => {
    await expect(selector.setMode(
      organizationId,
      decisionKey,
      clusterId,
      'uat',
      'new-only',
      100,
      100,
      'stale-writer',
      1,
    )).rejects.toBeInstanceOf(ConflictException);
    await expect(selector.config(organizationId, decisionKey, locationId, 'uat')).resolves.toMatchObject({
      revision: 2,
      mode: 'legacy-only',
    });
  });

  it('rejects invalid percentages before persistence', async () => {
    await expect(selector.setMode(
      organizationId, `${decisionKey}-invalid`, clusterId, 'uat', 'new-canary', 101, 100, 'integration-test', 0,
    )).rejects.toMatchObject({ response: { reasons: ['decision-selector-canary-percentage-out-of-range'] } });
    await expect(selector.setMode(
      organizationId, `${decisionKey}-invalid`, clusterId, 'uat', 'shadow', 0, -1, 'integration-test', 0,
    )).rejects.toMatchObject({ response: { reasons: ['decision-selector-comparison-percentage-out-of-range'] } });
  });

  it('rolls back the selector when audit persistence fails', async () => {
    const auditFailure = jest.spyOn(audit, 'record').mockRejectedValueOnce(new Error('audit unavailable'));
    const auditDecisionKey = `${decisionKey}-audit-failure`;
    await expect(selector.setMode(
      organizationId, auditDecisionKey, clusterId, 'uat', 'shadow', 0, 100, 'integration-test', 0,
    )).rejects.toThrow('audit unavailable');
    const rows = await db.select().from(domainDecisionSelector).where(and(
      eq(domainDecisionSelector.organizationId, organizationId),
      eq(domainDecisionSelector.decisionKey, auditDecisionKey),
    ));
    expect(rows).toHaveLength(0);
    auditFailure.mockRestore();
  });

  it('returns privacy-safe comparison category counts for an authorized scope', async () => {
    await db.insert(domainDecisionComparison).values([
      {
        organizationId, decisionKey, environment: 'uat', consumer: 'bookings',
        subjectRef: 'a'.repeat(64), correlationId: 'b'.repeat(64), requestedScopeNodeId: locationId,
        mode: 'shadow', factFingerprint: 'c'.repeat(64), category: 'MATCH',
      },
      {
        organizationId, decisionKey, environment: 'uat', consumer: 'bookings',
        subjectRef: 'd'.repeat(64), correlationId: 'e'.repeat(64), requestedScopeNodeId: locationId,
        mode: 'shadow', factFingerprint: 'f'.repeat(64), category: 'OUTPUT_DIVERGENCE',
      },
    ]);
    const result = await administration.comparisonSummary(organizationId, {
      decisionKey, environment: 'uat', scopeNodeId: locationId,
    }, [locationId]);
    expect(result).toMatchObject({ total: 2, decisionKey, environment: 'uat' });
    expect(result.counts).toEqual(expect.arrayContaining([
      { mode: 'shadow', category: 'MATCH', count: 1 },
      { mode: 'shadow', category: 'OUTPUT_DIVERGENCE', count: 1 },
    ]));
    expect(JSON.stringify(result)).not.toContain('a'.repeat(64));
    expect(JSON.stringify(result)).not.toContain('b'.repeat(64));
  });

  it('deletes only comparison evidence older than the retention cutoff', async () => {
    const foreignOrganizationId = '00000000-0000-4000-8000-000000000099';
    await db.insert(domainDecisionComparison).values({
      organizationId, decisionKey, environment: 'retention', consumer: 'bookings',
      subjectRef: '1'.repeat(64), correlationId: '2'.repeat(64), requestedScopeNodeId: locationId,
      mode: 'shadow', factFingerprint: '3'.repeat(64), category: 'MATCH',
      comparedAtUtc: new Date('2020-01-01T00:00:00.000Z'),
    });
    await db.insert(domainDecisionComparison).values({
      organizationId, decisionKey, environment: 'retention', consumer: 'bookings',
      subjectRef: '4'.repeat(64), correlationId: '5'.repeat(64), requestedScopeNodeId: locationId,
      mode: 'shadow', factFingerprint: '6'.repeat(64), category: 'MATCH',
      comparedAtUtc: new Date(),
    });
    await db.insert(domainDecisionComparison).values({
      organizationId: foreignOrganizationId, decisionKey, environment: 'retention', consumer: 'bookings',
      subjectRef: '7'.repeat(64), correlationId: '8'.repeat(64), requestedScopeNodeId: null,
      mode: 'shadow', factFingerprint: '9'.repeat(64), category: 'MATCH',
      comparedAtUtc: new Date('2020-01-01T00:00:00.000Z'),
    });
    await expect(administration.deleteComparisonsBefore(organizationId, new Date('2025-01-01T00:00:00.000Z'))).resolves.toBe(1);
    const remaining = await db.select({ correlationId: domainDecisionComparison.correlationId })
      .from(domainDecisionComparison)
      .where(and(
        eq(domainDecisionComparison.organizationId, organizationId),
        eq(domainDecisionComparison.decisionKey, decisionKey),
        eq(domainDecisionComparison.environment, 'retention'),
      ));
    expect(remaining).toEqual([{ correlationId: '5'.repeat(64) }]);
    const foreign = await db.select({ id: domainDecisionComparison.id }).from(domainDecisionComparison).where(and(
      eq(domainDecisionComparison.organizationId, foreignOrganizationId),
      eq(domainDecisionComparison.decisionKey, decisionKey),
    ));
    expect(foreign).toHaveLength(1);
  });
});
