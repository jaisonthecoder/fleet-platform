import {
  bookingApprovalEvidenceItemSchema,
  bookingApprovalOptionalProviderSchema,
  bookingApprovalRequesterSchema,
} from './booking.contract';

/** Freezes the privacy-safe screen-25 projection before repository implementation. */
describe('HAPR Booking approval projection contracts', () => {
  it('accepts bounded actor-relative requester behavior evidence', () => {
    expect(bookingApprovalRequesterSchema.parse({
      fullName: 'Amina Khoury',
      employeeId: 'EMP-20481',
      relationshipCode: 'DIRECT_MANAGER',
      behavior: { year: 2026, bookingCount: 14, noShowCount: 0, lateReturnCount: 1 },
    })).toMatchObject({ relationshipCode: 'DIRECT_MANAGER' });
  });

  it('rejects invented relationship prose and unbounded counts', () => {
    expect(bookingApprovalRequesterSchema.safeParse({
      fullName: 'Amina Khoury',
      employeeId: 'EMP-20481',
      relationshipCode: 'REPORTS_TO_YOU',
      behavior: { year: 2026, bookingCount: -1, noShowCount: 0, lateReturnCount: 0 },
    }).success).toBe(false);
  });

  it('accepts typed safe consent evidence without transport or signature fields', () => {
    expect(bookingApprovalEvidenceItemSchema.parse({
      kind: 'Consent',
      status: 'SIGNED',
      reasonCodes: ['booking-consent-committed'],
      occurredAtUtc: '2026-07-30T08:12:00.000Z',
      version: 'booking-operational-ack-v3',
    })).toMatchObject({ kind: 'Consent', status: 'SIGNED' });
    expect(bookingApprovalEvidenceItemSchema.safeParse({
      kind: 'Consent',
      status: 'SIGNED',
      reasonCodes: [],
      occurredAtUtc: null,
      version: null,
      ip: '127.0.0.1',
      signatureRef: 'secret',
    }).success).toBe(false);
  });

  it('prevents unavailable cost or forecast providers from leaking fabricated values', () => {
    expect(bookingApprovalOptionalProviderSchema.safeParse({
      status: 'NOT_CONFIGURED',
      amount: '96.00',
      currency: 'AED',
      utilizationPercent: null,
      suggestedStartAtUtc: null,
      reasonCodes: ['booking-cost-provider-not-configured'],
    }).success).toBe(false);
    expect(bookingApprovalOptionalProviderSchema.safeParse({
      status: 'NOT_CONFIGURED',
      amount: null,
      currency: null,
      utilizationPercent: null,
      suggestedStartAtUtc: null,
      reasonCodes: ['booking-cost-provider-not-configured'],
    }).success).toBe(true);
  });
});
