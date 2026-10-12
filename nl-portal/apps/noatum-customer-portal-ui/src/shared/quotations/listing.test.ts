import { describe, expect, it } from 'vitest';

import { cargoCaption, segmentProgress, validityLabel, type QuoteCargo } from './listing';

/*
 * The caption and the validity wording are the two places on these listings where
 * the browser writes a sentence rather than printing a field. Both appear on the
 * customer's grid and the branch's, so a change here changes two screens.
 *
 * `t` is stubbed with the real English strings rather than mocked away: the point
 * of the test is the sentence that comes out, and a stub returning the key would
 * pass while the separator was wrong.
 */
const STRINGS: Record<string, string> = {
  quoteCargoUnit: '{{count}} × {{type}}',
  quoteCargoWeight: '{{weight}} kg',
  quoteCargoVolume: '{{volume}} m³',
  quoteCargoSeparator: ' · ',
  quoteNotPriced: 'Not priced yet',
  quoteLapsed: 'Expired',
  quoteDaysLeft_one: '1 day left',
  quoteDaysLeft_other: '{{count}} days left',
};

const t = ((key: string, values?: Record<string, unknown>) => {
  const plural = values && typeof values.count === 'number'
    ? (STRINGS[`${key}_${values.count === 1 ? 'one' : 'other'}`] ?? STRINGS[key])
    : STRINGS[key];
  return Object.entries(values ?? {}).reduce<string>(
    (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
    plural ?? key,
  );
}) as never;

const cargo = (parts: Partial<QuoteCargo> = {}): QuoteCargo => ({
  units: [],
  grossWeightKg: null,
  volumeM3: null,
  loadType: null,
  commodity: null,
  ...parts,
});

describe('cargo caption', () => {
  it('names the boxes on a full load', () => {
    expect(
      cargoCaption(
        cargo({ units: [{ quantity: 2, containerType: '40HC' }], commodity: 'furniture' }),
        t,
        'en-GB',
      ),
    ).toBe('2 × 40HC · furniture');
  });

  /* On a full load the box count IS the shipment; the weight is a detail of it,
     and printing both would bury the thing being scanned for. */
  it('prefers the boxes over the weight when both are known', () => {
    expect(
      cargoCaption(
        cargo({
          units: [{ quantity: 1, containerType: '40RH' }],
          grossWeightKg: 18_400,
          commodity: 'reefer',
        }),
        t,
        'en-GB',
      ),
    ).toBe('1 × 40RH · reefer');
  });

  it('qualifies a volume with the load type, because a CBM means two things', () => {
    expect(
      cargoCaption(cargo({ volumeM3: 18.4, loadType: 'LCL', commodity: 'textiles' }), t, 'en-GB'),
    ).toBe('18.4 m³ LCL · textiles');
  });

  it('falls back to weight, grouped the reader’s way', () => {
    expect(
      cargoCaption(cargo({ grossWeightKg: 1240, commodity: 'electronics' }), t, 'en-GB'),
    ).toBe('1,240 kg · electronics');
  });

  it('drops the separator rather than leaving it hanging', () => {
    expect(cargoCaption(cargo({ commodity: 'spare parts' }), t, 'en-GB')).toBe('spare parts');
    expect(cargoCaption(cargo({ grossWeightKg: 860 }), t, 'en-GB')).toBe('860 kg');
    expect(cargoCaption(cargo(), t, 'en-GB')).toBe('');
    expect(cargoCaption(undefined, t, 'en-GB')).toBe('');
  });
});

describe('validity wording', () => {
  /* Three genuinely different facts. Collapsing the first two into one dash is
     what makes a customer ask whether the screen is broken. */
  it('tells nothing-offered apart from lapsed apart from counting down', () => {
    expect(validityLabel(null, t)).toBe('Not priced yet');
    expect(validityLabel(0, t)).toBe('Expired');
    expect(validityLabel(-3, t)).toBe('Expired');
    expect(validityLabel(1, t)).toBe('1 day left');
    expect(validityLabel(11, t)).toBe('11 days left');
  });
});

describe('segment progress', () => {
  it('reads settled states as finished and a new request as barely started', () => {
    expect(segmentProgress('submitted')).toBeLessThan(segmentProgress('in_progress'));
    expect(segmentProgress('in_progress')).toBeLessThan(segmentProgress('options_ready'));
    expect(segmentProgress('accepted')).toBe(100);
    expect(segmentProgress('declined')).toBe(100);
  });

  it('falls back rather than drawing a track of undefined width', () => {
    expect(segmentProgress('something-else')).toBe(segmentProgress('submitted'));
  });
});
