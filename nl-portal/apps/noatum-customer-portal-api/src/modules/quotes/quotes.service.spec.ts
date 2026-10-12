import { noAnalytics } from '../../../test/fixtures/analytics.fixture';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { createQuoteSchema, QUOTE_STATUSES, type QuoteStatus } from '../../contracts';

import {
  allowedTransitions,
  assertEveryStatusMapped,
  assertTransition,
  canTransition,
  CUSTOMER_QUOTE_BADGE,
  isTerminal,
  QUOTE_TRANSITIONS,
  QuoteTransitionError,
  RETIRED_QUOTE_STATUSES,
} from './quote.status';
import { QuotesService } from './quotes.service';

describe('quote status machine', () => {
  it('has a rule for every status in the enum', () => {
    expect(() => assertEveryStatusMapped()).not.toThrow();
  });

  const allowed: Array<[QuoteStatus, QuoteStatus]> = [
    ['draft', 'requested'],
    ['draft', 'withdrawn'],
    ['requested', 'claimed'],
    ['requested', 'withdrawn'],
    ['requested', 'expired'],
    // Releasing a claim returns it to the queue.
    ['claimed', 'requested'],
    ['claimed', 'priced'],
    ['claimed', 'expired'],
    // Straight to published: legal in the machine. Whether it is legal for a given
    // quote depends on the approval threshold, which the service enforces.
    ['priced', 'published'],
    ['priced', 'approved'],
    // Reopening to correct a price.
    ['priced', 'claimed'],
    ['approved', 'published'],
    // Sending back for a rework, with a reason.
    ['approved', 'priced'],
    // Approval does not stop the validity clock.
    ['approved', 'expired'],
    ['published', 'accepted'],
    ['published', 'rejected'],
    ['published', 'expired'],
    // Re-pricing a published quote, which bumps the customer-visible version.
    ['published', 'claimed'],
  ];

  it.each(allowed)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  const forbidden: Array<[QuoteStatus, QuoteStatus]> = [
    // The defect this machine exists to prevent: accepting something nobody priced.
    ['draft', 'accepted'],
    ['requested', 'accepted'],
    ['claimed', 'accepted'],
    ['priced', 'accepted'],
    ['approved', 'accepted'],
    // The customer must not see a price before somebody released it.
    ['claimed', 'published'],
    ['requested', 'published'],
    // Terminal states are terminal.
    ['accepted', 'rejected'],
    ['accepted', 'requested'],
    ['rejected', 'accepted'],
    ['expired', 'accepted'],
    ['withdrawn', 'requested'],
    // A quote cannot go back to draft once the customer has sent it.
    ['requested', 'draft'],
    ['published', 'draft'],
  ];

  it.each(forbidden)('refuses %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(QuoteTransitionError);
  });

  // The deprecated values still exist in the enum because Postgres cannot drop one.
  // What actually retires them is this: nothing may move INTO them. Without this
  // test the old vocabulary would quietly come back the first time somebody copied
  // an older code path.
  it.each(RETIRED_QUOTE_STATUSES)('never allows anything to move into %s', (target) => {
    for (const from of QUOTE_STATUSES) {
      expect(canTransition(from, target)).toBe(false);
    }
  });

  it('leaves every retired status a way out, so no row is stranded', () => {
    for (const status of RETIRED_QUOTE_STATUSES) {
      expect(allowedTransitions(status).length).toBeGreaterThan(0);
    }
  });

  // The customer badge is a confidentiality control, not a label. Three internal
  // states share one badge so a customer cannot tell a priced-but-unreleased quote
  // from one nobody has looked at yet.
  it('shows the same badge for claimed, priced and approved', () => {
    expect(CUSTOMER_QUOTE_BADGE.claimed).toBe('in_progress');
    expect(CUSTOMER_QUOTE_BADGE.priced).toBe('in_progress');
    expect(CUSTOMER_QUOTE_BADGE.approved).toBe('in_progress');
  });

  it('never leaks an internal stage name to the customer badge', () => {
    const internalOnly = ['claimed', 'priced', 'approved', 'published', 'pending_sync'];

    for (const status of QUOTE_STATUSES) {
      expect(internalOnly).not.toContain(CUSTOMER_QUOTE_BADGE[status]);
    }
  });

  it('has a badge for every status in the enum', () => {
    for (const status of QUOTE_STATUSES) {
      expect(CUSTOMER_QUOTE_BADGE[status]).toBeDefined();
    }
  });

  it('reports every terminal state as having no way out', () => {
    for (const status of QUOTE_STATUSES) {
      if (isTerminal(status)) {
        expect(allowedTransitions(status)).toHaveLength(0);
      }
    }
  });

  it('never allows a transition to a status that is not in the enum', () => {
    for (const targets of Object.values(QUOTE_TRANSITIONS)) {
      for (const target of targets) {
        expect(QUOTE_STATUSES).toContain(target);
      }
    }
  });
});

