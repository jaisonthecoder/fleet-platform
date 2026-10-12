import type { CurrencyCode, TmsFetchResult, TmsPage, TmsSyncStatus, TmsTenantScope } from './tms-common';

/**
 * Port for finance: invoices and credit notes.
 *
 * The security rule this port exists to make enforceable: a financial document is visible
 * only when the caller's CustomerAccount is the **addressee**. So `addresseeOrgCode` is
 * non-nullable — a transaction that arrives without one cannot be shown to anybody, and a
 * nullable field would let that decision be forgotten at the call site.
 *
 * NOT IMPLEMENTED. Phase 2.
 */
export abstract class TmsFinanceAdapter {
  /** False when no finance transport is configured, so a screen can say so rather than
   * showing an empty list that looks like "you have no invoices". */
  abstract isConfigured(): boolean;

  abstract listTransactions(
    scope: TmsTenantScope,
    query?: TmsFinanceQuery,
  ): Promise<TmsPage<TmsFinancialTransaction>>;

  /** Null when unknown or out of scope — the caller cannot tell which. */
  abstract getTransaction(
    scope: TmsTenantScope,
    transactionRef: string,
  ): Promise<TmsFinancialTransaction | null>;
  /**
   * An account statement for a period.
   *
   * Named for what it is rather than `fetchInvoice`: the build plan's table says
   * invoices, but a credit note is not an invoice, and `listTransactions` above
   * already covers both. Renaming those to `listInvoices` would make the type
   * lie about half its rows.
   */
  abstract fetchStatement(
    scope: TmsTenantScope,
    query: TmsStatementQuery,
  ): Promise<TmsFetchResult<TmsStatement | null>>;

  /** What the TMS says about a transaction we asked about. */
  abstract getTransactionStatus(
    transactionRef: string,
  ): Promise<TmsFetchResult<TmsSyncStatus | null>>;
}

export interface TmsStatementQuery {
  /** The organisation the statement is for. The visibility test is against this. */
  orgCode: string;
  issuedFrom: Date;
  issuedTo: Date;
}

export interface TmsStatement {
  orgCode: string;
  issuedFrom: Date;
  issuedTo: Date;
  currency: CurrencyCode;
  openingBalanceMinorUnits: bigint;
  closingBalanceMinorUnits: bigint;
  transactions: TmsFinancialTransaction[];}

export interface TmsFinanceQuery {
  kind?: TmsFinancialTransactionKind;
  /** Inclusive lower bound on issue date. */
  issuedFrom?: Date;
  /** Inclusive upper bound on issue date. */
  issuedTo?: Date;
  outstandingOnly?: boolean;
  cursor?: string;
  limit?: number;
}

export type TmsFinancialTransactionKind = 'invoice' | 'credit_note';

export interface TmsFinancialTransaction {
  transactionRef: string;
  kind: TmsFinancialTransactionKind;
  /** The organisation billed. The visibility test is against this, nothing else. */
  addresseeOrgCode: string;
  invoiceNumber: string;
  issuedAt: Date;
  dueAt: Date | null;
  currency: CurrencyCode;
  /** Minor units. A credit note carries a negative total. */
  totalMinorUnits: bigint;
  outstandingMinorUnits: bigint;
  /** Portal status vocabulary, already mapped. */
  status: string | null;
  /** Shipments this transaction relates to, for cross-linking. */
  shipmentRefs: string[];
  lines: TmsFinancialLine[];
}

export interface TmsFinancialLine {
  /** Portal charge-code vocabulary, mapped through `mapping_*`. Null when unmapped. */
  chargeCode: string | null;
  description: string;
  amountMinorUnits: bigint;
  currency: CurrencyCode;
  taxMinorUnits: bigint | null;
}
