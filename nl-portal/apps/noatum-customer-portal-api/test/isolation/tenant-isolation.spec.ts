import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { seedTwoTenants, type TwoTenants } from '../fixtures/tenants.fixture';

/**
 * The suite that has to pass before anything ships.
 *
 * It talks to Postgres directly as portal_app - no Nest, no TenantRepository - because
 * the claim under test is that the DATABASE refuses cross-tenant access. If isolation
 * only worked through application code, a single forgotten `where` clause would be a
 * data breach.
 *
 * Add a case here for every table that gains a customer_group_id column.
 */
describe('tenant isolation (RLS)', () => {
  let db: PrismaClient;
  let tenants: TwoTenants;

  beforeAll(async () => {
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 }),
    });
    await db.$connect();
    tenants = await seedTwoTenants(db);
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  /** Mirrors what TenantRepository does, so the test exercises the real mechanism. */
  const asTenant = <T>(groupId: string | null, fn: (tx: PrismaClient) => Promise<T>) =>
    db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.customer_group_id', ${groupId ?? ''}, true)`;
      await tx.$executeRaw`SELECT set_config('app.is_internal', 'false', true)`;
      return fn(tx as unknown as PrismaClient);
    });

  describe('reads', () => {
    it('sees only its own quotes', async () => {
      const rows = await asTenant(tenants.a.groupId, (tx) => tx.quote.findMany());

      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe(tenants.a.quoteId);
    });

    it('cannot read another tenant quote even by primary key', async () => {
      const row = await asTenant(tenants.a.groupId, (tx) =>
        tx.quote.findUnique({ where: { id: tenants.b.quoteId } }),
      );

      // Not an error - the row is simply invisible, which is why the API returns 404.
      expect(row).toBeNull();
    });

    it.each([
      ['customerAccount', (tx: PrismaClient) => tx.customerAccount.findMany()],
      ['addressBookEntry', (tx: PrismaClient) => tx.addressBookEntry.findMany()],
      ['quoteTemplate', (tx: PrismaClient) => tx.quoteTemplate.findMany()],
      ['invitation', (tx: PrismaClient) => tx.invitation.findMany()],
    ])('scopes %s to the tenant in context', async (_table, query) => {
      const forA = await asTenant<{ id: string }[]>(tenants.a.groupId, query);
      const forB = await asTenant<{ id: string }[]>(tenants.b.groupId, query);

      const idsA = forA.map((r: { id: string }) => r.id);
      const idsB = forB.map((r: { id: string }) => r.id);

      expect(idsA.length).toBeGreaterThan(0);
      expect(idsB.length).toBeGreaterThan(0);
      expect(idsA.filter((id) => idsB.includes(id))).toEqual([]);
    });
  });

  describe('writes', () => {
    it('rolls back a business write when the transaction fails', async () => {
      await expect(asTenant(tenants.a.groupId, async (tx) => {
        await tx.addressBookEntry.create({
          data: { customerGroupId: tenants.a.groupId, name: 'Rolled back entry' },
        });
        throw new Error('Expected rollback');
      })).rejects.toThrow('Expected rollback');

      const rows = await asTenant(tenants.a.groupId, (tx) =>
        tx.addressBookEntry.findMany({ where: { name: 'Rolled back entry' } }),
      );
      expect(rows).toEqual([]);
    });

    it('refuses to insert a row belonging to another tenant', async () => {
      await expect(
        asTenant(tenants.a.groupId, (tx) =>
          tx.addressBookEntry.create({
            data: { customerGroupId: tenants.b.groupId, name: 'Smuggled entry' },
          }),
        ),
      ).rejects.toThrow(); // WITH CHECK violation

      const rows = await asTenant(tenants.b.groupId, (tx) =>
        tx.addressBookEntry.findMany({ where: { name: 'Smuggled entry' } }),
      );
      expect(rows).toEqual([]);
    });

    it('cannot update another tenant row', async () => {
      const updated = await asTenant(tenants.a.groupId, (tx) =>
        tx.quote.updateMany({
          where: { id: tenants.b.quoteId },
          data: { status: 'rejected' },
        }),
      );

      // The row is out of scope, so zero rows match rather than one being changed.
      expect(updated.count).toBe(0);
    });

    it('cannot delete another tenant row', async () => {
      const deleted = await asTenant(tenants.a.groupId, (tx) =>
        tx.addressBookEntry.deleteMany({ where: { customerGroupId: tenants.b.groupId } }),
      );

      expect(deleted.count).toBe(0);
    });
  });

  describe('missing context', () => {
    it('returns nothing when no tenant is set', async () => {
      // app.current_group() is NULL, and every policy compares against it, so nothing matches.
      const rows = await asTenant(null, (tx) => tx.quote.findMany());
      expect(rows).toEqual([]);
    });

    it('does not leak context between transactions on a pooled connection', async () => {
      await asTenant(tenants.a.groupId, (tx) => tx.quote.findMany());

      // set_config(..., true) is transaction-local, so the next transaction starts clean.
      const rows = await asTenant(null, (tx) => tx.quote.findMany());
      expect(rows).toEqual([]);
    });
  });

  describe('audit', () => {
    it('is append-only for the application role', async () => {
      await expect(
        asTenant(tenants.a.groupId, (tx) =>
          tx.auditEvent.deleteMany({ where: { customerGroupId: tenants.a.groupId } }),
        ),
      ).rejects.toThrow(/permission denied/i);
    });
  });

  describe('runtime database privileges', () => {
    it('actually runs as the restricted application role', async () => {
      const roles = await db.$queryRaw<{
        rolname: string; rolsuper: boolean; rolcreatedb: boolean; rolcreaterole: boolean; rolbypassrls: boolean;
      }[]>`SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
           FROM pg_roles WHERE rolname = current_user`;
      expect(roles).toEqual([{
        rolname: 'portal_app', rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolbypassrls: false,
      }]);
    });

    it('enables and forces RLS with a policy on every application table', async () => {
      const unprotected = await db.$queryRaw<{ relname: string }[]>`
        SELECT relation.relname FROM pg_class relation
        JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public' AND relation.relkind = 'r'
          AND relation.relname <> '_prisma_migrations'
          AND (NOT relation.relrowsecurity OR NOT relation.relforcerowsecurity
            OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = relation.oid))`;
      expect(unprotected).toEqual([]);
    });

    it('cannot read or change migration history', async () => {
      await expect(db.$queryRaw`SELECT * FROM "_prisma_migrations"`).rejects.toThrow(/permission denied/i);
      await expect(db.$executeRaw`DELETE FROM "_prisma_migrations" WHERE false`).rejects.toThrow(/permission denied/i);
    });

    it('cannot create application tables or database schemas', async () => {
      await expect(db.$executeRaw`CREATE TABLE public.forbidden_runtime_table (id integer)`).rejects.toThrow(/permission denied/i);
      await expect(db.$executeRaw`CREATE SCHEMA forbidden_runtime_schema`).rejects.toThrow(/permission denied/i);
    });
  });
});
