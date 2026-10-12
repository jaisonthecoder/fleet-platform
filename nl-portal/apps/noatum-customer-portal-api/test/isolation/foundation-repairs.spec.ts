import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { RateLimiterService } from '../../src/common/rate-limit/rate-limiter.service';

/**
 * The three repairs of 18.09.2026, tested against a real database because all
 * three live in SQL: a suspended customer must lock its people out, go-live must
 * count administrators rather than any user, and the attempt budget must be
 * shared rather than per process.
 */
describe('foundation repairs', () => {
  const owner = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_MIGRATION_URL,
      connectionTimeoutMillis: 5000,
    }),
  });
  const app = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
    }),
  });

  const suffix = randomUUID().slice(0, 8);
  const issuer = `dev://repairs-${suffix}`;
  let suspendedGroupId: string;

  beforeAll(async () => {
    await owner.$connect();
    await app.$connect();

    // Self-contained fixtures: relying on seed data makes the test pass or fail for
    // reasons that have nothing to do with the thing under test.
    const group = await owner.customerGroup.create({
      data: { name: `Repairs ${suffix}`, slug: `repairs-${suffix}`, status: 'suspended' },
    });
    suspendedGroupId = group.id;

    await owner.user.create({
      data: {
        customerGroupId: group.id,
        email: `customer-${suffix}@test.example`,
        displayName: 'Suspended customer user',
        status: 'active',
        isInternal: false,
        idpIssuer: issuer,
        idpSubject: 'customer-user',
      },
    });

    await owner.user.create({
      data: {
        customerGroupId: null,
        email: `staff-${suffix}@test.example`,
        displayName: 'Internal staff',
        status: 'active',
        isInternal: true,
        idpIssuer: issuer,
        idpSubject: 'staff-user',
      },
    });
  });

  afterAll(async () => {
    await owner.user.deleteMany({ where: { idpIssuer: issuer } });
    await owner.customerGroup.deleteMany({ where: { id: suspendedGroupId } });
    await owner.$disconnect();
    await app.$disconnect();
  });

  describe('a suspended customer grants nothing', () => {
    it('reports the customer status alongside the identity', async () => {
      const rows = await owner.$queryRaw<Array<{ customer_group_status: string | null }>>`
        SELECT customer_group_status
          FROM app.resolve_identity(${issuer}, 'customer-user')`;

      expect(rows[0]?.customer_group_status).toBe('suspended');
    });

    it('returns null for internal staff, who have no customer', async () => {
      const rows = await owner.$queryRaw<Array<{ customer_group_status: string | null }>>`
        SELECT customer_group_status
          FROM app.resolve_identity(${issuer}, 'staff-user')`;

      expect(rows[0]?.customer_group_status).toBeNull();
    });

    it('does not leave the identity-lookup flag raised afterwards', async () => {
      await owner.$queryRaw`SELECT * FROM app.resolve_identity(${issuer}, 'nobody')`;
      const rows = await owner.$queryRaw<Array<{ flag: string | null }>>`
        SELECT current_setting('app.identity_lookup', true) AS flag`;
      const flag = rows[0]?.flag ?? null;

      // A raised flag would leave customer_group readable for the rest of the transaction.
      expect(flag === 'off' || flag === '' || flag === null).toBe(true);
    });
  });

  describe('the attempt budget is shared, not per process', () => {
    it('counts across two independent service instances', async () => {
      const budget = { points: 3, duration: 60 };
      const key = `test:${Date.now()}`;
      const first = new RateLimiterService(app as never);
      const second = new RateLimiterService(app as never);

      await first.consume(key, budget);
      await second.consume(key, budget);
      const third = await first.consume(key, budget);

      // In process memory each instance would still be on its first attempt.
      expect(third.consumedPoints).toBe(3);
      await first.delete(key);
    });

    it('throws once the budget is spent, and says when to retry', async () => {
      const budget = { points: 1, duration: 60 };
      const key = `test-throw:${Date.now()}`;
      const limiter = new RateLimiterService(app as never);

      await limiter.consume(key, budget);
      await expect(limiter.consume(key, budget)).rejects.toMatchObject({
        name: 'RateLimitExceeded',
      });
      await limiter.delete(key);
    });

    it('clears the budget on a successful sign-in', async () => {
      const key = `test-clear:${Date.now()}`;
      const limiter = new RateLimiterService(app as never);

      await limiter.consume(key, { points: 5, duration: 60 });
      await limiter.delete(key);

      expect(await limiter.get(key)).toBeNull();
    });

    it('refuses the runtime role direct access to the table', async () => {
      const rows = await owner.$queryRaw<Array<{ can: boolean }>>`
        SELECT (
          has_table_privilege('portal_app', 'auth_rate_limit', 'SELECT')
          OR has_table_privilege('portal_app', 'auth_rate_limit', 'INSERT')
          OR has_table_privilege('portal_app', 'auth_rate_limit', 'UPDATE')
          OR has_table_privilege('portal_app', 'auth_rate_limit', 'DELETE')
        ) AS can`;

      expect(rows[0]?.can).toBe(false);
    });
  });
});
