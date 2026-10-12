import { chargeableWeight } from './chargeable-weight';

describe('chargeableWeight', () => {
  it('uses gross weight when it exceeds the volumetric weight', () => {
    // 0.5 m3 of air freight is 83.335 kg volumetric, so the 200 kg actual wins.
    expect(chargeableWeight({ mode: 'air', grossWeightKg: 200, volumeM3: 0.5 })).toBe(200);
  });

  it('uses volumetric weight for light, bulky air freight', () => {
    expect(chargeableWeight({ mode: 'air', grossWeightKg: 50, volumeM3: 2 })).toBe(333.34);
  });

  it('charges sea LCL on revenue tons', () => {
    expect(chargeableWeight({ mode: 'sea', grossWeightKg: 500, volumeM3: 1.2 })).toBe(1200);
  });

  it('falls back to gross weight when volume is unknown', () => {
    expect(chargeableWeight({ mode: 'road', grossWeightKg: 120 })).toBe(120);
  });

  it('rounds to three decimals', () => {
    expect(chargeableWeight({ mode: 'air', grossWeightKg: 0, volumeM3: 0.001 })).toBe(0.167);
  });

  it('rejects negative input rather than quietly rating zero', () => {
    expect(() => chargeableWeight({ mode: 'air', grossWeightKg: -1 })).toThrow(RangeError);
    expect(() => chargeableWeight({ mode: 'air', grossWeightKg: 1, volumeM3: -1 })).toThrow(
      RangeError,
    );
  });
});
