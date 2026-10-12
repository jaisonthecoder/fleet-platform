/**
 * Sample organisation directory, seeded through the same door an import uses.
 *
 *   pnpm db:seed:orgs
 *
 * Nothing here is real Noatum or customer data. Codes and addresses are
 * fictional. The point is to make the directory visible and to exercise the link
 * gate with realistic shapes before any CargoWise feed exists.
 *
 * The column set mirrors the actual CargoWise NativeOrganization schema:
 *   OrgHeader             Code (12), FullName (100), Category (3), IsActive
 *   OrgAddress            Code (25), Address1/2 (50), City (50), State (25),
 *                         PostCode (10), CountryCode (2), RelatedPortCode (5)
 *   OrgAddressCapability  AddressType (3) + IsMainAddress  <- address purposes
 *   OrgCusCode            CustomsRegNo (254) + CodeType (3) + CodeCountry (2)
 *
 * Follows the seed-dev-users convention: generate SQL and pipe it through psql
 * in the compose container. Scripts under infra/ are outside the workspaces, so
 * they cannot import the Prisma client.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = fileURLToPath(new URL('../../', import.meta.url));
const env = parseEnv(
  readFileSync(new URL('../../apps/noatum-customer-portal-api/.env.local', import.meta.url), 'utf8'),
);
const owner = new URL(env.DATABASE_MIGRATION_URL);
const database = decodeURIComponent(owner.pathname.slice(1));
const ownerUser = decodeURIComponent(owner.username);

const INSTANCE = 'CW1-DEMO';
const SOURCE_RUN = '1f0a5c62-0000-4000-8000-00000000f11e';
const MANUAL_RUN = '1f0a5c62-0000-4000-8000-00000000a11a';

const ORGANISATIONS = [
  { code: 'ACMEIB001', name: 'Acme Iberica SA', legalName: 'Acme Iberica Sociedad Anonima',
    country: 'ES', city: 'Coslada', state: 'Madrid', postcode: '28821', category: 'CUS',
    roles: ['IsConsignor', 'IsTransportClient'], branchCode: 'MAD',
    addresses: [
      { code: 'MAD-HO', types: ['HDO', 'BIL'], main: true, line1: 'Avenida de Italia 2', city: 'Coslada', state: 'Madrid', postcode: '28821', country: 'ES', port: 'ESMAD', email: 'operations@acme-iberica.example', phone: '+34 91 000 0000' },
      { code: 'VLC-WH', types: ['DLV', 'PKP'], main: false, companyName: 'Acme Iberica Warehouse', line1: 'Poligono Fuente del Jarro', city: 'Valencia', state: 'Valencia', postcode: '46988', country: 'ES', port: 'ESVLC' },
    ],
    registrations: [
      { scheme: 'VAT', description: 'VAT registration', value: 'ESA12345674', jurisdiction: 'ES', countryDefault: true },
      { scheme: 'EOR', description: 'EORI number', value: 'ESA12345674', jurisdiction: 'ES' },
    ] },

  { code: 'ACMEDE001', name: 'Acme Deutschland GmbH', legalName: 'Acme Deutschland GmbH',
    country: 'DE', city: 'Hamburg', state: null, postcode: '20457', category: 'CUS',
    roles: ['IsConsignee', 'IsTransportClient'], branchCode: 'HAM',
    addresses: [{ code: 'HAM-HO', types: ['HDO', 'BIL'], main: true, line1: 'Grosser Grasbrook 9', city: 'Hamburg', state: null, postcode: '20457', country: 'DE', port: 'DEHAM' }],
    registrations: [{ scheme: 'VAT', description: 'VAT registration', value: 'DE123456789', jurisdiction: 'DE', countryDefault: true }] },

  { code: 'MERIDIAN01', name: 'Meridian Foods Ltd', legalName: 'Meridian Foods Limited',
    country: 'GB', city: 'Felixstowe', state: 'Suffolk', postcode: 'IP11 3SY', category: 'CUS',
    roles: ['IsConsignee'],
    addresses: [
      { code: 'FXT-HO', types: ['HDO'], main: true, line1: 'Dock Road', city: 'Felixstowe', state: 'Suffolk', postcode: 'IP11 3SY', country: 'GB', port: 'GBFXT' },
      { code: 'FXT-AC', types: ['BIL'], main: false, companyName: 'Meridian Foods Accounts', line1: 'Accounts Payable PO Box 114', city: 'Ipswich', state: 'Suffolk', postcode: 'IP1 2AA', country: 'GB' },
    ],
    registrations: [{ scheme: 'VAT', description: 'VAT registration', value: 'GB123456789', jurisdiction: 'GB', countryDefault: true }] },

  { code: 'GULFPET001', name: 'Gulf Petrochem Trading LLC', legalName: 'Gulf Petrochem Trading LLC',
    country: 'AE', city: 'Abu Dhabi', state: 'Abu Dhabi', postcode: null, category: 'CUS',
    roles: ['IsConsignor', 'IsGlobalAccount'], branchCode: 'AUH',
    addresses: [{ code: 'KHL-HO', types: ['HDO', 'BIL', 'PKP'], main: true, line1: 'Khalifa Industrial Zone', city: 'Abu Dhabi', state: null, postcode: null, country: 'AE', port: 'AEKHL' }],
    registrations: [{ scheme: 'TRN', description: 'Tax registration number', value: '100123456700003', jurisdiction: 'AE', countryDefault: true }] },

  { code: 'NORDICM001', name: 'Nordic Machinery AS', legalName: 'Nordic Machinery AS',
    country: 'NO', city: 'Oslo', state: null, postcode: '0154', category: 'CUS',
    roles: ['IsConsignor'],
    addresses: [{ code: 'OSL-HO', types: ['HDO'], main: true, line1: 'Radhusgata 23', city: 'Oslo', state: null, postcode: '0154', country: 'NO', port: 'NOOSL' }],
    registrations: [{ scheme: 'ORG', description: 'Organisation number', value: '912345678', jurisdiction: 'NO', countryDefault: true }] },

  { code: 'PACIFICT01', name: 'Pacific Textiles Co Ltd', legalName: 'Pacific Textiles Company Limited',
    country: 'CN', city: 'Shanghai', state: 'Shanghai', postcode: '200120', category: 'CUS',
    roles: ['IsConsignor'],
    addresses: [
      { code: 'SHA-HO', types: ['HDO'], main: true, line1: '1200 Century Avenue', city: 'Shanghai', state: 'Shanghai', postcode: '200120', country: 'CN', port: 'CNSHA' },
      { code: 'NGB-FY', types: ['PKP'], main: false, companyName: 'Pacific Textiles Ningbo Mill', line1: 'Beilun Industrial Park', city: 'Ningbo', state: 'Zhejiang', postcode: null, country: 'CN', port: 'CNNGB' },
    ],
    registrations: [{ scheme: 'USC', description: 'Unified social credit code', value: '91310000MA1FL0000X', jurisdiction: 'CN', countryDefault: true }] },

  { code: 'ATLASLOG01', name: 'Atlas Logistics Inc', legalName: 'Atlas Logistics Incorporated',
    country: 'US', city: 'Compton', state: 'CA', postcode: '90220', category: 'CUS',
    roles: ['IsTransportClient', 'IsNationalAccount'], branchCode: 'LAX',
    addresses: [{ code: 'LAX-HO', types: ['HDO', 'BIL'], main: true, line1: '2100 East Alondra Boulevard', city: 'Compton', state: 'CA', postcode: '90220', country: 'US', port: 'USLAX' }],
    registrations: [{ scheme: 'EIN', description: 'Employer identification number', value: '12-3456789', jurisdiction: 'US', countryDefault: true }] },

  // Same commercial group as ATLASLOG01. CargoWise has no hierarchy function, so
  // this is a separate organisation; ControllingCustomer is evidence only and
  // grants the controlling customer no sight of this one's cargo.
  { code: 'ATLASLOGMX', name: 'Atlas Logistics Mexico S de RL', legalName: 'Atlas Logistics Mexico S de RL de CV',
    country: 'MX', city: 'Monterrey', state: 'Nuevo Leon', postcode: '64000', category: 'CUS',
    roles: ['IsTransportClient'], controllingCustomerCode: 'ATLASLOG01',
    addresses: [{ code: 'MTY-HO', types: ['HDO'], main: true, line1: 'Avenida Constitucion 100', city: 'Monterrey', state: 'Nuevo Leon', postcode: '64000', country: 'MX', port: 'MXMTY' }],
    registrations: [{ scheme: 'RFC', description: 'Registro Federal de Contribuyentes', value: 'ALM010101AB1', jurisdiction: 'MX', countryDefault: true }] },

  { code: 'HELLENIC01', name: 'Hellenic Marble Exports SA', legalName: 'Hellenic Marble Exports SA',
    country: 'GR', city: 'Piraeus', state: null, postcode: '18538', category: 'CUS',
    roles: ['IsConsignor'],
    addresses: [{ code: 'PIR-HO', types: ['HDO'], main: true, line1: 'Akti Miaouli 45', city: 'Piraeus', state: null, postcode: '18538', country: 'GR', port: 'GRPIR' }],
    registrations: [{ scheme: 'VAT', description: 'VAT registration', value: 'EL123456789', jurisdiction: 'GR', countryDefault: true }] },

  { code: 'CARRIER001', name: 'Iberian Container Line SA', legalName: 'Iberian Container Line SA',
    country: 'ES', city: 'Barcelona', state: 'Barcelona', postcode: '08039', category: 'CAR',
    roles: ['IsShippingLine', 'IsShippingProvider'], isCustomer: false, isSupplier: true,
    addresses: [{ code: 'BCN-HO', types: ['HDO'], main: true, line1: 'Moll de Barcelona', city: 'Barcelona', state: 'Barcelona', postcode: '08039', country: 'ES', port: 'ESBCN' }],
    registrations: [] },

  { code: 'AGENTVN001', name: 'Saigon Freight Services JSC', legalName: 'Saigon Freight Services Joint Stock Company',
    country: 'VN', city: 'Ho Chi Minh City', state: null, postcode: null, category: 'AGT',
    roles: ['IsForwarder', 'IsControllingAgent'], isCustomer: false, isSupplier: true,
    addresses: [{ code: 'SGN-HO', types: ['HDO'], main: true, line1: '15 Nguyen Hue', city: 'Ho Chi Minh City', state: null, postcode: null, country: 'VN', port: 'VNSGN' }],
    registrations: [] },

  { code: 'DORMANT001', name: 'Costa Verde Produce SL', legalName: 'Costa Verde Produce SL',
    country: 'ES', city: 'Almeria', state: 'Almeria', postcode: '04001', category: 'CUS',
    roles: ['IsConsignor'], deactivate: true,
    addresses: [{ code: 'LEI-HO', types: ['HDO'], main: true, line1: 'Calle Real 12', city: 'Almeria', state: 'Almeria', postcode: '04001', country: 'ES', port: 'ESALM' }],
    registrations: [{ scheme: 'VAT', description: 'VAT registration', value: 'ESB04123456', jurisdiction: 'ES', countryDefault: true }] },
];

/** Typed by an operator, unconfirmed by any source: provisional and unlinkable. */
const MANUAL = [
  { code: 'NEWLEAD001', name: 'Levante Ceramics SL', legalName: null,
    country: 'ES', city: 'Castellon', state: 'Castellon', postcode: '12003', category: 'CUS',
    roles: [], addresses: [], registrations: [] },
];

