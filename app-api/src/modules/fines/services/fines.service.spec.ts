import { BadRequestException, ConflictException } from '@nestjs/common';
import { PolicyEvaluationResponse } from '../../../contracts/policy-evaluation.contract';
import { FinesService } from './fines.service';

class FakeRepo {
  fines: Array<Record<string, unknown>> = [];
  blackPoints: Array<Record<string, unknown>> = [];
  recoveries: Array<Record<string, unknown>> = [];
  substitutionWindows: Array<{ substitutePersonId: string; start: Date; end: Date }> = [];
  vehicle: Record<string, unknown> | undefined = { id: 'v1', assignedDriverPersonId: 'assigned' };
  fineCountSince = 1;
  overdue: Array<{ id: string; subjectPersonId: string; points: number }> = [];
  recoveryExists = false;
  failInsertCode: string | null = null;
  private seq = 0;

  transaction<T>(work: (tx: unknown) => Promise<T>): Promise<T> {
    return work({});
  }
  async insertFine(values: Record<string, unknown>) {
    if (this.failInsertCode) {
      const err = new Error('db constraint') as Error & { code: string };
      err.code = this.failInsertCode;
      throw err;
    }
    const row = { id: `f${++this.seq}`, createdAtUtc: new Date(), ...values };
    this.fines.push(row);
    return row;
  }
  async findFine(id: string) {
    return this.fines.find((f) => f.id === id);
  }
  async updateFine(id: string, patch: Record<string, unknown>) {
    const row = { ...this.fines.find((f) => f.id === id)!, ...patch };
    return row;
  }
  async listFines() {
    return this.fines;
  }
  async insertAccident(values: Record<string, unknown>) {
    return { id: 'a1', status: 'Open', severity: null, ...values };
  }
  async insertBlackPoint(values: Record<string, unknown>) {
    const row = { id: `bp${++this.seq}`, ...values };
    this.blackPoints.push(row);
    return row;
  }
  async updateBlackPoint(id: string, patch: Record<string, unknown>) {
    const bp = this.blackPoints.find((b) => b.id === id);
    if (bp) {
      Object.assign(bp, patch);
    }
  }
  async findOverdueOpenBlackPoints() {
    return this.overdue;
  }
  async insertRecovery(values: Record<string, unknown>) {
    this.recoveries.push(values);
    return { id: 'r1', ...values };
  }
  async hasRecovery() {
    return this.recoveryExists;
  }
  async insertSubstitutionWindow(values: Record<string, unknown>) {
    return { id: 'w1', reason: null, ...values };
  }
  async coveringSubstitutionWindows() {
    return this.substitutionWindows;
  }
  async findVehicle() {
    return this.vehicle;
  }
  async countFinesForPersonSince() {
    return this.fineCountSince;
  }
}

class FakePdp {
  async evaluate(req: { ruleType: string }): Promise<PolicyEvaluationResponse> {
    if (req.ruleType === 'fines-hr-threshold') {
      return { decision: 'VALUE', reasons: [], policyVersion: 'hr-v1', scopeThatAnswered: 'group', value: { count: 3, months: 12 } };
    }
    if (req.ruleType === 'black-point-timeframe') {
      return { decision: 'VALUE', reasons: [], policyVersion: 'bp-v1', scopeThatAnswered: 'group', value: { transferDeadlineDays: 14 } };
    }
    return { decision: 'DENY', reasons: [], policyVersion: 'none', scopeThatAnswered: 'group' };
  }
}
class FakeBookings {
  active: { bookingId: string; driverPersonId: string } | null = null;
  async findBookingCoveringEvent() {
    return this.active;
  }
  async findActiveBooking() {
    return this.active;
  }
}
class FakeCompliance {
  blocks: Array<Record<string, unknown>> = [];
  async raiseBlock(input: Record<string, unknown>) {
    this.blocks.push(input);
    return { id: 'blk', ...input, active: true };
  }
}
class FakeAudit {
  entries: Array<Record<string, unknown>> = [];
  async record(e: Record<string, unknown>) {
    this.entries.push(e);
  }
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
  const bookings = new FakeBookings();
  const compliance = new FakeCompliance();
  const audit = new FakeAudit();
  const outbox = new FakeOutbox();
  const service = new FinesService(repo as never, pdp as never, bookings as never, compliance as never, audit as never, outbox as never);
  return { service, repo, bookings, compliance, audit, outbox };
}

