import fs from 'node:fs/promises';
import openapiTS, { astToString } from 'openapi-typescript';
import { generateStaffForm } from './generate-staff-form.mjs';

const source = process.argv[2] ?? 'http://127.0.0.1:43000/api/docs-json';
let document;
if (source === '--offline') {
  document = JSON.parse(await fs.readFile(new URL('../../noatum-customer-portal-api/openapi.json', import.meta.url), 'utf8'));
} else {
  const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`OpenAPI request failed with HTTP ${response.status}`);
  document = await response.json();
}

const form = generateStaffForm(document);
const types = astToString(await openapiTS(document));
const directory = new URL('../src/api/generated/', import.meta.url);
await fs.mkdir(directory, { recursive: true });
await fs.writeFile(new URL('schema.d.ts', directory), types);
await fs.writeFile(new URL('staff-role-form.ts', directory), form);
console.log('Generated API types and staff form schema from the same OpenAPI document.');
