import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from './prisma.service';
import { TenantContext } from './tenant-context';

/** The transaction-scoped client handed to callers of `run`. */
export type TenantClient = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * The only sanctioned way to read or write customer data.
 *
 * Every call opens a transaction, sets the tenant session variables that the RLS policies
 * in `app.current_group()` / `app.is_internal()` read, and runs the callback inside it.
 * Because the settings are LOCAL, they die with the transaction - no leakage between
 * requests sharing a pooled connection.
 *
 * Isolation is enforced by Postgres, not by this class. This class only makes sure the
 * database knows who is asking.
 */
@Injectable()
export class TenantRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: TenantContext,
  ) {}

  /**
   * Run `fn` scoped to the tenant in the current context.
   * Throws if no customer group is in scope - use `runInternal` for staff-wide reads.
   */
  async run<T>(fn: (tx: TenantClient) => Promise<T>): Promise<T> {
    const { customerGroupId, isInternal } = this.context.require();

    if (!customerGroupId && !isInternal) {
      throw new Error('Refusing to query customer data with no customer group in scope.');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.applyScope(tx, customerGroupId, isInternal);
      return fn(tx);
    });
  }

  /**
   * Staff-wide read across tenants (Noatum admin screens, support tooling).
   * Requires an internal context; the caller must still hold the relevant permission.
   */
  async runInternal<T>(fn: (tx: TenantClient) => Promise<T>): Promise<T> {
    const { isInternal } = this.context.require();

    if (!isInternal) {
      throw new Error('runInternal requires an internal (Noatum staff) context.');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.applyScope(tx, null, true);
      return fn(tx);
    });
  }

  /**
   * Act on one specific tenant regardless of the ambient context - impersonation and
   * tenant-targeted jobs. Requires an internal context so a customer session cannot
   * reach another tenant by passing an id.
   */
  async runAsGroup<T>(customerGroupId: string, fn: (tx: TenantClient) => Promise<T>): Promise<T> {
    const { isInternal } = this.context.require();

    if (!isInternal) {
      throw new Error('runAsGroup requires an internal (Noatum staff) context.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Deliberately not internal: scope down to the single group so RLS still bites.
      await this.applyScope(tx, customerGroupId, false);
      return fn(tx);
    });
  }

  private async applyScope(
    tx: TenantClient,
    customerGroupId: string | null,
    isInternal: boolean,
  ): Promise<void> {
    // set_config(..., true) => LOCAL to this transaction. Parameterised, never interpolated.
    await tx.$executeRaw`SELECT set_config('app.customer_group_id', ${customerGroupId ?? ''}, true)`;
    await tx.$executeRaw`SELECT set_config('app.is_internal', ${isInternal ? 'true' : 'false'}, true)`;
  }
}
