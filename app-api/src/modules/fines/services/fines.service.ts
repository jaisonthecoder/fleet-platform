import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OutboxService } from '../../../common/messaging/outbox.service';
import { toDbException } from '../../../common/database/pg-error';
import {
  type AccidentDto,
  type AttributionBasis,
  FINE_REASON,
  type FineDto,
  type RecordAccident,
  type RecordFine,
  type RecordRecovery,
  type SubstitutionWindow,
  type SubstitutionWindowDto,
} from '../../../contracts/fine.contract';
import { BookingService } from '../../bookings/services/booking.service';
import { ComplianceService } from '../../compliance/services/compliance.service';
import { PolicyEvaluatorService } from '../../policy/services/policy-evaluator.service';
import { AuditService } from '../../platform/services/audit.service';
import { attributeFine, type AttributionResult, transferDeadline } from '../internal/fines-attribution';
import { FinesRepository } from '../repositories/fines.repository';

/**
 * Driver accountability (C7 / M8). Auto-attributes fines/accidents to the
 * booking-active driver, else the assigned driver, honouring substitution
 * windows (FR-SUB-01/02) with an auditable basis. Raises an HR alert at the
 * PDP fines-per-user threshold, and blocks a driver platform-wide when a
 * black-point transfer goes overdue (PDP `black-point-timeframe` → the shared
 * compliance access-block). Money is `numeric(14,2)` + currency — never floats.
 */
@Injectable()
export class FinesService {
  constructor(
    private readonly repo: FinesRepository,
    private readonly pdp: PolicyEvaluatorService,
    private readonly bookings: BookingService,
    private readonly compliance: ComplianceService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  /** Records + auto-attributes a fine; may raise black points and an HR alert. */
  async recordFine(input: RecordFine, actorRef = 'system'): Promise<FineDto> {
    const eventTime = new Date(input.eventTimeUtc);
    const { attribution, activeBooking } = await this.attributeWithBooking(input.vehicleId, eventTime);
    const points = input.points ?? 0;

    let created;
    try {
      created = await this.repo.transaction(async (tx) => {
      const row = await this.repo.insertFine(
        {
          vehicleId: input.vehicleId,
          bookingId: activeBooking?.bookingId ?? null,
          attributedPersonId: attribution.personId,
          attributionBasis: attribution.basis,
          eventTimeUtc: eventTime,
          amount: input.amount.toFixed(2),
          currency: input.currency ?? 'AED',
          authority: input.authority,
          externalRef: input.externalRef ?? null,
          status: attribution.personId ? 'Attributed' : 'Recorded',
          points,
        },
        tx,
      );
      if (points > 0 && attribution.personId) {
        const days = await this.blackPointDays();
        await this.repo.insertBlackPoint(
          { subjectPersonId: attribution.personId, fineId: row.id, points, transferDeadline: transferDeadline(eventTime, days), transferStatus: 'Open' },
          tx,
        );
        await this.outbox.enqueue(
          { aggregateType: 'fine', aggregateId: row.id, eventType: 'BlackPointRecorded', payload: { fineId: row.id, subjectPersonId: attribution.personId, points } },
          tx,
        );
      }
      await this.audit.record(
        { actorRef, action: 'FINE_RECORDED', entityRef: `fine:${row.id}`, after: { attributedPersonId: attribution.personId, basis: attribution.basis, amount: input.amount } },
        tx,
      );
      await this.outbox.enqueue({ aggregateType: 'fine', aggregateId: row.id, eventType: 'FineRecorded', payload: { fineId: row.id } }, tx);
      await this.outbox.enqueue(
        { aggregateType: 'fine', aggregateId: row.id, eventType: 'FineAttributed', payload: { fineId: row.id, attributedPersonId: attribution.personId, basis: attribution.basis } },
        tx,
      );
      return row;
      });
    } catch (error) {
      throw toDbException(error);
    }

    await this.maybeRaiseHrAlert(attribution.personId, created.id, actorRef);
    return this.toFineDto(created);
  }

  /** Records + auto-attributes an accident. */
  async recordAccident(input: RecordAccident, actorRef = 'system'): Promise<AccidentDto> {
    const occurredAt = new Date(input.occurredAtUtc);
    const { attribution, activeBooking } = await this.attributeWithBooking(input.vehicleId, occurredAt);
    let row;
    try {
      row = await this.repo.insertAccident({
        vehicleId: input.vehicleId,
        bookingId: activeBooking?.bookingId ?? null,
        attributedPersonId: attribution.personId,
        attributionBasis: attribution.basis,
        occurredAtUtc: occurredAt,
        description: input.description,
        severity: input.severity ?? null,
      });
    } catch (error) {
      throw toDbException(error);
    }
    await this.audit.record({ actorRef, action: 'ACCIDENT_RECORDED', entityRef: `accident:${row.id}`, after: { attributedPersonId: attribution.personId, basis: attribution.basis } });
    await this.outbox.enqueue({ aggregateType: 'accident', aggregateId: row.id, eventType: 'AccidentRecorded', payload: { accidentId: row.id, attributedPersonId: attribution.personId } });
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      attributedPersonId: row.attributedPersonId,
      attributionBasis: row.attributionBasis as AttributionBasis,
      occurredAtUtc: row.occurredAtUtc.toISOString(),
      description: row.description,
      severity: row.severity,
      status: row.status,
    };
  }

