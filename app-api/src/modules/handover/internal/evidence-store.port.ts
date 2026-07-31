export const HANDOVER_EVIDENCE_STORE = Symbol('HANDOVER_EVIDENCE_STORE');

/** Private object-store boundary for Handover photos and signature evidence. */
export interface HandoverEvidenceStore {
  /** Durably writes one server-generated object key. */
  put(objectKey: string, body: Buffer): Promise<void>;
  /** Removes an unclaimed object after a failed staging transaction or expiry. */
  delete(objectKey: string): Promise<void>;
}
