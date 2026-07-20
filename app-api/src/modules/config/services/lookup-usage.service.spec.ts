import type { DrizzleDatabase } from '../../../common/database/database.module';
import { LookupUsageService } from './lookup-usage.service';

/** A db stub that fails if touched — unmapped types must never query. */
const failingDb = {
  select: () => {
    throw new Error('db should not be queried for unmapped types');
  },
} as unknown as DrizzleDatabase;

describe('LookupUsageService — vehicle-backed registry', () => {
  const service = new LookupUsageService(failingDb);

  it('tracks the five vehicle-backed lookup types', () => {
    for (const code of [
      'vehicle-body-type',
      'fuel-type',
      'use-category',
      'vehicle-make',
      'vehicle-model',
    ]) {
      expect(service.isTracked(code)).toBe(true);
    }
  });

  it('does not track unmapped types', () => {
    expect(service.isTracked('hierarchy-level')).toBe(false);
    expect(service.isTracked('random-type')).toBe(false);
  });

  it('returns an empty map for an unmapped type without touching the db', async () => {
    const counts = await service.countsByCode('not-vehicle-backed');
    expect(counts.size).toBe(0);
  });
});
