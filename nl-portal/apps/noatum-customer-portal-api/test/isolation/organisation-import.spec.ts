import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { parseCsv, csvBoolean, csvList, requireColumns } from '../../src/integration/organisations/csv';

/**
 * The deactivation brake, against the real function.
 *
 * This is the one piece of the import that can revoke a live customer's access, so
 * it is tested at the database rather than through a mock.
 */
describe('organisation import brake', () => {
  let owner: PrismaClient;
  let instance: string;

  beforeAll(async () => {
    owner = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_MIGRATION_URL, connectionTimeoutMillis: 5000 }),
    });
    await owner.$connect();
  });

  beforeEach(() => { instance = `BRK-${randomUUID().slice(0, 8)}`; });

  afterEach(async () => {
    await owner.$executeRaw`DELETE FROM master_org WHERE source_instance = ${instance}`;
    await owner.$executeRaw`DELETE FROM org_import_run WHERE source_instance = ${instance}`;
  });

  afterAll(async () => { await owner?.$disconnect(); });

  /** Seeds `count` active organisations straight in, bypassing the batch writer. */
  async function seed(count: number) {
    for (let index = 0; index < count; index += 1) {
      const code = `BRK${String(index).padStart(4, '0')}`;
      await owner.$executeRaw`
        INSERT INTO master_org (source_code, source_system, source_instance, source_kind, name, is_active, is_source_confirmed, updated_at)
        VALUES (${code}, 'cw1', ${instance}, 'feed', ${'Org ' + code}, true, true, now())`;
    }
  }

  async function startRun(options: { authoritative?: boolean; mode?: 'snapshot' | 'delta' } = {}) {
    const [run] = await owner.$queryRaw<{ id: string }[]>`
      INSERT INTO org_import_run (source_kind, source_system, source_instance, mode, is_authoritative)
      VALUES ('feed', 'cw1', ${instance}, ${options.mode ?? 'snapshot'}::org_import_mode, ${options.authoritative ?? true})
      RETURNING id`;
    return run!.id;
  }

  const finalise = async (runId: string, seen: string[]) => {
    const [row] = await owner.$queryRaw<{ finalise_organisation_import: Record<string, unknown> }[]>`
      SELECT app.finalise_organisation_import(${runId}::uuid, ${seen}::text[])`;
    return row!.finalise_organisation_import;
  };

  const activeCount = async () => {
    const [row] = await owner.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) FROM master_org WHERE source_instance = ${instance} AND is_active`;
    return Number(row!.count);
  };

  it('refuses when an authoritative snapshot carries fewer than half the active rows', async () => {
    await seed(20);
    const runId = await startRun();
    const result = await finalise(runId, ['BRK0000', 'BRK0001', 'BRK0002']);

    expect(result).toMatchObject({ refused: 'snapshot-too-small', deactivated: 0, activeBefore: 20 });
    expect(await activeCount()).toBe(20);
  });

  it('deactivates at exactly half, so the boundary is a decision and not an accident', async () => {
    await seed(20);
    const runId = await startRun();
    const seen = Array.from({ length: 10 }, (_, index) => `BRK${String(index).padStart(4, '0')}`);
    const result = await finalise(runId, seen);

    expect(result).toMatchObject({ deactivated: 10 });
    expect(await activeCount()).toBe(10);
  });

  it('never empties a small directory when the snapshot is empty', async () => {
    await seed(4);
    const runId = await startRun();
    const result = await finalise(runId, []);

    expect(result).toMatchObject({ refused: 'snapshot-empty', deactivated: 0 });
    expect(await activeCount()).toBe(4);
  });

  it('refuses an empty snapshot at any size', async () => {
    await seed(30);
    const runId = await startRun();
    expect(await finalise(runId, [])).toMatchObject({ refused: 'snapshot-empty' });
    expect(await activeCount()).toBe(30);
  });

  it('skips a run that is not an authoritative snapshot', async () => {
    await seed(12);
    const additive = await startRun({ authoritative: false });
    expect(await finalise(additive, ['BRK0000'])).toMatchObject({ skipped: 'not-an-authoritative-snapshot' });

    const delta = await startRun({ mode: 'delta' });
    expect(await finalise(delta, ['BRK0000'])).toMatchObject({ skipped: 'not-an-authoritative-snapshot' });
    expect(await activeCount()).toBe(12);
  });

  it('deactivates without deleting, and records the change', async () => {
    await seed(12);
    const runId = await startRun();
    const seen = Array.from({ length: 11 }, (_, index) => `BRK${String(index).padStart(4, '0')}`);
    await finalise(runId, seen);

    const [row] = await owner.$queryRaw<{ id: string; is_active: boolean }[]>`
      SELECT id, is_active FROM master_org WHERE source_instance = ${instance} AND code_norm = 'brk0011'`;
    expect(row?.is_active).toBe(false);

    const [log] = await owner.$queryRaw<{ change_type: string }[]>`
      SELECT change_type FROM org_change_log WHERE org_id = ${row!.id}::uuid AND run_id = ${runId}::uuid`;
    expect(log?.change_type).toBe('deactivated');
  });

  it('refuses to finalise a run that has already finished', async () => {
    await seed(12);
    const runId = await startRun();
    await owner.$executeRaw`UPDATE org_import_run SET outcome = 'succeeded' WHERE id = ${runId}::uuid`;
    await expect(finalise(runId, ['BRK0000'])).rejects.toThrow(/already/);
  });

  it('matches codes case-insensitively, so a case variant is not treated as absent', async () => {
    await seed(12);
    const runId = await startRun();
    const seen = Array.from({ length: 12 }, (_, index) => `brk${String(index).padStart(4, '0')}`);
    expect(await finalise(runId, seen)).toMatchObject({ deactivated: 0 });
    expect(await activeCount()).toBe(12);
  });
});

describe('the organisation CSV reader', () => {
  it('reads quoted commas and doubled quotes', () => {
    const rows = parseCsv('org_code,full_name\r\n"A1","Acme, ""The"" Co"\r\n');
    expect(rows[0]).toEqual({ org_code: 'A1', full_name: 'Acme, "The" Co' });
  });

  it('strips a byte-order mark so the first column name still matches', () => {
    const rows = parseCsv('\uFEFForg_code,full_name\r\nA1,Acme\r\n');
    expect(rows[0]?.org_code).toBe('A1');
  });

  it('refuses an HTML error body, which parses as a file with no data rows', () => {
    const rows = parseCsv('<html><body>Sign in</body></html>');
    expect(() => requireColumns(rows, ['org_code', 'full_name'], 'organisations.csv')).toThrow(/no data rows/);
  });

  it('refuses a file whose columns are not the organisation export', () => {
    const rows = parseCsv('id,label\r\n1,something\r\n');
    expect(() => requireColumns(rows, ['org_code', 'full_name'], 'organisations.csv')).toThrow(/does not look like/);
  });

  it('refuses an export with no data rows rather than calling it an empty directory', () => {
    expect(() => requireColumns([], ['org_code'], 'organisations.csv')).toThrow(/no data rows/);
  });

  it('treats a missing boolean as the stated default', () => {
    expect(csvBoolean(undefined, true)).toBe(true);
    expect(csvBoolean('', true)).toBe(true);
    expect(csvBoolean('FALSE', true)).toBe(false);
    expect(csvBoolean('Y')).toBe(true);
  });

  it('splits semicolon lists and drops the gaps', () => {
    expect(csvList('IsShipper; IsConsignee ;;')).toEqual(['IsShipper', 'IsConsignee']);
    expect(csvList(undefined)).toEqual([]);
  });
});
