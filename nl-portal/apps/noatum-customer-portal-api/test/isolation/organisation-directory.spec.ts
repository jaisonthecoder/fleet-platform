import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@prisma/client';

/**
 * ORG-02 invariants, asserted against a real PostgreSQL instance because every
 * one of them is enforced by the database rather than by a service.
 */
describe('organisation directory on the disposable database', () => {
  let database: PrismaClient;
  // The runtime role has no write grant on master_org at all - that is the point of
  // ORG-02 - so tidy-up and the "even with table rights" assertions need the owner.
  let owner: PrismaClient;
  let instance: string;

  beforeAll(async () => {
    database = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 }),
    });
    owner = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_MIGRATION_URL, connectionTimeoutMillis: 5000 }),
    });
    await database.$connect();
    await owner.$connect();
  });

  beforeEach(() => { instance = `TEST-${randomUUID().slice(0, 8)}`; });

  afterEach(async () => {
    await owner.$executeRaw`DELETE FROM customer_group WHERE slug LIKE 'org-gate-%'`;
    await owner.$executeRaw`DELETE FROM master_org WHERE source_instance LIKE 'TEST-%'`;
    await owner.$executeRaw`DELETE FROM org_import_run WHERE source_instance LIKE 'TEST-%'`;
  });

  afterAll(async () => {
    await database?.$disconnect();
    await owner?.$disconnect();
  });

  function internal<T>(work: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.is_internal', 'true', true)`;
      return work(transaction);
    });
  }

  interface BatchCounts { read: number; created: number; updated: number; unchanged: number; rejected: number; errors: unknown[] }

  async function runImport(kind: 'feed' | 'file' | 'manual', rows: Record<string, unknown>[]): Promise<BatchCounts> {
    return internal(async (transaction) => {
      const [run] = await transaction.$queryRaw<{ id: string }[]>`
        INSERT INTO org_import_run (source_kind, source_instance, mode)
        VALUES (${kind}::org_source_kind, ${instance}, 'delta') RETURNING id`;
      const [applied] = await transaction.$queryRaw<{ result: BatchCounts }[]>`
        SELECT app.apply_organisation_batch(${run!.id}::uuid, ${JSON.stringify(rows)}::jsonb) AS result`;
      return applied!.result;
    });
  }

  function org(overrides: Record<string, unknown> = {}) {
    return { sourceCode: 'GATE001', name: 'Gate Test Logistics SA', countryCode: 'ES', city: 'Madrid', ...overrides };
  }

  async function organisation() {
    return internal(async (transaction) => {
      const [row] = await transaction.$queryRaw<{ id: string; is_source_confirmed: boolean }[]>`
        SELECT id, is_source_confirmed FROM master_org WHERE source_instance = ${instance}`;
      return row!;
    });
  }

  async function account(orgId: string | null) {
    return internal(async (transaction) => {
      const group = await transaction.customerGroup.create({
        data: { name: 'Gate test group', slug: `org-gate-${randomUUID().slice(0, 8)}` },
      });
      return transaction.customerAccount.create({
        data: { customerGroupId: group.id, name: 'Gate test account', cw1OrgCode: `GATE-${randomUUID().slice(0, 8)}`, orgId },
      });
    });
  }

  describe('the link gate', () => {
    it('refuses to link a customer to an organisation no source has confirmed', async () => {
      await runImport('manual', [org()]);
      const provisional = await organisation();
      expect(provisional.is_source_confirmed).toBe(false);

      await expect(account(provisional.id)).rejects.toMatchObject({ code: 'P2003' });

      const linked = await internal((transaction) => transaction.customerAccount.count({ where: { orgId: provisional.id } }));
      expect(linked).toBe(0);
    });

    it('allows the link once a source run has confirmed the organisation', async () => {
      await runImport('file', [org()]);
      const confirmed = await organisation();
      expect(confirmed.is_source_confirmed).toBe(true);

      const created = await account(confirmed.id);
      expect(created.orgId).toBe(confirmed.id);
      // There is no approval step; a link is effective when created. What a
      // customer may see is gated by the customer's own lifecycle instead.
      expect(created.isActive).toBe(true);
    });

    it('refuses to unconfirm an organisation that is already linked', async () => {
      await runImport('file', [org()]);
      const confirmed = await organisation();
      await account(confirmed.id);

      // Attempted as the owner, so this proves the constraint rather than the grant.
      await expect(owner.$executeRaw`
        UPDATE master_org SET is_source_confirmed = false WHERE id = ${confirmed.id}::uuid`)
        .rejects.toThrow(/customer_account_org_confirmed_fkey/);
    });

    it('keeps a manual row provisional and lets a later source run confirm it, never the reverse', async () => {
      await runImport('manual', [org()]);
      expect((await organisation()).is_source_confirmed).toBe(false);

      await runImport('file', [org()]);
      expect((await organisation()).is_source_confirmed).toBe(true);

      // Touching a confirmed row from a manual run must not demote it back.
      await runImport('manual', [org({ city: 'Barcelona' })]);
      expect((await organisation()).is_source_confirmed).toBe(true);
    });
  });

  describe('the validated write path', () => {
    it('refuses a direct write from the runtime role, so the mirror has exactly one door', async () => {
      await expect(internal((transaction) => transaction.$executeRaw`
        INSERT INTO master_org (source_code, source_instance, name) VALUES ('DIRECT1', ${instance}, 'Direct write')`))
        .rejects.toThrow(/permission denied/i);
    });

    it('creates, then reports unchanged, then updates on a real content change', async () => {
      expect(await runImport('file', [org()])).toMatchObject({ created: 1, updated: 0, unchanged: 0 });
      expect(await runImport('file', [org()])).toMatchObject({ created: 0, updated: 0, unchanged: 1 });
      expect(await runImport('file', [org({ city: 'Valencia' })])).toMatchObject({ created: 0, updated: 1, unchanged: 0 });

      // History records the two real changes and stays silent about the repeat.
      const history = await internal((transaction) => transaction.orgChangeLog.findMany({
        where: { org: { sourceInstance: instance } }, orderBy: { createdAt: 'asc' },
      }));
      expect(history.map(({ changeType }) => changeType)).toEqual(['created', 'updated']);
    });

    it('rejects unusable rows, reports why, and still applies the good ones', async () => {
      const result = await runImport('file', [org(), { sourceCode: '  ', name: 'No code' }, { sourceCode: 'X1' }]);
      expect(result).toMatchObject({ read: 3, created: 1, rejected: 2 });
      expect(result.errors).toEqual([
        expect.objectContaining({ index: 2, reason: 'missing source code' }),
        expect.objectContaining({ index: 3, reason: 'missing name' }),
      ]);
    });

    it('treats a case variant as the same organisation, not a second one', async () => {
      await runImport('file', [org({ sourceCode: 'GATE001' })]);
      await runImport('file', [org({ sourceCode: 'gate001' })]);
      const rows = await internal((transaction) => transaction.masterOrg.count({ where: { sourceInstance: instance } }));
      expect(rows).toBe(1);
    });

    it('lowers the batch write flag again, so the caller keeps no elevated access', async () => {
      const flag = await internal(async (transaction) => {
        const [run] = await transaction.$queryRaw<{ id: string }[]>`
          INSERT INTO org_import_run (source_kind, source_instance, mode)
          VALUES ('file', ${instance}, 'delta') RETURNING id`;
        await transaction.$queryRaw`SELECT app.apply_organisation_batch(${run!.id}::uuid, '[]'::jsonb)`;
        const [current] = await transaction.$queryRaw<{ flag: string }[]>`
          SELECT COALESCE(NULLIF(current_setting('app.org_batch', true), ''), 'off') AS flag`;
        return current!.flag;
      });
      expect(flag).toBe('off');
    });
  });

  describe('row level security', () => {
    it('shows a customer context none of the directory, so it cannot enumerate organisations or customers', async () => {
      await runImport('file', [org()]);

      const visible = await database.$transaction(async (transaction) => {
        await transaction.$executeRaw`SELECT set_config('app.is_internal', 'false', true)`;
        await transaction.$executeRaw`SELECT set_config('app.current_group', ${randomUUID()}, true)`;
        const [counts] = await transaction.$queryRaw<{ orgs: bigint; addresses: bigint; runs: bigint; changes: bigint }[]>`
          SELECT (SELECT count(*) FROM master_org) AS orgs,
                 (SELECT count(*) FROM org_address) AS addresses,
                 (SELECT count(*) FROM org_import_run) AS runs,
                 (SELECT count(*) FROM org_change_log) AS changes`;
        return counts!;
      });

      expect(visible).toEqual({ orgs: 0n, addresses: 0n, runs: 0n, changes: 0n });
    });

    it('refuses a customer context writing to the directory', async () => {
      await expect(database.$transaction(async (transaction) => {
        await transaction.$executeRaw`SELECT set_config('app.is_internal', 'false', true)`;
        await transaction.$executeRaw`
          INSERT INTO org_import_run (source_kind, source_instance, mode) VALUES ('file', ${instance}, 'delta')`;
      })).rejects.toThrow(/row-level security/i);
    });
  });
});
