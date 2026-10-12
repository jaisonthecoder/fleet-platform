import {
  matchChargeCode, outstandingFor, parseTransit, requestedFreeTime,
  scaffoldCharges, scaffoldOptions,
} from './pricing-rules';

const CODES = [
  { code: 'FRT', label: 'Ocean or air freight' },
  { code: 'BAF', label: 'Bunker adjustment' },
  { code: 'THC', label: 'Terminal handling' },
  { code: 'DOC', label: 'Documentation and B/L' },
  { code: 'ISPS', label: 'Port security' },
  { code: 'PCF', label: 'Pre-carriage to port' },
  { code: 'DLV', label: 'Delivery to door' },
  { code: 'CUS', label: 'Customs entry' },
  { code: 'DGS', label: 'Dangerous goods handling' },
  { code: 'REF', label: 'Reefer plug and monitoring' },
  { code: 'OOG', label: 'Out of gauge or lifting' },
];

const base = {
  mode: 'sea',
  loadType: 'FCL',
  incoterm: 'FOB',
  containerCount: 2,
  hasDangerousGoods: false,
  hasTemperatureControl: false,
  hasOversize: false,
  chargeCodes: CODES,
};

const codesIn = (lines: { code: string }[]) => lines.map((line) => line.code);

describe('scaffoldCharges', () => {
  it('never produces a rate', () => {
    const lines = scaffoldCharges({ ...base, hasDangerousGoods: true, hasTemperatureControl: true });
    expect(lines.every((line) => line.rate === '')).toBe(true);
  });

  it('leaves out pre-carriage on a port term at origin', () => {
    expect(codesIn(scaffoldCharges({ ...base, incoterm: 'FOB' }))).not.toContain('PCF');
  });

  it('adds pre-carriage on EXW, because we collect at the seller', () => {
    expect(codesIn(scaffoldCharges({ ...base, incoterm: 'EXW' }))).toContain('PCF');
  });

  it('adds delivery and the import entry on DDP', () => {
    const codes = codesIn(scaffoldCharges({ ...base, incoterm: 'DDP' }));
    expect(codes).toContain('DLV');
    expect(codes).toContain('CUS');
  });

  it('adds dangerous goods handling only when declared', () => {
    expect(codesIn(scaffoldCharges(base))).not.toContain('DGS');
    expect(codesIn(scaffoldCharges({ ...base, hasDangerousGoods: true }))).toContain('DGS');
  });

  it('adds reefer monitoring only when temperature controlled', () => {
    expect(codesIn(scaffoldCharges({ ...base, hasTemperatureControl: true }))).toContain('REF');
  });

  it('charges per container when the request carries containers', () => {
    const freight = scaffoldCharges(base).find((line) => line.code === 'FRT');
    expect(freight?.basis).toBe('Per container');
    expect(freight?.quantity).toBe('2');
  });

  it('charges air freight per chargeable kg, and skips the bunker line', () => {
    const lines = scaffoldCharges({ ...base, mode: 'air', loadType: null, containerCount: 0 });
    expect(lines.find((line) => line.code === 'FRT')?.basis).toBe('Per chargeable kg');
    expect(codesIn(lines)).not.toContain('BAF');
  });

  it('leaves out a code the lookup does not carry', () => {
    const lines = scaffoldCharges({ ...base, chargeCodes: [{ code: 'FRT', label: 'Freight' }] });
    expect(codesIn(lines)).toEqual(['FRT']);
  });
});

describe('scaffoldOptions', () => {
  it('builds one at a time, naming the usual service first', () => {
    expect(scaffoldOptions(base, 1).map((option) => option.name)).toEqual(['Standard']);
  });

  it('names the next shape from how many are already built', () => {
    expect(scaffoldOptions(base, 1, 1).map((option) => option.name)).toEqual(['Express']);
    expect(scaffoldOptions(base, 1, 2).map((option) => option.name)).toEqual(['Economy']);
  });

  it('offers nothing once every shape is used', () => {
    expect(scaffoldOptions(base, 1, 3)).toEqual([]);
  });

  it('gives every option the same charge structure and no rates', () => {
    const options = [
      ...scaffoldOptions(base, 1, 0),
      ...scaffoldOptions(base, 1, 1),
      ...scaffoldOptions(base, 1, 2),
    ];
    const shape = codesIn(options[0]!.lines);
    expect(options.every((option) => codesIn(option.lines).join() === shape.join())).toBe(true);
    expect(options.every((option) => option.lines.every((line) => line.rate === ''))).toBe(true);
  });
});

