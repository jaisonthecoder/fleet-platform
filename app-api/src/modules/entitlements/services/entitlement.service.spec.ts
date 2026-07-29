import { BadRequestException, HttpException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ENTITLEMENT_REASON } from '../../../contracts/entitlement.contract';
import type { PolicyEvaluationResponse } from '../../../contracts/policy-evaluation.contract';
import { EntitlementService } from './entitlement.service';

async function reasonsOf(promise: Promise<unknown>): Promise<string[]> {
  try {
    await promise;
  } catch (error) {
    return ((error as HttpException).getResponse() as { reasons?: string[] }).reasons ?? [];
  }
  throw new Error('expected the promise to reject');
}

function makeEntitlement(over: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    organizationId: 'org',
    requestType: 'LongTerm',
    driverOption: 'WithoutDriver',
    requesterPersonId: 'req',
    requestedByPersonId: 'req',
    assignedDriverPersonId: 'req',
    justificationCategory: 'executive-assignment',
    justificationText: 'need',
    vehicleCategoryCode: null,
    preferredVehicleId: null,
    preferenceNote: null,
    vehicleId: null,
    durationStart: '2026-08-01',
    durationEnd: '2026-12-31',
    locationNodeId: null,
    businessUnit: null,
    costCentre: null,
    status: 'Draft',
    revision: 1,
    workflowInstanceId: null,
    workflowDefinitionVersionId: null,
    policyVersion: null,
    eligibilityResult: null,
    approvalRouteProvenance: null,
    eligibilityPreviewId: null,
    consentSignedAtUtc: null,
    consentDocumentVersion: null,
    consentSignatureRef: null,
    allocatedAtUtc: null,
    createdAtUtc: new Date('2026-07-18T00:00:00Z'),
    updatedAtUtc: new Date('2026-07-18T00:00:00Z'),
    ...over,
  };
}

