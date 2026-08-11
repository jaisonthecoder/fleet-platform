import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OutboxService } from '../../../common/messaging/outbox.service';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import type { PlatformRole } from '../../../common/database/schema';
import type { Principal } from '../../../common/auth/principal';
import { isVehicleBookable } from '../../../common/domain/vehicle-bookability';
import {
  BOOKING_REASON,
  type AvailabilityQuery,
  type AvailabilityTimelineDto,
  type AvailabilityTimelineQuery,
  type AvailableVehicleDto,
  type BookingContextDto,
  type BookingDto,
  type BookingPersonDto,
  type BookingStatus,
  type BookingApprovalWorkItemDto,
  type BookingPreparationItemDto,
  type CancelBooking,
  type CreateBooking,
  type DecideBooking,
  type ExtendBooking,
  type ModifyBooking,
  type MyBookingDto,
  type SignConsent,
} from '../../../contracts/booking.contract';
import { EligibilityService } from '../../compliance/services/eligibility.service';
import { PolicyEvaluatorService } from '../../policy/services/policy-evaluator.service';
import { DomainDecisionService } from '../../policy/services/domain-decision.service';
import type { DecisionProvenance } from '../../../contracts/domain-decision.contract';
import type { PolicyEvaluationResponse } from '../../../contracts/policy-evaluation.contract';
import type {
  ApprovalHistoryItemDto,
  ApprovalIntervention,
} from '../../../contracts/approval-history.contract';
import { AuditService } from '../../platform/services/audit.service';
import { ScopeAuthorizationService } from '../../platform/services/scope-authorization.service';
import { WorkflowService } from '../../workflow/services/workflow.service';
import {
  applyBuffer,
  durationHours,
  generateBookingNumber,
  resolveApprovers,
  validateWindow,
  type VehicleClass,
  vehicleClassOf,
  withinReConsentTolerance,
} from '../internal/booking-rules';
import { toDbException } from '../internal/pg-error';
import { BookingsRepository } from '../repositories/bookings.repository';
import { ConsentTemplateProvider } from './consent-template.provider';
import { LegacyBookingApprovalRouteAdapter } from '../internal/legacy-booking-approval-route.adapter';

type BookingRow = NonNullable<Awaited<ReturnType<BookingsRepository['findById']>>>;
const TERMINAL: ReadonlySet<string> = new Set([
  'Completed',
  'Declined',
  'Cancelled',
  'Expired',
  'NoShow',
]);
const ON_BEHALF_ROLES = [
  'FleetManager',
  'ClusterFleetLead',
  'GroupFleetLead',
] as const satisfies readonly PlatformRole[];
const BOOKING_PEOPLE_LIMIT = 100;

/** Converts computed database timestamps into stable ISO strings. */
function toIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

interface BookingDecisionContext {
  organizationId: string;
  scopeNodeId: string;
  effectiveAtUtc: string;
}

type BookingPolicyProvenance = Record<string, DecisionProvenance | ReturnType<BookingService['provenance']>>;

type TimelineSegment = AvailabilityTimelineDto['rows'][number]['segments'][number];

/** Appends one non-empty segment and merges adjacent segments with the same state. */
function appendTimelineSegment(segments: TimelineSegment[], start: Date, end: Date, state: TimelineSegment['state']) {
  if (end <= start) return;
  const previous = segments.at(-1);
  if (previous?.state === state && previous.endAtUtc === start.toISOString()) {
    previous.endAtUtc = end.toISOString();
    return;
  }
  segments.push({ startAtUtc: start.toISOString(), endAtUtc: end.toISOString(), state });
}

/**
 * Pool-vehicle booking service (M4). Owns the accountability sub-loop
 * **search → select → consent → submit → approve**, enforcing the three
 * correctness guarantees:
 *  1. **No double-booking** — availability and commit share one persisted
 *     reservation range; the `btree_gist` exclusion makes an overlap a 409.
 *  2. **Consent atomicity** — the booking number is issued only inside the
 *     transaction that commits the consent record (P1B-R2-3).
 *  3. **Zero bookings on expired documents** — the compliance eligibility gate
 *     runs before reservation; a denial is logged, and there is no override
 *     path (P1B-R2-9).
 * Every state change writes domain state + append-only `booking_event` + audit
 * + (where externally observable) an outbox event in one transaction. Business
 * values (buffer, max duration, approval chain, re-consent tolerance) come from
 * the PDP, never hard-coded.
 */
@Injectable()
export class BookingService {
  constructor(
    private readonly repo: BookingsRepository,
    private readonly pdp: PolicyEvaluatorService,
    private readonly decisions: DomainDecisionService,
    private readonly eligibility: EligibilityService,
    private readonly workflow: WorkflowService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly scopeAuthorization: ScopeAuthorizationService,
    private readonly consentTemplates: ConsentTemplateProvider,
    private readonly legacyApprovalRoutes: LegacyBookingApprovalRouteAdapter,
  ) {}

  /** Creates a Draft booking (no number, reserves nothing) after buffer/duration checks. */
  async create(
    input: CreateBooking,
    actorRef = 'system',
    principal?: Principal,
    idempotencyKey?: string,
  ): Promise<BookingDto> {
    const actor = this.authenticatedPrincipal(principal);
    if (!actor.personId) {
      throw new ForbiddenException({ title: 'User not linked', reasons: ['user-not-linked-to-person'] });
    }
    const actorPersonId = actor.personId;
    const commandKey = this.requireIdempotencyKey(idempotencyKey);
    const payloadHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const prior = await this.repo.findCommand(
      actor.organizationId,
      actorPersonId,
      'CREATE_DRAFT',
      commandKey,
    );
    if (prior) {
      if (prior.payloadHash !== payloadHash) {
        throw new ConflictException({
          title: 'Idempotency key was reused with a different payload',
          reasons: ['booking-idempotency-key-reused'],
        });
      }
      if (!prior.resultBookingId) {
        throw new ConflictException({
          title: 'Booking command is still in progress',
          reasons: ['booking-command-in-progress'],
        });
      }
      return this.getInternal(prior.resultBookingId);
    }
    const pickup = new Date(input.pickupAtUtc);
    const ret = new Date(input.returnAtUtc);
    const windowReasons = validateWindow(pickup, ret, new Date());
    if (windowReasons.length) {
      throw new BadRequestException({ title: 'Invalid booking window', reasons: windowReasons });
    }

    const veh = await this.repo.findVehicle(input.vehicleId);
    if (!veh) {
      throw new BadRequestException({
        title: 'Unknown vehicle',
        reasons: [`fk-violation:vehicle:${input.vehicleId}`],
      });
    }
    await this.assertCreateAuthority(input, actor, veh.organizationId);
    if (!isVehicleBookable(veh.lifecycleStatus, veh.bookingPoolFlag)) {
      throw new ConflictException({
        title: 'Vehicle not bookable',
        reasons: [BOOKING_REASON.vehicleNotBookable],
      });
    }
    if (veh.assignmentModel === 'Dedicated' && !await this.repo.isWithinActiveBsdWindow(input.vehicleId, pickup, ret)) {
      throw new ConflictException({ title: 'Dedicated Vehicle is outside its Pool return window', reasons: [BOOKING_REASON.vehicleUnavailable] });
    }
    if (
      input.passengerCount !== undefined &&
      veh.seatingCapacity !== null &&
      input.passengerCount > veh.seatingCapacity
    ) {
      throw new ConflictException({
        title: 'Vehicle capacity is insufficient',
        reasons: [BOOKING_REASON.vehicleCapacityInsufficient],
      });
    }

    const vehicleClass = this.requireVehicleClass(veh.useCategoryCode);
    const decisionContext = await this.decisionContext(input.vehicleId, veh.organizationId, pickup);
    const correlationId = `booking:create:${randomUUID()}`;
    const buffer = await this.bufferMinutes(vehicleClass, decisionContext, correlationId, `vehicle:${input.vehicleId}`);
    const maxDuration = await this.maxDurationHours(vehicleClass, decisionContext, correlationId, `vehicle:${input.vehicleId}`);
    if (durationHours(pickup, ret) > maxDuration.hours) {
      throw new BadRequestException({
        title: 'Booking exceeds maximum duration',
        reasons: [BOOKING_REASON.durationExceedsMax],
      });
    }
    const reservation = applyBuffer(pickup, ret, buffer.minutes);
    if (await this.repo.hasActiveOverlap(input.vehicleId, reservation.start, reservation.end)) {
      throw new ConflictException({
        title: 'Vehicle is no longer available',
        reasons: [BOOKING_REASON.vehicleUnavailable],
      });
    }

    try {
      return await this.repo.transaction(async (tx) => {
        const command = await this.repo.claimCommand(
          {
            organizationId: actor.organizationId,
            actorPersonId,
            commandType: 'CREATE_DRAFT',
            idempotencyKey: commandKey,
            payloadHash,
          },
          tx,
        );
        if (!command) {
          throw new ConflictException({
            title: 'Booking command is already being processed',
            reasons: ['booking-command-in-progress'],
          });
        }
        const created = await this.repo.insert(
          {
            organizationId: decisionContext.organizationId,
            vehicleId: input.vehicleId,
            driverPersonId: input.driverPersonId,
            requestedByPersonId: input.requestedByPersonId,
            beneficiaryPersonId:
              input.requestedByPersonId === input.driverPersonId
                ? input.driverPersonId
                : null,
            bookingScopeNodeId: decisionContext.scopeNodeId,
            status: 'Draft',
            pickupAtUtc: pickup,
            returnAtUtc: ret,
            reservationStart: reservation.start,
            reservationEnd: reservation.end,
            bufferMinutes: buffer.minutes,
            destination: input.destination ?? null,
            purpose: input.purpose ?? null,
            passengerCount: input.passengerCount ?? null,
            policyVersion: buffer.response.policyVersion,
            policyProvenance: {
              bookingBuffer: buffer.provenance,
              maxBookingDuration: maxDuration.provenance,
            },
          },
          tx,
        );
        await Promise.all([
          this.repo.insertPolicyDecision(
            { organizationId: created.organizationId, bookingId: created.id, decisionKey: 'booking-buffer', correlationId, provenance: buffer.provenance },
            tx,
          ),
          this.repo.insertPolicyDecision(
            { organizationId: created.organizationId, bookingId: created.id, decisionKey: 'max-booking-duration', correlationId, provenance: maxDuration.provenance },
            tx,
          ),
        ]);
        await this.repo.insertEvent(
          {
            bookingId: created.id,
            eventType: 'DraftCreated',
            detail: { vehicleClass, bufferMinutes: buffer.minutes },
            actorRef,
          },
          tx,
        );
        await this.audit.record(
          {
            actorRef,
            action: 'BOOKING_DRAFTED',
            entityRef: `booking:${created.id}`,
            after: { vehicleId: created.vehicleId, driverPersonId: created.driverPersonId },
          },
          tx,
        );
        const dto = this.toDto(created);
        await this.repo.completeCommand(command.id, created.id, dto, tx);
        return dto;
      });
    } catch (error) {
      throw toDbException(error);
    }
  }

