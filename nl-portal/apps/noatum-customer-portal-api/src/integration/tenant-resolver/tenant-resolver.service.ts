import { ForbiddenException, Injectable } from '@nestjs/common';

import { TenantContext } from '../../common/tenancy/tenant-context';
import { TenantRepository } from '../../common/tenancy/tenant.repository';

/**
 * Turns the portal tenant in scope into the CW1 organisation codes we are allowed to
 * query, honouring per-user account restrictions.
 *
 * This is the choke point for CW1 reads. CargoWise has no idea about our tenants, so if
 * this returns the wrong codes there is no second line of defence - unlike Postgres,
 * where RLS would still catch us. Treat changes here as security changes.
 */
@Injectable()
export class TenantResolverService {
  constructor(
    private readonly repo: TenantRepository,
    private readonly context: TenantContext,
  ) {}

  /** Every org code the caller may see. Empty is a legitimate answer: show nothing. */
  async orgCodesForCaller(): Promise<string[]> {
    const { accountIds } = this.context.require();

    return this.repo.run(async (tx) => {
      const accounts = await tx.customerAccount.findMany({
        // No customer_group_id predicate: RLS scopes this. An empty accountIds list
        // means "all accounts in my group", which RLS already bounds correctly.
        where: {
          isActive: true,
          // A customer that has not gone live grants nothing, whatever is linked
          // to it. This is the gate that replaced the link approval step.
          group: { status: 'active' },
          ...(accountIds.length > 0 ? { id: { in: accountIds } } : {}),
        },
        select: { cw1OrgCode: true },
      });

      return accounts.map((a) => a.cw1OrgCode);
    });
  }

  /**
   * Validate a specific account the client asked for. Returns its org code, or throws.
   * Never pass a client-supplied org code to CW1 without going through this.
   */
  async orgCodeForAccount(accountId: string): Promise<string> {
    const account = await this.repo.run((tx) =>
      tx.customerAccount.findFirst({
        where: { id: accountId, isActive: true, group: { status: 'active' } },
        select: { id: true, cw1OrgCode: true },
      }),
    );

    if (!account) {
      throw new ForbiddenException('Account is not available to this user.');
    }

    const { accountIds } = this.context.require();
    if (accountIds.length > 0 && !accountIds.includes(account.id)) {
      throw new ForbiddenException('Account is not available to this user.');
    }

    return account.cw1OrgCode;
  }
}