/**
 * Demo customers. A customer is PORTAL-OWNED and created independently of the
 * directory - it may be typed in the portal or imported from a non-CargoWise
 * source. Linking then attaches organisations to it, one customer holding many.
 *
 * Atlas shows the two things the mockups add: a customer hierarchy (parent and
 * child are separate customers) and a link that is still pending approval.
 */
const CUSTOMERS = [
  { slug: 'demo-acme', name: 'Acme Group', legalName: 'Acme Group Holdings SL', country: 'ES',
    domains: ['acme-iberica.example', 'acme.example'], status: 'active', servicingBranch: 'ES-MAD',
    links: [
      { org: 'ACMEIB001', branch: 'ES-MAD', reason: 'Primary Spanish entity' },
      { org: 'ACMEDE001', branch: 'ES-MAD', reason: 'German sister company, same group' },
    ] },

  { slug: 'demo-meridian', name: 'Meridian Foods', legalName: 'Meridian Foods Limited', country: 'GB',
    domains: ['meridianfoods.example'], status: 'active', servicingBranch: 'ES-MAD',
    links: [{ org: 'MERIDIAN01', branch: 'ES-MAD', reason: 'Single trading entity' }] },

  { slug: 'demo-gulf', name: 'Gulf Petrochem', legalName: 'Gulf Petrochem Trading LLC', country: 'AE',
    domains: ['gulfpetrochem.example'], status: 'active', servicingBranch: null,
    links: [{ org: 'GULFPET001', branch: null, reason: 'Abu Dhabi operations' }] },

  { slug: 'demo-atlas', name: 'Atlas Logistics', legalName: 'Atlas Logistics Incorporated', country: 'US',
    domains: ['atlaslogistics.example'], status: 'active', servicingBranch: 'US-LAX',
    links: [{ org: 'ATLASLOG01', branch: 'US-LAX', reason: 'US parent entity' }] },

  { slug: 'demo-atlas-mx', name: 'Atlas Logistics Mexico', legalName: 'Atlas Logistics Mexico S de RL de CV',
    country: 'MX', domains: ['atlaslogistics.example'], status: 'draft', parent: 'demo-atlas',
    servicingBranch: 'US-HOU',
    // Still a draft customer: the link exists but the customer is not live, so
    // nothing is granted. That is the whole gate now - no separate approval.
    links: [{ org: 'ATLASLOGMX', branch: 'US-HOU', reason: 'Mexican entity of the same group' }] },
];

