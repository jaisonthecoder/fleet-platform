import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  TmsQuoteAdapter,
  type TmsPricedQuote,
  type TmsQuoteDecision,
  type TmsQuoteRequest,
  type TmsQuoteSnapshot,
} from '../../contracts/adapters/tms-quote.adapter';
import {
  unavailable,
  type TmsFetchResult,
  type TmsPage,
  type TmsSubmissionReceipt,
  type TmsSyncStatus,
  type TmsTenantScope,
} from '../../contracts/adapters/tms-common';

/**
 * The quote port with the last mile held.
 *
 * "Hold it for now" must not mean "drop it". The message has already been
 * written to `integration_message` by the caller, inside its business
 * transaction; this class exists so business code can name the operation it
 * wants without knowing that no transport is agreed yet.
 *
 * Every outbound method answers `recorded`: we have it safely, we have not sent
 * it. Saying `accepted` would be a lie that surfaces as a customer believing
 * CargoWise has their quote.
 *
 * When a transport is agreed, this class gains a client and stops returning
 * `recorded`. No business code changes.
 */
@Injectable()
export class Cw1QuoteAdapter extends TmsQuoteAdapter {
  constructor(private readonly config: ConfigService) {
    super();
  }

  /** The same key the relay reads, so the port and the worker can never disagree
   * about whether a transport exists. */
  isConfigured(): boolean {
    return (this.config.get<string>('cw1.transport.quote') ?? 'none') !== 'none';
  }

  async createRequest(request: TmsQuoteRequest): Promise<TmsSubmissionReceipt> {
    return this.held(request.idempotencyKey);
  }

  async updateRequest(request: TmsQuoteRequest): Promise<TmsSubmissionReceipt> {
    return this.held(request.idempotencyKey);
  }

  async cancelRequest(reference: string, _reason: string | null): Promise<TmsSubmissionReceipt> {
    return this.held(`${reference}:cancel`);
  }

  async submitPricedQuote(quote: TmsPricedQuote): Promise<TmsSubmissionReceipt> {
    return this.held(quote.idempotencyKey);
  }

  async recordDecision(decision: TmsQuoteDecision): Promise<TmsSubmissionReceipt> {
    return this.held(decision.idempotencyKey);
  }

  /**
   * While the transport is held the honest answer is `pending`, not `unknown`:
   * we know exactly where the message is, which is in our own table waiting to
   * be delivered.
   */
  async getQuoteStatus(reference: string): Promise<TmsFetchResult<TmsSyncStatus | null>> {
    if (!this.isConfigured()) {
      return {
        data: {
          reference,
          state: 'pending',
          externalReference: null,
          detail: 'Held: no CargoWise quote transport is configured yet.',
          observedAt: new Date(),
        },
        retrievedAt: new Date(),
        source: 'unavailable',
      };
    }

    throw new Error('Cw1QuoteAdapter.getQuoteStatus: no confirmed CargoWise message shape yet.');
  }

  async fetchQuote(
    _scope: TmsTenantScope,
    _reference: string,
  ): Promise<TmsFetchResult<TmsQuoteSnapshot | null>> {
    return unavailable(null);
  }

  async listQuotesChangedSince(
    _scope: TmsTenantScope,
    _since: Date,
    _cursor?: string,
  ): Promise<TmsFetchResult<TmsPage<TmsQuoteSnapshot>>> {
    return unavailable({ items: [], nextCursor: null });
  }

  private held(idempotencyKey: string): TmsSubmissionReceipt {
    return {
      outcome: 'recorded',
      // The row id belongs to the caller that wrote it; this port never inserts.
      messageId: null,
      externalReference: null,
      idempotencyKey,
    };
  }
}
