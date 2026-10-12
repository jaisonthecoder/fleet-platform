import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { TenantRepository, type TenantClient } from '../../../common/tenancy/tenant.repository';
import { JobHandler, JOB_NAMES, type JobName } from '../job.registry';
import { JobsService } from '../jobs.service';

/**
 * Turns one scheduled tick into one expiry job per live customer.
 *
 * A schedule cannot start a tenant-scoped job directly, because such a job needs a
 * customer in its payload and the scheduler has none. So a platform job reads the
 * list and enqueues the work.
 *
 * Doing it this way rather than one sweep across every row keeps each write under
 * RLS and stops one customer's failure stalling everybody else's.
 *
 * `JobsService` is resolved lazily rather than injected. Injecting it would close a
 * cycle - JobsService is built from the handler list, and this handler is in that
 * list - which leaves the application hanging at startup rather than failing loudly.
 */
@Injectable()
export class QuoteExpiryFanoutHandler extends JobHandler<{ at?: string }> {
  readonly name: JobName = JOB_NAMES.QUOTE_EXPIRY_FANOUT;
  readonly tenantScoped = false;

  private readonly logger = new Logger(QuoteExpiryFanoutHandler.name);

  constructor(
    private readonly repository: TenantRepository,
    private readonly moduleRef: ModuleRef,
  ) {
    super();
  }

  async handle(): Promise<void> {
    const jobs = this.moduleRef.get(JobsService, { strict: false });

    // Hour precision, so a retry of this tick re-uses the same job ids and cannot
    // enqueue the same customer's expiry twice.
    const slot = new Date().toISOString().slice(0, 13);

    // Read the list, then CLOSE the transaction. Enqueuing inside it means N
    // round trips against Prisma's 5 s interactive-transaction limit: at a few
    // hundred customers the whole tick rolls back and nobody gets an expiry job.
    const groups = await this.repository.runInternal((tx: TenantClient) =>
      tx.customerGroup.findMany({ where: { status: 'active' }, select: { id: true } }),
    );

    let enqueued = 0;
    for (const group of groups) {
      // One short transaction each, so one bad customer cannot cost everybody
      // else their expiry sweep.
      try {
        const id = await this.repository.runInternal((tx: TenantClient) =>
          jobs.enqueue(
            tx,
            JOB_NAMES.QUOTE_EXPIRY,
            { customerGroupId: group.id },
            { sourceMessageId: `quote-expiry:${slot}`, portalRef: group.id },
          ),
        );
        if (id) enqueued += 1;
      } catch (error) {
        this.logger.error({ err: error }, `Could not queue quote expiry for ${group.id}.`);
      }
    }

    if (enqueued > 0) {
      this.logger.log(`Queued quote expiry for ${enqueued} customer(s).`);
    }
  }
}
