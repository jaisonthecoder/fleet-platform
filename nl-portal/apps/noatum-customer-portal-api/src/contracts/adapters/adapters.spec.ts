import { EmailAdapter } from './email.adapter';
import { EmissionsAdapter } from './emissions.adapter';
import { RateEngineAdapter } from './rate-engine.adapter';
import { TmsBookingAdapter } from './tms-booking.adapter';
import { TmsDocumentAdapter } from './tms-document.adapter';
import { TmsFinanceAdapter } from './tms-finance.adapter';
import { TmsOrganisationAdapter } from './tms-organisation.adapter';
import { TmsQuoteAdapter } from './tms-quote.adapter';
import { TmsTrackingAdapter } from './tms-tracking.adapter';

import type { EmailDeliveryResult, EmailMessage } from './email.adapter';
import type { EmissionsRequest, EmissionsResult } from './emissions.adapter';
import type { RateRequest, RateResult } from './rate-engine.adapter';
import type {
  TmsFetchResult,
  TmsPage,
  TmsSubmissionReceipt,
  TmsSyncStatus,
  TmsTenantScope,
} from './tms-common';
import { unavailable } from './tms-common';
import type { TmsBookingCancellation, TmsBookingConfirmation, TmsBookingRequest } from './tms-booking.adapter';
import type {
  TmsDocumentMetadata,
  TmsDocumentPayload,
  TmsDocumentQuery,
  TmsDocumentUpload,
} from './tms-document.adapter';
import type {
  TmsFinanceQuery,
  TmsFinancialTransaction,
  TmsStatement,
  TmsStatementQuery,
} from './tms-finance.adapter';
import type { TmsOrganisation, TmsOrganisationQuery } from './tms-organisation.adapter';
import type {
  TmsPricedQuote,
  TmsQuoteDecision,
  TmsQuoteRequest,
  TmsQuoteSnapshot,
} from './tms-quote.adapter';
import type {
  TmsConsol,
  TmsConsolQuery,
  TmsContainerUnit,
  TmsMilestoneEvent,
  TmsShipmentDetail,
  TmsShipmentQuery,
  TmsShipmentSummary,
} from './tms-tracking.adapter';

/**
 * The guarantee here is compile-level and comes from `tsc --noEmit`, not from Jest: an
 * abstract method with no body emits nothing on the prototype, so a runtime assertion
 * would pass even if the method were deleted. Jest runs through @swc/jest, which strips
 * types without checking them. Renaming or removing a port method breaks the typecheck,
 * which is the point of this file.
 */

class FakeEmail extends EmailAdapter {
  async send(_message: EmailMessage): Promise<EmailDeliveryResult> {
    return { status: 'not-configured', providerMessageId: null };
  }
  isConfigured(): boolean {
    return false;
  }
}

class FakeRateEngine extends RateEngineAdapter {
  isConfigured(): boolean {
    return false;
  }
  async rate(_request: RateRequest): Promise<RateResult> {
    throw new Error('fake');
  }
}

class FakeEmissions extends EmissionsAdapter {
  async estimate(_request: EmissionsRequest): Promise<EmissionsResult> {
    throw new Error('fake');
  }
  isConfigured(): boolean {
    return false;
  }
}

class FakeTracking extends TmsTrackingAdapter {
  isConfigured(): boolean {
    return false;
  }
  async listShipments(
    _scope: TmsTenantScope,
    _query?: TmsShipmentQuery,
  ): Promise<TmsPage<TmsShipmentSummary>> {
    return { items: [], nextCursor: null };
  }
  async getShipment(_scope: TmsTenantScope, _ref: string): Promise<TmsShipmentDetail | null> {
    return null;
  }
  async listMilestones(_scope: TmsTenantScope, _ref: string): Promise<TmsMilestoneEvent[]> {
    return [];
  }
  async listContainers(_scope: TmsTenantScope, _ref: string): Promise<TmsContainerUnit[]> {
    return [];
  }
  async listConsols(_scope: TmsTenantScope, _query?: TmsConsolQuery): Promise<TmsPage<TmsConsol>> {
    return { items: [], nextCursor: null };
  }
  async getConsol(_scope: TmsTenantScope, _ref: string): Promise<TmsConsol | null> {
    return null;
  }
  async listEventsChangedSince(
    _scope: TmsTenantScope,
    _since: Date,
    _cursor?: string,
  ): Promise<TmsFetchResult<TmsPage<TmsMilestoneEvent>>> {
    return unavailable({ items: [], nextCursor: null });
  }
  async getShipmentStatus(_ref: string): Promise<TmsFetchResult<TmsSyncStatus | null>> {
    return unavailable(null);
  }
}

const receipt: TmsSubmissionReceipt = {
  outcome: 'recorded',
  messageId: null,
  externalReference: null,
  idempotencyKey: 'Q-000042:v1',
};

