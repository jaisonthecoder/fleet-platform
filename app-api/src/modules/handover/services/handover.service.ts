import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import { OutboxService } from '../../../common/messaging/outbox.service';
import {
  type AddDamage,
  type CreateHandoverAmendment,
  type DamagePinDto,
  HANDOVER_REASON,
  type HandoverDto,
  type HandoverAmendmentDto,
  type HandoverCaptureContextDto,
  type HandoverChainDto,
  type HandoverReceiptDto,
  type HandoverRegisterDto,
  type HandoverRegisterQuery,
  type HandoverRegisterSignal,
  type HandoverWorkItemDto,
  type KeyLogDto,
  type OpenHandover,
  type OpenHandoverV2,
  type RecordReturn,
  type RecordReturnV2,
  type StageHandoverEvidenceQuery,
  type StagedHandoverEvidence,
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
import { HANDOVER_EVIDENCE_STORE, type HandoverEvidenceStore } from '../internal/evidence-store.port';

type HandoverRow = NonNullable<Awaited<ReturnType<HandoverRepository['findById']>>>;
type DamageRow = Awaited<ReturnType<HandoverRepository['listDamage']>>[number];

/** Converts driver-returned timestamps into stable ISO strings. */
function toIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

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
    @Optional() @Inject(HANDOVER_EVIDENCE_STORE) private readonly evidenceStore?: HandoverEvidenceStore,
  ) {}

  /** Validates and durably stages one private JPEG/PNG evidence object. */
  async stageEvidence(
    input: StageHandoverEvidenceQuery,
    body: Buffer,
    mimeType: string,
    principal: Principal,
  ): Promise<StagedHandoverEvidence> {
    const actorPersonId = await this.requireFleetActor(principal);
    if (!this.evidenceStore) throw new ConflictException({ title: 'Evidence storage is unavailable', reasons: ['handover-evidence-store-unavailable'] });
    if (input.evidenceType === 'Signature' && !input.signerPersonId) {
      throw new BadRequestException({ title: 'Signature signer is required', reasons: ['handover-signature-signer-required'] });
    }
    if (input.signerPersonId && !(await this.repo.findPersonInOrganization(input.signerPersonId, principal.organizationId))) {
      throw new ForbiddenException({ title: 'Evidence signer is not authorized', reasons: ['handover-evidence-signer-not-authorized'] });
    }
    const { width, height, extension } = this.validateImage(body, mimeType);
    if (width > 8192 || height > 8192) throw new BadRequestException({ title: 'Evidence dimensions exceed the limit', reasons: ['handover-evidence-dimensions-invalid'] });
    const contentHash = createHash('sha256').update(body).digest('hex');
    const objectKey = `handover-evidence/${principal.organizationId}/${randomUUID()}.${extension}`;
    await this.evidenceStore.put(objectKey, body);
    try {
      const row = await this.repo.transaction(async (tx) => {
        const staged = await this.repo.insertEvidence({
          organizationId: principal.organizationId,
          uploadedByPersonId: actorPersonId,
          evidenceType: input.evidenceType,
          status: 'Staged',
          objectKey,
          contentSha256: contentHash,
          mimeType,
          sizeBytes: body.length,
          signerPersonId: input.signerPersonId ?? null,
          capturedByPersonId: actorPersonId,
          deviceRef: input.deviceRef ?? null,
          expiresAtUtc: new Date(Date.now() + 60 * 60 * 1000),
        }, tx);
        await this.audit.record({
          organizationId: principal.organizationId,
          actorRef: actorPersonId,
          action: 'HANDOVER_EVIDENCE_STAGED',
          entityRef: `handover-evidence:${staged.id}`,
          after: { evidenceType: input.evidenceType, contentHash, sizeBytes: body.length, width, height },
        }, tx);
        return staged;
      });
      return {
        id: row.id,
        evidenceRef: row.id,
        evidenceType: input.evidenceType,
        status: 'Staged',
        contentHash,
        mimeType: mimeType as 'image/jpeg' | 'image/png',
        sizeBytes: body.length,
        expiresAtUtc: row.expiresAtUtc.toISOString(),
      };
    } catch (error) {
      await this.evidenceStore.delete(objectKey);
      throw error;
    }
  }

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

  /** Compatibility name for Approved/Active work items after register separation. */
  async workItems(principal: Principal): Promise<HandoverWorkItemDto[]> {
    return this.worklist(principal);
  }

  /** Returns the historical custody register with source-derived status signals. */
  async register(query: HandoverRegisterQuery, principal: Principal): Promise<HandoverRegisterDto> {
    const authorizedNodeIds = await this.authorizedScopes(principal);
    const [rows, total] = await Promise.all([
      this.repo.listRegister(principal.organizationId, authorizedNodeIds, query),
      this.repo.countRegister(principal.organizationId, authorizedNodeIds, query.filter),
    ]);
    const items = rows.map((row) => {
      const signals = this.registerSignals(row);
      return {
        handoverId: row.handoverId,
        bookingId: row.bookingId,
        bookingNumber: row.bookingNumber!,
        driverName: row.driverName,
        vehicle: { id: row.vehicleId, plate: row.vehiclePlate, makeCode: row.makeCode, modelCode: row.modelCode },
        issuedAtUtc: toIso(row.issuedAtUtc),
        returnedAtUtc: toIso(row.returnedAtUtc),
        distanceKm: row.distanceKm,
        chargeSummary: { status: 'NOT_CONFIGURED' as const, amount: null, currency: null, labels: [] },
        primaryStatus: signals[0]!,
        signals,
        capabilities: {
          view: true,
          editOpenCustody: row.phase === 'Handover',
          returnVehicle: row.phase === 'Handover',
        },
        activityAtUtc: toIso(row.activityAtUtc)!,
      };
    });
    return { items, page: query.page, pageSize: query.pageSize, total, totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize) };
  }

  /** Returns server-authoritative facts and capabilities for one capture route. */
  async captureContext(bookingId: string, principal: Principal): Promise<HandoverCaptureContextDto> {
    const row = await this.repo.findCaptureContext(bookingId, principal.organizationId);
    if (!row || !row.bookingNumber) throw new NotFoundException({ title: 'Unknown Booking', reasons: [`booking-not-found:${bookingId}`] });
    await this.authorizeBooking(principal, row.scopeNodeId);
    const carried = await this.repo.listUnresolvedVehicleDamage(row.vehicleId);
    const eligibilityVerified = row.eligibilityDecision === 'ALLOW';
    return {
      schemaVersion: 2,
      booking: {
        id: row.bookingId,
        number: row.bookingNumber,
        revision: row.bookingRevision,
        status: row.bookingStatus,
        pickupAtUtc: row.pickupAtUtc.toISOString(),
        returnAtUtc: row.returnAtUtc.toISOString(),
      },
      vehicle: { id: row.vehicleId, plate: row.vehiclePlate, makeCode: row.makeCode, modelCode: row.modelCode },
      driver: { personId: row.driverPersonId, fullName: row.driverName },
      scope: { nodeId: row.scopeNodeId, name: row.scopeName },
      consent: { version: row.consentVersion, signedAtUtc: row.consentSignedAtUtc.toISOString() },
      eligibility: {
        status: eligibilityVerified ? 'VERIFIED' : 'UNAVAILABLE',
        reasonCodes: eligibilityVerified ? (row.eligibilityReasons ?? []) : ['handover-eligibility-evidence-unavailable'],
        evaluatedAtUtc: toIso(row.eligibilityEvaluatedAtUtc),
      },
      telematics: {
        status: row.lastConfirmedOdometer === null ? 'UNAVAILABLE' : 'STALE',
        odometer: row.lastConfirmedOdometer,
        observedAtUtc: null,
      },
      handover: row.handoverId && row.handoverPhase && row.handoverRevision && row.handoverAtUtc
        ? {
            id: row.handoverId,
            revision: row.handoverRevision,
            phase: row.handoverPhase,
            issuedAtUtc: toIso(row.handoverAtUtc)!,
            startOdometer: row.startOdometer ?? '0',
            startFuelEighths: row.startFuelEighths ?? 0,
            keyIssueRef: row.keyIssueRef,
            releaseLocation: {
              nodeId: row.releaseLocationNodeId,
              code: row.releaseLocationCode,
              name: row.releaseLocationName,
            },
          }
        : null,
      carriedDamage: carried.map(({ pin }) => this.toDamageDto(pin)),
      capabilities: {
        handover: row.bookingStatus === 'Approved' && !row.approvalSuspendedAtUtc && !row.handoverId && eligibilityVerified,
        return: row.bookingStatus === 'Active' && row.handoverPhase === 'Handover',
        amendOpenCustody: row.bookingStatus === 'Active' && row.handoverPhase === 'Handover',
      },
    };
  }

  /** Returns one authorized append-only issue-to-return evidence chain. */
  async chain(id: string, principal: Principal): Promise<HandoverChainDto> {
    const row = await this.require(id, principal.organizationId);
    const booking = await this.bookings.get(row.bookingId, principal);
    await this.authorizeBooking(principal, booking.bookingScopeNodeId);
    const [inspection, evidence, keys, amendments, dto] = await Promise.all([
      this.repo.listInspections(id),
      this.repo.listEvidence(id),
      this.repo.listHandoverKeys(id),
      this.repo.listAmendments(id),
      this.toDto(row),
    ]);
    return {
      schemaVersion: 2,
      handover: dto,
      inspections: inspection.map((item) => ({
        capturePhase: item.capturePhase as 'Handover' | 'Return',
        definitionVersion: item.definitionVersion,
        code: item.itemCode as HandoverChainDto['inspections'][number]['code'],
        verdict: item.verdict as 'Pass' | 'Fail',
        note: item.note,
        evidenceRefs: item.evidenceRefs,
      })),
      evidenceRefs: evidence.map(({ id: evidenceId }) => evidenceId),
      keys: keys.map((key) => ({ id: key.id, vehicleId: key.vehicleId, handoverId: key.handoverId, custodyState: key.custodyState, keyRef: key.keyRef, personId: key.personId, atUtc: key.atUtc.toISOString() })),
      amendments: amendments.map((amendment) => ({ id: amendment.id, revision: amendment.revision, reason: amendment.reason, actorPersonId: amendment.actorPersonId, atUtc: amendment.createdAtUtc.toISOString() })),
      chainRevision: row.revision + amendments.length,
      evidenceCompleteness: row.evidenceCompleteness as 'Complete' | 'LegacyPartial',
    };
  }

  /** Returns a locked completion receipt without inventing unavailable evidence. */
  async receipt(id: string, principal: Principal): Promise<HandoverReceiptDto> {
    const context = await this.repo.findReceiptContext(id, principal.organizationId);
    if (!context || !context.bookingNumber) throw new NotFoundException({ title: 'Unknown handover', reasons: [`handover-not-found:${id}`] });
    const booking = await this.bookings.get(context.row.bookingId, principal);
    await this.authorizeBooking(principal, booking.bookingScopeNodeId);
    if (context.row.phase !== 'Returned' || !context.row.returnAtUtc) throw new ConflictException({ title: 'Handover is not returned', reasons: [HANDOVER_REASON.bookingNotActive] });
    const [damage, evidence] = await Promise.all([this.repo.listDamage(id), this.repo.listEvidence(id)]);
    const start = toNumberOrNull(context.row.startOdometer) ?? 0;
    const end = toNumberOrNull(context.row.endOdometer) ?? start;
    const newDamageCount = damage.filter(({ state }) => state === 'new').length;
    return {
      schemaVersion: 2,
      handoverId: id,
      bookingId: context.row.bookingId,
      bookingNumber: context.bookingNumber,
      bookingStatus: 'Completed',
      returnedAtUtc: context.row.returnAtUtc.toISOString(),
      releaseLocation: { nodeId: context.row.releaseLocationNodeId, code: context.row.releaseLocationCode, name: context.row.releaseLocationName },
      returnLocation: { nodeId: context.row.returnLocationNodeId, code: context.row.returnLocationCode, name: context.row.returnLocationName },
      odometer: { start: String(start), end: String(end), distanceKm: (end - start).toFixed(1), verdict: context.row.odometerConflict ? 'CONFLICT' : 'MATCHED' },
      fuel: {
        startEighths: context.row.startFuelEighths ?? 0,
        endEighths: context.row.endFuelEighths ?? 0,
        deviationPercent: context.row.fuelDeviationPercent,
        verdict: context.row.fuelDeviationPercent === null ? 'UNAVAILABLE' : context.row.fuelDeviationFlagged ? 'ADVISORY' : 'MATCHED',
      },
      key: {
        outcome: context.row.keyOutcome === 'LostReviewRequired' ? 'LostReviewRequired' : context.row.keyOutcome === 'Returned' ? 'Returned' : 'Unknown',
        reviewReference: context.row.keyReviewRef,
      },
      damage: { carriedCount: damage.length - newDamageCount, newCount: newDamageCount, reviewRequired: newDamageCount > 0 },
      timing: { late: context.row.lateReturn },
      evidenceRefs: evidence.map(({ id: evidenceId }) => evidenceId),
      evidenceCompleteness: context.row.evidenceCompleteness as 'Complete' | 'LegacyPartial',
    };
  }

  /** Appends one version-checked correction without mutating original custody evidence. */
  async amend(
    id: string,
    input: CreateHandoverAmendment,
    principal: Principal,
    idempotencyKey: string,
  ): Promise<HandoverAmendmentDto> {
    const existing = await this.require(id, principal.organizationId);
    const booking = await this.bookings.get(existing.bookingId, principal);
    const actorRef = await this.authorizeBooking(principal, booking.bookingScopeNodeId);
    const commandKey = this.requireIdempotencyKey(idempotencyKey);
    const payloadSha256 = this.commandPayloadHash({ id, input });
    const prior = await this.repo.findCommand(principal.organizationId, actorRef, 'AMEND', commandKey);
    if (prior) {
      if (prior.payloadSha256 !== payloadSha256) throw new ConflictException({ title: 'Idempotency key was reused', reasons: [HANDOVER_REASON.idempotencyReused] });
      if (!prior.resultHandoverId || !prior.resultBody) throw new ConflictException({ title: 'Amendment command is in progress', reasons: [HANDOVER_REASON.commandInProgress] });
      return prior.resultBody as unknown as HandoverAmendmentDto;
    }
    return this.repo.transaction(async (tx) => {
      const command = await this.repo.claimCommand({
        organizationId: principal.organizationId,
        actorPersonId: actorRef,
        commandType: 'AMEND',
        idempotencyKey: commandKey,
        payloadSha256,
      }, tx);
      if (!command) throw new ConflictException({ title: 'Amendment command is in progress', reasons: [HANDOVER_REASON.commandInProgress] });
      const locked = await this.repo.findByIdForUpdate(id, principal.organizationId, tx);
      if (!locked) throw new NotFoundException({ title: 'Unknown handover', reasons: [`handover-not-found:${id}`] });
      const amendments = await this.repo.listAmendments(id, tx);
      const currentChainRevision = locked.revision + amendments.length;
      if (input.expectedChainRevision !== currentChainRevision) {
        throw new ConflictException({ title: 'Handover chain changed', reasons: [HANDOVER_REASON.amendmentRevisionConflict] });
      }
      const evidenceRefs = [...new Set(input.evidenceRefs)].sort();
      if (evidenceRefs.length) {
        const staged = await this.repo.findStagedEvidence(evidenceRefs, principal.organizationId, actorRef, tx);
        if (staged.length !== evidenceRefs.length) throw new ConflictException({ title: 'Amendment evidence is missing, expired or not owned', reasons: [HANDOVER_REASON.evidenceMissing] });
        const claimed = await this.repo.claimEvidence(evidenceRefs, id, tx);
        if (claimed.length !== evidenceRefs.length) throw new ConflictException({ title: 'Amendment evidence was already claimed', reasons: [HANDOVER_REASON.evidenceAlreadyClaimed] });
      }
      const amendment = await this.repo.insertAmendment({
        organizationId: principal.organizationId,
        handoverId: id,
        revision: amendments.length + 1,
        reason: input.reason,
        actorPersonId: actorRef,
        evidenceRefs,
      }, tx);
      const result: HandoverAmendmentDto = {
        schemaVersion: 2,
        id: amendment.id,
        handoverId: id,
        revision: amendment.revision,
        reason: amendment.reason,
        evidenceRefs: amendment.evidenceRefs,
        actorPersonId: amendment.actorPersonId,
        atUtc: amendment.createdAtUtc.toISOString(),
      };
      await this.audit.record({ actorRef, action: 'HANDOVER_AMENDMENT_APPENDED', entityRef: `handover:${id}`, after: { revision: amendment.revision, evidenceCount: evidenceRefs.length } }, tx);
      await this.outbox.enqueue({ aggregateType: 'handover', aggregateId: id, eventType: 'HandoverAmended', payload: { handoverId: id, revision: amendment.revision } }, tx);
      await this.repo.completeCommand(command.id, id, result, tx);
      return result;
    });
  }

  /** Expires unclaimed metadata and retries private-object deletion idempotently. */
  async cleanupExpiredEvidence(limit = 200): Promise<{ expired: number; deleted: number; failed: number }> {
    if (!this.evidenceStore) return { expired: 0, deleted: 0, failed: 0 };
    const newlyExpired = await this.repo.expireUnclaimedEvidence(limit);
    const pending = await this.repo.listExpiredEvidence(limit);
    const objects = new Map([...newlyExpired, ...pending].map((item) => [item.id, item.objectKey]));
    let deleted = 0;
    let failed = 0;
    for (const objectKey of objects.values()) {
      try {
        await this.evidenceStore.delete(objectKey);
        deleted += 1;
      } catch {
        failed += 1;
      }
    }
    return { expired: newlyExpired.length, deleted, failed };
  }

  /** Opens a handover for an approved booking and moves the booking to Active. */
  async open(input: OpenHandover | OpenHandoverV2, principal: Principal, idempotencyKey: string): Promise<HandoverDto> {
    const booking = await this.bookings.get(input.bookingId, principal);
    const actorRef = await this.authorizeBooking(principal, booking.bookingScopeNodeId);
    const v2 = 'schemaVersion' in input && input.schemaVersion === 2 ? input : null;
    const commandKey = this.requireIdempotencyKey(idempotencyKey);
    const payloadSha256 = this.commandPayloadHash(input);
    const prior = await this.repo.findCommand(principal.organizationId, actorRef, 'OPEN', commandKey);
    if (prior) {
      if (prior.payloadSha256 !== payloadSha256) throw new ConflictException({ title: 'Idempotency key was reused', reasons: [HANDOVER_REASON.idempotencyReused] });
      if (!prior.resultHandoverId || !prior.resultBody) throw new ConflictException({ title: 'Handover command is in progress', reasons: [HANDOVER_REASON.commandInProgress] });
      return prior.resultBody as unknown as HandoverDto;
    }
    if (v2 && booking.revision !== v2.expectedBookingRevision) {
      throw new ConflictException({ title: 'Booking changed before Handover', reasons: ['booking-revision-conflict'] });
    }
    const releaseLocation = v2
      ? await this.repo.findLocationSnapshot(v2.releaseLocationNodeId, principal.organizationId)
      : null;
    if (v2 && !releaseLocation) throw new ForbiddenException({ title: 'Release location is not authorized', reasons: ['handover-release-location-invalid'] });
    if (booking.status !== 'Approved') {
      throw new ConflictException({ title: 'Booking is not approved for handover', reasons: [HANDOVER_REASON.bookingNotApproved] });
    }
    if (input.employeePersonId !== booking.driverPersonId) {
      throw new ForbiddenException({ title: 'Employee does not match the booking driver', reasons: [HANDOVER_REASON.employeeMismatch] });
    }
    if (await this.repo.findByBooking(input.bookingId, principal.organizationId)) {
      throw new ConflictException({ title: 'Handover already open', reasons: [HANDOVER_REASON.alreadyOpen] });
    }
    const evidenceRefs = v2 ? this.openEvidenceRefs(v2) : [];

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
          handoverSignatureRef: v2?.signatureEvidenceRef ?? input.signatureRef,
          checklist: v2 ? v2.inspection.map(({ code, verdict }) => ({ item: code, pass: verdict === 'Pass' })) : input.checklist,
          checklistDefinitionVersion: v2?.checklistDefinitionVersion ?? null,
          releaseLocationNodeId: releaseLocation?.id ?? null,
          releaseLocationCode: releaseLocation?.code ?? null,
          releaseLocationName: releaseLocation?.name ?? null,
          evidenceCompleteness: v2 ? 'Complete' : 'LegacyPartial',
          offlineCaptured: input.offlineCaptured,
        },
        tx,
      );
      if (v2) {
        await this.assertAndClaimEvidence(evidenceRefs, v2.signatureEvidenceRef, booking.driverPersonId, principal.organizationId, actorRef, row.id, tx);
        for (const item of v2.inspection) {
          await this.repo.insertInspection({
            organizationId: principal.organizationId,
            handoverId: row.id,
            capturePhase: 'Handover',
            definitionVersion: v2.checklistDefinitionVersion,
            itemCode: item.code,
            verdict: item.verdict,
            note: item.note ?? null,
            evidenceRefs: [...item.evidenceRefs].sort(),
            capturedByPersonId: actorRef,
          }, tx);
        }
      }
      for (const pin of input.existingDamage) {
        await this.repo.insertDamage(
          { handoverId: row.id, x: String(pin.x), y: String(pin.y), region: pin.region, templateVersion: pin.templateVersion, photoRef: pin.photoRef ?? null, note: pin.note ?? null, state: 'existing', carriedFromDamagePinId: pin.carriedFromDamagePinId ?? null },
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
      const dto = await this.toDto(row, tx, v2 ? 2 : 1);
      await this.repo.completeCommand(command.id, row.id, dto, tx);
      return { row, dto };
    });
    return created.dto;
  }

  /** Records the return: reconciliation, odometer-conflict + late flags, keys; completes the booking. */
  async recordReturn(id: string, input: RecordReturn | RecordReturnV2, principal: Principal, idempotencyKey: string): Promise<HandoverDto> {
    const existing = await this.require(id, principal.organizationId);
    const booking = await this.bookings.get(existing.bookingId, principal);
    const actorRef = await this.authorizeBooking(principal, booking.bookingScopeNodeId);
    const v2 = 'schemaVersion' in input && input.schemaVersion === 2 ? input : null;
    const commandKey = this.requireIdempotencyKey(idempotencyKey);
    const payloadSha256 = this.commandPayloadHash({ id, input });
    const prior = await this.repo.findCommand(principal.organizationId, actorRef, 'RETURN', commandKey);
    if (prior) {
      if (prior.payloadSha256 !== payloadSha256) throw new ConflictException({ title: 'Idempotency key was reused', reasons: [HANDOVER_REASON.idempotencyReused] });
      if (!prior.resultHandoverId || !prior.resultBody) throw new ConflictException({ title: 'Handover command is in progress', reasons: [HANDOVER_REASON.commandInProgress] });
      return prior.resultBody as unknown as HandoverDto;
    }
    const returnLocation = v2
      ? await this.repo.findLocationSnapshot(v2.returnLocationNodeId, principal.organizationId)
      : null;
    if (v2 && !returnLocation) throw new ForbiddenException({ title: 'Return location is not authorized', reasons: ['handover-return-location-invalid'] });
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
    const evidenceRefs = v2 ? this.returnEvidenceRefs(v2) : [];

    const updated = await this.repo.transaction(async (tx) => {
      const command = await this.repo.claimCommand({ organizationId: principal.organizationId, actorPersonId: actorRef, commandType: 'RETURN', idempotencyKey: commandKey, payloadSha256 }, tx);
      if (!command) throw new ConflictException({ title: 'Handover command is in progress', reasons: [HANDOVER_REASON.commandInProgress] });
      const locked = await this.repo.findByIdForUpdate(id, principal.organizationId, tx);
      if (!locked || locked.phase !== 'Handover') throw new ConflictException({ title: 'Handover state changed', reasons: [HANDOVER_REASON.alreadyReturned] });
      if (v2 && locked.revision !== v2.expectedHandoverRevision) throw new ConflictException({ title: 'Handover revision changed', reasons: ['handover-revision-conflict'] });
      if (v2) await this.assertAndClaimEvidence(evidenceRefs, v2.signatureEvidenceRef, actorRef, principal.organizationId, actorRef, id, tx);
      const keyReviewRef = v2?.keyOutcome === 'Lost' ? `KEY-REVIEW-${randomUUID()}` : null;
      const row = await this.repo.update(
        id,
        {
          phase: 'Returned',
          revision: locked.revision + 1,
          returnAtUtc: returnedAt,
          endOdometer: String(input.endOdometer),
          endFuelEighths: input.endFuelEighths,
          returnCondition: input.returnCondition ?? null,
          returnConditionCode: v2?.returnConditionCode ?? null,
          returnLocationNodeId: returnLocation?.id ?? null,
          returnLocationCode: returnLocation?.code ?? null,
          returnLocationName: returnLocation?.name ?? null,
          keyReturnRef: v2?.keyOutcome === 'Lost' ? null : input.keyReturnRef ?? null,
          keyOutcome: v2 ? (v2.keyOutcome === 'Lost' ? 'LostReviewRequired' : 'Returned') : 'Returned',
          keyReviewRef,
          returnSignatureRef: v2?.signatureEvidenceRef ?? input.signatureRef,
          expectedFuelConsumedLitres: fuel.expectedLitres === null ? null : fuel.expectedLitres.toFixed(2),
          actualFuelConsumedLitres: fuel.actualLitres === null ? null : fuel.actualLitres.toFixed(2),
          fuelDeviationPercent: fuel.deviationPercent === null ? null : fuel.deviationPercent.toFixed(2),
          fuelDeviationFlagged: fuel.flagged,
          odometerConflict,
          telematicsOdometer: telematicsOdometer === null ? null : String(telematicsOdometer),
          telematicsStatus: telematicsOdometer === null ? 'UNAVAILABLE' : 'STALE',
          reconciliationStatus: odometerConflict ? 'CONFLICT' : fuel.flagged ? 'ADVISORY' : fuel.deviationPercent === null ? 'UNAVAILABLE' : 'MATCHED',
          reconciliationProvenance: { fuelThresholdPercent: threshold, policyRule: 'fuel-deviation-threshold', telematicsFreshness: 'UNAVAILABLE' },
          lateReturn,
          evidenceCompleteness: v2 ? 'Complete' : locked.evidenceCompleteness,
          offlineCaptured: input.offlineCaptured || existing.offlineCaptured,
        },
        tx,
      );
      if (v2) {
        for (const item of v2.inspection) {
          await this.repo.insertInspection({
            organizationId: principal.organizationId,
            handoverId: id,
            capturePhase: 'Return',
            definitionVersion: v2.checklistDefinitionVersion,
            itemCode: item.code,
            verdict: item.verdict,
            note: item.note ?? null,
            evidenceRefs: [...item.evidenceRefs].sort(),
            capturedByPersonId: actorRef,
          }, tx);
        }
      }
      for (const pin of input.newDamage) {
        await this.repo.insertDamage(
          { handoverId: id, x: String(pin.x), y: String(pin.y), region: pin.region, templateVersion: pin.templateVersion, photoRef: pin.photoRef ?? null, note: pin.note ?? null, state: 'new' },
          tx,
        );
      }
      await this.repo.insertKeyLog(v2?.keyOutcome === 'Lost'
        ? { organizationId: principal.organizationId, vehicleId: existing.vehicleId, handoverId: id, custodyState: 'Lost', keyRef: null, personId: existing.driverPersonId, incidentReason: v2.keyLostReason!, reviewRef: keyReviewRef }
        : { organizationId: principal.organizationId, vehicleId: existing.vehicleId, handoverId: id, custodyState: 'Returned', keyRef: input.keyReturnRef ?? null, personId: existing.driverPersonId }, tx);
      await this.audit.record(
        { actorRef, action: 'HANDOVER_RETURNED', entityRef: `handover:${id}`, after: { endOdometer: input.endOdometer, fuelDeviationFlagged: fuel.flagged, odometerConflict, lateReturn } },
        tx,
      );
      await this.outbox.enqueue(
        { aggregateType: 'handover', aggregateId: id, eventType: 'ReturnCompleted', payload: { handoverId: id, bookingId: existing.bookingId, lateReturn, fuelDeviationFlagged: fuel.flagged } },
        tx,
      );
      if (v2?.keyOutcome === 'Lost') {
        await this.outbox.enqueue({ aggregateType: 'handover', aggregateId: id, eventType: 'VehicleKeyLost', payload: { handoverId: id, bookingId: existing.bookingId, reviewRef: keyReviewRef } }, tx);
      }
      await this.bookings.markReturnedInTransaction(existing.bookingId, actorRef, lateReturn, tx);
      const dto = await this.toDto(row, tx, v2 ? 2 : 1);
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

  /** Resolves hierarchy scopes for Fleet-only Handover reads. */
  private async authorizedScopes(principal: Principal): Promise<string[]> {
    if (!principal.personId || !principal.roles.some(({ role }) => ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'].includes(role))) {
      throw new ForbiddenException({ title: 'Fleet Handover role required', reasons: ['handover-fleet-role-required'] });
    }
    return this.scopeAuthorization.authorizedDescendantIds(principal, ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead']);
  }

  /** Requires the linked Fleet actor used to own staged evidence. */
  private async requireFleetActor(principal: Principal): Promise<string> {
    await this.authorizedScopes(principal);
    return principal.personId!;
  }

  /** Hashes legacy payloads unchanged and canonicalizes v2 arrays/objects for stable retries. */
  private commandPayloadHash(value: unknown): string {
    const candidate = value as { schemaVersion?: number; input?: { schemaVersion?: number } };
    const serialized = candidate?.schemaVersion === 2 || candidate?.input?.schemaVersion === 2
      ? JSON.stringify(this.canonicalize(value))
      : JSON.stringify(value);
    return createHash('sha256').update(serialized).digest('hex');
  }

  /** Recursively orders v2 objects and arrays so semantically identical retries hash equally. */
  private canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.canonicalize(item)).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, this.canonicalize(item)]));
    }
    return value;
  }

  /** Collects every staged evidence reference bound into a v2 Open command. */
  private openEvidenceRefs(input: OpenHandoverV2): string[] {
    return [...new Set([
      input.signatureEvidenceRef,
      ...input.vehiclePhotoRefs,
      ...input.inspection.flatMap(({ evidenceRefs }) => evidenceRefs),
      ...input.existingDamage.flatMap(({ photoRef }) => photoRef ? [photoRef] : []),
    ])].sort();
  }

  /** Collects every staged evidence reference bound into a v2 Return command. */
  private returnEvidenceRefs(input: RecordReturnV2): string[] {
    return [...new Set([
      input.signatureEvidenceRef,
      ...input.vehiclePhotoRefs,
      ...input.inspection.flatMap(({ evidenceRefs }) => evidenceRefs),
      ...input.newDamage.flatMap(({ photoRef }) => photoRef ? [photoRef] : []),
    ])].sort();
  }

  /** Verifies caller ownership/designated signer and atomically claims every staged ref. */
  private async assertAndClaimEvidence(
    refs: string[],
    signatureRef: string,
    expectedSignerPersonId: string,
    organizationId: string,
    actorPersonId: string,
    handoverId: string,
    tx: DrizzleDatabase,
  ): Promise<void> {
    const rows = await this.repo.findStagedEvidence(refs, organizationId, actorPersonId, tx);
    if (rows.length !== refs.length) throw new ConflictException({ title: 'Handover evidence is missing, expired or not owned', reasons: [HANDOVER_REASON.evidenceMissing] });
    const signature = rows.find(({ id }) => id === signatureRef);
    if (!signature || signature.evidenceType !== 'Signature' || signature.signerPersonId !== expectedSignerPersonId) {
      throw new ForbiddenException({ title: 'Signature evidence does not match the designated signer', reasons: ['handover-signature-signer-mismatch'] });
    }
    const claimed = await this.repo.claimEvidence(refs, handoverId, tx);
    if (claimed.length !== refs.length) throw new ConflictException({ title: 'Handover evidence was already claimed', reasons: [HANDOVER_REASON.evidenceAlreadyClaimed] });
  }

  /** Verifies magic bytes, strips metadata by rejection and reads image dimensions. */
  private validateImage(body: Buffer, mimeType: string): { width: number; height: number; extension: 'jpg' | 'png' } {
    if (body.length === 0 || body.length > 10_485_760) throw new BadRequestException({ title: 'Evidence size is invalid', reasons: ['handover-evidence-size-invalid'] });
    if (mimeType === 'image/png') {
      const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      if (!body.subarray(0, 8).equals(signature) || body.length < 24) throw new BadRequestException({ title: 'Invalid PNG evidence', reasons: ['handover-evidence-magic-invalid'] });
      for (const chunk of ['eXIf', 'tEXt', 'zTXt', 'iTXt']) {
        if (body.includes(Buffer.from(chunk))) throw new BadRequestException({ title: 'Image metadata is not permitted', reasons: ['handover-evidence-metadata-present'] });
      }
      return { width: body.readUInt32BE(16), height: body.readUInt32BE(20), extension: 'png' };
    }
    if (mimeType === 'image/jpeg') {
      if (body[0] !== 0xff || body[1] !== 0xd8) throw new BadRequestException({ title: 'Invalid JPEG evidence', reasons: ['handover-evidence-magic-invalid'] });
      let offset = 2;
      while (offset + 9 < body.length) {
        if (body[offset] !== 0xff) { offset += 1; continue; }
        const marker = body[offset + 1]!;
        if (marker === 0xe1 || marker === 0xed || marker === 0xfe) throw new BadRequestException({ title: 'Image metadata is not permitted', reasons: ['handover-evidence-metadata-present'] });
        const length = body.readUInt16BE(offset + 2);
        if (length < 2 || offset + 2 + length > body.length) break;
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
          return { width: body.readUInt16BE(offset + 7), height: body.readUInt16BE(offset + 5), extension: 'jpg' };
        }
        offset += 2 + length;
      }
      throw new BadRequestException({ title: 'JPEG dimensions are unavailable', reasons: ['handover-evidence-dimensions-invalid'] });
    }
    throw new BadRequestException({ title: 'Evidence media type is not supported', reasons: ['handover-evidence-mime-invalid'] });
  }

  /** Derives ordered register signals from immutable custody source facts. */
  private registerSignals(row: {
    phase: 'Handover' | 'Returned';
    keyOutcome: string | null;
    newDamageCount: number;
    fuelDeviationFlagged: boolean;
    odometerConflict: boolean;
    lateReturn: boolean;
  }): HandoverRegisterSignal[] {
    if (row.phase === 'Handover') return ['ON_TRIP'];
    const signals: HandoverRegisterSignal[] = [];
    if (row.keyOutcome === 'LostReviewRequired') signals.push('KEY_REVIEW');
    if (row.newDamageCount > 0) signals.push('DAMAGE_REVIEW');
    if (row.fuelDeviationFlagged || row.odometerConflict) signals.push('RECONCILIATION_REVIEW');
    if (row.lateReturn) signals.push('LATE');
    if (signals.length === 0) signals.push('ON_TIME');
    return signals;
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

  private async toDto(row: HandoverRow, executor?: DrizzleDatabase, schemaVersion: 1 | 2 = 1): Promise<HandoverDto> {
    const damage = await this.repo.listDamage(row.id, executor);
    return {
      schemaVersion,
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
