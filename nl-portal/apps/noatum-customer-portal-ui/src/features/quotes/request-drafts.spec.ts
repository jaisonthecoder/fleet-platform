import { describe, expect, it } from 'vitest';

import {
  dangerousGoodsComplete,
  toDangerousGoodsInput,
  type DangerousGoodsDraft,
} from './components/DangerousGoodsEditor';
import {
  equipmentGrossWeight,
  toEquipmentInput,
  type EquipmentDraft,
} from './components/EquipmentPicker';
import {
  emptyOversize,
  emptyTemperature,
  oversizeComplete,
  temperatureComplete,
  toOversizeInput,
  toTemperatureInput,
  type OversizeDraft,
} from './components/SpecialHandlingEditors';

/**
 * These functions decide two things at once: whether Send is enabled, and what
 * goes on the wire. The defect worth guarding is disagreement between the two -
 * a draft the gate calls complete must always map to a payload, and one it calls
 * incomplete must never map to a partial record.
 */

function dgDraft(overrides: Partial<DangerousGoodsDraft> = {}): DangerousGoodsDraft {
  return {
    key: 'dg-1',
    unNumber: '1263',
    hazardClass: '3',
    subsidiaryRisk: '',
    properShippingName: 'Paint',
    packingGroup: 'III',
    technicalName: '',
    flashpointCelsius: '23',
    emsCode: '',
    isMarinePollutant: false,
    packagingType: 'Steel drum',
    unPackagingCode: '',
    packageCount: '4',
    netQuantityPerPackage: '20',
    quantityUnit: 'L',
    transportRegime: 'FULL',
    isLimitedQuantity: false,
    isInOverpack: false,
    appliesToLines: ['line-1'],
    ...overrides,
  };
}

describe('dangerous goods draft', () => {
  it('accepts a complete entry', () => {
    expect(toDangerousGoodsInput(dgDraft())).not.toBeNull();
    expect(dangerousGoodsComplete([dgDraft()])).toBe(true);
  });

  it('reports an empty list as complete, so the caller must check length itself', () => {
    // `every` on an empty array is true. Recorded because the request page depends
    // on it: its gate is `length > 0 && dangerousGoodsComplete(...)`, and dropping
    // the length check would let a ticked flag through with no entries behind it.
    expect(dangerousGoodsComplete([])).toBe(true);
  });

  it('refuses an entry that names no cargo', () => {
    const draft = dgDraft({ appliesToLines: [] });
    expect(toDangerousGoodsInput(draft)).toBeNull();
    expect(dangerousGoodsComplete([draft])).toBe(false);
  });

  it('refuses a flammable liquid with no flashpoint', () => {
    expect(toDangerousGoodsInput(dgDraft({ flashpointCelsius: '' }))).toBeNull();
  });

  it('refuses an n.o.s. shipping name with no technical name', () => {
    expect(
      toDangerousGoodsInput(dgDraft({ properShippingName: 'Flammable liquid, n.o.s.' })),
    ).toBeNull();
  });

  it('accepts an n.o.s. name once the technical name is given', () => {
    expect(
      toDangerousGoodsInput(dgDraft({
        properShippingName: 'Flammable liquid, n.o.s.',
        technicalName: 'Xylene',
      })),
    ).not.toBeNull();
  });

  it('refuses a UN number that is not four digits', () => {
    for (const unNumber of ['', '63', '12634', 'UN1263']) {
      expect(toDangerousGoodsInput(dgDraft({ unNumber }))).toBeNull();
    }
  });

  it('refuses a fractional package count', () => {
    // Packages are countable things; 2.5 drums is a typo, not a quantity.
    expect(toDangerousGoodsInput(dgDraft({ packageCount: '2.5' }))).toBeNull();
  });

  it('never maps an incomplete draft to a payload', () => {
    const changes: Partial<DangerousGoodsDraft>[] = [
      { hazardClass: '' },
      { properShippingName: '' },
      { packagingType: '' },
      { packageCount: '' },
      { netQuantityPerPackage: '' },
      { quantityUnit: '' },
    ];

    for (const change of changes) {
      const draft = dgDraft(change);
      expect(toDangerousGoodsInput(draft)).toBeNull();
      expect(dangerousGoodsComplete([draft])).toBe(false);
    }
  });
});

