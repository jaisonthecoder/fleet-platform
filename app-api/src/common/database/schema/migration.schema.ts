import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { fleet, orgId } from './_shared';

export const importBatchStatusEnum = pgEnum('fleet_import_batch_status', [
  'Staged',
  'Validated',
  'SignedOff',
  'Committed',
  'Rejected',
]);

export const importRowStatusEnum = pgEnum('fleet_import_row_status', [
  'Pending',
  'Valid',
  'Invalid',
  'Duplicate',
  'NeedsResolution',
  'Committed',
]);

/** One bulk import run — staged, validated, reconciled, steward-signed-off, committed. */
export const importBatch = fleet.table('import_batch', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: orgId(),
  source: text('source').notNull(),
  uploadedByRef: text('uploaded_by_ref'),
  status: importBatchStatusEnum('status').notNull().default('Staged'),
  totalRows: integer('total_rows').notNull().default(0),
  validRows: integer('valid_rows').notNull().default(0),
  invalidRows: integer('invalid_rows').notNull().default(0),
  duplicateRows: integer('duplicate_rows').notNull().default(0),
  /** valid / total, as a percentage (0–100). */
  completenessScore: numeric('completeness_score', { precision: 5, scale: 2 }).notNull().default('0'),
  signedOffByRef: text('signed_off_by_ref'),
  signedOffAt: timestamp('signed_off_at', { withTimezone: true }),
  createdAtUtc: timestamp('created_at_utc', { withTimezone: true }).notNull().defaultNow(),
});

/** A staged source row with its validation status + reason (never mutated in place). */
export const importRow = fleet.table(
  'import_row',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    batchId: uuid('batch_id').notNull().references(() => importBatch.id),
    rowNumber: integer('row_number').notNull(),
    rawData: jsonb('raw_data').notNull(),
    status: importRowStatusEnum('status').notNull().default('Pending'),
    reason: text('reason'),
    committedVehicleId: uuid('committed_vehicle_id'),
    createdAtUtc: timestamp('created_at_utc', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('import_row_batch_idx').on(t.batchId, t.status)],
);

/** A suspected duplicate surfaced for steward resolution. */
export const dedupCandidate = fleet.table(
  'dedup_candidate',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    batchId: uuid('batch_id').notNull().references(() => importBatch.id),
    rowId: uuid('row_id').notNull().references(() => importRow.id),
    matchType: text('match_type').notNull(),
    matchValue: text('match_value').notNull(),
    /** The existing vehicle it collides with (null = duplicate within the batch). */
    existingVehicleId: uuid('existing_vehicle_id'),
    createdAtUtc: timestamp('created_at_utc', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('dedup_candidate_batch_idx').on(t.batchId)],
);
