import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  customType,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { fleet, orgId } from './_shared';

/** PostgreSQL `bytea` for the audit hash chain. */
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

/** Append-only, per-organization hash-chained audit log (tamper-evident). */
export const auditLog = fleet.table(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    organizationId: orgId(),
    /**
     * Per-organization monotonic chain position, assigned inside the hash-chain
     * trigger under the per-org advisory lock. The chain is linked and verified
     * in `chain_seq` order (NOT `id` order): `id` is a bigserial assigned before
     * the trigger fires, so under concurrency it can diverge from commit order
     * and must never be used to order the chain (P0-R2-1).
     */
    chainSeq: bigint('chain_seq', { mode: 'number' }).notNull(),
    atUtc: timestamp('at_utc', { withTimezone: true }).notNull().defaultNow(),
    actorRef: text('actor_ref').notNull(),
    action: text('action').notNull(),
    entityRef: text('entity_ref').notNull(),
    beforeJson: jsonb('before_json'),
    afterJson: jsonb('after_json'),
    reason: text('reason'),
    prevHash: bytea('prev_hash'),
    rowHash: bytea('row_hash').notNull(),
  },
  (t) => [uniqueIndex('audit_log_org_chain_seq_uq').on(t.organizationId, t.chainSeq)],
);

/** Transactional outbox — written in the same tx as domain state; dispatched to Service Bus. */
export const outboxEvent = fleet.table(
  'outbox_event',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: text('aggregate_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    schemaVersion: integer('schema_version').notNull().default(1),
    correlationId: text('correlation_id'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastError: text('last_error'),
  },
  (t) => [index('outbox_unpublished_idx').on(t.publishedAt, t.occurredAt)],
);

/** Consumer idempotency ledger — a duplicate message is acknowledged, not reapplied. */
export const inboxMessage = fleet.table(
  'inbox_message',
  {
    consumerName: text('consumer_name').notNull(),
    messageId: text('message_id').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    result: text('result'),
  },
  (t) => [uniqueIndex('inbox_message_uq').on(t.consumerName, t.messageId)],
);

/** Durable critical-work ledger (SLA deadlines, ladders); BullMQ executes leased rows. */
export const scheduledWork = fleet.table(
  'scheduled_work',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    workType: text('work_type').notNull(),
    subjectRef: text('subject_ref').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('Pending'),
    attemptCount: integer('attempt_count').notNull().default(0),
    leaseUntil: timestamp('lease_until', { withTimezone: true }),
    lastError: text('last_error'),
  },
  (t) => [index('scheduled_work_due_idx').on(t.status, t.dueAt)],
);
