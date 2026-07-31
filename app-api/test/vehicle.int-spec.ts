import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import {
  DEFAULT_ORGANIZATION_ID,
  lookupType,
  lookupValue,
  hierarchyNode,
  outboxEvent,
  person,
  vehicleHierarchyAssignment,
} from '../src/common/database/schema';
import { REDIS } from '../src/common/redis/redis.constants';
import type { Redis } from 'ioredis';
import { DocumentVaultService } from '../src/modules/vehicles/services/document-vault.service';
import { TransferService } from '../src/modules/vehicles/services/transfer.service';
import { VehicleService } from '../src/modules/vehicles/services/vehicle.service';
import {
  createCoreHierarchyFixture,
  type CoreHierarchyFixture,
} from './support/core-fixtures';

describe('core hierarchy fixture validation', () => {
  const dbWithoutMutations = {
    transaction: jest.fn(),
  } as unknown as DrizzleDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(['', '   ', '---'])(
    'rejects an empty sanitized suiteCode before DB mutation: %p',
    async (suiteCode) => {
      await expect(
        createCoreHierarchyFixture(dbWithoutMutations, { suiteCode }),
      ).rejects.toThrow('suiteCode must contain at least one letter or number');
      expect(dbWithoutMutations.transaction).not.toHaveBeenCalled();
    },
  );

  it.each([0, -1, 1.5, Number.NaN])(
    'rejects an invalid locationCount before DB mutation: %p',
    async (locationCount) => {
      await expect(
        createCoreHierarchyFixture(dbWithoutMutations, {
          suiteCode: 'validation',
          locationCount,
        }),
      ).rejects.toThrow('locationCount must be a positive integer');
      expect(dbWithoutMutations.transaction).not.toHaveBeenCalled();
    },
  );
});

