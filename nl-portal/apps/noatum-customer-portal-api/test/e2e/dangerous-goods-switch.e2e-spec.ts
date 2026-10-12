import { type INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { AnalyticsService } from '../../src/common/analytics/analytics.service';
import { FeatureSwitchService } from '../../src/common/features/feature-switch.service';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { PermissionGuard } from '../../src/common/guards/permission.guard';
import { TenantGuard } from '../../src/common/guards/tenant.guard';
import { SettingsService } from '../../src/common/settings/settings.service';
import { PrismaService } from '../../src/common/tenancy/prisma.service';
import { TenantContext, type TenantContextData } from '../../src/common/tenancy/tenant-context';
import { TenantRepository } from '../../src/common/tenancy/tenant.repository';
import { RateEngineAdapter } from '../../src/contracts/adapters/rate-engine.adapter';
import { IntegrationMessageService } from '../../src/integration/messages/integration-message.service';
import { PERMISSIONS } from '../../src/contracts/permissions';
import { QuotesController } from '../../src/modules/quotes/quotes.controller';
import { QuotesService } from '../../src/modules/quotes/quotes.service';
import { noAnalytics } from '../fixtures/analytics.fixture';

/**
 * The dangerous goods switch, proved through the running stack.
 *
 * The unit test injects its own `{ isEnabled: () => false }`, which only proves
 * that an `if` branches on the boolean it was handed. This one uses the real
 * `FeatureSwitchService` reading a real `feature_switch` row, so it also proves
 * the key resolves, that the catalogue default applies when no row exists, and
 * that an administrator flipping the switch actually stops new requests.
 */
describe('dangerous goods feature switch', () => {
  const SWITCH_KEY = 'quotations.dangerous_goods';

  let app: INestApplication;
  /** The runtime role the application uses, subject to RLS. */
  let database: PrismaClient;
  /** The migration role, used only to seed and clean up. RLS does not apply. */
  let owner: PrismaClient;
  let groupId: string;
  let userId: string;
  let actor: TenantContextData;
  const context = new TenantContext();

  const body = () => ({
    mode: 'sea',
    originCode: 'CNTAO',
    destinationCode: 'ESVLC',
    commodity: 'Paint and solvents',
    grossWeightKg: 720,
    packages: [{ lineId: 'a', quantity: 6, packageType: 'drum', weightKg: 120 }],
    dangerousGoods: [
      {
        unNumber: '1263',
        hazardClass: '3',
        properShippingName: 'Paint',
        packingGroup: 'III',
        flashpointCelsius: 23,
        packagingType: 'Steel drum',
        packageCount: 6,
        netQuantityPerPackage: 20,
        quantityUnit: 'L',
        appliesToLines: ['a'],
      },
    ],
  });

  // Flipped as the owner: the feature_switch write policy is internal-only, and
  // a transaction-local set_config does not survive a bare Prisma call.
  const setSwitch = async (isEnabled: boolean) => {
    await owner.featureSwitch.upsert({
      where: { key: SWITCH_KEY },
      create: { key: SWITCH_KEY, isEnabled, reason: 'isolation test' },
      update: { isEnabled },
    });
  };

  beforeAll(async () => {
    database = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 5000,
      }),
    });
    await database.$connect();

    owner = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_MIGRATION_URL,
        connectionTimeoutMillis: 5000,
      }),
    });
    await owner.$connect();

    // Its own tenant rather than the shared fixture, whose hard-coded Q-000001
    // collides with the reference sequence the first time this creates a quote.
    const group = await owner.customerGroup.create({
      data: {
        name: `DG switch ${randomUUID().slice(0, 8)}`,
        slug: `dg-switch-${randomUUID().slice(0, 8)}`,
        status: 'active',
        updatedAt: new Date(),
      },
      select: { id: true },
    });
    groupId = group.id;

    const user = await owner.user.create({
      data: {
        email: `dg-switch-${randomUUID()}@example.test`,
        displayName: 'DG switch tester',
        customerGroupId: groupId,
        status: 'active',
        updatedAt: new Date(),
      },
      select: { id: true },
    });
    userId = user.id;

    const moduleRef = await Test.createTestingModule({
      controllers: [QuotesController],
      providers: [
        QuotesService,
        TenantRepository,
        FeatureSwitchService,
        SettingsService,
        IntegrationMessageService,
        { provide: PrismaService, useValue: database },
        { provide: TenantContext, useValue: context },
        { provide: AnalyticsService, useValue: noAnalytics() },
        // Never reached: create() does not price. Present so the graph resolves.
        { provide: RateEngineAdapter, useValue: { rate: async () => null } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning();
    app.use((_req: Request, _res: Response, next: NextFunction) =>
      context.run({ ...actor }, next),
    );
    const reflector = new Reflector();
    app.useGlobalGuards(
      new TenantGuard(reflector, context),
      new PermissionGuard(reflector, context),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    actor = {
      customerGroupId: groupId,
      userId,
      isInternal: false,
      accountIds: [],
      permissions: new Set<string>([PERMISSIONS.QUOTES_CREATE]),
      correlationId: 'dg-switch-e2e',
    };
  });

  afterAll(async () => {
    await owner.featureSwitch.deleteMany({ where: { key: SWITCH_KEY } });
    await owner.quote.deleteMany({ where: { customerGroupId: groupId } });
    await owner.user.deleteMany({ where: { id: userId } });
    await owner.customerGroup.deleteMany({ where: { id: groupId } });
    await app?.close();
    await owner.$disconnect();
    await database.$disconnect();
  });

  it('refuses a dangerous goods request when an administrator turns the switch off', async () => {
    await setSwitch(false);

    const response = await request(app.getHttpServer())
      .post('/api/quotes')
      .send(body())
      .expect(403);

    expect(response.body.details?.code).toBe('DANGEROUS_GOODS_UNAVAILABLE');
  });

  it('still accepts an ordinary request while the switch is off', async () => {
    // Off must stop the hazard, not the product.
    await setSwitch(false);

    const { dangerousGoods: _dg, ...ordinary } = body();

    await request(app.getHttpServer()).post('/api/quotes').send(ordinary).expect(201);
  });

  it('accepts a dangerous goods request when the switch is on', async () => {
    await setSwitch(true);

    await request(app.getHttpServer()).post('/api/quotes').send(body()).expect(201);
  });

  it('falls back to the catalogue default when no row exists', async () => {
    // The catalogue ships this on. A missing row is "still at the default", not
    // "off" - the feature_switch table holds overrides, never the whole state.
    await owner.featureSwitch.deleteMany({ where: { key: SWITCH_KEY } });

    await request(app.getHttpServer()).post('/api/quotes').send(body()).expect(201);
  });
});
