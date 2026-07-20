import { ForbiddenException, HttpException } from '@nestjs/common';
import { BOOKING_REASON } from '../../../contracts/booking.contract';
import type { EligibilityResult } from '../../../contracts/compliance.contract';
import type { PolicyEvaluationResponse } from '../../../contracts/policy-evaluation.contract';
import { BookingService } from './booking.service';

/** Extracts the RFC-7807 reason codes from a rejected request. */
async function reasonsOf(promise: Promise<unknown>): Promise<string[]> {
  try {
    await promise;
  } catch (error) {
    const body = (error as HttpException).getResponse() as { reasons?: string[] };
    return body.reasons ?? [];
  }
  throw new Error('expected the promise to reject');
}

/** Minimal in-memory booking row matching the Drizzle select shape. */
function makeBooking(over: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    organizationId: 'org',
    bookingNumber: null,
    vehicleId: 'v1',
    driverPersonId: 'd1',
    requestedByPersonId: 'r1',
    status: 'Draft',
    pickupAtUtc: new Date('2999-01-01T08:00:00Z'),
    returnAtUtc: new Date('2999-01-01T10:00:00Z'),
    reservationStart: new Date('2999-01-01T08:00:00Z'),
    reservationEnd: new Date('2999-01-01T10:15:00Z'),
    bufferMinutes: 15,
    destination: null,
    purpose: null,
    passengerCount: null,
    consentRecordId: null,
    workflowInstanceId: null,
    policyVersion: 'buf-v1',
    policyProvenance: null as unknown,
    createdAtUtc: new Date('2026-07-18T00:00:00Z'),
    updatedAtUtc: new Date('2026-07-18T00:00:00Z'),
    ...over,
  };
}

class FakeRepo {
  bookings = new Map<string, ReturnType<typeof makeBooking>>();
  vehicles = new Map<string, Record<string, unknown>>();
  persons = new Map<string, Record<string, unknown>>();
  consents: Array<Record<string, unknown>> = [];
  consentEvents: Array<Record<string, unknown>> = [];
  events: Array<Record<string, unknown>> = [];
  policyDecisions: Array<Record<string, unknown>> = [];
  vehicleScopes = new Map<string, string>();
  private consentSeq = 0;

  transaction<T>(work: (tx: unknown) => Promise<T>): Promise<T> {
    return work({});
  }
  async findById(id: string) {
    return this.bookings.get(id);
  }
  async findVehicle(id: string) {
    return this.vehicles.get(id);
  }
  async findVehicleScope(id: string) {
    return this.vehicleScopes.get(id) ?? null;
  }
  async findPerson(id: string) {
    return this.persons.get(id);
  }
  async findApproverForRole(): Promise<string | null> {
    return null;
  }
  async insert(values: Record<string, unknown>) {
    const row = makeBooking({ ...values, id: (values.id as string) ?? 'b1' });
    this.bookings.set(row.id, row);
    return row;
  }
  async update(id: string, patch: Record<string, unknown>) {
    const row = { ...this.bookings.get(id)!, ...patch };
    this.bookings.set(id, row);
    return row;
  }
  async insertEvent(v: Record<string, unknown>) {
    this.events.push(v);
  }
  async insertPolicyDecision(v: Record<string, unknown>) {
    this.policyDecisions.push(v);
  }
  async insertConsent(v: Record<string, unknown>) {
    const row = { ...v, id: `c${++this.consentSeq}` };
    this.consents.push(row);
    return row;
  }
  async insertConsentEvent(v: Record<string, unknown>) {
    this.consentEvents.push(v);
  }
  async listEvents() {
    return this.events;
  }
  async listAvailable() {
    return [];
  }
}

