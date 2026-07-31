import { describe, expect, it } from 'vitest'
import {
  handoverCaptureContextSchema,
  handoverRegisterSchema,
  handoverSchema,
  normalizeDamageCoordinate,
} from './handover.contract'

const ID = '10000000-0000-4000-8000-000000000001'

/** Freezes frontend HAPR response compatibility and physical-coordinate behavior. */
describe('HAPR handover frontend contracts', () => {
  it('parses a historical register page containing locked Returned custody', () => {
    const result = handoverRegisterSchema.parse({
      items: [{
        handoverId: ID,
        bookingId: ID,
        bookingNumber: 'BK-1192',
        driverName: 'M. Rashed',
        vehicle: { id: ID, plate: 'AD 90044', makeCode: 'KIA', modelCode: 'EV6' },
        issuedAtUtc: '2026-07-29T09:00:00.000Z',
        returnedAtUtc: '2026-07-29T13:42:00.000Z',
        distanceKm: '124.0',
        chargeSummary: { status: 'AVAILABLE', amount: null, currency: null, labels: [] },
        primaryStatus: 'ON_TIME',
        signals: ['ON_TIME'],
        capabilities: { view: true, editOpenCustody: false, returnVehicle: false },
        activityAtUtc: '2026-07-29T13:42:00.000Z',
      }],
      page: 1,
      pageSize: 5,
      total: 1,
      totalPages: 1,
    })
    expect(result.items[0]?.capabilities.editOpenCustody).toBe(false)
  })

  it('converts marker percentages to clamped normalized coordinates without RTL mirroring', () => {
    expect(normalizeDamageCoordinate(0)).toBe(0)
    expect(normalizeDamageCoordinate(24)).toBe(0.24)
    expect(normalizeDamageCoordinate(100)).toBe(1)
    expect(normalizeDamageCoordinate(-10)).toBe(0)
    expect(normalizeDamageCoordinate(140)).toBe(1)
  })

  it('parses legacy command snapshots as schema version 1', () => {
    const parsed = handoverSchema.parse({
      id: ID,
      bookingId: ID,
      vehicleId: ID,
      driverPersonId: ID,
      phase: 'Handover',
      handoverAtUtc: '2026-07-29T08:00:00.000Z',
      startOdometer: '1200',
      startFuelEighths: 7,
      gpsStatus: null,
      keyIssueRef: null,
      offlineCaptured: false,
      returnAtUtc: null,
      endOdometer: null,
      endFuelEighths: null,
      returnCondition: null,
      keyReturnRef: null,
      expectedFuelConsumedLitres: null,
      actualFuelConsumedLitres: null,
      fuelDeviationPercent: null,
      fuelDeviationFlagged: false,
      odometerConflict: false,
      lateReturn: false,
      damage: [],
    })
    expect(parsed.schemaVersion).toBe(1)
  })

  it('rejects capture context damage coordinates outside the normalized API range', () => {
    const result = handoverCaptureContextSchema.safeParse({
      schemaVersion: 2,
      booking: { id: ID, number: 'BK-1204', revision: 1, status: 'Approved', pickupAtUtc: '2026-07-29T08:00:00.000Z', returnAtUtc: '2026-07-29T12:00:00.000Z' },
      vehicle: { id: ID, plate: 'AD 88914', makeCode: 'NISSAN', modelCode: 'PATROL' },
      driver: { personId: ID, fullName: 'Amina Khoury' },
      scope: { nodeId: ID, name: 'GS Pool' },
      consent: { version: 'v3', signedAtUtc: '2026-07-29T07:55:00.000Z' },
      eligibility: { status: 'VERIFIED', reasonCodes: [], evaluatedAtUtc: null },
      telematics: { status: 'MATCHED', odometer: '48213', observedAtUtc: null },
      handover: null,
      carriedDamage: [{ id: ID, x: 24, y: 0.2, region: 'wing', templateVersion: 1, photoRef: null, note: null, state: 'existing', atUtc: '2026-07-28T10:00:00.000Z' }],
      capabilities: { handover: true, return: false, amendOpenCustody: false },
    })
    expect(result.success).toBe(false)
  })
})