  /**
   * Signs the mandatory consent and, in the SAME transaction, issues the booking
   * number and moves the booking to a reserved status. The eligibility hard gate
   * runs first (denial logged, no override). The exclusion constraint fires here
   * on a concurrent overlap — rolling back consent + number together (409).
   */
  async signConsent(
    id: string,
    input: SignConsent,
    actorRef = 'system',
    principal?: Principal,
    idempotencyKey?: string,
  ): Promise<BookingDto> {
    const existing = await this.require(id);
    const actor = this.authenticatedPrincipal(principal);
    await this.assertConsentAuthority(existing, actor);
    const commandKey = this.requireIdempotencyKey(idempotencyKey);
    const payloadHash = createHash('sha256')
      .update(JSON.stringify({ bookingId: id, ...input }))
      .digest('hex');
    const prior = await this.repo.findCommand(
      actor.organizationId,
      actor.personId!,
      'SIGN_CONSENT',
      commandKey,
    );
    if (prior) {
      if (prior.payloadHash !== payloadHash) {
        throw new ConflictException({
          title: 'Idempotency key was reused with a different payload',
          reasons: ['booking-idempotency-key-reused'],
        });
      }
      if (!prior.resultBookingId) {
        throw new ConflictException({
          title: 'Booking command is still in progress',
          reasons: ['booking-command-in-progress'],
        });
      }
      return this.getInternal(prior.resultBookingId);
    }
    if (existing.status !== 'Draft') {
      throw new ConflictException({ title: 'Booking is not a draft', reasons: [BOOKING_REASON.notDraft] });
    }
    if (input.driverPersonId !== existing.driverPersonId) {
      throw new BadRequestException({ title: 'Consent driver mismatch', reasons: [BOOKING_REASON.driverMismatch] });
    }
    const expectedTemplate = await this.consentTemplates.current(actor.organizationId);
    if (!expectedTemplate) {
      throw new ConflictException({
        title: 'Booking consent template is unavailable',
        reasons: [BOOKING_REASON.consentTemplateUnavailable],
      });
    }
    if (input.consentDocumentVersion !== expectedTemplate.version) {
      throw new ConflictException({
        title: 'Booking consent version changed',
        reasons: [BOOKING_REASON.consentVersionChanged],
        consent: expectedTemplate,
      });
    }

    // Hard gate BEFORE reserving — zero bookings on expired documents. The gate
    // records the denial append-only; we add an audit entry, then reject. There
    // is no override path (P1B-R2-9).
    const verdict = await this.eligibility.evaluate({
      driverPersonId: existing.driverPersonId,
      vehicleId: existing.vehicleId,
    }, actor.organizationId, {
      correlationId: `booking:${id}:eligibility:${commandKey}`,
      effectiveAtUtc: new Date().toISOString(),
    });
    if (verdict.decision !== 'ALLOW') {
      await this.audit.record({
        actorRef,
        action: 'BOOKING_ELIGIBILITY_DENIED',
        entityRef: `booking:${id}`,
        reason: verdict.reasons.join(','),
        after: { reasons: verdict.reasons },
      });
      throw new ForbiddenException({
        title: 'Driver is not eligible',
        reasons: [BOOKING_REASON.eligibilityDenied, ...verdict.reasons],
      });
    }

    const veh = await this.repo.findVehicle(existing.vehicleId);
    if (!veh || !isVehicleBookable(veh.lifecycleStatus, veh.bookingPoolFlag)) {
      throw new ConflictException({
        title: 'Vehicle not bookable',
        reasons: [BOOKING_REASON.vehicleNotBookable],
      });
    }
    const bookingNumber = generateBookingNumber();
    try {
      return await this.repo.transaction(async (tx) => {
        const effectiveTemplate = await this.consentTemplates.current(actor.organizationId);
        if (!effectiveTemplate || effectiveTemplate.version !== input.consentDocumentVersion) {
          throw new ConflictException({
            title: 'Booking consent version changed',
            reasons: [BOOKING_REASON.consentVersionChanged],
            consent: effectiveTemplate,
          });
        }
        const command = await this.repo.claimCommand(
          {
            organizationId: actor.organizationId,
            actorPersonId: actor.personId!,
            commandType: 'SIGN_CONSENT',
            idempotencyKey: commandKey,
            payloadHash,
          },
          tx,
        );
        if (!command) {
          throw new ConflictException({
            title: 'Booking command is already being processed',
            reasons: ['booking-command-in-progress'],
          });
        }
        const lockedBooking = await this.repo.findByIdForUpdate(existing.id, tx);
        if (!lockedBooking || lockedBooking.status !== 'Draft') {
          throw new ConflictException({ title: 'Booking state changed', reasons: [BOOKING_REASON.notDraft] });
        }
        const lockedVehicle = await this.repo.findVehicleForUpdate(existing.vehicleId, tx);
        if (!lockedVehicle || !isVehicleBookable(lockedVehicle.lifecycleStatus, lockedVehicle.bookingPoolFlag)) {
          throw new ConflictException({ title: 'Vehicle not bookable', reasons: [BOOKING_REASON.vehicleNotBookable] });
        }
        if (lockedVehicle.assignmentModel === 'Dedicated' && !await this.repo.isWithinActiveBsdWindow(existing.vehicleId, existing.reservationStart, existing.reservationEnd, tx)) {
          throw new ConflictException({ title: 'Dedicated Vehicle is outside its Pool return window', reasons: [BOOKING_REASON.vehicleUnavailable] });
        }
        if (await this.repo.hasActiveOverlap(existing.vehicleId, existing.reservationStart, existing.reservationEnd, tx)) {
          throw new ConflictException({ title: 'Vehicle is no longer available', reasons: [BOOKING_REASON.vehicleUnavailable] });
        }
        const consent = await this.repo.insertConsent(
          {
            bookingId: existing.id,
            driverPersonId: existing.driverPersonId,
            vehicleId: existing.vehicleId,
            vehicleCategoryCode: veh?.useCategoryCode ?? null,
            windowStart: existing.pickupAtUtc,
            windowEnd: existing.returnAtUtc,
            policyVersion: existing.policyVersion,
            consentDocumentVersion: effectiveTemplate.version,
            signatureRef: input.signatureRef ?? null,
            ip: input.ip ?? null,
            device: input.device ?? null,
          },
          tx,
        );
        await this.repo.insertConsentEvent(
          { bookingId: existing.id, consentRecordId: consent.id, eventType: 'Signed' },
          tx,
        );
        const reserved = await this.repo.update(
          existing.id,
          { bookingNumber, consentRecordId: consent.id, status: 'PendingApproval' },
          tx,
        );
        await this.repo.insertEvent(
          { bookingId: existing.id, eventType: 'Reserved', detail: { bookingNumber }, actorRef },
          tx,
        );
        await this.audit.record(
          {
            actorRef,
            action: 'BOOKING_RESERVED',
            entityRef: `booking:${existing.id}`,
            after: { bookingNumber, consentId: consent.id },
          },
          tx,
        );
        await this.outbox.enqueue(
          {
            aggregateType: 'booking',
            aggregateId: existing.id,
            eventType: 'ConsentSigned',
            payload: { bookingId: existing.id, consentId: consent.id, bookingNumber },
          },
          tx,
        );
        const dto = this.toDto(reserved);
        await this.repo.completeCommand(command.id, reserved.id, dto, tx);
        return dto;
      });
    } catch (error) {
      throw toDbException(error);
    }
  }

