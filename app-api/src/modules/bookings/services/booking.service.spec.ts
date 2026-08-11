import { ForbiddenException, HttpException } from '@nestjs/common';
import { BOOKING_REASON } from '../../../contracts/booking.contract';
import type { Principal } from '../../../common/auth/principal';
import type { EligibilityResult } from '../../../contracts/compliance.contract';
import type { PolicyEvaluationResponse } from '../../../contracts/policy-evaluation.contract';
import { BookingService } from './booking.service';
import { LegacyBookingApprovalRouteAdapter } from '../internal/legacy-booking-approval-route.adapter';

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
    organizationId: '00000000-0000-4000-8000-000000000001',
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
    approvalSuspendedAtUtc: null,
    approvalSuspendedByPersonId: null,
    approvalSuspensionReason: null,
    beneficiaryPersonId: null,
    bookingScopeNodeId: HOME_SCOPE_ID,
    revision: 1,
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
  commands: Array<Record<string, unknown>> = [];
  decisionCommands: Array<Record<string, unknown>> = [];
  approvedParticipant = true;
  vehicleScopes = new Map<string, string>();
  private consentSeq = 0;

  transaction<T>(work: (tx: unknown) => Promise<T>): Promise<T> {
    return work({});
  }
  async findById(id: string) {
    return this.bookings.get(id);
  }
  async findByIdForUpdate(id: string) {
    return this.bookings.get(id);
  }
  async findVehicle(id: string) {
    return this.vehicles.get(id);
  }
  async findVehicleForUpdate(id: string) {
    return this.vehicles.get(id);
  }
  async findVehicleScope(id: string) {
    return this.vehicleScopes.get(id) ?? null;
  }
  async findPerson(id: string) {
    return this.persons.get(id);
  }
  async findPersonBookingProfile(id: string) {
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
    const current = this.bookings.get(id)!;
    const row = { ...current, ...patch, revision: current.revision + 1 };
    this.bookings.set(id, row);
    return row;
  }
  async updateAtRevision(id: string, expectedRevision: number, patch: Record<string, unknown>) {
    const current = this.bookings.get(id)!;
    if (current.revision !== expectedRevision) return null;
    return this.update(id, patch);
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
  async listAvailabilityTimeline() {
    return [
      {
        vehicleId: 'v1',
        plate: 'AD 40213',
        makeCode: 'TOYOTA',
        modelCode: 'LAND_CRUISER',
        bodyTypeCode: 'SUV',
        seatingCapacity: 7,
        fuelTypeCode: 'HYBRID',
        locationName: 'GS Pool',
        lifecycleStatus: 'Active',
        bookingPoolFlag: true,
        reservationStart: new Date('2999-01-01T08:00:00Z'),
        reservationEnd: new Date('2999-01-01T10:00:00Z'),
        isOwn: false,
      },
    ];
  }
  async hasActiveOverlap() {
    return false;
  }
  async findCommand(
    organizationId: string,
    actorPersonId: string,
    commandType: string,
    idempotencyKey: string,
  ) {
    return this.commands.find((command) =>
      command.organizationId === organizationId &&
      command.actorPersonId === actorPersonId &&
      command.commandType === commandType &&
      command.idempotencyKey === idempotencyKey);
  }
  async claimCommand(values: Record<string, unknown>) {
    if (await this.findCommand(
      values.organizationId as string,
      values.actorPersonId as string,
      values.commandType as string,
      values.idempotencyKey as string,
    )) return null;
    const command = { ...values, id: `cmd-${this.commands.length + 1}` };
    this.commands.push(command);
    return command;
  }
  async completeCommand(id: string, resultBookingId: string, result: unknown) {
    const command = this.commands.find((entry) => entry.id === id)!;
    Object.assign(command, { resultBookingId, result });
  }
  async insertApprovalRoute() {
    return undefined;
  }
  async findCurrentWorkflowStep() {
    return { id: 'step-1', stateVersion: 1 };
  }
  async findDecisionCommand(organizationId: string, principalPersonId: string, idempotencyKey: string) {
    return this.decisionCommands.find((command) =>
      command.organizationId === organizationId &&
      command.principalPersonId === principalPersonId &&
      command.idempotencyKey === idempotencyKey);
  }
  async claimDecisionCommand(values: Record<string, unknown>) {
    if (await this.findDecisionCommand(
      values.organizationId as string,
      values.principalPersonId as string,
      values.idempotencyKey as string,
    )) return null;
    const command = { ...values, organizationId: ORG_ID, id: `decision-${this.decisionCommands.length + 1}` };
    this.decisionCommands.push(command);
    return command;
  }
  async completeDecisionCommand(id: string, resultBookingId: string, resultBody: unknown) {
    Object.assign(this.decisionCommands.find((command) => command.id === id)!, { resultBookingId, resultBody });
  }
  async hasApprovedDecision() {
    return this.approvedParticipant;
  }
  async listActiveBookingPeople() {
    return [...this.persons.values()];
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
  starts = 0;
  async start() {
    this.starts += 1;
    return { id: 'wf1', workflowType: 'booking-approval', subjectRef: 'booking:b1', currentStep: 0, status: 'Pending', definitionDeploymentId: 'deployment-1', stateVersion: 1, steps: [] };
  }
  async decide() {
    return { id: 'wf1', workflowType: 'booking-approval', subjectRef: 'booking:b1', currentStep: 0, status: this.decideStatus, steps: [] };
  }
  async decideInTransaction() {
    return {
      view: { id: 'wf1', workflowType: 'booking-approval', subjectRef: 'booking:b1', currentStep: 0, status: this.decideStatus, definitionDeploymentId: 'deployment-1', stateVersion: 2, steps: [] },
      decidedStepId: 'step-1',
    };
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

class FakeScopeAuthorization {
  checks: Array<{ roles: readonly string[]; scopeNodeId: string }> = [];
  deniedScopes = new Set<string>();

  async authorizedDescendantIds() {
    return [HOME_SCOPE_ID];
  }

  async assertRolesAtScope(
    _principal: Principal,
    roles: readonly string[],
    scopeNodeId: string,
  ) {
    this.checks.push({ roles, scopeNodeId });
    if (this.deniedScopes.has(scopeNodeId)) {
      throw new ForbiddenException({
        title: 'Hierarchy scope is not authorized',
        reasons: [`hierarchy-scope-not-authorized:${scopeNodeId}`],
      });
    }
  }

  async canRolesAtScope(
    _principal: Principal,
    _roles: readonly string[],
    scopeNodeId: string,
  ) {
    return !this.deniedScopes.has(scopeNodeId);
  }
}

class FakeConsentTemplates {
  template: {
    version: string;
    contentHash: string;
    effectiveAtUtc: string;
    content: { en: string; ar: string };
  } | null = {
    version: 'booking-consent-test-v1',
    contentHash: 'test-content-hash',
    effectiveAtUtc: '2026-01-01T00:00:00.000Z',
    content: { en: 'Test consent', ar: 'موافقة اختبارية' },
  };

  async current() {
    return this.template;
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
  const scopeAuthorization = new FakeScopeAuthorization();
  const consentTemplates = new FakeConsentTemplates();
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
    scopeAuthorization as never,
    consentTemplates as never,
    new LegacyBookingApprovalRouteAdapter(),
  );
  return { service, repo, eligibility, workflow, audit, outbox, scopeAuthorization, consentTemplates };
}

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const SELF_ID = '10000000-0000-4000-8000-000000000001';
const OTHER_ID = '10000000-0000-4000-8000-000000000002';
const HOME_SCOPE_ID = 'a0000000-0000-4000-8000-000000000003';
const OTHER_SCOPE_ID = 'a0000000-0000-4000-8000-000000000004';

function principal(
  personId: string | null,
  role: Principal['roles'][number]['role'] = 'Employee',
): Principal {
  return {
    organizationId: ORG_ID,
    userId: '20000000-0000-4000-8000-000000000001',
    personId,
    entraObjectId: '30000000-0000-4000-8000-000000000001',
    email: 'booking@example.test',
    roles: [{ role, scopeNodeId: HOME_SCOPE_ID }],
    isDevLogin: false,
  };
}

function bookingPerson(personId: string, homeScopeNodeId = HOME_SCOPE_ID) {
  return {
    personId,
    organizationId: ORG_ID,
    fullName: `Person ${personId}`,
    employeeId: personId,
    grade: null,
    employmentStatus: 'Active',
    homeScopeNodeId,
    homeScopeName: 'GS Pool',
    isProfessionalDriver: false,
  };
}

function legacyFleetPrincipal(repo: FakeRepo): Principal {
  repo.persons.set('r1', bookingPerson('r1'));
  repo.persons.set('d1', bookingPerson('d1'));
  return principal('r1', 'FleetManager');
}

function mutateBooking(
  service: BookingService,
  method: 'modify' | 'extend' | 'cancel',
  actor: Principal,
  reason: string,
) {
  const idempotencyKey = `${method}-${actor.personId ?? 'system'}-${reason}`;
  switch (method) {
    case 'modify':
      return service.modify(
        'b1',
        { expectedRevision: 1, returnAtUtc: '2999-01-01T11:00:00Z' },
        actor.personId ?? 'system',
        actor,
        idempotencyKey,
      );
    case 'extend':
      return service.extend(
        'b1',
        { expectedRevision: 1, newReturnAtUtc: '2999-01-01T11:00:00Z' },
        actor.personId ?? 'system',
        actor,
        idempotencyKey,
      );
    case 'cancel':
      return service.cancel(
        'b1',
        { expectedRevision: 1, reason },
        actor.personId ?? 'system',
        actor,
        idempotencyKey,
      );
  }
}

describe('BookingService', () => {
  it('returns self-only context while gated modes and consent metadata remain disabled', async () => {
    const { service, repo } = build();
    repo.persons.set(SELF_ID, bookingPerson(SELF_ID));

    const context = await service.context(principal(SELF_ID));

    expect(context.modes.self).toEqual({ enabled: true, blockingReasons: [] });
    expect(context.modes.onBehalf.enabled).toBe(false);
    expect(context.modes.emergency.enabled).toBe(false);
    expect(context.defaults).toMatchObject({
      requestedByPersonId: SELF_ID,
      driverPersonId: SELF_ID,
      scopeNodeId: HOME_SCOPE_ID,
    });
    expect(context.consent).toEqual({
      status: 'AVAILABLE',
      version: 'booking-consent-test-v1',
      contentHash: 'test-content-hash',
      effectiveAtUtc: '2026-01-01T00:00:00.000Z',
      content: { en: 'Test consent', ar: 'موافقة اختبارية' },
    });
  });

  it('fails closed when no approved consent template is available', async () => {
    const { service, repo, consentTemplates } = build();
    repo.persons.set(SELF_ID, bookingPerson(SELF_ID));
    repo.bookings.set('b1', makeBooking());
    consentTemplates.template = null;

    const context = await service.context(principal(SELF_ID));
    expect(context.consent).toEqual({
      status: 'PENDING_APPROVAL',
      version: null,
      contentHash: null,
      effectiveAtUtc: null,
      content: null,
    });
    const reasons = await reasonsOf(service.signConsent(
      'b1',
      { driverPersonId: 'd1', consentDocumentVersion: 'anything' },
      'person:d1',
      principal('d1'),
      'missing-template-key',
    ));
    expect(reasons).toContain(BOOKING_REASON.consentTemplateUnavailable);
    expect(repo.consents).toHaveLength(0);
  });

  it('authorizes an employee self-booking at the vehicle scope', async () => {
    const { service, repo, scopeAuthorization } = build();
    repo.persons.set(SELF_ID, bookingPerson(SELF_ID));

    await service.create(
      {
        vehicleId: 'v1',
        driverPersonId: SELF_ID,
        requestedByPersonId: SELF_ID,
        pickupAtUtc: '2999-01-01T08:00:00Z',
        returnAtUtc: '2999-01-01T10:00:00Z',
      },
      `person:${SELF_ID}`,
      principal(SELF_ID),
      'self-create-key',
    );

    expect(scopeAuthorization.checks).toEqual([
      { roles: ['Employee'], scopeNodeId: HOME_SCOPE_ID },
    ]);
  });

  it('rejects a forged requester for an employee booking', async () => {
    const { service, repo } = build();
    repo.persons.set(SELF_ID, bookingPerson(SELF_ID));
    repo.persons.set(OTHER_ID, bookingPerson(OTHER_ID));

    const reasons = await reasonsOf(
      service.create(
        {
          vehicleId: 'v1',
          driverPersonId: OTHER_ID,
          requestedByPersonId: OTHER_ID,
          pickupAtUtc: '2999-01-01T08:00:00Z',
          returnAtUtc: '2999-01-01T10:00:00Z',
        },
        `person:${SELF_ID}`,
        principal(SELF_ID),
        'forged-create-key',
      ),
    );

    expect(reasons).toContain(BOOKING_REASON.onBehalfNotAllowed);
  });

  it('authorizes Fleet Manager on-behalf creation across persisted requester, driver, and Vehicle scopes', async () => {
    const { service, repo, scopeAuthorization } = build();
    repo.persons.set(SELF_ID, bookingPerson(SELF_ID));
    repo.persons.set(OTHER_ID, bookingPerson(OTHER_ID));

    const created = await service.create(
      {
        vehicleId: 'v1',
        driverPersonId: OTHER_ID,
        requestedByPersonId: OTHER_ID,
        pickupAtUtc: '2999-01-01T08:00:00Z',
        returnAtUtc: '2999-01-01T10:00:00Z',
      },
      `person:${SELF_ID}`,
      principal(SELF_ID, 'FleetManager'),
      'fleet-create-key',
    );

    expect(created).toMatchObject({
      requestedByPersonId: OTHER_ID,
      driverPersonId: OTHER_ID,
      beneficiaryPersonId: OTHER_ID,
      bookingScopeNodeId: HOME_SCOPE_ID,
    });
    expect(scopeAuthorization.checks).toEqual([
      { roles: ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'], scopeNodeId: HOME_SCOPE_ID },
      { roles: ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'], scopeNodeId: HOME_SCOPE_ID },
      { roles: ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'], scopeNodeId: HOME_SCOPE_ID },
    ]);
  });

  it('rejects an on-behalf booking when one selected scope is unauthorized', async () => {
    const { service, repo, scopeAuthorization } = build();
    repo.persons.set(OTHER_ID, bookingPerson(OTHER_ID, OTHER_SCOPE_ID));
    scopeAuthorization.deniedScopes.add(OTHER_SCOPE_ID);

    const reasons = await reasonsOf(
      service.create(
        {
          vehicleId: 'v1',
          driverPersonId: OTHER_ID,
          requestedByPersonId: OTHER_ID,
          pickupAtUtc: '2999-01-01T08:00:00Z',
          returnAtUtc: '2999-01-01T10:00:00Z',
        },
        `person:${SELF_ID}`,
        principal(SELF_ID, 'FleetManager'),
        'denied-create-key',
      ),
    );

    expect(reasons).toContain(`hierarchy-scope-not-authorized:${OTHER_SCOPE_ID}`);
  });

  it('does not grant SystemAdmin operational on-behalf authority', async () => {
    const { service, repo } = build();
    repo.persons.set(OTHER_ID, bookingPerson(OTHER_ID));

    const reasons = await reasonsOf(
      service.create(
        {
          vehicleId: 'v1',
          driverPersonId: OTHER_ID,
          requestedByPersonId: OTHER_ID,
          pickupAtUtc: '2999-01-01T08:00:00Z',
          returnAtUtc: '2999-01-01T10:00:00Z',
        },
        `person:${SELF_ID}`,
        principal(SELF_ID, 'SystemAdmin'),
        'admin-create-key',
      ),
    );

    expect(reasons).toContain(BOOKING_REASON.onBehalfNotAllowed);
  });

  it('derives Fleet on-behalf mode from editable role and hierarchy assignments', async () => {
    const { service, repo } = build();
    repo.persons.set(SELF_ID, bookingPerson(SELF_ID));
    repo.persons.set(OTHER_ID, bookingPerson(OTHER_ID));

    const context = await service.context(principal(SELF_ID, 'FleetManager'));

    expect(context.modes.onBehalf).toEqual({ enabled: true, blockingReasons: [] });
  });

  it.each(['modify', 'extend', 'cancel'] as const)(
    'rejects %s by another employee',
    async (method) => {
    const { service, repo } = build();
    repo.bookings.set('b1', makeBooking({
      organizationId: ORG_ID,
      requestedByPersonId: OTHER_ID,
    }));

    const reasons = await reasonsOf(
      mutateBooking(service, method, principal(SELF_ID), 'Unauthorized'),
    );

    expect(reasons).toContain(BOOKING_REASON.onBehalfNotAllowed);
    },
  );

  it('requires Active custody to complete through Handover instead of cancellation', async () => {
    const { service, repo } = build();
    repo.bookings.set('b1', makeBooking({
      status: 'Active',
      requestedByPersonId: SELF_ID,
      driverPersonId: SELF_ID,
    }));

    const reasons = await reasonsOf(
      service.cancel(
        'b1',
        { expectedRevision: 1, reason: 'Early return' },
        SELF_ID,
        principal(SELF_ID),
        'active-cancel-key',
      ),
    );

    expect(reasons).toContain(BOOKING_REASON.activeRequiresReturn);
  });

  it.each(['modify', 'extend', 'cancel'] as const)(
    'requires an operational manager to cover the booking vehicle scope for %s',
    async (method) => {
    const { service, repo, scopeAuthorization } = build();
    repo.bookings.set('b1', makeBooking({
      organizationId: ORG_ID,
      requestedByPersonId: OTHER_ID,
    }));
    scopeAuthorization.deniedScopes.add(HOME_SCOPE_ID);

    const reasons = await reasonsOf(
      mutateBooking(
        service,
        method,
        principal(SELF_ID, 'FleetManager'),
        'Manager action',
      ),
    );

    expect(reasons).toContain(`hierarchy-scope-not-authorized:${HOME_SCOPE_ID}`);
    },
  );

  it('rejects availability for an authenticated identity without a linked person', async () => {
    const { service } = build();

    const reasons = await reasonsOf(
      service.availability(
        {
          pickupAtUtc: '2999-01-01T08:00:00Z',
          returnAtUtc: '2999-01-01T10:00:00Z',
        },
        principal(null),
      ),
    );

    expect(reasons).toContain('user-not-linked-to-person');
  });

  it('returns privacy-safe open and unavailable timeline segments', async () => {
    const { service } = build();

    const result = await service.availabilityTimeline(
      {
        startAtUtc: '2999-01-01T06:00:00Z',
        endAtUtc: '2999-01-01T18:00:00Z',
      },
      principal(SELF_ID),
    );

    expect(result.rows[0]?.segments).toEqual([
      { startAtUtc: '2999-01-01T06:00:00.000Z', endAtUtc: '2999-01-01T08:00:00.000Z', state: 'OPEN' },
      { startAtUtc: '2999-01-01T08:00:00.000Z', endAtUtc: '2999-01-01T10:00:00.000Z', state: 'UNAVAILABLE' },
      { startAtUtc: '2999-01-01T10:00:00.000Z', endAtUtc: '2999-01-01T18:00:00.000Z', state: 'OPEN' },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/driver|requester|destination|purpose/i);
  });

  it('creates a draft with no number and reserves nothing', async () => {
    const { service, repo } = build();
    const dto = await service.create(
      {
        vehicleId: 'v1',
        driverPersonId: 'r1',
        requestedByPersonId: 'r1',
        pickupAtUtc: '2999-01-01T08:00:00Z',
        returnAtUtc: '2999-01-01T10:00:00Z',
      },
      'person:r1',
      legacyFleetPrincipal(repo),
      'legacy-create-key',
    );
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

  it('rejects a pooled vehicle outside the Active lifecycle on create', async () => {
    const { service, repo } = build();
    repo.vehicles.set('v1', {
      ...repo.vehicles.get('v1'),
      lifecycleStatus: 'InUse',
    });

    await expect(
      service.create({
        vehicleId: 'v1',
        driverPersonId: 'r1',
        requestedByPersonId: 'r1',
        pickupAtUtc: '2999-01-01T08:00:00Z',
        returnAtUtc: '2999-01-01T10:00:00Z',
      }, 'person:r1', legacyFleetPrincipal(repo), 'lifecycle-create-key'),
    ).rejects.toMatchObject({
      response: { reasons: [BOOKING_REASON.vehicleNotBookable] },
    });
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
        driverPersonId: 'r1',
        requestedByPersonId: 'r1',
        pickupAtUtc: '2999-01-01T08:00:00Z',
        returnAtUtc: '2999-01-01T10:00:00Z',
      }, 'person:r1', legacyFleetPrincipal(repo), 'category-create-key'),
    );
    expect(reasons).toContain('vehicle-category-unmapped:missing');
  });

  it('fails closed when the vehicle has no active hierarchy scope', async () => {
    const { service, repo } = build();
    repo.vehicleScopes.delete('v1');
    const reasons = await reasonsOf(
      service.create({
        vehicleId: 'v1',
        driverPersonId: 'r1',
        requestedByPersonId: 'r1',
        pickupAtUtc: '2999-01-01T08:00:00Z',
        returnAtUtc: '2999-01-01T10:00:00Z',
      }, 'person:r1', legacyFleetPrincipal(repo), 'scope-create-key'),
    );
    expect(reasons).toContain('vehicle-scope-missing:v1');
  });

  it('rejects an invalid window', async () => {
    const { service, repo } = build();
    const reasons = await reasonsOf(
      service.create({
        vehicleId: 'v1',
        driverPersonId: 'd1',
        requestedByPersonId: 'r1',
        pickupAtUtc: '2999-01-01T10:00:00Z',
        returnAtUtc: '2999-01-01T08:00:00Z',
      }, 'person:r1', legacyFleetPrincipal(repo), 'window-create-key'),
    );
    expect(reasons).toContain(BOOKING_REASON.windowInvalid);
  });

  it('returns the original draft for the same create key and payload', async () => {
    const { service, repo } = build();
    repo.persons.set(SELF_ID, bookingPerson(SELF_ID));
    const input = {
      vehicleId: 'v1',
      driverPersonId: SELF_ID,
      requestedByPersonId: SELF_ID,
      pickupAtUtc: '2999-01-01T08:00:00Z',
      returnAtUtc: '2999-01-01T10:00:00Z',
    };

    const first = await service.create(input, `person:${SELF_ID}`, principal(SELF_ID), 'retry-create-key');
    const retried = await service.create(input, `person:${SELF_ID}`, principal(SELF_ID), 'retry-create-key');

    expect(retried).toEqual(first);
    expect(repo.bookings.size).toBe(1);
    expect(repo.commands).toHaveLength(1);
  });

  it('rejects reuse of a create key with a different payload', async () => {
    const { service, repo } = build();
    repo.persons.set(SELF_ID, bookingPerson(SELF_ID));
    const input = {
      vehicleId: 'v1',
      driverPersonId: SELF_ID,
      requestedByPersonId: SELF_ID,
      pickupAtUtc: '2999-01-01T08:00:00Z',
      returnAtUtc: '2999-01-01T10:00:00Z',
    };
    await service.create(input, `person:${SELF_ID}`, principal(SELF_ID), 'reused-create-key');

    const reasons = await reasonsOf(service.create(
      { ...input, returnAtUtc: '2999-01-01T11:00:00Z' },
      `person:${SELF_ID}`,
      principal(SELF_ID),
      'reused-create-key',
    ));

    expect(reasons).toContain('booking-idempotency-key-reused');
    expect(repo.bookings.size).toBe(1);
  });

  it('is the hard gate: an ineligible driver never gets a booking number, and the denial is logged', async () => {
    const { service, repo, eligibility, audit, outbox } = build();
    repo.bookings.set('b1', makeBooking());
    eligibility.result = 'DENY';
    eligibility.reasons = ['hard-block-insurance-expired'];

    await expect(
      service.signConsent(
        'b1',
        { driverPersonId: 'd1', consentDocumentVersion: 'booking-consent-test-v1' },
        'person:d1',
        principal('d1'),
        'denied-consent-key',
      ),
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

    const dto = await service.signConsent(
      'b1',
      { driverPersonId: 'd1', consentDocumentVersion: 'booking-consent-test-v1' },
      'person:d1',
      principal('d1'),
      'atomic-consent-key',
    );

    expect(dto.status).toBe('PendingApproval');
    expect(dto.bookingNumber).toMatch(/^BK-\d{4}-\d{6}$/);
    expect(dto.consentRecordId).toBe('c1');
    expect(repo.consents).toHaveLength(1);
    expect(repo.consentEvents.some((e) => e.eventType === 'Signed')).toBe(true);
    expect(outbox.events.some((e) => e.eventType === 'ConsentSigned')).toBe(true);
  });

  it('returns the original reserved booking for a repeated consent command', async () => {
    const { service, repo } = build();
    repo.bookings.set('b1', makeBooking());
    const input = { driverPersonId: 'd1', consentDocumentVersion: 'booking-consent-test-v1' };

    const first = await service.signConsent('b1', input, 'person:d1', principal('d1'), 'retry-consent-key');
    const retried = await service.signConsent('b1', input, 'person:d1', principal('d1'), 'retry-consent-key');

    expect(retried).toEqual(first);
    expect(repo.consents).toHaveLength(1);
    expect(repo.commands.filter((command) => command.commandType === 'SIGN_CONSENT')).toHaveLength(1);
  });

  it('rejects a stale modification revision before writing side effects', async () => {
    const { service, repo, audit } = build();
    repo.bookings.set('b1', makeBooking({ revision: 2 }));

    const reasons = await reasonsOf(service.modify(
      'b1',
      { expectedRevision: 1, returnAtUtc: '2999-01-01T14:00:00Z' },
      'r1',
      principal('r1'),
      'stale-modification-key',
    ));

    expect(reasons).toContain('booking-revision-conflict');
    expect(repo.events).toHaveLength(0);
    expect(audit.entries).toHaveLength(0);
  });

  it('rejects consent from a driver other than the booking driver', async () => {
    const { service, repo } = build();
    repo.bookings.set('b1', makeBooking());
    const reasons = await reasonsOf(
      service.signConsent(
        'b1',
        { driverPersonId: 'someone-else', consentDocumentVersion: 'v1' },
        'person:d1',
        principal('d1'),
        'mismatch-consent-key',
      ),
    );
    expect(reasons).toContain(BOOKING_REASON.driverMismatch);
  });

  it('allows the requester and driver to read their scoped booking', async () => {
    const { service, repo } = build();
    repo.bookings.set('b1', makeBooking());

    await expect(service.get('b1', principal('r1'))).resolves.toMatchObject({ id: 'b1' });
    await expect(service.get('b1', principal('d1'))).resolves.toMatchObject({ id: 'b1' });
  });

  it('rejects an unrelated employee reading a booking by id', async () => {
    const { service, repo } = build();
    repo.bookings.set('b1', makeBooking());

    const reasons = await reasonsOf(service.get('b1', principal('unrelated')));

    expect(reasons).toContain(BOOKING_REASON.onBehalfNotAllowed);
  });

  it('rejects a cross-organization booking read', async () => {
    const { service, repo } = build();
    repo.bookings.set('b1', makeBooking());
    const otherOrganization = {
      ...principal('r1'),
      organizationId: '00000000-0000-4000-8000-000000000099',
    };

    const reasons = await reasonsOf(service.get('b1', otherOrganization));

    expect(reasons).toContain('booking-organization-not-authorized');
  });

  it('rejects consent impersonation even when the body names the real driver', async () => {
    const { service, repo } = build();
    repo.bookings.set('b1', makeBooking());

    const reasons = await reasonsOf(
      service.signConsent(
        'b1',
        { driverPersonId: 'd1', consentDocumentVersion: 'v1' },
        'person:r1',
        principal('r1'),
        'impersonation-consent-key',
      ),
    );

    expect(reasons).toContain(BOOKING_REASON.driverMismatch);
    expect(repo.consents).toHaveLength(0);
  });

  it('rejects a client consent version that is not the server-authoritative template', async () => {
    const { service, repo, eligibility } = build();
    repo.bookings.set('b1', makeBooking());

    const reasons = await reasonsOf(service.signConsent(
      'b1',
      { driverPersonId: 'd1', consentDocumentVersion: 'client-invented-v99' },
      'person:d1',
      principal('d1'),
      'consent-version-key',
    ));

    expect(reasons).toContain(BOOKING_REASON.consentVersionChanged);
    expect(eligibility.result).toBe('ALLOW');
    expect(repo.consents).toHaveLength(0);
  });

  it('rejects submit from a person who does not own the booking', async () => {
    const { service, repo } = build();
    repo.bookings.set('b1', makeBooking({
      status: 'PendingApproval',
      consentRecordId: 'c1',
      bookingNumber: 'BK-2026-000001',
    }));

    const reasons = await reasonsOf(
      service.submit('b1', 'person:unrelated', principal('unrelated'), 'unrelated-submit-key'),
    );

    expect(reasons).toContain(BOOKING_REASON.onBehalfNotAllowed);
  });

  it('replays submit without starting a second workflow', async () => {
    const { service, repo, workflow } = build();
    repo.persons.set('r1', {
      ...bookingPerson('r1'),
      lineManagerPersonId: 'mgr',
    });
    repo.bookings.set('b1', makeBooking({
      status: 'PendingApproval',
      consentRecordId: 'c1',
      bookingNumber: 'BK-2026-000001',
    }));

    const first = await service.submit('b1', 'person:r1', principal('r1'), 'submit-replay-key');
    const replay = await service.submit('b1', 'person:r1', principal('r1'), 'submit-replay-key');

    expect(replay).toEqual(first);
    expect(workflow.starts).toBe(1);
    expect(repo.commands).toHaveLength(1);
    expect(repo.policyDecisions).toHaveLength(1);
    expect(repo.policyDecisions[0]).toMatchObject({
      decisionKey: 'booking-approval-chain',
      correlationId: 'booking:b1:submit:submit-replay-key',
      provenance: {
        decisionKey: 'booking-approval-chain',
        consumer: 'bookings',
        subjectRef: 'booking:b1',
        mode: 'legacy-only',
        source: 'legacy',
        factFingerprint: 'test-fingerprint',
      },
    });
  });

  it('SoD-01: a requester cannot approve their own booking', async () => {
    const { service, repo } = build();
    repo.bookings.set('b1', makeBooking({ status: 'PendingApproval', workflowInstanceId: 'wf1', requestedByPersonId: 'r1' }));
    await expect(
      service.decide('b1', { actorPersonId: 'r1', expectedBookingVersion: 1, expectedStepVersion: 1, decision: 'APPROVED' }, principal('r1'), 'self-approval-key'),
    ).rejects.toThrow(ForbiddenException);
    const reasons = await reasonsOf(service.decide('b1', { actorPersonId: 'r1', expectedBookingVersion: 1, expectedStepVersion: 1, decision: 'APPROVED' }, principal('r1'), 'self-approval-key-2'));
    expect(reasons).toContain(BOOKING_REASON.sodSelfApproval);
  });

  it('approval moves the booking to Approved and emits BookingConfirmed', async () => {
    const { service, repo, outbox } = build();
    repo.bookings.set('b1', makeBooking({ status: 'PendingApproval', workflowInstanceId: 'wf1', bookingNumber: 'BK-2026-000001', consentRecordId: 'c1' }));
    const dto = await service.decide('b1', { actorPersonId: 'mgr', expectedBookingVersion: 1, expectedStepVersion: 1, decision: 'APPROVED' }, principal('mgr', 'Approver'), 'approve-booking-key');
    expect(dto.status).toBe('Approved');
    expect(outbox.events.some((e) => e.eventType === 'BookingConfirmed')).toBe(true);
  });

  it('denies a SystemAdmin-only operational approval', async () => {
    const { service, repo } = build();
    repo.bookings.set('b1', makeBooking({ status: 'PendingApproval', workflowInstanceId: 'wf1', requestedByPersonId: 'r1' }));
    const reasons = await reasonsOf(service.decide(
      'b1',
      { actorPersonId: 'admin', expectedBookingVersion: 1, expectedStepVersion: 1, decision: 'APPROVED' },
      principal('admin', 'SystemAdmin'),
      'admin-approval-key',
    ));
    expect(reasons).toContain('booking-system-admin-operational-denied');
  });

  it('a material modification beyond tolerance voids consent and returns the booking to Draft', async () => {
    const { service, repo } = build();
    repo.bookings.set('b1', makeBooking({ status: 'PendingApproval', consentRecordId: 'c1', workflowInstanceId: null }));
    const dto = await service.modify(
      'b1',
      { expectedRevision: 1, returnAtUtc: '2999-01-01T14:00:00Z' },
      'r1',
      principal('r1'),
      'material-modification-key',
    );
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

  it('rejects a pooled vehicle outside the Active lifecycle on modify', async () => {
    const { service, repo } = build();
    repo.bookings.set('b1', makeBooking());
    repo.vehicles.set('v1', {
      ...repo.vehicles.get('v1'),
      lifecycleStatus: 'UnderMaintenance',
    });

    await expect(
      service.modify(
        'b1',
        { expectedRevision: 1, returnAtUtc: '2999-01-01T14:00:00Z' },
        'r1',
        principal('r1'),
        'inactive-vehicle-modification-key',
      ),
    ).rejects.toMatchObject({
      response: { reasons: [BOOKING_REASON.vehicleNotBookable] },
    });
  });

  it('a modification-requested decision returns to Draft AND clears the workflow so it can be re-submitted', async () => {
    const { service, repo, workflow } = build();
    repo.bookings.set('b1', makeBooking({ status: 'PendingApproval', workflowInstanceId: 'wf1', consentRecordId: 'c1', bookingNumber: 'BK-2026-000001' }));
    workflow.decideStatus = 'ModificationRequested';
    const dto = await service.decide('b1', { actorPersonId: 'mgr', expectedBookingVersion: 1, expectedStepVersion: 1, decision: 'MODIFICATION_REQUESTED' }, principal('mgr', 'Approver'), 'request-change-key');
    expect(dto.status).toBe('Draft');
    expect(dto.consentRecordId).toBeNull();
    expect(dto.workflowInstanceId).toBeNull(); // re-submittable (no stale workflow)
  });

  it('a material modification beyond tolerance also clears the workflow instance', async () => {
    const { service, repo } = build();
    repo.bookings.set('b1', makeBooking({ status: 'PendingApproval', consentRecordId: 'c1', workflowInstanceId: 'wf1' }));
    const dto = await service.modify(
      'b1',
      { expectedRevision: 1, returnAtUtc: '2999-01-01T14:00:00Z' },
      'r1',
      principal('r1'),
      'workflow-clearing-modification-key',
    );
    expect(dto.status).toBe('Draft');
    expect(dto.workflowInstanceId).toBeNull();
  });

  it('lets a participating approver suspend, resume, and revoke before Handover', async () => {
    const { service, repo, outbox } = build();
    repo.bookings.set('b1', makeBooking({ status: 'Approved', workflowInstanceId: 'wf1', bookingNumber: 'BK-2026-000001' }));
    const approver = principal('mgr', 'Approver');

    const suspended = await service.interveneApproval('b1', { action: 'SUSPEND', expectedRevision: 1, reason: 'Safety evidence review' }, approver, 'suspend-approval-key');
    expect(suspended.status).toBe('Approved');
    expect(repo.bookings.get('b1')?.approvalSuspendedAtUtc).toBeInstanceOf(Date);

    await service.interveneApproval('b1', { action: 'RESUME', expectedRevision: 2, reason: 'Safety evidence cleared' }, approver, 'resume-approval-key');
    expect(repo.bookings.get('b1')?.approvalSuspendedAtUtc).toBeNull();

    const revoked = await service.interveneApproval('b1', { action: 'REVOKE', expectedRevision: 3, reason: 'Operational approval withdrawn' }, approver, 'revoke-approval-key');
    expect(revoked.status).toBe('Cancelled');
    expect(repo.events.map((event) => event.eventType)).toEqual(expect.arrayContaining(['ApprovalSuspended', 'ApprovalResumed', 'ApprovalRevoked']));
    expect(outbox.events.map((event) => event.eventType)).toEqual(expect.arrayContaining(['ApprovalSuspended', 'ApprovalResumed', 'ApprovalRevoked']));
  });

  it('denies Pool intervention by an approver who did not approve the request', async () => {
    const { service, repo } = build();
    repo.approvedParticipant = false;
    repo.bookings.set('b1', makeBooking({ status: 'Approved', workflowInstanceId: 'wf1', bookingNumber: 'BK-2026-000001' }));
    const reasons = await reasonsOf(service.interveneApproval('b1', { action: 'SUSPEND', expectedRevision: 1, reason: 'Unrelated intervention' }, principal('other', 'Approver'), 'unrelated-suspend-key'));
    expect(reasons).toContain('booking-approval-intervention-not-participant');
  });

  it('blocks the row-locked Handover transition while approval is suspended', async () => {
    const { service, repo } = build();
    repo.bookings.set('b1', makeBooking({ status: 'Approved', approvalSuspendedAtUtc: new Date(), workflowInstanceId: 'wf1' }));
    await expect(service.markPickedUpInTransaction('b1', 'fleet-manager', {} as never)).rejects.toMatchObject({
      response: { reasons: [BOOKING_REASON.notReserved] },
    });
    expect(repo.bookings.get('b1')?.status).toBe('Approved');
  });
});