class FakePdp {
  async evaluate(req: { ruleType: string }): Promise<PolicyEvaluationResponse> {
    switch (req.ruleType) {
      case 'booking-buffer':
        return { decision: 'VALUE', reasons: [], policyVersion: 'buf-v1', scopeThatAnswered: 'group', value: 15 };
      case 'max-booking-duration':
        return { decision: 'VALUE', reasons: [], policyVersion: 'dur-v1', scopeThatAnswered: 'group', value: 24 };
      case 'booking-approval-chain':
        return { decision: 'ROUTE_TO', reasons: [], policyVersion: 'chain-v1', scopeThatAnswered: 'group', route: ['LineManager'] };
      case 'consent-re-consent-tolerance':
        return { decision: 'VALUE', reasons: [], policyVersion: 'tol-v1', scopeThatAnswered: 'group', value: { toleranceMinutes: 0 } };
      default:
        return { decision: 'DENY', reasons: ['unknown-rule'], policyVersion: 'none', scopeThatAnswered: 'group' };
    }
  }
}

class FakeEligibility {
  result: 'ALLOW' | 'DENY' = 'ALLOW';
  reasons: string[] = [];
  async evaluate(): Promise<EligibilityResult> {
    return { decision: this.result, reasons: this.reasons, dataAsOf: null, policyVersion: 'e-v1' };
  }
}

class FakeWorkflow {
  decideStatus = 'Approved';
  async start() {
    return { id: 'wf1', workflowType: 'booking-approval', subjectRef: 'booking:b1', currentStep: 0, status: 'Pending', steps: [] };
  }
  async decide() {
    return { id: 'wf1', workflowType: 'booking-approval', subjectRef: 'booking:b1', currentStep: 0, status: this.decideStatus, steps: [] };
  }
}

class FakeAudit {
  entries: Array<Record<string, unknown>> = [];
  async record(entry: Record<string, unknown>) {
    this.entries.push(entry);
  }
}

class FakeOutbox {
  events: Array<Record<string, unknown>> = [];
  async enqueue(event: Record<string, unknown>) {
    this.events.push(event);
    return 'm1';
  }
}

class FakeDomainDecisions {
  async evaluate(
    input: {
      consumer: string;
      subjectRef: string;
      correlationId: string;
      request: {
        organizationId: string;
        scopeNodeId: string;
        effectiveAtUtc: string;
        ruleType: string;
        context: Record<string, unknown>;
      };
    },
    legacy: () => Promise<PolicyEvaluationResponse>,
  ) {
    const response = await legacy();
    return {
      response,
      provenance: {
        decisionKey: input.request.ruleType,
        environment: 'default',
        selectorId: null,
        selectorRevision: null,
        deploymentId: response.policyRuleId ?? null,
        consumer: input.consumer,
        subjectRef: input.subjectRef,
        correlationId: input.correlationId,
        organizationId: input.request.organizationId,
        requestedScopeNodeId: input.request.scopeNodeId,
        resolvedScopeNodeId: response.resolvedScopeNodeId ?? null,
        policyVersion: response.policyVersion,
        policyRuleId: response.policyRuleId ?? null,
        policyVersionId: response.policyVersionId ?? null,
        matchedRowId: response.matchedRowId ?? null,
        decision: response.decision,
        reasons: response.reasons,
        effectiveAtUtc: input.request.effectiveAtUtc,
        evaluatedAtUtc: input.request.effectiveAtUtc,
        factFingerprint: 'test-fingerprint',
        mode: 'legacy-only' as const,
        source: 'legacy' as const,
        degraded: false,
      },
    };
  }
}

function build() {
  const repo = new FakeRepo();
  const pdp = new FakePdp();
  const decisions = new FakeDomainDecisions();
  const eligibility = new FakeEligibility();
  const workflow = new FakeWorkflow();
  const audit = new FakeAudit();
  const outbox = new FakeOutbox();
  repo.vehicles.set('v1', { id: 'v1', organizationId: '00000000-0000-4000-8000-000000000001', plate: 'AUH-1', bodyTypeCode: 'SEDAN', useCategoryCode: 'POOL', seatingCapacity: 5, fuelTypeCode: 'PETROL', bookingPoolFlag: true, lifecycleStatus: 'Active' });
  repo.vehicleScopes.set('v1', 'a0000000-0000-4000-8000-000000000003');
  const service = new BookingService(
    repo as never,
    pdp as never,
    decisions as never,
    eligibility as never,
    workflow as never,
    audit as never,
    outbox as never,
  );
  return { service, repo, eligibility, workflow, audit, outbox };
}