  /** Routes a reserved booking to its approval chain (line manager / PDP chain). */
  async submit(
    id: string,
    actorRef = 'system',
    principal?: Principal,
    idempotencyKey?: string,
  ): Promise<BookingDto> {
    const actor = this.authenticatedPrincipal(principal);
    const commandKey = this.requireIdempotencyKey(idempotencyKey);
    const payloadHash = this.commandPayloadHash(id, {});
    const replay = await this.replayCommand(actor, 'SUBMIT', commandKey, payloadHash);
    if (replay) return replay;
    const existing = await this.require(id);
    await this.assertMutationAuthority(existing, actor);
    if (existing.status !== 'PendingApproval') {
      throw new ConflictException({ title: 'Booking is not reserved', reasons: [BOOKING_REASON.notReserved] });
    }
    if (!existing.consentRecordId) {
      throw new ConflictException({ title: 'Consent is required', reasons: [BOOKING_REASON.consentRequired] });
    }
    const vehicle = await this.repo.findVehicle(existing.vehicleId);
    if (!vehicle) throw new BadRequestException({ title: 'Unknown vehicle', reasons: [`fk-violation:vehicle:${existing.vehicleId}`] });
    const decisionContext = await this.decisionContext(existing.vehicleId, vehicle.organizationId, existing.pickupAtUtc);
    const correlationId = `booking:${id}:submit:${commandKey}`;
    const routeDecision = await this.approvalRoute(durationHours(existing.pickupAtUtc, existing.returnAtUtc), decisionContext, correlationId, `booking:${id}`);
    const route = routeDecision.route;
    const requester = await this.repo.findPerson(existing.requestedByPersonId);
    const approvalAt = new Date();
    const roleToPerson = new Map<string, string | null>();
    for (const role of route) {
      if (roleToPerson.has(role)) {
        continue;
      }
      roleToPerson.set(
        role,
        role === 'LineManager'
          ? requester?.lineManagerPersonId ?? null
          : await this.repo.findApproverForRole(existing.organizationId, role as PlatformRole, decisionContext.scopeNodeId, approvalAt),
      );
    }
    const approvers = resolveApprovers(route, existing.requestedByPersonId, (r) => roleToPerson.get(r) ?? null);
    const requiredSteps = new Set(route).size;
    if (approvers.length === 0 || approvers.length !== requiredSteps) {
      throw new UnprocessableEntityException({
        title: 'No approver could be resolved',
        reasons: [BOOKING_REASON.noApprover],
      });
    }

    try {
      return await this.repo.transaction(async (tx) => {
        const command = await this.repo.claimCommand(
          {
            organizationId: actor.organizationId,
            actorPersonId: actor.personId!,
            commandType: 'SUBMIT',
            idempotencyKey: commandKey,
            payloadHash,
          },
          tx,
        );
        if (!command) throw this.commandInProgress();
        const locked = await this.repo.findByIdForUpdate(existing.id, tx);
        if (!locked) {
          throw new NotFoundException({ title: 'Unknown booking', reasons: [`booking-not-found:${id}`] });
        }
        if (locked.workflowInstanceId) {
          const dto = this.toDto(locked);
          await this.repo.completeCommand(command.id, locked.id, dto, tx);
          return dto;
        }
        if (locked.status !== 'PendingApproval' || !locked.consentRecordId) {
          throw new ConflictException({ title: 'Booking is not reserved', reasons: [BOOKING_REASON.notReserved] });
        }
        const view = await this.workflow.start(
          {
            organizationId: locked.organizationId,
            workflowType: 'booking-approval',
            definitionKey: 'legacy-booking-approval-v1',
            subjectRef: `booking:${locked.id}`,
            slaMinutes: 24 * 60,
            steps: approvers.map((assigneePersonId, index) => ({ assigneePersonId, assignmentKey: route[index]! })),
          },
          tx,
        );
        await this.repo.insertApprovalRoute({
          bookingId: locked.id,
          workflowInstanceId: view.id,
          definitionDeploymentId: view.definitionDeploymentId,
          steps: view.steps.map((step) => ({
            id: step.id,
            assigneePersonId: step.assigneePersonId,
            sequence: step.sequence,
            slaDueAt: step.slaDueAt ? new Date(step.slaDueAt) : null,
          })),
        }, tx);
        await this.repo.insertPolicyDecision(
          { organizationId: locked.organizationId, bookingId: locked.id, decisionKey: 'booking-approval-chain', correlationId, provenance: routeDecision.provenance },
          tx,
        );
        const updated = await this.repo.update(
          locked.id,
          {
            workflowInstanceId: view.id,
            policyProvenance: { ...this.provenanceObject(existing.policyProvenance), bookingApprovalChain: routeDecision.provenance },
          },
          tx,
        );
        await this.repo.insertEvent(
          { bookingId: locked.id, eventType: 'SubmittedForApproval', detail: { workflowId: view.id, approvers }, actorRef },
          tx,
        );
        await this.audit.record(
          { actorRef, action: 'BOOKING_SUBMITTED', entityRef: `booking:${locked.id}`, after: { workflowId: view.id } },
          tx,
        );
        const dto = this.toDto(updated);
        await this.repo.completeCommand(command.id, updated.id, dto, tx);
        return dto;
      });
    } catch (error) {
      throw toDbException(error);
    }
  }

  /** Records an approver decision via the workflow engine and reflects it on the booking. */
  async decide(id: string, input: DecideBooking, principal?: Principal, idempotencyKey?: string): Promise<BookingDto> {
    const actor = this.authenticatedPrincipal(principal);
    if (!actor.personId || actor.personId !== input.actorPersonId) {
      throw new ForbiddenException({ title: 'Approval actor mismatch', reasons: ['approval-actor-mismatch'] });
    }
    const actorPersonId = actor.personId;
    if (actor.roles.length > 0 && actor.roles.every((role) => role.role === 'SystemAdmin')) {
      throw new ForbiddenException({ title: 'System Administrator cannot approve operational Bookings', reasons: ['booking-system-admin-operational-denied'] });
    }
    const commandKey = this.requireIdempotencyKey(idempotencyKey);
    const payloadHash = this.commandPayloadHash(id, input);
    const prior = await this.repo.findDecisionCommand(actor.organizationId, actorPersonId, commandKey);
    if (prior) {
      if (prior.requestSha256 !== payloadHash) throw new ConflictException({ title: 'Idempotency key was reused', reasons: ['booking-idempotency-key-reused'] });
      if (!prior.resultBookingId) throw this.commandInProgress();
      return this.getInternal(prior.resultBookingId);
    }
    const existing = await this.require(id);
    if (input.actorPersonId === existing.requestedByPersonId) {
      throw new ForbiddenException({ title: 'Self-approval is not permitted', reasons: [BOOKING_REASON.sodSelfApproval] });
    }
    if (!existing.workflowInstanceId) {
      throw new ConflictException({ title: 'Booking is not submitted', reasons: [BOOKING_REASON.notReserved] });
    }

    const currentStep = await this.repo.findCurrentWorkflowStep(existing.workflowInstanceId);
    if (!currentStep) throw new ConflictException({ title: 'Workflow step missing', reasons: ['workflow-current-step-missing'] });
    try {
      return await this.repo.transaction(async (tx) => {
        const command = await this.repo.claimDecisionCommand({
          workflowInstanceId: existing.workflowInstanceId!,
          workflowStepId: currentStep.id,
          idempotencyKey: commandKey,
          requestSha256: payloadHash,
          decision: input.decision,
          principalPersonId: actorPersonId,
          actingForPersonId: input.onBehalfOfPersonId ?? null,
        }, tx);
        if (!command) {
          const raced = await this.repo.findDecisionCommand(actor.organizationId, actorPersonId, commandKey, tx);
          if (raced?.requestSha256 !== payloadHash) throw new ConflictException({ title: 'Idempotency key was reused', reasons: ['booking-idempotency-key-reused'] });
          if (!raced?.resultBookingId) throw this.commandInProgress();
          return this.getInternal(raced.resultBookingId);
        }
        const locked = await this.repo.findByIdForUpdate(id, tx);
        if (!locked || locked.revision !== input.expectedBookingVersion) {
          throw new ConflictException({ title: 'Booking state changed', reasons: ['booking-state-conflict'] });
        }
        if (locked.requestedByPersonId === actorPersonId) {
          throw new ForbiddenException({ title: 'Self-approval is not permitted', reasons: [BOOKING_REASON.sodSelfApproval] });
        }
        const decisionResult = await this.workflow.decideInTransaction(locked.workflowInstanceId!, {
          actorPersonId,
          decision: input.decision,
          reason: input.reason,
          onBehalfOfPersonId: input.onBehalfOfPersonId,
          expectedStepVersion: input.expectedStepVersion,
        }, tx);
        const view = decisionResult.view;
        let next: BookingStatus = locked.status;
        let voidConsent = false;
        if (view.status === 'Approved') next = 'Approved';
        else if (view.status === 'Rejected') next = 'Declined';
        else if (view.status === 'ModificationRequested') { next = 'Draft'; voidConsent = true; }
        const patch: Partial<BookingRow> = { status: next };
        if (voidConsent) {
          patch.consentRecordId = null;
          // Returning to Draft ends this approval cycle so re-consent and a new
          // submit command can route a fresh chain.
          patch.workflowInstanceId = null;
          if (locked.consentRecordId) {
            await this.repo.insertConsentEvent(
              { bookingId: locked.id, consentRecordId: locked.consentRecordId, eventType: 'Voided', reason: 'modification-requested' },
              tx,
            );
          }
        }
        const updated = await this.repo.updateAtRevision(locked.id, input.expectedBookingVersion, patch, tx);
        if (!updated) throw new ConflictException({ title: 'Booking state changed', reasons: ['booking-state-conflict'] });
        await this.repo.insertEvent(
          { bookingId: locked.id, eventType: `Decision:${input.decision}`, detail: { workflowStatus: view.status }, actorRef: actorPersonId },
          tx,
        );
        await this.audit.record(
          { actorRef: actorPersonId, action: 'BOOKING_DECISION', entityRef: `booking:${locked.id}`, reason: input.reason, after: { decision: input.decision, status: next } },
          tx,
        );
        if (next === 'Approved') {
          await this.outbox.enqueue(
            { aggregateType: 'booking', aggregateId: locked.id, eventType: 'BookingConfirmed', payload: { bookingId: locked.id, bookingNumber: locked.bookingNumber } },
            tx,
          );
        }
        if (next === 'Declined') {
          await this.outbox.enqueue(
            { aggregateType: 'booking', aggregateId: locked.id, eventType: 'BookingCancelled', payload: { bookingId: locked.id, reason: 'declined' } },
            tx,
          );
        }
        const dto = this.toDto(updated);
        await this.repo.completeDecisionCommand(command.id, updated.id, dto, tx);
        return dto;
      });
    } catch (error) {
      throw toDbException(error);
    }
  }