const fineInput = { vehicleId: 'v1', eventTimeUtc: '2026-07-10T12:00:00.000Z', amount: 300, authority: 'Police', points: 0 };

describe('FinesService', () => {
  it('attributes to the substitute when the event falls in a substitution window', async () => {
    const { service, repo } = build();
    repo.substitutionWindows = [{ substitutePersonId: 'sub', start: new Date('2026-07-10T00:00:00Z'), end: new Date('2026-07-11T00:00:00Z') }];
    repo.fineCountSince = 0;
    const dto = await service.recordFine(fineInput);
    expect(dto.attributedPersonId).toBe('sub');
    expect(dto.attributionBasis).toBe('substitution-window');
    expect(dto.status).toBe('Attributed');
  });

  it('falls back to the assigned driver when there is no booking or window', async () => {
    const { service, repo } = build();
    repo.fineCountSince = 0;
    const dto = await service.recordFine(fineInput);
    expect(dto.attributedPersonId).toBe('assigned');
    expect(dto.attributionBasis).toBe('assigned-driver');
  });

  it('records a black point (with transfer deadline) when the fine carries points', async () => {
    const { service, repo, outbox } = build();
    repo.fineCountSince = 0;
    await service.recordFine({ ...fineInput, points: 6 });
    expect(repo.blackPoints).toHaveLength(1);
    expect(repo.blackPoints[0].transferDeadline).toBeInstanceOf(Date);
    expect(outbox.events.some((e) => e.eventType === 'BlackPointRecorded')).toBe(true);
  });

  it('raises an HR alert at the fines-per-user threshold', async () => {
    const { service, repo, outbox, audit } = build();
    repo.fineCountSince = 3; // meets default threshold of 3/12mo
    await service.recordFine(fineInput);
    expect(outbox.events.some((e) => e.eventType === 'FinesHrThresholdReached')).toBe(true);
    expect(audit.entries.some((e) => e.action === 'FINES_HR_ALERT')).toBe(true);
  });

  it('blocks a driver platform-wide when a black-point transfer is overdue', async () => {
    const { service, repo, compliance } = build();
    repo.overdue = [{ id: 'bp1', subjectPersonId: 'driver-x', points: 6 }];
    const blocked = await service.enforceOverdueBlackPoints(new Date());
    expect(blocked).toBe(1);
    expect(compliance.blocks.some((b) => b.personId === 'driver-x')).toBe(true);
    expect(repo.blackPoints).toHaveLength(0); // none inserted here
  });

  it('raises only one block per person even with multiple overdue points in a run', async () => {
    const { service, compliance, repo } = build();
    repo.overdue = [
      { id: 'bp1', subjectPersonId: 'driver-x', points: 6 },
      { id: 'bp2', subjectPersonId: 'driver-x', points: 3 },
    ];
    await service.enforceOverdueBlackPoints(new Date());
    expect(compliance.blocks.filter((b) => b.personId === 'driver-x')).toHaveLength(1);
  });

  it('records a recovery instruction WITHOUT marking the fine recovered (Phase 1 records only)', async () => {
    const { service, repo } = build();
    repo.fines.push({ id: 'f1', vehicleId: 'v1', bookingId: null, attributedPersonId: 'p', attributionBasis: 'assigned-driver', eventTimeUtc: new Date(), amount: '300.00', currency: 'AED', authority: 'Police', status: 'Attributed', points: 0, createdAtUtc: new Date() });
    const dto = await service.recordRecovery('f1', { amount: 100 });
    expect(dto.status).toBe('Attributed'); // unchanged
    expect(repo.recoveries).toHaveLength(1);
  });

  it('rejects a duplicate recovery instruction for the same fine', async () => {
    const { service, repo } = build();
    repo.fines.push({ id: 'f1', vehicleId: 'v1', bookingId: null, attributedPersonId: 'p', attributionBasis: 'assigned-driver', eventTimeUtc: new Date(), amount: '300.00', currency: 'AED', authority: 'Police', status: 'Attributed', points: 0, createdAtUtc: new Date() });
    repo.recoveryExists = true;
    await expect(service.recordRecovery('f1', { amount: 100 })).rejects.toThrow(ConflictException);
  });

  it('maps a DB constraint violation on record to a 4xx (not a 500)', async () => {
    const { service, repo } = build();
    repo.fineCountSince = 0;
    repo.failInsertCode = '23503'; // foreign_key_violation
    await expect(service.recordFine(fineInput)).rejects.toBeInstanceOf(BadRequestException);
  });
});
