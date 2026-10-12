import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { PrismaService } from '../../src/common/tenancy/prisma.service';
import { TenantContext, type TenantContextData } from '../../src/common/tenancy/tenant-context';
import { TenantRepository } from '../../src/common/tenancy/tenant.repository';
import { IntegrationRelayHandler } from '../../src/integration/jobs/handlers/integration-relay.handler';
import { IntegrationRetentionHandler } from '../../src/integration/jobs/handlers/integration-retention.handler';
import { QuoteExpiryHandler } from '../../src/integration/jobs/handlers/quote-expiry.handler';

/** Minimal stand-in for ConfigService: the handlers only ever read one key shape. */
const configWith = (transports: Record<string, string>) =>
  ({ get: (key: string) => transports[key.replace('cw1.transport.', '')] ?? 'none' }) as never;

/** Same idea for the retention window. */
const configRetain = (days: number) => ({ get: () => days }) as never;

describe('integration job handlers', () => {
  let owner: PrismaClient;
  let prisma: PrismaService;
  let repository: TenantRepository;
  let context: TenantContext;
  let groupId: string;

  const system = (): TenantContextData => ({
    customerGroupId: null,
    userId: 'system',
    isInternal: true,
    accountIds: [],
    permissions: new Set<string>(),
    correlationId: `jobs-${randomUUID()}`,
  });

  const tenant = (): TenantContextData => ({
    customerGroupId: groupId,
    userId: 'system',
    isInternal: false,
    accountIds: [],
    permissions: new Set<string>(),
    correlationId: `jobs-${randomUUID()}`,
  });

  beforeAll(async () => {
    owner = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_MIGRATION_URL,
        connectionTimeoutMillis: 5000,
      }),
    });
    await owner.$connect();

    context = new TenantContext();
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new TenantRepository(prisma, context);

    const suffix = randomUUID().slice(0, 8);
    const group = await owner.customerGroup.create({
      data: { name: `Jobs ${suffix}`, slug: `jobs-${suffix}`, status: 'active' },
    });
    groupId = group.id;
  });

  afterAll(async () => {
    await owner.quote.deleteMany({ where: { customerGroupId: groupId } });
    await owner.auditEvent.deleteMany({ where: { customerGroupId: groupId } });
    await owner.integrationMessage.deleteMany({ where: { customerGroupId: groupId } });
    await owner.customerGroup.deleteMany({ where: { id: groupId } });
    await prisma.$disconnect();
    await owner.$disconnect();
  });

  const queueMessage = (operation: string) =>
    owner.integrationMessage.create({
      data: {
        direction: 'outbound',
        status: 'pending',
        operation,
        portalRef: `Q-${randomUUID().slice(0, 8)}`,
        idempotencyKey: `${randomUUID()}:v1`,
        payload: {},
        customerGroupId: groupId,
        nextAttemptAt: new Date(),
      },
      select: { id: true },
    });

  describe('the relay holds everything while no transport is configured', () => {
    it('leaves messages pending and untouched', async () => {
      const message = await queueMessage('quote.request.create');
      const relay = new IntegrationRelayHandler(repository, configWith({}));

      await context.run(system(), () => relay.handle());

      const after = await owner.integrationMessage.findUnique({ where: { id: message.id } });
      expect(after?.status).toBe('pending');
      expect(after?.attempts).toBe(0);
      expect(after?.sentAt).toBeNull();
    });

    it('never leaves a row stranded in sending', async () => {
      // The relay deliberately does not claim while nothing can send. A claim and
      // its release commit separately, so a restart between them would strand the
      // row where no later pass would ever pick it up again.
      await queueMessage('quote.request.create');
      const relay = new IntegrationRelayHandler(repository, configWith({ quote: 'http' }));

      await context.run(system(), () => relay.handle());

      const stranded = await owner.integrationMessage.count({ where: { status: 'sending' } });
      expect(stranded).toBe(0);
    });

    it('does not consume attempts or backoff for messages nobody could send', async () => {
      // Inflating attempts would push the first real attempt hours into the future
      // on the day a transport is finally bound.
      const message = await queueMessage('quote.request.create');
      const relay = new IntegrationRelayHandler(repository, configWith({ quote: 'http' }));

      await context.run(system(), () => relay.handle());

      const after = await owner.integrationMessage.findUnique({ where: { id: message.id } });
      expect(after?.attempts).toBe(0);
      expect(after?.status).toBe('pending');
      expect(after?.lastError).toBeNull();
    });
  });

  describe('quote expiry', () => {
    // An accepted quote must name the option the customer chose - the
    // `quote_accepted_names_an_option` check refuses any other shape, because an
    // acceptance that does not say what was accepted is not an acceptance.
    const seedQuote = async (status: 'submitted' | 'accepted', validUntil: Date) => {
      const quote = await owner.quote.create({
        data: {
          customerGroupId: groupId,
          reference: `Q-${randomUUID().slice(0, 8)}`,
          status: 'submitted',
          mode: 'sea',
          originCode: 'ESVLC',
          destinationCode: 'NLRTM',
          validUntil,
        },
        select: { id: true },
      });

      if (status === 'accepted') {
        const option = await owner.quoteOption.create({
          data: { quoteId: quote.id, position: 1, name: 'Standard' },
          select: { id: true },
        });
        await owner.quote.update({
          where: { id: quote.id },
          data: {
            status: 'accepted',
            acceptedOptionId: option.id,
            decidedAt: new Date(),
          },
        });
      }

      return quote;
    };

    const yesterday = () => new Date(Date.now() - 24 * 60 * 60 * 1000);
    const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000);

    it('expires a quote past its validity and records it', async () => {
      const quote = await seedQuote('submitted', yesterday());
      const handler = new QuoteExpiryHandler(repository);

      await context.run(tenant(), () => handler.handle({ customerGroupId: groupId }));

      const after = await owner.quote.findUnique({ where: { id: quote.id } });
      expect(after?.status).toBe('expired');

      const audit = await owner.auditEvent.findFirst({
        where: { customerGroupId: groupId, action: 'quote.expired' },
      });
      expect(audit).not.toBeNull();
    });

    it('leaves a quote that is still valid', async () => {
      const quote = await seedQuote('submitted', tomorrow());
      const handler = new QuoteExpiryHandler(repository);

      await context.run(tenant(), () => handler.handle({ customerGroupId: groupId }));

      const after = await owner.quote.findUnique({ where: { id: quote.id } });
      expect(after?.status).toBe('submitted');
    });

    it('never touches a quote the customer already accepted', async () => {
      const quote = await seedQuote('accepted', yesterday());
      const handler = new QuoteExpiryHandler(repository);

      await context.run(tenant(), () => handler.handle({ customerGroupId: groupId }));

      const after = await owner.quote.findUnique({ where: { id: quote.id } });
      expect(after?.status).toBe('accepted');
    });

    it('is idempotent across repeated runs', async () => {
      // It runs hourly over the same rows, so a second pass must be a no-op rather
      // than writing a second audit row for the same expiry.
      await seedQuote('submitted', yesterday());
      const handler = new QuoteExpiryHandler(repository);

      await context.run(tenant(), () => handler.handle({ customerGroupId: groupId }));
      const afterFirst = await owner.auditEvent.count({
        where: { customerGroupId: groupId, action: 'quote.expired' },
      });

      await context.run(tenant(), () => handler.handle({ customerGroupId: groupId }));
      const afterSecond = await owner.auditEvent.count({
        where: { customerGroupId: groupId, action: 'quote.expired' },
      });

      expect(afterSecond).toBe(afterFirst);
    });
  });

  describe('retention', () => {
    const aged = (status: 'sent' | 'pending', daysOld: number) =>
      owner.integrationMessage.create({
        data: {
          direction: 'outbound',
          status,
          operation: 'quote.request.create',
          portalRef: `Q-${randomUUID().slice(0, 8)}`,
          idempotencyKey: `${randomUUID()}:v1`,
          payload: { secret: 'customer cargo detail' },
          customerGroupId: groupId,
          createdAt: new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000),
        },
        select: { id: true },
      });

    it('blanks the payload of a settled message past retention', async () => {
      const message = await aged('sent', 400);
      const handler = new IntegrationRetentionHandler(repository, configRetain(395));

      await context.run(system(), () => handler.handle());

      const after = await owner.integrationMessage.findUnique({ where: { id: message.id } });
      expect(after?.payload).toEqual({});
      // The record that an exchange happened survives; only the data goes.
      expect(after?.operation).toBe('quote.request.create');
    });

    it('never blanks a message still waiting to be sent', async () => {
      // However old it is, a pending message still has work to do, and without its
      // payload that work becomes impossible.
      const message = await aged('pending', 400);
      const handler = new IntegrationRetentionHandler(repository, configRetain(395));

      await context.run(system(), () => handler.handle());

      const after = await owner.integrationMessage.findUnique({ where: { id: message.id } });
      expect(after?.payload).toEqual({ secret: 'customer cargo detail' });
    });

    it('leaves a settled message inside the retention window alone', async () => {
      const message = await aged('sent', 10);
      const handler = new IntegrationRetentionHandler(repository, configRetain(395));

      await context.run(system(), () => handler.handle());

      const after = await owner.integrationMessage.findUnique({ where: { id: message.id } });
      expect(after?.payload).toEqual({ secret: 'customer cargo detail' });
    });

    it('refuses a retention of less than a day', async () => {
      const handler = new IntegrationRetentionHandler(repository, configRetain(0));

      await expect(context.run(system(), () => handler.handle())).rejects.toThrow(/at least one day/i);
    });

    it('refuses a non-internal caller', async () => {
      // The function blanks data across every customer, so it must never be
      // reachable from a customer session.
      const handler = new IntegrationRetentionHandler(repository, configRetain(395));

      await expect(
        context.run(tenant(), () => handler.handle()),
      ).rejects.toThrow();
    });

    it('keeps a failed message replayable', async () => {
      // The status enum says failed rows are "kept for replay", and a replay needs
      // the payload.
      const message = await owner.integrationMessage.create({
        data: {
          direction: 'outbound',
          status: 'failed',
          operation: 'quote.request.create',
          portalRef: `Q-${randomUUID().slice(0, 8)}`,
          idempotencyKey: `${randomUUID()}:v1`,
          payload: { secret: 'customer cargo detail' },
          customerGroupId: groupId,
          createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
        },
        select: { id: true },
      });
      const handler = new IntegrationRetentionHandler(repository, configRetain(395));

      await context.run(system(), () => handler.handle());

      const after = await owner.integrationMessage.findUnique({ where: { id: message.id } });
      expect(after?.payload).toEqual({ secret: 'customer cargo detail' });
    });
  });
});
