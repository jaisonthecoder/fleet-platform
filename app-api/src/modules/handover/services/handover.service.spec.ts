import { BadRequestException, ConflictException, ForbiddenException, HttpException } from '@nestjs/common';
import { HANDOVER_REASON } from '../../../contracts/handover.contract';
import type { PolicyEvaluationResponse } from '../../../contracts/policy-evaluation.contract';
import type { Principal } from '../../../common/auth/principal';
import { HandoverService } from './handover.service';

async function reasonsOf(promise: Promise<unknown>): Promise<string[]> {
  try {
    await promise;
  } catch (error) {
    return ((error as HttpException).getResponse() as { reasons?: string[] }).reasons ?? [];
  }
  throw new Error('expected the promise to reject');
}

class FakeRepo {
  handovers = new Map<string, Record<string, unknown>>();
  damage: Array<Record<string, unknown>> = [];
  keys: Array<Record<string, unknown>> = [];
  vehicle: Record<string, unknown> | undefined = { id: 'v1', fuelEfficiencyKmpl: '10', lastConfirmedOdometer: '1100' };
  private seq = 0;
  commands: Array<Record<string, unknown>> = [];
  registerRows: Array<Record<string, unknown>> = [];
  captureContext: Record<string, unknown> | undefined;
  evidence: Array<Record<string, unknown>> = [];
  inspections: Array<Record<string, unknown>> = [];
  amendments: Array<Record<string, unknown>> = [];

  transaction<T>(work: (tx: unknown) => Promise<T>): Promise<T> {
    return work({});
  }
  async insert(values: Record<string, unknown>) {
    const row = { id: 'h1', phase: 'Handover', revision: 1, offlineCaptured: false, driverPersonId: 'd1', vehicleId: 'v1', handoverAtUtc: new Date(), ...values };
    this.handovers.set(row.id as string, row);
    return row;
  }
  async findById(id: string) {
    return this.handovers.get(id);
  }
  async findByIdInOrganization(id: string) {
    return this.handovers.get(id);
  }
  async findByIdForUpdate(id: string) {
    return this.handovers.get(id);
  }
  async findByBooking(bookingId: string) {
    return [...this.handovers.values()].find((h) => h.bookingId === bookingId);
  }
  async findCommand(organizationId: string, actorPersonId: string, commandType: string, idempotencyKey: string) {
    return this.commands.find((command) => command.organizationId === organizationId && command.actorPersonId === actorPersonId && command.commandType === commandType && command.idempotencyKey === idempotencyKey);
  }
  async claimCommand(values: Record<string, unknown>) {
    if (await this.findCommand(values.organizationId as string, values.actorPersonId as string, values.commandType as string, values.idempotencyKey as string)) return undefined;
    const command = { id: `c${this.commands.length + 1}`, ...values, resultHandoverId: null };
    this.commands.push(command);
    return command;
  }
  async completeCommand(id: string, resultHandoverId: string, resultBody: unknown) {
    Object.assign(this.commands.find((command) => command.id === id)!, { resultHandoverId, resultBody });
  }
  async update(id: string, patch: Record<string, unknown>) {
    const row = { ...this.handovers.get(id)!, ...patch };
    this.handovers.set(id, row);
    return row;
  }
  async insertDamage(values: Record<string, unknown>) {
    const row = { id: `p${++this.seq}`, x: values.x, y: values.y, region: values.region, templateVersion: values.templateVersion ?? 1, photoRef: values.photoRef ?? null, note: values.note ?? null, state: values.state ?? 'new', atUtc: new Date() };
    this.damage.push(row);
    return row;
  }
  async listDamage() {
    return this.damage;
  }
  async insertKeyLog(values: Record<string, unknown>) {
    this.keys.push(values);
  }
  async listKeys() {
    return this.keys;
  }
  async findVehicle() {
    return this.vehicle;
  }
  async listRegister() {
    return this.registerRows;
  }
  async countRegister() {
    return this.registerRows.length;
  }
  async findCaptureContext() {
    return this.captureContext;
  }
  async listUnresolvedVehicleDamage() {
    return this.damage.map((pin) => ({ pin }));
  }
  async insertEvidence(values: Record<string, unknown>) {
    const row = { id: `e${this.evidence.length + 1}`, expiresAtUtc: values.expiresAtUtc as Date, ...values };
    this.evidence.push(row);
    return row;
  }
  async findPersonInOrganization(personId: string) {
    return { id: personId };
  }
  async findLocationSnapshot(nodeId: string) {
    return { id: nodeId, code: 'GS-POOL', name: 'GS Pool' };
  }
  async findStagedEvidence(ids: string[], _organizationId: string, uploadedByPersonId: string) {
    return this.evidence.filter((item) => ids.includes(item.id as string) && item.uploadedByPersonId === uploadedByPersonId && item.status === 'Staged');
  }
  async claimEvidence(ids: string[], handoverId: string) {
    const rows = this.evidence.filter((item) => ids.includes(item.id as string) && item.status === 'Staged');
    for (const row of rows) Object.assign(row, { status: 'Claimed', handoverId, claimedAtUtc: new Date() });
    return rows;
  }
  async insertInspection(values: Record<string, unknown>) {
    const row = { id: `i${this.inspections.length + 1}`, ...values };
    this.inspections.push(row);
    return row;
  }
  async listAmendments() {
    return this.amendments;
  }
  async insertAmendment(values: Record<string, unknown>) {
    const row = { id: `a${this.amendments.length + 1}`, createdAtUtc: new Date(), evidenceRefs: [], ...values };
    this.amendments.push(row);
    return row;
  }
  async expireUnclaimedEvidence() {
    const expired = this.evidence.filter((item) => item.status === 'Staged' && (item.expiresAtUtc as Date) <= new Date());
    for (const item of expired) Object.assign(item, { status: 'Expired' });
    return expired.map((item) => ({ id: item.id, objectKey: item.objectKey }));
  }
  async listExpiredEvidence() {
    return this.evidence.filter((item) => item.status === 'Expired').map((item) => ({ id: item.id, objectKey: item.objectKey }));
  }
}

