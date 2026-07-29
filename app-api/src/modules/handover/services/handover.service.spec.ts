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

  transaction<T>(work: (tx: unknown) => Promise<T>): Promise<T> {
    return work({});
  }
  async insert(values: Record<string, unknown>) {
    const row = { id: 'h1', phase: 'Handover', offlineCaptured: false, driverPersonId: 'd1', vehicleId: 'v1', handoverAtUtc: new Date(), ...values };
    this.handovers.set(row.id as string, row);
    return row;
  }
  async findById(id: string) {
    return this.handovers.get(id);
  }
  async findByIdInOrganization(id: string) {
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
}

class FakePdp {
  async evaluate(): Promise<PolicyEvaluationResponse> {
    return { decision: 'VALUE', reasons: [], policyVersion: 'fd-v1', scopeThatAnswered: 'group', value: { percent: 12 } };
  }
}

class FakeBookings {
  booking = { id: 'bk1', status: 'Approved', driverPersonId: 'd1', vehicleId: 'v1', bookingScopeNodeId: 'scope', returnAtUtc: '2999-01-01T10:00:00.000Z' };
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
  async record(entry: Record<string, unknown>) {
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

function build() {
  const repo = new FakeRepo();
  const pdp = new FakePdp();
  const bookings = new FakeBookings();
  const audit = new FakeAudit();
  const outbox = new FakeOutbox();
  const scopeAuthorization = new FakeScopeAuthorization();
  const service = new HandoverService(repo as never, pdp as never, bookings as never, audit as never, outbox as never, scopeAuthorization as never);
  return { service, repo, bookings, audit, outbox };
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
  it('opens a handover, logs the key issue, and moves the booking to Active', async () => {
    const { service, repo, bookings, outbox } = build();
    const dto = await service.open(openInput, fleetPrincipal, 'open-command-key');
    expect(dto.phase).toBe('Handover');
    expect(bookings.pickedUp).toBe(true);
    expect(repo.keys.some((k) => k.custodyState === 'Issued')).toBe(true);
    expect(outbox.events.some((e) => e.eventType === 'HandoverCompleted')).toBe(true);
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
