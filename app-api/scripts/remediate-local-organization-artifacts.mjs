#!/usr/bin/env node
import process from 'node:process';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
const NODE_ENV = process.env.NODE_ENV ?? 'local';
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');
if (!['local', 'test', 'development'].includes(NODE_ENV)) {
  throw new Error(`refusing organization test-artifact remediation in NODE_ENV=${NODE_ENV}`);
}

const sql = postgres(DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
try {
  const candidates = await sql`
    SELECT n.id, n.code
    FROM fleet.hierarchy_node n
    WHERE n.valid_to IS NULL
      AND n.parent_id IS NULL
      AND n.code LIKE 'HO-%'
      AND NOT EXISTS (SELECT 1 FROM fleet.person p WHERE p.home_pool_node_id = n.id)
      AND NOT EXISTS (SELECT 1 FROM fleet.role_assignment r WHERE r.scope_node_id = n.id AND r.valid_to IS NULL)
      AND NOT EXISTS (SELECT 1 FROM fleet.vehicle_hierarchy_assignment v WHERE v.node_id = n.id AND v.valid_to IS NULL)
      AND NOT EXISTS (SELECT 1 FROM fleet.entitlement_request e WHERE e.location_node_id = n.id)
      AND NOT EXISTS (SELECT 1 FROM fleet.policy_rule pr WHERE pr.scope_node_id = n.id AND pr.status = 'Active')
  `;
  await sql.begin(async (tx) => {
    for (const candidate of candidates) {
      await tx`
        UPDATE fleet.hierarchy_node
        SET valid_to = now()
        WHERE id = ${candidate.id} AND valid_to IS NULL
      `;
    }
    await tx`
      UPDATE fleet.person
      SET home_pool_node_id = 'a0000000-0000-4000-8000-000000000003'::uuid,
          updated_at_utc = now()
      WHERE home_pool_node_id IS NULL
        AND (hcm_employee_id LIKE 'ho-drv-%' OR hcm_employee_id LIKE 'ho-mgr-%')
    `;
  });
  console.log(`organization-remediation: retired ${candidates.length} unreferenced HO root(s) and assigned canonical home scope to local HO people`);
} finally {
  await sql.end({ timeout: 5 });
}