describe('core hierarchy fixture concurrency (integration)', () => {
  let ctx: INestApplicationContext;
  let db: DrizzleDatabase;

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });
    db = ctx.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('atomically provisions or reuses one shared root for concurrent fixtures and preserves it through cleanup', async () => {
    const activeRootsBefore = await db
      .select({ id: hierarchyNode.id })
      .from(hierarchyNode)
      .where(
        and(
          eq(hierarchyNode.organizationId, DEFAULT_ORGANIZATION_ID),
          isNull(hierarchyNode.parentId),
          isNull(hierarchyNode.validTo),
        ),
      );
    expect(activeRootsBefore.length).toBeLessThanOrEqual(1);

    const concurrentSuffix = randomUUID().slice(0, 8);
    const [left, right] = await Promise.all([
      createCoreHierarchyFixture(db, {
        suiteCode: `concurrent_left_${concurrentSuffix}`,
      }),
      createCoreHierarchyFixture(db, {
        suiteCode: `concurrent_right_${concurrentSuffix}`,
      }),
    ]);

    expect(left.rootId).toBe(right.rootId);
    if (activeRootsBefore[0]) {
      expect(left.rootId).toBe(activeRootsBefore[0].id);
    }
    await left.cleanupHierarchy();
    await expect(
      db
        .select({ id: hierarchyNode.id })
        .from(hierarchyNode)
        .where(eq(hierarchyNode.id, left.rootId)),
    ).resolves.toHaveLength(1);
    await expect(
      db
        .select({ id: hierarchyNode.id })
        .from(hierarchyNode)
        .where(eq(hierarchyNode.id, right.poolId)),
    ).resolves.toHaveLength(1);

    await right.cleanupHierarchy();
    await expect(
      db
        .select({ id: hierarchyNode.id })
        .from(hierarchyNode)
        .where(eq(hierarchyNode.id, right.rootId)),
    ).resolves.toHaveLength(1);
  });
});

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
  let hierarchy: CoreHierarchyFixture;
  let node1 = '';
  let node2 = '';
  let driverId = '';

  const baseVehicle = (over: Record<string, unknown> = {}) => ({
    plate,
    chassisVin: `VIN-${suffix}`,
    bodyTypeCode: 'SEDAN',
    fuelTypeCode: 'PETROL',
    bookingPoolFlag: true,
    mulkiyaNumber: `REG-${suffix}`,
    mulkiyaExpiry: '2999-01-01',
    insurancePolicyNumber: `POL-${suffix}`,
    insuranceExpiry: '2999-01-01',
    ...over,
  });

  it('rejects Vendor or lease linkage on an owned vehicle before persistence', async () => {
    await expect(
      vehicles.create({
        ...baseVehicle({ plate: `OWNED-LINK-${suffix}` }),
        ownership: 'Owned',
        vendorId: '30000000-0000-4000-8000-000000000001',
        leaseContractId: '40000000-0000-4000-8000-000000000001',
      } as Parameters<VehicleService['create']>[0]),
    ).rejects.toMatchObject({
      response: {
        reasons: ['vehicle-owned-vendor-lease-forbidden'],
      },
    });
  });

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });
    vehicles = ctx.get(VehicleService);
    transfers = ctx.get(TransferService);
    documents = ctx.get(DocumentVaultService);
    db = ctx.get<DrizzleDatabase>(DRIZZLE);
    redis = ctx.get<Redis>(REDIS);

    // These idempotent rows are a shared integration-test baseline and are intentionally retained.
    await db
      .insert(lookupType)
      .values([
        {
          code: 'vehicle-body-type',
          labelEn: 'Body Type',
          labelAr: 'نوع الهيكل',
          isSystem: true,
        },
        {
          code: 'fuel-type',
          labelEn: 'Fuel Type',
          labelAr: 'نوع الوقود',
          isSystem: true,
        },
      ])
      .onConflictDoNothing();
    const [bodyType] = await db
      .select()
      .from(lookupType)
      .where(eq(lookupType.code, 'vehicle-body-type'));
    const [fuelType] = await db
      .select()
      .from(lookupType)
      .where(eq(lookupType.code, 'fuel-type'));
    await db
      .insert(lookupValue)
      .values([
        {
          lookupTypeId: bodyType.id,
          code: 'SEDAN',
          labelEn: 'Sedan',
          labelAr: 'سيدان',
        },
        {
          lookupTypeId: bodyType.id,
          code: 'BUS',
          labelEn: 'Bus',
          labelAr: 'حافلة',
        },
        {
          lookupTypeId: fuelType.id,
          code: 'PETROL',
          labelEn: 'Petrol',
          labelAr: 'بنزين',
        },
      ])
      .onConflictDoNothing();
    const baselineValues = await db
      .select({ typeCode: lookupType.code, valueCode: lookupValue.code })
      .from(lookupValue)
      .innerJoin(lookupType, eq(lookupValue.lookupTypeId, lookupType.id))
      .where(sql`${lookupType.code} IN ('vehicle-body-type', 'fuel-type')`);
    expect(baselineValues).toEqual(
      expect.arrayContaining([
        { typeCode: 'vehicle-body-type', valueCode: 'SEDAN' },
        { typeCode: 'vehicle-body-type', valueCode: 'BUS' },
        { typeCode: 'fuel-type', valueCode: 'PETROL' },
      ]),
    );
    // Direct inserts bypass the cache — flush so getValues reflects them.
    await redis.del(
      'lookup:type:vehicle-body-type',
      'lookup:type:fuel-type',
      'lookup:type:vehicle-make',
    );

    hierarchy = await createCoreHierarchyFixture(db, {
      suiteCode: `vehicle_${suffix}`,
      locationCount: 2,
    });
    [node1, node2] = hierarchy.locationIds;

    const [p] = await db
      .insert(person)
      .values({
        hcmEmployeeId: `v-driver-${suffix}`,
        fullName: `Driver ${suffix}`,
        employmentStatus: 'Active',
      })
      .returning({ id: person.id });
    driverId = p.id;
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await db.execute(
        sql`DELETE FROM fleet.vehicle_hierarchy_assignment WHERE vehicle_id = ${id}`,
      );
      await db.execute(
        sql`DELETE FROM fleet.vehicle_lifecycle_history WHERE vehicle_id = ${id}`,
      );
      await db.execute(
        sql`DELETE FROM fleet.vehicle_transfer WHERE vehicle_id = ${id}`,
      );
      await db.execute(
        sql`DELETE FROM fleet.vehicle_document WHERE vehicle_id = ${id}`,
      );
      await db.execute(
        sql`DELETE FROM fleet.outbox_event WHERE aggregate_id = ${id}`,
      );
      await db.execute(sql`DELETE FROM fleet.vehicle WHERE id = ${id}`);
    }
    if (driverId) {
      await db.execute(sql`DELETE FROM fleet.person WHERE id = ${driverId}`);
    }
    await hierarchy?.cleanupHierarchy();
    await ctx?.close();
  });

  it('creates a vehicle with valid lookup codes and emits a VehicleChanged event', async () => {
    const created = await vehicles.create(
      baseVehicle({ homeNodeId: node1 }),
      'tester',
    );
    createdIds.push(created.id);
    expect(created.plate).toBe(plate);
    expect(created.bookingPoolFlag).toBe(true);
    expect(created.lifecycleStatus).toBe('Active');
    expect(created.mulkiyaNumber).toBe(`REG-${suffix}`);
    expect(created.insurancePolicyNumber).toBe(`POL-${suffix}`);

    const events = await db
      .select()
      .from(outboxEvent)
      .where(
        and(
          eq(outboxEvent.aggregateId, created.id),
          eq(outboxEvent.eventType, 'VehicleChanged'),
        ),
      );
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('keeps an incomplete onboarded vehicle out of the booking pool', async () => {
    const created = await vehicles.create(
      {
        plate: `VT-INCOMPLETE-${suffix}`,
        chassisVin: `VIN-INCOMPLETE-${suffix}`,
        bodyTypeCode: 'SEDAN',
        fuelTypeCode: 'PETROL',
        homeNodeId: node1,
      },
      'tester',
    );
    createdIds.push(created.id);
    expect(created.bookingPoolFlag).toBe(false);
  });

  it('rejects explicit booking-pool activation without current compliance evidence', async () => {
    await expect(
      vehicles.create(
        {
          plate: `VT-UNSAFE-${suffix}`,
          chassisVin: `VIN-UNSAFE-${suffix}`,
          bodyTypeCode: 'SEDAN',
          fuelTypeCode: 'PETROL',
          bookingPoolFlag: true,
          homeNodeId: node1,
        },
        'tester',
      ),
    ).rejects.toMatchObject({
      response: {
        reasons: expect.arrayContaining([
          'vehicle-mulkiya-required-for-pool',
          'vehicle-insurance-required-for-pool',
        ]),
      },
    });
  });

  it('forces Bus/Equipment non-bookable via the DB trigger', async () => {
    const bus = await vehicles.create(
      baseVehicle({
        plate: `VT-BUS-${suffix}`,
        chassisVin: `VIN-BUS-${suffix}`,
        bodyTypeCode: 'BUS',
      }),
      'tester',
    );
    createdIds.push(bus.id);
    expect(bus.bookingPoolFlag).toBe(false);
  });

  it('rejects an invalid classification code (not in lookups)', async () => {
    await expect(
      vehicles.create(
        baseVehicle({
          plate: `VT-X-${suffix}`,
          chassisVin: `VIN-X-${suffix}`,
          bodyTypeCode: 'NOT_A_CODE',
        }),
      ),
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

    const maint = await vehicles.transition(
      v.id,
      { toStatus: 'UnderMaintenance', reason: 'service' },
      'tester',
    );
    expect(maint.lifecycleStatus).toBe('UnderMaintenance');

    await expect(
      vehicles.transition(v.id, { toStatus: 'Sold' }, 'tester'),
    ).rejects.toBeInstanceOf(ConflictException);

    const history = await vehicles.history(v.id);
    expect(history.map((h) => h.toStatus)).toEqual(
      expect.arrayContaining(['Active', 'UnderMaintenance']),
    );
  });

  it('transfers between nodes and forbids overlapping active assignments (exclusion)', async () => {
    const v = await vehicles.create(
      baseVehicle({
        plate: `VT-TR-${suffix}`,
        chassisVin: `VIN-TR-${suffix}`,
        homeNodeId: node1,
      }),
      'tester',
    );
    createdIds.push(v.id);

    await transfers.transfer(
      v.id,
      { toNodeId: node2, reason: 'reorg' },
      'tester',
    );
    const active = await db
      .select()
      .from(vehicleHierarchyAssignment)
      .where(
        and(
          eq(vehicleHierarchyAssignment.vehicleId, v.id),
          isNull(vehicleHierarchyAssignment.validTo),
        ),
      );
    expect(active).toHaveLength(1);
    expect(active[0].nodeId).toBe(node2);

    // A second overlapping active assignment must be rejected by the exclusion constraint.
    await expect(
      db
        .insert(vehicleHierarchyAssignment)
        .values({ vehicleId: v.id, nodeId: node1 }),
    ).rejects.toBeDefined();
  });

  it('updates mutable attributes and emits an event', async () => {
    const v = await vehicles.create(
      baseVehicle({ plate: `VT-U-${suffix}`, chassisVin: `VIN-U-${suffix}` }),
      'tester',
    );
    createdIds.push(v.id);
    const updated = await vehicles.update(
      v.id,
      { colour: 'Silver', operationalStatus: 'Quarantined' },
      'tester',
    );
    expect(updated.operationalStatus).toBe('Quarantined');
  });

  it('maps a bad hierarchy node (FK violation) to a 400, not a 500', async () => {
    await expect(
      vehicles.create(
        baseVehicle({
          plate: `VT-FK-${suffix}`,
          chassisVin: `VIN-FK-${suffix}`,
          homeNodeId: randomUUID(),
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces the Dedicated-requires-driver invariant on update', async () => {
    const v = await vehicles.create(
      baseVehicle({
        plate: `VT-D-${suffix}`,
        chassisVin: `VIN-D-${suffix}`,
        assignmentModel: 'Dedicated',
        assignedDriverPersonId: driverId,
      }),
      'tester',
    );
    createdIds.push(v.id);
    await expect(
      vehicles.update(v.id, { assignedDriverPersonId: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('versions documents in the vault', async () => {
    const v = await vehicles.create(
      baseVehicle({
        plate: `VT-DOC-${suffix}`,
        chassisVin: `VIN-DOC-${suffix}`,
      }),
      'tester',
    );
    createdIds.push(v.id);
    const first = await documents.addDocument(
      v.id,
      { docTypeCode: 'MULKIYA' },
      'tester',
    );
    const second = await documents.addDocument(
      v.id,
      { docTypeCode: 'MULKIYA' },
      'tester',
    );
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
  });

  it('lists, counts, and summarizes the scoped registry with search + sort', async () => {
    const token = `LIST-${suffix}`;
    const created = await vehicles.create(
      baseVehicle({ plate: `VT-${token}`, chassisVin: `VIN-${token}`, homeNodeId: node1 }),
      'tester',
    );
    createdIds.push(created.id);
    const scope = [node1, node2];

    const count = await vehicles.count(undefined, scope, false, token);
    expect(count).toBe(1);

    const page = await vehicles.list(50, 0, undefined, scope, false, token, 'plate:asc');
    expect(page).toHaveLength(1);
    expect(page[0].id).toBe(created.id);
    expect(page[0].plate).toBe(`VT-${token}`);

    const summary = await vehicles.summary(undefined, scope, false);
    expect(summary.total).toBeGreaterThanOrEqual(1);
    expect(summary.active).toBeGreaterThanOrEqual(1);
    expect(summary.total).toBeGreaterThanOrEqual(summary.active);
  });
});
