import { sql } from 'drizzle-orm';
import { date, index, integer, text, uuid } from 'drizzle-orm/pg-core';
import { fleet, orgId, timestamps } from './_shared';
import { organization, person } from './platform.schema';

/**
 * Centralized employee document store (licence, Emirates ID, medical, training,
 * other). One row per uploaded version; a new upload of the same type supersedes
 * the prior one. The binary lives in a private object store keyed by `blobRef`;
 * this table holds only metadata. Classified sensitive PII.
 */
export const personDocument = fleet.table(
  'person_document',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId().references(() => organization.id),
    personId: uuid('person_id')
      .notNull()
      .references(() => person.id),
    docTypeCode: text('doc_type_code').notNull(),
    documentReference: text('document_reference'),
    blobRef: text('blob_ref'),
    issueDate: date('issue_date'),
    expiryDate: date('expiry_date'),
    version: integer('version').notNull().default(1),
    status: text('status').notNull().default('Uploaded'),
    uploadedByPersonId: uuid('uploaded_by').references(() => person.id),
    ...timestamps(),
  },
  (t) => [
    index('person_document_person_type_idx').on(t.personId, t.docTypeCode),
    index('person_document_expiry_idx').on(t.expiryDate),
  ],
);