describe('createQuoteSchema', () => {
  const valid = {
    mode: 'sea' as const,
    originCode: 'CNTAO',
    destinationCode: 'ESVLC',
    commodity: 'Ceramic tiles',
    grossWeightKg: 34_200,
    volumeM3: 34.2,
    incoterm: 'FOB' as const,
    readyDate: '2026-09-25T00:00:00.000Z',
    customerReference: 'PO-88245',
    serviceLevel: 'standard',
    notes: 'Preferred carrier, free time needed.',
    packages: [{ quantity: 76, packageType: 'pallet', weightKg: 450 }],
  };

  it('accepts a complete request', () => {
    expect(() => createQuoteSchema.parse(valid)).not.toThrow();
  });

  it('refuses a request that does not say what is being shipped', () => {
    // The request screen has always required this; until now the server did not,
    // which left the browser as the only rulebook.
    for (const commodity of [undefined, '', '   ']) {
      expect(createQuoteSchema.safeParse({ ...valid, commodity }).success).toBe(false);
    }
  });

  it('refuses delivery before the cargo is ready', () => {
    const result = createQuoteSchema.safeParse({
      ...valid,
      readyDate: '2026-09-25T00:00:00.000Z',
      payload: { latestDeliveryDate: '2026-09-24' },
    });

    expect(result.success).toBe(false);
  });

  it('accepts delivery on or after the ready date', () => {
    for (const latestDeliveryDate of ['2026-09-25', '2026-10-30']) {
      const result = createQuoteSchema.safeParse({
        ...valid,
        readyDate: '2026-09-25T00:00:00.000Z',
        payload: { latestDeliveryDate },
      });

      expect(result.success).toBe(true);
    }
  });

  it('refuses a sea-only incoterm on an air shipment', () => {
    // ICC rule, not a preference: FAS, FOB, CFR and CIF are sea and inland waterway only.
    for (const incoterm of ['FAS', 'FOB', 'CFR', 'CIF'] as const) {
      const result = createQuoteSchema.safeParse({ ...valid, mode: 'air', incoterm });
      expect(result.success).toBe(false);
    }
  });

  it('accepts a mode-neutral incoterm on an air shipment', () => {
    expect(() => createQuoteSchema.parse({ ...valid, mode: 'air', incoterm: 'FCA' })).not.toThrow();
  });
});

