import type {
  TmsFetchResult,
  TmsPage,
  TmsSubmissionReceipt,
  TmsSyncStatus,
  TmsTenantScope,
} from './tms-common';

/**
 * Port for documents held in the TMS.
 *
 * v4 rule 6: documents use an **allow-list**. Typing in CargoWise is manual and
 * unvalidated, so a document is customer-visible only when its type has been explicitly
 * approved in the portal. That is why `documentType` is the mapped portal code and
 * `customerVisible` is a decision this port reports rather than infers — an unmapped or
 * unapproved type must resolve to `false`, never to "probably fine".
 *
 * Metadata and payload are separate calls on purpose: listing a customer's documents must
 * not drag megabytes of PDFs across the wire.
 *
 * NOT IMPLEMENTED. Phase 2.
 */
export abstract class TmsDocumentAdapter {
  /** False when no document transport is configured. An empty list and "not connected" are
   * different answers and the caller must be able to tell them apart. */
  abstract isConfigured(): boolean;

  abstract listDocuments(
    scope: TmsTenantScope,
    query: TmsDocumentQuery,
  ): Promise<TmsPage<TmsDocumentMetadata>>;

  /** Null when unknown, out of scope, or not on the allow-list. */
  abstract fetchDocument(
    scope: TmsTenantScope,
    documentRef: string,
  ): Promise<TmsDocumentPayload | null>;

  /** Send a document we hold - a quotation PDF, a customer upload - to the TMS. */
  abstract pushDocument(document: TmsDocumentUpload): Promise<TmsSubmissionReceipt>;

  /** What the TMS did with a document we pushed. */
  abstract getDocumentStatus(reference: string): Promise<TmsFetchResult<TmsSyncStatus | null>>;
}

export interface TmsDocumentUpload {
  /** Our reference for the thing the document belongs to, e.g. `Q-000042`. */
  reference: string;
  idempotencyKey: string;
  orgCode: string;
  /** Mapped portal document-type code, never a raw source string. */
  documentType: string;
  fileName: string;
  contentType: string;
  content: Buffer;
}

export interface TmsDocumentQuery {
  shipmentRef?: string;
  /** Portal document-type code, already mapped. */
  documentType?: string;
  /** Internal callers only. A customer surface must never set this to true. */
  includeInternalOnly?: boolean;
  cursor?: string;
  limit?: number;
}

export interface TmsDocumentMetadata {
  documentRef: string;
  shipmentRef: string | null;
  /** Mapped portal code. Null when the source type is unmapped, which forces `false` below. */
  documentType: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number | null;
  issuedAt: Date | null;
  /** The allow-list decision, already made. Never re-derive it at the call site. */
  customerVisible: boolean;
}

export interface TmsDocumentPayload {
  metadata: TmsDocumentMetadata;
  /** Bytes, not base64 — the transport decodes whatever the source sends. */
  content: Buffer;
}
