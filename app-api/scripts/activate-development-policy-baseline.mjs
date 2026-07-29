#!/usr/bin/env node
const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3003/api/v1';
const ruleType = 'dedicated-vehicle-eligibility';

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, options);
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${body.title ?? response.statusText}: ${(body.reasons ?? []).join(', ')}`);
  return body;
}

const users = await request('/dev/users');
const admin = users.find((user) => user.roles.some(({ role }) => role === 'SystemAdmin'));
if (!admin) throw new Error('A seeded SystemAdmin is required');
const headers = { 'x-dev-person-id': admin.personId, 'content-type': 'application/json' };
const workspace = await request(`/admin/policies/${ruleType}`, { headers });
const rowId = 'development-active-with-professional-driver';
if (workspace.active?.rows?.some((row) => row.id === rowId)) {
  console.log(`${ruleType}: ${workspace.active.version} already enables governed WithDriver development requests.`);
  process.exit(0);
}
if (workspace.draft) {
  throw new Error(`Refusing to overwrite Policy Studio draft revision ${workspace.draft.revision}`);
}
if (!workspace.active) throw new Error(`${ruleType} has no active baseline to extend`);

const table = {
  ...workspace.active,
  schemaVersion: 1,
  version: 'development-dedicated-eligibility-v2',
  rows: [
    {
      id: rowId,
      conditions: [
        { id: 'employment', fact: 'employmentStatus', operator: 'eq', value: 'Active' },
        { id: 'driver-option', fact: 'driverOption', operator: 'eq', value: 'WithDriver' },
        { id: 'duration', fact: 'durationDays', operator: 'lte', value: 365 },
      ],
      decision: 'ALLOW',
      reasons: ['dedicated-development-with-driver-eligible'],
      value: { permittedVehicleClasses: ['SEDAN', 'SUV'], maxDurationDays: 365 },
    },
    ...workspace.active.rows,
  ],
};
await request(`/admin/policies/${ruleType}/draft`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ expectedRevision: 0, scopeNodeId: null, table }),
});
const activated = await request(`/admin/policies/${ruleType}/activate`, { method: 'POST', headers });
console.log(`${activated.ruleType}: ${activated.version} ${activated.status}`);