class FakeQuote extends TmsQuoteAdapter {
  isConfigured(): boolean {
    return false;
  }
  async createRequest(_request: TmsQuoteRequest): Promise<TmsSubmissionReceipt> {
    return receipt;
  }
  async updateRequest(_request: TmsQuoteRequest): Promise<TmsSubmissionReceipt> {
    return receipt;
  }
  async cancelRequest(_reference: string, _reason: string | null): Promise<TmsSubmissionReceipt> {
    return receipt;
  }
  async submitPricedQuote(_quote: TmsPricedQuote): Promise<TmsSubmissionReceipt> {
    return receipt;
  }
  async recordDecision(_decision: TmsQuoteDecision): Promise<TmsSubmissionReceipt> {
    return receipt;
  }
  async getQuoteStatus(_reference: string): Promise<TmsFetchResult<TmsSyncStatus | null>> {
    return unavailable(null);
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
}

class FakeBooking extends TmsBookingAdapter {
  isConfigured(): boolean {
    return false;
  }
  async createBooking(_booking: TmsBookingRequest): Promise<TmsSubmissionReceipt> {
    return receipt;
  }
  async updateBooking(_booking: TmsBookingRequest): Promise<TmsSubmissionReceipt> {
    return receipt;
  }
  async cancelBooking(_cancellation: TmsBookingCancellation): Promise<TmsSubmissionReceipt> {
    return receipt;
  }
  async getBookingStatus(_reference: string): Promise<TmsFetchResult<TmsSyncStatus | null>> {
    return unavailable(null);
  }
  async fetchBooking(
    _scope: TmsTenantScope,
    _reference: string,
  ): Promise<TmsFetchResult<TmsBookingConfirmation | null>> {
    return unavailable(null);
  }
}

class FakeFinance extends TmsFinanceAdapter {
  isConfigured(): boolean {
    return false;
  }
  async listTransactions(
    _scope: TmsTenantScope,
    _query?: TmsFinanceQuery,
  ): Promise<TmsPage<TmsFinancialTransaction>> {
    return { items: [], nextCursor: null };
  }
  async getTransaction(
    _scope: TmsTenantScope,
    _ref: string,
  ): Promise<TmsFinancialTransaction | null> {
    return null;
  }
  async fetchStatement(
    _scope: TmsTenantScope,
    _query: TmsStatementQuery,
  ): Promise<TmsFetchResult<TmsStatement | null>> {
    return unavailable(null);
  }
  async getTransactionStatus(_ref: string): Promise<TmsFetchResult<TmsSyncStatus | null>> {
    return unavailable(null);
  }
}

class FakeDocument extends TmsDocumentAdapter {
  isConfigured(): boolean {
    return false;
  }
  async listDocuments(
    _scope: TmsTenantScope,
    _query: TmsDocumentQuery,
  ): Promise<TmsPage<TmsDocumentMetadata>> {
    return { items: [], nextCursor: null };
  }
  async fetchDocument(
    _scope: TmsTenantScope,
    _ref: string,
  ): Promise<TmsDocumentPayload | null> {
    return null;
  }
  async pushDocument(_document: TmsDocumentUpload): Promise<TmsSubmissionReceipt> {
    return receipt;
  }
  async getDocumentStatus(_reference: string): Promise<TmsFetchResult<TmsSyncStatus | null>> {
    return unavailable(null);
  }
}

class FakeOrganisation extends TmsOrganisationAdapter {
  isConfigured(): boolean {
    return false;
  }
  async listOrganisations(
    _query?: TmsOrganisationQuery,
  ): Promise<TmsFetchResult<TmsPage<TmsOrganisation>>> {
    return unavailable({ items: [], nextCursor: null });
  }
  async fetchOrganisation(_orgCode: string): Promise<TmsFetchResult<TmsOrganisation | null>> {
    return unavailable(null);
  }
  async listOrganisationsChangedSince(
    _since: Date,
    _cursor?: string,
  ): Promise<TmsFetchResult<TmsPage<TmsOrganisation>>> {
    return unavailable({ items: [], nextCursor: null });
  }
}

describe('adapter ports', () => {
  it('are all satisfiable by a concrete class', () => {
    expect(new FakeEmail()).toBeInstanceOf(EmailAdapter);
    expect(new FakeRateEngine()).toBeInstanceOf(RateEngineAdapter);
    expect(new FakeEmissions()).toBeInstanceOf(EmissionsAdapter);
    expect(new FakeTracking()).toBeInstanceOf(TmsTrackingAdapter);
    expect(new FakeQuote()).toBeInstanceOf(TmsQuoteAdapter);
    expect(new FakeBooking()).toBeInstanceOf(TmsBookingAdapter);
    expect(new FakeFinance()).toBeInstanceOf(TmsFinanceAdapter);
    expect(new FakeDocument()).toBeInstanceOf(TmsDocumentAdapter);
    expect(new FakeOrganisation()).toBeInstanceOf(TmsOrganisationAdapter);
  });

  it('let a caller ask whether a transport is configured, because none is a first-class state', () => {
    // CW1_TRANSPORT_*=none must not look like "you have no shipments".
    expect(new FakeTracking().isConfigured()).toBe(false);
    expect(new FakeQuote().isConfigured()).toBe(false);
    expect(new FakeBooking().isConfigured()).toBe(false);
    expect(new FakeFinance().isConfigured()).toBe(false);
    expect(new FakeDocument().isConfigured()).toBe(false);
    expect(new FakeOrganisation().isConfigured()).toBe(false);
    expect(new FakeRateEngine().isConfigured()).toBe(false);
  });

  it('can say a message is recorded but not sent', () => {
    // The whole point of the held transport: `accepted` would tell a customer
    // CargoWise has their quote when nothing has left the building.
    const outcomes: TmsSubmissionReceipt['outcome'][] = [
      'recorded', 'received', 'accepted', 'rejected',
    ];
    expect(outcomes).toContain('recorded');
  });

  it('distinguish an absent answer from an empty one', async () => {
    // "No shipments" and "we could not ask" are the same pixels and opposite meanings.
    const result = await new FakeTracking().getShipmentStatus('S-1');
    expect(result.source).toBe('unavailable');
    expect(result.data).toBeNull();
  });

  it('use the quote status vocabulary for a decision', () => {
    const outcomes: TmsQuoteDecision['outcome'][] = ['accepted', 'rejected', 'withdrawn'];
    expect(outcomes).toContain('withdrawn');
  });
});
