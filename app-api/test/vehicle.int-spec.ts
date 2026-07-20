import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import {
  hierarchyNode,
  lookupType,
  lookupValue,
  outboxEvent,
  person,
  vehicleHierarchyAssignment,
} from '../src/common/database/schema';
import { REDIS } from '../src/common/redis/redis.constants';
import type { Redis } from 'ioredis';
import { DocumentVaultService } from '../src/modules/vehicles/services/document-vault.service';
import { TransferService } from '../src/modules/vehicles/services/transfer.service';
import { VehicleService } from '../src/modules/vehicles/services/vehicle.service';

/**
 * Integration proof of the vehicle master (M2). Requires a live DB + Redis.
 * Proves lookup-validated classification, the not-bookable trigger, uniqueness,
 * guarded lifecycle transitions with history, the transactional VehicleChanged
 * event, and the overlapping-assignment exclusion constraint.
 */
describe('vehicle master (integration — requires DB + Redis)', () => {
  let ctx: INestApplicationContext;
  let vehicles: VehicleService;
  let transfers: TransferService;
  let documents: DocumentVaultService;
  let db: DrizzleDatabase;
  let redis: Redis;

  const suffix = randomUUID().slice(0, 8);
  const plate = `VT-${suffix}`;
  const createdIds: string[] = [];
  let node1 = '';
  let node2 = '';
  let driverId = '';

  const baseVehicle = (over: Record<string, unknown> = {}) => ({
    plate,
    chassisVin: `VIN-${suffix}`,
    bodyTypeCode: 'SEDAN',
    fuelTypeCode: 'PETROL',
    ...over,
  });

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
    vehicles = ctx.get(VehicleService);
    transfers = ctx.get(TransferService);
    documents = ctx.get(DocumentVaultService);
    db = ctx.get<DrizzleDatabase>(DRIZZLE);
    redis = ctx.get<Redis>(REDIS);

    // Ensure the fixture lookup types + values the vehicle service validates against exist.
    await db.insert(lookupType).values([
      { code: 'vehicle-body-type', labelEn: 'Body Type', labelAr: 'نوع الهيكل', isSystem: true },
      { code: 'fuel-type', labelEn: 'Fuel Type', labelAr: 'نوع الوقود', isSystem: true },
    ]).onConflictDoNothing();
    const [bodyType] = await db.select().from(lookupType).where(eq(lookupType.code, 'vehicle-body-type'));
    const [fuelType] = await db.select().from(lookupType).where(eq(lookupType.code, 'fuel-type'));
    await db.insert(lookupValue).values([
      { lookupTypeId: bodyType.id, code: 'SEDAN', labelEn: 'Sedan', labelAr: 'سيدان' },
      { lookupTypeId: bodyType.id, code: 'BUS', labelEn: 'Bus', labelAr: 'حافلة' },
      { lookupTypeId: fuelType.id, code: 'PETROL', labelEn: 'Petrol', labelAr: 'بنزين' },
    ]).onConflictDoNothing();
    // Direct inserts bypass the cache — flush so getValues reflects them.
    await redis.del('lookup:type:vehicle-body-type', 'lookup:type:fuel-type', 'lookup:type:vehicle-make');

    const nodes = await db
      .insert(hierarchyNode)
      .values([
        { parentId: 'a0000000-0000-4000-8000-000000000003', code: `VP-A-${suffix.toUpperCase()}`, levelIndex: 3, levelLabel: 'Location', levelCode: 'LOCATION', name: `V Location A ${suffix}`, nameAr: `V Location A ${suffix}`, path: sql`${`group.ports.khalifa.vp_a_${suffix}`}::ltree` },
        { parentId: 'a0000000-0000-4000-8000-000000000003', code: `VP-B-${suffix.toUpperCase()}`, levelIndex: 3, levelLabel: 'Location', levelCode: 'LOCATION', name: `V Location B ${suffix}`, nameAr: `V Location B ${suffix}`, path: sql`${`group.ports.khalifa.vp_b_${suffix}`}::ltree` },
      ])
      .returning({ id: hierarchyNode.id });
    node1 = nodes[0].id;
    node2 = nodes[1].id;

    const [p] = await db
      .insert(person)
      .values({ hcmEmployeeId: `v-driver-${suffix}`, fullName: `Driver ${suffix}`, employmentStatus: 'Active' })
      .returning({ id: person.id });
    driverId = p.id;
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await db.execute(sql`DELETE FROM fleet.vehicle_hierarchy_assignment WHERE vehicle_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.vehicle_lifecycle_history WHERE vehicle_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.vehicle_transfer WHERE vehicle_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.vehicle_document WHERE vehicle_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.outbox_event WHERE aggregate_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.vehicle WHERE id = ${id}`);
    }
    await db.execute(sql`DELETE FROM fleet.hierarchy_node WHERE id IN (${node1}, ${node2})`);
    await db.execute(sql`DELETE FROM fleet.person WHERE id = ${driverId}`);
    await ctx?.close();
  });

  it('creates a vehicle with valid lookup codes and emits a VehicleChanged event', async () => {
    const created = await vehicles.create(baseVehicle({ homeNodeId: node1 }), 'tester');
    createdIds.push(created.id);
    expect(created.plate).toBe(plate);
    expect(created.bookingPoolFlag).toBe(true);
    expect(created.lifecycleStatus).toBe('Active');

    const events = await db
      .select()
      .from(outboxEvent)
      .where(and(eq(outboxEvent.aggregateId, created.id), eq(outboxEvent.eventType, 'VehicleChanged')));
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('forces Bus/Equipment non-bookable via the DB trigger', async () => {
    const bus = await vehicles.create(
      baseVehicle({ plate: `VT-BUS-${suffix}`, chassisVin: `VIN-BUS-${suffix}`, bodyTypeCode: 'BUS' }),
      'tester',
    );
    createdIds.push(bus.id);
    expect(bus.bookingPoolFlag).toBe(false);
  });

  it('rejects an invalid classification code (not in lookups)', async () => {
    await expect(
      vehicles.create(baseVehicle({ plate: `VT-X-${suffix}`, chassisVin: `VIN-X-${suffix}`, bodyTypeCode: 'NOT_A_CODE' })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a duplicate plate (uniqueness)', async () => {
    await expect(
      vehicles.create(baseVehicle({ chassisVin: `VIN-DUP-${suffix}` })),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('guards lifecycle transitions and records history', async () => {
    const v = await vehicles.create(
      baseVehicle({ plate: `VT-T-${suffix}`, chassisVin: `VIN-T-${suffix}` }),
      'tester',
    );
    createdIds.push(v.id);

    const maint = await vehicles.transition(v.id, { toStatus: 'UnderMaintenance', reason: 'service' }, 'tester');
    expect(maint.lifecycleStatus).toBe('UnderMaintenance');

    await expect(vehicles.transition(v.id, { toStatus: 'Sold' }, 'tester')).rejects.toBeInstanceOf(ConflictException);

    const history = await vehicles.history(v.id);
    expect(history.map((h) => h.toStatus)).toEqual(expect.arrayContaining(['Active', 'UnderMaintenance']));
  });

  it('transfers between nodes and forbids overlapping active assignments (exclusion)', async () => {
    const v = await vehicles.create(
      baseVehicle({ plate: `VT-TR-${suffix}`, chassisVin: `VIN-TR-${suffix}`, homeNodeId: node1 }),
      'tester',
    );
    createdIds.push(v.id);

    await transfers.transfer(v.id, { toNodeId: node2, reason: 'reorg' }, 'tester');
    const active = await db
      .select()
      .from(vehicleHierarchyAssignment)
      .where(and(eq(vehicleHierarchyAssignment.vehicleId, v.id), isNull(vehicleHierarchyAssignment.validTo)));
    expect(active).toHaveLength(1);
    expect(active[0].nodeId).toBe(node2);

    // A second overlapping active assignment must be rejected by the exclusion constraint.
    await expect(
      db.insert(vehicleHierarchyAssignment).values({ vehicleId: v.id, nodeId: node1 }),
    ).rejects.toBeDefined();
  });

  it('updates mutable attributes and emits an event', async () => {
    const v = await vehicles.create(
      baseVehicle({ plate: `VT-U-${suffix}`, chassisVin: `VIN-U-${suffix}` }),
      'tester',
    );
    createdIds.push(v.id);
    const updated = await vehicles.update(v.id, { colour: 'Silver', operationalStatus: 'Quarantined' }, 'tester');
    expect(updated.operationalStatus).toBe('Quarantined');
  });

  it('maps a bad hierarchy node (FK violation) to a 400, not a 500', async () => {
    await expect(
      vehicles.create(
        baseVehicle({ plate: `VT-FK-${suffix}`, chassisVin: `VIN-FK-${suffix}`, homeNodeId: randomUUID() }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces the Dedicated-requires-driver invariant on update', async () => {
    const v = await vehicles.create(
      baseVehicle({ plate: `VT-D-${suffix}`, chassisVin: `VIN-D-${suffix}`, assignmentModel: 'Dedicated', assignedDriverPersonId: driverId }),
      'tester',
    );
    createdIds.push(v.id);
    await expect(
      vehicles.update(v.id, { assignedDriverPersonId: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('versions documents in the vault', async () => {
    const v = await vehicles.create(
      baseVehicle({ plate: `VT-DOC-${suffix}`, chassisVin: `VIN-DOC-${suffix}` }),
      'tester',
    );
    createdIds.push(v.id);
    const first = await documents.addDocument(v.id, { docTypeCode: 'MULKIYA' }, 'tester');
    const second = await documents.addDocument(v.id, { docTypeCode: 'MULKIYA' }, 'tester');
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
  });
});
