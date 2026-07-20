import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type { DrizzleDatabase } from '../database/database.module';
import { inboxMessage } from '../database/schema';

/** Result of an idempotent consume attempt. */
export type ConsumeResult = 'processed' | 'duplicate';

/**
 * Consumer idempotency ledger (P0-R2-7 / B-11). A message is processed at most
 * once *to completion*: the first delivery records receipt, runs the handler,
 * then marks it processed. A re-delivery of an already-*processed* message is
 * acknowledged without re-running the handler. A crash **between** receipt and
 * completion leaves `processed_at` null, so the next delivery re-runs the
 * handler — at-least-once + idempotent (handlers must themselves be idempotent).
 */
@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  /**
   * Runs `handler` exactly once for a `(consumerName, messageId)` pair that has
   * already completed; otherwise runs it (first time or after a crash) and marks
   * completion. Returns whether the handler ran or was skipped as a duplicate.
   */
  async consume(
    consumerName: string,
    messageId: string,
    handler: () => Promise<void>,
  ): Promise<ConsumeResult> {
    await this.db
      .insert(inboxMessage)
      .values({ consumerName, messageId })
      .onConflictDoNothing();

    const existing = await this.db
      .select({ processedAt: inboxMessage.processedAt })
      .from(inboxMessage)
      .where(
        and(
          eq(inboxMessage.consumerName, consumerName),
          eq(inboxMessage.messageId, messageId),
        ),
      )
      .limit(1);

    if (existing[0]?.processedAt) {
      this.logger.debug(
        `duplicate message skipped consumer=${consumerName} messageId=${messageId}`,
      );
      return 'duplicate';
    }

    await handler();

    await this.db
      .update(inboxMessage)
      .set({ processedAt: new Date(), result: 'processed' })
      .where(
        and(
          eq(inboxMessage.consumerName, consumerName),
          eq(inboxMessage.messageId, messageId),
        ),
      );
    return 'processed';
  }
}
