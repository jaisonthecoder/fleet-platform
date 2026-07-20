import {
  type ClassifyContext,
  classifyRow,
  completenessScore,
  normaliseRow,
  validateRowShape,
} from './validate-row';

const ctx = (over: Partial<ClassifyContext> = {}): ClassifyContext => ({
  bodyTypes: new Set(['SEDAN', 'BUS']),
  fuelTypes: new Set(['PETROL']),
  useCategories: new Set(['POOL']),
  existingPlates: new Set(['EXISTING-1']),
  existingVins: new Set(['VIN-EXISTING']),
  seenPlates: new Set(),
  seenVins: new Set(),
  ...over,
});

describe('normaliseRow', () => {
  it('reads camelCase and snake_case headers', () => {
    expect(normaliseRow({ plate: 'A1', chassis_vin: 'V1', body_type: 'SEDAN' })).toMatchObject({
      plate: 'A1',
      chassisVin: 'V1',
      bodyTypeCode: 'SEDAN',
    });
  });

  it('trims and coerces values', () => {
    expect(normaliseRow({ plate: '  A2 ', year: 2022 })).toMatchObject({ plate: 'A2', year: 2022 });
  });

  it('guards a non-numeric year to null (never NaN)', () => {
    expect(normaliseRow({ plate: 'A3', year: 'not-a-year' }).year).toBeNull();
    expect(normaliseRow({ plate: 'A4' }).year).toBeNull();
  });
});

describe('validateRowShape', () => {
  it('requires plate, chassisVin and bodyType', () => {
    expect(validateRowShape(normaliseRow({}))).toEqual({ ok: false, reason: 'missing-plate' });
    expect(validateRowShape(normaliseRow({ plate: 'A' }))).toEqual({ ok: false, reason: 'missing-chassis-vin' });
    expect(validateRowShape(normaliseRow({ plate: 'A', chassisVin: 'V' }))).toEqual({ ok: false, reason: 'missing-body-type' });
    expect(validateRowShape(normaliseRow({ plate: 'A', chassisVin: 'V', bodyTypeCode: 'SEDAN' })).ok).toBe(true);
  });
});

describe('classifyRow', () => {
  const good = { plate: 'NEW-1', chassisVin: 'VIN-NEW', bodyTypeCode: 'SEDAN', fuelTypeCode: 'PETROL' };

  it('marks a well-formed, unique, valid-lookup row Valid', () => {
    expect(classifyRow(normaliseRow(good), ctx())).toEqual({ status: 'Valid', reason: null });
  });

  it('marks a missing-field row Invalid', () => {
    expect(classifyRow(normaliseRow({ plate: 'X' }), ctx()).status).toBe('Invalid');
  });

  it('marks an unknown body-type Invalid', () => {
    expect(classifyRow(normaliseRow({ ...good, bodyTypeCode: 'ROCKET' }), ctx()).reason).toContain('invalid-body-type');
  });

  it('flags a plate that already exists in the master as Duplicate', () => {
    const c = classifyRow(normaliseRow({ ...good, plate: 'EXISTING-1' }), ctx());
    expect(c.status).toBe('Duplicate');
    expect(c.dedup).toMatchObject({ matchType: 'plate', existing: true });
  });

  it('flags a within-batch duplicate VIN', () => {
    const c = classifyRow(normaliseRow({ ...good, chassisVin: 'VIN-EXISTING' }), ctx());
    expect(c.status).toBe('Duplicate');
    expect(c.dedup).toMatchObject({ matchType: 'vin' });
  });
});

describe('completenessScore', () => {
  it('computes valid/total as a percentage', () => {
    expect(completenessScore(98, 100)).toBe(98);
    expect(completenessScore(1, 3)).toBe(33.33);
    expect(completenessScore(0, 0)).toBe(0);
  });
});
