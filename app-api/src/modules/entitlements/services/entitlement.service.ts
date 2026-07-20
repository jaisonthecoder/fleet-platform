import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OutboxService } from '../../../common/messaging/outbox.service';
import { toDbException } from '../../../common/database/pg-error';
import type { PlatformRole } from '../../../common/database/schema';
import {
  type AllocateEntitlement,
  type BsdWindow,
  type BsdWindowDto,
  type CreateEntitlement,
  type DecideEntitlement,
  ENTITLEMENT_REASON,
  type EntitlementConsent,
  type EntitlementDto,
  type EntitlementStatus,
} from '../../../contracts/entitlement.contract';
import { PolicyEvaluatorService } from '../../policy/services/policy-evaluator.service';
import { AuditService } from '../../platform/services/audit.service';
import { WorkflowService } from '../../workflow/services/workflow.service';
import { gradeEligibleFact, resolveApprovers, validateDateWindow } from '../internal/entitlement-rules';
import { EntitlementsRepository } from '../repositories/entitlements.repository';

type EntitlementRow = NonNullable<Awaited<ReturnType<EntitlementsRepository['findById']>>>;
const TERMINAL: ReadonlySet<string> = new Set(['Declined', 'Cancelled', 'Expired']);

/**
 * Dedicated-vehicle entitlements (C3 / M5). Flow: create → submit (PDP
 * `dedicated-vehicle-eligibility` pre-check + `entitlement-approval-chain`
 * routed through the workflow engine up to Cluster CEO) → approve/decline
 * (SoD-02: never approve your own) → consent (driver, before allocation) →
 * allocate (no consent ⇒ no allocation). BSD leave windows return the vehicle
 * to the pool. Every state change is audited + emitted transactionally; the
 * eligibility and chain come from the PDP, never hard-coded.
 */