describe('QuotesService.create', () => {
  const groupId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';

  function buildService(overrides: {
    account?: { id: string; customerGroupId: string } | null;
    onCreate?: jest.Mock;
    dangerousGoodsEnabled?: boolean;
    instantRateEnabled?: boolean;
  }) {
    const create = overrides.onCreate ?? jest.fn(async ({ data }) => ({ id: 'quote-1', ...data }));

    const tx = {
      quote: { create },
      customerAccount: {
        findUnique: jest.fn(async () => overrides.account ?? null),
        // Used when the request names no organisation: with none or several the
        // service declines to guess, which is the default these cases want.
        findMany: jest.fn(async () => []),
      },
      $queryRaw: jest.fn(async () => [{ next_quote_reference: 'Q-000001' }]),
    };

    const repo = { run: jest.fn(async (fn: (client: unknown) => unknown) => fn(tx)) };
    // `accountIds` is the per-user organisation restriction; empty means unrestricted,
    // which is what an ordinary customer user has.
    const context = {
      require: () => ({ userId, isInternal: false, accountIds: [] }),
      requireGroupId: () => groupId,
    };
    const rateEngine = { rate: jest.fn() };

    // Answers per key. A stub that returns one boolean for every switch proves
    // nothing: the test would pass even if the service checked the wrong key.
    const switches = {
      isEnabled: async (key: string) => {
        if (key === 'quotations.dangerous_goods') return overrides.dangerousGoodsEnabled ?? true;
        if (key === 'quotations.instant_rate') return overrides.instantRateEnabled ?? false;
        return true;
      },
    };

    const service = new QuotesService(
      repo as never,
      context as never,
      rateEngine as never,
      noAnalytics(),
      // Only `getById` reads a setting, and these cases never reach it.
      { get: async () => false } as never,
      switches as never,
      { recordOutbound: jest.fn(async () => 'message-1') } as never,
    );

    return { service, tx, create, rateEngine };
  }

  const request = {
    mode: 'sea' as const,
    originCode: 'CNTAO',
    destinationCode: 'ESVLC',
    commodity: 'Ceramic tiles',
    grossWeightKg: 34_200,
    volumeM3: 34.2,
    incoterm: 'FOB' as const,
    readyDate: '2026-09-25T00:00:00.000Z',
    customerReference: 'PO-88245',
    serviceLevel: 'standard',
    notes: 'Remarks for the pricing team.',
    packages: [{ quantity: 76, packageType: 'pallet', weightKg: 450 }],
  };

  it('persists every field the schema accepts', async () => {
    // The defect being guarded: a field that validates, is used in a calculation, and is
    // then silently dropped. volumeM3 was exactly that.
    const { service, create } = buildService({});

    await service.create(request);

    const written = create.mock.calls[0][0].data;

    expect(written).toMatchObject({
      mode: 'sea',
      originCode: 'CNTAO',
      destinationCode: 'ESVLC',
      incoterm: 'FOB',
      customerReference: 'PO-88245',
      serviceLevel: 'standard',
      notes: 'Remarks for the pricing team.',
      currency: 'EUR',
      customerGroupId: groupId,
      createdById: userId,
    });
    expect(written.volumeM3).toBe(34.2);
    expect(written.readyDate).toBeInstanceOf(Date);
    expect(written.payload.packages).toHaveLength(1);
    expect(written.chargeableKg).toBeGreaterThan(0);
  });

  it('allocates the reference from the database, not from a row count', async () => {
    const { service, tx, create } = buildService({});

    await service.create(request);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data.reference).toBe('Q-000001');
  });

  describe('temperature control', () => {
    it('stores the set point and the settings around it', async () => {
      const { service, create } = buildService({});

      await service.create({
        ...request,
        temperatureControl: {
          setPointCelsius: -25,
          toleranceCelsius: 1,
          ventilation: 'CLOSED',
          controlledAtmosphere: true,
          preCoolingRequired: true,
          dataLogger: 'REAL_TIME',
        },
      });

      expect(create.mock.calls[0][0].data.temperatureControl.create).toMatchObject({
        setPointCelsius: -25,
        toleranceCelsius: 1,
        ventilation: 'CLOSED',
        controlledAtmosphere: true,
        preCoolingRequired: true,
        dataLogger: 'REAL_TIME',
      });
    });

    it('accepts a tolerance of zero as a real answer', async () => {
      // Zero tolerance is a requirement, not a blank.
      const { service, create } = buildService({});

      await service.create({
        ...request,
        temperatureControl: { setPointCelsius: 4, toleranceCelsius: 0 },
      });

      expect(create.mock.calls[0][0].data.temperatureControl.create.toleranceCelsius).toBe(0);
    });

    it('writes nothing when the request is not temperature controlled', async () => {
      const { service, create } = buildService({});

      await service.create(request);

      expect(create.mock.calls[0][0].data.temperatureControl).toBeUndefined();
    });

    it.each([-100, 60])('refuses a set point of %s, which is not Celsius cargo', async (value) => {
      const { service } = buildService({});

      await expect(
        service.create({ ...request, temperatureControl: { setPointCelsius: value } }),
      ).rejects.toThrow();
    });

    it('refuses a negative tolerance', async () => {
      const { service } = buildService({});

      await expect(
        service.create({
          ...request,
          temperatureControl: { setPointCelsius: 4, toleranceCelsius: -2 },
        }),
      ).rejects.toThrow();
    });
  });

  describe('out of gauge', () => {
    const piece = {
      description: 'Press frame',
      lengthCm: 1240,
      widthCm: 220,
      heightCm: 260,
      weightKg: 8400,
      liftingMethod: 'MOBILE_CRANE',
    };

    it('stores every piece, not just the largest', async () => {
      // Lifting equipment is quoted per piece; a summary loses the second crane.
      const { service, create } = buildService({});

      await service.create({
        ...request,
        oversizeItems: [piece, { ...piece, description: 'Base plate', weightKg: 3200 }],
      });

      const written = create.mock.calls[0][0].data.oversizeItems.create;
      expect(written).toHaveLength(2);
      expect(written[0]).toMatchObject({ position: 1, description: 'Press frame' });
      expect(written[1]).toMatchObject({ position: 2, description: 'Base plate' });
    });

    it.each(['lengthCm', 'widthCm', 'heightCm', 'weightKg'])(
      'refuses a piece with no %s',
      async (field) => {
        const { service } = buildService({});

        await expect(
          service.create({ ...request, oversizeItems: [{ ...piece, [field]: undefined }] }),
        ).rejects.toThrow();
      },
    );

    it('refuses a piece with no description', async () => {
      const { service } = buildService({});

      await expect(
        service.create({ ...request, oversizeItems: [{ ...piece, description: '  ' }] }),
      ).rejects.toThrow();
    });

    it('accepts a piece with no lifting method stated', async () => {
      // The customer may not know; the specialist decides.
      const { service, create } = buildService({});

      await service.create({
        ...request,
        oversizeItems: [{ ...piece, liftingMethod: undefined }],
      });

      expect(create.mock.calls[0][0].data.oversizeItems.create[0].liftingMethod).toBeNull();
    });
  });

  describe('containers', () => {
    // A full-container request is not a list of packages: the customer asks for
    // containers and the pricer charges per container.
    const unit = {
      unitId: 'c1',
      containerType: '40HC',
      quantity: 2,
      grossWeightPerUnitKg: 17_100,
    };

    const fclRequest = {
      ...request,
      loadType: 'FCL',
      packages: undefined,
      equipment: [unit],
    };

    it('stores each container type with its count', async () => {
      const { service, create } = buildService({});

      await service.create(fclRequest);

      const written = create.mock.calls[0][0].data;
      expect(written.loadType).toBe('FCL');
      expect(written.equipment.create).toEqual([
        expect.objectContaining({ position: 1, unitId: 'c1', containerType: '40HC', quantity: 2 }),
      ]);
    });

    it.each(['FCL', 'FTL'])('refuses a %s request with no containers', async (loadType) => {
      const { service, create } = buildService({});

      await expect(
        service.create({ ...fclRequest, loadType, equipment: [] }),
      ).rejects.toThrow(/at least one container/i);

      expect(create).not.toHaveBeenCalled();
    });

    it('leaves an LCL request to its package lines', async () => {
      const { service, create } = buildService({});

      await service.create({ ...request, loadType: 'LCL' });

      expect(create.mock.calls[0][0].data.equipment.create).toEqual([]);
    });

    it('refuses a container sharing an id with a cargo line', async () => {
      // Package lines and containers share one namespace so a hazard can name
      // either; a collision would make that link ambiguous.
      const { service, create } = buildService({});

      await expect(
        service.create({
          ...request,
          loadType: 'FCL',
          packages: [{ lineId: 'x', quantity: 1, packageType: 'drum', weightKg: 10 }],
          equipment: [{ ...unit, unitId: 'x' }],
        }),
      ).rejects.toThrow(/own id/i);

      expect(create).not.toHaveBeenCalled();
    });

    it('lets a hazard name a container as the cargo it sits in', async () => {
      const { service, create } = buildService({});

      await service.create({
        ...fclRequest,
        dangerousGoods: [
          {
            unNumber: '1263', hazardClass: '3', properShippingName: 'Paint',
            packingGroup: 'III', flashpointCelsius: 23, packagingType: 'Steel drum',
            packageCount: 6, netQuantityPerPackage: 20, quantityUnit: 'L',
            appliesToLines: ['c1'],
          },
        ],
      });

      expect(create.mock.calls[0][0].data.dangerousGoods.create[0].appliesToLines).toEqual(['c1']);
    });

    it('refuses a container quantity of zero', async () => {
      const { service } = buildService({});

      await expect(
        service.create({ ...fclRequest, equipment: [{ ...unit, quantity: 0 }] }),
      ).rejects.toThrow();
    });
  });

  describe('dangerous goods', () => {
    // Deliberately not a declaration: we store what the customer tells us so a
    // specialist can price it. The required set is the basic description the
    // regulations require unconditionally (49 CFR 172.202(a), mirroring the UN
    // Model Regulations), and the conditional rules use only what we can judge
    // without a licensed dangerous goods list.
    const entry = {
      unNumber: '1263',
      hazardClass: '3',
      properShippingName: 'Paint',
      packingGroup: 'III' as const,
      flashpointCelsius: 23,
      packagingType: 'Steel drum',
      packageCount: 6,
      netQuantityPerPackage: 20,
      quantityUnit: 'L',
      appliesToLines: ['a'],
    };

    const dgRequest = {
      ...request,
      packages: [
        { lineId: 'a', quantity: 6, packageType: 'drum', weightKg: 120 },
        { lineId: 'b', quantity: 2, packageType: 'carton', weightKg: 40 },
      ],
      dangerousGoods: [entry],
    };

    const withEntry = (change: Record<string, unknown>) => ({
      ...dgRequest,
      dangerousGoods: [{ ...entry, ...change }],
    });

    it('stores each entry against the cargo it travels in', async () => {
      const { service, create } = buildService({});

      await service.create(dgRequest);

      const written = create.mock.calls[0][0].data;
      expect(written.dangerousGoods.create).toHaveLength(1);
      expect(written.dangerousGoods.create[0]).toMatchObject({
        position: 1,
        unNumber: '1263',
        hazardClass: '3',
        packingGroup: 'III',
        packageCount: 6,
        appliesToLines: ['a'],
      });
    });

    it('refuses an entry naming cargo that is not in the request', async () => {
      const { service, create } = buildService({});

      await expect(
        service.create(withEntry({ appliesToLines: ['ghost'] })),
      ).rejects.toThrow(/name cargo from this request/i);

      expect(create).not.toHaveBeenCalled();
    });

    it('refuses an entry linked to no cargo at all', async () => {
      // An unlinked hazard means nobody knows which container holds it.
      const { service, create } = buildService({});

      await expect(service.create(withEntry({ appliesToLines: [] }))).rejects.toThrow();

      expect(create).not.toHaveBeenCalled();
    });

    it('refuses a UN number that is not four digits', async () => {
      const { service, create } = buildService({});

      await expect(service.create(withEntry({ unNumber: '63' }))).rejects.toThrow();

      expect(create).not.toHaveBeenCalled();
    });

    it.each([
      ['proper shipping name', { properShippingName: '' }],
      ['packaging type', { packagingType: '' }],
      ['package count', { packageCount: undefined }],
      ['net quantity', { netQuantityPerPackage: undefined }],
      ['quantity unit', { quantityUnit: '' }],
    ])('refuses an entry with no %s', async (_label, change) => {
      // The unconditional basic description: 49 CFR 172.202(a) requires the
      // shipping name, the total quantity with its unit, and the number and type
      // of packages. A pricer needs the same fields.
      const { service, create } = buildService({});

      await expect(service.create(withEntry(change))).rejects.toThrow();

      expect(create).not.toHaveBeenCalled();
    });

    it('requires a flashpoint for a flammable liquid', async () => {
      // 49 CFR 172.203(i)(2): required for water transport at 60 C or below, and
      // you cannot know whether it is until you state it.
      const { service, create } = buildService({});

      await expect(
        service.create(withEntry({ flashpointCelsius: undefined })),
      ).rejects.toThrow(/flashpoint/i);

      expect(create).not.toHaveBeenCalled();
    });

    it('requires a flashpoint when class 3 is only a subsidiary risk', async () => {
      const { service } = buildService({});

      await expect(
        service.create(
          withEntry({ hazardClass: '8', subsidiaryRisks: ['3'], flashpointCelsius: undefined }),
        ),
      ).rejects.toThrow(/flashpoint/i);
    });

    it('does not ask for a flashpoint where the class cannot have one', async () => {
      const { service, create } = buildService({});

      await service.create(
        withEntry({
          unNumber: '1830', hazardClass: '8', properShippingName: 'Sulphuric acid',
          packingGroup: 'II', flashpointCelsius: undefined, quantityUnit: 'kg',
        }),
      );

      expect(create).toHaveBeenCalled();
    });

    it('requires a technical name when the shipping name ends in n.o.s.', async () => {
      // 49 CFR 172.203(k). Judged from the name the customer typed, never from a
      // list of our own.
      const { service } = buildService({});

      await expect(
        service.create(withEntry({ properShippingName: 'Flammable liquid, n.o.s.' })),
      ).rejects.toThrow(/technical name/i);
    });

    it('accepts an n.o.s. entry that names its contents', async () => {
      const { service, create } = buildService({});

      await service.create(
        withEntry({ properShippingName: 'Flammable liquid, n.o.s.', technicalName: 'Xylene' }),
      );

      expect(create).toHaveBeenCalled();
    });

    it('keeps "not assigned" as a real answer, distinct from a blank', async () => {
      // Class 1, self-reactive substances, Division 5.2 and Class 7 are excepted
      // from carrying a packing group at all - 49 CFR 172.202(a)(4).
      const { service, create } = buildService({});

      await service.create(
        withEntry({
          unNumber: '1950', hazardClass: '2.1', properShippingName: 'Aerosols',
          packingGroup: 'NONE', flashpointCelsius: undefined, quantityUnit: 'kg',
        }),
      );

      expect(create.mock.calls[0][0].data.dangerousGoods.create[0].packingGroup).toBe('NONE');
    });

    it('refuses a packing group that is not a real one', async () => {
      const { service } = buildService({});

      await expect(service.create(withEntry({ packingGroup: 'IV' }))).rejects.toThrow();
    });

    it('refuses the whole request when the switch is off', async () => {
      const { service, create } = buildService({ dangerousGoodsEnabled: false });

      await expect(service.create(dgRequest)).rejects.toBeInstanceOf(ForbiddenException);

      expect(create).not.toHaveBeenCalled();
    });

    it('still accepts an ordinary request when the switch is off', async () => {
      const { service, create } = buildService({ dangerousGoodsEnabled: false });

      await service.create(request);

      expect(create).toHaveBeenCalled();
    });
  });

  describe('instant rating', () => {
    it('refuses before touching the rate engine when the switch is off', async () => {
      // There is no configured rate source, so this path must stay shut. The
      // assertion is that the adapter is never reached, not merely that the call
      // failed - a stub that happens to return nothing would hide that.
      const { service, rateEngine } = buildService({});

      await expect(service.rate('quote-1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(rateEngine.rate).not.toHaveBeenCalled();
    });
  });

  describe('cargo line ids', () => {
    it('gives every cargo line an id even when nobody asked for one', async () => {
      const { service, create } = buildService({});

      await service.create(request);

      expect(create.mock.calls[0][0].data.payload.packages[0].lineId).toBe('line-1');
    });
  });

  it('refuses an account belonging to another customer group', async () => {
    const { service, create } = buildService({
      account: { id: 'acct-1', customerGroupId: 'ffffffff-ffff-4fff-8fff-ffffffffffff' },
    });

    await expect(
      service.create({ ...request, accountId: '33333333-3333-4333-8333-333333333333' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(create).not.toHaveBeenCalled();
  });

  it('refuses an account that does not exist', async () => {
    const { service, create } = buildService({ account: null });

    await expect(
      service.create({ ...request, accountId: '33333333-3333-4333-8333-333333333333' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(create).not.toHaveBeenCalled();
  });

  it('accepts an account belonging to the caller', async () => {
    const accountId = '33333333-3333-4333-8333-333333333333';
    const { service, create } = buildService({ account: { id: accountId, customerGroupId: groupId } });

    await service.create({ ...request, accountId });

    expect(create.mock.calls[0][0].data.accountId).toBe(accountId);
  });
});
