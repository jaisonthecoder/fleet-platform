import { randomUUID } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PgBoss } from 'pg-boss';

import type { PrismaService } from '../../src/common/tenancy/prisma.service';
import { TenantContext } from '../../src/common/tenancy/tenant-context';
import { TenantRepository } from '../../src/common/tenancy/tenant.repository';
import { JOB_NAMES, type JobHandler } from '../../src/integration/jobs/job.registry';
import { JobsService } from '../../src/integration/jobs/jobs.service';
import { seedTwoTenants, type TwoTenants } from '../fixtures/tenants.fixture';

describe('transaction-bound job enqueue', () => {
  let database: PrismaClient;
  let tenants: TwoTenants;
  let jobs: JobsService;
  let workerRegistration: jest.SpyInstance;
  const context = new TenantContext();

  const handler: JobHandler = {
    name: JOB_NAMES.QUOTE_EXPIRY,
    tenantScoped: true,
    handle: async () => undefined,
  };

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL!;
    database = new PrismaClient({
      adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }),
    });
    await database.$connect();
    tenants = await seedTwoTenants(database);

    const setup = new PgBoss({ connectionString, schema: 'pgboss', createSchema: false });
    try {
      await setup.start();
    } finally {
      await setup.stop();
    }

    workerRegistration = jest.spyOn(PgBoss.prototype, 'work').mockResolvedValue('controlled-test-worker');
    jobs = new JobsService(new ConfigService({
      database: { url: connectionString },
      jobs: { enabled: true, schema: 'pgboss' },
    }), context, [handler]);
    await jobs.onModuleInit();
  });

  afterAll(async () => {
    try {
      await jobs?.onApplicationShutdown();
    } finally {
      workerRegistration?.mockRestore();
      await database?.$disconnect();
    }
  });

  async function queued(jobId: string) {
    return database.$queryRaw<{ id: string; data: Record<string, unknown> }[]>`
      SELECT id, data FROM pgboss.job WHERE id = ${jobId}::uuid`;
  }

  it('commits the business write and job together, with no job visible before commit', async () => {
    const name = `Committed job ${randomUUID()}`;
    const jobId = await database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.customer_group_id', ${tenants.a.groupId}, true)`;
      const address = await transaction.addressBookEntry.create({
        data: { customerGroupId: tenants.a.groupId, name },
      });
      const enqueued = await jobs.enqueue(transaction, handler.name, {
        customerGroupId: tenants.a.groupId,
        addressId: address.id,
      }, { sourceMessageId: randomUUID(), portalRef: address.id });
      expect(enqueued).not.toBeNull();
      expect(await queued(enqueued!)).toEqual([]);
      return enqueued!;
    });

    const rows = await queued(jobId);
    expect(rows).toHaveLength(1);
    await database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.customer_group_id', ${tenants.a.groupId}, true)`;
      const address = await transaction.addressBookEntry.findFirst({ where: { name } });
      expect(address?.id).toBe(rows[0]?.data.addressId);
      await transaction.addressBookEntry.deleteMany({ where: { name } });
    });
  });

  it('rolls back both the business write and the enqueued job', async () => {
    const name = `Rolled back job ${randomUUID()}`;
    let jobId: string | null = null;
    await expect(database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.customer_group_id', ${tenants.a.groupId}, true)`;
      await transaction.addressBookEntry.create({ data: { customerGroupId: tenants.a.groupId, name } });
      jobId = await jobs.enqueue(transaction, handler.name, { customerGroupId: tenants.a.groupId },
        { sourceMessageId: randomUUID(), portalRef: name });
      expect(jobId).not.toBeNull();
      throw new Error('Expected business rollback');
    })).rejects.toThrow('Expected business rollback');

    expect(jobId).not.toBeNull();
    expect(await queued(jobId!)).toEqual([]);
    await database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.customer_group_id', ${tenants.a.groupId}, true)`;
      expect(await transaction.addressBookEntry.findMany({ where: { name } })).toEqual([]);
    });
  });

  it('inserts only one job for concurrent deliveries and preserves the original payload', async () => {
    const identity = { sourceMessageId: randomUUID(), portalRef: 'Q-duplicate' };
    const payload = { customerGroupId: tenants.a.groupId, value: 'original' };
    const enqueue = () => database.$transaction((transaction) =>
      jobs.enqueue(transaction, handler.name, payload, identity));
    const results = await Promise.all([enqueue(), enqueue()]);
    expect(results.filter((id) => id !== null)).toHaveLength(1);
    expect(results.filter((id) => id === null)).toHaveLength(1);
    const jobId = results.find((id) => id !== null)!;
    expect(await database.$transaction((transaction) => jobs.enqueue(
      transaction, handler.name, { ...payload, value: 'changed' }, identity,
    ))).toBeNull();
    expect((await queued(jobId))[0]?.data).toEqual(payload);
  });

  it('separates tenants, source messages, portal references and ambiguous concatenations', async () => {
    const message = randomUUID();
    const cases = [
      [tenants.a.groupId, message, 'Q-one'],
      [tenants.b.groupId, message, 'Q-one'],
      [tenants.a.groupId, `${message}-other`, 'Q-one'],
      [tenants.a.groupId, message, 'Q-two'],
      [tenants.a.groupId, `${message}:a`, 'b'],
      [tenants.a.groupId, message, 'a:b'],
    ] as const;
    const ids: (string | null)[] = [];
    for (const [customerGroupId, sourceMessageId, portalRef] of cases) {
      ids.push(await database.$transaction((transaction) => jobs.enqueue(
        transaction, handler.name, { customerGroupId }, { sourceMessageId, portalRef },
      )));
    }
    expect(ids.every((id) => id !== null)).toBe(true);
    expect(new Set(ids).size).toBe(cases.length);
  });

  it('allows the same identity after its first transaction rolls back', async () => {
    const identity = { sourceMessageId: randomUUID(), portalRef: 'Q-retry-rollback' };
    const payload = { customerGroupId: tenants.a.groupId };
    let rolledBackId: string | null = null;
    await expect(database.$transaction(async (transaction) => {
      rolledBackId = await jobs.enqueue(transaction, handler.name, payload, identity);
      throw new Error('Expected rollback');
    })).rejects.toThrow('Expected rollback');
    expect(rolledBackId).not.toBeNull();
    expect(await database.$transaction((transaction) => jobs.enqueue(
      transaction, handler.name, payload, identity,
    ))).toBe(rolledBackId);
  });

  it.each([
    { sourceMessageId: '', portalRef: 'Q-invalid' },
    { sourceMessageId: 'message', portalRef: '   ' },
  ])('rejects incomplete enqueue identity %j', async (identity) => {
    await expect(database.$transaction((transaction) => jobs.enqueue(
      transaction, handler.name, { customerGroupId: tenants.a.groupId }, identity,
    ))).rejects.toThrow('requires a source message ID and portal reference');
  });

  it('suppresses duplicates while active and after completion while the job is retained', async () => {
    const identity = { sourceMessageId: randomUUID(), portalRef: 'Q-retained' };
    const payload = { customerGroupId: tenants.a.groupId };
    const enqueue = () => database.$transaction((transaction) => jobs.enqueue(
      transaction, handler.name, payload, identity,
    ));
    const jobId = await enqueue();
    expect(jobId).not.toBeNull();
    const consumer = new PgBoss({
      connectionString: process.env.DATABASE_URL, schema: 'pgboss', createSchema: false, migrate: false,
    });
    try {
      await consumer.start();
      const active = await consumer.fetch(handler.name, { batchSize: 100 });
      expect(active.some((job) => job.id === jobId)).toBe(true);
      expect(await enqueue()).toBeNull();
      await consumer.complete(handler.name, jobId!);
      const states = await database.$queryRaw<{ state: string }[]>`
        SELECT state FROM pgboss.job WHERE id = ${jobId}::uuid`;
      expect(states[0]?.state).toBe('completed');
      expect(await enqueue()).toBeNull();
    } finally {
      await consumer.stop();
    }
  });

  it('runs tenant handlers with usable single-tenant access, without inheriting system access', async () => {
    const repository = new TenantRepository(database as PrismaService, context);
    const payload = { customerGroupId: tenants.a.groupId, reference: 'scope-fixture' };
    const callback = workerRegistration.mock.calls[0]![2] as
      (batch: { data: unknown }[]) => Promise<void>;
    const handle = jest.spyOn(handler, 'handle').mockImplementation(async (received) => {
      expect(received).toBe(payload);
      expect(context.require()).toMatchObject({
        customerGroupId: tenants.a.groupId, isInternal: false, userId: 'system',
      });
      await repository.run(async (transaction) => {
        expect(await transaction.addressBookEntry.findUnique({ where: { id: tenants.a.addressId } }))
          .not.toBeNull();
        expect(await transaction.addressBookEntry.findUnique({ where: { id: tenants.b.addressId } }))
          .toBeNull();
        const address = await transaction.addressBookEntry.create({
          data: { customerGroupId: tenants.a.groupId, name: 'Worker scope fixture' },
        });
        await transaction.addressBookEntry.delete({ where: { id: address.id } });
        expect(await transaction.addressBookEntry.updateMany({
          where: { id: tenants.b.addressId }, data: { name: 'Must not change' },
        })).toEqual({ count: 0 });
      });
      await expect(repository.runInternal(async () => undefined)).rejects.toThrow('requires an internal');
      await expect(repository.runAsGroup(tenants.b.groupId, async () => undefined))
        .rejects.toThrow('requires an internal');
    });
    try {
      await context.runAsSystem('ambient-system', async () => {
        await callback([{ data: payload }]);
        expect(context.require()).toMatchObject({ isInternal: true, correlationId: 'ambient-system' });
      });
      expect(handle).toHaveBeenCalledTimes(1);
      expect(context.peek()).toBeNull();
    } finally {
      handle.mockRestore();
    }
  });

  it('keeps a committed job available to a new queue connection after shutdown', async () => {
    const jobId = await database.$transaction((transaction) => jobs.enqueue(
      transaction, handler.name, { customerGroupId: tenants.a.groupId },
      { sourceMessageId: randomUUID(), portalRef: 'Q-restart' },
    ));
    await jobs.onApplicationShutdown();

    const restarted = new PgBoss({
      connectionString: process.env.DATABASE_URL,
      schema: 'pgboss',
      createSchema: false,
      migrate: false,
    });
    try {
      await restarted.start();
      const pending = await restarted.fetch(handler.name, { batchSize: 100 });
      expect(pending.some((job) => job.id === jobId)).toBe(true);
    } finally {
      await restarted.stop();
    }
  });
});
