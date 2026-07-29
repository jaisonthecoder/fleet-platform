import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Principal } from '../../../common/auth/principal';
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
  type EntitlementApprovalWorkItemDto,
  type EntitlementAllocationWorkItemDto,
  type EntitlementConsentContextDto,
  type EntitlementContextDto,
  type EntitlementDto,
  type EntitlementEligibilityPreview,
  type EntitlementEligibilityPreviewDto,
  type EntitlementProfessionalDriverDto,
  type EntitlementEventDto,
  type EntitlementLifecycleCommand,
  type EntitlementReconciliationReason,
  type EntitlementReconciliationReportDto,
  type EntitlementStatus,
  type SubmitEntitlement,
  type RenewEntitlement,
  type UpdateEntitlementDraft,
} from '../../../contracts/entitlement.contract';
import { PolicyEvaluatorService } from '../../policy/services/policy-evaluator.service';
import { LookupService } from '../../config/services/lookup.service';
import { AuditService } from '../../platform/services/audit.service';
import { ScopeAuthorizationService } from '../../platform/services/scope-authorization.service';
import { WorkflowService } from '../../workflow/services/workflow.service';
import { resolveApprovers, validateDateWindow } from '../internal/entitlement-rules';
import { EntitlementsRepository } from '../repositories/entitlements.repository';
import { EntitlementConsentTemplateProvider } from './entitlement-consent-template.provider';

