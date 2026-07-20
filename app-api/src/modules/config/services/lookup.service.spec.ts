import type { LookupCacheService } from './lookup-cache.service';
import type { LookupRepository } from '../repositories/lookup.repository';
import type { AuditService } from '../../platform/services/audit.service';
import type { LookupValueDto } from '../../../contracts/lookup.contract';
import type { LookupUsageService } from './lookup-usage.service';
import { LookupService, deriveLookupStatus } from './lookup.service';

const TYPE = { id: 't1', code: 'fuel-type', labelEn: 'Fuel', labelAr: 'وقود', isHierarchical: false };

function row(id: string, code: string, parentId: string | null = null, sortOrder = 0) {
  return {
    id,
    code,
    labelEn: code,
    labelAr: code,
    descriptionEn: null,
    descriptionAr: null,
    parentId,
    sortOrder,
    isActive: true,
    validTo: null,
    lookupTypeId: 't1',
  };
}

class FakeCache {
  store = new Map<string, LookupValueDto[]>();
  invalidated: string[] = [];
  get = async (code: string) => this.store.get(code) ?? null;
  set = async (code: string, values: LookupValueDto[]) => {
    this.store.set(code, values);
  };
  invalidate = async (code: string) => {
    this.invalidated.push(code);
    this.store.delete(code);
  };
}

class FakeRepo {
  values = [row('v1', 'PETROL', null, 0), row('v2', 'DIESEL', null, 1)];
  listCalls = 0;
  findType = async (code: string) => (code === 'fuel-type' ? { ...TYPE } : undefined);
  listTypes = async () => [{ ...TYPE }];
  listActiveValues = async () => {
    this.listCalls += 1;
    return this.values;
  };
  findValueByCode = async (_t: string, code: string) => this.values.find((v) => v.code === code);
  findValueById = async (id: string) => this.values.find((v) => v.id === id);
  insertValue = async (values: Record<string, unknown>) => row(String(values.code), String(values.code));
  updateValue = async (id: string, set: Record<string, unknown>) => ({ ...row(id, 'PETROL'), ...set });
}

function make() {
  const repo = new FakeRepo();
  const cache = new FakeCache();
  const audit = { record: async () => {} };
  const usage = { countsByCode: async () => new Map<string, number>(), isTracked: () => false };
  const service = new LookupService(
    repo as unknown as LookupRepository,
    cache as unknown as LookupCacheService,
    audit as unknown as AuditService,
    usage as unknown as LookupUsageService,
  );
  return { service, repo, cache };
}

describe('LookupService', () => {
  it('reads values through the DB on a cache miss and caches them', async () => {
    const { service, repo, cache } = make();
    const values = await service.getValues('fuel-type');
    expect(values.map((v) => v.code)).toEqual(['PETROL', 'DIESEL']);
    expect(repo.listCalls).toBe(1);
    expect(cache.store.has('fuel-type')).toBe(true);
  });

  it('serves a cache hit without touching the DB', async () => {
    const { service, repo, cache } = make();
    cache.store.set('fuel-type', [
      { id: 'c', code: 'CACHED', labelEn: 'c', labelAr: 'c', descriptionEn: null, descriptionAr: null, parentId: null, sortOrder: 0 },
    ]);
    const values = await service.getValues('fuel-type');
    expect(values[0].code).toBe('CACHED');
    expect(repo.listCalls).toBe(0);
  });

  it('rejects a duplicate value code', async () => {
    const { service } = make();
    await expect(
      service.createValue('fuel-type', { code: 'PETROL', labelEn: 'Petrol', labelAr: 'بنزين' }),
    ).rejects.toThrow();
  });

  it('creates a value and invalidates the cache', async () => {
    const { service, cache } = make();
    await service.createValue('fuel-type', { code: 'EV', labelEn: 'Electric', labelAr: 'كهرباء' });
    expect(cache.invalidated).toContain('fuel-type');
  });

  it('throws for an unknown lookup type', async () => {
    const { service } = make();
    await expect(service.getValues('does-not-exist')).rejects.toThrow();
  });
});

describe('deriveLookupStatus', () => {
  it('is Inactive when not active (regardless of retiring)', () => {
    expect(deriveLookupStatus(false, false)).toBe('Inactive');
    expect(deriveLookupStatus(false, true)).toBe('Inactive');
  });

  it('is Retiring when active and retiring', () => {
    expect(deriveLookupStatus(true, true)).toBe('Retiring');
  });

  it('is Active when active and not retiring', () => {
    expect(deriveLookupStatus(true, false)).toBe('Active');
  });
});