class FakeRepo {
  entitlements = new Map<string, ReturnType<typeof makeEntitlement>>();
  persons = new Map<string, Record<string, unknown>>();
  bsd: Array<Record<string, unknown>> = [];
  failInsertCode: string | null = null;
  commands: Array<Record<string, unknown>> = [];
  previews = new Map<string, Record<string, unknown>>();
  professionalDrivers = [{ personId: 'driver-1', fullName: 'Rashed Obaid', employeeId: 'EMP-1018', scopeName: 'Home Pool' }];
  async transaction<T>(work: (tx: unknown) => Promise<T>): Promise<T> {
    const entitlementSnapshot = new Map(
      [...this.entitlements].map(([id, row]) => [id, { ...row }]),
    );
    const commandSnapshot = this.commands.map((command) => ({ ...command }));
    try {
      return await work({});
    } catch (error) {
      this.entitlements = entitlementSnapshot;
      this.commands = commandSnapshot;
      throw error;
    }
  }
  async insert(values: Record<string, unknown>) {
    if (this.failInsertCode) {
      const err = new Error('db constraint') as Error & { code: string };
      err.code = this.failInsertCode;
      throw err;
    }
    const row = makeEntitlement({ ...values, id: 'e1' });
    this.entitlements.set(row.id, row);
    return row;
  }
  async findById(id: string) {
    return this.entitlements.get(id);
  }
  async update(id: string, patch: Record<string, unknown>) {
    const row = { ...this.entitlements.get(id)!, ...patch };
    this.entitlements.set(id, row);
    return row;
  }
  async updateOwnAtRevision(
    id: string,
    organizationId: string,
    requesterPersonId: string,
    expectedRevision: number,
    patch: Record<string, unknown>,
  ) {
    const current = this.entitlements.get(id);
    if (
      !current ||
      current.organizationId !== organizationId ||
      current.requesterPersonId !== requesterPersonId ||
      current.revision !== expectedRevision
    ) return null;
    const row = { ...current, ...patch, revision: current.revision + 1 };
    this.entitlements.set(id, row);
    return row;
  }
  async list() {
    return [...this.entitlements.values()];
  }
  async listOwn(organizationId: string, personId: string) {
    return [...this.entitlements.values()].filter(
      (row) => row.organizationId === organizationId && row.requesterPersonId === personId,
    );
  }
  async findByIdInOrganization(id: string, organizationId: string) {
    const row = this.entitlements.get(id);
    return row?.organizationId === organizationId ? row : undefined;
  }
  async findByIdForUpdate(id: string, organizationId: string) {
    return this.findByIdInOrganization(id, organizationId);
  }
  async updateAtRevision(id: string, organizationId: string, expectedRevision: number, patch: Record<string, unknown>) {
    const current = await this.findByIdInOrganization(id, organizationId);
    if (!current || current.revision !== expectedRevision) return null;
    const row = { ...current, ...patch, revision: current.revision + 1 };
    this.entitlements.set(id, row);
    return row;
  }
  async findCommand(organizationId: string, actorPersonId: string, commandType: string, idempotencyKey: string) {
    return this.commands.find((command) =>
      command.organizationId === organizationId &&
      command.actorPersonId === actorPersonId &&
      command.commandType === commandType &&
      command.idempotencyKey === idempotencyKey,
    );
  }
  async claimCommand(values: Record<string, unknown>) {
    if (await this.findCommand(
      values.organizationId as string,
      values.actorPersonId as string,
      values.commandType as string,
      values.idempotencyKey as string,
    )) return null;
    const command = { ...values, id: `command-${this.commands.length + 1}` };
    this.commands.push(command);
    return command;
  }
  async completeCommand(id: string, resultEntitlementId: string, resultBody: unknown) {
    Object.assign(this.commands.find((command) => command.id === id)!, { resultEntitlementId, resultBody });
  }
  async descendantNodeIds() {
    return ['scope'];
  }
  async listEligibleVehicleOptions() {
    return [{
      vehicleId: 'vehicle-1',
      plate: 'AD 10001',
      makeCode: 'TOYOTA',
      modelCode: 'FORTUNER',
      vehicleClass: 'SUV',
      fuelTypeCode: 'PETROL',
      locationName: 'Home Pool',
    }];
  }
  async insertEligibilityPreview(values: Record<string, unknown>) {
    const row = { ...values, id: `preview-${this.previews.size + 1}` };
    this.previews.set(row.id, row);
    return row;
  }
  async findEligibilityPreview(id: string) {
    return this.previews.get(id);
  }
  async findPerson(id: string) {
    return this.persons.get(id);
  }
  async listProfessionalDrivers() {
    return this.professionalDrivers;
  }
  async findApproverForRole(): Promise<string | null> {
    return 'mgr';
  }
  async findCurrentWorkflowStep() {
    return { id: 'step-1', stateVersion: 1 };
  }
  async listApprovalWorklist() {
    return [];
  }
  async insertBsdWindow(values: Record<string, unknown>) {
    const row = { id: 'w1', windowStart: new Date(values.windowStart as Date), windowEnd: new Date(values.windowEnd as Date), status: 'Proposed', reason: values.reason ?? null, entitlementRequestId: values.entitlementRequestId, vehicleId: values.vehicleId };
    this.bsd.push(row);
    return row;
  }
}

class FakePdp {
  eligible: 'ALLOW' | 'DENY' = 'ALLOW';
  async evaluate(req: { ruleType: string }): Promise<PolicyEvaluationResponse> {
    if (req.ruleType === 'dedicated-vehicle-eligibility') {
      return {
        decision: this.eligible,
        reasons: this.eligible === 'ALLOW' ? ['ok'] : ['dedicated-not-eligible'],
        policyVersion: 'manual-dedicated-eligibility-v1',
        policyRuleId: '40000000-0000-4000-8000-000000000001',
        policyVersionId: '50000000-0000-4000-8000-000000000001',
        resolvedScopeNodeId: null,
        scopeThatAnswered: 'group',
        value: this.eligible === 'ALLOW'
          ? { permittedVehicleClasses: ['SEDAN', 'SUV'], maxDurationDays: 365 }
          : undefined,
      };
    }
    return { decision: 'ROUTE_TO', reasons: [], policyVersion: 'chain-v1', scopeThatAnswered: 'group', route: ['LineManager'] };
  }
}

