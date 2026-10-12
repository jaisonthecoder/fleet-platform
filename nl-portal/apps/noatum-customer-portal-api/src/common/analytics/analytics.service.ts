import { Injectable, Logger } from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context';
import { TenantRepository, type TenantClient } from '../tenancy/tenant.repository';

export interface AnalyticsInput {
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  /** Overrides the acting user's group. Only for jobs acting on a known tenant. */
  customerGroupId?: string | null;
}

/**
 * Product usage, recorded.
 *
 * Seven services emitted analytics events into `logger.log` and nowhere else, so
 * every question they exist to answer could only be reached by grepping logs that
 * are retained for days. This writes them down.
 *
 * Never throws. An analytics failure must not roll back the business write that
 * prompted it - counting how often something happens is worth strictly less than
 * the thing itself happening. That is the one place in this codebase where
 * swallowing an error is correct, so it is stated here rather than implied.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly repo: TenantRepository,
    private readonly context: TenantContext,
  ) {}

  /**
   * Records inside the caller's transaction.
   *
   * Preferred where a transaction is already open: the event and the change it
   * describes then succeed or fail together, so the counts cannot drift above the
   * reality.
   */
  async recordIn(tx: TenantClient, input: AnalyticsInput): Promise<void> {
    const actor = this.context.peek();

    try {
      // Through the function, not `create()`. Prisma's create emits
      // `INSERT ... RETURNING`, and PostgreSQL applies the SELECT policy to the
      // RETURNING clause - which here is internal-only, so every customer event
      // was refused and then swallowed by the catch below.
      //
      // `$executeRaw`, not `$queryRaw`: the function returns void and Prisma
      // cannot deserialise that as a column.
      await tx.$executeRaw`
        SELECT app.record_analytics_event(
          ${input.action},
          ${input.entityType ?? null},
          ${input.entityId ?? null},
          ${JSON.stringify(input.metadata ?? {})}::jsonb,
          ${input.customerGroupId ?? actor?.customerGroupId ?? null}::uuid,
          ${actor?.userId ?? null}::uuid,
          ${actor?.correlationId ?? null}
        )`;
    } catch (error) {
      // Swallowed on purpose - counting an action is worth less than the action.
      // Note this cannot rescue the caller's transaction: a database error has
      // already aborted it, which is exactly why the write above must not fail.
      this.logger.warn({ err: error, action: input.action }, 'Analytics event not recorded.');
    }
  }

  /** Records on its own, for callers with no transaction in hand. */
  async record(input: AnalyticsInput): Promise<void> {
    const actor = this.context.peek();

    try {
      const write = (tx: TenantClient) => this.recordIn(tx, input);
      await (actor?.isInternal ? this.repo.runInternal(write) : this.repo.run(write));
    } catch (error) {
      this.logger.warn({ err: error, action: input.action }, 'Analytics event not recorded.');
    }
  }
}
