import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OutboxService } from '../../../common/messaging/outbox.service';
import type { PlatformRole } from '../../../common/database/schema';
import {
  BOOKING_REASON,
  type AvailabilityQuery,
  type AvailableVehicleDto,
  type BookingDto,
  type BookingStatus,
  type CancelBooking,
  type CreateBooking,
  type DecideBooking,
  type ExtendBooking,
  type ModifyBooking,
  type SignConsent,
} from '../../../contracts/booking.contract';
import { EligibilityService } from '../../compliance/services/eligibility.service';
import { PolicyEvaluatorService } from '../../policy/services/policy-evaluator.service';
import type { PolicyEvaluationResponse } from '../../../contracts/policy-evaluation.contract';
import { AuditService } from '../../platform/services/audit.service';
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

type BookingRow = NonNullable<Awaited<ReturnType<BookingsRepository['findById']>>>;
const TERMINAL: ReadonlySet<string> = new Set([
  'Completed',
  'Declined',
  'Cancelled',
  'Expired',
  'NoShow',
]);

interface BookingDecisionContext {
  organizationId: string;
  scopeNodeId: string;
  effectiveAtUtc: string;
}

type BookingPolicyProvenance = Record<string, {
  policyVersion: string;
  requestedScopeNodeId: string | null;
  resolvedScopeNodeId: string | null;
  reasons: string[];
}>;

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
    private readonly eligibility: EligibilityService,
    private readonly workflow: WorkflowService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  /** Creates a Draft booking (no number, reserves nothing) after buffer/duration checks. */
  async create(input: CreateBooking, actorRef = 'system'): Promise<BookingDto> {
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
    if (!veh.bookingPoolFlag) {
      throw new ConflictException({
        title: 'Vehicle not bookable',
        reasons: [BOOKING_REASON.vehicleNotBookable],
      });
    }

    const vehicleClass = vehicleClassOf(veh.useCategoryCode);
    const decisionContext = await this.decisionContext(input.vehicleId, veh.organizationId, pickup);
    const buffer = await this.bufferMinutes(vehicleClass, decisionContext);
    const maxDuration = await this.maxDurationHours(vehicleClass, decisionContext);
    if (durationHours(pickup, ret) > maxDuration.hours) {
      throw new BadRequestException({
        title: 'Booking exceeds maximum duration',
        reasons: [BOOKING_REASON.durationExceedsMax],
      });
    }
    const reservation = applyBuffer(pickup, ret, buffer.minutes);

    try {
      return await this.repo.transaction(async (tx) => {
        const created = await this.repo.insert(
          {
            organizationId: decisionContext.organizationId,
            vehicleId: input.vehicleId,
            driverPersonId: input.driverPersonId,
            requestedByPersonId: input.requestedByPersonId,
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
              bookingBuffer: this.provenance(buffer.response),
              maxBookingDuration: this.provenance(maxDuration.response),
            },
          },
          tx,
        );
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
        return this.toDto(created);
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
  async signConsent(id: string, input: SignConsent, actorRef = 'system'): Promise<BookingDto> {
    const existing = await this.require(id);
    if (existing.status !== 'Draft') {
      throw new ConflictException({ title: 'Booking is not a draft', reasons: [BOOKING_REASON.notDraft] });
    }
    if (input.driverPersonId !== existing.driverPersonId) {
      throw new BadRequestException({ title: 'Consent driver mismatch', reasons: [BOOKING_REASON.driverMismatch] });
    }

    // Hard gate BEFORE reserving — zero bookings on expired documents. The gate
    // records the denial append-only; we add an audit entry, then reject. There
    // is no override path (P1B-R2-9).
    const verdict = await this.eligibility.evaluate({
      driverPersonId: existing.driverPersonId,
      vehicleId: existing.vehicleId,
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
    const bookingNumber = generateBookingNumber();
    try {
      return await this.repo.transaction(async (tx) => {
        const consent = await this.repo.insertConsent(
          {
            bookingId: existing.id,
            driverPersonId: existing.driverPersonId,
            vehicleId: existing.vehicleId,
            vehicleCategoryCode: veh?.useCategoryCode ?? null,
            windowStart: existing.pickupAtUtc,
            windowEnd: existing.returnAtUtc,
            policyVersion: existing.policyVersion,
            consentDocumentVersion: input.consentDocumentVersion,
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
        return this.toDto(reserved);
      });
    } catch (error) {
      throw toDbException(error);
    }
  }

  /** Routes a reserved booking to its approval chain (line manager / PDP chain). */
  async submit(id: string, actorRef = 'system'): Promise<BookingDto> {
    const existing = await this.require(id);
    if (existing.status !== 'PendingApproval') {
      throw new ConflictException({ title: 'Booking is not reserved', reasons: [BOOKING_REASON.notReserved] });
    }
    if (!existing.consentRecordId) {
      throw new ConflictException({ title: 'Consent is required', reasons: [BOOKING_REASON.consentRequired] });
    }
    if (existing.workflowInstanceId) {
      return this.toDto(existing);
    }

    const vehicle = await this.repo.findVehicle(existing.vehicleId);
    if (!vehicle) throw new BadRequestException({ title: 'Unknown vehicle', reasons: [`fk-violation:vehicle:${existing.vehicleId}`] });
    const decisionContext = await this.decisionContext(existing.vehicleId, vehicle.organizationId, existing.pickupAtUtc);
    const routeDecision = await this.approvalRoute(durationHours(existing.pickupAtUtc, existing.returnAtUtc), decisionContext);
    const route = routeDecision.route;
    const requester = await this.repo.findPerson(existing.requestedByPersonId);
    const roleToPerson = new Map<string, string | null>();
    for (const role of route) {
      if (roleToPerson.has(role)) {
        continue;
      }
      roleToPerson.set(
        role,
        role === 'LineManager'
          ? requester?.lineManagerPersonId ?? null
          : await this.repo.findApproverForRole(role as PlatformRole, decisionContext.scopeNodeId),
      );
    }
    const approvers = resolveApprovers(route, existing.requestedByPersonId, (r) => roleToPerson.get(r) ?? null);
    if (approvers.length === 0) {
      throw new UnprocessableEntityException({
        title: 'No approver could be resolved',
        reasons: [BOOKING_REASON.noApprover],
      });
    }

    const view = await this.workflow.start({
      workflowType: 'booking-approval',
      subjectRef: `booking:${existing.id}`,
      slaMinutes: 24 * 60,
      steps: approvers.map((assigneePersonId) => ({ assigneePersonId })),
    });

    try {
      return await this.repo.transaction(async (tx) => {
        const updated = await this.repo.update(
          existing.id,
          {
            workflowInstanceId: view.id,
            policyProvenance: this.mergeProvenance(
              existing.policyProvenance,
              'bookingApprovalChain',
              routeDecision.response,
            ),
          },
          tx,
        );
        await this.repo.insertEvent(
          { bookingId: existing.id, eventType: 'SubmittedForApproval', detail: { workflowId: view.id, approvers }, actorRef },
          tx,
        );
        await this.audit.record(
          { actorRef, action: 'BOOKING_SUBMITTED', entityRef: `booking:${existing.id}`, after: { workflowId: view.id } },
          tx,
        );
        return this.toDto(updated);
      });
    } catch (error) {
      throw toDbException(error);
    }
  }

  /** Records an approver decision via the workflow engine and reflects it on the booking. */
  async decide(id: string, input: DecideBooking): Promise<BookingDto> {
    const existing = await this.require(id);
    if (input.actorPersonId === existing.requestedByPersonId) {
      throw new ForbiddenException({ title: 'Self-approval is not permitted', reasons: [BOOKING_REASON.sodSelfApproval] });
    }
    if (!existing.workflowInstanceId) {
      throw new ConflictException({ title: 'Booking is not submitted', reasons: [BOOKING_REASON.notReserved] });
    }

    const view = await this.workflow.decide(existing.workflowInstanceId, {
      actorPersonId: input.actorPersonId,
      decision: input.decision,
      reason: input.reason,
      onBehalfOfPersonId: input.onBehalfOfPersonId,
    });

    let next: BookingStatus = existing.status;
    let voidConsent = false;
    if (view.status === 'Approved') {
      next = 'Approved';
    } else if (view.status === 'Rejected') {
      next = 'Declined';
    } else if (view.status === 'ModificationRequested') {
      next = 'Draft';
      voidConsent = true;
    }

    try {
      return await this.repo.transaction(async (tx) => {
        const patch: Partial<BookingRow> = { status: next };
        if (voidConsent) {
          patch.consentRecordId = null;
          // Returning to Draft ends this approval cycle — clear the workflow so a
          // re-consent + re-submit routes a FRESH chain (submit is idempotent on
          // workflowInstanceId).
          patch.workflowInstanceId = null;
          if (existing.consentRecordId) {
            await this.repo.insertConsentEvent(
              { bookingId: existing.id, consentRecordId: existing.consentRecordId, eventType: 'Voided', reason: 'modification-requested' },
              tx,
            );
          }
        }
        const updated = await this.repo.update(existing.id, patch, tx);
        await this.repo.insertEvent(
          { bookingId: existing.id, eventType: `Decision:${input.decision}`, detail: { workflowStatus: view.status }, actorRef: input.actorPersonId },
          tx,
        );
        await this.audit.record(
          { actorRef: input.actorPersonId, action: 'BOOKING_DECISION', entityRef: `booking:${existing.id}`, reason: input.reason, after: { decision: input.decision, status: next } },
          tx,
        );
        if (next === 'Approved') {
          await this.outbox.enqueue(
            { aggregateType: 'booking', aggregateId: existing.id, eventType: 'BookingConfirmed', payload: { bookingId: existing.id, bookingNumber: existing.bookingNumber } },
            tx,
          );
        }
        if (next === 'Declined') {
          await this.outbox.enqueue(
            { aggregateType: 'booking', aggregateId: existing.id, eventType: 'BookingCancelled', payload: { bookingId: existing.id, reason: 'declined' } },
            tx,
          );
        }
        return this.toDto(updated);
      });
    } catch (error) {
      throw toDbException(error);
    }
  }

  /** Requester modification; a material change beyond tolerance voids consent (re-consent). */
  async modify(id: string, input: ModifyBooking, actorRef = 'system'): Promise<BookingDto> {
    const existing = await this.require(id);
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
    if (!veh.bookingPoolFlag) {
      throw new ConflictException({ title: 'Vehicle not bookable', reasons: [BOOKING_REASON.vehicleNotBookable] });
    }

    const vehicleClass = vehicleClassOf(veh.useCategoryCode);
    const decisionContext = await this.decisionContext(nextVehicleId, veh.organizationId, nextPickup);
    const buffer = await this.bufferMinutes(vehicleClass, decisionContext);
    const maxDuration = await this.maxDurationHours(vehicleClass, decisionContext);
    if (durationHours(nextPickup, nextRet) > maxDuration.hours) {
      throw new BadRequestException({ title: 'Booking exceeds maximum duration', reasons: [BOOKING_REASON.durationExceedsMax] });
    }
    const reservation = applyBuffer(nextPickup, nextRet, buffer.minutes);
    const toleranceDecision = await this.reConsentToleranceMinutes(decisionContext);
    const tolerance = toleranceDecision.minutes;
    const stays = withinReConsentTolerance(
      { vehicleId: existing.vehicleId, pickup: existing.pickupAtUtc, ret: existing.returnAtUtc },
      { vehicleId: nextVehicleId, pickup: nextPickup, ret: nextRet },
      tolerance,
    );
    const needsReConsent = existing.status === 'PendingApproval' && !stays && Boolean(existing.consentRecordId);

    try {
      return await this.repo.transaction(async (tx) => {
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
            bookingBuffer: this.provenance(buffer.response),
            maxBookingDuration: this.provenance(maxDuration.response),
            reConsentTolerance: this.provenance(toleranceDecision.response),
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
        const updated = await this.repo.update(existing.id, patch, tx);
        await this.repo.insertEvent(
          { bookingId: existing.id, eventType: 'Modified', detail: { needsReConsent, vehicleId: nextVehicleId }, actorRef },
          tx,
        );
        await this.audit.record(
          { actorRef, action: 'BOOKING_MODIFIED', entityRef: `booking:${existing.id}`, after: { vehicleId: nextVehicleId, needsReConsent } },
          tx,
        );
        return this.toDto(updated);
      });
    } catch (error) {
      throw toDbException(error);
    }
  }

  /** Mid-trip extension; a downstream conflict raises 409 via the exclusion (FR-BOOK-18). */
  async extend(id: string, input: ExtendBooking, actorRef = 'system'): Promise<BookingDto> {
    const existing = await this.require(id);
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
        const updated = await this.repo.update(existing.id, { returnAtUtc: newRet, reservationEnd }, tx);
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
        return this.toDto(updated);
      });
    } catch (error) {
      throw toDbException(error);
    }
  }

  /** Cancels a booking, releasing its reservation. */
  async cancel(id: string, input: CancelBooking, actorRef = 'system'): Promise<BookingDto> {
    const existing = await this.require(id);
    if (TERMINAL.has(existing.status)) {
      throw new ConflictException({ title: 'Booking is already terminal', reasons: [BOOKING_REASON.terminal] });
    }
    return this.repo.transaction(async (tx) => {
      const updated = await this.repo.update(existing.id, { status: 'Cancelled' }, tx);
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
      return this.toDto(updated);
    });
  }

  /** Marks an Approved booking as picked up (→ Active) — driven by the handover event. */
  async markPickedUp(id: string, actorRef = 'system'): Promise<BookingDto> {
    const existing = await this.require(id);
    if (existing.status !== 'Approved') {
      throw new ConflictException({ title: 'Booking is not approved for handover', reasons: [BOOKING_REASON.notReserved] });
    }
    return this.repo.transaction(async (tx) => {
      const updated = await this.repo.update(existing.id, { status: 'Active' }, tx);
      await this.repo.insertEvent({ bookingId: existing.id, eventType: 'PickedUp', actorRef }, tx);
      await this.audit.record({ actorRef, action: 'BOOKING_PICKED_UP', entityRef: `booking:${existing.id}` }, tx);
      await this.outbox.enqueue(
        { aggregateType: 'booking', aggregateId: existing.id, eventType: 'BookingChanged', payload: { change: 'picked-up', bookingId: existing.id } },
        tx,
      );
      return this.toDto(updated);
    });
  }

  /** Marks an Active booking as returned (→ Completed) — driven by the return event. */
  async markReturned(id: string, actorRef = 'system', lateReturn = false): Promise<BookingDto> {
    const existing = await this.require(id);
    if (existing.status !== 'Active') {
      throw new ConflictException({ title: 'Booking is not active for return', reasons: [BOOKING_REASON.notReserved] });
    }
    return this.repo.transaction(async (tx) => {
      const updated = await this.repo.update(existing.id, { status: 'Completed' }, tx);
      await this.repo.insertEvent({ bookingId: existing.id, eventType: 'Returned', detail: { lateReturn }, actorRef }, tx);
      await this.audit.record({ actorRef, action: 'BOOKING_RETURNED', entityRef: `booking:${existing.id}`, after: { lateReturn } }, tx);
      await this.outbox.enqueue(
        { aggregateType: 'booking', aggregateId: existing.id, eventType: 'BookingChanged', payload: { change: 'returned', bookingId: existing.id, lateReturn } },
        tx,
      );
      return this.toDto(updated);
    });
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
  async availability(query: AvailabilityQuery): Promise<AvailableVehicleDto[]> {
    const start = new Date(query.pickupAtUtc);
    const end = new Date(query.returnAtUtc);
    const windowReasons = validateWindow(start, end, new Date());
    if (windowReasons.length) {
      throw new BadRequestException({ title: 'Invalid availability window', reasons: windowReasons });
    }
    const rows = await this.repo.listAvailable(start, end, query.seatingCapacity);
    return rows.map((r) => ({
      vehicleId: r.vehicleId,
      plate: r.plate,
      bodyTypeCode: r.bodyTypeCode,
      useCategoryCode: r.useCategoryCode,
      seatingCapacity: r.seatingCapacity,
      fuelTypeCode: r.fuelTypeCode,
    }));
  }

  /** Returns a booking by id. */
  async get(id: string): Promise<BookingDto> {
    return this.toDto(await this.require(id));
  }

  /** The append-only event log for a booking. */
  async events(id: string) {
    await this.require(id);
    return this.repo.listEvents(id);
  }

  // ---- internals -------------------------------------------------------------

  private async require(id: string): Promise<BookingRow> {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new NotFoundException({ title: 'Unknown booking', reasons: [`booking-not-found:${id}`] });
    }
    return row;
  }

  private async bufferMinutes(vehicleClass: VehicleClass, decisionContext: BookingDecisionContext) {
    const response = await this.pdp.evaluate({ ...decisionContext, ruleType: 'booking-buffer', context: { vehicleClass } });
    if (response.decision !== 'VALUE' || typeof response.value !== 'number') throw this.invalidPolicyValue('booking-buffer', response);
    return { minutes: response.value, response };
  }

  private async maxDurationHours(vehicleClass: VehicleClass, decisionContext: BookingDecisionContext) {
    const response = await this.pdp.evaluate({ ...decisionContext, ruleType: 'max-booking-duration', context: { vehicleClass } });
    if (response.decision !== 'VALUE' || typeof response.value !== 'number') throw this.invalidPolicyValue('max-booking-duration', response);
    return { hours: response.value, response };
  }

  private async approvalRoute(hours: number, decisionContext: BookingDecisionContext) {
    const response = await this.pdp.evaluate({ ...decisionContext, ruleType: 'booking-approval-chain', context: { durationHours: hours } });
    if (response.decision !== 'ROUTE_TO' || !response.route?.length) throw this.invalidPolicyValue('booking-approval-chain', response);
    return { route: response.route, response };
  }

  private async reConsentToleranceMinutes(decisionContext: BookingDecisionContext) {
    const response = await this.pdp.evaluate({ ...decisionContext, ruleType: 'consent-re-consent-tolerance', context: {} });
    const value = response.value as { toleranceMinutes?: number } | undefined;
    if (response.decision !== 'VALUE' || typeof value?.toleranceMinutes !== 'number') throw this.invalidPolicyValue('consent-re-consent-tolerance', response);
    return { minutes: value.toleranceMinutes, response };
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

  private toDto(row: BookingRow): BookingDto {
    return {
      id: row.id,
      bookingNumber: row.bookingNumber,
      vehicleId: row.vehicleId,
      driverPersonId: row.driverPersonId,
      requestedByPersonId: row.requestedByPersonId,
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