class FakeWorkflow {
  decideStatus = 'Approved';
  async start() {
    return { id: 'wf1', workflowType: 'entitlement-approval', subjectRef: 'entitlement:e1', currentStep: 0, status: 'Pending', definitionDeploymentId: 'deployment-1', stateVersion: 1, steps: [{ id: 'step-1', sequence: 0, assigneePersonId: 'mgr', decidedByPersonId: null, onBehalfOfPersonId: null, decision: null, reason: null, stateVersion: 1, slaDueAt: null }] };
  }
  async decide() {
    return { id: 'wf1', workflowType: 'entitlement-approval', subjectRef: 'entitlement:e1', currentStep: 0, status: this.decideStatus, steps: [] };
  }
  async decideInTransaction() {
    return { view: { id: 'wf1', workflowType: 'entitlement-approval', subjectRef: 'entitlement:e1', currentStep: 0, status: this.decideStatus, definitionDeploymentId: 'deployment-1', stateVersion: 2, steps: [] }, decidedStepId: 'step-1' };
  }
}
class FakeAudit {
  async record() {}
}
class FakeOutbox {
  events: Array<Record<string, unknown>> = [];
  async enqueue(e: Record<string, unknown>) {
    this.events.push(e);
    return 'm1';
  }
}

class FakeScopeAuthorization {
  async canRolesAtScope() {
    return true;
  }
  async assertRolesAtScope() {
    return undefined;
  }
}

class FakeLookups {
  async getValueRules(typeCode: string) {
    if (typeCode === 'dedicated-vehicle-justification-category') {
      return [{
        code: 'OPERATIONAL_REQUIREMENT',
        metadata: { allowedRequestTypes: ['LongTerm', 'Temporary'] },
      }];
    }
    return [{ code: 'SEDAN', metadata: {} }, { code: 'SUV', metadata: {} }];
  }
  async getValues() {
    return [];
  }
}

class FakeConsentTemplates {
  template: { version: string; contentHash: string; effectiveAtUtc: string; content: { en: string; ar: string } } | null = null;
  async current() { return this.template; }
}

function build() {
  const repo = new FakeRepo();
  const pdp = new FakePdp();
  const workflow = new FakeWorkflow();
  const audit = new FakeAudit();
  const outbox = new FakeOutbox();
  const consentTemplates = new FakeConsentTemplates();
  repo.persons.set('req', {
    id: 'req',
    organizationId: 'org',
    fullName: 'Requester',
    grade: 'Director',
    employmentStatus: 'Active',
    lineManagerPersonId: 'mgr',
    homePoolNodeId: 'scope',
    homePoolName: 'Home Pool',
  });
  repo.previews.set('60000000-0000-4000-8000-000000000001', {
    id: '60000000-0000-4000-8000-000000000001',
    organizationId: 'org',
    requesterPersonId: 'req',
    locationNodeId: 'scope',
    requestFingerprint: createHash('sha256').update(JSON.stringify({
      requestType: 'LongTerm',
      driverOption: 'WithoutDriver',
      justificationCategory: 'operational-need',
      durationStart: '2026-08-01',
      durationEnd: '2026-12-31',
      locationNodeId: 'scope',
      requestedVehicleClass: null,
    })).digest('hex'),
    policyRuleId: '40000000-0000-4000-8000-000000000001',
    policyVersionId: '50000000-0000-4000-8000-000000000001',
    policyVersion: 'manual-dedicated-eligibility-v1',
    decision: 'ALLOW',
    reasons: ['dedicated-manual-policy-eligible'],
    permittedVehicleClasses: ['SEDAN', 'SUV'],
    eligibleVehicleIds: ['vehicle-1'],
    evaluatedAtUtc: new Date(),
    expiresAtUtc: new Date(Date.now() + 15 * 60_000),
  });
  const service = new EntitlementService(
    repo as never,
    pdp as never,
    workflow as never,
    audit as never,
    outbox as never,
    new FakeScopeAuthorization() as never,
    new FakeLookups() as never,
    consentTemplates as never,
  );
  return { service, repo, pdp, workflow, outbox, consentTemplates };
}

