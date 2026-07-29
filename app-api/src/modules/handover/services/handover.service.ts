import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import { OutboxService } from '../../../common/messaging/outbox.service';
import {
  type AddDamage,
  type DamagePinDto,
  HANDOVER_REASON,
  type HandoverDto,
  type HandoverWorkItemDto,
  type KeyLogDto,
  type OpenHandover,
  type RecordReturn,
} from '../../../contracts/handover.contract';
import { BookingService } from '../../bookings/services/booking.service';
import { PolicyEvaluatorService } from '../../policy/services/policy-evaluator.service';
import { AuditService } from '../../platform/services/audit.service';
import { ScopeAuthorizationService } from '../../platform/services/scope-authorization.service';
import type { Principal } from '../../../common/auth/principal';
import {
  isLateReturn,
  isOdometerConflict,
  reconcileFuel,
  toNumberOrNull,
} from '../internal/handover-rules';
import { HandoverRepository } from '../repositories/handover.repository';

type HandoverRow = NonNullable<Awaited<ReturnType<HandoverRepository['findById']>>>;
type DamageRow = Awaited<ReturnType<HandoverRepository['listDamage']>>[number];

/**
 * Vehicle handover & return (M6). Verifies the booking + employee before
 * capture (FR-HAND-01), records odometer/fuel/checklist/signature/damage/keys,
 * and on return reconciles fuel (advisory, PDP `fuel-deviation-threshold`),
 * flags an odometer conflict against the telematics system of record without
 * overwriting it (FR-HAND-11), and flags a late return (FR-HAND-07). The
 * handover event drives the booking lifecycle (Approved → Active → Completed).
 */
@Injectable()
export class HandoverService {
  constructor(
    private readonly repo: HandoverRepository,
    private readonly pdp: PolicyEvaluatorService,
    private readonly bookings: BookingService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly scopeAuthorization: ScopeAuthorizationService,
  ) {}