  /** Requester modification; a material change beyond tolerance voids consent (re-consent). */
  async modify(
    id: string,
    input: ModifyBooking,
    actorRef = 'system',
    principal?: Principal,
    idempotencyKey?: string,
  ): Promise<BookingDto> {
    const actor = this.authenticatedPrincipal(principal);
    const commandKey = this.requireIdempotencyKey(idempotencyKey);
    const payloadHash = this.commandPayloadHash(id, input);
    const replay = await this.replayCommand(actor, 'MODIFY', commandKey, payloadHash);
    if (replay) return replay;
    const existing = await this.require(id);
    await this.assertMutationAuthority(existing, actor);
    if (existing.status !== 'Draft' && existing.status !== 'PendingApproval') {
      throw new ConflictException({ title: 'Booking cannot be modified', reasons: [BOOKING_REASON.notDraft] });
    }
    const nextVehicleId = input.vehicleId ?? existing.vehicleId;
    const nextPickup = input.pickupAtUtc ? new Date(input.pickupAtUtc) : existing.pickupAtUtc;
    const nextRet = input.returnAtUtc ? new Date(input.returnAtUtc) : existing.returnAtUtc;
    const windowReasons = validateWindow(nextPickup, nextRet, new Date());
    if (windowReasons.length) {
      throw new BadRequestException({ title: 'Invalid booking window', reasons: windowReasons });
    }

    const veh = await this.repo.findVehicle(nextVehicleId);
    if (!veh) {
      throw new BadRequestException({ title: 'Unknown vehicle', reasons: [`fk-violation:vehicle:${nextVehicleId}`] });
    }
    if (!isVehicleBookable(veh.lifecycleStatus, veh.bookingPoolFlag)) {
      throw new ConflictException({ title: 'Vehicle not bookable', reasons: [BOOKING_REASON.vehicleNotBookable] });
    }

    const vehicleClass = this.requireVehicleClass(veh.useCategoryCode);
    const decisionContext = await this.decisionContext(nextVehicleId, veh.organizationId, nextPickup);
    const correlationId = `booking:${id}:modify:${nextPickup.toISOString()}`;
    const buffer = await this.bufferMinutes(vehicleClass, decisionContext, correlationId, `booking:${id}`);
    const maxDuration = await this.maxDurationHours(vehicleClass, decisionContext, correlationId, `booking:${id}`);
    if (durationHours(nextPickup, nextRet) > maxDuration.hours) {
      throw new BadRequestException({ title: 'Booking exceeds maximum duration', reasons: [BOOKING_REASON.durationExceedsMax] });
    }
    const reservation = applyBuffer(nextPickup, nextRet, buffer.minutes);
    const toleranceDecision = await this.reConsentToleranceMinutes(decisionContext, correlationId, `booking:${id}`);
    const tolerance = toleranceDecision.minutes;
    const stays = withinReConsentTolerance(
      { vehicleId: existing.vehicleId, pickup: existing.pickupAtUtc, ret: existing.returnAtUtc },
      { vehicleId: nextVehicleId, pickup: nextPickup, ret: nextRet },
      tolerance,
    );
    const needsReConsent = existing.status === 'PendingApproval' && !stays && Boolean(existing.consentRecordId);

    try {
      return await this.repo.transaction(async (tx) => {
        const command = await this.repo.claimCommand(
          {
            organizationId: actor.organizationId,
            actorPersonId: actor.personId!,
            commandType: 'MODIFY',
            idempotencyKey: commandKey,
            payloadHash,
          },
          tx,
        );
        if (!command) throw this.commandInProgress();
        const patch: Partial<BookingRow> = {
          vehicleId: nextVehicleId,
          pickupAtUtc: nextPickup,
          returnAtUtc: nextRet,
          reservationStart: reservation.start,
          reservationEnd: reservation.end,
          bufferMinutes: buffer.minutes,
          organizationId: decisionContext.organizationId,
          policyVersion: buffer.response.policyVersion,
          policyProvenance: {
            ...this.provenanceObject(existing.policyProvenance),
            bookingBuffer: buffer.provenance,
            maxBookingDuration: maxDuration.provenance,
            reConsentTolerance: toleranceDecision.provenance,
          },
        };
        if (needsReConsent) {
          patch.status = 'Draft';
          patch.consentRecordId = null;
          // A material change ends the current approval cycle — clear the
          // workflow so re-consent + re-submit routes a fresh chain.
          patch.workflowInstanceId = null;
          if (existing.consentRecordId) {
            await this.repo.insertConsentEvent(
              { bookingId: existing.id, consentRecordId: existing.consentRecordId, eventType: 'Voided', reason: 'material-change' },
              tx,
            );
          }
        }
        const updated = await this.repo.updateAtRevision(
          existing.id,
          input.expectedRevision,
          patch,
          tx,
        );
        if (!updated) throw this.revisionConflict(input.expectedRevision);
        await Promise.all([
          this.repo.insertPolicyDecision(
            { organizationId: updated.organizationId, bookingId: updated.id, decisionKey: 'booking-buffer', correlationId, provenance: buffer.provenance },
            tx,
          ),
          this.repo.insertPolicyDecision(
            { organizationId: updated.organizationId, bookingId: updated.id, decisionKey: 'max-booking-duration', correlationId, provenance: maxDuration.provenance },
            tx,
          ),
          this.repo.insertPolicyDecision(
            { organizationId: updated.organizationId, bookingId: updated.id, decisionKey: 'consent-re-consent-tolerance', correlationId, provenance: toleranceDecision.provenance },
            tx,
          ),
        ]);
        await this.repo.insertEvent(
          { bookingId: existing.id, eventType: 'Modified', detail: { needsReConsent, vehicleId: nextVehicleId }, actorRef },
          tx,
        );
        await this.audit.record(
          { actorRef, action: 'BOOKING_MODIFIED', entityRef: `booking:${existing.id}`, after: { vehicleId: nextVehicleId, needsReConsent } },
          tx,
        );
        const dto = this.toDto(updated);
        await this.repo.completeCommand(command.id, updated.id, dto, tx);
        return dto;
      });
    } catch (error) {
      throw toDbException(error);
    }
  }

  /** Mid-trip extension; a downstream conflict raises 409 via the exclusion (FR-BOOK-18). */
  async extend(
    id: string,
    input: ExtendBooking,
    actorRef = 'system',
    principal?: Principal,
    idempotencyKey?: string,
  ): Promise<BookingDto> {
    const actor = this.authenticatedPrincipal(principal);
    const commandKey = this.requireIdempotencyKey(idempotencyKey);
    const payloadHash = this.commandPayloadHash(id, input);
    const replay = await this.replayCommand(actor, 'EXTEND', commandKey, payloadHash);
    if (replay) return replay;
    const existing = await this.require(id);
    await this.assertMutationAuthority(existing, actor);
    if (existing.status !== 'Approved' && existing.status !== 'Active') {
      throw new ConflictException({ title: 'Booking cannot be extended', reasons: [BOOKING_REASON.notReserved] });
    }
    const newRet = new Date(input.newReturnAtUtc);
    if (Number.isNaN(newRet.getTime()) || newRet.getTime() <= existing.returnAtUtc.getTime()) {
      throw new BadRequestException({ title: 'Extension must be later', reasons: [BOOKING_REASON.extendNotLater] });
    }
    const reservationEnd = new Date(newRet.getTime() + existing.bufferMinutes * 60_000);
    try {
      return await this.repo.transaction(async (tx) => {
        const command = await this.repo.claimCommand(
          {
            organizationId: actor.organizationId,
            actorPersonId: actor.personId!,
            commandType: 'EXTEND',
            idempotencyKey: commandKey,
            payloadHash,
          },
          tx,
        );
        if (!command) throw this.commandInProgress();
        const updated = await this.repo.updateAtRevision(
          existing.id,
          input.expectedRevision,
          { returnAtUtc: newRet, reservationEnd },
          tx,
        );
        if (!updated) throw this.revisionConflict(input.expectedRevision);
        await this.repo.insertEvent(
          { bookingId: existing.id, eventType: 'Extended', detail: { newReturnAtUtc: newRet.toISOString() }, actorRef },
          tx,
        );
        await this.audit.record(
          { actorRef, action: 'BOOKING_EXTENDED', entityRef: `booking:${existing.id}`, after: { returnAtUtc: newRet.toISOString() } },
          tx,
        );
        await this.outbox.enqueue(
          { aggregateType: 'booking', aggregateId: existing.id, eventType: 'BookingChanged', payload: { change: 'extended', bookingId: existing.id } },
          tx,
        );
        const dto = this.toDto(updated);
        await this.repo.completeCommand(command.id, updated.id, dto, tx);
        return dto;
      });
    } catch (error) {
      throw toDbException(error);
    }
  }