describe('outstandingFor', () => {
  it('asks for carrier, transit and free time on a fresh scaffold', () => {
    const questions = outstandingFor(scaffoldOptions(base, 1));
    expect(questions.map((question) => question.field)).toEqual([
      'carrierName', 'transitDaysMin', 'freeTimeDays',
    ]);
  });

  it('does not ask for free time the customer already stated', () => {
    const options = scaffoldOptions({ ...base, requestedFreeTimeDays: 7 }, 1);
    expect(options[0]?.freeTimeDays).toBe('7');
    expect(outstandingFor(options).map((question) => question.field)).toEqual([
      'carrierName', 'transitDaysMin',
    ]);
  });

  it('asks nothing once an option is complete', () => {
    expect(
      outstandingFor([
        { name: 'Standard', carrierName: 'MSC', transitDaysMin: '28', transitDaysMax: '32', freeTimeDays: '7' },
      ]),
    ).toEqual([]);
  });

  it('names the option when there is more than one', () => {
    const questions = outstandingFor([
      ...scaffoldOptions(base, 1, 0),
      ...scaffoldOptions(base, 1, 1),
    ]);
    expect(questions[0]?.ask).toContain('Standard');
  });
});

describe('parseTransit', () => {
  it('reads a range', () => {
    expect(parseTransit('28-32 days')).toEqual({ min: '28', max: '32' });
    expect(parseTransit('28 to 32')).toEqual({ min: '28', max: '32' });
  });

  it('reads a single figure as both ends', () => {
    expect(parseTransit('about 30')).toEqual({ min: '30', max: '30' });
  });

  it('returns nothing when there is no number', () => {
    expect(parseTransit('not sure yet')).toBeNull();
  });
});

describe('requestedFreeTime', () => {
  it('reads the free time the customer asked for', () => {
    expect(requestedFreeTime('Groupage via Valencia. Free time of 7 days at destination if possible.')).toBe(7);
    expect(requestedFreeTime('Please quote with 14 free days.')).toBe(14);
    expect(requestedFreeTime('We need 10 days of free time.')).toBe(10);
  });

  it('reads it in Spanish', () => {
    expect(requestedFreeTime('Necesitamos tiempo libre de 21 días en destino.')).toBe(21);
    expect(requestedFreeTime('Con 5 dias libres en destino.')).toBe(5);
  });

  it('returns nothing when the customer did not ask', () => {
    expect(requestedFreeTime('Please quote door to door.')).toBeNull();
    expect(requestedFreeTime(null)).toBeNull();
    expect(requestedFreeTime('')).toBeNull();
  });
});

describe('matchChargeCode', () => {  it('matches the wording a carrier actually uses', () => {
    expect(matchChargeCode('Ocean freight', CODES)).toBe('FRT');
    expect(matchChargeCode('Bunker adjustment', CODES)).toBe('BAF');
    expect(matchChargeCode('Documentation', CODES)).toBe('DOC');
  });

  it('ignores words that say nothing, like "at origin"', () => {
    expect(matchChargeCode('Terminal handling at origin', CODES)).toBe('THC');
  });

  it('leaves the code blank when two are equally likely', () => {
    expect(
      matchChargeCode('Adjustment', [
        { code: 'BAF', label: 'Bunker adjustment' },
        { code: 'CAF', label: 'Currency adjustment' },
      ]),
    ).toBe('');
  });

  it('leaves the code blank when nothing matches', () => {
    expect(matchChargeCode('Quayside marshalling', CODES)).toBe('');
    expect(matchChargeCode(null, CODES)).toBe('');
  });

  it('matches a Spanish label, because the lookup is translated', () => {
    expect(
      matchChargeCode('Flete marítimo', [{ code: 'FRT', label: 'Flete marítimo o aéreo' }]),
    ).toBe('FRT');
  });
});