@Injectable()
export class EntitlementService {
  constructor(
    private readonly repo: EntitlementsRepository,
    private readonly pdp: PolicyEvaluatorService,
    private readonly workflow: WorkflowService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  /** Creates a Draft entitlement request. */
  async create(input: CreateEntitlement, actorRef = 'system'): Promise<EntitlementDto> {
    const windowReasons = validateDateWindow(input.durationStart, input.durationEnd);
    if (windowReasons.length) {
      throw new BadRequestException({ title: 'Invalid entitlement window', reasons: windowReasons });
    }
    try {
      return await this.repo.transaction(async (tx) => {
        const created = await this.repo.insert(
          {
            requestType: input.requestType,
            requesterPersonId: input.requesterPersonId,
            justificationCategory: input.justificationCategory,
            justificationText: input.justificationText,
            vehicleCategoryCode: input.vehicleCategoryCode ?? null,
            durationStart: input.durationStart,
            durationEnd: input.durationEnd,
            locationNodeId: input.locationNodeId ?? null,
            businessUnit: input.businessUnit ?? null,
            costCentre: input.costCentre ?? null,
            status: 'Draft',
          },
          tx,
        );
        await this.audit.record(
          { actorRef, action: 'ENTITLEMENT_CREATED', entityRef: `entitlement:${created.id}`, after: { requestType: created.requestType } },
          tx,
        );
        await this.outbox.enqueue(
          { aggregateType: 'entitlement', aggregateId: created.id, eventType: 'EntitlementRequested', payload: { entitlementId: created.id } },
          tx,
        );
        return this.toDto(created);
      });
    } catch (error) {
      throw toDbException(error);
    }
  }

  /** Runs the eligibility pre-check and routes the request to its approval chain. */
  async submit(id: string, actorRef = 'system'): Promise<EntitlementDto> {
    const existing = await this.require(id);
    if (existing.status !== 'Draft') {
      throw new ConflictException({ title: 'Entitlement is not a draft', reasons: [ENTITLEMENT_REASON.notDraft] });
    }
    if (existing.workflowInstanceId) {
      throw new ConflictException({ title: 'Entitlement already submitted', reasons: [ENTITLEMENT_REASON.alreadySubmitted] });
    }

    const requester = await this.repo.findPerson(existing.requesterPersonId);
    const verdict = await this.pdp.evaluate({
      ruleType: 'dedicated-vehicle-eligibility',
      context: { gradeEligible: gradeEligibleFact(requester?.grade), requestType: existing.requestType },
    });
    if (verdict.decision !== 'ALLOW') {
      await this.repo.update(id, { eligibilityResult: { decision: verdict.decision, reasons: verdict.reasons, policyVersion: verdict.policyVersion } });
      await this.audit.record({ actorRef, action: 'ENTITLEMENT_ELIGIBILITY_DENIED', entityRef: `entitlement:${id}`, reason: verdict.reasons.join(',') });
      throw new ForbiddenException({ title: 'Requester not eligible for a dedicated vehicle', reasons: [ENTITLEMENT_REASON.eligibilityDenied, ...verdict.reasons] });
    }

    const chain = await this.pdp.evaluate({ ruleType: 'entitlement-approval-chain', context: { requestType: existing.requestType } });
    const route = chain.route && chain.route.length > 0 ? chain.route : ['LineManager', 'FleetManager', 'ClusterCEO'];
    const roleToPerson = new Map<string, string | null>();
    for (const role of route) {
      if (roleToPerson.has(role)) {
        continue;
      }
      roleToPerson.set(
        role,
        role === 'LineManager' ? requester?.lineManagerPersonId ?? null : await this.repo.findApproverForRole(role as PlatformRole),
      );
    }
    const approvers = resolveApprovers(route, existing.requesterPersonId, (r) => roleToPerson.get(r) ?? null);
    if (approvers.length === 0) {
      throw new UnprocessableEntityException({ title: 'No approver could be resolved', reasons: [ENTITLEMENT_REASON.noApprover] });
    }

    const view = await this.workflow.start({
      workflowType: 'entitlement-approval',
      subjectRef: `entitlement:${existing.id}`,
      slaMinutes: 48 * 60,
      steps: approvers.map((assigneePersonId) => ({ assigneePersonId })),
    });

    return this.repo.transaction(async (tx) => {
      const updated = await this.repo.update(
        id,
        { status: 'PendingApproval', workflowInstanceId: view.id, policyVersion: verdict.policyVersion, eligibilityResult: { decision: 'ALLOW', reasons: verdict.reasons, policyVersion: verdict.policyVersion } },
        tx,
      );
      await this.audit.record({ actorRef, action: 'ENTITLEMENT_SUBMITTED', entityRef: `entitlement:${id}`, after: { workflowId: view.id, approvers } }, tx);
      await this.outbox.enqueue({ aggregateType: 'entitlement', aggregateId: id, eventType: 'EntitlementSubmitted', payload: { entitlementId: id, workflowId: view.id } }, tx);
      return this.toDto(updated);
    });
  }

  /** Records an approver decision (SoD-02 enforced) and reflects it on the request. */
  async decide(id: string, input: DecideEntitlement, decision: 'APPROVED' | 'REJECTED'): Promise<EntitlementDto> {
    const existing = await this.require(id);
    // SoD-02: neither the acting approver nor the person they act on behalf of
    // may be the requester (never approve your own entitlement).
    if (input.actorPersonId === existing.requesterPersonId || input.onBehalfOfPersonId === existing.requesterPersonId) {
      throw new ForbiddenException({ title: 'Self-approval is not permitted', reasons: [ENTITLEMENT_REASON.sodSelfApproval] });
    }
    if (existing.status !== 'PendingApproval' || !existing.workflowInstanceId) {
      throw new ConflictException({ title: 'Entitlement is not pending approval', reasons: [ENTITLEMENT_REASON.notPendingApproval] });
    }

    const view = await this.workflow.decide(existing.workflowInstanceId, {
      actorPersonId: input.actorPersonId,
      decision,
      reason: input.reason,
      onBehalfOfPersonId: input.onBehalfOfPersonId,
    });

    let next: EntitlementStatus = existing.status;
    if (view.status === 'Approved') {
      next = 'Approved';
    } else if (view.status === 'Rejected') {
      next = 'Declined';
    } else if (view.status === 'ModificationRequested') {
      next = 'Draft';
    }

    return this.repo.transaction(async (tx) => {
      // A modification request returns the entitlement to Draft; clear the
      // workflow instance so the requester can re-submit a fresh chain.
      const patch = next === 'Draft' ? { status: next, workflowInstanceId: null } : { status: next };
      const updated = await this.repo.update(id, patch, tx);
      await this.audit.record({ actorRef: input.actorPersonId, action: 'ENTITLEMENT_DECISION', entityRef: `entitlement:${id}`, reason: input.reason, after: { decision, status: next } }, tx);
      if (next === 'Approved') {
        await this.outbox.enqueue({ aggregateType: 'entitlement', aggregateId: id, eventType: 'EntitlementDecided', payload: { entitlementId: id, decision: 'APPROVED' } }, tx);
      }
      if (next === 'Declined') {
        await this.outbox.enqueue({ aggregateType: 'entitlement', aggregateId: id, eventType: 'EntitlementDecided', payload: { entitlementId: id, decision: 'REJECTED' } }, tx);
      }
      return this.toDto(updated);
    });
  }

  /** Captures the driver's consent (required before allocation). */
  async consent(id: string, input: EntitlementConsent, actorRef = 'system'): Promise<EntitlementDto> {
    const existing = await this.require(id);
    if (existing.status !== 'Approved') {
      throw new ConflictException({ title: 'Entitlement is not approved', reasons: [ENTITLEMENT_REASON.notApproved] });
    }
    if (input.driverPersonId !== existing.requesterPersonId) {
      throw new BadRequestException({ title: 'Consent driver mismatch', reasons: ['entitlement-consent-driver-mismatch'] });
    }
    return this.repo.transaction(async (tx) => {
      const updated = await this.repo.update(
        id,
        { consentSignedAtUtc: new Date(), consentDocumentVersion: input.consentDocumentVersion, consentSignatureRef: input.signatureRef ?? null },
        tx,
      );
      await this.audit.record({ actorRef, action: 'ENTITLEMENT_CONSENT_SIGNED', entityRef: `entitlement:${id}` }, tx);
      await this.outbox.enqueue({ aggregateType: 'entitlement', aggregateId: id, eventType: 'ConsentSigned', payload: { entitlementId: id } }, tx);
      return this.toDto(updated);
    });
  }

  /** Allocates an approved + consented entitlement to a vehicle (no consent ⇒ no allocation). */
  async allocate(id: string, input: AllocateEntitlement, actorRef = 'system'): Promise<EntitlementDto> {
    const existing = await this.require(id);
    if (existing.status !== 'Approved') {
      throw new ConflictException({ title: 'Entitlement is not approved', reasons: [ENTITLEMENT_REASON.notApproved] });
    }
    if (!existing.consentSignedAtUtc) {
      throw new ConflictException({ title: 'Driver consent is required before allocation', reasons: [ENTITLEMENT_REASON.consentRequired] });
    }
    return this.repo.transaction(async (tx) => {
      const updated = await this.repo.update(id, { status: 'Allocated', vehicleId: input.vehicleId, allocatedAtUtc: new Date() }, tx);
      await this.audit.record({ actorRef, action: 'ENTITLEMENT_ALLOCATED', entityRef: `entitlement:${id}`, after: { vehicleId: input.vehicleId } }, tx);
      await this.outbox.enqueue({ aggregateType: 'entitlement', aggregateId: id, eventType: 'EntitlementAllocated', payload: { entitlementId: id, vehicleId: input.vehicleId } }, tx);
      return this.toDto(updated);
    });
  }

  /** Records a BSD (leave) return window for an allocated entitlement. */
  async addBsdWindow(id: string, input: BsdWindow, actorRef = 'system'): Promise<BsdWindowDto> {
    const existing = await this.require(id);
    if (existing.status !== 'Allocated') {
      throw new ConflictException({ title: 'Entitlement is not allocated', reasons: [ENTITLEMENT_REASON.notApproved] });
    }
    const start = new Date(input.windowStart);
    const end = new Date(input.windowEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
      throw new BadRequestException({ title: 'Invalid BSD window', reasons: [ENTITLEMENT_REASON.windowInvalid] });
    }
    const row = await this.repo.insertBsdWindow({
      entitlementRequestId: id,
      vehicleId: input.vehicleId,
      windowStart: start,
      windowEnd: end,
      reason: input.reason ?? null,
      status: 'Proposed',
    });
    await this.audit.record({ actorRef, action: 'ENTITLEMENT_BSD_WINDOW_ADDED', entityRef: `entitlement:${id}`, after: { vehicleId: input.vehicleId } });
    await this.outbox.enqueue({ aggregateType: 'entitlement', aggregateId: id, eventType: 'BsdReturnDue', payload: { entitlementId: id, windowStart: start.toISOString(), windowEnd: end.toISOString() } });
    return {
      id: row.id,
      entitlementRequestId: row.entitlementRequestId,
      vehicleId: row.vehicleId,
      windowStart: row.windowStart.toISOString(),
      windowEnd: row.windowEnd.toISOString(),
      status: row.status,
      reason: row.reason,
    };
  }

  /** Cancels a non-terminal entitlement. */
  async cancel(id: string, actorRef = 'system'): Promise<EntitlementDto> {
    const existing = await this.require(id);
    if (TERMINAL.has(existing.status)) {
      throw new ConflictException({ title: 'Entitlement is already terminal', reasons: [ENTITLEMENT_REASON.terminal] });
    }
    return this.repo.transaction(async (tx) => {
      const updated = await this.repo.update(id, { status: 'Cancelled' }, tx);
      await this.audit.record({ actorRef, action: 'ENTITLEMENT_CANCELLED', entityRef: `entitlement:${id}` }, tx);
      return this.toDto(updated);
    });
  }

  async get(id: string): Promise<EntitlementDto> {
    return this.toDto(await this.require(id));
  }

  async list(limit = 50, offset = 0): Promise<EntitlementDto[]> {
    const rows = await this.repo.list(limit, offset);
    return rows.map((r) => this.toDto(r));
  }

  // ---- internals -------------------------------------------------------------

  private async require(id: string): Promise<EntitlementRow> {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new NotFoundException({ title: 'Unknown entitlement', reasons: [`entitlement-not-found:${id}`] });
    }
    return row;
  }

  private toDto(row: EntitlementRow): EntitlementDto {
    return {
      id: row.id,
      requestType: row.requestType as EntitlementDto['requestType'],
      requesterPersonId: row.requesterPersonId,
      justificationCategory: row.justificationCategory,
      justificationText: row.justificationText,
      vehicleCategoryCode: row.vehicleCategoryCode,
      vehicleId: row.vehicleId,
      durationStart: row.durationStart ?? '',
      durationEnd: row.durationEnd ?? '',
      status: row.status,
      workflowInstanceId: row.workflowInstanceId,
      policyVersion: row.policyVersion,
      consentSignedAtUtc: row.consentSignedAtUtc ? row.consentSignedAtUtc.toISOString() : null,
      allocatedAtUtc: row.allocatedAtUtc ? row.allocatedAtUtc.toISOString() : null,
      createdAtUtc: row.createdAtUtc.toISOString(),
    };
  }
}
