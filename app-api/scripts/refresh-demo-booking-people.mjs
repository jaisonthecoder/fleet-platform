#!/usr/bin/env node
import process from 'node:process';
import postgres from 'postgres';

if ((process.env.NODE_ENV ?? 'local') !== 'local') {
  throw new Error('refresh-demo-booking-people is restricted to NODE_ENV=local');
}

const databaseUrl = process.env.DATABASE_URL ?? 'postgres://fleet:fleet@localhost:5442/fleet';
const sql = postgres(databaseUrl, { max: 1 });

try {
  const rows = await sql`
    UPDATE fleet.person
    SET updated_at_utc = now(),
        licence_expiry = CASE
          WHEN licence_expiry IS NULL OR licence_expiry < current_date
            THEN (current_date + interval '2 years')::date
          ELSE licence_expiry
        END
    WHERE email LIKE ${'%@example.ae'}
      AND employment_status = 'Active'
    RETURNING id, full_name, email, licence_expiry, updated_at_utc
  `;
  console.log(`refresh-demo-booking-people: refreshed ${rows.length} seeded people`);
  for (const row of rows) {
    console.log(`${row.full_name} | ${row.email} | licence ${row.licence_expiry}`);
  }
} finally {
  await sql.end();
}