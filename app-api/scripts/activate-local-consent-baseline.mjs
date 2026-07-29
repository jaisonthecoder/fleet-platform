#!/usr/bin/env node
import postgres from 'postgres';

const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3003/api/v1';

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, options);
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${body.title ?? response.statusText}: ${(body.reasons ?? []).join(', ')}`);
  return body;
}

const users = await request('/dev/users');
const steward = users.find((user) => user.roles.some(({ role }) => role === 'DataSteward'));
const admin = users.find((user) => user.roles.some(({ role }) => role === 'SystemAdmin'));
if (!steward || !admin) throw new Error('Seeded DataSteward and SystemAdmin are required');

const effectiveAtUtc = new Date(Date.now() - 60_000).toISOString();
const templates = [
  {
    domain: 'Booking',
    version: 'booking-operational-ack-v3',
    effectiveAtUtc,
    content: {
      en: 'I confirm that the trip details and assigned vehicle are correct. I will follow fleet safety rules, protect the vehicle and keys while in my custody, report incidents or damage promptly, use the vehicle only for the approved journey, and return it at the agreed time and location.',
      ar: 'أؤكد صحة تفاصيل الرحلة والمركبة المخصصة. سألتزم بقواعد سلامة الأسطول، وأحافظ على المركبة والمفاتيح أثناء عهدتي، وأبلغ فوراً عن أي حادث أو ضرر، وأستخدم المركبة للرحلة المعتمدة فقط، وأعيدها في الوقت والمكان المتفق عليهما.',
    },
  },
  {
    domain: 'DedicatedVehicle',
    version: 'dedicated-operational-ack-v3',
    effectiveAtUtc,
    content: {
      en: 'I accept custody of the assigned Dedicated Vehicle for the approved effective period. I will follow fleet safety and usage rules, protect the vehicle and keys, report incidents, fines, damage or changes promptly, cooperate with Pool-return windows, and return the vehicle when the allocation ends.',
      ar: 'أوافق على عهدة المركبة المخصصة خلال فترة السريان المعتمدة. سألتزم بقواعد السلامة والاستخدام الخاصة بالأسطول، وأحافظ على المركبة والمفاتيح، وأبلغ فوراً عن الحوادث أو المخالفات أو الأضرار أو التغييرات، وأتعاون مع نوافذ الإرجاع إلى المجمع، وأعيد المركبة عند انتهاء التخصيص.',
    },
  },
];

const authorHeaders = { 'x-dev-person-id': steward.personId, 'content-type': 'application/json' };
const activateHeaders = { 'x-dev-person-id': admin.personId };
for (const template of templates) {
  const versions = await request(`/admin/consents?domain=${template.domain}`, { headers: authorHeaders });
  let target = versions.find(({ version }) => version === template.version);
  if (!target) target = await request('/admin/consents', { method: 'POST', headers: authorHeaders, body: JSON.stringify(template) });
  if (target.status === 'Draft') target = await request(`/admin/consents/${target.id}/activate`, { method: 'POST', headers: activateHeaders });
  console.log(`${target.domain}: ${target.version} ${target.status} ${target.contentHash}`);
}

const invalidSetupVersions = [
  'booking-operational-ack-v1',
  'booking-operational-ack-v2',
  'dedicated-operational-ack-v1',
  'dedicated-operational-ack-v2',
];
if (process.env.DATABASE_URL) {
  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
  try {
    const usage = await sql`
      SELECT consent_document_version AS version FROM fleet.consent_record
      WHERE consent_document_version IN ${sql(invalidSetupVersions)}
      UNION
      SELECT consent_document_version AS version FROM fleet.entitlement_request
      WHERE consent_document_version IN ${sql(invalidSetupVersions)}
    `;
    const referenced = new Set(usage.map(({ version }) => version));
    const removable = invalidSetupVersions.filter((version) => !referenced.has(version));
    if (removable.length) {
      await sql`DELETE FROM fleet.consent_template WHERE status = 'Retired' AND version IN ${sql(removable)}`;
      console.log(`Removed ${removable.length} unreferenced encoding-error setup version(s).`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}
