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
const authHeaders = { 'x-dev-person-id': admin.personId };
const jsonHeaders = { ...authHeaders, 'content-type': 'application/json' };
const workspace = await request(`/admin/policies/${ruleType}`, { headers: authHeaders });
const rowId = 'development-active-with-professional-driver';
const alreadyActive = workspace.active?.rows?.some((row) => row.id === rowId);
if (alreadyActive) {
  console.log(`${ruleType}: ${workspace.active.version} already enables governed WithDriver development requests.`);
}
const resumableDraft = !alreadyActive && workspace.draft?.table?.version === 'development-dedicated-eligibility-v2' &&
  workspace.draft.table.rows?.some((row) => row.id === rowId);
if (!alreadyActive && workspace.draft && !resumableDraft) {
  throw new Error(`Refusing to overwrite Policy Studio draft revision ${workspace.draft.revision}`);
}
if (!alreadyActive && !workspace.active) throw new Error(`${ruleType} has no active baseline to extend`);

const table = !alreadyActive ? {
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
} : null;
if (!alreadyActive && !resumableDraft) {
  await request(`/admin/policies/${ruleType}/draft`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ expectedRevision: 0, scopeNodeId: null, table }),
  });
}
if (!alreadyActive) {
  const activated = await request(`/admin/policies/${ruleType}/activate`, { method: 'POST', headers: authHeaders });
  console.log(`${activated.ruleType}: ${activated.version} ${activated.status}`);
}
