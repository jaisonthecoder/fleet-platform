import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../database/database.constants';
import type { DrizzleDatabase } from '../database/database.module';
import { outboxEvent } from '../database/schema';

/** An executor that can insert — the base db or an open transaction. */
export type OutboxExecutor = Pick<DrizzleDatabase, 'insert'>;

/** A domain event to enqueue transactionally alongside domain state. */
export interface OutboxEventInput {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  schemaVersion?: number;
  correlationId?: string | null;
  occurredAt?: Date;
}

/**
 * Writes `outbox_event` rows. The critical contract (conventions §3): a state
 * change writes domain state + audit + **this outbox row in the same Postgres
 * transaction**, so an event can never be published without its state change
 * having committed (and vice-versa). Callers pass their open transaction as the
 * `executor`; the dispatcher publishes asynchronously afterwards.
 */
@Injectable()
export class OutboxService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  /** Enqueues an event for at-least-once publish; returns the outbox row id (its messageId). */
  async enqueue(
    event: OutboxEventInput,
    executor: OutboxExecutor = this.db,
  ): Promise<string> {
    const rows = await executor
      .insert(outboxEvent)
      .values({
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: event.payload as object,
        schemaVersion: event.schemaVersion ?? 1,
        correlationId: event.correlationId ?? null,
        occurredAt: event.occurredAt ?? new Date(),
      })
      .returning({ id: outboxEvent.id });
    return rows[0].id;
  }
}
