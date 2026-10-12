import { coerceReply } from './pricing.prompt';

/**
 * The model is the only thing here that is not ours, so these tests are about the
 * boundary: what it sends must not reach an editor unchecked.
 */
describe('coerceReply', () => {
  it('reads one offer per service quoted', () => {
    const reply = coerceReply({
      offers: [
        { carrierName: 'MSC', currency: 'USD', charges: [] },
        { carrierName: 'Hapag-Lloyd', currency: 'USD', charges: [] },
      ],
    });
    expect(reply.offers.map((offer) => offer.carrierName)).toEqual(['MSC', 'Hapag-Lloyd']);
  });

  it('accepts a bare array, because models drop the wrapper', () => {
    expect(coerceReply([{ carrierName: 'MSC', charges: [] }]).offers).toHaveLength(1);
  });

  it('survives an answer with no offers at all', () => {
    expect(coerceReply({}).offers).toEqual([]);
    expect(coerceReply(null).offers).toEqual([]);
  });

  it('reads a rate written as a string', () => {
    const [offer] = coerceReply({
      offers: [{ charges: [{ description: 'Freight', rate: '2,450.00' }] }],
    }).offers;
    expect(offer?.charges[0]?.rate).toBe(2450);
  });

  it('keeps a missing rate as null rather than guessing zero', () => {
    const [offer] = coerceReply({
      offers: [{ charges: [{ description: 'Terminal handling', rate: null }] }],
    }).offers;
    expect(offer?.charges[0]?.rate).toBeNull();
  });

  it('refuses a currency that is not three letters', () => {
    const [offer] = coerceReply({ offers: [{ currency: 'dollars', charges: [] }] }).offers;
    expect(offer?.currency).toBeNull();
  });

  it('refuses a validity that is not a real date', () => {
    const [offer] = coerceReply({ offers: [{ validUntil: 'end of month', charges: [] }] }).offers;
    expect(offer?.validUntil).toBeNull();
  });

  it('keeps a validity that is a real date', () => {
    const [offer] = coerceReply({ offers: [{ validUntil: '2026-10-30', charges: [] }] }).offers;
    expect(offer?.validUntil).toBe('2026-10-30');
  });

  it('treats the words models use for nothing as nothing', () => {
    const [offer] = coerceReply({
      offers: [{ carrierName: 'N/A', serviceRouting: 'null', notes: '  ', charges: [] }],
    }).offers;
    expect(offer?.carrierName).toBeNull();
    expect(offer?.serviceRouting).toBeNull();
    expect(offer?.notes).toBeNull();
  });

  it('upper-cases a charge code so it can be matched against the lookup', () => {
    const [offer] = coerceReply({ offers: [{ charges: [{ code: 'thc' }] }] }).offers;
    expect(offer?.charges[0]?.code).toBe('THC');
  });
});
