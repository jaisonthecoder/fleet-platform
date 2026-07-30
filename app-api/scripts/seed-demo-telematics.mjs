#!/usr/bin/env node
/**
 * Seeds realistic telematics data (devices + pairings, recent telemetry, one
 * completed trip, compliance documents and a couple of open alerts) for the
 * vehicles already present in the fleet master. Inserts directly into the
 * `fleet` schema using the same driver the app uses, mirroring the exact table
 * shapes the read models expect — so the Telematics, Documents, Activity tabs
 * and the Live Map show real, editable content. Idempotent: safe to re-run.
 *
 * Prereq: vehicles exist (run `pnpm db:seed-demo-fleet` first).
 * Usage:  DATABASE_URL=postgres://fleet:fleet@localhost:5442/fleet node scripts/seed-demo-telematics.mjs
 */
import process from 'node:process';
import postgres from 'postgres';

const url =
  process.env.DATABASE_URL ?? 'postgres://fleet:fleet@localhost:5442/fleet';
const sql = postgres(url, { max: 4 });

/** Abu Dhabi anchor ([lat, lon]); vehicles are spread around it. */
const AD = { lat: 24.4539, lon: 54.3773 };
const DOC_TYPES = [
  ['MULKIYA', '2027-01-14'],
  ['INSURANCE', '2026-12-31'],
];

async function main() {
  const vehicles = await sql`
    select id, organization_id, plate, last_confirmed_odometer
    from fleet.vehicle
    order by created_at_utc desc
    limit 200`;

  if (vehicles.length === 0) {
    console.error(
      'No vehicles found. Seed the fleet first: pnpm db:seed-demo-fleet',
    );
    await sql.end();
    process.exit(1);
  }

  let devices = 0;
  let points = 0;
  let docs = 0;
  let trips = 0;
  let alerts = 0;

  for (const [i, v] of vehicles.entries()) {
    const org = v.organization_id;
    const identifier = `SIM-${String(v.plate).replace(/\s+/g, '')}`;

    // Device (idempotent by identifier).
    const existingDevice =
      await sql`select id from fleet.device where identifier = ${identifier} limit 1`;
    let deviceId = existingDevice[0]?.id;
    if (!deviceId) {
      const [row] = await sql`
        insert into fleet.device
          (organization_id, identifier, model, firmware, sim, status, last_health_at)
        values
          (${org}, ${identifier}, 'Teltonika FMB920', '1.4.2',
           ${'8971500000' + String(1000 + i)}, 'Active', now())
        returning id`;
      deviceId = row.id;
      devices += 1;
    }

    // Active pairing (open one only if none is active).
    const activePair = await sql`
      select id from fleet.device_pairing
      where vehicle_id = ${v.id} and valid_to is null limit 1`;
    if (activePair.length === 0) {
      await sql`
        insert into fleet.device_pairing
          (organization_id, device_id, vehicle_id, valid_from)
        values (${org}, ${deviceId}, ${v.id}, now())`;
    }

    // Recent telemetry: six points ~30s apart; the last is "now" (→ online).
    const baseOdo = Number(v.last_confirmed_odometer ?? 50_000) + i * 1_000;
    const lat0 = AD.lat + (i % 4) * 0.012 - 0.018;
    const lon0 = AD.lon + Math.floor(i / 4) * 0.012 - 0.018;
    for (let k = 5; k >= 0; k -= 1) {
      const time = new Date(Date.now() - k * 30_000);
      const lat = lat0 + (5 - k) * 0.0009;
      const lon = lon0 + (5 - k) * 0.0007;
      const speed = k === 0 ? 0 : 38 + k * 2;
      const fuel = Number((0.82 - (5 - k) * 0.028).toFixed(3));
      const odometer = baseOdo + (5 - k) * 2;
      await sql`
        insert into fleet.telemetry
          (time, vehicle_id, device_id, lat, lon, speed, ignition, odometer, fuel_level, device_health)
        values
          (${time}, ${v.id}, ${identifier}, ${lat}, ${lon}, ${speed}, ${k !== 0},
           ${odometer}, ${fuel}, ${sql.json({ batteryPct: 92 - i, gsm: 'good' })})`;
      points += 1;
    }
    // Telematics is the odometer system of record — reflect the latest reading.
    await sql`
      update fleet.vehicle
      set last_confirmed_odometer = ${baseOdo + 10}, updated_at_utc = now()
      where id = ${v.id}`;

    // Compliance documents (v1 per type, idempotent).
    for (const [docType, expiry] of DOC_TYPES) {
      const existingDoc = await sql`
        select id from fleet.vehicle_document
        where vehicle_id = ${v.id} and doc_type_code = ${docType} limit 1`;
      if (existingDoc.length === 0) {
        await sql`
          insert into fleet.vehicle_document
            (vehicle_id, doc_type_code, issue_date, expiry_date, blob_ref, version)
          values
            (${v.id}, ${docType}, '2025-01-15', ${expiry},
             ${`https://vault.example/${v.id}/${docType}.pdf`}, 1)`;
        docs += 1;
      }
    }

    // One completed trip (idempotent per vehicle).
    const tripExists =
      await sql`select id from fleet.trip where vehicle_id = ${v.id} limit 1`;
    if (tripExists.length === 0) {
      await sql`
        insert into fleet.trip
          (organization_id, vehicle_id, device_id, attribution_basis,
           started_at, ended_at, distance_km, start_odometer, end_odometer)
        values
          (${org}, ${v.id}, ${deviceId}, 'unattributed',
           ${new Date(Date.now() - 3_600_000)}, ${new Date(Date.now() - 1_800_000)},
           ${(20 + i).toFixed(2)}, ${baseOdo}, ${baseOdo + 20 + i})`;
      trips += 1;
    }

    // A couple of open alerts on the first two vehicles (idempotent).
    if (i < 2) {
      const openAlert = await sql`
        select id from fleet.telematics_alert
        where vehicle_id = ${v.id} and acknowledged_at is null limit 1`;
      if (openAlert.length === 0) {
        await sql`
          insert into fleet.telematics_alert
            (organization_id, vehicle_id, device_id, alert_type, detail)
          values
            (${org}, ${v.id}, ${deviceId}, ${i === 0 ? 'DeviceSilent' : 'Unplug'},
             'Demo alert seeded for the Activity tab.')`;
        alerts += 1;
      }
    }
  }

  console.log(
    `Seeded telematics for ${vehicles.length} vehicles: ` +
      `${devices} new devices, ${points} telemetry points, ${docs} documents, ` +
      `${trips} trips, ${alerts} alerts.`,
  );
  await sql.end();
}

main().catch(async (error) => {
  console.error(error);
  await sql.end().catch(() => {});
  process.exit(1);
});