  /** Records a minimal recovery instruction against a fine (payroll export is Phase 2). */
  async recordRecovery(fineId: string, input: RecordRecovery, actorRef = 'system'): Promise<FineDto> {
    const existing = await this.repo.findFine(fineId);
    if (!existing) {
      throw new NotFoundException({ title: 'Unknown fine', reasons: [`fine-not-found:${fineId}`] });
    }
    if (await this.repo.hasRecovery(fineId)) {
      throw new ConflictException({ title: 'Fine already has a recovery instruction', reasons: [FINE_REASON.alreadyRecovered] });
    }
    return this.repo.transaction(async (tx) => {
      await this.repo.insertRecovery(
        { fineId, personId: existing.attributedPersonId, amount: input.amount.toFixed(2), currency: input.currency ?? existing.currency, note: input.note ?? null, status: 'Pending' },
        tx,
      );
      await this.audit.record({ actorRef, action: 'RECOVERY_RECORDED', entityRef: `fine:${fineId}`, after: { amount: input.amount } }, tx);
      await this.outbox.enqueue({ aggregateType: 'fine', aggregateId: fineId, eventType: 'RecoveryRecorded', payload: { fineId, amount: input.amount } }, tx);
      // Phase 1 records the recovery entry only; the fine status is not marked
      // 'Recovered' until payroll confirms the deduction (Phase 2 / D13).
      return this.toFineDto(existing);
    });
  }