const quote = (value) => (value === null || value === undefined ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`);
const array = (values) => `ARRAY[${values.map(quote).join(', ')}]::text[]`;

const batchRow = (org) => ({
  sourceCode: org.code,
  name: org.name,
  legalName: org.legalName ?? null,
  category: org.category ?? null,
  roles: org.roles ?? [],
  countryCode: org.country ?? null,
  city: org.city ?? null,
  state: org.state ?? null,
  postcode: org.postcode ?? null,
  sourceBranchCode: org.branchCode ?? null,
  controllingCustomerCode: org.controllingCustomerCode ?? null,
  isCustomer: org.isCustomer ?? true,
  isSupplier: org.isSupplier ?? false,
  isActive: org.deactivate ? false : true,
});

const orgId = (code) =>
  `(SELECT id FROM master_org WHERE source_instance = ${quote(INSTANCE)} AND code_norm = lower(${quote(code)}))`;

const statements = [
  'BEGIN;',
  "SELECT set_config('app.is_internal', 'true', true);",
  `INSERT INTO org_import_run (id, source_kind, source_instance, mode, is_authoritative, file_name, outcome)
   VALUES (${quote(SOURCE_RUN)}, 'file', ${quote(INSTANCE)}, 'snapshot', true, 'demo-organisations.csv', 'running')
   ON CONFLICT (id) DO UPDATE SET outcome = 'running', finished_at = NULL;`,
  `SELECT app.apply_organisation_batch(${quote(SOURCE_RUN)}::uuid, ${quote(JSON.stringify(ORGANISATIONS.map(batchRow)))}::jsonb) AS source_run;`,
  `INSERT INTO org_import_run (id, source_kind, source_instance, mode, is_authoritative, outcome)
   VALUES (${quote(MANUAL_RUN)}, 'manual', ${quote(INSTANCE)}, 'delta', false, 'running')
   ON CONFLICT (id) DO UPDATE SET outcome = 'running', finished_at = NULL;`,
  `SELECT app.apply_organisation_batch(${quote(MANUAL_RUN)}::uuid, ${quote(JSON.stringify(MANUAL.map(batchRow)))}::jsonb) AS manual_run;`,
  `UPDATE org_import_run SET outcome = 'succeeded', finished_at = now()
   WHERE id IN (${quote(SOURCE_RUN)}, ${quote(MANUAL_RUN)});`,
  // Children are rebuilt on every run so the demo reflects the current columns.
  // Only ever touches the CW1-DEMO instance.
  `DELETE FROM org_registration_id WHERE org_id IN (SELECT id FROM master_org WHERE source_instance = ${quote(INSTANCE)});`,
  `DELETE FROM org_address WHERE org_id IN (SELECT id FROM master_org WHERE source_instance = ${quote(INSTANCE)});`,
];

// A real snapshot deactivates by absence; here it is explicit so the list shows
// an inactive row without pretending a partial file caused it.
for (const org of ORGANISATIONS.filter((entry) => entry.deactivate)) {
  statements.push(
    `UPDATE master_org SET is_active = false WHERE id = ${orgId(org.code)};`,
    `UPDATE org_address SET is_active = false WHERE org_id = ${orgId(org.code)};`,
  );
}

for (const org of [...ORGANISATIONS, ...MANUAL]) {
  for (const address of org.addresses) {
    const formatted = [address.line1, address.city, address.postcode, address.country].filter(Boolean).join(', ');
    statements.push(
      `INSERT INTO org_address (org_id, source_address_code, purposes, is_primary,
         company_name_override, address_line_1, city, state, postcode, country_code,
         related_port_code, email, phone, formatted, last_seen_at)
       VALUES (${orgId(org.code)}, ${quote(address.code)}, ${array(address.types)}, ${address.main},
         ${quote(address.companyName)}, ${quote(address.line1)}, ${quote(address.city)}, ${quote(address.state)},
         ${quote(address.postcode)}, ${quote(address.country)}, ${quote(address.port)},
         ${quote(address.email)}, ${quote(address.phone)}, ${quote(formatted)}, now())
       ON CONFLICT (org_id, source_address_code) DO NOTHING;`,
    );
  }
  for (const registration of org.registrations) {
    statements.push(
      `INSERT INTO org_registration_id (org_id, scheme, scheme_description, value, jurisdiction, is_country_default)
       VALUES (${orgId(org.code)}, ${quote(registration.scheme)}, ${quote(registration.description)},
         ${quote(registration.value)}, ${quote(registration.jurisdiction)}, ${registration.countryDefault ?? false})
       ON CONFLICT DO NOTHING;`,
    );
  }
}

const branchId = (code) => (code ? `(SELECT id FROM branch WHERE code = ${quote(code)})` : 'NULL');
const customerId = (slug) => `(SELECT id FROM customer_group WHERE slug = ${quote(slug)})`;

// Customers are rebuilt each run. Only ever touches the demo- slugs.
statements.push(
  `DELETE FROM customer_account WHERE customer_group_id IN (SELECT id FROM customer_group WHERE slug LIKE 'demo-%');`,
  `DELETE FROM customer_group WHERE slug LIKE 'demo-%';`,
);

for (const customer of CUSTOMERS.filter((entry) => !entry.parent)) {
  statements.push(customerInsert(customer));
}
for (const customer of CUSTOMERS.filter((entry) => entry.parent)) {
  statements.push(customerInsert(customer));
}

function customerInsert(customer) {
  return `INSERT INTO customer_group (name, legal_name, country_code, slug, email_domains, status,
            parent_id, default_servicing_branch_id, updated_at)
          VALUES (${quote(customer.name)}, ${quote(customer.legalName)}, ${quote(customer.country)},
            ${quote(customer.slug)}, ${array(customer.domains)}, ${quote(customer.status)}::customer_status,
            ${customer.parent ? customerId(customer.parent) : 'NULL'},
            ${branchId(customer.servicingBranch)}, now());`;
}

for (const customer of CUSTOMERS) {
  for (const link of customer.links) {
    statements.push(
      `INSERT INTO customer_account (customer_group_id, name, cw1_org_code, org_id,
         justification, linked_at, servicing_branch_id, country_code, is_active, updated_at)
       SELECT ${customerId(customer.slug)}, m.name, m.source_code, m.id,
         ${quote(link.reason)}, now(), ${branchId(link.branch)}, m.country_code,
         ${link.active ?? true}, now()
       FROM master_org m
       WHERE m.source_instance = ${quote(INSTANCE)} AND m.code_norm = lower(${quote(link.org)});`,
    );
  }
}

statements.push(
  `SELECT m.source_code AS code, m.name, m.category AS cat, m.country_code AS ctry,
          array_to_string(m.source_roles, ';') AS cw1_roles,
          CASE WHEN m.is_source_confirmed THEN 'confirmed' ELSE 'PROVISIONAL' END AS provenance,
          CASE WHEN m.is_active THEN 'active' ELSE 'inactive' END AS status,
          (SELECT count(*) FROM org_address a WHERE a.org_id = m.id) AS addr,
          (SELECT count(*) FROM org_registration_id r WHERE r.org_id = m.id) AS ids
   FROM master_org m WHERE m.source_instance = ${quote(INSTANCE)}
   ORDER BY m.is_source_confirmed DESC, m.source_code;`,
  `SELECT COALESCE(p.name, '-') AS parent_customer, c.name AS customer, c.status,
          a.cw1_org_code AS linked_org,
          CASE WHEN a.is_active THEN 'on' ELSE 'off' END AS link,
          COALESCE(b.code, '-') AS servicing
   FROM customer_group c
   LEFT JOIN customer_group p ON p.id = c.parent_id
   LEFT JOIN customer_account a ON a.customer_group_id = c.id
   LEFT JOIN branch b ON b.id = a.servicing_branch_id
   WHERE c.slug LIKE 'demo-%'
   ORDER BY COALESCE(p.name, c.name), c.name, a.cw1_org_code;`,
  'COMMIT;',
);

const result = spawnSync(
  'docker',
  ['compose', '-f', 'infra/docker-compose.yml', 'exec', '-T', 'postgres',
    'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', ownerUser, '-d', database],
  {
    cwd: root,
    env: {
      ...process.env,
      ...env,
      POSTGRES_USER: ownerUser,
      POSTGRES_PASSWORD: decodeURIComponent(owner.password),
      POSTGRES_DB: database,
      POSTGRES_PORT: owner.port || '5432',
    },
    input: `${statements.join('\n')}\n`,
    stdio: ['pipe', 'inherit', 'inherit'],
  },
);

if (result.status !== 0) {
  console.error('Organisation seed failed; the transaction was rolled back.');
  process.exitCode = 1;
} else {
  console.log('All organisations above are fictional. Source-run rows are confirmed and');
  console.log('therefore linkable; the manual row stays provisional and cannot be linked.');
}
