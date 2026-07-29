#!/usr/bin/env node
// Migration-test harness (gate: fresh-migrate + object presence + idempotency).
// Applies all Drizzle migrations forward against DATABASE_URL via the
// programmatic migrator (TTY-independent — safe in CI), asserts the full schema
// (tables, triggers, exclusion constraints, extensions, seed) exists, and proves
// the migrate is idempotent (a second run applies nothing). Run against a
// throwaway Postgres service.
//
// Usage: DATABASE_URL=postgres://fleet:fleet@localhost:5442/fleet node scripts/migration-test.mjs

import process from 'node:process';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate as drizzleMigrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('migration-test: DATABASE_URL is required');
  process.exit(1);
}

/** Applies all Drizzle migrations programmatically (idempotent; TTY-independent). */
async function migrate(label) {
  const client = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    await drizzleMigrate(drizzle(client), {
      migrationsFolder: 'drizzle/migrations',
    });
  } catch (error) {
    console.error(`migration-test: ${label} failed\n${error?.stack ?? error}`);
    process.exit(1);
  } finally {
    await client.end({ timeout: 5 });
  }
}

// Expected objects after a full forward migration (schema-qualified).
const EXPECTED_TABLES = [
  // Phase 0 — platform core
  'organization',
  'organization_hierarchy_level',
  'hierarchy_node',
  'hierarchy_change_event',
  'person',
  'role_assignment',
  'delegation',
  'sod_exception',
  'policy_rule',
  'policy_version',
  'decision_log',
  'workflow_instance',
  'workflow_step',
  'audit_log',
  'outbox_event',
  'inbox_message',
  'scheduled_work',
  'telemetry',
  // Phase 1 — 1A₂ lookup + identity
  'lookup_type',
  'lookup_value',
  'user_account',
  // Phase 1 — 1B vehicle master + migration
  'vehicle',
  'vehicle_document',
  'vehicle_lifecycle_history',
  'vehicle_transfer',
  'vehicle_hierarchy_assignment',
  'import_batch',
  'import_row',
  'dedup_candidate',
  // Phase 1 — 1B vendor master + lease contracts (S1/S2)
  'vendor',
  'vendor_onboarding_profile',
  'vendor_document',
  'lease_contract',
  // Phase 1 — 1C telematics domain
  'device',
  'device_pairing',
  'trip',
  'telematics_alert',
  // Phase 1 — 1D compliance + booking + handover
  'compliance_item',
  'eligibility_evaluation',
  'access_block',
  'booking',
  'booking_command_ledger',
  'booking_policy_decision',
  'waitlist_entry',
  'booking_event',
  'consent_record',
  'consent_lifecycle_event',
  'handover',
  'damage_pin',
  'key_log',
  // Phase 1 — 1E entitlements + fines/substitution
  'entitlement_request',
  'entitlement_command_ledger',
  'entitlement_eligibility_preview',
  'entitlement_allocation',
  'entitlement_event',
  'bsd_return_window',
  'fine',
  'black_point',
  'accident',
  'recovery_record',
  'substitution_window',
];
const EXPECTED_TRIGGERS = [
  'audit_log_hash_chain_trg',
  'audit_log_no_mutate_trg',
  'hierarchy_node_validate_trg',
  'organization_bump_revision_trg',
  'hierarchy_node_bump_revision_trg',
  'organization_hierarchy_level_bump_revision_trg',
  'vendor_document_lineage_trg',
  'booking_bump_revision_trg',
];
const EXPECTED_EXTENSIONS = ['pgcrypto', 'ltree', 'btree_gist'];

