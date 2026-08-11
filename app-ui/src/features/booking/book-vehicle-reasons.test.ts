import { describe, expect, it } from 'vitest'
import { pickConsentReasonKey } from './book-vehicle-page'

describe('pickConsentReasonKey', () => {
  it('prefers a specific compliance reason over the generic umbrella code', () => {
    expect(
      pickConsentReasonKey(['booking-eligibility-denied', 'licence-expired']),
    ).toBe('licence-expired')
    expect(
      pickConsentReasonKey(['booking-eligibility-denied', 'hcm-data-stale']),
    ).toBe('hcm-data-stale')
  })

  it('collapses access-blocked:<detail> to its i18n key', () => {
    expect(
      pickConsentReasonKey([
        'booking-eligibility-denied',
        'access-blocked:overdue-black-point-transfer:abc',
      ]),
    ).toBe('access-blocked')
  })

  it('falls back to the umbrella code when no specific reason is present', () => {
    expect(pickConsentReasonKey(['booking-eligibility-denied'])).toBe(
      'booking-eligibility-denied',
    )
  })

  it('returns null when no reason is resolvable', () => {
    expect(pickConsentReasonKey(['totally-unknown-code'])).toBeNull()
    expect(pickConsentReasonKey([])).toBeNull()
  })
})
