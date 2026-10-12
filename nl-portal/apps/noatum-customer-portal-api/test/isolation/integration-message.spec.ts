import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { TenantContext } from '../../src/common/tenancy/tenant-context';
import { TenantRepository } from '../../src/common/tenancy/tenant.repository';
import { PrismaService } from '../../src/common/tenancy/prisma.service';
import {
  INTEGRATION_OPERATIONS,
  IntegrationMessageService,
} from '../../src/integration/messages/integration-message.service';

/**
 * C1: the outbound store and the hold.
 *
 * The property that matters is atomicity. If a quote can exist without the
 * instruction to tell CargoWise about it, the hold has quietly become a loss.
 */
describe('integration message store', () => {
  let owner: PrismaClient;
  let prisma: PrismaService;
  let repository: TenantRepository;
  let context: TenantContext;
  let messages: IntegrationMessageService;
  let groupId: string;

  const staff = () => ({
    customerGroupId: null,
    userId: randomUUID(),
    isInternal: true,
    accountIds: [],
    permissions: new Set<string>(),
    correlationId: `im-${randomUUID()}`,
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
    messages = new IntegrationMessageService();

    const group = await owner.customerGroup.create({
      data: { name: `Messages ${randomUUID().slice(0, 8)}`, slug: `msg-${randomUUID().slice(0, 8)}` },
    });
    groupId = group.id;
  });

  afterAll(async () => {
    await owner.integrationMessage.deleteMany({ where: { customerGroupId: groupId } });
    await owner.customerGroup.deleteMany({ where: { id: groupId } });
    await prisma.$disconnect();
    await owner.$disconnect();
  });

  const outbound = (reference: string, version = 1) => ({
    operation: INTEGRATION_OPERATIONS.QUOTE_REQUEST_CREATE,
    portalRef: reference,
    idempotencyKey: `${reference}:v${version}`,
    payload: { reference, mode: 'sea' },
    customerGroupId: groupId,
  });

  it('records an outbound message as pending, and sends nothing', async () => {
    const reference = `Q-${randomUUID().slice(0, 8)}`;

    const id = await context.run(staff(), () =>
      repository.runInternal((tx) => messages.recordOutbound(tx, outbound(reference))),
    );

    const row = await owner.integrationMessage.findUnique({ where: { id: id! } });
    expect(row?.status).toBe('pending');
    expect(row?.direction).toBe('outbound');
    expect(row?.sentAt).toBeNull();
    expect(row?.attempts).toBe(0);
  });

  it('rolls the message back with the business change that caused it', async () => {
    const reference = `Q-${randomUUID().slice(0, 8)}`;

    await expect(
      context.run(staff(), () =>
        repository.runInternal(async (tx) => {
          await messages.recordOutbound(tx, outbound(reference));
          // Whatever the business write was, it failed. The instruction to tell
          // CargoWise must not survive it.
          throw new Error('business write failed');
        }),
      ),
    ).rejects.toThrow('business write failed');

    const rows = await owner.integrationMessage.findMany({ where: { portalRef: reference } });
    expect(rows).toHaveLength(0);
  });

  it('does not queue a second message when the same action is retried', async () => {
    const reference = `Q-${randomUUID().slice(0, 8)}`;

    const first = await context.run(staff(), () =>
      repository.runInternal((tx) => messages.recordOutbound(tx, outbound(reference))),
    );
    const second = await context.run(staff(), () =>
      repository.runInternal((tx) => messages.recordOutbound(tx, outbound(reference))),
    );

    // Null means "already recorded", and crucially the caller's transaction was
    // not poisoned by a unique violation.
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    const rows = await owner.integrationMessage.findMany({ where: { portalRef: reference } });
    expect(rows).toHaveLength(1);
  });

  it('allocates a new message when the quote is re-priced', async () => {
    const reference = `Q-${randomUUID().slice(0, 8)}`;

    await context.run(staff(), () =>
      repository.runInternal((tx) => messages.recordOutbound(tx, outbound(reference, 1))),
    );
    await context.run(staff(), () =>
      repository.runInternal((tx) => messages.recordOutbound(tx, outbound(reference, 2))),
    );

    const rows = await owner.integrationMessage.findMany({ where: { portalRef: reference } });
    expect(rows).toHaveLength(2);
  });

  it('records a skipped message rather than writing nothing', async () => {
    const reference = `Q-${randomUUID().slice(0, 8)}`;

    const id = await context.run(staff(), () =>
      repository.runInternal((tx) =>
        messages.recordOutbound(tx, { ...outbound(reference), skip: true }),
      ),
    );

    const row = await owner.integrationMessage.findUnique({ where: { id: id! } });
    // "We chose not to send" must stay distinguishable from "we lost it".
    expect(row?.status).toBe('skipped');
    expect(row?.nextAttemptAt).toBeNull();
  });

  it('archives an inbound message once, however many times it arrives', async () => {
    const sourceMessageId = `cw1-${randomUUID()}`;
    const archive = () =>
      context.run(staff(), () =>
        repository.runInternal((tx) =>
          messages.archiveInbound(tx, {
            operation: 'quote.priced.received',
            sourceMessageId,
            payload: { some: 'payload' },
          }),
        ),
      );

    const first = await archive();
    const second = await archive();

    expect(first).not.toBeNull();
    expect(second).toBeNull();

    const rows = await owner.integrationMessage.findMany({ where: { sourceMessageId } });
    expect(rows).toHaveLength(1);
    await owner.integrationMessage.deleteMany({ where: { sourceMessageId } });
  });

  it('lets a CUSTOMER context record its own outbound message', async () => {
    // The point of the table is that the message is written in the same
    // transaction as the business change. A customer submitting a quote runs as
    // a customer, so if this cannot write, C6 is unbuildable.
    const reference = `Q-${randomUUID().slice(0, 8)}`;
    const customer = {
      customerGroupId: groupId,
      userId: randomUUID(),
      isInternal: false,
      accountIds: [],
      permissions: new Set<string>(),
      correlationId: `im-${randomUUID()}`,
    };

    const id = await context.run(customer, () =>
      repository.run((tx) => messages.recordOutbound(tx, outbound(reference))),
    );

    expect(id).not.toBeNull();
    const row = await owner.integrationMessage.findUnique({ where: { id: id! } });
    expect(row?.status).toBe('pending');
  });

  it('does not let a customer read the table it just wrote to', async () => {
    const reference = `Q-${randomUUID().slice(0, 8)}`;
    const customer = {
      customerGroupId: groupId,
      userId: randomUUID(),
      isInternal: false,
      accountIds: [],
      permissions: new Set<string>(),
      correlationId: `im-${randomUUID()}`,
    };

    await context.run(customer, () =>
      repository.run((tx) => messages.recordOutbound(tx, outbound(reference))),
    );

    // RLS returns nothing rather than throwing, which is why this asserts on the
    // rows and not on an exception.
    const visible = await context.run(customer, () =>
      repository.run((tx) => tx.integrationMessage.findMany({ where: { portalRef: reference } })),
    );

    expect(visible).toHaveLength(0);
  });

  it('refuses to record an outbound message for another customer', async () => {
    const other = await owner.customerGroup.create({
      data: { name: `Other ${randomUUID().slice(0, 8)}`, slug: `other-${randomUUID().slice(0, 8)}` },
    });
    const customer = {
      customerGroupId: groupId,
      userId: randomUUID(),
      isInternal: false,
      accountIds: [],
      permissions: new Set<string>(),
      correlationId: `im-${randomUUID()}`,
    };

    await expect(
      context.run(customer, () =>
        repository.run((tx) =>
          messages.recordOutbound(tx, {
            ...outbound(`Q-${randomUUID().slice(0, 8)}`),
            customerGroupId: other.id,
          }),
        ),
      ),
    ).rejects.toThrow(/another customer/i);

    await owner.customerGroup.deleteMany({ where: { id: other.id } });
  });
});
