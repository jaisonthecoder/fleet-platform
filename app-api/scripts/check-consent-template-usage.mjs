#!/usr/bin/env node
import postgres from 'postgres';

const versions = process.argv.slice(2);
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
if (versions.length === 0) throw new Error('Provide one or more consent versions');
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
try {
  const rows = await sql`
    SELECT 'Booking' AS domain, consent_document_version AS version, count(*)::int AS usage_count
    FROM fleet.consent_record
    WHERE consent_document_version IN ${sql(versions)}
    GROUP BY consent_document_version
    UNION ALL
    SELECT 'DedicatedVehicle' AS domain, consent_document_version AS version, count(*)::int AS usage_count
    FROM fleet.entitlement_request
    WHERE consent_document_version IN ${sql(versions)}
    GROUP BY consent_document_version
    ORDER BY domain, version
  `;
  console.log(JSON.stringify(rows, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