  /** Cancels a booking, releasing its reservation. */
  async cancel(
    id: string,
    input: CancelBooking,
    actorRef = 'system',
    principal?: Principal,
    idempotencyKey?: string,
  ): Promise<BookingDto> {
    const actor = this.authenticatedPrincipal(principal);
    const commandKey = this.requireIdempotencyKey(idempotencyKey);
    const payloadHash = this.commandPayloadHash(id, input);
    const replay = await this.replayCommand(actor, 'CANCEL', commandKey, payloadHash);
    if (replay) return replay;
    const existing = await this.require(id);
    await this.assertMutationAuthority(existing, actor);
    if (TERMINAL.has(existing.status)) {
      throw new ConflictException({ title: 'Booking is already terminal', reasons: [BOOKING_REASON.terminal] });
    }
    if (existing.status === 'Active') {
      throw new ConflictException({ title: 'Active custody must be returned through Handover', reasons: [BOOKING_REASON.activeRequiresReturn] });
    }
    return this.repo.transaction(async (tx) => {
      const command = await this.repo.claimCommand(
        {
          organizationId: actor.organizationId,
          actorPersonId: actor.personId!,
          commandType: 'CANCEL',
          idempotencyKey: commandKey,
          payloadHash,
        },
        tx,
      );
      if (!command) throw this.commandInProgress();
      const locked = await this.repo.findByIdForUpdate(existing.id, tx);
      if (!locked || locked.revision !== input.expectedRevision || TERMINAL.has(locked.status)) {
        throw new ConflictException({ title: 'Booking state changed', reasons: ['booking-state-conflict'] });
      }
      const updated = await this.repo.updateAtRevision(
        existing.id,
        input.expectedRevision,
        { status: 'Cancelled' },
        tx,
      );
      if (!updated) throw this.revisionConflict(input.expectedRevision);
      await this.repo.insertEvent(
        { bookingId: existing.id, eventType: 'Cancelled', detail: { reason: input.reason ?? null }, actorRef },
        tx,
      );
      await this.audit.record(
        { actorRef, action: 'BOOKING_CANCELLED', entityRef: `booking:${existing.id}`, reason: input.reason },
        tx,
      );
      await this.outbox.enqueue(
        { aggregateType: 'booking', aggregateId: existing.id, eventType: 'BookingCancelled', payload: { bookingId: existing.id, reason: input.reason ?? 'cancelled' } },
        tx,
      );
      const dto = this.toDto(updated);
      await this.repo.completeCommand(command.id, updated.id, dto, tx);
      return dto;
    });
  }

  /** Marks an Approved booking as picked up (→ Active) — driven by the handover event. */
  async markPickedUp(id: string, actorRef = 'system'): Promise<BookingDto> {
    return this.repo.transaction((tx) => this.markPickedUpInTransaction(id, actorRef, tx));
  }

  /** Marks an Approved Booking Active inside an owning cross-domain transaction. */
  async markPickedUpInTransaction(id: string, actorRef: string, tx: DrizzleDatabase): Promise<BookingDto> {
    const existing = await this.repo.findByIdForUpdate(id, tx);
    if (!existing || existing.status !== 'Approved' || existing.approvalSuspendedAtUtc) {
      throw new ConflictException({ title: 'Booking is not approved for handover', reasons: [BOOKING_REASON.notReserved] });
    }
    const updated = await this.repo.update(existing.id, { status: 'Active' }, tx);
    await this.repo.insertEvent({ bookingId: existing.id, eventType: 'PickedUp', actorRef }, tx);
    await this.audit.record({ actorRef, action: 'BOOKING_PICKED_UP', entityRef: `booking:${existing.id}` }, tx);
    await this.outbox.enqueue(
      { aggregateType: 'booking', aggregateId: existing.id, eventType: 'BookingChanged', payload: { change: 'picked-up', bookingId: existing.id } },
      tx,
    );
    return this.toDto(updated);
  }

  /** Marks an Active booking as returned (→ Completed) — driven by the return event. */
  async markReturned(id: string, actorRef = 'system', lateReturn = false): Promise<BookingDto> {
    return this.repo.transaction((tx) => this.markReturnedInTransaction(id, actorRef, lateReturn, tx));
  }

  /** Marks an Active Booking Completed inside an owning cross-domain transaction. */
  async markReturnedInTransaction(id: string, actorRef: string, lateReturn: boolean, tx: DrizzleDatabase): Promise<BookingDto> {
    const existing = await this.repo.findByIdForUpdate(id, tx);
    if (!existing || existing.status !== 'Active') {
      throw new ConflictException({ title: 'Booking is not active for return', reasons: [BOOKING_REASON.notReserved] });
    }
    const updated = await this.repo.update(existing.id, { status: 'Completed' }, tx);
    await this.repo.insertEvent({ bookingId: existing.id, eventType: 'Returned', detail: { lateReturn }, actorRef }, tx);
    await this.audit.record({ actorRef, action: 'BOOKING_RETURNED', entityRef: `booking:${existing.id}`, after: { lateReturn } }, tx);
    await this.outbox.enqueue(
      { aggregateType: 'booking', aggregateId: existing.id, eventType: 'BookingChanged', payload: { change: 'returned', bookingId: existing.id, lateReturn } },
      tx,
    );
    return this.toDto(updated);
  }

  /** The booking active for a vehicle at an instant — the telematics trip-attach port (P1B-R1-1). */
  async findActiveBooking(vehicleId: string, at: Date): Promise<{ bookingId: string; driverPersonId: string } | null> {
    return this.repo.findActiveBookingForVehicle(vehicleId, at);
  }

  /** The booking that covered a (possibly historical) event — for fine/accident attribution. */
  async findBookingCoveringEvent(vehicleId: string, at: Date): Promise<{ bookingId: string; driverPersonId: string } | null> {
    return this.repo.findBookingCoveringEvent(vehicleId, at);
  }

  /** Vehicles available for a window — computed from the same reservation ranges. */
  async availability(
    query: AvailabilityQuery,
    principal: Principal,
  ): Promise<AvailableVehicleDto[]> {
    if (!principal.personId) {
      throw new ForbiddenException({
        title: 'User not linked',
        reasons: ['user-not-linked-to-person'],
      });
    }
    const start = new Date(query.pickupAtUtc);
    const end = new Date(query.returnAtUtc);
    const windowReasons = validateWindow(start, end, new Date());
    if (windowReasons.length) {
      throw new BadRequestException({ title: 'Invalid availability window', reasons: windowReasons });
    }
    const authorizedNodeIds = await this.scopeAuthorization.authorizedDescendantIds(principal);
    const rows = await this.repo.listAvailable(
      principal.organizationId,
      start,
      end,
      query.seatingCapacity,
      authorizedNodeIds,
    );
    return rows.map((r) => ({
      vehicleId: r.vehicleId,
      plate: r.plate,
      makeCode: r.makeCode,
      modelCode: r.modelCode,
      bodyTypeCode: r.bodyTypeCode,
      useCategoryCode: r.useCategoryCode,
      seatingCapacity: r.seatingCapacity,
      fuelTypeCode: r.fuelTypeCode,
      locationName: r.locationName,
    }));
  }

  /** Returns scoped pool occupancy without exposing another person's Booking facts. */
  async availabilityTimeline(
    query: AvailabilityTimelineQuery,
    principal: Principal,
  ): Promise<AvailabilityTimelineDto> {
    if (!principal.personId) {
      throw new ForbiddenException({ title: 'User not linked', reasons: ['user-not-linked-to-person'] });
    }
    const start = new Date(query.startAtUtc);
    const end = new Date(query.endAtUtc);
    const authorizedNodeIds = await this.scopeAuthorization.authorizedDescendantIds(principal);
    const source = await this.repo.listAvailabilityTimeline(
      start,
      end,
      principal.personId,
      principal.organizationId,
      authorizedNodeIds,
    );
    const grouped = new Map<string, typeof source>();
    for (const row of source) {
      const rows = grouped.get(row.vehicleId) ?? [];
      rows.push(row);
      grouped.set(row.vehicleId, rows);
    }
    const rows = [...grouped.values()].map((vehicleRows) => {
      const first = vehicleRows[0]!;
      const segments: TimelineSegment[] = [];
      if (!isVehicleBookable(first.lifecycleStatus, first.bookingPoolFlag)) {
        appendTimelineSegment(segments, start, end, 'UNAVAILABLE');
      } else {
        let cursor = start;
        for (const reservation of vehicleRows) {
          if (!reservation.reservationStart || !reservation.reservationEnd) continue;
          const reservationStart = new Date(Math.max(start.getTime(), reservation.reservationStart.getTime()));
          const reservationEnd = new Date(Math.min(end.getTime(), reservation.reservationEnd.getTime()));
          appendTimelineSegment(segments, cursor, reservationStart, 'OPEN');
          appendTimelineSegment(segments, reservationStart, reservationEnd, reservation.isOwn ? 'OWN' : 'UNAVAILABLE');
          if (reservationEnd > cursor) cursor = reservationEnd;
        }
        appendTimelineSegment(segments, cursor, end, 'OPEN');
      }
      return {
        vehicleId: first.vehicleId,
        plate: first.plate,
        makeCode: first.makeCode,
        modelCode: first.modelCode,
        bodyTypeCode: first.bodyTypeCode,
        seatingCapacity: first.seatingCapacity,
        fuelTypeCode: first.fuelTypeCode,
        locationName: first.locationName,
        segments,
      };
    });
    return { startAtUtc: start.toISOString(), endAtUtc: end.toISOString(), rows };
  }

  /** Active people the caller may select as requester/driver for a booking. */
  async bookablePeople(principal: Principal): Promise<BookingPersonDto[]> {
    if (!principal.personId) {
      throw new ForbiddenException({ title: 'User not linked', reasons: ['user-not-linked-to-person'] });
    }
    const people = await this.repo.listActiveBookingPeople(principal.organizationId);
    const canManageOthers = principal.roles.some((role) =>
      ON_BEHALF_ROLES.includes(role.role as (typeof ON_BEHALF_ROLES)[number]),
    );
    const result: BookingPersonDto[] = [];
    for (const person of people) {
      if (!person.homeScopeNodeId || !person.homeScopeName) continue;
      const isSelf = person.personId === principal.personId;
      if (
        !isSelf &&
        (!canManageOthers ||
          !(await this.scopeAuthorization.canRolesAtScope(
            principal,
            ON_BEHALF_ROLES,
            person.homeScopeNodeId,
          )))
      ) continue;
      result.push({
        personId: person.personId,
        fullName: person.fullName,
        employeeId: person.employeeId,
        grade: person.grade,
        homeScopeNodeId: person.homeScopeNodeId,
        homeScopeName: person.homeScopeName,
        isProfessionalDriver: person.isProfessionalDriver,
        isSelf,
      });
      if (result.length === BOOKING_PEOPLE_LIMIT) break;
    }
    return result;
  }