describe('equipment', () => {
  const unit = (overrides: Partial<EquipmentDraft> = {}): EquipmentDraft => ({
    unitId: 'container-1',
    containerType: '40HC',
    quantity: 2,
    grossWeightPerUnitKg: '18000',
    ...overrides,
  });

  it('multiplies the per-unit weight by the count', () => {
    expect(equipmentGrossWeight([unit()])).toBe(36_000);
  });

  it('totals across container types', () => {
    expect(
      equipmentGrossWeight([
        unit(),
        unit({ unitId: 'container-2', quantity: 1, grossWeightPerUnitKg: '9000' }),
      ]),
    ).toBe(45_000);
  });

  it('treats an unweighed container as zero rather than NaN', () => {
    // A NaN would propagate into the request total and quietly disable Send.
    expect(equipmentGrossWeight([unit({ grossWeightPerUnitKg: '' })])).toBe(0);
    expect(equipmentGrossWeight([unit({ grossWeightPerUnitKg: 'heavy' })])).toBe(0);
  });

  it('carries the unit id through so a hazard can name the container', () => {
    expect(toEquipmentInput(unit()).unitId).toBe('container-1');
  });

  it('omits an unknown weight rather than sending zero', () => {
    // Zero would assert the container is empty; absent says we do not know yet.
    expect(toEquipmentInput(unit({ grossWeightPerUnitKg: '' })).grossWeightPerUnitKg)
      .toBeUndefined();
  });
});

describe('temperature control', () => {
  it('refuses an untouched draft', () => {
    expect(temperatureComplete(emptyTemperature())).toBe(false);
  });

  it('accepts a set point of zero', () => {
    // 0 degrees is a real reefer set point; a truthiness check would reject it.
    const draft = { ...emptyTemperature(), setPointCelsius: '0' };
    expect(temperatureComplete(draft)).toBe(true);
    expect(toTemperatureInput(draft)?.setPointCelsius).toBe(0);
  });

  it('accepts a frozen set point', () => {
    const draft = { ...emptyTemperature(), setPointCelsius: '-18' };
    expect(temperatureComplete(draft)).toBe(true);
    expect(toTemperatureInput(draft)?.setPointCelsius).toBe(-18);
  });

  it('refuses a set point outside the reefer range', () => {
    for (const setPointCelsius of ['-71', '41']) {
      expect(temperatureComplete({ ...emptyTemperature(), setPointCelsius })).toBe(false);
    }
  });

  it('gives no payload for an incomplete draft', () => {
    expect(toTemperatureInput(emptyTemperature())).toBeUndefined();
  });
});

describe('out of gauge', () => {
  const piece = (overrides: Partial<OversizeDraft> = {}): OversizeDraft => ({
    ...emptyOversize(),
    description: 'Transformer housing',
    lengthCm: '620',
    widthCm: '310',
    heightCm: '280',
    weightKg: '9400',
    liftingMethod: 'CRANE',
    ...overrides,
  });

  it('accepts a described piece', () => {
    expect(toOversizeInput(piece())).not.toBeNull();
    expect(oversizeComplete([piece()])).toBe(true);
  });

  it('refuses an empty list, unlike the dangerous goods check', () => {
    expect(oversizeComplete([])).toBe(false);
  });

  it('refuses a piece missing any dimension', () => {
    for (const field of ['lengthCm', 'widthCm', 'heightCm', 'weightKg'] as const) {
      expect(oversizeComplete([piece({ [field]: '' })])).toBe(false);
    }
  });

  it('refuses a description of only whitespace', () => {
    expect(toOversizeInput(piece({ description: '   ' }))).toBeNull();
  });
});
