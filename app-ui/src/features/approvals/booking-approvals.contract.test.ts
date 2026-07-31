import { describe, expect, it } from 'vitest'
import { approvalWorkItemSchema } from './booking-approvals.contract'

const ID = '10000000-0000-4000-8000-000000000001'

/** Freezes staged compatibility for the privacy-safe screen-25 projection. */
describe('HAPR Booking approval frontend contract', () => {
  const legacy = {
    bookingId: ID,
    bookingNumber: 'BK-1211',
    requesterName: 'Amina Khoury',
    vehicle: { plate: 'AD 88914', makeCode: 'NISSAN', modelCode: 'PATROL' },
    pickupAtUtc: '2026-07-30T07:30:00.000Z',
    returnAtUtc: '2026-07-30T12:00:00.000Z',
    purpose: 'Site visit',
    passengerCount: 2,
    consentVersion: 'v3',
    workflowStepId: ID,
    expectedBookingVersion: 4,
    expectedStepVersion: 1,
    dueAtUtc: null,
    delegated: false,
    evidence: { eligibility: 'VERIFIED_AT_CONSENT', consent: 'SIGNED', reservation: 'HELD', forecast: 'NOT_AVAILABLE' },
  } as const

  it('continues to parse the legacy approval work item during backend-first rollout', () => {
    expect(approvalWorkItemSchema.safeParse(legacy).success).toBe(true)
  })

  it('parses typed requester and persisted verdict evidence when available', () => {
    const parsed = approvalWorkItemSchema.parse({
      ...legacy,
      requester: {
        fullName: 'Amina Khoury',
        employeeId: 'EMP-20481',
        relationshipCode: 'DIRECT_MANAGER',
        behavior: { year: 2026, bookingCount: 14, noShowCount: 0, lateReturnCount: 1 },
      },
      destination: 'Kezad 280 site office',
      durationMinutes: 270,
      justification: 'Quarterly HSE inspection with two auditors.',
      evidenceItems: [
        { kind: 'Eligibility', status: 'VERIFIED', reasonCodes: ['booking-eligibility-allowed'], occurredAtUtc: '2026-07-30T08:11:00.000Z', version: 'elig-v2' },
        { kind: 'Consent', status: 'SIGNED', reasonCodes: ['booking-consent-committed'], occurredAtUtc: '2026-07-30T08:12:00.000Z', version: 'v3' },
      ],
      cost: { status: 'NOT_CONFIGURED', amount: null, currency: null, utilizationPercent: null, suggestedStartAtUtc: null, reasonCodes: ['booking-cost-provider-not-configured'] },
      forecast: { status: 'NOT_CONFIGURED', amount: null, currency: null, utilizationPercent: null, suggestedStartAtUtc: null, reasonCodes: ['booking-forecast-provider-not-configured'] },
    })
    expect(parsed.requester?.relationshipCode).toBe('DIRECT_MANAGER')
    expect(parsed.evidenceItems).toHaveLength(2)
  })

  it('rejects raw consent transport evidence from the strict frontend boundary', () => {
    expect(approvalWorkItemSchema.safeParse({
      ...legacy,
      evidenceItems: [{ kind: 'Consent', status: 'SIGNED', reasonCodes: [], occurredAtUtc: null, version: 'v3', ip: '127.0.0.1' }],
    }).success).toBe(false)
  })
})
