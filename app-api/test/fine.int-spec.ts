import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import { DEFAULT_ORGANIZATION_ID, accessBlock, fine, hierarchyNode, organization, person, vehicle } from '../src/common/database/schema';
import { booking } from '../src/common/database/schema';
import { AuditService } from '../src/modules/platform/services/audit.service';
import { ComplianceService } from '../src/modules/compliance/services/compliance.service';
import { EligibilityService } from '../src/modules/compliance/services/eligibility.service';
import { FinesService } from '../src/modules/fines/services/fines.service';

/**
 * Integration proof of driver accountability (M8). Requires DB + Redis. Proves
 * fine auto-attribution (substitution window vs assigned driver), and that an
 * overdue black-point transfer blocks the driver platform-wide via the shared
 * compliance access block — with the audit chain intact.
 */
describe('fines + substitution (integration — requires DB + Redis)', () => {
  let ctx: INestApplicationContext;
  let fines: FinesService;
  let compliance: ComplianceService;
  let eligibility: EligibilityService;
  let audit: AuditService;
  let db: DrizzleDatabase;

  const suffix = randomUUID().slice(0, 8);
  let poolNode = '';
  let assignedDriverId = '';
  let substituteId = '';
  let vehicleId = '';
  let foreignOrganizationId = '';
  let foreignVehicleId = '';
  let foreignFineId = '';
  let foreignPersonId = '';
  let foreignBlockId = '';
  const fineIds: string[] = [];

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
    fines = ctx.get(FinesService);
    compliance = ctx.get(ComplianceService);
    eligibility = ctx.get(EligibilityService);
    audit = ctx.get(AuditService);
    db = ctx.get<DrizzleDatabase>(DRIZZLE);

    const [node] = await db
      .insert(hierarchyNode)
      .values({ parentId: 'a0000000-0000-4000-8000-000000000003', code: `FI-${suffix.toUpperCase()}`, levelIndex: 3, levelLabel: 'Location', levelCode: 'LOCATION', name: `Fi Location ${suffix}`, nameAr: `Fi Location ${suffix}`, path: sql`${`group.ports.khalifa.fi_${suffix}`}::ltree` })
      .returning({ id: hierarchyNode.id });
    poolNode = node.id;

    const [assigned] = await db
      .insert(person)
      .values({ hcmEmployeeId: `fi-asg-${suffix}`, fullName: `Assigned ${suffix}`, employmentStatus: 'Active' })
      .returning({ id: person.id });
    assignedDriverId = assigned.id;

    const [sub] = await db
      .insert(person)
      .values({ hcmEmployeeId: `fi-sub-${suffix}`, fullName: `Substitute ${suffix}`, employmentStatus: 'Active' })
      .returning({ id: person.id });
    substituteId = sub.id;

    const [veh] = await db
      .insert(vehicle)
      .values({ plate: `FI-${suffix}`, chassisVin: `VIN-FI-${suffix}`, bodyTypeCode: 'SEDAN', useCategoryCode: 'POOL', assignmentModel: 'Dedicated', assignedDriverPersonId: assignedDriverId, lifecycleStatus: 'Active', bookingPoolFlag: true })
      .returning({ id: vehicle.id });
    vehicleId = veh.id;

    const [foreignOrganization] = await db.insert(organization).values({ name: `Foreign ${suffix}`, code: `FOREIGN-${suffix}` }).returning({ id: organization.id });
    foreignOrganizationId = foreignOrganization.id;
    const [foreignPerson] = await db.insert(person).values({ organizationId: foreignOrganizationId, hcmEmployeeId: `fi-foreign-${suffix}`, fullName: `Foreign Person ${suffix}`, employmentStatus: 'Active' }).returning({ id: person.id });
    foreignPersonId = foreignPerson.id;
    const [foreignVehicle] = await db.insert(vehicle).values({ organizationId: foreignOrganizationId, plate: `FX-${suffix}`, chassisVin: `VIN-FX-${suffix}`, bodyTypeCode: 'SEDAN', useCategoryCode: 'POOL', assignmentModel: 'Pool', lifecycleStatus: 'Active', bookingPoolFlag: false }).returning({ id: vehicle.id });
    foreignVehicleId = foreignVehicle.id;
    const [foreignFine] = await db.insert(fine).values({ organizationId: foreignOrganizationId, vehicleId: foreignVehicleId, attributionBasis: 'unattributed', eventTimeUtc: new Date('2026-07-15T12:00:00.000Z'), amount: '999.00', currency: 'AED', authority: 'Foreign Authority' }).returning({ id: fine.id });
    foreignFineId = foreignFine.id;
    const [foreignBlock] = await db.insert(accessBlock).values({ organizationId: foreignOrganizationId, personId: foreignPersonId, reason: 'foreign-block' }).returning({ id: accessBlock.id });
    foreignBlockId = foreignBlock.id;
  });

  afterAll(async () => {
    for (const id of fineIds) {
      await db.execute(sql`DELETE FROM fleet.recovery_record WHERE fine_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.black_point WHERE fine_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.outbox_event WHERE aggregate_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.fine WHERE id = ${id}`);
    }
    await db.execute(sql`DELETE FROM fleet.black_point WHERE subject_person_id IN (${assignedDriverId}, ${substituteId})`);
    await db.execute(sql`DELETE FROM fleet.access_block WHERE person_id IN (${assignedDriverId}, ${substituteId})`);
    await db.execute(sql`DELETE FROM fleet.substitution_window WHERE vehicle_id = ${vehicleId}`);
    await db.execute(sql`DELETE FROM fleet.fine WHERE id = ${foreignFineId}`);
    await db.execute(sql`DELETE FROM fleet.access_block WHERE id = ${foreignBlockId}`);
    await db.execute(sql`DELETE FROM fleet.vehicle WHERE id = ${foreignVehicleId}`);
    await db.execute(sql`DELETE FROM fleet.person WHERE id = ${foreignPersonId}`);
    await db.execute(sql`DELETE FROM fleet.organization WHERE id = ${foreignOrganizationId}`);
    await db.execute(sql`DELETE FROM fleet.vehicle WHERE id = ${vehicleId}`);
    await db.execute(sql`DELETE FROM fleet.person WHERE id IN (${assignedDriverId}, ${substituteId})`);
    await db.execute(sql`DELETE FROM fleet.hierarchy_node WHERE id = ${poolNode}`);
    await ctx?.close();
  });

  it('attributes a fine in a substitution window to the substitute, else the assigned driver', async () => {
    // A window covering 2026-06-10.
    await fines.addSubstitutionWindow(vehicleId, {
      substitutePersonId: substituteId,
      windowStart: '2026-06-10T00:00:00.000Z',
      windowEnd: '2026-06-11T00:00:00.000Z',
      reason: 'cover',
    }, DEFAULT_ORGANIZATION_ID);

    const inWindow = await fines.recordFine({ vehicleId, eventTimeUtc: '2026-06-10T12:00:00.000Z', amount: 300, authority: 'Police' }, DEFAULT_ORGANIZATION_ID);
    fineIds.push(inWindow.id);
    expect(inWindow.attributedPersonId).toBe(substituteId);
    expect(inWindow.attributionBasis).toBe('substitution-window');

    const outsideWindow = await fines.recordFine({ vehicleId, eventTimeUtc: '2026-06-20T12:00:00.000Z', amount: 150, authority: 'Police' }, DEFAULT_ORGANIZATION_ID);
    fineIds.push(outsideWindow.id);
    expect(outsideWindow.attributedPersonId).toBe(assignedDriverId);
    expect(outsideWindow.attributionBasis).toBe('assigned-driver');

    expect(await audit.verifyChain()).toBe(true);
  });

  it('does not list or recover a Fine owned by another organization', async () => {
    expect((await fines.listFines(DEFAULT_ORGANIZATION_ID, 200, 0)).map((item) => item.id)).not.toContain(foreignFineId);
    await expect(fines.recordRecovery(foreignFineId, { amount: 100 }, 'person:finance', DEFAULT_ORGANIZATION_ID)).rejects.toMatchObject({ response: { reasons: [`fine-not-found:${foreignFineId}`] } });
    const rows = await db.execute(sql`SELECT count(*)::int AS count FROM fleet.recovery_record WHERE fine_id = ${foreignFineId}`);
    expect((rows as unknown as Array<{ count: number }>)[0]?.count).toBe(0);
  });

  it('denies cross-organization Fine, substitution and Compliance mutations', async () => {
    await expect(fines.recordFine({ vehicleId: foreignVehicleId, eventTimeUtc: '2026-07-15T13:00:00.000Z', amount: 100, authority: 'Police' }, DEFAULT_ORGANIZATION_ID)).rejects.toBeInstanceOf(Error);
    await expect(fines.addSubstitutionWindow(foreignVehicleId, { substitutePersonId: substituteId, windowStart: '2026-07-15T00:00:00.000Z', windowEnd: '2026-07-16T00:00:00.000Z' }, DEFAULT_ORGANIZATION_ID)).rejects.toMatchObject({ response: { reasons: [`vehicle-not-found:${foreignVehicleId}`] } });
    expect((await compliance.listBlocks(DEFAULT_ORGANIZATION_ID)).map((item) => item.id)).not.toContain(foreignBlockId);
    await expect(compliance.liftBlock(foreignBlockId, 'person:hse', DEFAULT_ORGANIZATION_ID)).rejects.toMatchObject({ response: { reasons: [`access-block-not-found:${foreignBlockId}`] } });
    const rows = await db.execute(sql`SELECT active FROM fleet.access_block WHERE id = ${foreignBlockId}`);
    expect((rows as unknown as Array<{ active: boolean }>)[0]?.active).toBe(true);
  });

  it('denies cross-organization eligibility without leaking foreign evidence', async () => {
    const result = await eligibility.evaluate({ driverPersonId: foreignPersonId, vehicleId: foreignVehicleId }, DEFAULT_ORGANIZATION_ID);
    expect(result).toMatchObject({ decision: 'DENY', reasons: ['driver-not-found'] });
    const rows = await db.execute(sql`SELECT count(*)::int AS count FROM fleet.eligibility_evaluation WHERE organization_id = ${DEFAULT_ORGANIZATION_ID}::uuid AND driver_person_id = ${foreignPersonId}`);
    expect((rows as unknown as Array<{ count: number }>)[0]?.count).toBe(0);
  });

  it('blocks the driver platform-wide when a black-point transfer is overdue', async () => {
    // A historical fine with points ⇒ transfer deadline already in the past.
    const withPoints = await fines.recordFine({ vehicleId, eventTimeUtc: '2020-01-01T00:00:00.000Z', amount: 500, authority: 'Police', points: 6 }, DEFAULT_ORGANIZATION_ID);
    fineIds.push(withPoints.id);
    expect(withPoints.attributedPersonId).toBe(assignedDriverId);

    const blocked = await fines.enforceOverdueBlackPoints(DEFAULT_ORGANIZATION_ID, new Date());
    expect(blocked).toBeGreaterThanOrEqual(1);

    const blocks = await compliance.listBlocks(DEFAULT_ORGANIZATION_ID);
    expect(blocks.some((b) => b.personId === assignedDriverId && b.active)).toBe(true);
  });

  it('attributes a late fine to the driver of the Completed booking that covered it (not the assigned driver)', async () => {
    const [renter] = await db
      .insert(person)
      .values({ hcmEmployeeId: `fi-rent-${suffix}`, fullName: `Renter ${suffix}`, employmentStatus: 'Active' })
      .returning({ id: person.id });
    const start = new Date('2026-07-01T08:00:00.000Z');
    const end = new Date('2026-07-01T18:00:00.000Z');
    const [bk] = await db
      .insert(booking)
      .values({ vehicleId, driverPersonId: renter.id, requestedByPersonId: renter.id, status: 'Completed', pickupAtUtc: start, returnAtUtc: end, reservationStart: start, reservationEnd: end, bufferMinutes: 0 })
      .returning({ id: booking.id });

    // Fine arrives after the trip (booking already Completed) — must attribute to
    // the renter who covered the event, overriding the vehicle's assigned driver.
    const fine = await fines.recordFine({ vehicleId, eventTimeUtc: '2026-07-01T12:00:00.000Z', amount: 200, authority: 'Police' }, DEFAULT_ORGANIZATION_ID);
    expect(fine.attributedPersonId).toBe(renter.id);
    expect(fine.attributionBasis).toBe('booking-active-driver');

    await db.execute(sql`DELETE FROM fleet.outbox_event WHERE aggregate_id = ${fine.id}`);
    await db.execute(sql`DELETE FROM fleet.fine WHERE id = ${fine.id}`);
    await db.execute(sql`DELETE FROM fleet.booking WHERE id = ${bk.id}`);
    await db.execute(sql`DELETE FROM fleet.person WHERE id = ${renter.id}`);
  });
});
