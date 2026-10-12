import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@nestjs/common';

/**
 * Who is acting, and on which tenant, for the duration of one request or job.
 *
 * Carried in AsyncLocalStorage rather than passed around, so a service cannot silently
 * lose it. TenantRepository reads it to set the Postgres session variables that RLS
 * policies key off.
 */
export interface TenantContextData {
  /** Null for a Noatum staff session that has not selected a customer group. */
  customerGroupId: string | null;
  userId: string;
  /** For the shell only; authorization never reads these. */
  displayName?: string;
  email?: string;
  branchCode?: string | null;
  branchName?: string | null;
  /** Resolved from the user's branch. The region layer of ADR-010 reads this. */
  regionCode?: string | null;
  roleKeys?: string[];
  /** Noatum staff. Grants read-through in RLS policies; still subject to permissions. */
  isInternal: boolean;
  /** Set when staff are impersonating a customer user. Recorded on every audit event. */
  onBehalfOfUserId?: string | null;
  /** Accounts the user is restricted to. Empty means every account in the group. */
  accountIds: string[];
  permissions: ReadonlySet<string>;
  correlationId: string;
}

@Injectable()
export class TenantContext {
  private readonly storage = new AsyncLocalStorage<{ data: TenantContextData | null }>();

  /** Run `fn` with `data` in scope. Everything downstream sees the same context. */
  run<T>(data: TenantContextData, fn: () => T): T {
    return this.storage.run({ data }, fn);
  }

  runRequest<T>(fn: () => T): T {
    return this.storage.run({ data: null }, fn);
  }

  authenticate(data: TenantContextData): void {
    const request = this.storage.getStore();
    if (!request) throw new Error('Request context has not been initialized.');
    if (request.data) throw new Error('Request context is already authenticated.');
    request.data = data;
  }

  /** The active context, or null outside a request/job (for example at boot). */
  peek(): TenantContextData | null {
    return this.storage.getStore()?.data ?? null;
  }

  /** The active context, or throw. Use this in anything touching customer data. */
  require(): TenantContextData {
    const store = this.peek();
    if (!store) {
      throw new Error(
        'TenantContext is not set. Wrap the work in TenantContext.run(), or use runAsSystem() for platform jobs.',
      );
    }
    return store;
  }

  requireGroupId(): string {
    const { customerGroupId } = this.require();
    if (!customerGroupId) {
      throw new Error('No customer group in scope for this operation.');
    }
    return customerGroupId;
  }

  /**
   * Platform work with no tenant in scope - reference-data sync, mapping refresh.
   * Deliberately verbose: if you reach for this to read customer data, you are wrong.
   */
  runAsSystem<T>(correlationId: string, fn: () => T): T {
    return this.run(
      {
        customerGroupId: null,
        userId: 'system',
        isInternal: true,
        accountIds: [],
        permissions: new Set<string>(),
        correlationId,
      },
      fn,
    );
  }
}
