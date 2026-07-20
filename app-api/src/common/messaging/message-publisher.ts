/** DI token for the domain-event transport (Service Bus in prod, log adapter in dev). */
export const MESSAGE_PUBLISHER = Symbol('MESSAGE_PUBLISHER');

/**
 * A domain event ready to publish. Mirrors an `outbox_event` row so the
 * dispatcher can hand a claimed row straight to the transport. `messageId` is
 * the stable dedupe key consumers use via the inbox ledger.
 */
export interface OutboxMessage {
  messageId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  schemaVersion: number;
  correlationId?: string | null;
  occurredAt: Date;
}

/**
 * Transport port for domain events. Implementations must be at-least-once and
 * may throw on failure — the outbox dispatcher owns ret/DLQ semantics, so the
 * transport itself stays a thin publish. The publish must be idempotent-safe
 * on the consumer side (consumers dedupe via `inbox_message`).
 */
export interface MessagePublisher {
  /** Publishes one domain event; throws on transport failure (dispatcher retries). */
  publish(message: OutboxMessage): Promise<void>;
}