  /** Records a substitution window (minimal admin/API entry, P1B-R2-4). */
  async addSubstitutionWindow(vehicleId: string, input: SubstitutionWindow, actorRef = 'system'): Promise<SubstitutionWindowDto> {
    const start = new Date(input.windowStart);
    const end = new Date(input.windowEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
      throw new BadRequestException({ title: 'Invalid substitution window', reasons: [FINE_REASON.windowInvalid] });
    }
    let row;
    try {
      row = await this.repo.insertSubstitutionWindow({
        vehicleId,
        substitutePersonId: input.substitutePersonId,
        windowStart: start,
        windowEnd: end,
        reason: input.reason ?? null,
      });
    } catch (error) {
      throw toDbException(error);
    }
    await this.audit.record({ actorRef, action: 'SUBSTITUTION_WINDOW_ADDED', entityRef: `vehicle:${vehicleId}`, after: { substitutePersonId: input.substitutePersonId } });
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      substitutePersonId: row.substitutePersonId,
      windowStart: row.windowStart.toISOString(),
      windowEnd: row.windowEnd.toISOString(),
      reason: row.reason,
    };
  }

  /**
   * Blocks drivers whose black-point transfer is overdue (PDP `black-point-timeframe`).
   * Interim runner for the scheduler; each overdue open black point flips to
   * `Overdue` and raises the shared platform-wide access block. Returns the count.
   */
  async enforceOverdueBlackPoints(now = new Date(), actorRef = 'system'): Promise<number> {
    const overdue = await this.repo.findOverdueOpenBlackPoints(now);
    const blockedThisRun = new Set<string>();
    for (const bp of overdue) {
      await this.repo.updateBlackPoint(bp.id, { transferStatus: 'Overdue' });
      if (blockedThisRun.has(bp.subjectPersonId)) {
        continue;
      }
      await this.compliance.raiseBlock({ personId: bp.subjectPersonId, reason: `overdue-black-point-transfer:${bp.id}` }, actorRef);
      await this.outbox.enqueue({ aggregateType: 'black-point', aggregateId: bp.id, eventType: 'AccessBlockRaised', payload: { subjectPersonId: bp.subjectPersonId } });
      blockedThisRun.add(bp.subjectPersonId);
    }
    return overdue.length;
  }

  async listFines(limit = 50, offset = 0): Promise<FineDto[]> {
    const rows = await this.repo.listFines(limit, offset);
    return rows.map((r) => this.toFineDto(r));
  }

  // ---- internals -------------------------------------------------------------

  private async attributeWithBooking(
    vehicleId: string,
    at: Date,
  ): Promise<{ attribution: AttributionResult; activeBooking: { bookingId: string; driverPersonId: string } | null }> {
    const vehicle = await this.repo.findVehicle(vehicleId);
    if (!vehicle) {
      throw new BadRequestException({ title: 'Unknown vehicle', reasons: [`fk-violation:vehicle:${vehicleId}`] });
    }
    // Fines/accidents arrive after the trip, so match the booking that COVERED
    // the event time (incl. already-Completed trips), not only a live booking.
    const activeBooking = await this.bookings.findBookingCoveringEvent(vehicleId, at);
    const windows = await this.repo.coveringSubstitutionWindows(vehicleId, at);
    const attribution = attributeFine({
      eventTime: at,
      substitutionWindows: windows.map((w) => ({ substitutePersonId: w.substitutePersonId, start: w.start, end: w.end })),
      activeBookingDriverPersonId: activeBooking?.driverPersonId ?? null,
      assignedDriverPersonId: vehicle.assignedDriverPersonId ?? null,
    });
    return { attribution, activeBooking };
  }

  private async maybeRaiseHrAlert(personId: string | null, fineId: string, actorRef: string): Promise<void> {
    if (!personId) {
      return;
    }
    const threshold = await this.finesHrThreshold();
    const since = new Date();
    since.setMonth(since.getMonth() - threshold.months);
    const count = await this.repo.countFinesForPersonSince(personId, since);
    if (count >= threshold.count) {
      await this.audit.record({ actorRef, action: 'FINES_HR_ALERT', entityRef: `person:${personId}`, after: { count, months: threshold.months } });
      await this.outbox.enqueue({ aggregateType: 'fine', aggregateId: fineId, eventType: 'FinesHrThresholdReached', payload: { personId, count, months: threshold.months } });
    }
  }

  private async finesHrThreshold(): Promise<{ count: number; months: number }> {
    const resp = await this.pdp.evaluate({ ruleType: 'fines-hr-threshold', context: {} });
    const value = resp.value as { count?: number; months?: number } | undefined;
    return { count: typeof value?.count === 'number' ? value.count : 3, months: typeof value?.months === 'number' ? value.months : 12 };
  }

  private async blackPointDays(): Promise<number> {
    const resp = await this.pdp.evaluate({ ruleType: 'black-point-timeframe', context: {} });
    const value = resp.value as { transferDeadlineDays?: number } | undefined;
    return typeof value?.transferDeadlineDays === 'number' ? value.transferDeadlineDays : 14;
  }

  private toFineDto(row: NonNullable<Awaited<ReturnType<FinesRepository['findFine']>>>): FineDto {
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      bookingId: row.bookingId,
      attributedPersonId: row.attributedPersonId,
      attributionBasis: row.attributionBasis as AttributionBasis,
      eventTimeUtc: row.eventTimeUtc.toISOString(),
      amount: row.amount,
      currency: row.currency,
      authority: row.authority,
      status: row.status,
      points: row.points,
      createdAtUtc: row.createdAtUtc.toISOString(),
    };
  }
}
