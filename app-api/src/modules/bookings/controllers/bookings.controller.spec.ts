import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Principal } from '../../../common/auth/principal';
import { BookingService } from '../services/booking.service';
import { BookingsController } from './bookings.controller';

const APPROVER_ID = '11111111-1111-4111-8111-111111111111';
const DELEGATOR_ID = '22222222-2222-4222-8222-222222222222';

const principal = (personId: string | null): Principal => ({
  organizationId: '00000000-0000-4000-8000-000000000001',
  userId: '33333333-3333-4333-8333-333333333333',
  personId,
  entraObjectId: '44444444-4444-4444-8444-444444444444',
  email: 'approver@example.test',
  roles: [{ role: 'Approver', scopeNodeId: '55555555-5555-4555-8555-555555555555' }],
  isDevLogin: false,
});

describe('BookingsController approval actor binding', () => {
  const bookings = {
    availability: jest.fn(),
    availabilityTimeline: jest.fn(),
    create: jest.fn(),
    context: jest.fn(),
    bookablePeople: jest.fn(),
    get: jest.fn(),
    events: jest.fn(),
    signConsent: jest.fn(),
    submit: jest.fn(),
    decide: jest.fn(),
    modify: jest.fn(),
    extend: jest.fn(),
    cancel: jest.fn(),
  };
  let controller: BookingsController;

  beforeEach(async () => {
    bookings.availability.mockReset().mockResolvedValue([]);
    bookings.availabilityTimeline.mockReset().mockResolvedValue({ rows: [] });
    bookings.create.mockReset().mockResolvedValue({ id: 'booking-1' });
    bookings.context.mockReset().mockResolvedValue({ modes: {} });
    bookings.bookablePeople.mockReset().mockResolvedValue([]);
    bookings.get.mockReset().mockResolvedValue({ id: 'booking-1' });
    bookings.events.mockReset().mockResolvedValue([]);
    bookings.signConsent.mockReset().mockResolvedValue({ id: 'booking-1' });
    bookings.submit.mockReset().mockResolvedValue({ id: 'booking-1' });
    bookings.decide.mockReset().mockResolvedValue({ id: 'booking-1' });
    bookings.modify.mockReset().mockResolvedValue({ id: 'booking-1' });
    bookings.extend.mockReset().mockResolvedValue({ id: 'booking-1' });
    bookings.cancel.mockReset().mockResolvedValue({ id: 'booking-1' });
    const moduleRef = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [{ provide: BookingService, useValue: bookings }],
    }).compile();
    controller = moduleRef.get(BookingsController);
  });

  it('passes the authenticated principal to availability', async () => {
    const actor = principal(APPROVER_ID);
    const query = {
      pickupAtUtc: '2999-01-01T08:00:00.000Z',
      returnAtUtc: '2999-01-01T10:00:00.000Z',
    };

    await controller.available(query, actor);

    expect(bookings.availability).toHaveBeenCalledWith(query, actor);
  });

  it('fails closed when availability has no authenticated principal', () => {
    expect(() =>
      controller.available({
        pickupAtUtc: '2999-01-01T08:00:00.000Z',
        returnAtUtc: '2999-01-01T10:00:00.000Z',
      }),
    ).toThrow(ForbiddenException);
    expect(bookings.availability).not.toHaveBeenCalled();
  });

  it('passes the authenticated principal to the privacy-safe timeline', async () => {
    const actor = principal(APPROVER_ID);
    const query = {
      startAtUtc: '2999-01-01T06:00:00.000Z',
      endAtUtc: '2999-01-01T18:00:00.000Z',
    };

    await controller.availabilityTimeline(query, actor);

    expect(bookings.availabilityTimeline).toHaveBeenCalledWith(query, actor);
  });

  it('passes the authenticated principal to booking creation', async () => {
    const actor = principal(APPROVER_ID);
    const body = {
      vehicleId: '55555555-5555-4555-8555-555555555555',
      driverPersonId: APPROVER_ID,
      requestedByPersonId: APPROVER_ID,
      pickupAtUtc: '2999-01-01T08:00:00.000Z',
      returnAtUtc: '2999-01-01T10:00:00.000Z',
    };

    await controller.create(body, actor, 'create-booking-test-key');

    expect(bookings.create).toHaveBeenCalledWith(
      body,
      APPROVER_ID,
      actor,
      'create-booking-test-key',
    );
  });

  it('replaces a client-supplied consent IP with transport metadata', async () => {
    const actor = principal(APPROVER_ID);
    await controller.consent(
      'booking-1',
      {
        driverPersonId: APPROVER_ID,
        consentDocumentVersion: 'booking-consent-test-v1',
        ip: '203.0.113.99',
      },
      actor,
      'consent-transport-ip-key',
      { ip: '127.0.0.1' } as never,
    );

    expect(bookings.signConsent).toHaveBeenCalledWith(
      'booking-1',
      {
        driverPersonId: APPROVER_ID,
        consentDocumentVersion: 'booking-consent-test-v1',
        ip: '127.0.0.1',
      },
      APPROVER_ID,
      actor,
      'consent-transport-ip-key',
    );
  });

  it('fails closed when booking creation has no authenticated principal', () => {
    expect(() =>
      controller.create({
        vehicleId: '55555555-5555-4555-8555-555555555555',
        driverPersonId: APPROVER_ID,
        requestedByPersonId: APPROVER_ID,
        pickupAtUtc: '2999-01-01T08:00:00.000Z',
        returnAtUtc: '2999-01-01T10:00:00.000Z',
      }),
    ).toThrow(ForbiddenException);
    expect(bookings.create).not.toHaveBeenCalled();
  });

  it('rejects requester commands without an Idempotency-Key', () => {
    const actor = principal(APPROVER_ID);
    expect(() => controller.create({
      vehicleId: '55555555-5555-4555-8555-555555555555',
      driverPersonId: APPROVER_ID,
      requestedByPersonId: APPROVER_ID,
      pickupAtUtc: '2999-01-01T08:00:00.000Z',
      returnAtUtc: '2999-01-01T10:00:00.000Z',
    }, actor)).toThrow(BadRequestException);
    expect(() => controller.consent('booking-1', {
      driverPersonId: APPROVER_ID,
      consentDocumentVersion: 'booking-consent-v1',
    }, actor)).toThrow(BadRequestException);
    expect(() => controller.submit('booking-1', actor)).toThrow(BadRequestException);
    expect(() => controller.modify('booking-1', {
      expectedRevision: 1,
      returnAtUtc: '2999-01-01T11:00:00.000Z',
    }, actor)).toThrow(BadRequestException);
    expect(() => controller.extend('booking-1', {
      expectedRevision: 1,
      newReturnAtUtc: '2999-01-01T11:00:00.000Z',
    }, actor)).toThrow(BadRequestException);
    expect(() => controller.cancel('booking-1', {
      expectedRevision: 1,
      reason: 'Plans changed',
    }, actor)).toThrow(BadRequestException);
  });

  it.each([
    ['context', 'context'],
    ['people', 'bookablePeople'],
  ] as const)('binds the static %s route to the authenticated principal', async (method, serviceMethod) => {
    const actor = principal(APPROVER_ID);

    await controller[method](actor);

    expect(bookings[serviceMethod]).toHaveBeenCalledWith(actor);
    expect(bookings.get).not.toHaveBeenCalled();
  });

  it.each(['get', 'events'] as const)(
    'passes the authenticated principal to %s',
    async (method) => {
      const actor = principal(APPROVER_ID);

      await controller[method]('booking-1', actor);

      expect(bookings[method]).toHaveBeenCalledWith('booking-1', actor);
    },
  );

  it('binds consent to the authenticated principal', async () => {
    const actor = principal(APPROVER_ID);
    const body = {
      driverPersonId: APPROVER_ID,
      consentDocumentVersion: 'booking-consent-v1',
    };

    await controller.consent('booking-1', body, actor, 'consent-test-key');

    expect(bookings.signConsent).toHaveBeenCalledWith(
      'booking-1',
      body,
      APPROVER_ID,
      actor,
      'consent-test-key',
    );
  });

  it('binds submit to the authenticated principal', async () => {
    const actor = principal(APPROVER_ID);

    await controller.submit('booking-1', actor, 'submit-booking-test-key');

    expect(bookings.submit).toHaveBeenCalledWith(
      'booking-1',
      APPROVER_ID,
      actor,
      'submit-booking-test-key',
    );
  });

  it.each([
    ['modify', { expectedRevision: 1, returnAtUtc: '2999-01-01T11:00:00.000Z' }],
    ['extend', { expectedRevision: 1, newReturnAtUtc: '2999-01-01T11:00:00.000Z' }],
    ['cancel', { expectedRevision: 1, reason: 'Plans changed' }],
  ] as const)('binds requester identity for %s', async (method, body) => {
    const actor = principal(APPROVER_ID);

    await controller[method]('booking-1', body, actor, `${method}-booking-test-key`);

    expect(bookings[method]).toHaveBeenCalledWith(
      'booking-1',
      body,
      APPROVER_ID,
      actor,
      `${method}-booking-test-key`,
    );
  });

  it.each(['modify', 'extend', 'cancel'] as const)(
    'rejects a forged actorPersonId for %s',
    (method) => {
      expect(() =>
        controller[method](
          'booking-1',
          method === 'modify'
            ? { actorPersonId: DELEGATOR_ID, expectedRevision: 1, returnAtUtc: '2999-01-01T11:00:00.000Z' }
            : method === 'extend'
              ? { actorPersonId: DELEGATOR_ID, expectedRevision: 1, newReturnAtUtc: '2999-01-01T11:00:00.000Z' }
              : { actorPersonId: DELEGATOR_ID, expectedRevision: 1, reason: 'Forged' },
          principal(APPROVER_ID),
        ),
      ).toThrow(BadRequestException);
    },
  );

  it.each([
    ['approve', 'APPROVED'],
    ['decline', 'REJECTED'],
    ['requestChanges', 'MODIFICATION_REQUESTED'],
  ] as const)('uses the authenticated person for %s', async (method, decision) => {
    await controller[method](
      'booking-1',
      { expectedBookingVersion: 1, expectedStepVersion: 1, reason: 'Reviewed', onBehalfOfPersonId: DELEGATOR_ID },
      principal(APPROVER_ID),
      'approval-decision-key',
    );

    expect(bookings.decide).toHaveBeenCalledWith('booking-1', {
      actorPersonId: APPROVER_ID,
      expectedBookingVersion: 1,
      expectedStepVersion: 1,
      decision,
      reason: 'Reviewed',
      onBehalfOfPersonId: DELEGATOR_ID,
    }, principal(APPROVER_ID), 'approval-decision-key');
  });

  it('rejects an actorPersonId supplied in the request body', async () => {
    expect(() =>
      controller.approve(
        'booking-1',
        { actorPersonId: DELEGATOR_ID, expectedBookingVersion: 1, expectedStepVersion: 1 },
        principal(APPROVER_ID),
        'approval-forged-key',
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects an approval from an identity without a linked person', () => {
    expect(() =>
      controller.approve('booking-1', { expectedBookingVersion: 1, expectedStepVersion: 1 }, principal(null), 'approval-unlinked-key'),
    ).toThrow(ForbiddenException);
    expect(bookings.decide).not.toHaveBeenCalled();
  });
});