describe('EntitlementService', () => {
  const principal = {
    organizationId: 'org',
    userId: 'user',
    personId: 'req',
    entraObjectId: null,
    email: 'requester@example.test',
    roles: [{ role: 'Employee', scopeNodeId: 'scope' }],
    isDevLogin: false,
  } as const;
  const approverPrincipal = {
    ...principal,
    personId: 'mgr',
    email: 'manager@example.test',
    roles: [{ role: 'Approver', scopeNodeId: 'scope' }],
  } as const;
  const draftInput = {
    requestType: 'LongTerm' as const,
    driverOption: 'WithoutDriver' as const,
    requesterPersonId: 'req',
    justificationCategory: 'operational-need',
    justificationText: 'Frequent travel between sites',
    preferenceNote: 'Toyota Fortuner if available',
    durationStart: '2026-08-01',
    durationEnd: '2026-12-31',
    locationNodeId: 'scope',
    eligibilityPreviewId: '60000000-0000-4000-8000-000000000001',
  };

  it('projects configured eligibility with submission enabled', async () => {
    const { service } = build();
    const result = await service.context(principal as never);
    expect(result.capabilities.createDraft.enabled).toBe(true);
    expect(result.capabilities.eligibilityPreview.enabled).toBe(true);
    expect(result.capabilities.submit).toEqual({ enabled: true, blockingReasons: [] });
    expect(result.capabilities.withDriver).toEqual({ enabled: true, blockingReasons: [] });
    expect(result.capabilities.allocation.enabled).toBe(false);
  });

  it('returns permitted classes and bounded safe Vehicles from the manual policy', async () => {
    const { service } = build();
    const result = await service.eligibilityPreview({
      requestType: 'LongTerm',
      driverOption: 'WithoutDriver',
      justificationCategory: 'OPERATIONAL_REQUIREMENT',
      durationStart: '2026-08-01',
      durationEnd: '2026-12-31',
      locationNodeId: 'scope',
      requestedVehicleClass: 'SUV',
    }, principal as never);

    expect(result).toMatchObject({
      previewId: 'preview-2',
      decision: 'ALLOW',
      policyVersion: 'manual-dedicated-eligibility-v1',
      permittedVehicleClasses: ['SUV'],
      eligibleVehicleOptions: [{
        vehicleId: 'vehicle-1',
        plate: 'AD 10001',
        vehicleClass: 'SUV',
      }],
    });
    expect(JSON.stringify(result)).not.toMatch(/vin|vendor|lease|insurance|mulkiya/i);
  });

  it('returns a policy denial without exposing Vehicle options', async () => {
    const { service, pdp } = build();
    pdp.eligible = 'DENY';
    const result = await service.eligibilityPreview({
      requestType: 'LongTerm',
      driverOption: 'WithoutDriver',
      justificationCategory: 'OPERATIONAL_REQUIREMENT',
      durationStart: '2026-08-01',
      durationEnd: '2026-12-31',
      locationNodeId: 'scope',
    }, principal as never);

    expect(result.decision).toBe('DENY');
    expect(result.eligibleVehicleOptions).toEqual([]);
  });

  it('rejects a justification code outside manually configured reference data', async () => {
    const { service } = build();
    const reasons = await reasonsOf(service.eligibilityPreview({
      requestType: 'Temporary',
      driverOption: 'WithoutDriver',
      justificationCategory: 'CLIENT_INVENTED',
      durationStart: '2026-08-01',
      durationEnd: '2026-08-31',
      locationNodeId: 'scope',
    }, principal as never));
    expect(reasons).toContain('entitlement-justification-category-invalid:CLIENT_INVENTED');
  });

  it('rejects a forged requester before creating a Draft', async () => {
    const { service, repo } = build();
    const reasons = await reasonsOf(service.create(
      { ...draftInput, requesterPersonId: 'other' },
      'req',
      principal as never,
      'forged-request-key',
    ));
    expect(reasons).toContain(ENTITLEMENT_REASON.requesterMismatch);
    expect(repo.entitlements.size).toBe(0);
  });

  it('replays the same Draft command without creating a duplicate', async () => {
    const { service, repo } = build();
    const first = await service.create(draftInput, 'req', principal as never, 'dedicated-draft-key');
    const replay = await service.create(draftInput, 'req', principal as never, 'dedicated-draft-key');
    expect(replay).toEqual(first);
    expect(repo.entitlements.size).toBe(1);
    expect(repo.commands).toHaveLength(1);
  });

  it('updates an owner Draft and clears stale eligibility and preferred Vehicle evidence', async () => {
    const { service, repo, outbox } = build();
    repo.entitlements.set('e1', makeEntitlement({
      locationNodeId: 'scope',
      preferredVehicleId: 'vehicle-1',
      eligibilityResult: { decision: 'ALLOW' },
      policyVersion: 'old-policy',
      approvalRouteProvenance: { route: ['old'] },
    }));

    const updated = await service.updateDraft(
      'e1',
      {
        expectedRevision: 1,
        justificationText: 'Updated operational need',
        preferenceNote: 'Left-hand drive preferred',
      },
      principal as never,
      'update-draft-key',
    );

    expect(updated).toMatchObject({
      revision: 2,
      justificationText: 'Updated operational need',
      preferenceNote: 'Left-hand drive preferred',
      preferredVehicleId: null,
      eligibilityResult: null,
      policyVersion: null,
      approvalRouteProvenance: null,
    });
    expect(outbox.events.some((event) => event.eventType === 'EntitlementDraftChanged')).toBe(true);
  });

  it('rejects a stale Draft revision without persisting a command', async () => {
    const { service, repo } = build();
    repo.entitlements.set('e1', makeEntitlement({ revision: 2, locationNodeId: 'scope' }));

    const reasons = await reasonsOf(service.updateDraft(
      'e1',
      { expectedRevision: 1, justificationText: 'Stale edit' },
      principal as never,
      'stale-update-key',
    ));

    expect(reasons).toContain(ENTITLEMENT_REASON.revisionConflict);
    expect(repo.entitlements.get('e1')?.justificationText).toBe('need');
    expect(repo.commands).toHaveLength(0);
  });

  it('replays the same Draft update key without a second revision bump', async () => {
    const { service, repo } = build();
    repo.entitlements.set('e1', makeEntitlement({ locationNodeId: 'scope' }));
    const input = { expectedRevision: 1, preferenceNote: 'Toyota Fortuner if available' };

    const first = await service.updateDraft('e1', input, principal as never, 'retry-update-key');
    const replay = await service.updateDraft('e1', input, principal as never, 'retry-update-key');

    expect(replay).toEqual(first);
    expect(replay.revision).toBe(2);
    expect(repo.commands).toHaveLength(1);
  });

  it('rejects a preferred Vehicle until eligibility can project safe options', async () => {
    const { service, repo } = build();
    const reasons = await reasonsOf(service.create(
      { ...draftInput, preferredVehicleId: '00000000-0000-4000-8000-000000000001' },
      'req',
      principal as never,
      'preferred-vehicle-key',
    ));
    expect(reasons).toContain(ENTITLEMENT_REASON.preferredVehicleInvalid);
    expect(repo.entitlements.size).toBe(0);
  });

  it('rejects Draft creation when eligibility evidence is missing or mismatched', async () => {
    const { service, repo } = build();
    expect(await reasonsOf(service.create(
      { ...draftInput, eligibilityPreviewId: undefined },
      'req',
      principal as never,
      'missing-preview-key',
    ))).toContain(ENTITLEMENT_REASON.eligibilityPreviewRequired);
    expect(await reasonsOf(service.create(
      { ...draftInput, durationEnd: '2027-01-31' },
      'req',
      principal as never,
      'mismatched-preview-key',
    ))).toContain(ENTITLEMENT_REASON.eligibilityPreviewMismatch);
    expect(repo.entitlements.size).toBe(0);
  });

  it('submits a preview-backed Draft exactly once while consent remains gated', async () => {
    const { service, repo } = build();
    repo.entitlements.set('e1', makeEntitlement({ locationNodeId: 'scope', justificationCategory: 'operational-need', eligibilityPreviewId: '60000000-0000-4000-8000-000000000001' }));
    const first = await service.submit('e1', { expectedRevision: 1 }, principal as never, 'submit-key-1');
    const replay = await service.submit('e1', { expectedRevision: 1 }, principal as never, 'submit-key-1');
    expect(first).toMatchObject({ status: 'PendingApproval', workflowInstanceId: 'wf1', revision: 2 });
    expect(replay).toEqual(first);
    expect(repo.commands.filter((command) => command.commandType === 'SUBMIT')).toHaveLength(1);
    repo.entitlements.set('e1', { ...repo.entitlements.get('e1')!, status: 'Approved' });
    expect(await reasonsOf(service.consent('e1', {
      expectedRevision: 2,
      consentDocumentVersion: 'unapproved',
    }, principal as never, 'consent-gated-key'))).toContain(ENTITLEMENT_REASON.consentTemplatePending);
    expect(repo.entitlements.get('e1')?.consentSignedAtUtc).toBeNull();
  });

  it('rejects submission when the revision is stale', async () => {
    const { service, repo } = build();
    repo.entitlements.set('e1', makeEntitlement({ revision: 2, locationNodeId: 'scope', eligibilityPreviewId: '60000000-0000-4000-8000-000000000001' }));
    expect(await reasonsOf(service.submit('e1', { expectedRevision: 1 }, principal as never, 'stale-submit-key'))).toContain(ENTITLEMENT_REASON.stateConflict);
  });

  it('denies requester self-approval', async () => {
    const { service, repo } = build();
    repo.entitlements.set('e1', makeEntitlement({ status: 'PendingApproval', workflowInstanceId: 'wf1' }));
    const reasons = await reasonsOf(service.decide('e1', { actorPersonId: 'req', expectedRevision: 1, expectedStepVersion: 1 }, 'APPROVED', principal as never, 'self-approve-key'));
    expect(reasons).toContain(ENTITLEMENT_REASON.sodSelfApproval);
  });

  it('applies and replays an assigned approval decision', async () => {
    const { service, repo, workflow } = build();
    repo.entitlements.set('e1', makeEntitlement({ status: 'PendingApproval', workflowInstanceId: 'wf1' }));
    workflow.decideStatus = 'Approved';
    const input = { actorPersonId: 'mgr', expectedRevision: 1, expectedStepVersion: 1 };
    const first = await service.decide('e1', input, 'APPROVED', approverPrincipal as never, 'approve-key-1');
    const replay = await service.decide('e1', input, 'APPROVED', approverPrincipal as never, 'approve-key-1');
    expect(first.status).toBe('Approved');
    expect(replay).toEqual(first);
  });

  it('maps a DB constraint violation on create to a 4xx (not a 500)', async () => {
    const { service, repo } = build();
    repo.failInsertCode = '23503'; // foreign_key_violation (unknown requester)
    await expect(
      service.create({ requestType: 'LongTerm', requesterPersonId: '00000000-0000-4000-8000-000000000009', justificationCategory: 'x', justificationText: 'y', durationStart: '2026-08-01', durationEnd: '2026-08-31' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns a request for modification as an explicit lifecycle state', async () => {
    const { service, repo, workflow } = build();
    repo.entitlements.set('e1', makeEntitlement({ status: 'PendingApproval', workflowInstanceId: 'wf1' }));
    workflow.decideStatus = 'ModificationRequested';
    const result = await service.decide('e1', { actorPersonId: 'mgr', expectedRevision: 1, expectedStepVersion: 1, reason: 'Clarify operational need' }, 'MODIFICATION_REQUESTED', approverPrincipal as never, 'modify-key-1');
    expect(result.status).toBe('ModificationRequested');
  });

  it('keeps allocation unavailable before consent', async () => {
    const { service, repo } = build();
    repo.entitlements.set('e1', makeEntitlement({ status: 'Approved', locationNodeId: 'scope' }));
    const reasons = await reasonsOf(service.allocate('e1', { vehicleId: '00000000-0000-4000-8000-000000000001', expectedRevision: 1 }, principal as never, 'allocation-not-ready-key'));
    expect(reasons).toContain(ENTITLEMENT_REASON.stateConflict);
  });

  it('does not let unapproved consent reach the allocation gate', async () => {
    const { service, repo } = build();
    repo.entitlements.set('e1', makeEntitlement({ status: 'Approved' }));
    const reasons = await reasonsOf(service.consent('e1', {
      expectedRevision: 1,
      consentDocumentVersion: 'c-v0',
    }, principal as never, 'consent-unapproved-key'));
    expect(reasons).toContain(ENTITLEMENT_REASON.consentTemplatePending);
    expect(repo.entitlements.get('e1')?.status).toBe('Approved');
    expect(repo.entitlements.get('e1')?.vehicleId).toBeNull();
  });

  it('rejects all consent before evaluating a client-supplied driver identity', async () => {
    const { service, repo } = build();
    repo.entitlements.set('e1', makeEntitlement({ status: 'Approved' }));
    const reasons = await reasonsOf(service.consent('e1', {
      expectedRevision: 1,
      consentDocumentVersion: 'c',
    }, { ...principal, personId: 'other' } as never, 'consent-other-key'));
    expect(reasons).toContain(ENTITLEMENT_REASON.consentTemplatePending);
    expect(repo.entitlements.get('e1')?.consentSignedAtUtc).toBeNull();
  });
});
