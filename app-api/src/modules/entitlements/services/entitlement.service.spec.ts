import { BadRequestException, ForbiddenException, HttpException } from '@nestjs/common';
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
    requesterPersonId: 'req',
    justificationCategory: 'executive-assignment',
    justificationText: 'need',
    vehicleCategoryCode: null,
    vehicleId: null,
    durationStart: '2026-08-01',
    durationEnd: '2026-12-31',
    locationNodeId: null,
    businessUnit: null,
    costCentre: null,
    status: 'Draft',
    workflowInstanceId: null,
    policyVersion: null,
    eligibilityResult: null,
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
  transaction<T>(work: (tx: unknown) => Promise<T>): Promise<T> {
    return work({});
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
  async list() {
    return [...this.entitlements.values()];
  }
  async findPerson(id: string) {
    return this.persons.get(id);
  }
  async findApproverForRole(): Promise<string | null> {
    return null;
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
      return { decision: this.eligible, reasons: this.eligible === 'ALLOW' ? ['ok'] : ['dedicated-not-eligible'], policyVersion: 'de-v1', scopeThatAnswered: 'group' };
    }
    return { decision: 'ROUTE_TO', reasons: [], policyVersion: 'chain-v1', scopeThatAnswered: 'group', route: ['LineManager'] };
  }
}

class FakeWorkflow {
  decideStatus = 'Approved';
  async start() {
    return { id: 'wf1', workflowType: 'entitlement-approval', subjectRef: 'entitlement:e1', currentStep: 0, status: 'Pending', steps: [] };
  }
  async decide() {
    return { id: 'wf1', workflowType: 'entitlement-approval', subjectRef: 'entitlement:e1', currentStep: 0, status: this.decideStatus, steps: [] };
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

function build() {
  const repo = new FakeRepo();
  const pdp = new FakePdp();
  const workflow = new FakeWorkflow();
  const audit = new FakeAudit();
  const outbox = new FakeOutbox();
  repo.persons.set('req', { id: 'req', grade: 'Director', lineManagerPersonId: 'mgr' });
  const service = new EntitlementService(repo as never, pdp as never, workflow as never, audit as never, outbox as never);
  return { service, repo, pdp, workflow, outbox };
}

describe('EntitlementService', () => {
  it('blocks submission when the PDP dedicated-vehicle eligibility denies', async () => {
    const { service, repo, pdp } = build();
    repo.entitlements.set('e1', makeEntitlement());
    pdp.eligible = 'DENY';
    const reasons = await reasonsOf(service.submit('e1'));
    expect(reasons).toContain(ENTITLEMENT_REASON.eligibilityDenied);
    expect(repo.entitlements.get('e1')?.status).toBe('Draft');
  });

  it('routes an eligible request to the approval chain (PendingApproval)', async () => {
    const { service, repo, outbox } = build();
    repo.entitlements.set('e1', makeEntitlement());
    const dto = await service.submit('e1');
    expect(dto.status).toBe('PendingApproval');
    expect(dto.workflowInstanceId).toBe('wf1');
    expect(outbox.events.some((e) => e.eventType === 'EntitlementSubmitted')).toBe(true);
  });

  it('SoD-02: a requester cannot approve their own entitlement', async () => {
    const { service, repo } = build();
    repo.entitlements.set('e1', makeEntitlement({ status: 'PendingApproval', workflowInstanceId: 'wf1' }));
    await expect(service.decide('e1', { actorPersonId: 'req' }, 'APPROVED')).rejects.toThrow(ForbiddenException);
    const reasons = await reasonsOf(service.decide('e1', { actorPersonId: 'req' }, 'APPROVED'));
    expect(reasons).toContain(ENTITLEMENT_REASON.sodSelfApproval);
  });

  it('SoD-02: a delegate cannot approve on behalf of the requester', async () => {
    const { service, repo } = build();
    repo.entitlements.set('e1', makeEntitlement({ status: 'PendingApproval', workflowInstanceId: 'wf1' }));
    const reasons = await reasonsOf(service.decide('e1', { actorPersonId: 'mgr', onBehalfOfPersonId: 'req' }, 'APPROVED'));
    expect(reasons).toContain(ENTITLEMENT_REASON.sodSelfApproval);
  });

  it('maps a DB constraint violation on create to a 4xx (not a 500)', async () => {
    const { service, repo } = build();
    repo.failInsertCode = '23503'; // foreign_key_violation (unknown requester)
    await expect(
      service.create({ requestType: 'LongTerm', requesterPersonId: '00000000-0000-4000-8000-000000000009', justificationCategory: 'x', justificationText: 'y', durationStart: '2026-08-01', durationEnd: '2026-08-31' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('approves via the workflow and moves to Approved', async () => {
    const { service, repo } = build();
    repo.entitlements.set('e1', makeEntitlement({ status: 'PendingApproval', workflowInstanceId: 'wf1' }));
    const dto = await service.decide('e1', { actorPersonId: 'mgr' }, 'APPROVED');
    expect(dto.status).toBe('Approved');
  });

  it('refuses allocation without driver consent (no consent ⇒ no allocation)', async () => {
    const { service, repo } = build();
    repo.entitlements.set('e1', makeEntitlement({ status: 'Approved' }));
    const reasons = await reasonsOf(service.allocate('e1', { vehicleId: 'v1' }));
    expect(reasons).toContain(ENTITLEMENT_REASON.consentRequired);
  });

  it('allocates once approved and consented', async () => {
    const { service, repo, outbox } = build();
    repo.entitlements.set('e1', makeEntitlement({ status: 'Approved' }));
    await service.consent('e1', { driverPersonId: 'req', consentDocumentVersion: 'c-v0' });
    const dto = await service.allocate('e1', { vehicleId: 'v1' });
    expect(dto.status).toBe('Allocated');
    expect(dto.vehicleId).toBe('v1');
    expect(outbox.events.some((e) => e.eventType === 'EntitlementAllocated')).toBe(true);
  });

  it('rejects consent from a driver other than the requester', async () => {
    const { service, repo } = build();
    repo.entitlements.set('e1', makeEntitlement({ status: 'Approved' }));
    await expect(service.consent('e1', { driverPersonId: 'other', consentDocumentVersion: 'c' })).rejects.toThrow(BadRequestException);
  });
});