async function main() {
  // Bootstrap the TimescaleDB extension before migrating (migration 0001 calls
  // create_hypertable). The local docker DB pre-creates it via an init script;
  // CI service containers do not, so do it here to keep the harness self-sufficient.
  const bootstrap = postgres(DATABASE_URL, {
    max: 1,
    prepare: false,
    onnotice: () => {},
  });
  try {
    await bootstrap`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE`;
  } finally {
    await bootstrap.end({ timeout: 5 });
  }

  console.log('migration-test: applying migrations (forward)…');
  await migrate('forward migrate');

  const sql = postgres(DATABASE_URL, {
    max: 1,
    prepare: false,
    onnotice: () => {},
  });
  try {
    const tables = (
      await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'fleet'`
    ).map((r) => r.table_name);
    const missingTables = EXPECTED_TABLES.filter((t) => !tables.includes(t));
    if (missingTables.length) {
      throw new Error(`missing fleet tables: ${missingTables.join(', ')}`);
    }

    const vendorSubmissionColumns = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'fleet' AND table_name = 'vendor'
        AND column_name = 'submitted_at_utc'
    `;
    if (vendorSubmissionColumns.length !== 1) {
      throw new Error('missing fleet.vendor.submitted_at_utc');
    }

    const vehicleHealthColumns = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'fleet' AND table_name = 'vehicle'
        AND column_name IN (
          'vendor_health_hold',
          'vendor_health_hold_reason',
          'vendor_health_previous_operational_status',
          'vendor_health_previous_booking_pool_flag',
          'vendor_health_held_at_utc'
        )
    `;
    if (vehicleHealthColumns.length !== 5) {
      throw new Error('missing Vehicle Vendor-health hold columns');
    }

    const bookingBaselineColumns = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'fleet' AND table_name = 'booking'
        AND column_name IN (
          'beneficiary_person_id',
          'booking_scope_node_id',
          'revision'
        )
    `;
    if (bookingBaselineColumns.length !== 3) {
      throw new Error('missing fleet.booking security baseline columns');
    }

    const bookingLedgerIndexes = await sql`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'fleet'
        AND tablename = 'booking_command_ledger'
        AND indexname = 'booking_command_ledger_key_uq'
    `;
    if (bookingLedgerIndexes.length !== 1) {
      throw new Error('missing booking command idempotency unique index');
    }

    const entitlementBaselineColumns = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'fleet' AND table_name = 'entitlement_request'
        AND column_name IN (
          'requested_by_person_id',
          'assigned_driver_person_id',
          'preferred_vehicle_id',
          'preference_note',
          'revision',
          'approval_route_provenance'
          ,'eligibility_preview_id'
          ,'consent_content_hash'
        )
    `;
    if (entitlementBaselineColumns.length !== 8) {
      throw new Error('missing fleet.entitlement_request DEDICATED-00 columns');
    }

    const entitlementLedgerIndexes = await sql`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'fleet'
        AND tablename = 'entitlement_command_ledger'
        AND indexname = 'entitlement_command_key_uq'
    `;
    if (entitlementLedgerIndexes.length !== 1) {
      throw new Error('missing entitlement command idempotency unique index');
    }

    const entitlementAllocationConstraint = await sql`
      SELECT conname FROM pg_constraint
      WHERE connamespace = 'fleet'::regnamespace
        AND conname = 'entitlement_allocation_no_overlap'
    `;
    if (entitlementAllocationConstraint.length !== 1) {
      throw new Error('missing entitlement allocation exclusion constraint');
    }

    const bsdConstraint = await sql`
      SELECT conname FROM pg_constraint
      WHERE connamespace = 'fleet'::regnamespace AND conname = 'bsd_window_no_overlap'
    `;
    if (bsdConstraint.length !== 1) throw new Error('missing BSD overlap constraint');

    const dedicatedConfiguration = await sql`
      SELECT
        (SELECT count(*)::int
         FROM fleet.lookup_value value
         JOIN fleet.lookup_type type ON type.id = value.lookup_type_id
         WHERE type.code = 'dedicated-vehicle-justification-category'
           AND value.is_active = true) AS justification_count,
        (SELECT count(*)::int
         FROM fleet.lookup_value value
         JOIN fleet.lookup_type type ON type.id = value.lookup_type_id
         WHERE type.code = 'dedicated-vehicle-class'
           AND value.is_active = true) AS class_count,
        (SELECT count(*)::int
         FROM fleet.policy_rule rule
         JOIN fleet.policy_version version ON version.policy_rule_id = rule.id
         WHERE rule.rule_type = 'dedicated-vehicle-eligibility'
           AND rule.status = 'Active'
           AND rule.scope_node_id IS NULL
           AND version.decision_table->>'version' = 'manual-dedicated-eligibility-v1') AS policy_count
    `;
    if (
      dedicatedConfiguration[0]?.justification_count !== 4 ||
      dedicatedConfiguration[0]?.class_count !== 2 ||
      dedicatedConfiguration[0]?.policy_count !== 1
    ) {
      throw new Error('Dedicated Vehicle manual policy configuration is incomplete');
    }

    const leaseStatuses = (
      await sql`
        SELECT enumlabel FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = 'fleet_lease_contract_status'
      `
    ).map((row) => row.enumlabel);
    if (!leaseStatuses.includes('Suspended')) {
      throw new Error('missing Suspended fleet_lease_contract_status');
    }

    const triggers = (
      await sql`SELECT tgname FROM pg_trigger WHERE NOT tgisinternal`
    ).map((r) => r.tgname);
    const missingTriggers = EXPECTED_TRIGGERS.filter(
      (t) => !triggers.includes(t),
    );
    if (missingTriggers.length) {
      throw new Error(`missing triggers: ${missingTriggers.join(', ')}`);
    }

    // Hand-authored exclusion constraints (btree_gist) must survive migration —
    // they are the structural double-book / overlap guards, not app logic.
    const constraints = (
      await sql`SELECT conname FROM pg_constraint WHERE contype = 'x'`
    ).map((r) => r.conname);
    const EXPECTED_EXCLUSIONS = [
      'booking_no_double_book',
      'vehicle_hierarchy_assignment_no_overlap',
      'device_pairing_no_overlap',
    ];
    const missingExcl = EXPECTED_EXCLUSIONS.filter(
      (c) => !constraints.includes(c),
    );
    if (missingExcl.length) {
      throw new Error(
        `missing exclusion constraints: ${missingExcl.join(', ')}`,
      );
    }

    const extensions = (await sql`SELECT extname FROM pg_extension`).map(
      (r) => r.extname,
    );
    const missingExt = EXPECTED_EXTENSIONS.filter(
      (e) => !extensions.includes(e),
    );
    if (missingExt.length) {
      throw new Error(`missing extensions: ${missingExt.join(', ')}`);
    }

    // audit hash-chain requires the per-org chain_seq column (migration 0002).
    const chainSeq = await sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'fleet' AND table_name = 'audit_log' AND column_name = 'chain_seq'
    `;
    if (chainSeq.length === 0) {
      throw new Error(
        'audit_log.chain_seq column missing (migration 0002 not applied)',
      );
    }

    const hierarchyFoundation = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'fleet' AND table_name = 'hierarchy_node'
        AND column_name IN ('code', 'revision')
    `;
    if (hierarchyFoundation.length !== 2) {
      throw new Error(
        'hierarchy_node code/revision columns missing (migration 0016 not applied)',
      );
    }

    const organizationConstraints = (
      await sql`
        SELECT conname FROM pg_constraint
        WHERE conname IN (
          'organization_revision_positive',
          'hierarchy_node_level_nonnegative',
          'hierarchy_node_revision_positive',
          'hierarchy_node_valid_window'
        )
      `
    ).map((row) => row.conname);
    if (organizationConstraints.length !== 4) {
      throw new Error('organization/hierarchy foundation constraints missing');
    }

    const requiredHierarchyMetadata = await sql`
      SELECT count(*)::int AS count
      FROM information_schema.columns
      WHERE table_schema = 'fleet' AND table_name = 'hierarchy_node'
        AND column_name IN ('level_code', 'name_ar') AND is_nullable = 'NO'
    `;
    if (requiredHierarchyMetadata[0]?.count !== 2) {
      throw new Error('hierarchy level_code/name_ar must be NOT NULL');
    }

    const vendorDocumentConstraints = (
      await sql`
        SELECT conname FROM pg_constraint
        WHERE conname IN (
          'vendor_document_vendor_org_fk',
          'vendor_document_issue_expiry_valid',
          'vendor_document_confirmation_complete'
        )
      `
    ).map((row) => row.conname);
    if (vendorDocumentConstraints.length !== 3) {
      throw new Error('vendor document FK/check constraints missing');
    }

    const vendorDocumentIndexes = (
      await sql`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'fleet' AND indexname IN (
          'vendor_document_version_uq',
          'vendor_document_current_confirmed_uq',
          'vendor_document_pending_uq'
        )
      `
    ).map((row) => row.indexname);
    if (vendorDocumentIndexes.length !== 3) {
      throw new Error('vendor document uniqueness indexes missing');
    }

    const vendorDocumentEnum = (
      await sql`
        SELECT enumlabel FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'fleet_vendor_document_status'
        ORDER BY enumsortorder
      `
    ).map((row) => row.enumlabel);
    if (
      vendorDocumentEnum.join(',') !==
      'Uploaded,PendingConfirmation,Confirmed,Superseded,Rejected'
    ) {
      throw new Error('vendor document lifecycle enum is incomplete');
    }

    const vendorDocumentTypes = await sql`
      SELECT count(*)::int AS count
      FROM fleet.lookup_value value
      JOIN fleet.lookup_type type ON type.id = value.lookup_type_id
      WHERE type.code = 'vendor-document-type'
        AND value.code IN (
          'TRADE_LICENCE',
          'LIABILITY_INSURANCE',
          'MASTER_SERVICE_AGREEMENT',
          'SIGNATORY_AUTHORIZATION'
        )
    `;
    if (vendorDocumentTypes[0]?.count !== 4) {
      throw new Error('vendor document type lookup seed is incomplete');
    }

    // The seeded organization row must exist.
    const org = await sql`
      SELECT 1 FROM fleet.organization
      WHERE id = '00000000-0000-4000-8000-000000000001'
    `;
    if (org.length === 0) {
      throw new Error('seeded organization row missing');
    }
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log(
    'migration-test: verifying idempotency (second migrate is a no-op)…',
  );
  await migrate('idempotent migrate');
  // The programmatic migrator tracks applied migrations in __drizzle_migrations,
  // so a second run applies nothing — a successful re-run proves idempotency.

  console.log(
    'migration-test: OK — schema, triggers, extensions, seed all present; migrate idempotent.',
  );
}

main().catch((error) => {
  console.error(`migration-test: FAILED — ${error.message}`);
  process.exit(1);
});
