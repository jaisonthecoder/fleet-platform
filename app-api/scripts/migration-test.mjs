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
    await drizzleMigrate(drizzle(client), { migrationsFolder: 'drizzle/migrations' });
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
  'waitlist_entry',
  'booking_event',
  'consent_record',
  'consent_lifecycle_event',
  'handover',
  'damage_pin',
  'key_log',
  // Phase 1 — 1E entitlements + fines/substitution
  'entitlement_request',
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
];
const EXPECTED_EXTENSIONS = ['pgcrypto', 'ltree', 'btree_gist'];

async function main() {
  // Bootstrap the TimescaleDB extension before migrating (migration 0001 calls
  // create_hypertable). The local docker DB pre-creates it via an init script;
  // CI service containers do not, so do it here to keep the harness self-sufficient.
  const bootstrap = postgres(DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await bootstrap`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE`;
  } finally {
    await bootstrap.end({ timeout: 5 });
  }

  console.log('migration-test: applying migrations (forward)…');
  await migrate('forward migrate');

  const sql = postgres(DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const tables = (
      await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'fleet'`
    ).map((r) => r.table_name);
    const missingTables = EXPECTED_TABLES.filter((t) => !tables.includes(t));
    if (missingTables.length) {
      throw new Error(`missing fleet tables: ${missingTables.join(', ')}`);
    }

    const triggers = (
      await sql`SELECT tgname FROM pg_trigger WHERE NOT tgisinternal`
    ).map((r) => r.tgname);
    const missingTriggers = EXPECTED_TRIGGERS.filter((t) => !triggers.includes(t));
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
    const missingExcl = EXPECTED_EXCLUSIONS.filter((c) => !constraints.includes(c));
    if (missingExcl.length) {
      throw new Error(`missing exclusion constraints: ${missingExcl.join(', ')}`);
    }

    const extensions = (await sql`SELECT extname FROM pg_extension`).map(
      (r) => r.extname,
    );
    const missingExt = EXPECTED_EXTENSIONS.filter((e) => !extensions.includes(e));
    if (missingExt.length) {
      throw new Error(`missing extensions: ${missingExt.join(', ')}`);
    }

    // audit hash-chain requires the per-org chain_seq column (migration 0002).
    const chainSeq = await sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'fleet' AND table_name = 'audit_log' AND column_name = 'chain_seq'
    `;
    if (chainSeq.length === 0) {
      throw new Error('audit_log.chain_seq column missing (migration 0002 not applied)');
    }

    const hierarchyFoundation = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'fleet' AND table_name = 'hierarchy_node'
        AND column_name IN ('code', 'revision')
    `;
    if (hierarchyFoundation.length !== 2) {
      throw new Error('hierarchy_node code/revision columns missing (migration 0016 not applied)');
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

  console.log('migration-test: verifying idempotency (second migrate is a no-op)…');
  await migrate('idempotent migrate');
  // The programmatic migrator tracks applied migrations in __drizzle_migrations,
  // so a second run applies nothing — a successful re-run proves idempotency.

  console.log('migration-test: OK — schema, triggers, extensions, seed all present; migrate idempotent.');
}

main().catch((error) => {
  console.error(`migration-test: FAILED — ${error.message}`);
  process.exit(1);
});