class FakePdp {
  async evaluate(): Promise<PolicyEvaluationResponse> {
    return { decision: 'VALUE', reasons: [], policyVersion: 'fd-v1', scopeThatAnswered: 'group', value: { percent: 12 } };
  }
}

class FakeBookings {
  booking = { id: 'bk1', revision: 1, status: 'Approved', driverPersonId: 'd1', vehicleId: 'v1', bookingScopeNodeId: 'scope', returnAtUtc: '2999-01-01T10:00:00.000Z' };
  pickedUp = false;
  returnedLate: boolean | null = null;
  async getInternal() {
    return this.booking;
  }
  async get() {
    return this.booking;
  }
  async markPickedUpInTransaction() {
    this.pickedUp = true;
    this.booking.status = 'Active';
    return this.booking;
  }
  async markReturnedInTransaction(_id: string, _actor: string, late: boolean) {
    this.returnedLate = late;
    this.booking.status = 'Completed';
    return this.booking;
  }
}

class FakeScopeAuthorization {
  async assertRolesAtScope() {}
  async authorizedDescendantIds() {
    return ['scope'];
  }
}

const fleetPrincipal: Principal = {
  organizationId: '00000000-0000-4000-8000-000000000001',
  userId: null,
  personId: 'fleet-actor',
  entraObjectId: null,
  email: null,
  roles: [{ role: 'FleetManager', scopeNodeId: 'scope' }],
  isDevLogin: true,
};