describe('BookingService', () => {
  it('creates a draft with no number and reserves nothing', async () => {
    const { service, repo } = build();
    const dto = await service.create({
      vehicleId: 'v1',
      driverPersonId: 'd1',
      requestedByPersonId: 'r1',
      pickupAtUtc: '2999-01-01T08:00:00Z',
      returnAtUtc: '2999-01-01T10:00:00Z',
    });
    expect(dto.status).toBe('Draft');
    expect(dto.bookingNumber).toBeNull();
    expect(repo.bookings.get('b1')?.status).toBe('Draft');
    const provenance = repo.bookings.get('b1')?.policyProvenance as Record<
      string,
      { decisionKey: string; source: string; factFingerprint: string }
    >;
    expect(provenance.bookingBuffer).toMatchObject({
      decisionKey: 'booking-buffer',
      source: 'legacy',
      factFingerprint: 'test-fingerprint',
    });
    expect(provenance.maxBookingDuration).toMatchObject({
      decisionKey: 'max-booking-duration',
      source: 'legacy',
      factFingerprint: 'test-fingerprint',
    });
    expect(repo.policyDecisions.map((row) => row.decisionKey).sort()).toEqual([
      'booking-buffer',
      'max-booking-duration',
    ]);
  });

  it('fails closed when the vehicle category is missing', async () => {
    const { service, repo } = build();
    repo.vehicles.set('v1', {
      ...repo.vehicles.get('v1'),
      useCategoryCode: null,
    });
    const reasons = await reasonsOf(
      service.create({
        vehicleId: 'v1',
        driverPersonId: 'd1',
        requestedByPersonId: 'r1',
        pickupAtUtc: '2999-01-01T08:00:00Z',
        returnAtUtc: '2999-01-01T10:00:00Z',
      }),
    );
    expect(reasons).toContain('vehicle-category-unmapped:missing');
  });

  it('fails closed when the vehicle has no active hierarchy scope', async () => {
    const { service, repo } = build();
    repo.vehicleScopes.delete('v1');
    const reasons = await reasonsOf(
      service.create({
        vehicleId: 'v1',
        driverPersonId: 'd1',
        requestedByPersonId: 'r1',
        pickupAtUtc: '2999-01-01T08:00:00Z',
        returnAtUtc: '2999-01-01T10:00:00Z',
      }),
    );
    expect(reasons).toContain('vehicle-scope-missing:v1');
  });

  it('rejects an invalid window', async () => {
    const { service } = build();
    const reasons = await reasonsOf(
      service.create({
        vehicleId: 'v1',
        driverPersonId: 'd1',
        requestedByPersonId: 'r1',
        pickupAtUtc: '2999-01-01T10:00:00Z',
        returnAtUtc: '2999-01-01T08:00:00Z',
      }),
    );
    expect(reasons).toContain(BOOKING_REASON.windowInvalid);
  });

  it('is the hard gate: an ineligible driver never gets a booking number, and the denial is logged', async () => {
    const { service, repo, eligibility, audit, outbox } = build();
    repo.bookings.set('b1', makeBooking());
    eligibility.result = 'DENY';
    eligibility.reasons = ['hard-block-insurance-expired'];

    await expect(
      service.signConsent('b1', { driverPersonId: 'd1', consentDocumentVersion: 'v1' }),
    ).rejects.toThrow(ForbiddenException);

    const b = repo.bookings.get('b1')!;
    expect(b.status).toBe('Draft'); // never reserved
    expect(b.bookingNumber).toBeNull(); // no number issued
    expect(repo.consents).toHaveLength(0); // no consent committed
    expect(outbox.events).toHaveLength(0);
    expect(audit.entries.some((e) => e.action === 'BOOKING_ELIGIBILITY_DENIED')).toBe(true);
  });

  it('issues the booking number only inside the consent transaction (atomicity)', async () => {
    const { service, repo, outbox } = build();
    repo.bookings.set('b1', makeBooking());

    const dto = await service.signConsent('b1', { driverPersonId: 'd1', consentDocumentVersion: 'v1' });

    expect(dto.status).toBe('PendingApproval');
    expect(dto.bookingNumber).toMatch(/^BK-\d{4}-\d{6}$/);
    expect(dto.consentRecordId).toBe('c1');
    expect(repo.consents).toHaveLength(1);
    expect(repo.consentEvents.some((e) => e.eventType === 'Signed')).toBe(true);
    expect(outbox.events.some((e) => e.eventType === 'ConsentSigned')).toBe(true);
  });

  it('rejects consent from a driver other than the booking driver', async () => {
    const { service, repo } = build();
    repo.bookings.set('b1', makeBooking());
    const reasons = await reasonsOf(
      service.signConsent('b1', { driverPersonId: 'someone-else', consentDocumentVersion: 'v1' }),
    );
    expect(reasons).toContain(BOOKING_REASON.driverMismatch);
  });

  it('SoD-01: a requester cannot approve their own booking', async () => {
    const { service, repo } = build();
    repo.bookings.set('b1', makeBooking({ status: 'PendingApproval', workflowInstanceId: 'wf1', requestedByPersonId: 'r1' }));
    await expect(
      service.decide('b1', { actorPersonId: 'r1', decision: 'APPROVED' }),
    ).rejects.toThrow(ForbiddenException);
    const reasons = await reasonsOf(service.decide('b1', { actorPersonId: 'r1', decision: 'APPROVED' }));
    expect(reasons).toContain(BOOKING_REASON.sodSelfApproval);
  });

  it('approval moves the booking to Approved and emits BookingConfirmed', async () => {
    const { service, repo, outbox } = build();
    repo.bookings.set('b1', makeBooking({ status: 'PendingApproval', workflowInstanceId: 'wf1', bookingNumber: 'BK-2026-000001', consentRecordId: 'c1' }));
    const dto = await service.decide('b1', { actorPersonId: 'mgr', decision: 'APPROVED' });
    expect(dto.status).toBe('Approved');
    expect(outbox.events.some((e) => e.eventType === 'BookingConfirmed')).toBe(true);
  });

  it('a material modification beyond tolerance voids consent and returns the booking to Draft', async () => {
    const { service, repo } = build();
    repo.bookings.set('b1', makeBooking({ status: 'PendingApproval', consentRecordId: 'c1', workflowInstanceId: null }));
    const dto = await service.modify('b1', { actorPersonId: 'r1', returnAtUtc: '2999-01-01T14:00:00Z' });
    expect(dto.status).toBe('Draft');
    expect(dto.consentRecordId).toBeNull();
    expect(repo.consentEvents.some((e) => e.eventType === 'Voided')).toBe(true);
    const provenance = repo.bookings.get('b1')?.policyProvenance as Record<
      string,
      { decisionKey: string; mode: string }
    >;
    expect(provenance.reConsentTolerance).toMatchObject({
      decisionKey: 'consent-re-consent-tolerance',
      mode: 'legacy-only',
    });
    expect(repo.policyDecisions.map((row) => row.decisionKey).sort()).toEqual([
      'booking-buffer',
      'consent-re-consent-tolerance',
      'max-booking-duration',
    ]);
  });

  it('a modification-requested decision returns to Draft AND clears the workflow so it can be re-submitted', async () => {
    const { service, repo, workflow } = build();
    repo.bookings.set('b1', makeBooking({ status: 'PendingApproval', workflowInstanceId: 'wf1', consentRecordId: 'c1', bookingNumber: 'BK-2026-000001' }));
    workflow.decideStatus = 'ModificationRequested';
    const dto = await service.decide('b1', { actorPersonId: 'mgr', decision: 'MODIFICATION_REQUESTED' });
    expect(dto.status).toBe('Draft');
    expect(dto.consentRecordId).toBeNull();
    expect(dto.workflowInstanceId).toBeNull(); // re-submittable (no stale workflow)
  });

  it('a material modification beyond tolerance also clears the workflow instance', async () => {
    const { service, repo } = build();
    repo.bookings.set('b1', makeBooking({ status: 'PendingApproval', consentRecordId: 'c1', workflowInstanceId: 'wf1' }));
    const dto = await service.modify('b1', { actorPersonId: 'r1', returnAtUtc: '2999-01-01T14:00:00Z' });
    expect(dto.status).toBe('Draft');
    expect(dto.workflowInstanceId).toBeNull();
  });
});