  /** Returns the Fleet-scoped custody register without unrelated employee facts. */
  async worklist(principal: Principal): Promise<HandoverWorkItemDto[]> {
    if (!principal.personId) throw new ForbiddenException({ title: 'User not linked', reasons: ['handover-scope-not-authorized'] });
    if (!principal.roles.some(({ role }) => ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'].includes(role))) {
      throw new ForbiddenException({ title: 'Fleet Handover role required', reasons: ['handover-fleet-role-required'] });
    }
    const authorizedNodeIds = await this.scopeAuthorization.authorizedDescendantIds(
      principal,
      ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'],
    );
    const rows = await this.repo.listWorklist(principal.organizationId, authorizedNodeIds);
    return rows.map((row) => ({
      bookingId: row.bookingId,
      bookingNumber: row.bookingNumber!,
      handoverId: row.handoverId,
      phase: row.bookingStatus === 'Active' ? 'ActiveCustody' : 'AwaitingHandover',
      vehicleId: row.vehicleId,
      vehiclePlate: row.vehiclePlate,
      driverPersonId: row.driverPersonId,
      driverName: row.driverName,
      pickupAtUtc: row.pickupAtUtc.toISOString(),
      returnAtUtc: row.returnAtUtc.toISOString(),
      scopeName: row.scopeName,
    }));
  }

  /** Opens a handover for an approved booking and moves the booking to Active. */
  async open(input: OpenHandover, principal: Principal, idempotencyKey: string): Promise<HandoverDto> {
    const booking = await this.bookings.get(input.bookingId, principal);
    const actorRef = await this.authorizeBooking(principal, booking.bookingScopeNodeId);
    const commandKey = this.requireIdempotencyKey(idempotencyKey);
    const payloadSha256 = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const prior = await this.repo.findCommand(principal.organizationId, actorRef, 'OPEN', commandKey);
    if (prior) {
      if (prior.payloadSha256 !== payloadSha256) throw new ConflictException({ title: 'Idempotency key was reused', reasons: [HANDOVER_REASON.idempotencyReused] });
      if (!prior.resultHandoverId || !prior.resultBody) throw new ConflictException({ title: 'Handover command is in progress', reasons: [HANDOVER_REASON.commandInProgress] });
      return prior.resultBody as unknown as HandoverDto;
    }
    if (booking.status !== 'Approved') {
      throw new ConflictException({ title: 'Booking is not approved for handover', reasons: [HANDOVER_REASON.bookingNotApproved] });
    }
    if (input.employeePersonId !== booking.driverPersonId) {
      throw new ForbiddenException({ title: 'Employee does not match the booking driver', reasons: [HANDOVER_REASON.employeeMismatch] });
    }
    if (await this.repo.findByBooking(input.bookingId, principal.organizationId)) {
      throw new ConflictException({ title: 'Handover already open', reasons: [HANDOVER_REASON.alreadyOpen] });
    }

    const created = await this.repo.transaction(async (tx) => {
      const command = await this.repo.claimCommand({ organizationId: principal.organizationId, actorPersonId: actorRef, commandType: 'OPEN', idempotencyKey: commandKey, payloadSha256 }, tx);
      if (!command) throw new ConflictException({ title: 'Handover command is in progress', reasons: [HANDOVER_REASON.commandInProgress] });
      const row = await this.repo.insert(
        {
          organizationId: principal.organizationId,
          bookingId: booking.id,
          vehicleId: booking.vehicleId,
          driverPersonId: booking.driverPersonId,
          phase: 'Handover',
          startOdometer: String(input.startOdometer),
          startFuelEighths: input.startFuelEighths,
          gpsStatus: input.gpsStatus ?? null,
          keyIssueRef: input.keyIssueRef ?? null,
          handoverSignatureRef: input.signatureRef,
          checklist: input.checklist,
          offlineCaptured: input.offlineCaptured,
        },
        tx,
      );
      for (const pin of input.existingDamage) {
        await this.repo.insertDamage(
          { handoverId: row.id, x: String(pin.x), y: String(pin.y), region: pin.region, templateVersion: pin.templateVersion, photoRef: pin.photoRef ?? null, note: pin.note ?? null, state: 'existing' },
          tx,
        );
      }
      await this.repo.insertKeyLog(
        { organizationId: principal.organizationId, vehicleId: booking.vehicleId, handoverId: row.id, custodyState: 'Issued', keyRef: input.keyIssueRef ?? null, personId: booking.driverPersonId },
        tx,
      );
      await this.audit.record(
        { actorRef, action: 'HANDOVER_OPENED', entityRef: `handover:${row.id}`, after: { bookingId: booking.id, startOdometer: input.startOdometer } },
        tx,
      );
      await this.outbox.enqueue(
        { aggregateType: 'handover', aggregateId: row.id, eventType: 'HandoverCompleted', payload: { handoverId: row.id, bookingId: booking.id } },
        tx,
      );
      await this.bookings.markPickedUpInTransaction(booking.id, actorRef, tx);
      const dto = await this.toDto(row, tx);
      await this.repo.completeCommand(command.id, row.id, dto, tx);
      return { row, dto };
    });
    return created.dto;
  }

  /** Records the return: reconciliation, odometer-conflict + late flags, keys; completes the booking. */
  async recordReturn(id: string, input: RecordReturn, principal: Principal, idempotencyKey: string): Promise<HandoverDto> {
    const existing = await this.require(id, principal.organizationId);
    const booking = await this.bookings.get(existing.bookingId, principal);
    const actorRef = await this.authorizeBooking(principal, booking.bookingScopeNodeId);
    const commandKey = this.requireIdempotencyKey(idempotencyKey);
    const payloadSha256 = createHash('sha256').update(JSON.stringify({ id, input })).digest('hex');
    const prior = await this.repo.findCommand(principal.organizationId, actorRef, 'RETURN', commandKey);
    if (prior) {
      if (prior.payloadSha256 !== payloadSha256) throw new ConflictException({ title: 'Idempotency key was reused', reasons: [HANDOVER_REASON.idempotencyReused] });
      if (!prior.resultHandoverId || !prior.resultBody) throw new ConflictException({ title: 'Handover command is in progress', reasons: [HANDOVER_REASON.commandInProgress] });
      return prior.resultBody as unknown as HandoverDto;
    }
    if (existing.phase === 'Returned') {
      throw new ConflictException({ title: 'Handover already returned', reasons: [HANDOVER_REASON.alreadyReturned] });
    }
    if (booking.status !== 'Active') {
      throw new ConflictException({ title: 'Booking is not active for return', reasons: [HANDOVER_REASON.bookingNotActive] });
    }
    const startOdometer = toNumberOrNull(existing.startOdometer) ?? 0;
    if (input.endOdometer < startOdometer) {
      throw new BadRequestException({ title: 'End odometer precedes start', reasons: [HANDOVER_REASON.odometerBackwards] });
    }

    const vehicle = await this.repo.findVehicle(existing.vehicleId);
    const threshold = await this.fuelDeviationThresholdPercent();
    const fuel = reconcileFuel({
      startOdometer,
      endOdometer: input.endOdometer,
      efficiencyKmpl: toNumberOrNull(vehicle?.fuelEfficiencyKmpl),
      observedLitres: input.observedFuelConsumedLitres ?? null,
      thresholdPercent: threshold,
    });
    const telematicsOdometer = toNumberOrNull(vehicle?.lastConfirmedOdometer) ?? input.telematicsOdometer ?? null;
    const odometerConflict = isOdometerConflict(input.endOdometer, telematicsOdometer);
    const returnedAt = new Date();
    const lateReturn = isLateReturn(returnedAt, new Date(booking.returnAtUtc));

    const updated = await this.repo.transaction(async (tx) => {
      const command = await this.repo.claimCommand({ organizationId: principal.organizationId, actorPersonId: actorRef, commandType: 'RETURN', idempotencyKey: commandKey, payloadSha256 }, tx);
      if (!command) throw new ConflictException({ title: 'Handover command is in progress', reasons: [HANDOVER_REASON.commandInProgress] });
      const row = await this.repo.update(
        id,
        {
          phase: 'Returned',
          returnAtUtc: returnedAt,
          endOdometer: String(input.endOdometer),
          endFuelEighths: input.endFuelEighths,
          returnCondition: input.returnCondition ?? null,
          keyReturnRef: input.keyReturnRef ?? null,
          returnSignatureRef: input.signatureRef,
          expectedFuelConsumedLitres: fuel.expectedLitres === null ? null : fuel.expectedLitres.toFixed(2),
          actualFuelConsumedLitres: fuel.actualLitres === null ? null : fuel.actualLitres.toFixed(2),
          fuelDeviationPercent: fuel.deviationPercent === null ? null : fuel.deviationPercent.toFixed(2),
          fuelDeviationFlagged: fuel.flagged,
          odometerConflict,
          telematicsOdometer: telematicsOdometer === null ? null : String(telematicsOdometer),
          lateReturn,
          offlineCaptured: input.offlineCaptured || existing.offlineCaptured,
        },
        tx,
      );
      for (const pin of input.newDamage) {
        await this.repo.insertDamage(
          { handoverId: id, x: String(pin.x), y: String(pin.y), region: pin.region, templateVersion: pin.templateVersion, photoRef: pin.photoRef ?? null, note: pin.note ?? null, state: 'new' },
          tx,
        );
      }
      await this.repo.insertKeyLog(
        { organizationId: principal.organizationId, vehicleId: existing.vehicleId, handoverId: id, custodyState: 'Returned', keyRef: input.keyReturnRef ?? null, personId: existing.driverPersonId },
        tx,
      );
      await this.audit.record(
        { actorRef, action: 'HANDOVER_RETURNED', entityRef: `handover:${id}`, after: { endOdometer: input.endOdometer, fuelDeviationFlagged: fuel.flagged, odometerConflict, lateReturn } },
        tx,
      );
      await this.outbox.enqueue(
        { aggregateType: 'handover', aggregateId: id, eventType: 'ReturnCompleted', payload: { handoverId: id, bookingId: existing.bookingId, lateReturn, fuelDeviationFlagged: fuel.flagged } },
        tx,
      );
      await this.bookings.markReturnedInTransaction(existing.bookingId, actorRef, lateReturn, tx);
      const dto = await this.toDto(row, tx);
      await this.repo.completeCommand(command.id, row.id, dto, tx);
      return { row, dto };
    });
    return updated.dto;
  }

  /** Adds a single damage pin to an existing handover. */
  async addDamage(id: string, input: AddDamage, principal: Principal): Promise<DamagePinDto> {
    const handover = await this.require(id, principal.organizationId);
    const booking = await this.bookings.get(handover.bookingId, principal);
    const actorRef = await this.authorizeBooking(principal, booking.bookingScopeNodeId);
    return this.repo.transaction(async (tx) => {
      const pin = await this.repo.insertDamage(
        { handoverId: id, x: String(input.x), y: String(input.y), region: input.region, templateVersion: input.templateVersion, photoRef: input.photoRef ?? null, note: input.note ?? null, state: input.state },
        tx,
      );
      await this.audit.record(
        { actorRef, action: 'HANDOVER_DAMAGE_RECORDED', entityRef: `handover:${id}`, after: { region: input.region } },
        tx,
      );
      await this.outbox.enqueue(
        { aggregateType: 'handover', aggregateId: id, eventType: 'DamageRecorded', payload: { handoverId: id, region: input.region } },
        tx,
      );
      return this.toDamageDto(pin);
    });
  }

  /** The key custody log for a vehicle. */
  async keys(vehicleId: string, principal: Principal): Promise<KeyLogDto[]> {
    const scopeNodeId = await this.repo.findVehicleScope(vehicleId, principal.organizationId);
    await this.authorizeBooking(principal, scopeNodeId);
    const rows = await this.repo.listKeys(vehicleId);
    return rows.map((r) => ({
      id: r.id,
      vehicleId: r.vehicleId,
      handoverId: r.handoverId,
      custodyState: r.custodyState,
      keyRef: r.keyRef,
      personId: r.personId,
      atUtc: r.atUtc.toISOString(),
    }));
  }

  /** A handover projection with its damage pins. */
  async get(id: string, principal: Principal): Promise<HandoverDto> {
    const handover = await this.require(id, principal.organizationId);
    const booking = await this.bookings.get(handover.bookingId, principal);
    await this.authorizeBooking(principal, booking.bookingScopeNodeId);
    return this.toDto(handover);
  }

  // ---- internals -------------------------------------------------------------

  private async require(id: string, organizationId?: string): Promise<HandoverRow> {
    const row = organizationId
      ? await this.repo.findByIdInOrganization(id, organizationId)
      : await this.repo.findById(id);
    if (!row) {
      throw new NotFoundException({ title: 'Unknown handover', reasons: [`handover-not-found:${id}`] });
    }
    return row;
  }

  /** Requires a linked Fleet Principal at the Booking/Vehicle hierarchy scope. */
  private async authorizeBooking(principal: Principal, scopeNodeId: string | null): Promise<string> {
    if (!principal.personId || !scopeNodeId) {
      throw new ForbiddenException({ title: 'Handover scope is not authorized', reasons: ['handover-scope-not-authorized'] });
    }
    await this.scopeAuthorization.assertRolesAtScope(
      principal,
      ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'],
      scopeNodeId,
    );
    return principal.personId;
  }

  /** Requires a bounded durable command key for direct service callers too. */
  private requireIdempotencyKey(value?: string): string {
    const key = value?.trim();
    if (!key || key.length < 8 || key.length > 200) throw new BadRequestException({ title: 'A valid Idempotency-Key is required', reasons: [HANDOVER_REASON.idempotencyRequired] });
    return key;
  }

  private async fuelDeviationThresholdPercent(): Promise<number> {
    const resp = await this.pdp.evaluate({ ruleType: 'fuel-deviation-threshold', context: {} });
    const value = resp.value as { percent?: number } | undefined;
    return typeof value?.percent === 'number' ? value.percent : 12;
  }

  private toDamageDto(row: DamageRow): DamagePinDto {
    return {
      id: row.id,
      x: Number(row.x),
      y: Number(row.y),
      region: row.region,
      templateVersion: row.templateVersion,
      photoRef: row.photoRef,
      note: row.note,
      state: row.state,
      atUtc: row.atUtc.toISOString(),
    };
  }

  private async toDto(row: HandoverRow, executor?: DrizzleDatabase): Promise<HandoverDto> {
    const damage = await this.repo.listDamage(row.id, executor);
    return {
      id: row.id,
      bookingId: row.bookingId,
      vehicleId: row.vehicleId,
      driverPersonId: row.driverPersonId,
      phase: row.phase,
      handoverAtUtc: row.handoverAtUtc.toISOString(),
      startOdometer: row.startOdometer ?? '0',
      startFuelEighths: row.startFuelEighths ?? 0,
      gpsStatus: row.gpsStatus,
      keyIssueRef: row.keyIssueRef,
      offlineCaptured: row.offlineCaptured,
      returnAtUtc: row.returnAtUtc ? row.returnAtUtc.toISOString() : null,
      endOdometer: row.endOdometer,
      endFuelEighths: row.endFuelEighths,
      returnCondition: row.returnCondition,
      keyReturnRef: row.keyReturnRef,
      expectedFuelConsumedLitres: row.expectedFuelConsumedLitres,
      actualFuelConsumedLitres: row.actualFuelConsumedLitres,
      fuelDeviationPercent: row.fuelDeviationPercent,
      fuelDeviationFlagged: row.fuelDeviationFlagged,
      odometerConflict: row.odometerConflict,
      lateReturn: row.lateReturn,
      damage: damage.map((d) => this.toDamageDto(d)),
    };
  }
}