type EntitlementRow = NonNullable<Awaited<ReturnType<EntitlementsRepository['findById']>>>;
const dedicatedPolicyValueSchema = z.object({
  permittedVehicleClasses: z.array(z.string().min(1)).min(1).max(20),
  maxDurationDays: z.number().int().positive().max(3650),
});
const JUSTIFICATION_LOOKUP = 'dedicated-vehicle-justification-category';
const VEHICLE_CLASS_LOOKUP = 'dedicated-vehicle-class';

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
    private readonly scopeAuthorization: ScopeAuthorizationService,
    private readonly lookups: LookupService,
    private readonly consentTemplates: EntitlementConsentTemplateProvider,
  ) {}

  /** Returns privacy-minimized inconsistencies; never repairs operational state. */
  async reconciliation(principal: Principal, limit = 200): Promise<EntitlementReconciliationReportDto> {
    const actor = this.requireLinkedPrincipal(principal);
    if (!actor.roles.some(({ role }) => role === 'SystemAdmin' || role === 'InternalAudit')) {
      throw new ForbiddenException({ title: 'Reconciliation access denied', reasons: [ENTITLEMENT_REASON.scopeNotAuthorized] });
    }
    const detectedAtUtc = new Date().toISOString();
    const [rows, metrics] = await Promise.all([
      this.repo.listReconciliationFindings(actor.organizationId, Math.min(Math.max(limit, 1), 500)),
      this.repo.entitlementMetrics(actor.organizationId),
    ]);
    const findings = rows.map((row) => {
      const reasonCode = row.reasonCode as EntitlementReconciliationReason;
      return {
        reasonCode,
        entitlementRef: `entitlement:${row.entitlementId}`,
        vehicleRef: row.vehicleId ? `vehicle:${row.vehicleId}` : null,
        relatedRef: row.relatedId ? `record:${row.relatedId}` : null,
        detectedAtUtc,
        recommendedOwner: reasonCode === 'referenced-eligibility-preview-missing' || reasonCode === 'renewal-predecessor-invalid'
          ? 'PlatformSupport' as const
          : 'FleetOperations' as const,
      };
    });
    return {
      detectedAtUtc,
      findingCount: findings.length,
      findings,
      metrics,
      unavailableMetrics: ['eligibility-error', 'no-qualified-vehicle', 'command-conflict', 'worker-failure'],
    };
  }

  /** Creates a Draft entitlement request. */
  async create(
    input: CreateEntitlement,
    actorRef = 'system',
    principal?: Principal,
    idempotencyKey?: string,
  ): Promise<EntitlementDto> {
    const actor = principal ? await this.requireDraftActor(principal, input) : null;
    const commandKey = actor ? this.requireIdempotencyKey(idempotencyKey) : null;
    const payloadSha256 = actor
      ? createHash('sha256').update(JSON.stringify(input)).digest('hex')
      : null;
    if (actor && commandKey && payloadSha256) {
      const prior = await this.repo.findCommand(actor.organizationId, actor.personId, 'CREATE_DRAFT', commandKey);
      if (prior) {
        if (prior.payloadSha256 !== payloadSha256) {
          throw new ConflictException({
            title: 'Idempotency key was reused with a different payload',
            reasons: [ENTITLEMENT_REASON.idempotencyReused],
          });
        }
        if (!prior.resultEntitlementId) {
          throw new ConflictException({
            title: 'Entitlement command is still in progress',
            reasons: [ENTITLEMENT_REASON.commandInProgress],
          });
        }
        return this.toDto(await this.require(prior.resultEntitlementId));
      }
    }
    const eligibility = actor
      ? await this.requireEligibilityPreview(input, actor)
      : null;
    const windowReasons = validateDateWindow(input.durationStart, input.durationEnd);
    if (windowReasons.length) {
      throw new BadRequestException({ title: 'Invalid entitlement window', reasons: windowReasons });
    }
    try {
      return await this.repo.transaction(async (tx) => {
        const command = actor && commandKey && payloadSha256
          ? await this.repo.claimCommand({
              organizationId: actor.organizationId,
              actorPersonId: actor.personId,
              commandType: 'CREATE_DRAFT',
              idempotencyKey: commandKey,
              payloadSha256,
            }, tx)
          : null;
        if (actor && !command) {
          throw new ConflictException({
            title: 'Entitlement command is already being processed',
            reasons: [ENTITLEMENT_REASON.commandInProgress],
          });
        }
        const created = await this.repo.insert(
          {
            organizationId: actor?.organizationId,
            requestType: input.requestType,
            driverOption: input.driverOption ?? null,
            requesterPersonId: input.requesterPersonId,
            requestedByPersonId: actor?.personId ?? input.requesterPersonId,
            assignedDriverPersonId: input.assignedDriverPersonId ?? null,
            justificationCategory: input.justificationCategory,
            justificationText: input.justificationText,
            vehicleCategoryCode: input.vehicleCategoryCode ?? null,
            preferredVehicleId: input.preferredVehicleId ?? null,
            preferenceNote: input.preferenceNote ?? null,
            eligibilityPreviewId: eligibility?.id ?? null,
            durationStart: input.durationStart,
            durationEnd: input.durationEnd,
            locationNodeId: input.locationNodeId ?? null,
            businessUnit: input.businessUnit ?? null,
            costCentre: input.costCentre ?? null,
            status: 'Draft',
            eligibilityResult: eligibility
              ? {
                  decision: eligibility.decision,
                  reasons: eligibility.reasons,
                  policyVersion: eligibility.policyVersion,
                  policyRuleId: eligibility.policyRuleId,
                  policyVersionId: eligibility.policyVersionId,
                  requestFingerprint: eligibility.requestFingerprint,
                }
              : null,
            policyVersion: eligibility?.policyVersion ?? null,
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
        const dto = this.toDto(created);
        if (command) await this.repo.completeCommand(command.id, created.id, dto, tx);
        return dto;
      });
    } catch (error) {
      throw toDbException(error);
    }
  }

  /** Updates an owner Draft with optimistic revision and durable retry semantics. */
  async updateDraft(
    id: string,
    input: UpdateEntitlementDraft,
    principal: Principal,
    idempotencyKey?: string,
  ): Promise<EntitlementDto> {
    const actor = this.requireLinkedPrincipal(principal);
    const commandKey = this.requireIdempotencyKey(idempotencyKey);
    const payloadSha256 = createHash('sha256')
      .update(JSON.stringify({ entitlementId: id, input }))
      .digest('hex');
    const prior = await this.repo.findCommand(actor.organizationId, actor.personId, 'UPDATE_DRAFT', commandKey);
    if (prior) {
      if (prior.payloadSha256 !== payloadSha256) {
        throw new ConflictException({
          title: 'Idempotency key was reused with a different payload',
          reasons: [ENTITLEMENT_REASON.idempotencyReused],
        });
      }
      if (!prior.resultEntitlementId) {
        throw new ConflictException({
          title: 'Entitlement command is still in progress',
          reasons: [ENTITLEMENT_REASON.commandInProgress],
        });
      }
      return this.get(prior.resultEntitlementId, actor);
    }

    const existing = await this.repo.findByIdInOrganization(id, actor.organizationId);
    if (!existing || existing.requesterPersonId !== actor.personId) {
      throw new NotFoundException({ title: 'Unknown entitlement', reasons: [`entitlement-not-found:${id}`] });
    }
    if (!['Draft', 'ModificationRequested'].includes(existing.status)) {
      throw new ConflictException({ title: 'Entitlement is not editable', reasons: [ENTITLEMENT_REASON.notDraft] });
    }
    const nextStart = input.durationStart ?? existing.durationStart ?? '';
    const nextEnd = input.durationEnd ?? existing.durationEnd ?? '';
    const windowReasons = validateDateWindow(nextStart, nextEnd);
    if (windowReasons.length) {
      throw new BadRequestException({ title: 'Invalid entitlement window', reasons: windowReasons });
    }
    const nextLocation = input.locationNodeId ?? existing.locationNodeId;
    if (!nextLocation) {
      throw new ForbiddenException({
        title: 'A governed request scope is required',
        reasons: [ENTITLEMENT_REASON.scopeNotAuthorized],
      });
    }
    await this.scopeAuthorization.assertRolesAtScope(actor, ['Employee'], nextLocation);
    if (input.driverOption === 'WithDriver') {
      await this.requireProfessionalDriver(input.assignedDriverPersonId, actor.organizationId, nextLocation);
    }

    const eligibility = input.eligibilityPreviewId
      ? await this.requireEligibilityPreview({
          requestType: input.requestType ?? (existing.requestType as EntitlementDto['requestType']),
          driverOption: input.driverOption ?? (existing.driverOption as EntitlementDto['driverOption']) ?? 'WithoutDriver',
          justificationCategory: input.justificationCategory ?? existing.justificationCategory,
          durationStart: input.durationStart ?? existing.durationStart ?? '',
          durationEnd: input.durationEnd ?? existing.durationEnd ?? '',
          locationNodeId: nextLocation,
          vehicleCategoryCode: input.vehicleCategoryCode ?? existing.vehicleCategoryCode ?? undefined,
          preferredVehicleId: input.preferredVehicleId ?? undefined,
          preferenceNote: input.preferenceNote ?? existing.preferenceNote ?? undefined,
          justificationText: input.justificationText ?? existing.justificationText,
          requesterPersonId: actor.personId,
          eligibilityPreviewId: input.eligibilityPreviewId,
        }, actor)
      : null;

    const priorProvenance = (existing.approvalRouteProvenance as Record<string, unknown> | null) ?? null;
    const priorHistory = Array.isArray(priorProvenance?.history) ? priorProvenance.history : [];

    const patch: Partial<EntitlementRow> = {
      requestType: input.requestType,
      driverOption: input.driverOption,
      assignedDriverPersonId: input.assignedDriverPersonId,
      justificationCategory: input.justificationCategory,
      justificationText: input.justificationText,
      vehicleCategoryCode: input.vehicleCategoryCode,
      preferenceNote: input.preferenceNote,
      durationStart: input.durationStart,
      durationEnd: input.durationEnd,
      locationNodeId: input.locationNodeId,
      businessUnit: input.businessUnit,
      costCentre: input.costCentre,
      preferredVehicleId: eligibility ? (input.preferredVehicleId ?? null) : null,
      eligibilityPreviewId: eligibility?.id ?? null,
      eligibilityResult: eligibility
        ? {
            decision: eligibility.decision,
            reasons: eligibility.reasons,
            policyVersion: eligibility.policyVersion,
            policyRuleId: eligibility.policyRuleId,
            policyVersionId: eligibility.policyVersionId,
            requestFingerprint: eligibility.requestFingerprint,
          }
        : null,
      policyVersion: eligibility?.policyVersion ?? null,
      status: existing.status === 'ModificationRequested' ? 'Draft' : undefined,
      workflowInstanceId: existing.status === 'ModificationRequested' ? null : undefined,
      workflowDefinitionVersionId: existing.status === 'ModificationRequested' ? null : undefined,
      approvalRouteProvenance: existing.status === 'ModificationRequested'
        ? { history: [...priorHistory, priorProvenance], current: null }
        : null,
    };
    for (const key of Object.keys(patch) as Array<keyof typeof patch>) {
      if (patch[key] === undefined) delete patch[key];
    }

    return this.repo.transaction(async (tx) => {
      const command = await this.repo.claimCommand({
        organizationId: actor.organizationId,
        actorPersonId: actor.personId,
        commandType: 'UPDATE_DRAFT',
        idempotencyKey: commandKey,
        payloadSha256,
      }, tx);
      if (!command) {
        throw new ConflictException({
          title: 'Entitlement command is already being processed',
          reasons: [ENTITLEMENT_REASON.commandInProgress],
        });
      }
      const updated = await this.repo.updateOwnAtRevision(
        id,
        actor.organizationId,
        actor.personId,
        input.expectedRevision,
        patch,
        tx,
      );
      if (!updated) {
        throw new ConflictException({
          title: 'Entitlement was changed by another request',
          reasons: [ENTITLEMENT_REASON.revisionConflict],
        });
      }
      await this.audit.record({
        organizationId: actor.organizationId,
        actorRef: actor.personId,
        action: 'ENTITLEMENT_DRAFT_UPDATED',
        entityRef: `entitlement:${id}`,
        before: { revision: input.expectedRevision },
        after: { revision: updated.revision },
      }, tx);
      await this.outbox.enqueue({
        aggregateType: 'entitlement',
        aggregateId: id,
        eventType: 'EntitlementDraftChanged',
        payload: { entitlementId: id, revision: updated.revision },
      }, tx);
      const dto = this.toDto(updated);
      await this.repo.completeCommand(command.id, id, dto, tx);
      return dto;
    });
  }

  /** Evaluates the active manual policy and returns bounded safe Vehicle preferences without side effects. */
  async eligibilityPreview(
    input: EntitlementEligibilityPreview,
    principal: Principal,
  ): Promise<EntitlementEligibilityPreviewDto> {
    const actor = this.requireLinkedPrincipal(principal);
    const requestFingerprint = this.eligibilityRequestFingerprint(input);
    const windowReasons = validateDateWindow(input.durationStart, input.durationEnd);
    if (windowReasons.length) {
      throw new BadRequestException({ title: 'Invalid entitlement window', reasons: windowReasons });
    }
    await this.scopeAuthorization.assertRolesAtScope(actor, ['Employee'], input.locationNodeId);
    if (input.driverOption === 'WithDriver') {
      await this.requireProfessionalDriver(input.assignedDriverPersonId, actor.organizationId, input.locationNodeId);
    }
    const profile = await this.repo.findPerson(actor.personId);
    if (!profile || profile.organizationId !== actor.organizationId || profile.employmentStatus !== 'Active') {
      throw new ForbiddenException({
        title: 'Active person profile is required',
        reasons: ['entitlement-person-inactive'],
      });
    }
    const [justificationRules, classRules] = await Promise.all([
      this.lookups.getValueRules(JUSTIFICATION_LOOKUP),
      this.lookups.getValueRules(VEHICLE_CLASS_LOOKUP),
    ]);
    const justification = justificationRules.find((rule) => rule.code === input.justificationCategory);
    if (!justification) {
      throw new BadRequestException({
        title: 'Unknown Dedicated Vehicle justification category',
        reasons: [`entitlement-justification-category-invalid:${input.justificationCategory}`],
      });
    }
    const allowedRequestTypes = justification.metadata?.allowedRequestTypes;
    if (
      Array.isArray(allowedRequestTypes) &&
      !allowedRequestTypes.includes(input.requestType)
    ) {
      return this.deniedPreview(
        input,
        ['entitlement-justification-request-type-not-allowed'],
      );
    }
    const start = new Date(`${input.durationStart}T00:00:00.000Z`);
    const end = new Date(`${input.durationEnd}T00:00:00.000Z`);
    const durationDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    const facts = {
      grade: profile.grade ?? 'UNSPECIFIED',
      employmentStatus: profile.employmentStatus,
      requestType: input.requestType,
      driverOption: input.driverOption,
      justificationCategory: input.justificationCategory,
      durationDays,
    };
    const verdict = await this.pdp.evaluate({
      organizationId: actor.organizationId,
      scopeNodeId: input.locationNodeId,
      ruleType: 'dedicated-vehicle-eligibility',
      context: facts,
    });
    if (!verdict.policyRuleId || !verdict.policyVersionId) {
      throw new ServiceUnavailableException({
        title: 'Dedicated Vehicle eligibility policy is not configured',
        reasons: ['entitlement-eligibility-policy-unavailable'],
      });
    }
    const factFingerprint = createHash('sha256')
      .update(JSON.stringify(facts))
      .digest('hex');
    const evaluatedAtUtc = new Date().toISOString();
    if (verdict.decision !== 'ALLOW') {
      const evidence = await this.repo.insertEligibilityPreview({
        organizationId: actor.organizationId,
        requesterPersonId: actor.personId,
        locationNodeId: input.locationNodeId,
        requestFingerprint,
        policyRuleId: verdict.policyRuleId,
        policyVersionId: verdict.policyVersionId,
        policyVersion: verdict.policyVersion,
        decision: 'DENY',
        reasons: verdict.reasons,
        permittedVehicleClasses: [],
        eligibleVehicleIds: [],
        evaluatedAtUtc: new Date(evaluatedAtUtc),
        expiresAtUtc: new Date(Date.now() + 15 * 60_000),
      });
      return {
        previewId: evidence.id,
        decision: 'DENY',
        reasons: verdict.reasons,
        policyVersion: verdict.policyVersion,
        policyRuleId: verdict.policyRuleId,
        policyVersionId: verdict.policyVersionId,
        requestedScopeNodeId: input.locationNodeId,
        resolvedScopeNodeId: verdict.resolvedScopeNodeId ?? null,
        factFingerprint,
        evaluatedAtUtc,
        permittedVehicleClasses: [],
        eligibleVehicleOptions: [],
      };
    }
    const policyValue = dedicatedPolicyValueSchema.safeParse(verdict.value);
    if (!policyValue.success) {
      throw new ServiceUnavailableException({
        title: 'Dedicated Vehicle eligibility policy output is invalid',
        reasons: ['entitlement-eligibility-policy-output-invalid'],
      });
    }
    const configuredClasses = new Set(classRules.map((rule) => rule.code));
    let permittedVehicleClasses = policyValue.data.permittedVehicleClasses.filter(
      (vehicleClass) => configuredClasses.has(vehicleClass),
    );
    if (permittedVehicleClasses.length === 0) {
      throw new ServiceUnavailableException({
        title: 'Dedicated Vehicle eligibility policy has no configured classes',
        reasons: ['entitlement-eligibility-policy-classes-invalid'],
      });
    }
    if (
      input.requestedVehicleClass &&
      !permittedVehicleClasses.includes(input.requestedVehicleClass)
    ) {
      const evidence = await this.repo.insertEligibilityPreview({
        organizationId: actor.organizationId,
        requesterPersonId: actor.personId,
        locationNodeId: input.locationNodeId,
        requestFingerprint,
        policyRuleId: verdict.policyRuleId,
        policyVersionId: verdict.policyVersionId,
        policyVersion: verdict.policyVersion,
        decision: 'DENY',
        reasons: ['entitlement-requested-class-not-permitted'],
        permittedVehicleClasses,
        eligibleVehicleIds: [],
        evaluatedAtUtc: new Date(evaluatedAtUtc),
        expiresAtUtc: new Date(Date.now() + 15 * 60_000),
      });
      return {
        previewId: evidence.id,
        decision: 'DENY',
        reasons: ['entitlement-requested-class-not-permitted'],
        policyVersion: verdict.policyVersion,
        policyRuleId: verdict.policyRuleId,
        policyVersionId: verdict.policyVersionId,
        requestedScopeNodeId: input.locationNodeId,
        resolvedScopeNodeId: verdict.resolvedScopeNodeId ?? null,
        factFingerprint,
        evaluatedAtUtc,
        permittedVehicleClasses,
        eligibleVehicleOptions: [],
      };
    }
    if (input.requestedVehicleClass) {
      permittedVehicleClasses = [input.requestedVehicleClass];
    }
    const durationEndExclusive = new Date(end.getTime() + 86_400_000);
    const authorizedNodeIds = await this.repo.descendantNodeIds(
      actor.organizationId,
      input.locationNodeId,
    );
    const eligibleVehicleOptions = await this.repo.listEligibleVehicleOptions({
      organizationId: actor.organizationId,
      authorizedNodeIds,
      permittedVehicleClasses,
      durationStart: start,
      durationEndExclusive,
    });
    const evidence = await this.repo.insertEligibilityPreview({
      organizationId: actor.organizationId,
      requesterPersonId: actor.personId,
      locationNodeId: input.locationNodeId,
      requestFingerprint,
      policyRuleId: verdict.policyRuleId,
      policyVersionId: verdict.policyVersionId,
      policyVersion: verdict.policyVersion,
      decision: 'ALLOW',
      reasons: verdict.reasons,
      permittedVehicleClasses,
      eligibleVehicleIds: eligibleVehicleOptions.map((option) => option.vehicleId),
      evaluatedAtUtc: new Date(evaluatedAtUtc),
      expiresAtUtc: new Date(Date.now() + 15 * 60_000),
    });
    return {
      previewId: evidence.id,
      decision: 'ALLOW',
      reasons: verdict.reasons,
      policyVersion: verdict.policyVersion,
      policyRuleId: verdict.policyRuleId,
      policyVersionId: verdict.policyVersionId,
      requestedScopeNodeId: input.locationNodeId,
      resolvedScopeNodeId: verdict.resolvedScopeNodeId ?? null,
      factFingerprint,
      evaluatedAtUtc,
      permittedVehicleClasses,
      eligibleVehicleOptions,
    };
  }

  /** Returns the manually governed bilingual justification categories. */
  justificationCategories() {
    return this.lookups.getValues(JUSTIFICATION_LOOKUP);
  }

  /** Returns manually governed bilingual Dedicated Vehicle classes. */
  vehicleClasses() {
    return this.lookups.getValues(VEHICLE_CLASS_LOOKUP);
  }

  /** Submits one owner Draft exactly once into a transaction-pinned approval route. */
  async submit(
    id: string,
    input: SubmitEntitlement,
    principal: Principal,
    idempotencyKey?: string,
  ): Promise<EntitlementDto> {
    const actor = this.requireLinkedPrincipal(principal);
    const commandKey = this.requireIdempotencyKey(idempotencyKey);
    const payloadSha256 = createHash('sha256').update(JSON.stringify({ id, input })).digest('hex');
    const prior = await this.repo.findCommand(actor.organizationId, actor.personId, 'SUBMIT', commandKey);
    if (prior) {
      if (prior.payloadSha256 !== payloadSha256) throw new ConflictException({ title: 'Idempotency key was reused', reasons: [ENTITLEMENT_REASON.idempotencyReused] });
      if (!prior.resultEntitlementId) throw new ConflictException({ title: 'Command is in progress', reasons: [ENTITLEMENT_REASON.commandInProgress] });
      return this.get(prior.resultEntitlementId, actor);
    }
    const existing = await this.repo.findByIdInOrganization(id, actor.organizationId);
    if (!existing || existing.requesterPersonId !== actor.personId) throw new NotFoundException({ title: 'Unknown entitlement', reasons: [`entitlement-not-found:${id}`] });
    if (existing.status !== 'Draft' || existing.revision !== input.expectedRevision) throw new ConflictException({ title: 'Entitlement state changed', reasons: [ENTITLEMENT_REASON.stateConflict] });
    const preview = await this.requireEligibilityPreview({
      requestType: existing.requestType as EntitlementDto['requestType'],
      driverOption: (existing.driverOption as EntitlementDto['driverOption']) ?? 'WithoutDriver',
      requesterPersonId: existing.requesterPersonId,
      justificationCategory: existing.justificationCategory,
      justificationText: existing.justificationText,
      vehicleCategoryCode: existing.vehicleCategoryCode ?? undefined,
      preferredVehicleId: existing.preferredVehicleId ?? undefined,
      preferenceNote: existing.preferenceNote ?? undefined,
      eligibilityPreviewId: existing.eligibilityPreviewId ?? undefined,
      durationStart: existing.durationStart ?? '',
      durationEnd: existing.durationEnd ?? '',
      locationNodeId: existing.locationNodeId ?? undefined,
    }, actor);
    const requester = await this.repo.findPerson(existing.requesterPersonId);
    const chain = await this.pdp.evaluate({
      ruleType: 'entitlement-approval-chain',
      context: { requestType: existing.requestType, grade: requester?.grade ?? undefined },
      organizationId: actor.organizationId,
      scopeNodeId: existing.locationNodeId ?? undefined,
    });
    const route = chain.route?.length ? chain.route : ['LineManager', 'FleetManager', 'ClusterCEO'];
    const roleToPerson = new Map<string, string | null>();
    for (const role of route) {
      if (!roleToPerson.has(role)) roleToPerson.set(role, role === 'LineManager'
        ? requester?.lineManagerPersonId ?? null
        : await this.repo.findApproverForRole(role as PlatformRole, existing.locationNodeId));
    }
    const approvers = resolveApprovers(route, existing.requesterPersonId, (role) => roleToPerson.get(role) ?? null);
    const requiredSteps = new Set(route).size;
    if (!approvers.length || approvers.length !== requiredSteps) throw new UnprocessableEntityException({ title: 'The complete approval route could not be resolved', reasons: [ENTITLEMENT_REASON.noApprover] });
    try {
      return await this.repo.transaction(async (tx) => {
        const command = await this.repo.claimCommand({ organizationId: actor.organizationId, actorPersonId: actor.personId, commandType: 'SUBMIT', idempotencyKey: commandKey, payloadSha256 }, tx);
        if (!command) throw new ConflictException({ title: 'Command is in progress', reasons: [ENTITLEMENT_REASON.commandInProgress] });
        const locked = await this.repo.findByIdForUpdate(id, actor.organizationId, tx);
        if (!locked || locked.requesterPersonId !== actor.personId || locked.status !== 'Draft' || locked.revision !== input.expectedRevision) {
          throw new ConflictException({ title: 'Entitlement state changed', reasons: [ENTITLEMENT_REASON.stateConflict] });
        }
        const view = await this.workflow.start({ workflowType: 'entitlement-approval', subjectRef: `entitlement:${id}`, slaMinutes: 48 * 60, steps: approvers.map((assigneePersonId) => ({ assigneePersonId })) }, tx);
        const existingProvenance = (locked.approvalRouteProvenance as Record<string, unknown> | null) ?? null;
        const history = Array.isArray(existingProvenance?.history) ? existingProvenance.history : [];
        const current = {
          policyRuleId: chain.policyRuleId,
          policyVersionId: chain.policyVersionId,
          policyVersion: chain.policyVersion,
          resolvedScopeNodeId: chain.resolvedScopeNodeId ?? null,
          route,
          approvers,
          definitionDeploymentId: view.definitionDeploymentId,
          steps: view.steps.map((step) => ({ id: step.id, sequence: step.sequence, assigneePersonId: step.assigneePersonId, slaDueAt: step.slaDueAt })),
          eligibilityPreviewId: preview.id,
        };
        const updated = await this.repo.updateAtRevision(id, actor.organizationId, input.expectedRevision, {
          status: 'PendingApproval',
          workflowInstanceId: view.id,
          workflowDefinitionVersionId: view.definitionDeploymentId,
          approvalRouteProvenance: { history, current },
        }, tx);
        if (!updated) throw new ConflictException({ title: 'Entitlement state changed', reasons: [ENTITLEMENT_REASON.stateConflict] });
        await this.audit.record({ organizationId: actor.organizationId, actorRef: actor.personId, action: 'ENTITLEMENT_SUBMITTED', entityRef: `entitlement:${id}`, after: { workflowId: view.id, approvers } }, tx);
        await this.outbox.enqueue({ aggregateType: 'entitlement', aggregateId: id, eventType: 'EntitlementSubmitted', payload: { entitlementId: id, workflowId: view.id } }, tx);
        const dto = this.toDto(updated);
        await this.repo.completeCommand(command.id, id, dto, tx);
        return dto;
      });
    } catch (error) { throw toDbException(error); }
  }

  /** Returns minimized current assigned/delegated Dedicated approval tasks. */
  async approvalWorklist(principal: Principal): Promise<EntitlementApprovalWorkItemDto[]> {
    const actor = this.requireLinkedPrincipal(principal);
    if (actor.roles.length > 0 && actor.roles.every((role) => role.role === 'SystemAdmin')) throw new ForbiddenException({ title: 'System Administrator cannot approve operational Entitlements', reasons: [ENTITLEMENT_REASON.systemAdminOperationalDenied] });
    return (await this.repo.listApprovalWorklist(actor.personId, actor.organizationId)).map((row) => ({
      entitlementId: row.entitlementId,
      revision: row.revision,
      workflowInstanceId: row.workflowInstanceId,
      workflowStepId: row.workflowStepId,
      workflowStepVersion: row.workflowStepVersion,
      delegated: row.assigneePersonId !== actor.personId,
      actingForPersonId: row.assigneePersonId !== actor.personId ? row.assigneePersonId : null,
      requesterName: row.requesterName,
      requestType: row.requestType as EntitlementDto['requestType'],
      driverOption: row.driverOption as EntitlementDto['driverOption'],
      justificationCategory: row.justificationCategory,
      justificationText: row.justificationText,
      vehicleCategoryCode: row.vehicleCategoryCode,
      preferredVehicleId: row.preferredVehicleId,
      preferenceNote: row.preferenceNote,
      durationStart: row.durationStart ?? '',
      durationEnd: row.durationEnd ?? '',
      locationName: row.locationName,
      eligibilityResult: (row.eligibilityResult as Record<string, unknown> | null) ?? null,
      dueAtUtc: row.dueAtUtc?.toISOString() ?? null,
    }));
  }

  /** Applies one stable, version-checked approval decision in the Entitlement transaction. */
  async decide(
    id: string,
    input: DecideEntitlement,
    decision: 'APPROVED' | 'REJECTED' | 'MODIFICATION_REQUESTED',
    principal: Principal,
    idempotencyKey?: string,
  ): Promise<EntitlementDto> {
    const actor = this.requireLinkedPrincipal(principal);
    if (actor.personId !== input.actorPersonId) throw new ForbiddenException({ title: 'Approval actor mismatch', reasons: ['approval-actor-mismatch'] });
    if (actor.roles.length > 0 && actor.roles.every((role) => role.role === 'SystemAdmin')) throw new ForbiddenException({ title: 'System Administrator cannot approve operational Entitlements', reasons: [ENTITLEMENT_REASON.systemAdminOperationalDenied] });
    if (decision !== 'APPROVED' && !input.reason?.trim()) throw new BadRequestException({ title: 'A reason is required', reasons: ['entitlement-decision-reason-required'] });
    const commandKey = this.requireIdempotencyKey(idempotencyKey);
    const payloadSha256 = createHash('sha256').update(JSON.stringify({ id, input, decision })).digest('hex');
    const prior = await this.repo.findCommand(actor.organizationId, actor.personId, 'DECIDE', commandKey);
    if (prior) {
      if (prior.payloadSha256 !== payloadSha256) throw new ConflictException({ title: 'Idempotency key was reused', reasons: [ENTITLEMENT_REASON.idempotencyReused] });
      if (!prior.resultEntitlementId) throw new ConflictException({ title: 'Command is in progress', reasons: [ENTITLEMENT_REASON.commandInProgress] });
      return this.toDto(await this.require(prior.resultEntitlementId));
    }
    const existing = await this.repo.findByIdInOrganization(id, actor.organizationId);
    if (!existing || existing.status !== 'PendingApproval' || !existing.workflowInstanceId) throw new ConflictException({ title: 'Entitlement is not pending approval', reasons: [ENTITLEMENT_REASON.notPendingApproval] });
    if (actor.personId === existing.requesterPersonId || input.onBehalfOfPersonId === existing.requesterPersonId) throw new ForbiddenException({ title: 'Self-approval is not permitted', reasons: [ENTITLEMENT_REASON.sodSelfApproval] });
    const currentStep = await this.repo.findCurrentWorkflowStep(existing.workflowInstanceId);
    if (!currentStep) throw new ConflictException({ title: 'Workflow step missing', reasons: ['workflow-current-step-missing'] });
    try {
      return await this.repo.transaction(async (tx) => {
        const command = await this.repo.claimCommand({ organizationId: actor.organizationId, actorPersonId: actor.personId, commandType: 'DECIDE', idempotencyKey: commandKey, payloadSha256 }, tx);
        if (!command) throw new ConflictException({ title: 'Command is in progress', reasons: [ENTITLEMENT_REASON.commandInProgress] });
        const locked = await this.repo.findByIdForUpdate(id, actor.organizationId, tx);
        if (!locked || locked.status !== 'PendingApproval' || locked.revision !== input.expectedRevision || !locked.workflowInstanceId) throw new ConflictException({ title: 'Entitlement state changed', reasons: [ENTITLEMENT_REASON.stateConflict] });
        const { view } = await this.workflow.decideInTransaction(locked.workflowInstanceId, { actorPersonId: actor.personId, decision, reason: input.reason, onBehalfOfPersonId: input.onBehalfOfPersonId, expectedStepVersion: input.expectedStepVersion }, tx);
        let status: EntitlementStatus = locked.status;
        if (view.status === 'Approved') status = 'Approved';
        else if (view.status === 'Rejected') status = 'Declined';
        else if (view.status === 'ModificationRequested') status = 'ModificationRequested';
        const updated = await this.repo.updateAtRevision(id, actor.organizationId, input.expectedRevision, { status }, tx);
        if (!updated) throw new ConflictException({ title: 'Entitlement state changed', reasons: [ENTITLEMENT_REASON.stateConflict] });
        await this.audit.record({ organizationId: actor.organizationId, actorRef: actor.personId, action: 'ENTITLEMENT_DECISION', entityRef: `entitlement:${id}`, reason: input.reason, after: { decision, status, workflowStatus: view.status } }, tx);
        await this.outbox.enqueue({ aggregateType: 'entitlement', aggregateId: id, eventType: 'EntitlementDecided', payload: { entitlementId: id, decision, status } }, tx);
        if (status === 'Approved') {
          await this.outbox.enqueue({ aggregateType: 'entitlement', aggregateId: id, eventType: 'EntitlementConsentRequired', payload: { entitlementId: id } }, tx);
        }
        const dto = this.toDto(updated);
        await this.repo.completeCommand(command.id, id, dto, tx);
        return dto;
      });
    } catch (error) { throw toDbException(error); }
  }

  /** Returns the current governed consent content without creating evidence. */
  async consentContext(principal?: Principal): Promise<EntitlementConsentContextDto> {
    const template = await this.consentTemplates.current(principal?.organizationId);
    return template
      ? { available: true, blockingReasons: [], version: template.version, effectiveAtUtc: template.effectiveAtUtc, content: template.content }
      : { available: false, blockingReasons: [ENTITLEMENT_REASON.consentTemplatePending], version: null, effectiveAtUtc: null, content: null };
  }

  /** Captures assigned-driver consent exactly once from the authenticated driver. */
  async consent(
    id: string,
    input: EntitlementConsent,
    principal: Principal,
    idempotencyKey?: string,
  ): Promise<EntitlementDto> {
    const actor = this.requireLinkedPrincipal(principal);
    const template = await this.consentTemplates.current(actor.organizationId);
    if (!template) throw new ConflictException({ title: 'Dedicated Vehicle consent template is not approved', reasons: [ENTITLEMENT_REASON.consentTemplatePending] });
    if (template.version !== input.consentDocumentVersion) throw new ConflictException({ title: 'Consent version changed', reasons: [ENTITLEMENT_REASON.consentVersionStale] });
    const commandKey = this.requireIdempotencyKey(idempotencyKey);
    const payloadSha256 = createHash('sha256').update(JSON.stringify({ id, input })).digest('hex');
    const prior = await this.repo.findCommand(actor.organizationId, actor.personId, 'CONSENT', commandKey);
    if (prior) {
      if (prior.payloadSha256 !== payloadSha256) throw new ConflictException({ title: 'Idempotency key was reused', reasons: [ENTITLEMENT_REASON.idempotencyReused] });
      if (!prior.resultEntitlementId) throw new ConflictException({ title: 'Command is in progress', reasons: [ENTITLEMENT_REASON.commandInProgress] });
      return this.toDto(await this.require(prior.resultEntitlementId));
    }
    try {
      return await this.repo.transaction(async (tx) => {
        const command = await this.repo.claimCommand({ organizationId: actor.organizationId, actorPersonId: actor.personId, commandType: 'CONSENT', idempotencyKey: commandKey, payloadSha256 }, tx);
        if (!command) throw new ConflictException({ title: 'Command is in progress', reasons: [ENTITLEMENT_REASON.commandInProgress] });
        const locked = await this.repo.findByIdForUpdate(id, actor.organizationId, tx);
        if (!locked || locked.status !== 'Approved' || locked.revision !== input.expectedRevision) throw new ConflictException({ title: 'Entitlement is not approved at this revision', reasons: [ENTITLEMENT_REASON.stateConflict] });
        const assignedDriverId = locked.assignedDriverPersonId ?? locked.requesterPersonId;
        if (actor.personId !== assignedDriverId) throw new ForbiddenException({ title: 'Only the assigned driver can consent', reasons: [ENTITLEMENT_REASON.consentActorMismatch] });
        const updated = await this.repo.updateAtRevision(id, actor.organizationId, input.expectedRevision, {
          status: 'AwaitingConsent',
          consentSignedAtUtc: new Date(),
          consentDocumentVersion: template.version,
          consentContentHash: template.contentHash,
          consentSignatureRef: input.signatureRef ?? null,
        }, tx);
        if (!updated) throw new ConflictException({ title: 'Entitlement state changed', reasons: [ENTITLEMENT_REASON.stateConflict] });
        await this.audit.record({ organizationId: actor.organizationId, actorRef: actor.personId, action: 'ENTITLEMENT_CONSENT_SIGNED', entityRef: `entitlement:${id}`, after: { version: template.version, contentHash: template.contentHash } }, tx);
        await this.outbox.enqueue({ aggregateType: 'entitlement', aggregateId: id, eventType: 'ConsentSigned', payload: { entitlementId: id, version: template.version } }, tx);
        const dto = this.toDto(updated);
        await this.repo.completeCommand(command.id, id, dto, tx);
        return dto;
      });
    } catch (error) { throw toDbException(error); }
  }

  /** Returns scoped consented requests and final-qualified Vehicle options for Fleet allocation. */
  async allocationWorklist(principal: Principal): Promise<EntitlementAllocationWorkItemDto[]> {
    const actor = this.requireLinkedPrincipal(principal);
    const fleetRoles = ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'] as const;
    const authorizedNodeIds = await this.scopeAuthorization.authorizedDescendantIds(actor, fleetRoles);
    const rows = await this.repo.listAllocationCandidates(actor.organizationId, authorizedNodeIds);
    return Promise.all(rows.map(async (row) => {
      const requester = await this.repo.findPerson(row.requesterPersonId);
      const options = await this.repo.listEligibleVehicleOptions({
        organizationId: actor.organizationId,
        authorizedNodeIds: await this.repo.descendantNodeIds(actor.organizationId, row.locationNodeId!),
        permittedVehicleClasses: row.vehicleCategoryCode ? [row.vehicleCategoryCode] : [],
        durationStart: new Date(`${row.durationStart}T00:00:00Z`),
        durationEndExclusive: new Date(`${row.durationEnd}T00:00:00Z`),
      });
      return { entitlement: this.toDto(row), requesterName: requester?.fullName ?? 'Unknown', preferredVehiclePlate: await this.repo.findVehiclePlate(row.preferredVehicleId), options };
    }));
  }

  /** Allocates one final-qualified Vehicle atomically and removes it from ordinary Pool availability. */
  async allocate(
    id: string,
    input: AllocateEntitlement,
    principal: Principal,
    idempotencyKey?: string,
  ): Promise<EntitlementDto> {
    const actor = this.requireLinkedPrincipal(principal);
    if (actor.roles.length > 0 && actor.roles.every((role) => role.role === 'SystemAdmin')) throw new ForbiddenException({ title: 'System Administrator cannot allocate operational Vehicles', reasons: [ENTITLEMENT_REASON.systemAdminOperationalDenied] });
    const commandKey = this.requireIdempotencyKey(idempotencyKey);
    const payloadSha256 = createHash('sha256').update(JSON.stringify({ id, input })).digest('hex');
    const prior = await this.repo.findCommand(actor.organizationId, actor.personId, 'ALLOCATE', commandKey);
    if (prior) {
      if (prior.payloadSha256 !== payloadSha256) throw new ConflictException({ title: 'Idempotency key was reused', reasons: [ENTITLEMENT_REASON.idempotencyReused] });
      if (!prior.resultEntitlementId) throw new ConflictException({ title: 'Command is in progress', reasons: [ENTITLEMENT_REASON.commandInProgress] });
      return this.toDto(await this.require(prior.resultEntitlementId));
    }
    const existing = await this.repo.findByIdInOrganization(id, actor.organizationId);
    if (!existing || !existing.locationNodeId) throw new NotFoundException({ title: 'Unknown entitlement', reasons: [`entitlement-not-found:${id}`] });
    await this.scopeAuthorization.assertRolesAtScope(actor, ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'], existing.locationNodeId);
    const preferenceHonoured = existing.preferredVehicleId === input.vehicleId;
    if (existing.preferredVehicleId && !preferenceHonoured && !input.varianceReasonCode?.trim()) throw new BadRequestException({ title: 'A variance reason is required', reasons: [ENTITLEMENT_REASON.allocationVarianceRequired] });
    try {
      return await this.repo.transaction(async (tx) => {
        const command = await this.repo.claimCommand({ organizationId: actor.organizationId, actorPersonId: actor.personId, commandType: 'ALLOCATE', idempotencyKey: commandKey, payloadSha256 }, tx);
        if (!command) throw new ConflictException({ title: 'Command is in progress', reasons: [ENTITLEMENT_REASON.commandInProgress] });
        const locked = await this.repo.findByIdForUpdate(id, actor.organizationId, tx);
        if (!locked || locked.status !== 'AwaitingConsent' || !locked.consentSignedAtUtc || locked.revision !== input.expectedRevision) throw new ConflictException({ title: 'Entitlement is not ready for allocation', reasons: [ENTITLEMENT_REASON.stateConflict] });
        const selected = await this.repo.findVehicleForUpdate(input.vehicleId, actor.organizationId, tx);
        if (!selected) throw new BadRequestException({ title: 'Unknown Vehicle', reasons: [ENTITLEMENT_REASON.vehicleNotQualified] });
        const options = await this.repo.listEligibleVehicleOptions({
          organizationId: actor.organizationId,
          authorizedNodeIds: await this.repo.descendantNodeIds(actor.organizationId, locked.locationNodeId!),
          permittedVehicleClasses: locked.vehicleCategoryCode ? [locked.vehicleCategoryCode] : [],
          durationStart: new Date(`${locked.durationStart}T00:00:00Z`),
          durationEndExclusive: new Date(`${locked.durationEnd}T00:00:00Z`),
        }, tx);
        if (!options.some((option) => option.vehicleId === selected.id)) throw new ConflictException({ title: 'Vehicle is no longer qualified', reasons: [ENTITLEMENT_REASON.vehicleNotQualified] });
        const qualificationSnapshot = { vehicleClass: selected.bodyTypeCode, scopeNodeId: locked.locationNodeId, lifecycleStatus: selected.lifecycleStatus, vendorHealthHold: selected.vendorHealthHold, checkedAtUtc: new Date().toISOString() };
        await this.repo.insertAllocation({ organizationId: actor.organizationId, entitlementRequestId: id, vehicleId: selected.id, allocatedByPersonId: actor.personId, effectiveStart: locked.durationStart!, effectiveEnd: locked.durationEnd!, preferredVehicleId: locked.preferredVehicleId, preferenceHonoured, varianceReasonCode: input.varianceReasonCode ?? null, qualificationSnapshot }, tx);
        await this.repo.updateVehicle(selected.id, actor.organizationId, { assignmentModel: 'Dedicated', bookingPoolFlag: false, assignedDriverPersonId: locked.assignedDriverPersonId ?? locked.requesterPersonId }, tx);
        const updated = await this.repo.updateAtRevision(id, actor.organizationId, input.expectedRevision, { status: 'Allocated', vehicleId: selected.id, allocatedAtUtc: new Date() }, tx);
        if (!updated) throw new ConflictException({ title: 'Entitlement state changed', reasons: [ENTITLEMENT_REASON.stateConflict] });
        await this.audit.record({ organizationId: actor.organizationId, actorRef: actor.personId, action: 'ENTITLEMENT_ALLOCATED', entityRef: `entitlement:${id}`, after: { vehicleId: selected.id, preferenceHonoured, varianceReasonCode: input.varianceReasonCode ?? null } }, tx);
        await this.outbox.enqueue({ aggregateType: 'entitlement', aggregateId: id, eventType: 'EntitlementAllocated', payload: { entitlementId: id, vehicleId: selected.id } }, tx);
        const dto = this.toDto(updated);
        await this.repo.completeCommand(command.id, id, dto, tx);
        return dto;
      });
    } catch (error) { throw toDbException(error); }
  }

  /** Records a BSD (leave) return window for an allocated entitlement. */
  async addBsdWindow(id: string, input: BsdWindow, principal: Principal): Promise<BsdWindowDto> {
    const actor = this.requireLinkedPrincipal(principal);
    const existing = await this.repo.findByIdInOrganization(id, actor.organizationId);
    if (!existing?.locationNodeId) throw new NotFoundException({ title: 'Unknown entitlement', reasons: [`entitlement-not-found:${id}`] });
    await this.scopeAuthorization.assertRolesAtScope(actor, ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'], existing.locationNodeId);
    if (existing.status !== 'Allocated') {
      throw new ConflictException({ title: 'Entitlement is not allocated', reasons: [ENTITLEMENT_REASON.notApproved] });
    }
    if (existing.vehicleId !== input.vehicleId) throw new BadRequestException({ title: 'BSD Vehicle does not match allocation', reasons: [ENTITLEMENT_REASON.vehicleNotQualified] });
    const start = new Date(input.windowStart);
    const end = new Date(input.windowEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
      throw new BadRequestException({ title: 'Invalid BSD window', reasons: [ENTITLEMENT_REASON.windowInvalid] });
    }
    const row = await this.repo.insertBsdWindow({
      organizationId: actor.organizationId,
      entitlementRequestId: id,
      vehicleId: input.vehicleId,
      windowStart: start,
      windowEnd: end,
      reason: input.reason ?? null,
      status: 'Proposed',
    });
    await this.audit.record({ organizationId: actor.organizationId, actorRef: actor.personId, action: 'ENTITLEMENT_BSD_WINDOW_ADDED', entityRef: `entitlement:${id}`, after: { vehicleId: input.vehicleId } });
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

  /** Confirms one proposed BSD window; only Fleet confirmation enables later activation. */
  async confirmBsdWindow(windowId: string, reason: string, principal: Principal): Promise<BsdWindowDto> {
    const actor = this.requireLinkedPrincipal(principal);
    return this.repo.transaction(async (tx) => {
      const window = await this.repo.findBsdWindowForUpdate(windowId, tx);
      if (!window || window.organizationId !== actor.organizationId || window.status !== 'Proposed') throw new ConflictException({ title: 'BSD window is not confirmable', reasons: [ENTITLEMENT_REASON.actionNotAllowed] });
      const entitlement = await this.repo.findByIdForUpdate(window.entitlementRequestId, actor.organizationId, tx);
      if (!entitlement?.locationNodeId || entitlement.status !== 'Allocated') throw new ConflictException({ title: 'Entitlement is not allocated', reasons: [ENTITLEMENT_REASON.stateConflict] });
      await this.scopeAuthorization.assertRolesAtScope(actor, ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'], entitlement.locationNodeId);
      const row = await this.repo.updateBsdWindow(windowId, { status: 'Confirmed', confirmedByPersonId: actor.personId, confirmedAtUtc: new Date(), reason }, tx);
      await this.repo.insertEvent({ organizationId: actor.organizationId, entitlementRequestId: entitlement.id, eventType: 'BsdWindowConfirmed', actorPersonId: actor.personId, reason, detail: { windowId } }, tx);
      await this.audit.record({ organizationId: actor.organizationId, actorRef: actor.personId, action: 'ENTITLEMENT_BSD_CONFIRMED', entityRef: `entitlement:${entitlement.id}`, reason, after: { windowId } }, tx);
      return this.toBsdDto(row!);
    });
  }

  /** Cancels one future Proposed/Confirmed BSD window without changing Vehicle state. */
  async cancelBsdWindow(windowId: string, reason: string, principal: Principal): Promise<BsdWindowDto> {
    const actor = this.requireLinkedPrincipal(principal);
    return this.repo.transaction(async (tx) => {
      const window = await this.repo.findBsdWindowForUpdate(windowId, tx);
      if (!window || window.organizationId !== actor.organizationId) throw new NotFoundException({ title: 'Unknown BSD window', reasons: [`bsd-window-not-found:${windowId}`] });
      const entitlement = await this.repo.findByIdForUpdate(window.entitlementRequestId, actor.organizationId, tx);
      if (!entitlement?.locationNodeId) throw new NotFoundException({ title: 'Unknown entitlement', reasons: [`entitlement-not-found:${window.entitlementRequestId}`] });
      await this.scopeAuthorization.assertRolesAtScope(actor, ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'], entitlement.locationNodeId);
      if (window.status === 'Cancelled') return this.toBsdDto(window);
      if (!['Proposed', 'Confirmed'].includes(window.status) || window.windowStart <= new Date()) throw new ConflictException({ title: 'BSD window can no longer be cancelled', reasons: [ENTITLEMENT_REASON.actionNotAllowed] });
      const row = await this.repo.updateBsdWindow(window.id, { status: 'Cancelled', reason }, tx);
      await this.repo.insertEvent({ organizationId: actor.organizationId, entitlementRequestId: entitlement.id, eventType: 'BsdWindowCancelled', actorPersonId: actor.personId, reason, detail: { windowId } }, tx);
      await this.audit.record({ organizationId: actor.organizationId, actorRef: actor.personId, action: 'ENTITLEMENT_BSD_CANCELLED', entityRef: `entitlement:${entitlement.id}`, reason, after: { windowId } }, tx);
      return this.toBsdDto(row!);
    });
  }

  /** Reconciles due BSD windows under one advisory lock across replicas. */
  runBsdCycle(now = new Date()): Promise<number> {
    return this.repo.withBsdCycleLock(async (tx) => {
      const due = await this.repo.listDueBsdWindows(now, tx);
      let changed = 0;
      for (const candidate of due) {
        const entitlement = await this.repo.findByIdForUpdate(candidate.entitlementRequestId, candidate.organizationId, tx);
        if (!entitlement || entitlement.status !== 'Allocated' || entitlement.vehicleId !== candidate.vehicleId) continue;
        const window = await this.repo.findBsdWindowForUpdate(candidate.id, tx);
        if (!window) continue;
        const selected = await this.repo.findVehicleForUpdate(window.vehicleId, window.organizationId, tx);
        if (!selected) continue;
        if (window.status === 'Confirmed' && window.windowEnd <= now) {
          await this.repo.updateBsdWindow(window.id, { status: 'Completed', completedAtUtc: now }, tx);
          await this.audit.record({ organizationId: window.organizationId, actorRef: 'bsd-scheduler', action: 'ENTITLEMENT_BSD_MISSED_COMPLETED', entityRef: `entitlement:${entitlement.id}`, after: { windowId: window.id } }, tx);
          changed += 1;
        } else if (window.status === 'Confirmed' && window.windowStart <= now && window.windowEnd > now) {
          const today = now.toISOString().slice(0, 10);
          const compliant = selected.lifecycleStatus === 'Active' && !selected.vendorHealthHold && Boolean(selected.mulkiyaExpiry && selected.mulkiyaExpiry >= today && selected.insuranceExpiry && selected.insuranceExpiry >= today);
          if (!compliant) {
            await this.repo.updateBsdWindow(window.id, { status: 'Conflict' }, tx);
            await this.outbox.enqueue({ aggregateType: 'entitlement', aggregateId: entitlement.id, eventType: 'EntitlementBsdConflict', payload: { entitlementId: entitlement.id, windowId: window.id, reasonCode: 'vehicle-not-compliant' } }, tx);
            continue;
          }
          await this.repo.updateVehicle(selected.id, window.organizationId, { assignmentModel: 'Pool', bookingPoolFlag: true }, tx);
          await this.repo.updateBsdWindow(window.id, { status: 'Active', activatedAtUtc: now }, tx);
          await this.audit.record({ organizationId: window.organizationId, actorRef: 'bsd-scheduler', action: 'ENTITLEMENT_BSD_ACTIVATED', entityRef: `entitlement:${entitlement.id}`, after: { windowId: window.id } }, tx);
          await this.outbox.enqueue({ aggregateType: 'entitlement', aggregateId: entitlement.id, eventType: 'EntitlementBsdActivated', payload: { entitlementId: entitlement.id, windowId: window.id } }, tx);
          changed += 1;
        } else if (['Active', 'Conflict'].includes(window.status) && window.windowEnd <= now) {
          if (await this.repo.hasBlockingBooking(selected.id, now, tx)) {
            await this.repo.updateBsdWindow(window.id, { status: 'Conflict' }, tx);
            await this.outbox.enqueue({ aggregateType: 'entitlement', aggregateId: entitlement.id, eventType: 'EntitlementBsdConflict', payload: { entitlementId: entitlement.id, windowId: window.id, reasonCode: 'active-booking' } }, tx);
            continue;
          }
          await this.repo.updateVehicle(selected.id, window.organizationId, { assignmentModel: 'Dedicated', bookingPoolFlag: false }, tx);
          await this.repo.updateBsdWindow(window.id, { status: 'Completed', completedAtUtc: now }, tx);
          await this.audit.record({ organizationId: window.organizationId, actorRef: 'bsd-scheduler', action: 'ENTITLEMENT_BSD_COMPLETED', entityRef: `entitlement:${entitlement.id}`, after: { windowId: window.id } }, tx);
          await this.outbox.enqueue({ aggregateType: 'entitlement', aggregateId: entitlement.id, eventType: 'EntitlementBsdRestored', payload: { entitlementId: entitlement.id, windowId: window.id } }, tx);
          changed += 1;
        }
      }
      return changed;
    });
  }

  /** Converts one BSD persistence row into its bounded API projection. */
  private toBsdDto(row: NonNullable<Awaited<ReturnType<EntitlementsRepository['findBsdWindowForUpdate']>>>): BsdWindowDto {
    return { id: row.id, entitlementRequestId: row.entitlementRequestId, vehicleId: row.vehicleId, windowStart: row.windowStart.toISOString(), windowEnd: row.windowEnd.toISOString(), status: row.status, reason: row.reason, confirmedAtUtc: row.confirmedAtUtc?.toISOString() ?? null, activatedAtUtc: row.activatedAtUtc?.toISOString() ?? null, completedAtUtc: row.completedAtUtc?.toISOString() ?? null };
  }

  /** Cancels a non-terminal entitlement. */
  async cancel(
    id: string,
    input: EntitlementLifecycleCommand,
    principal: Principal,
    idempotencyKey?: string,
  ): Promise<EntitlementDto> {
    const actor = this.requireLinkedPrincipal(principal);
    const existing = await this.repo.findByIdInOrganization(id, actor.organizationId);
    if (!existing || existing.requesterPersonId !== actor.personId) throw new NotFoundException({ title: 'Unknown entitlement', reasons: [`entitlement-not-found:${id}`] });
    if (!['Draft', 'PendingApproval', 'ModificationRequested', 'Approved', 'AwaitingConsent'].includes(existing.status)) throw new ConflictException({ title: 'Cancellation is not allowed in this state', reasons: [ENTITLEMENT_REASON.actionNotAllowed] });
    return this.lifecycleStateCommand(id, input, actor, 'CANCEL', 'Cancelled', idempotencyKey);
  }

  /** Creates a linked renewal Draft without silently extending the current request. */
  async renew(
    id: string,
    input: RenewEntitlement,
    principal: Principal,
    idempotencyKey?: string,
  ): Promise<EntitlementDto> {
    const actor = this.requireLinkedPrincipal(principal);
    const existing = await this.repo.findByIdInOrganization(id, actor.organizationId);
    if (!existing || existing.requesterPersonId !== actor.personId) throw new NotFoundException({ title: 'Unknown entitlement', reasons: [`entitlement-not-found:${id}`] });
    if (!['Allocated', 'Returned', 'Expired'].includes(existing.status)) throw new ConflictException({ title: 'Renewal is not allowed in this state', reasons: [ENTITLEMENT_REASON.actionNotAllowed] });
    if (validateDateWindow(input.durationStart, input.durationEnd).length) throw new BadRequestException({ title: 'Invalid renewal window', reasons: [ENTITLEMENT_REASON.windowInvalid] });
    const commandKey = this.requireIdempotencyKey(idempotencyKey);
    const payloadSha256 = createHash('sha256').update(JSON.stringify({ id, input })).digest('hex');
    const prior = await this.repo.findCommand(actor.organizationId, actor.personId, 'RENEW', commandKey);
    if (prior) {
      if (prior.payloadSha256 !== payloadSha256) throw new ConflictException({ title: 'Idempotency key was reused', reasons: [ENTITLEMENT_REASON.idempotencyReused] });
      if (!prior.resultEntitlementId) throw new ConflictException({ title: 'Command is in progress', reasons: [ENTITLEMENT_REASON.commandInProgress] });
      return this.toDto(await this.require(prior.resultEntitlementId));
    }
    try {
      return await this.repo.transaction(async (tx) => {
        const command = await this.repo.claimCommand({ organizationId: actor.organizationId, actorPersonId: actor.personId, commandType: 'RENEW', idempotencyKey: commandKey, payloadSha256 }, tx);
        if (!command) throw new ConflictException({ title: 'Command is in progress', reasons: [ENTITLEMENT_REASON.commandInProgress] });
        const locked = await this.repo.findByIdForUpdate(id, actor.organizationId, tx);
        if (!locked || locked.revision !== input.expectedRevision || !['Allocated', 'Returned', 'Expired'].includes(locked.status)) throw new ConflictException({ title: 'Entitlement state changed', reasons: [ENTITLEMENT_REASON.stateConflict] });
        const renewal = await this.repo.insert({
          organizationId: actor.organizationId,
          requestType: locked.requestType,
          driverOption: locked.driverOption,
          requesterPersonId: actor.personId,
          requestedByPersonId: actor.personId,
          assignedDriverPersonId: locked.assignedDriverPersonId,
          justificationCategory: locked.justificationCategory,
          justificationText: locked.justificationText,
          vehicleCategoryCode: locked.vehicleCategoryCode,
          preferenceNote: locked.preferenceNote,
          durationStart: input.durationStart,
          durationEnd: input.durationEnd,
          locationNodeId: locked.locationNodeId,
          businessUnit: locked.businessUnit,
          costCentre: locked.costCentre,
          status: 'Draft',
          renewedFromEntitlementId: locked.id,
        }, tx);
        await this.repo.insertEvent({ organizationId: actor.organizationId, entitlementRequestId: locked.id, eventType: 'RenewalRequested', actorPersonId: actor.personId, detail: { renewalEntitlementId: renewal.id } }, tx);
        await this.repo.insertEvent({ organizationId: actor.organizationId, entitlementRequestId: renewal.id, eventType: 'RenewalDraftCreated', actorPersonId: actor.personId, detail: { renewedFromEntitlementId: locked.id } }, tx);
        await this.audit.record({ organizationId: actor.organizationId, actorRef: actor.personId, action: 'ENTITLEMENT_RENEWAL_CREATED', entityRef: `entitlement:${renewal.id}`, after: { renewedFromEntitlementId: locked.id } }, tx);
        const dto = this.toDto(renewal);
        await this.repo.completeCommand(command.id, renewal.id, dto, tx);
        return dto;
      });
    } catch (error) { throw toDbException(error); }
  }

  /** Closes an allocated request and restores a currently compliant Vehicle to its Pool. */
  async returnVehicle(
    id: string,
    input: EntitlementLifecycleCommand,
    principal: Principal,
    idempotencyKey?: string,
  ): Promise<EntitlementDto> {
    return this.closeAllocatedLifecycle(id, input, principal, idempotencyKey, 'Returned', 'RETURN');
  }

  /** Expires an allocated request through the same atomic return path. */
  async expire(
    id: string,
    input: EntitlementLifecycleCommand,
    principal: Principal,
    idempotencyKey?: string,
  ): Promise<EntitlementDto> {
    return this.closeAllocatedLifecycle(id, input, principal, idempotencyKey, 'Expired', 'EXPIRE');
  }

  /** Returns owner-safe immutable event chronology. */
  async events(id: string, principal: Principal): Promise<EntitlementEventDto[]> {
    await this.get(id, principal);
    return (await this.repo.listEvents(id)).map((event) => ({ id: event.id, eventType: event.eventType, reason: event.reason, detail: event.detail as Record<string, unknown> | null, atUtc: event.atUtc.toISOString() }));
  }

  /** Returns persisted BSD windows to the owner or an authorized Fleet operator. */
  async bsdWindows(id: string, principal: Principal): Promise<BsdWindowDto[]> {
    const actor = this.requireLinkedPrincipal(principal);
    const row = await this.repo.findByIdInOrganization(id, actor.organizationId);
    if (!row) throw new NotFoundException({ title: 'Unknown entitlement', reasons: [`entitlement-not-found:${id}`] });
    if (row.requesterPersonId !== actor.personId) {
      if (!row.locationNodeId) throw new NotFoundException({ title: 'Unknown entitlement', reasons: [`entitlement-not-found:${id}`] });
      await this.scopeAuthorization.assertRolesAtScope(actor, ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'], row.locationNodeId);
    }
    return (await this.repo.listBsdWindows(id)).map((window) => this.toBsdDto(window));
  }

  /** Applies one non-allocation lifecycle state transition with durable replay. */
  private async lifecycleStateCommand(
    id: string,
    input: EntitlementLifecycleCommand,
    actor: Principal & { personId: string },
    commandType: string,
    status: EntitlementStatus,
    idempotencyKey?: string,
  ): Promise<EntitlementDto> {
    const commandKey = this.requireIdempotencyKey(idempotencyKey);
    const payloadSha256 = createHash('sha256').update(JSON.stringify({ id, input, status })).digest('hex');
    const prior = await this.repo.findCommand(actor.organizationId, actor.personId, commandType, commandKey);
    if (prior) {
      if (prior.payloadSha256 !== payloadSha256) throw new ConflictException({ title: 'Idempotency key was reused', reasons: [ENTITLEMENT_REASON.idempotencyReused] });
      if (!prior.resultEntitlementId) throw new ConflictException({ title: 'Command is in progress', reasons: [ENTITLEMENT_REASON.commandInProgress] });
      return this.toDto(await this.require(prior.resultEntitlementId));
    }
    return this.repo.transaction(async (tx) => {
      const command = await this.repo.claimCommand({ organizationId: actor.organizationId, actorPersonId: actor.personId, commandType, idempotencyKey: commandKey, payloadSha256 }, tx);
      if (!command) throw new ConflictException({ title: 'Command is in progress', reasons: [ENTITLEMENT_REASON.commandInProgress] });
      const locked = await this.repo.findByIdForUpdate(id, actor.organizationId, tx);
      if (!locked || locked.revision !== input.expectedRevision) throw new ConflictException({ title: 'Entitlement state changed', reasons: [ENTITLEMENT_REASON.stateConflict] });
      if (status === 'Cancelled' && locked.workflowInstanceId && locked.status === 'PendingApproval') {
        await this.workflow.expireInTransaction(locked.workflowInstanceId, tx);
      }
      const updated = await this.repo.updateAtRevision(id, actor.organizationId, input.expectedRevision, { status }, tx);
      if (!updated) throw new ConflictException({ title: 'Entitlement state changed', reasons: [ENTITLEMENT_REASON.stateConflict] });
      await this.repo.insertEvent({ organizationId: actor.organizationId, entitlementRequestId: id, eventType: status, actorPersonId: actor.personId, reason: input.reason }, tx);
      await this.audit.record({ organizationId: actor.organizationId, actorRef: actor.personId, action: `ENTITLEMENT_${status.toUpperCase()}`, entityRef: `entitlement:${id}`, reason: input.reason }, tx);
      await this.outbox.enqueue({ aggregateType: 'entitlement', aggregateId: id, eventType: `Entitlement${status}`, payload: { entitlementId: id } }, tx);
      const dto = this.toDto(updated);
      await this.repo.completeCommand(command.id, id, dto, tx);
      return dto;
    });
  }

  /** Atomically closes allocation, transitions request and conditionally restores Vehicle. */
  private async closeAllocatedLifecycle(
    id: string,
    input: EntitlementLifecycleCommand,
    principal: Principal,
    idempotencyKey: string | undefined,
    status: 'Returned' | 'Expired',
    commandType: 'RETURN' | 'EXPIRE',
  ): Promise<EntitlementDto> {
    const actor = this.requireLinkedPrincipal(principal);
    const existing = await this.repo.findByIdInOrganization(id, actor.organizationId);
    if (!existing?.locationNodeId) throw new NotFoundException({ title: 'Unknown entitlement', reasons: [`entitlement-not-found:${id}`] });
    await this.scopeAuthorization.assertRolesAtScope(actor, ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'], existing.locationNodeId);
    const commandKey = this.requireIdempotencyKey(idempotencyKey);
    const payloadSha256 = createHash('sha256').update(JSON.stringify({ id, input, status })).digest('hex');
    const prior = await this.repo.findCommand(actor.organizationId, actor.personId, commandType, commandKey);
    if (prior?.resultEntitlementId) return this.toDto(await this.require(prior.resultEntitlementId));
    try {
      return await this.repo.transaction(async (tx) => {
        const command = await this.repo.claimCommand({ organizationId: actor.organizationId, actorPersonId: actor.personId, commandType, idempotencyKey: commandKey, payloadSha256 }, tx);
        if (!command) throw new ConflictException({ title: 'Command is in progress', reasons: [ENTITLEMENT_REASON.commandInProgress] });
        const locked = await this.repo.findByIdForUpdate(id, actor.organizationId, tx);
        if (!locked || locked.status !== 'Allocated' || locked.revision !== input.expectedRevision || !locked.vehicleId) throw new ConflictException({ title: 'Entitlement state changed', reasons: [ENTITLEMENT_REASON.stateConflict] });
        const allocation = await this.repo.findActiveAllocationForUpdate(id, tx);
        if (!allocation) throw new ConflictException({ title: 'Active allocation is missing', reasons: [ENTITLEMENT_REASON.stateConflict] });
        const lifecycleAt = new Date();
        const terminalizedBsdWindows = await this.repo.terminalizeOpenBsdWindows(id, lifecycleAt, tx);
        const selected = await this.repo.findVehicleForUpdate(locked.vehicleId, actor.organizationId, tx);
        if (!selected) throw new ConflictException({ title: 'Allocated Vehicle is missing', reasons: [ENTITLEMENT_REASON.stateConflict] });
        await this.repo.closeAllocation(allocation.id, status, tx);
        const today = new Date().toISOString().slice(0, 10);
        const compliant = selected.lifecycleStatus === 'Active' && !selected.vendorHealthHold && Boolean(selected.mulkiyaNumber && selected.mulkiyaExpiry && selected.mulkiyaExpiry >= today && selected.insurancePolicyNumber && selected.insuranceExpiry && selected.insuranceExpiry >= today);
        await this.repo.updateVehicle(selected.id, actor.organizationId, { assignmentModel: compliant ? 'Pool' : selected.assignmentModel, bookingPoolFlag: compliant, assignedDriverPersonId: null }, tx);
        const updated = await this.repo.updateAtRevision(id, actor.organizationId, input.expectedRevision, { status }, tx);
        if (!updated) throw new ConflictException({ title: 'Entitlement state changed', reasons: [ENTITLEMENT_REASON.stateConflict] });
        const detail = { vehicleId: selected.id, restoredToPool: compliant, terminalizedBsdWindowCount: terminalizedBsdWindows.length };
        await this.repo.insertEvent({ organizationId: actor.organizationId, entitlementRequestId: id, eventType: status, actorPersonId: actor.personId, reason: input.reason, detail }, tx);
        await this.audit.record({ organizationId: actor.organizationId, actorRef: actor.personId, action: `ENTITLEMENT_${status.toUpperCase()}`, entityRef: `entitlement:${id}`, reason: input.reason, after: detail }, tx);
        await this.outbox.enqueue({ aggregateType: 'entitlement', aggregateId: id, eventType: `Entitlement${status}`, payload: { entitlementId: id, vehicleId: selected.id } }, tx);
        const dto = this.toDto(updated);
        await this.repo.completeCommand(command.id, id, dto, tx);
        return dto;
      });
    } catch (error) { throw toDbException(error); }
  }

  async get(id: string, principal?: Principal): Promise<EntitlementDto> {
    if (!principal) return this.toDto(await this.require(id));
    const actor = this.requireLinkedPrincipal(principal);
    const row = await this.repo.findByIdInOrganization(id, actor.organizationId);
    if (!row || row.requesterPersonId !== actor.personId) {
      throw new NotFoundException({ title: 'Unknown entitlement', reasons: [`entitlement-not-found:${id}`] });
    }
    return this.toDto(row);
  }

  async listOwn(principal: Principal, limit = 50, offset = 0): Promise<EntitlementDto[]> {
    const actor = this.requireLinkedPrincipal(principal);
    return (await this.repo.listOwn(actor.organizationId, actor.personId, limit, offset))
      .map((row) => this.toDto(row));
  }

  async context(principal: Principal): Promise<EntitlementContextDto> {
    const actor = this.requireLinkedPrincipal(principal);
    const profile = await this.repo.findPerson(actor.personId);
    if (!profile || profile.organizationId !== actor.organizationId || profile.employmentStatus !== 'Active') {
      throw new ForbiddenException({ title: 'Active person profile is required', reasons: ['entitlement-person-inactive'] });
    }
    const createEnabled = Boolean(profile.homePoolNodeId) && await this.scopeAuthorization.canRolesAtScope(
      actor,
      ['Employee'],
      profile.homePoolNodeId!,
    );
    const professionalDrivers = profile.homePoolNodeId
      ? await this.repo.listProfessionalDrivers(actor.organizationId, profile.homePoolNodeId)
      : [];
    return {
      actor: { personId: actor.personId, fullName: profile.fullName, grade: profile.grade },
      defaults: {
        requesterPersonId: actor.personId,
        requestedByPersonId: actor.personId,
        locationNodeId: profile.homePoolNodeId,
        locationName: profile.homePoolName ?? null,
      },
      capabilities: {
        createDraft: { enabled: createEnabled, blockingReasons: createEnabled ? [] : [ENTITLEMENT_REASON.scopeNotAuthorized] },
        eligibilityPreview: { enabled: true, blockingReasons: [] },
        submit: { enabled: true, blockingReasons: [] },
        withDriver: { enabled: professionalDrivers.length > 0, blockingReasons: professionalDrivers.length ? [] : [ENTITLEMENT_REASON.withDriverDisabled] },
        allocation: { enabled: false, blockingReasons: [ENTITLEMENT_REASON.fleetAllocationOnly] },
      },
      dependencies: [
        { key: 'eligibilityPolicy', status: 'AVAILABLE' },
        { key: 'justificationCategories', status: 'AVAILABLE' },
        { key: 'consentTemplate', status: 'PENDING_APPROVAL' },
        { key: 'allocationExclusivity', status: 'AVAILABLE' },
      ],
    };
  }

  // ---- internals -------------------------------------------------------------

  private async require(id: string): Promise<EntitlementRow> {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new NotFoundException({ title: 'Unknown entitlement', reasons: [`entitlement-not-found:${id}`] });
    }
    return row;
  }

  private requireLinkedPrincipal(principal: Principal): Principal & { personId: string } {
    if (!principal.personId) {
      throw new ForbiddenException({
        title: 'User not linked',
        reasons: [ENTITLEMENT_REASON.principalRequired],
      });
    }
    return principal as Principal & { personId: string };
  }

  private async requireDraftActor(
    principal: Principal,
    input: CreateEntitlement,
  ): Promise<Principal & { personId: string }> {
    const actor = this.requireLinkedPrincipal(principal);
    if (input.requesterPersonId !== actor.personId) {
      throw new ForbiddenException({
        title: 'Dedicated Vehicle self-request identity mismatch',
        reasons: [ENTITLEMENT_REASON.requesterMismatch],
      });
    }
    if (!input.locationNodeId) {
      throw new ForbiddenException({
        title: 'A governed request scope is required',
        reasons: [ENTITLEMENT_REASON.scopeNotAuthorized],
      });
    }
    await this.scopeAuthorization.assertRolesAtScope(actor, ['Employee'], input.locationNodeId);
    if (input.driverOption === 'WithDriver') {
      await this.requireProfessionalDriver(input.assignedDriverPersonId, actor.organizationId, input.locationNodeId);
    }
    return actor;
  }

  /** Requires a selected driver with an active scoped ProfessionalDriver role. */
  private async requireProfessionalDriver(
    personId: string | null | undefined,
    organizationId: string,
    locationNodeId: string,
  ): Promise<void> {
    const drivers = await this.repo.listProfessionalDrivers(organizationId, locationNodeId);
    if (!personId || !drivers.some((driver) => driver.personId === personId)) {
      throw new ConflictException({
        title: 'A scoped professional driver is required',
        reasons: [ENTITLEMENT_REASON.withDriverDisabled],
      });
    }
  }

  /** Returns professional drivers from editable role assignments covering one location. */
  async professionalDrivers(locationNodeId: string, principal: Principal): Promise<EntitlementProfessionalDriverDto[]> {
    const actor = this.requireLinkedPrincipal(principal);
    await this.scopeAuthorization.assertRolesAtScope(actor, ['Employee'], locationNodeId);
    return this.repo.listProfessionalDrivers(actor.organizationId, locationNodeId);
  }

  private requireIdempotencyKey(value?: string): string {
    const key = value?.trim();
    if (!key || key.length < 8 || key.length > 200) {
      throw new BadRequestException({
        title: 'A valid Idempotency-Key header is required',
        reasons: [ENTITLEMENT_REASON.idempotencyRequired],
      });
    }
    return key;
  }

  /** Produces a deterministic local denial before policy evaluation is applicable. */
  private deniedPreview(
    input: EntitlementEligibilityPreview,
    reasons: string[],
  ): EntitlementEligibilityPreviewDto {
    return {
      previewId: null,
      decision: 'DENY',
      reasons,
      policyVersion: 'reference-data-validation',
      policyRuleId: null,
      policyVersionId: null,
      requestedScopeNodeId: input.locationNodeId,
      resolvedScopeNodeId: null,
      factFingerprint: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
      evaluatedAtUtc: new Date().toISOString(),
      permittedVehicleClasses: [],
      eligibleVehicleOptions: [],
    };
  }

  /** Hashes every policy-relevant request field so preview evidence cannot be reused after edits. */
  private eligibilityRequestFingerprint(input: {
    requestType: string;
    driverOption?: string | null;
    justificationCategory: string;
    durationStart: string;
    durationEnd: string;
    locationNodeId?: string | null;
    requestedVehicleClass?: string;
    vehicleCategoryCode?: string | null;
  }): string {
    return createHash('sha256').update(JSON.stringify({
      requestType: input.requestType,
      driverOption: input.driverOption ?? 'WithoutDriver',
      justificationCategory: input.justificationCategory,
      durationStart: input.durationStart,
      durationEnd: input.durationEnd,
      locationNodeId: input.locationNodeId ?? null,
      requestedVehicleClass:
        input.requestedVehicleClass ?? input.vehicleCategoryCode ?? null,
    })).digest('hex');
  }

  /** Validates an opaque preview against actor, expiry, request facts, class and preferred Vehicle. */
  private async requireEligibilityPreview(
    input: CreateEntitlement,
    actor: Principal & { personId: string },
  ) {
    if (!input.eligibilityPreviewId) {
      throw new ConflictException({
        title: 'Eligibility preview is required before saving the Draft',
        reasons: [ENTITLEMENT_REASON.eligibilityPreviewRequired],
      });
    }
    const preview = await this.repo.findEligibilityPreview(
      input.eligibilityPreviewId,
      actor.organizationId,
      actor.personId,
    );
    if (!preview || preview.decision !== 'ALLOW') {
      throw new ConflictException({
        title: 'Eligibility preview is not valid for Draft creation',
        reasons: [ENTITLEMENT_REASON.eligibilityPreviewInvalid],
      });
    }
    if (preview.expiresAtUtc <= new Date()) {
      throw new ConflictException({
        title: 'Eligibility preview expired',
        reasons: [ENTITLEMENT_REASON.eligibilityPreviewExpired],
      });
    }
    if (preview.requestFingerprint !== this.eligibilityRequestFingerprint(input)) {
      throw new ConflictException({
        title: 'Request changed after eligibility preview',
        reasons: [ENTITLEMENT_REASON.eligibilityPreviewMismatch],
      });
    }
    if (
      input.vehicleCategoryCode &&
      !preview.permittedVehicleClasses.includes(input.vehicleCategoryCode)
    ) {
      throw new ConflictException({
        title: 'Requested Vehicle class is not permitted by eligibility',
        reasons: [ENTITLEMENT_REASON.preferredVehicleInvalid],
      });
    }
    if (
      input.preferredVehicleId &&
      !preview.eligibleVehicleIds.includes(input.preferredVehicleId)
    ) {
      throw new ConflictException({
        title: 'Preferred Vehicle was not returned by eligibility',
        reasons: [ENTITLEMENT_REASON.preferredVehicleInvalid],
      });
    }
    return preview;
  }

  private toDto(row: EntitlementRow): EntitlementDto {
    return {
      id: row.id,
      requestType: row.requestType as EntitlementDto['requestType'],
      driverOption: (row.driverOption ??
        null) as EntitlementDto['driverOption'],
      requesterPersonId: row.requesterPersonId,
      requestedByPersonId: row.requestedByPersonId,
      assignedDriverPersonId: row.assignedDriverPersonId,
      justificationCategory: row.justificationCategory,
      justificationText: row.justificationText,
      vehicleCategoryCode: row.vehicleCategoryCode,
      preferredVehicleId: row.preferredVehicleId,
      preferenceNote: row.preferenceNote,
      vehicleId: row.vehicleId,
      durationStart: row.durationStart ?? '',
      durationEnd: row.durationEnd ?? '',
      locationNodeId: row.locationNodeId,
      businessUnit: row.businessUnit,
      costCentre: row.costCentre,
      status: row.status,
      revision: row.revision,
      workflowInstanceId: row.workflowInstanceId,
      policyVersion: row.policyVersion,
      eligibilityResult: (row.eligibilityResult as Record<string, unknown> | null) ?? null,
      approvalRouteProvenance:
        (row.approvalRouteProvenance as Record<string, unknown> | null) ?? null,
      eligibilityPreviewId: row.eligibilityPreviewId,
      consentSignedAtUtc: row.consentSignedAtUtc ? row.consentSignedAtUtc.toISOString() : null,
      allocatedAtUtc: row.allocatedAtUtc ? row.allocatedAtUtc.toISOString() : null,
      renewedFromEntitlementId: row.renewedFromEntitlementId,
      capabilities: {
        edit: row.status === 'Draft' || row.status === 'ModificationRequested',
        submit: row.status === 'Draft' && Boolean(row.eligibilityPreviewId),
        consent: row.status === 'Approved',
        cancel: ['Draft', 'PendingApproval', 'ModificationRequested', 'Approved', 'AwaitingConsent'].includes(row.status),
        renew: ['Allocated', 'Returned', 'Expired'].includes(row.status),
        returnVehicle: row.status === 'Allocated',
        blockingReasons: row.status === 'Allocated' ? [ENTITLEMENT_REASON.returnRequired] : [],
      },
      createdAtUtc: row.createdAtUtc.toISOString(),
    };
  }
}