  /** Returns the caller's directly assigned or actively delegated approval tasks. */
  async approvalWorklist(principal: Principal): Promise<BookingApprovalWorkItemDto[]> {
    const actor = this.authenticatedPrincipal(principal);
    if (!actor.personId) throw new ForbiddenException({ title: 'User not linked', reasons: ['user-not-linked-to-person'] });
    const rows = await this.repo.listApprovalWorklist(actor.personId);
    return rows.map((row) => ({
      bookingId: row.bookingId,
      bookingNumber: row.bookingNumber!,
      requesterName: row.requesterName,
      vehicle: { plate: row.plate, makeCode: row.makeCode, modelCode: row.modelCode },
      pickupAtUtc: row.pickupAtUtc.toISOString(),
      returnAtUtc: row.returnAtUtc.toISOString(),
      purpose: row.purpose,
      passengerCount: row.passengerCount,
      consentVersion: row.consentVersion,
      workflowStepId: row.workflowStepId,
      expectedBookingVersion: row.bookingVersion,
      expectedStepVersion: row.stepVersion,
      dueAtUtc: row.dueAtUtc?.toISOString() ?? null,
      delegated: row.delegated,
      evidence: { eligibility: 'VERIFIED_AT_CONSENT', consent: 'SIGNED', reservation: 'HELD', forecast: 'NOT_AVAILABLE' },
      requester: {
        fullName: row.requesterName,
        employeeId: row.requesterEmployeeId,
        relationshipCode: row.delegated
          ? 'DELEGATE'
          : row.requesterLineManagerPersonId === actor.personId
            ? 'DIRECT_MANAGER'
            : actor.roles.some(({ role }) => ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'].includes(role))
              ? 'FLEET_AUTHORITY'
              : 'WORKFLOW_ASSIGNEE',
        behavior: {
          year: new Date().getUTCFullYear(),
          bookingCount: row.behaviorBookingCount,
          noShowCount: row.behaviorNoShowCount,
          lateReturnCount: row.behaviorLateReturnCount,
        },
      },
      destination: row.destination,
      durationMinutes: Math.max(1, Math.round((row.returnAtUtc.getTime() - row.pickupAtUtc.getTime()) / 60_000)),
      justification: row.purpose,
      evidenceItems: [
        {
          kind: 'Eligibility',
          status: row.eligibilityDecision === 'ALLOW' ? 'VERIFIED' : 'UNAVAILABLE',
          reasonCodes: row.eligibilityReasons ?? ['booking-eligibility-evidence-unavailable'],
          occurredAtUtc: toIso(row.eligibilityEvaluatedAtUtc),
          version: row.eligibilityPolicyVersion,
        },
        { kind: 'Consent', status: 'SIGNED', reasonCodes: [], occurredAtUtc: row.consentSignedAtUtc.toISOString(), version: row.consentVersion },
        { kind: 'Reservation', status: 'HELD', reasonCodes: ['booking-reservation-held'], occurredAtUtc: row.consentSignedAtUtc.toISOString(), version: null },
        { kind: 'Forecast', status: 'NOT_CONFIGURED', reasonCodes: ['booking-forecast-not-configured'], occurredAtUtc: null, version: null },
      ],
      cost: { status: 'NOT_CONFIGURED', amount: null, currency: null, utilizationPercent: null, suggestedStartAtUtc: null, reasonCodes: ['booking-cost-not-configured'] },
      forecast: { status: 'NOT_CONFIGURED', amount: null, currency: null, utilizationPercent: null, suggestedStartAtUtc: null, reasonCodes: ['booking-forecast-not-configured'] },
    }));
  }

  /** Returns categorized Pool approval history for decisions made by the caller. */
  async approvalHistory(principal: Principal): Promise<ApprovalHistoryItemDto[]> {
    const actor = this.authenticatedPrincipal(principal);
    if (!actor.personId) throw new ForbiddenException({ title: 'User not linked', reasons: ['user-not-linked-to-person'] });
    const rows = await this.repo.listApprovalHistory(actor.personId, actor.organizationId);
    return rows.map((row) => ({
      domain: 'PoolBooking',
      subjectId: row.subjectId,
      reference: row.reference,
      requesterName: row.requesterName,
      summary: row.summary,
      status: row.status,
      revision: row.revision,
      decision: row.decision,
      decisionReason: row.decisionReason,
      decidedAtUtc: toIso(row.decidedAtUtc)!,
      suspended: Boolean(row.suspendedAtUtc),
      suspensionReason: row.suspensionReason,
      suspendedAtUtc: toIso(row.suspendedAtUtc),
      capabilities: {
        suspend: row.status === 'Approved' && !row.suspendedAtUtc,
        resume: row.status === 'Approved' && Boolean(row.suspendedAtUtc),
        revoke: row.status === 'Approved',
      },
      interventions: row.interventions.map((entry) => ({ ...entry, occurredAtUtc: toIso(entry.occurredAtUtc)! })),
    }));
  }

  /** Suspends, resumes, or irrevocably revokes a caller-participated Pool approval before custody. */
  async interveneApproval(
    id: string,
    input: ApprovalIntervention,
    principal: Principal,
    idempotencyKey: string,
  ): Promise<BookingDto> {
    const actor = this.authenticatedPrincipal(principal);
    if (!actor.personId) throw new ForbiddenException({ title: 'User not linked', reasons: ['user-not-linked-to-person'] });
    const actorPersonId = actor.personId;
    const commandType = `APPROVAL_${input.action}`;
    const payloadHash = createHash('sha256').update(JSON.stringify({ id, input })).digest('hex');
    const prior = await this.repo.findCommand(actor.organizationId, actorPersonId, commandType, idempotencyKey);
    if (prior) {
      if (prior.payloadHash !== payloadHash) throw new ConflictException({ title: 'Idempotency key was reused', reasons: ['booking-idempotency-key-reused'] });
      if (!prior.resultBookingId) throw new ConflictException({ title: 'Command is in progress', reasons: ['booking-command-in-progress'] });
      return this.toDto(await this.require(prior.resultBookingId));
    }
    return this.repo.transaction(async (tx) => {
      const command = await this.repo.claimCommand({
        organizationId: actor.organizationId,
        actorPersonId,
        commandType,
        idempotencyKey,
        payloadHash,
      }, tx);
      if (!command) throw new ConflictException({ title: 'Command is in progress', reasons: ['booking-command-in-progress'] });
      const locked = await this.repo.findByIdForUpdate(id, tx);
      if (!locked || locked.organizationId !== actor.organizationId || locked.revision !== input.expectedRevision || locked.status !== 'Approved' || !locked.workflowInstanceId) {
        throw new ConflictException({ title: 'Booking approval state changed', reasons: ['booking-approval-intervention-state-conflict'] });
      }
      if (!(await this.repo.hasApprovedDecision(locked.workflowInstanceId, actorPersonId, actor.organizationId, tx))) {
        throw new ForbiddenException({ title: 'Only a participating approver may intervene', reasons: ['booking-approval-intervention-not-participant'] });
      }
      if (input.action === 'SUSPEND' && locked.approvalSuspendedAtUtc) throw new ConflictException({ title: 'Approval is already suspended', reasons: ['booking-approval-already-suspended'] });
      if (input.action === 'RESUME' && !locked.approvalSuspendedAtUtc) throw new ConflictException({ title: 'Approval is not suspended', reasons: ['booking-approval-not-suspended'] });
      const patch = input.action === 'SUSPEND'
        ? { approvalSuspendedAtUtc: new Date(), approvalSuspendedByPersonId: actorPersonId, approvalSuspensionReason: input.reason }
        : input.action === 'RESUME'
          ? { approvalSuspendedAtUtc: null, approvalSuspendedByPersonId: null, approvalSuspensionReason: null }
          : { status: 'Cancelled' as const, approvalSuspendedAtUtc: null, approvalSuspendedByPersonId: null, approvalSuspensionReason: null };
      const updated = await this.repo.updateAtRevision(id, input.expectedRevision, patch, tx);
      if (!updated) throw new ConflictException({ title: 'Booking approval state changed', reasons: ['booking-approval-intervention-state-conflict'] });
      const eventType = input.action === 'SUSPEND' ? 'ApprovalSuspended' : input.action === 'RESUME' ? 'ApprovalResumed' : 'ApprovalRevoked';
      const auditAction = input.action === 'SUSPEND' ? 'BOOKING_APPROVAL_SUSPENDED' : input.action === 'RESUME' ? 'BOOKING_APPROVAL_RESUMED' : 'BOOKING_APPROVAL_REVOKED';
      await this.repo.insertEvent({ bookingId: id, eventType, detail: { reason: input.reason }, actorRef: actorPersonId }, tx);
      await this.audit.record({ organizationId: actor.organizationId, actorRef: actorPersonId, action: auditAction, entityRef: `booking:${id}`, reason: input.reason }, tx);
      await this.outbox.enqueue({ aggregateType: 'booking', aggregateId: id, eventType, payload: { bookingId: id, reason: input.reason } }, tx);
      const dto = this.toDto(updated);
      await this.repo.completeCommand(command.id, id, dto, tx);
      return dto;
    });
  }

  /** Returns the scoped read-only Fleet preparation queue. */
  async preparationWorklist(principal: Principal): Promise<BookingPreparationItemDto[]> {
    const actor = this.authenticatedPrincipal(principal);
    const allowed = actor.roles.some((role) => ON_BEHALF_ROLES.includes(role.role as (typeof ON_BEHALF_ROLES)[number]));
    if (!allowed) throw new ForbiddenException({ title: 'Fleet preparation role required', reasons: ['booking-preparation-role-required'] });
    const scopes = await this.scopeAuthorization.authorizedDescendantIds(actor);
    const rows = await this.repo.listPreparationWorklist(scopes);
    return rows.map((row) => ({ ...row, bookingNumber: row.bookingNumber!, pickupAtUtc: row.pickupAtUtc.toISOString(), returnAtUtc: row.returnAtUtc.toISOString(), readiness: 'AWAITING_HANDOVER' }));
  }

  /** Returns only the authenticated person's own requested/driver Bookings. */
  async myBookings(principal: Principal): Promise<MyBookingDto[]> {
    const actor = this.authenticatedPrincipal(principal);
    if (!actor.personId) throw new ForbiddenException({ title: 'User not linked', reasons: ['user-not-linked-to-person'] });
    const rows = await this.repo.listOwnBookings(actor.personId);
    return rows.map((row) => ({
      ...this.toDto(row.booking),
      vehicle: {
        plate: row.plate,
        makeCode: row.makeCode,
        modelCode: row.modelCode,
        bodyTypeCode: row.bodyTypeCode,
        fuelTypeCode: row.fuelTypeCode,
        seatingCapacity: row.seatingCapacity,
      },
      scopeName: row.scopeName,
      capabilities: {
        consent: row.booking.status === 'Draft',
        modify: row.booking.status === 'Draft' || row.booking.status === 'PendingApproval',
        extend: row.booking.status === 'Approved' || row.booking.status === 'Active',
        cancel: ['Draft', 'PendingApproval', 'Approved'].includes(row.booking.status),
        returnVehicle: row.booking.status === 'Active',
      },
    }));
  }

  /** Returns server-authoritative Booking modes, defaults and dependency readiness. */
  async context(principal: Principal): Promise<BookingContextDto> {
    const actor = this.authenticatedPrincipal(principal);
    if (!actor.personId) {
      throw new ForbiddenException({ title: 'User not linked', reasons: ['user-not-linked-to-person'] });
    }
    const people = await this.bookablePeople(actor);
    const self = people.find((person) => person.isSelf);
    const selfEnabled = Boolean(
      self && await this.scopeAuthorization.canRolesAtScope(
        actor,
        ['Employee'],
        self.homeScopeNodeId,
      ),
    );
    const onBehalfEnabled = people.some((person) => !person.isSelf);
    const consentTemplate = await this.consentTemplates.current(actor.organizationId);
    return {
      actor: {
        personId: actor.personId,
        fullName: self?.fullName ?? actor.email ?? actor.personId,
        email: actor.email,
        roles: [...new Set(actor.roles.map((assignment) => assignment.role))],
      },
      modes: {
        self: {
          enabled: selfEnabled,
          blockingReasons: selfEnabled ? [] : ['booking-self-scope-not-authorized'],
        },
        onBehalf: {
          enabled: onBehalfEnabled,
          blockingReasons: onBehalfEnabled ? [] : [BOOKING_REASON.onBehalfNotAllowed],
        },
        emergency: {
          enabled: false,
          blockingReasons: ['booking-emergency-mode-not-approved'],
        },
      },
      defaults: {
        requestedByPersonId: actor.personId,
        driverPersonId: actor.personId,
        scopeNodeId: self?.homeScopeNodeId ?? null,
        scopeName: self?.homeScopeName ?? null,
      },
      consent: {
        status: consentTemplate ? 'AVAILABLE' : 'PENDING_APPROVAL',
        version: consentTemplate?.version ?? null,
        contentHash: consentTemplate?.contentHash ?? null,
        effectiveAtUtc: consentTemplate?.effectiveAtUtc ?? null,
        content: consentTemplate?.content ?? null,
      },
      dependencies: [
        { key: 'vehicleAvailability', status: 'AVAILABLE' },
        { key: 'eligibility', status: 'AVAILABLE' },
        { key: 'consentTemplate', status: consentTemplate ? 'AVAILABLE' : 'PENDING_APPROVAL' },
      ],
    };
  }

  /** Returns a booking by id when the caller owns, drives or manages it. */
  async get(id: string, principal?: Principal): Promise<BookingDto> {
    const booking = await this.require(id);
    await this.assertReadAuthority(booking, this.authenticatedPrincipal(principal));
    return this.toDto(booking);
  }

  /** Returns the append-only event log when the caller may read the booking. */
  async events(id: string, principal?: Principal) {
    const booking = await this.require(id);
    await this.assertReadAuthority(booking, this.authenticatedPrincipal(principal));
    return this.repo.listEvents(id);
  }

  /** Returns Booking state to trusted in-process lifecycle orchestration. */
  async getInternal(id: string): Promise<BookingDto> {
    return this.toDto(await this.require(id));
  }

  // ---- internals -------------------------------------------------------------

  private async assertCreateAuthority(
    input: CreateBooking,
    principal: Principal,
    vehicleOrganizationId: string,
  ): Promise<void> {
    if (!principal.personId) {
      throw new ForbiddenException({
        title: 'User not linked',
        reasons: ['user-not-linked-to-person'],
      });
    }
    if (vehicleOrganizationId !== principal.organizationId) {
      throw new ForbiddenException({
        title: 'Booking organization is not authorized',
        reasons: ['booking-organization-not-authorized'],
      });
    }

    const [requester, driver, vehicleScopeNodeId] = await Promise.all([
      this.repo.findPersonBookingProfile(input.requestedByPersonId),
      this.repo.findPersonBookingProfile(input.driverPersonId),
      this.repo.findVehicleScope(input.vehicleId),
    ]);
    const requireActiveProfile = (
      profile: typeof requester,
      personId: string,
    ): NonNullable<typeof requester> & { homeScopeNodeId: string } => {
      if (!profile || profile.employmentStatus !== 'Active') {
        throw new ForbiddenException({
          title: 'Booking person is not active',
          reasons: [`${BOOKING_REASON.personInactive}:${personId}`],
        });
      }
      if (profile.organizationId !== principal.organizationId) {
        throw new ForbiddenException({
          title: 'Booking person organization is not authorized',
          reasons: [`booking-person-organization-not-authorized:${personId}`],
        });
      }
      if (!profile.homeScopeNodeId) {
        throw new ForbiddenException({
          title: 'Booking person has no authorized home scope',
          reasons: [`${BOOKING_REASON.personScopeMissing}:${personId}`],
        });
      }
      return profile as NonNullable<typeof requester> & {
        homeScopeNodeId: string;
      };
    };
    const activeRequester = requireActiveProfile(requester, input.requestedByPersonId);
    const activeDriver = requireActiveProfile(driver, input.driverPersonId);
    if (!vehicleScopeNodeId) {
      throw new ForbiddenException({
        title: 'Vehicle has no authorized hierarchy scope',
        reasons: [`vehicle-scope-missing:${input.vehicleId}`],
      });
    }

    const selfBooking =
      input.requestedByPersonId === principal.personId &&
      input.driverPersonId === principal.personId;
    if (selfBooking) {
      await this.scopeAuthorization.assertRolesAtScope(
        principal,
        ['Employee'],
        vehicleScopeNodeId,
      );
      return;
    }

    const canManage = principal.roles.some((assignment) =>
      ON_BEHALF_ROLES.includes(
        assignment.role as (typeof ON_BEHALF_ROLES)[number],
      ),
    );
    if (!canManage) {
      throw new ForbiddenException({
        title: 'Booking on behalf is not authorized',
        reasons: [BOOKING_REASON.onBehalfNotAllowed],
      });
    }
    await Promise.all([
      this.scopeAuthorization.assertRolesAtScope(
        principal,
        ON_BEHALF_ROLES,
        activeRequester.homeScopeNodeId,
      ),
      this.scopeAuthorization.assertRolesAtScope(
        principal,
        ON_BEHALF_ROLES,
        activeDriver.homeScopeNodeId,
      ),
      this.scopeAuthorization.assertRolesAtScope(
        principal,
        ON_BEHALF_ROLES,
        vehicleScopeNodeId,
      ),
    ]);
  }

  private async assertMutationAuthority(
    booking: BookingRow,
    principal: Principal,
  ): Promise<void> {
    if (!principal.personId) {
      throw new ForbiddenException({
        title: 'User not linked',
        reasons: ['user-not-linked-to-person'],
      });
    }
    if (booking.organizationId !== principal.organizationId) {
      throw new ForbiddenException({
        title: 'Booking organization is not authorized',
        reasons: ['booking-organization-not-authorized'],
      });
    }

    const vehicleScopeNodeId = await this.repo.findVehicleScope(booking.vehicleId);
    if (!vehicleScopeNodeId) {
      throw new ForbiddenException({
        title: 'Vehicle has no authorized hierarchy scope',
        reasons: [`vehicle-scope-missing:${booking.vehicleId}`],
      });
    }
    if (booking.requestedByPersonId === principal.personId) {
      await this.scopeAuthorization.assertRolesAtScope(
        principal,
        ['Employee'],
        vehicleScopeNodeId,
      );
      return;
    }

    const canManage = principal.roles.some((assignment) =>
      ON_BEHALF_ROLES.includes(
        assignment.role as (typeof ON_BEHALF_ROLES)[number],
      ),
    );
    if (!canManage) {
      throw new ForbiddenException({
        title: 'Booking mutation is not authorized',
        reasons: [BOOKING_REASON.onBehalfNotAllowed],
      });
    }
    await this.scopeAuthorization.assertRolesAtScope(
      principal,
      ON_BEHALF_ROLES,
      vehicleScopeNodeId,
    );
  }

  private async assertReadAuthority(
    booking: BookingRow,
    principal: Principal,
  ): Promise<void> {
    this.assertLinkedOrganization(booking, principal);
    const vehicleScopeNodeId = await this.requireVehicleScope(booking.vehicleId);
    if (
      booking.requestedByPersonId === principal.personId ||
      booking.driverPersonId === principal.personId
    ) {
      await this.scopeAuthorization.assertRolesAtScope(
        principal,
        ['Employee'],
        vehicleScopeNodeId,
      );
      return;
    }
    await this.assertManagedScope(principal, vehicleScopeNodeId, 'Booking read is not authorized');
  }

  private async assertConsentAuthority(
    booking: BookingRow,
    principal: Principal,
  ): Promise<void> {
    this.assertLinkedOrganization(booking, principal);
    if (booking.driverPersonId !== principal.personId) {
      throw new ForbiddenException({
        title: 'Booking consent is not authorized',
        reasons: [BOOKING_REASON.driverMismatch],
      });
    }
    await this.scopeAuthorization.assertRolesAtScope(
      principal,
      ['Employee'],
      await this.requireVehicleScope(booking.vehicleId),
    );
  }

  private assertLinkedOrganization(booking: BookingRow, principal: Principal): void {
    if (!principal.personId) {
      throw new ForbiddenException({
        title: 'User not linked',
        reasons: ['user-not-linked-to-person'],
      });
    }
    if (booking.organizationId !== principal.organizationId) {
      throw new ForbiddenException({
        title: 'Booking organization is not authorized',
        reasons: ['booking-organization-not-authorized'],
      });
    }
  }

  private async requireVehicleScope(vehicleId: string): Promise<string> {
    const vehicleScopeNodeId = await this.repo.findVehicleScope(vehicleId);
    if (!vehicleScopeNodeId) {
      throw new ForbiddenException({
        title: 'Vehicle has no authorized hierarchy scope',
        reasons: [`vehicle-scope-missing:${vehicleId}`],
      });
    }
    return vehicleScopeNodeId;
  }

  private async assertManagedScope(
    principal: Principal,
    vehicleScopeNodeId: string,
    title: string,
  ): Promise<void> {
    if (!principal.roles.some((assignment) =>
      ON_BEHALF_ROLES.includes(assignment.role as (typeof ON_BEHALF_ROLES)[number]))) {
      throw new ForbiddenException({
        title,
        reasons: [BOOKING_REASON.onBehalfNotAllowed],
      });
    }
    await this.scopeAuthorization.assertRolesAtScope(
      principal,
      ON_BEHALF_ROLES,
      vehicleScopeNodeId,
    );
  }

  private authenticatedPrincipal(principal?: Principal): Principal {
    if (!principal) {
      throw new ForbiddenException({
        title: 'Authenticated principal is required',
        reasons: ['authenticated-principal-required'],
      });
    }
    return principal;
  }

  private requireIdempotencyKey(value?: string): string {
    const key = value?.trim();
    if (!key || key.length < 8 || key.length > 200) {
      throw new BadRequestException({
        title: 'A valid Idempotency-Key header is required',
        reasons: ['booking-idempotency-key-required'],
      });
    }
    return key;
  }

  private commandPayloadHash(bookingId: string, input: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify({ bookingId, input }))
      .digest('hex');
  }

