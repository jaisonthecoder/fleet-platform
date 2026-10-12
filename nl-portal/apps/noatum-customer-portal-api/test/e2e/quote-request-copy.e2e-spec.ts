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
import { PERMISSIONS } from '../../src/contracts/permissions';
import { IntegrationMessageService } from '../../src/integration/messages/integration-message.service';
import { QuotesController } from '../../src/modules/quotes/quotes.controller';
import { QuotesService } from '../../src/modules/quotes/quotes.service';
import { noAnalytics } from '../fixtures/analytics.fixture';

/**
 * C6: the request copy goes to the adapter.
 *
 * The product owner's instruction was that every customer request should send a
 * copy to CargoWise. Holding the transport must not quietly become dropping the
 * message, so what is proved here is that the row exists, that it is `pending`
 * rather than sent, and that it carries the hazards - a copy that omits the
 * dangerous goods is a worse record than no copy at all.
 */
describe('C6 quote request copy', () => {
  const SWITCH_KEY = 'quotations.cw1_request_sync';

  let app: INestApplication;
  let database: PrismaClient;
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
    packages: [{ lineId: 'line-a', quantity: 6, packageType: 'drum', weightKg: 120 }],
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
        appliesToLines: ['line-a'],
      },
    ],
  });

  const setSwitch = async (isEnabled: boolean) => {
    await owner.featureSwitch.upsert({
      where: { key: SWITCH_KEY },
      create: { key: SWITCH_KEY, isEnabled, reason: 'C6 test' },
      update: { isEnabled },
    });
  };

  const submitOne = async () => {
    const created = await request(app.getHttpServer()).post('/api/quotes').send(body()).expect(201);
    const id = created.body.id as string;
    await request(app.getHttpServer()).post(`/api/quotes/${id}/submit`).expect(201);
    return created.body.reference as string;
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

    const group = await owner.customerGroup.create({
      data: {
        name: `C6 ${randomUUID().slice(0, 8)}`,
        slug: `c6-${randomUUID().slice(0, 8)}`,
        status: 'active',
        updatedAt: new Date(),
      },
      select: { id: true },
    });
    groupId = group.id;

    const user = await owner.user.create({
      data: {
        email: `c6-${randomUUID()}@example.test`,
        displayName: 'C6 tester',
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
      permissions: new Set<string>([PERMISSIONS.QUOTES_CREATE, PERMISSIONS.QUOTES_SUBMIT]),
      correlationId: 'c6-e2e',
    };
  });

  afterAll(async () => {
    await owner.featureSwitch.deleteMany({ where: { key: SWITCH_KEY } });
    await owner.integrationMessage.deleteMany({ where: { customerGroupId: groupId } });
    await owner.quote.deleteMany({ where: { customerGroupId: groupId } });
    await owner.user.deleteMany({ where: { id: userId } });
    await owner.customerGroup.deleteMany({ where: { id: groupId } });
    await app?.close();
    await owner.$disconnect();
    await database.$disconnect();
  });

  it('writes the request copy as pending, and sends nothing', async () => {
    await setSwitch(true);

    const reference = await submitOne();

    const message = await owner.integrationMessage.findFirst({
      where: { portalRef: reference, operation: 'quote.request.create' },
    });

    expect(message).not.toBeNull();
    // Held, not delivered: pending with nothing sent is the whole point.
    expect(message?.status).toBe('pending');
    expect(message?.direction).toBe('outbound');
    expect(message?.sentAt).toBeNull();
    expect(message?.idempotencyKey).toBe(`${reference}:v1`);
  });

  it('carries the declared hazards in the copy', async () => {
    await setSwitch(true);

    const reference = await submitOne();

    const message = await owner.integrationMessage.findFirstOrThrow({
      where: { portalRef: reference, operation: 'quote.request.create' },
    });

    const payload = message.payload as {
      commodity: string;
      dangerousGoods: { unNumber: string; hazardClass: string; appliesToLines: string[] }[];
    };

    expect(payload.commodity).toBe('Paint and solvents');
    expect(payload.dangerousGoods).toHaveLength(1);
    expect(payload.dangerousGoods[0]?.unNumber).toBe('1263');
    // The link survives the copy, so the far end knows which cargo is hazardous.
    expect(payload.dangerousGoods[0]?.appliesToLines).toEqual(['line-a']);
  });

  it('records the copy as skipped rather than writing nothing when the switch is off', async () => {
    await setSwitch(false);

    const reference = await submitOne();

    const message = await owner.integrationMessage.findFirstOrThrow({
      where: { portalRef: reference, operation: 'quote.request.create' },
    });

    // "We chose not to send" must stay distinguishable from "we lost it".
    expect(message.status).toBe('skipped');
  });

  it('leaves the customer unaffected by the copy either way', async () => {
    await setSwitch(false);

    const reference = await submitOne();

    const quote = await owner.quote.findFirstOrThrow({ where: { reference } });
    expect(quote.status).toBe('requested');
  });
});
