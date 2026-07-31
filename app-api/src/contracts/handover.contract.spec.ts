import {
  HANDOVER_REASON,
  handoverRegisterQuerySchema,
  openHandoverSchema,
  openHandoverV2Schema,
  recordReturnV2Schema,
} from './handover.contract';

const BOOKING_ID = '10000000-0000-4000-8000-000000000001';
const LOCATION_ID = '20000000-0000-4000-8000-000000000001';
const EVIDENCE_REF = '30000000-0000-4000-8000-000000000001';
const inspection = ['body', 'tyres', 'lights', 'assets', 'cabin'].map((code) => ({
  code,
  verdict: 'Pass',
  evidenceRefs: [],
}));

/** Freezes additive HAPR contracts while preserving current Open compatibility. */
describe('HAPR handover contracts', () => {
  it('keeps the legacy Open command valid during staged deployment', () => {
    expect(openHandoverSchema.safeParse({
      bookingId: BOOKING_ID,
      employeePersonId: LOCATION_ID,
      startOdometer: 1200,
      startFuelEighths: 7,
      signatureRef: 'legacy-signature-ref',
    }).success).toBe(true);
  });

  it('bounds and strictly validates register pagination and filters', () => {
    expect(handoverRegisterQuerySchema.parse({ filter: 'OnTrip', page: '2', pageSize: '5' }))
      .toEqual({ filter: 'OnTrip', page: 2, pageSize: 5, sort: 'ActivityDesc' });
    expect(handoverRegisterQuerySchema.safeParse({ pageSize: 51 }).success).toBe(false);
    expect(handoverRegisterQuerySchema.safeParse({ filter: 'Unknown' }).success).toBe(false);
    expect(handoverRegisterQuerySchema.safeParse({ unexpected: true }).success).toBe(false);
  });

  it('requires exactly five versioned checklist results in a v2 Open command', () => {
    const base = {
      bookingId: BOOKING_ID,
      employeePersonId: LOCATION_ID,
      startOdometer: 1200,
      startFuelEighths: 7,
      signatureRef: 'legacy-signature-ref',
      schemaVersion: 2,
      expectedBookingRevision: 4,
      checklistDefinitionVersion: 1,
      inspection,
      signatureEvidenceRef: EVIDENCE_REF,
      releaseLocationNodeId: LOCATION_ID,
    };
    expect(openHandoverV2Schema.safeParse(base).success).toBe(true);
    expect(openHandoverV2Schema.safeParse({ ...base, inspection: inspection.slice(0, 4) }).success).toBe(false);
    expect(openHandoverV2Schema.safeParse({
      ...base,
      inspection: [inspection[0], inspection[0], ...inspection.slice(2)],
    }).success).toBe(false);
    expect(openHandoverV2Schema.safeParse({ ...base, unexpected: true }).success).toBe(false);
  });

  it('requires note and evidence for a failed inspection result', () => {
    const result = openHandoverV2Schema.safeParse({
      bookingId: BOOKING_ID,
      employeePersonId: LOCATION_ID,
      startOdometer: 1200,
      startFuelEighths: 7,
      signatureRef: 'legacy-signature-ref',
      schemaVersion: 2,
      expectedBookingRevision: 4,
      checklistDefinitionVersion: 1,
      inspection: [{ code: 'body', verdict: 'Fail', evidenceRefs: [] }, ...inspection.slice(1)],
      signatureEvidenceRef: EVIDENCE_REF,
      releaseLocationNodeId: LOCATION_ID,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map(({ message }) => message))
        .toContain(HANDOVER_REASON.failedInspectionEvidenceRequired);
    }
  });

  it('requires a reason when a v2 Return reports a lost key', () => {
    const result = recordReturnV2Schema.safeParse({
      endOdometer: 1300,
      endFuelEighths: 5,
      signatureRef: 'legacy-return-signature',
      schemaVersion: 2,
      expectedHandoverRevision: 2,
      checklistDefinitionVersion: 1,
      inspection,
      returnConditionCode: 'Good',
      keyOutcome: 'Lost',
      signatureEvidenceRef: EVIDENCE_REF,
      returnLocationNodeId: LOCATION_ID,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map(({ message }) => message))
        .toContain(HANDOVER_REASON.keyLostReasonRequired);
    }
  });
});