class FakeAudit {
  entries: Array<Record<string, unknown>> = [];
  fail = false;
  async record(entry: Record<string, unknown>) {
    if (this.fail) throw new Error('injected-audit-failure');
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

class FakeEvidenceStore {
  written: string[] = [];
  deleted: string[] = [];
  failDelete = new Set<string>();
  async put(objectKey: string) {
    this.written.push(objectKey);
  }
  async delete(objectKey: string) {
    if (this.failDelete.has(objectKey)) throw new Error('injected-delete-failure');
    this.deleted.push(objectKey);
  }
}

function build() {
  const repo = new FakeRepo();
  const pdp = new FakePdp();
  const bookings = new FakeBookings();
  const audit = new FakeAudit();
  const outbox = new FakeOutbox();
  const scopeAuthorization = new FakeScopeAuthorization();
  const evidenceStore = new FakeEvidenceStore();
  const service = new HandoverService(repo as never, pdp as never, bookings as never, audit as never, outbox as never, scopeAuthorization as never, evidenceStore as never);
  return { service, repo, bookings, audit, outbox, evidenceStore };
}

function png(width = 32, height = 24): Buffer {
  const body = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(body, 0);
  body.writeUInt32BE(width, 16);
  body.writeUInt32BE(height, 20);
  return body;
}

const openInput = {
  bookingId: 'bk1',
  employeePersonId: 'd1',
  startOdometer: 1000,
  startFuelEighths: 8,
  signatureRef: 'sig',
  checklist: [],
  offlineCaptured: false,
  existingDamage: [],
};

describe('HandoverService', () => {
  it('stages validated private image evidence under the Fleet actor organization', async () => {
    const { service, repo, evidenceStore, audit } = build();
    const result = await service.stageEvidence({ evidenceType: 'VehiclePhoto', deviceRef: 'tablet-1' }, png(), 'image/png', fleetPrincipal);
    expect(result).toMatchObject({ id: 'e1', evidenceRef: 'e1', evidenceType: 'VehiclePhoto', status: 'Staged', mimeType: 'image/png' });
    expect(evidenceStore.written[0]).toMatch(/^handover-evidence\/00000000-0000-4000-8000-000000000001\/.+\.png$/);
    expect(repo.evidence[0]).toMatchObject({ uploadedByPersonId: 'fleet-actor', status: 'Staged', deviceRef: 'tablet-1' });
    expect(audit.entries[0]).toMatchObject({ action: 'HANDOVER_EVIDENCE_STAGED' });
  });

  it('rejects metadata-bearing PNG evidence before writing storage', async () => {
    const { service, evidenceStore } = build();
    const body = Buffer.concat([png(), Buffer.from('eXIf')]);
    await expect(service.stageEvidence({ evidenceType: 'DamagePhoto' }, body, 'image/png', fleetPrincipal)).rejects.toThrow(BadRequestException);
    expect(evidenceStore.written).toEqual([]);
  });

  it('deletes the staged object when audit/database transaction completion fails', async () => {
    const { service, evidenceStore, audit } = build();
    audit.fail = true;
    await expect(service.stageEvidence({ evidenceType: 'VehiclePhoto' }, png(), 'image/png', fleetPrincipal)).rejects.toThrow('injected-audit-failure');
    expect(evidenceStore.written).toHaveLength(1);
    expect(evidenceStore.deleted).toEqual(evidenceStore.written);
  });

  it('appends and replays a version-checked amendment with caller-owned evidence', async () => {
    const { service, repo, outbox } = build();
    repo.handovers.set('h1', { id: 'h1', organizationId: fleetPrincipal.organizationId, bookingId: 'bk1', vehicleId: 'v1', driverPersonId: 'd1', phase: 'Returned', revision: 2, handoverAtUtc: new Date(), offlineCaptured: false });
    const evidence = await service.stageEvidence({ evidenceType: 'VehiclePhoto' }, png(), 'image/png', fleetPrincipal);
    const input = { expectedChainRevision: 2, reason: 'Attach a clearer return photograph', evidenceRefs: [evidence.id] };

    const result = await service.amend('h1', input, fleetPrincipal, 'amend-command-key');
    const replay = await service.amend('h1', input, fleetPrincipal, 'amend-command-key');

    expect(result).toMatchObject({ schemaVersion: 2, handoverId: 'h1', revision: 1, evidenceRefs: [evidence.id] });
    expect(replay).toEqual(result);
    expect(repo.evidence[0]).toMatchObject({ status: 'Claimed', handoverId: 'h1' });
    expect(outbox.events.some((event) => event.eventType === 'HandoverAmended')).toBe(true);
    await expect(service.amend('h1', { ...input, expectedChainRevision: 99 }, fleetPrincipal, 'stale-amend-key')).rejects.toMatchObject({ response: { reasons: [HANDOVER_REASON.amendmentRevisionConflict] } });
  });

  it('expires unclaimed evidence and retries failed private-object deletion', async () => {
    const { service, repo, evidenceStore } = build();
    repo.evidence.push({ id: 'expired-1', status: 'Staged', objectKey: 'handover-evidence/org/expired-1.png', expiresAtUtc: new Date(0) });
    evidenceStore.failDelete.add('handover-evidence/org/expired-1.png');

    expect(await service.cleanupExpiredEvidence()).toEqual({ expired: 1, deleted: 0, failed: 1 });
    evidenceStore.failDelete.clear();
    expect(await service.cleanupExpiredEvidence()).toEqual({ expired: 0, deleted: 1, failed: 0 });
  });

  it('returns historical register rows with ordered source-derived review signals', async () => {
    const { service, repo } = build();
    repo.registerRows.push({
      handoverId: 'h1', bookingId: 'bk1', bookingNumber: 'BK-1', driverName: 'Driver',
      vehicleId: 'v1', vehiclePlate: 'AD 1', makeCode: 'NISSAN', modelCode: 'PATROL',
      phase: 'Returned', issuedAtUtc: new Date('2026-07-30T08:00:00.000Z'), returnedAtUtc: new Date('2026-07-30T10:00:00.000Z'),
      distanceKm: '124.0', lateReturn: true, fuelDeviationFlagged: true, odometerConflict: false,
      keyOutcome: 'LostReviewRequired', newDamageCount: 1, activityAtUtc: '2026-07-30T10:00:00.000Z',
    });

    const result = await service.register({ filter: 'All', page: 1, pageSize: 5, sort: 'ActivityDesc' }, fleetPrincipal);

    expect(result.items[0]).toMatchObject({
      primaryStatus: 'KEY_REVIEW',
      signals: ['KEY_REVIEW', 'DAMAGE_REVIEW', 'RECONCILIATION_REVIEW', 'LATE'],
      chargeSummary: { status: 'NOT_CONFIGURED', amount: null },
      capabilities: { view: true, editOpenCustody: false, returnVehicle: false },
    });
  });

  it('does not claim matched telematics or verified eligibility when persisted evidence is absent', async () => {
    const { service, repo } = build();
    repo.captureContext = {
      bookingId: 'bk1', bookingNumber: 'BK-1', bookingRevision: 2, bookingStatus: 'Approved',
      pickupAtUtc: new Date('2026-07-30T08:00:00.000Z'), returnAtUtc: new Date('2026-07-30T10:00:00.000Z'),
      vehicleId: 'v1', vehiclePlate: 'AD 1', makeCode: 'NISSAN', modelCode: 'PATROL', gpsStatus: 'Online', lastConfirmedOdometer: '48213',
      driverPersonId: 'd1', driverName: 'Driver', scopeNodeId: 'scope', scopeName: 'GS Pool',
      consentVersion: 'v3', consentSignedAtUtc: new Date('2026-07-30T07:55:00.000Z'),
      eligibilityDecision: null, eligibilityReasons: null, eligibilityEvaluatedAtUtc: null,
      handoverId: null, handoverPhase: null, handoverRevision: null, handoverAtUtc: null,
      startOdometer: null, startFuelEighths: null, keyIssueRef: null,
      releaseLocationNodeId: null, releaseLocationCode: null, releaseLocationName: null,
    };

    const result = await service.captureContext('bk1', fleetPrincipal);

    expect(result.eligibility).toMatchObject({ status: 'UNAVAILABLE', reasonCodes: ['handover-eligibility-evidence-unavailable'] });
    expect(result.telematics).toEqual({ status: 'STALE', odometer: '48213', observedAtUtc: null });
    expect(result.handover).toBeNull();
    expect(result.capabilities.handover).toBe(false);
  });

  it('opens a handover, logs the key issue, and moves the booking to Active', async () => {
    const { service, repo, bookings, outbox } = build();
    const dto = await service.open(openInput, fleetPrincipal, 'open-command-key');
    expect(dto.phase).toBe('Handover');
    expect(bookings.pickedUp).toBe(true);
    expect(repo.keys.some((k) => k.custodyState === 'Issued')).toBe(true);
    expect(outbox.events.some((e) => e.eventType === 'HandoverCompleted')).toBe(true);
  });

  it('claims v2 evidence, persists exact inspections and completes a Lost-key Return with review evidence', async () => {
    const { service, repo, bookings, outbox } = build();
    const driverSignature = await service.stageEvidence({ evidenceType: 'Signature', signerPersonId: 'd1' }, png(), 'image/png', fleetPrincipal);
    const inspection = (['body', 'tyres', 'lights', 'assets', 'cabin'] as const).map((code) => ({ code, verdict: 'Pass' as const, evidenceRefs: [] }));
    const open = await service.open({
      ...openInput,
      schemaVersion: 2,
      expectedBookingRevision: 1,
      checklistDefinitionVersion: 1,
      inspection,
      vehiclePhotoRefs: [],
      signatureEvidenceRef: driverSignature.id,
      releaseLocationNodeId: 'scope',
    }, fleetPrincipal, 'v2-open-command-key');

    expect(open.schemaVersion).toBe(2);
    expect(repo.inspections).toHaveLength(5);
    expect(repo.evidence[0]).toMatchObject({ status: 'Claimed', handoverId: 'h1' });
    expect(repo.handovers.get('h1')).toMatchObject({ releaseLocationCode: 'GS-POOL', evidenceCompleteness: 'Complete' });

    const replay = await service.open({
      ...openInput,
      schemaVersion: 2,
      expectedBookingRevision: 1,
      checklistDefinitionVersion: 1,
      inspection: [...inspection].reverse(),
      vehiclePhotoRefs: [],
      signatureEvidenceRef: driverSignature.id,
      releaseLocationNodeId: 'scope',
    }, fleetPrincipal, 'v2-open-command-key');
    expect(replay.id).toBe(open.id);

    const fleetSignature = await service.stageEvidence({ evidenceType: 'Signature', signerPersonId: 'fleet-actor' }, png(), 'image/png', fleetPrincipal);
    const returned = await service.recordReturn('h1', {
      endOdometer: 1300,
      endFuelEighths: 5,
      signatureRef: fleetSignature.id,
      offlineCaptured: false,
      newDamage: [],
      schemaVersion: 2,
      expectedHandoverRevision: 1,
      checklistDefinitionVersion: 1,
      inspection,
      returnConditionCode: 'Good',
      keyOutcome: 'Lost',
      keyLostReason: 'Key could not be located at return',
      vehiclePhotoRefs: [],
      signatureEvidenceRef: fleetSignature.id,
      returnLocationNodeId: 'scope',
    }, fleetPrincipal, 'v2-return-command-key');

    expect(returned.schemaVersion).toBe(2);
    expect(bookings.booking.status).toBe('Completed');
    expect(repo.keys.some((key) => key.custodyState === 'Lost' && key.reviewRef)).toBe(true);
    expect(outbox.events.some((event) => event.eventType === 'VehicleKeyLost')).toBe(true);
  });

  it('blocks a handover when the employee is not the booking driver (FR-HAND-01)', async () => {
    const { service } = build();
    await expect(service.open({ ...openInput, employeePersonId: 'someone-else' }, fleetPrincipal, 'wrong-driver-key')).rejects.toThrow(ForbiddenException);
    const reasons = await reasonsOf(service.open({ ...openInput, employeePersonId: 'someone-else' }, fleetPrincipal, 'wrong-driver-key-2'));
    expect(reasons).toContain(HANDOVER_REASON.employeeMismatch);
  });

  it('blocks a handover when the booking is not approved', async () => {
    const { service, bookings } = build();
    bookings.booking.status = 'Draft';
    const reasons = await reasonsOf(service.open(openInput, fleetPrincipal, 'not-approved-key'));
    expect(reasons).toContain(HANDOVER_REASON.bookingNotApproved);
  });

  it('reconciles fuel (advisory flag), flags the odometer conflict, and completes the booking on return', async () => {
    const { service, repo, bookings } = build();
    repo.handovers.set('h1', { id: 'h1', phase: 'Handover', bookingId: 'bk1', vehicleId: 'v1', driverPersonId: 'd1', startOdometer: '1000', offlineCaptured: false, handoverAtUtc: new Date() });
    bookings.booking.status = 'Active';

    const dto = await service.recordReturn('h1', {
      endOdometer: 1300, // distance 300; expected 30 L at 10 km/L
      endFuelEighths: 2,
      observedFuelConsumedLitres: 50, // 66% deviation → flagged
      signatureRef: 'ret-sig',
      offlineCaptured: false,
      newDamage: [{ x: 0.5, y: 0.5, region: 'front-bumper', templateVersion: 1, state: 'new' }],
    }, fleetPrincipal, 'return-command-key');

    expect(dto.phase).toBe('Returned');
    expect(dto.fuelDeviationFlagged).toBe(true);
    expect(dto.odometerConflict).toBe(true); // |1300 - 1100| = 200 km > tolerance
    expect(dto.lateReturn).toBe(false); // returned before the 2999 booked window
    expect(bookings.returnedLate).toBe(false);
    expect(repo.keys.some((k) => k.custodyState === 'Returned')).toBe(true);
    expect(dto.damage.some((d) => d.region === 'front-bumper')).toBe(true);
  });

  it('rejects a return whose odometer precedes the start', async () => {
    const { service, repo, bookings } = build();
    repo.handovers.set('h1', { id: 'h1', phase: 'Handover', bookingId: 'bk1', vehicleId: 'v1', driverPersonId: 'd1', startOdometer: '1000', offlineCaptured: false, handoverAtUtc: new Date() });
    bookings.booking.status = 'Active';
    await expect(
      service.recordReturn('h1', { endOdometer: 900, endFuelEighths: 2, signatureRef: 's', offlineCaptured: false, newDamage: [] }, fleetPrincipal, 'backwards-return-key'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a second return on an already-returned handover', async () => {
    const { service, repo } = build();
    repo.handovers.set('h1', { id: 'h1', phase: 'Returned', bookingId: 'bk1', vehicleId: 'v1', driverPersonId: 'd1', startOdometer: '1000', offlineCaptured: false });
    await expect(
      service.recordReturn('h1', { endOdometer: 1300, endFuelEighths: 2, signatureRef: 's', offlineCaptured: false, newDamage: [] }, fleetPrincipal, 'second-return-key'),
    ).rejects.toThrow(ConflictException);
  });
});