  private async replayCommand(
    actor: Principal,
    commandType: string,
    idempotencyKey: string,
    payloadHash: string,
  ): Promise<BookingDto | null> {
    if (!actor.personId) {
      throw new ForbiddenException({ title: 'User not linked', reasons: ['user-not-linked-to-person'] });
    }
    const prior = await this.repo.findCommand(
      actor.organizationId,
      actor.personId,
      commandType,
      idempotencyKey,
    );
    if (!prior) return null;
    if (prior.payloadHash !== payloadHash) {
      throw new ConflictException({
        title: 'Idempotency key was reused with a different payload',
        reasons: ['booking-idempotency-key-reused'],
      });
    }
    if (!prior.resultBookingId) throw this.commandInProgress();
    return this.getInternal(prior.resultBookingId);
  }

  private commandInProgress(): ConflictException {
    return new ConflictException({
      title: 'Booking command is still in progress',
      reasons: ['booking-command-in-progress'],
    });
  }

  private revisionConflict(expectedRevision: number): ConflictException {
    return new ConflictException({
      title: 'Booking was changed by another request',
      reasons: ['booking-revision-conflict'],
      expectedRevision,
    });
  }

  private async require(id: string): Promise<BookingRow> {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new NotFoundException({ title: 'Unknown booking', reasons: [`booking-not-found:${id}`] });
    }
    return row;
  }

  private async bufferMinutes(vehicleClass: VehicleClass, decisionContext: BookingDecisionContext, correlationId: string, subjectRef: string) {
    const request = { ...decisionContext, ruleType: 'booking-buffer', context: { vehicleClass } };
    const result = await this.decisions.evaluate(
      { consumer: 'bookings', subjectRef, correlationId, request },
      () => this.pdp.evaluate(request),
    );
    const response = result.response;
    if (
      response.decision !== 'VALUE' ||
      typeof response.value !== 'number' ||
      !Number.isInteger(response.value) ||
      response.value < 0 ||
      response.value > 240
    ) throw this.invalidPolicyValue('booking-buffer', response);
    return { minutes: response.value, response, provenance: result.provenance };
  }

  private async maxDurationHours(vehicleClass: VehicleClass, decisionContext: BookingDecisionContext, correlationId: string, subjectRef: string) {
    const request = { ...decisionContext, ruleType: 'max-booking-duration', context: { vehicleClass } };
    const result = await this.decisions.evaluate(
      { consumer: 'bookings', subjectRef, correlationId, request },
      () => this.pdp.evaluate(request),
    );
    const response = result.response;
    if (
      response.decision !== 'VALUE' ||
      typeof response.value !== 'number' ||
      !Number.isFinite(response.value) ||
      response.value < 0.25 ||
      response.value > 168
    ) throw this.invalidPolicyValue('max-booking-duration', response);
    return { hours: response.value, response, provenance: result.provenance };
  }

  private async approvalRoute(hours: number, decisionContext: BookingDecisionContext, correlationId: string, subjectRef: string) {
    const request = { ...decisionContext, ruleType: 'booking-approval-chain', context: { durationHours: hours } };
    const result = await this.decisions.evaluate(
      { consumer: 'bookings', subjectRef, correlationId, request },
      async () => this.legacyApprovalRoutes.evaluate({
        durationHours: hours,
        requestedScopeNodeId: decisionContext.scopeNodeId,
      }),
    );
    const response = result.response;
    if (response.decision !== 'ROUTE_TO' || !response.route?.length) throw this.invalidPolicyValue('booking-approval-chain', response);
    return { route: response.route, response, provenance: result.provenance };
  }

  private async reConsentToleranceMinutes(decisionContext: BookingDecisionContext, correlationId: string, subjectRef: string) {
    const request = { ...decisionContext, ruleType: 'consent-re-consent-tolerance', context: {} };
    const result = await this.decisions.evaluate(
      { consumer: 'bookings', subjectRef, correlationId, request },
      () => this.pdp.evaluate(request),
    );
    const response = result.response;
    const value = response.value as { toleranceMinutes?: number } | undefined;
    if (
      response.decision !== 'VALUE' ||
      typeof value?.toleranceMinutes !== 'number' ||
      !Number.isInteger(value.toleranceMinutes) ||
      value.toleranceMinutes < 0 ||
      value.toleranceMinutes > 1_440
    ) throw this.invalidPolicyValue('consent-re-consent-tolerance', response);
    return { minutes: value.toleranceMinutes, response, provenance: result.provenance };
  }

  /** Derives policy organization/scope from the persisted vehicle assignment. */
  private async decisionContext(vehicleId: string, organizationId: string, effectiveAt: Date): Promise<BookingDecisionContext> {
    const scopeNodeId = await this.repo.findVehicleScope(vehicleId);
    if (!scopeNodeId) throw new UnprocessableEntityException({ title: 'Vehicle has no active hierarchy scope', reasons: [`vehicle-scope-missing:${vehicleId}`] });
    return { organizationId, scopeNodeId, effectiveAtUtc: effectiveAt.toISOString() };
  }

  private provenance(response: PolicyEvaluationResponse) {
    return { policyVersion: response.policyVersion, requestedScopeNodeId: response.requestedScopeNodeId ?? null, resolvedScopeNodeId: response.resolvedScopeNodeId ?? null, reasons: response.reasons };
  }

  private provenanceObject(value: unknown): BookingPolicyProvenance {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as BookingPolicyProvenance : {};
  }

  private mergeProvenance(value: unknown, key: string, response: PolicyEvaluationResponse): BookingPolicyProvenance {
    return { ...this.provenanceObject(value), [key]: this.provenance(response) };
  }

  private invalidPolicyValue(ruleType: string, response: PolicyEvaluationResponse): UnprocessableEntityException {
    return new UnprocessableEntityException({ title: 'Policy returned an invalid typed result', reasons: [`policy-result-invalid:${ruleType}`, ...response.reasons] });
  }

  /** Requires a governed vehicle category before policy fact assembly. */
  private requireVehicleClass(code: string | null | undefined): VehicleClass {
    const vehicleClass = vehicleClassOf(code);
    if (!vehicleClass) {
      throw new UnprocessableEntityException({
        title: 'Vehicle category is not configured for booking policy',
        reasons: [`vehicle-category-unmapped:${code ?? 'missing'}`],
      });
    }
    return vehicleClass;
  }

  private toDto(row: BookingRow): BookingDto {
    return {
      id: row.id,
      bookingNumber: row.bookingNumber,
      vehicleId: row.vehicleId,
      driverPersonId: row.driverPersonId,
      requestedByPersonId: row.requestedByPersonId,
      beneficiaryPersonId: row.beneficiaryPersonId,
      bookingScopeNodeId: row.bookingScopeNodeId,
      revision: row.revision,
      status: row.status,
      pickupAtUtc: row.pickupAtUtc.toISOString(),
      returnAtUtc: row.returnAtUtc.toISOString(),
      reservationStartUtc: row.reservationStart.toISOString(),
      reservationEndUtc: row.reservationEnd.toISOString(),
      bufferMinutes: row.bufferMinutes,
      destination: row.destination,
      purpose: row.purpose,
      passengerCount: row.passengerCount,
      consentRecordId: row.consentRecordId,
      workflowInstanceId: row.workflowInstanceId,
      policyVersion: row.policyVersion,
      createdAtUtc: row.createdAtUtc.toISOString(),
    };
  }
}
