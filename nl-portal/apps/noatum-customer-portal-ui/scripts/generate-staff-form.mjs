import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
function toZod(schema) {
  // `nullable` is dropped by every branch below, so it is applied once here.
  // Without this a nullable DTO field generates a non-null form type and the
  // page that binds it stops compiling.
  const nullable = schema.nullable === true;
  const wrap = (expression) => (nullable ? `${expression}.nullable()` : expression);

  if (schema.type === 'array') {
    let expression = `z.array(${toZod(schema.items)})`;
    if (schema.maxItems !== undefined) expression += `.max(${schema.maxItems})`;
    if (schema.uniqueItems) expression += '.refine((values) => new Set(values).size === values.length)';
    return wrap(expression);
  }
  if (schema.enum) return wrap(`z.enum(${JSON.stringify(schema.enum)})`);
  if (schema.type === 'string') {
    let expression = schema.format === 'date-time' ? 'z.iso.datetime()' : 'z.string().trim()';
    if (schema.minLength !== undefined) expression += `.min(${schema.minLength})`;
    if (schema.maxLength !== undefined) expression += `.max(${schema.maxLength})`;
    return wrap(expression);
  }
  if (schema.type === 'boolean') return wrap('z.boolean()');
  if (schema.type === 'number' || schema.type === 'integer') return wrap('z.number()');
  throw new Error(`Unsupported form schema type: ${schema.type}`);
}
export function generateStaffForm(document) {
  const schema = document.components?.schemas?.StaffRoleUpdateDto;
  if (!schema?.properties || !Array.isArray(schema.required) || schema.required.length !== Object.keys(schema.properties).length || Object.keys(schema.properties).some((name) => !schema.required.includes(name))) throw new Error('Expected required staff role form properties');
  const fields = Object.entries(schema.properties).map(([name, value]) => `  ${JSON.stringify(name)}: ${toZod(value)},`).join('\n');
  return `// Generated from the API OpenAPI StaffRoleUpdateDto. Do not edit.\nimport { z } from 'zod';\n\nexport const staffRoleFormSchema = z.strictObject({\n${fields}\n});\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const document = JSON.parse(fs.readFileSync(path.resolve(directory, '../../noatum-customer-portal-api/openapi.json'), 'utf8'));
  fs.writeFileSync(path.resolve(directory, '../src/api/generated/staff-role-form.ts'), generateStaffForm(document));
  console.log('Generated staff form schema from OpenAPI.');
}
