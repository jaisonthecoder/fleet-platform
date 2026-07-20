import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { and, asc, eq, gte, isNull, lt } from 'drizzle-orm';
import { messagingConfig } from '../config/messaging.config';
import { DRIZZLE } from '../database/database.constants';
import type { DrizzleDatabase } from '../database/database.module';
import { outboxEvent } from '../database/schema';
import { MESSAGE_PUBLISHER, type MessagePublisher } from './message-publisher';

/** Outcome of one dispatch cycle. */
export interface DispatchSummary {
  claimed: number;
  published: number;
  failed: number;
  deadLettered: number;
}

/**
 * Transactional-outbox dispatcher (P0-R2-7 / B-11). Polls unpublished
 * `outbox_event` rows and publishes them at-least-once via the configured
 * transport, marking `published_at` on success. A publish failure increments
 * `attempt_count` and records `last_error`; once attempts reach
 * `OUTBOX_MAX_ATTEMPTS` the row is **dead-lettered** (parked — no longer polled)
 * until an operator replays it. Consumers dedupe re-deliveries via the inbox
 * ledger, so at-least-once is safe. The poll loop only runs when
 * `OUTBOX_DISPATCH_ENABLED` is set; the core `dispatchPending()` is always
 * callable directly (tests, on-demand drain).
 */
@Injectable()
export class OutboxDispatcherService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OutboxDispatcherService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(MESSAGE_PUBLISHER) private readonly publisher: MessagePublisher,
    @Inject(messagingConfig.KEY)
    private readonly config: ConfigType<typeof messagingConfig>,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.outbox.dispatchEnabled) {
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, this.config.outbox.pollIntervalMs);
    // Do not keep the event loop alive solely for the poller.
    this.timer.unref?.();
    this.logger.log(
      `outbox dispatcher polling every ${this.config.outbox.pollIntervalMs}ms`,
    );
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  /** Guarded tick — never overlaps a previous in-flight dispatch. */
  private async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.dispatchPending();
    } catch (error) {
      this.logger.error(
        `outbox dispatch cycle failed: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    } finally {
      this.running = false;
    }
  }

  /**
   * Publishes one batch of unpublished, not-yet-dead-lettered events in
   * occurrence order. Returns a summary. Idempotent-marking: the success update
   * is guarded by `published_at IS NULL`, so a concurrent poller cannot double
   * mark (a double publish is harmless — consumers dedupe).
   */
  async dispatchPending(limit = this.config.outbox.batchSize): Promise<DispatchSummary> {
    const maxAttempts = this.config.outbox.maxAttempts;
    const rows = await this.db
      .select()
      .from(outboxEvent)
      .where(and(isNull(outboxEvent.publishedAt), lt(outboxEvent.attemptCount, maxAttempts)))
      .orderBy(asc(outboxEvent.occurredAt))
      .limit(limit);

    const summary: DispatchSummary = {
      claimed: rows.length,
      published: 0,
      failed: 0,
      deadLettered: 0,
    };

    for (const row of rows) {
      try {
        await this.publisher.publish({
          messageId: row.id,
          aggregateType: row.aggregateType,
          aggregateId: row.aggregateId,
          eventType: row.eventType,
          payload: row.payload,
          schemaVersion: row.schemaVersion,
          correlationId: row.correlationId,
          occurredAt: row.occurredAt,
        });
        await this.db
          .update(outboxEvent)
          .set({ publishedAt: new Date() })
          .where(and(eq(outboxEvent.id, row.id), isNull(outboxEvent.publishedAt)));
        summary.published += 1;
      } catch (error) {
        const nextAttempt = row.attemptCount + 1;
        const message = error instanceof Error ? error.message : 'unknown';
        await this.db
          .update(outboxEvent)
          .set({ attemptCount: nextAttempt, lastError: message })
          .where(eq(outboxEvent.id, row.id));
        if (nextAttempt >= maxAttempts) {
          summary.deadLettered += 1;
          this.logger.error(
            `outbox event dead-lettered after ${nextAttempt} attempts: ${row.eventType} (${row.id})`,
          );
        } else {
          summary.failed += 1;
        }
      }
    }
    return summary;
  }

  /**
   * Replays dead-lettered events by resetting their attempt counter so the next
   * dispatch cycle retries them. Returns how many were re-queued. Used after a
   * transport outage is resolved (the DLQ replay drill).
   */
  async replayDeadLettered(): Promise<number> {
    const maxAttempts = this.config.outbox.maxAttempts;
    const replayed = await this.db
      .update(outboxEvent)
      .set({ attemptCount: 0, lastError: null })
      .where(and(isNull(outboxEvent.publishedAt), gte(outboxEvent.attemptCount, maxAttempts)))
      .returning({ id: outboxEvent.id });
    return replayed.length;
  }
}
