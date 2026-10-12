import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import type { PrismaService } from '../../src/common/tenancy/prisma.service';
import { TenantContext, type TenantContextData } from '../../src/common/tenancy/tenant-context';
import { PERMISSIONS } from '../../src/contracts/permissions';
import { CustomersRepository } from '../../src/modules/customers/customers.repository';
import { OrganisationsService } from '../../src/modules/organisations/organisations.service';

describe('organisation directory browsing', () => {
  let database: PrismaClient;
  let owner: PrismaClient;
  let service: OrganisationsService;
  let instance: string;
  const context = new TenantContext();

  const staff = (): TenantContextData => ({
    userId: '7c9e1a44-0000-4000-8000-0000000000d0',
    customerGroupId: null,
    isInternal: true,
    accountIds: [],
    permissions: new Set([PERMISSIONS.ADMIN_ORGANISATIONS_LINK]),
    correlationId: `dir-${randomUUID()}`,
  });

  beforeAll(async () => {
    database = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 }),
    });
    owner = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_MIGRATION_URL, connectionTimeoutMillis: 5000 }),
    });
    await database.$connect();
    await owner.$connect();
    // The importer is never exercised by these browse tests, so a stub keeps the
    // suite free of HTTP and configuration.
    const imports = { run: async () => { throw new Error('not used in browse tests'); } } as never;
    service = new OrganisationsService(new CustomersRepository(database as PrismaService, context), context, imports);
  });

  beforeEach(() => { instance = `DIR-${randomUUID().slice(0, 8)}`; });

  afterEach(async () => {
    await owner.$executeRaw`DELETE FROM master_org WHERE source_instance LIKE 'DIR-%'`;
    await owner.$executeRaw`DELETE FROM org_import_run WHERE source_instance LIKE 'DIR-%'`;
  });

  afterAll(async () => {
    await database?.$disconnect();
    await owner?.$disconnect();
  });

  async function seed(code: string, kind: 'file' | 'manual' = 'file') {
    const [run] = await owner.$queryRaw<{ id: string }[]>`
      INSERT INTO org_import_run (source_kind, source_instance, mode, file_name)
      VALUES (${kind}::org_source_kind, ${instance}, 'delta', 'directory-test.csv') RETURNING id`;
    await owner.$queryRaw`
      SELECT app.apply_organisation_batch(${run!.id}::uuid, ${JSON.stringify([
        { sourceCode: code, name: `${code} Directory SA`, countryCode: 'ES', city: 'Valencia', category: 'CUS', roles: ['IsConsignee'] },
      ])}::jsonb)`;
    const [row] = await owner.$queryRaw<{ id: string }[]>`
      SELECT id FROM master_org WHERE source_instance = ${instance} AND code_norm = lower(${code})`;
    return row!.id;
  }

  const list = (overrides: Partial<Parameters<OrganisationsService['list']>[0]> = {}) =>
    context.run(staff(), () =>
      service.list({ status: 'all', provenance: 'all', linked: 'all', page: 1, pageSize: 25, search: instance ? undefined : undefined, ...overrides }),
    );

  it('lists an imported organisation with its provenance and address count', async () => {
    await seed('DIRLIST1');
    const result = await list({ search: 'DIRLIST1' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      sourceCode: 'DIRLIST1',
      sourceKind: 'file',
      isSourceConfirmed: true,
      linkedCustomerName: null,
      category: 'CUS',
    });
  });

  it('separates provisional rows from confirmed ones', async () => {
    await seed('DIRCONF1', 'file');
    await seed('DIRPROV1', 'manual');

    const confirmed = await list({ search: 'DIRCONF1', provenance: 'confirmed' });
    expect(confirmed.items.map((item) => item.sourceCode)).toEqual(['DIRCONF1']);

    const provisional = await list({ search: 'DIRPROV1', provenance: 'provisional' });
    expect(provisional.items.map((item) => item.sourceCode)).toEqual(['DIRPROV1']);
    expect(provisional.items[0]!.isSourceConfirmed).toBe(false);
  });

  it('filters to organisations no customer holds', async () => {
    await seed('DIRFREE1');
    const result = await list({ search: 'DIRFREE1', linked: 'unlinked' });
    expect(result.items.map((item) => item.sourceCode)).toEqual(['DIRFREE1']);
  });

  it('returns addresses, identifiers and history on the detail', async () => {
    const orgId = await seed('DIRDET01');
    await owner.$executeRaw`
      INSERT INTO org_address (org_id, source_address_code, purposes, is_primary, address_line_1, city, country_code, related_port_code)
      VALUES (${orgId}::uuid, 'VLC-HO', ARRAY['HDO','BIL']::text[], true, 'Calle Mayor 1', 'Valencia', 'ES', 'ESVLC')`;
    await owner.$executeRaw`
      INSERT INTO org_registration_id (org_id, scheme, scheme_description, value, jurisdiction, is_country_default)
      VALUES (${orgId}::uuid, 'VAT', 'VAT registration', 'ESB12345678', 'ES', true)`;

    const detail = await context.run(staff(), () => service.detail(orgId));
    expect(detail.addressList).toHaveLength(1);
    // Address types are resolved through the lookup catalogue, so each purpose carries
    // its code and a label. An unmapped code shows null rather than a guessed meaning.
    expect(detail.addressList[0]).toMatchObject({
      sourceAddressCode: 'VLC-HO',
      purposes: [
        { code: 'HDO', label: null },
        { code: 'BIL', label: null },
      ],
      relatedPortCode: 'ESVLC',
      isPrimary: true,
    });
    expect(detail.registrations[0]).toMatchObject({ scheme: 'VAT', value: 'ESB12345678', isCountryDefault: true });
    // The import that created it is recorded, with the file it came from.
    expect(detail.history[0]).toMatchObject({ changeType: 'created', runKind: 'file', runFileName: 'directory-test.csv' });
  });

  it('refuses a caller without the organisations permission', async () => {
    const caller: TenantContextData = { ...staff(), permissions: new Set() };
    await expect(context.run(caller, () => service.list({ status: 'all', provenance: 'all', linked: 'all', page: 1, pageSize: 25 })))
      .rejects.toThrow('Internal staff permission required.');
  });

  it('refuses a customer context outright', async () => {
    const caller: TenantContextData = { ...staff(), isInternal: false, customerGroupId: randomUUID() };
    await expect(context.run(caller, () => service.list({ status: 'all', provenance: 'all', linked: 'all', page: 1, pageSize: 25 })))
      .rejects.toThrow('Internal staff permission required.');
  });
});
