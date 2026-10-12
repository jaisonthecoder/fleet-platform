import { Injectable, Logger } from '@nestjs/common';

import { TenantRepository, type TenantClient } from '../../../common/tenancy/tenant.repository';
import { canTransition } from '../../../modules/quotes/quote.status';
import { JobHandler, JOB_NAMES, type JobName } from '../job.registry';

export interface QuoteExpiryPayload {
  customerGroupId: string;
}

/**
 * Statuses a quote can legitimately expire from, per the transition table.
 *
 * Every non-terminal state whose transition table allows `expired`. A quote can run out of
 * validity while nobody has claimed it, while it sits priced but unreleased, and after it
 * has been published - so all five live stages are here.
 *
 * `draft` is deliberately absent: the customer has not asked for anything yet, and expiring
 * a half-typed form they are still working on would be a bug wearing a scheduler's clothes.
 */
const EXPIRABLE = [
  'requested',
  'claimed',
  'priced',
  'approved',
  'published',
  // Deprecated values. Any row still holding one predates C3 and must still be able to
  // expire, or it never leaves the table.
  'submitted',
  'quoted',
  'rated',
] as const;

/**
 * Moves quotes past their validity to `expired`, per tenant.
 *
 * Tenant-scoped rather than one sweep across every row: it keeps each write under
 * RLS, and a failure for one customer does not stall the rest.
 *
 * Idempotent by construction — it selects only quotes still in an expirable status
 * with a validity in the past, so a second pass finds nothing. It runs repeatedly
 * over the same data, so that property is not optional.
 */
@Injectable()
export class QuoteExpiryHandler extends JobHandler<QuoteExpiryPayload> {
  readonly name: JobName = JOB_NAMES.QUOTE_EXPIRY;
  readonly tenantScoped = true;

  private readonly logger = new Logger(QuoteExpiryHandler.name);

  constructor(private readonly repository: TenantRepository) {
    super();
  }

  async handle(payload: QuoteExpiryPayload): Promise<void> {
    // Guards against an edit to the transition table silently making this illegal.
    const illegal = EXPIRABLE.filter((status) => !canTransition(status, 'expired'));
    if (illegal.length > 0) {
      throw new Error(`quote.status.ts no longer allows ${illegal.join(', ')} to expire.`);
    }

    const expired = await this.repository.run(async (tx: TenantClient) => {
      // UPDATE ... RETURNING, so the audit names exactly what changed. Reading
      // candidates first and auditing those would misreport precisely when a
      // customer accepts between the read and the write - the case this guards.
      const changed = await tx.$queryRaw<Array<{ reference: string }>>`
        UPDATE quote SET status = 'expired'
         WHERE status = ANY (${[...EXPIRABLE]}::quote_status[])
           AND valid_until IS NOT NULL
           AND valid_until < now()
        RETURNING reference`;

      if (changed.length > 0) {
        // One aggregate row: a business status changed and nothing else would say so.
        await tx.auditEvent.create({
          data: {
            customerGroupId: payload.customerGroupId,
            actorUserId: null,
            action: 'quote.expired',
            entityType: 'quote',
            entityId: null,
            metadata: {
              count: changed.length,
              references: changed.map((quote) => quote.reference),
              by: 'quote.expiry job',
            },
          },
        });
      }

      return changed.length;
    });

    if (expired > 0) {
      this.logger.log({
        event: 'AnalyticsEvent',
        action: 'quote.expired',
        entityId: payload.customerGroupId,
        count: expired,
      });
    }
  }
}
