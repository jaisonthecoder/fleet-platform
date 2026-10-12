import { Injectable, Logger } from '@nestjs/common';

import type { TenantClient } from '../../common/tenancy/tenant.repository';

/** Business vocabulary. A transport verb never appears here. */
export const INTEGRATION_OPERATIONS = {
  QUOTE_REQUEST_CREATE: 'quote.request.create',
  QUOTE_REQUEST_UPDATE: 'quote.request.update',
  QUOTE_REQUEST_CANCEL: 'quote.request.cancel',
  QUOTE_PRICED_SUBMIT: 'quote.priced.submit',
  QUOTE_DECISION_RECORD: 'quote.decision.record',
  QUOTE_STATUS_FETCH: 'quote.status.fetch',
  BOOKING_CREATE: 'booking.create',
  BOOKING_UPDATE: 'booking.update',
  BOOKING_CANCEL: 'booking.cancel',
  SHIPMENT_FETCH: 'shipment.fetch',
  DOCUMENT_PUSH: 'document.push',
  ORGANISATION_FETCH: 'organisation.fetch',
} as const;

export type IntegrationOperation =
  (typeof INTEGRATION_OPERATIONS)[keyof typeof INTEGRATION_OPERATIONS];

export interface RecordOutboundInput {
  operation: IntegrationOperation;
  /** Our reference for the thing this is about, e.g. `Q-000042`. */
  portalRef: string;
  /** `<portalRef>:v<n>` — stable across retries, new on a re-price. */
  idempotencyKey: string;
  payload: Record<string, unknown>;
  customerGroupId?: string | null;
  createdByUserId?: string | null;
  correlationId?: string | null;
  /**
   * True when a switch says not to send this. The row is still written, as
   * `skipped`, so "we chose not to" stays distinguishable from "we lost it".
   */
  skip?: boolean;
  sourceInstance?: string;
}

/**
 * Records what we intend to exchange with an external system.
 *
 * The CargoWise transport is not agreed, so the last mile is held. Holding must
 * not mean dropping: this writes the message we would have sent and leaves it
 * `pending` for the relay to deliver once a transport exists.
 *
 * **Every call takes the caller's transaction.** The row must be written in the
 * same transaction as the business change that caused it, or there is a window
 * where we have answered a customer and lost the instruction to tell CargoWise.
 * That is the whole point of the table, so the parameter is not optional.
 */
@Injectable()
export class IntegrationMessageService {
  private readonly logger = new Logger(IntegrationMessageService.name);

  /**
   * Returns the row id, or null when this exact message was already recorded.
   *
   * Goes through `app.record_outbound_message` rather than an INSERT. A customer
   * must be able to record inside their own transaction and must never read this
   * table — and PostgreSQL applies the SELECT policy to `INSERT ... RETURNING`, so
   * a direct insert cannot return the id to the very caller that needs it. The
   * function re-checks the tenancy rule it bypasses.
   *
   * It is also one statement rather than a read followed by a write: two
   * concurrent submits of the same quote would both find nothing and both insert,
   * and the loser's unique violation would abort the CALLER'S business
   * transaction, failing a request that was perfectly valid.
   */
  async recordOutbound(tx: TenantClient, input: RecordOutboundInput): Promise<string | null> {
    const rows = await tx.$queryRaw<Array<{ id: string | null }>>`
      SELECT app.record_outbound_message(
        ${input.operation},
        ${input.portalRef},
        ${input.idempotencyKey},
        ${JSON.stringify(input.payload)}::jsonb,
        ${input.customerGroupId ?? null}::uuid,
        ${input.createdByUserId ?? null}::uuid,
        ${input.correlationId ?? null},
        ${input.sourceInstance ?? 'unassigned'},
        ${input.skip ? 'skipped' : 'pending'}::integration_message_status
      ) AS id`;

    return rows[0]?.id ?? null;
  }

  /**
   * Archive an inbound message before anything interprets it.
   *
   * Returns null when this `sourceMessageId` was already archived, which is how a
   * message delivered twice is processed once. Conflict-safe for the same reason
   * as `recordOutbound`: the inbound door must answer 202, not fail, on a repeat.
   */
  async archiveInbound(
    tx: TenantClient,
    input: {
      operation: string;
      sourceMessageId: string;
      sourceSystem?: string;
      sourceInstance?: string;
      payload: Record<string, unknown>;
      portalRef?: string | null;
      correlationId?: string | null;
    },
  ): Promise<string | null> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      INSERT INTO integration_message (
        direction, status, operation, source_system, source_instance,
        source_message_id, portal_ref, payload, correlation_id, next_attempt_at
      )
      VALUES (
        'inbound',
        'pending'::integration_message_status,
        ${input.operation},
        ${input.sourceSystem ?? 'cw1'},
        ${input.sourceInstance ?? 'unassigned'},
        ${input.sourceMessageId},
        ${input.portalRef ?? null},
        ${JSON.stringify(input.payload)}::jsonb,
        ${input.correlationId ?? null},
        ${new Date()}
      )
      ON CONFLICT (source_system, source_instance, source_message_id)
      DO NOTHING
      RETURNING id`;

    const id = rows[0]?.id ?? null;
    if (!id) {
      this.logger.log(`Duplicate inbound message ${input.sourceMessageId} ignored`);
    }
    return id;
  }

  /** What the staff screens and the sync endpoint report for one business record. */
  async statusFor(tx: TenantClient, portalRef: string) {
    return tx.integrationMessage.findMany({
      where: { portalRef },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        direction: true,
        status: true,
        operation: true,
        attempts: true,
        lastError: true,
        sentAt: true,
        externalReference: true,
        createdAt: true,
      },
    });
  }
}
