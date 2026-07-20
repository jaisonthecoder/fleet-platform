import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { and, eq, sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import { inboxMessage, outboxEvent } from '../src/common/database/schema';
import { LogMessagePublisher } from '../src/common/messaging/log-message-publisher';
import type { MessagePublisher } from '../src/common/messaging/message-publisher';
import { OutboxDispatcherService } from '../src/common/messaging/outbox-dispatcher.service';
import { InboxService } from '../src/common/messaging/inbox.service';
import { OutboxService } from '../src/common/messaging/outbox.service';

/**
 * Integration proof of the transactional outbox + inbox (P0-R2-7 / B-11).
 * Requires a live migrated database (DATABASE_URL). Proves at-least-once
 * publish, dead-lettering after max attempts, DLQ replay, and inbox idempotency
 * incl. crash-replay (received-but-unprocessed re-runs the handler).
 */
describe('outbox + inbox (integration — requires DB)', () => {
  let ctx: INestApplicationContext;
  let outbox: OutboxService;
  let inbox: InboxService;
  let db: DrizzleDatabase;

  const aggregateId = `it-agg-${randomUUID().slice(0, 8)}`;
  const consumerName = `it-consumer-${randomUUID().slice(0, 8)}`;

  /** Builds a dispatcher over the live db with a chosen transport + attempt cap. */
  const makeDispatcher = (publisher: MessagePublisher, maxAttempts = 3) =>
    new OutboxDispatcherService(db, publisher, {
      serviceBus: { connectionString: undefined, topic: 'domain-events' },
      eventHubs: {
        connectionString: undefined,
        eventHubName: 'telemetry',
        consumerGroup: 'ingest',
      },
      outbox: { dispatchEnabled: false, pollIntervalMs: 1000, maxAttempts, batchSize: 100 },
    } as unknown as ConstructorParameters<typeof OutboxDispatcherService>[2]);

  const alwaysFails: MessagePublisher = {
    publish: async () => {
      throw new Error('transport down');
    },
  };

  const rowsForAggregate = async () =>
    db.select().from(outboxEvent).where(eq(outboxEvent.aggregateId, aggregateId));

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
    outbox = ctx.get(OutboxService);
    inbox = ctx.get(InboxService);
    db = ctx.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await db.execute(
      sql`DELETE FROM fleet.outbox_event WHERE aggregate_id = ${aggregateId}`,
    );
    await db.execute(
      sql`DELETE FROM fleet.inbox_message WHERE consumer_name = ${consumerName}`,
    );
    await ctx?.close();
  });

  it('publishes pending events at-least-once and marks them published', async () => {
    await outbox.enqueue({
      aggregateType: 'test',
      aggregateId,
      eventType: 'TestHappened',
      payload: { n: 1 },
    });
    await outbox.enqueue({
      aggregateType: 'test',
      aggregateId,
      eventType: 'TestHappened',
      payload: { n: 2 },
    });

    const summary = await makeDispatcher(new LogMessagePublisher()).dispatchPending();
    expect(summary.published).toBeGreaterThanOrEqual(2);

    const rows = await rowsForAggregate();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.publishedAt !== null)).toBe(true);
  });

  it('dead-letters after max attempts, then replays and publishes (DLQ drill)', async () => {
    await outbox.enqueue({
      aggregateType: 'test',
      aggregateId,
      eventType: 'FailsThenSucceeds',
      payload: { n: 3 },
    });

    const failing = makeDispatcher(alwaysFails, 3);
    await failing.dispatchPending();
    await failing.dispatchPending();
    const third = await failing.dispatchPending();
    expect(third.deadLettered).toBeGreaterThanOrEqual(1);

    // Dead-lettered rows are parked — no longer claimed.
    const parked = await failing.dispatchPending();
    expect(parked.claimed).toBe(0);

    const dlqRow = (await rowsForAggregate()).find(
      (r) => r.eventType === 'FailsThenSucceeds',
    );
    expect(dlqRow?.publishedAt).toBeNull();
    expect(dlqRow?.attemptCount).toBe(3);
    expect(dlqRow?.lastError).toContain('transport down');

    // Replay resets the counter; a healthy transport then publishes it.
    const replayed = await failing.replayDeadLettered();
    expect(replayed).toBeGreaterThanOrEqual(1);

    await makeDispatcher(new LogMessagePublisher()).dispatchPending();
    const healed = (await rowsForAggregate()).find(
      (r) => r.eventType === 'FailsThenSucceeds',
    );
    expect(healed?.publishedAt).not.toBeNull();
  });

  it('processes a message once and skips duplicate deliveries (idempotency)', async () => {
    const messageId = randomUUID();
    let ran = 0;
    const handler = async () => {
      ran += 1;
    };

    expect(await inbox.consume(consumerName, messageId, handler)).toBe('processed');
    expect(await inbox.consume(consumerName, messageId, handler)).toBe('duplicate');
    expect(ran).toBe(1);
  });

  it('re-runs the handler after a crash before completion (crash-replay)', async () => {
    const messageId = randomUUID();
    let ran = 0;
    const handler = async () => {
      ran += 1;
    };

    // Simulate a crash: the message was received but never marked processed.
    await db.insert(inboxMessage).values({ consumerName, messageId });
    const beforeReplay = await db
      .select({ processedAt: inboxMessage.processedAt })
      .from(inboxMessage)
      .where(
        and(
          eq(inboxMessage.consumerName, consumerName),
          eq(inboxMessage.messageId, messageId),
        ),
      );
    expect(beforeReplay[0]?.processedAt).toBeNull();

    // Re-delivery must run the handler (not treat it as a duplicate).
    expect(await inbox.consume(consumerName, messageId, handler)).toBe('processed');
    expect(ran).toBe(1);
    // And now it is idempotent.
    expect(await inbox.consume(consumerName, messageId, handler)).toBe('duplicate');
    expect(ran).toBe(1);
  });
});
