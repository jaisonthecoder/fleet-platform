import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import type { PlatformRole } from '../src/common/database/schema';
import type { Principal } from '../src/common/auth/principal';
import { hierarchyNode, person, vehicle, vehicleHierarchyAssignment } from '../src/common/database/schema';
import { operationsOverviewSchema } from '../src/contracts/operations-overview.contract';
import { DashboardsService } from '../src/modules/dashboards/services/dashboards.service';
import { FinesService } from '../src/modules/fines/services/fines.service';

/**
 * Integration proof of the read models (M9). Requires DB + Redis. Proves real
 * aggregates over committed state, hierarchy-scoped roll-up, cost masking by
 * role (Finance full · Executive aggregate · others masked), and that the real
 * `operations/overview` read model conforms to the shared contract (mock retired).
 */
describe('dashboards read models (integration — requires DB + Redis)', () => {
  let ctx: INestApplicationContext;
  let dashboards: DashboardsService;
  let fines: FinesService;
  let db: DrizzleDatabase;

  const suffix = randomUUID().slice(0, 8);
  let poolNode = '';
  let driverId = '';
  let vehicleId = '';
  const fineIds: string[] = [];
  const principal = (role: PlatformRole): Principal => ({
    organizationId: '00000000-0000-4000-8000-000000000001',
    userId: null,
    personId: driverId,
    entraObjectId: null,
    email: null,
    roles: [{ role, scopeNodeId: poolNode }],
    isDevLogin: true,
  });

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
    dashboards = ctx.get(DashboardsService);
    fines = ctx.get(FinesService);
    db = ctx.get<DrizzleDatabase>(DRIZZLE);

    const [node] = await db
      .insert(hierarchyNode)
      .values({ parentId: 'a0000000-0000-4000-8000-000000000003', code: `DB-${suffix.toUpperCase()}`, levelIndex: 3, levelLabel: 'Location', levelCode: 'LOCATION', name: `Db Location ${suffix}`, nameAr: `Db Location ${suffix}`, path: sql`${`group.ports.khalifa.db_${suffix}`}::ltree` })
      .returning({ id: hierarchyNode.id });
    poolNode = node.id;

    const [driver] = await db
      .insert(person)
      .values({ hcmEmployeeId: `db-drv-${suffix}`, fullName: `Driver ${suffix}`, employmentStatus: 'Active' })
      .returning({ id: person.id });
    driverId = driver.id;

    const [veh] = await db
      .insert(vehicle)
      .values({ plate: `DB-${suffix}`, chassisVin: `VIN-DB-${suffix}`, bodyTypeCode: 'SEDAN', useCategoryCode: 'POOL', assignmentModel: 'Dedicated', assignedDriverPersonId: driverId, lifecycleStatus: 'Active', bookingPoolFlag: true })
      .returning({ id: vehicle.id });
    vehicleId = veh.id;

    await db.insert(vehicleHierarchyAssignment).values({ vehicleId, nodeId: poolNode });

    // A fine attributed to the assigned driver (no booking/window ⇒ assigned-driver).
    const fine = await fines.recordFine({ vehicleId, eventTimeUtc: '2026-05-01T12:00:00.000Z', amount: 300, authority: 'Police' });
    fineIds.push(fine.id);
  });

  afterAll(async () => {
    for (const id of fineIds) {
      await db.execute(sql`DELETE FROM fleet.black_point WHERE fine_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.outbox_event WHERE aggregate_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.fine WHERE id = ${id}`);
    }
    await db.execute(sql`DELETE FROM fleet.vehicle_hierarchy_assignment WHERE vehicle_id = ${vehicleId}`);
    await db.execute(sql`DELETE FROM fleet.vehicle WHERE id = ${vehicleId}`);
    await db.execute(sql`DELETE FROM fleet.person WHERE id = ${driverId}`);
    await db.execute(sql`DELETE FROM fleet.hierarchy_node WHERE id = ${poolNode}`);
    await ctx?.close();
  });

  it('computes scoped utilisation over committed state', async () => {
    const tile = await dashboards.utilisation(principal('FleetManager'), poolNode);
    expect(tile.totalVehicles).toBe(1); // only our vehicle is assigned to this fresh node
    expect(tile.bookableVehicles).toBe(1);
  });

  it('masks fine cost per role (Finance full · Executive aggregate · others masked)', async () => {
    const finance = await dashboards.finesPerUser(principal('Finance'), ['Finance'], poolNode);
    expect(finance.costVisibility).toBe('full');
    expect(finance.totalAmount).toBe('300.00');
    expect(finance.perUser.some((r) => r.personId === driverId)).toBe(true);

    const executive = await dashboards.finesPerUser(principal('Executive'), ['Executive'], poolNode);
    expect(executive.costVisibility).toBe('aggregate');
    expect(executive.totalAmount).toBe('300.00');
    expect(executive.perUser).toHaveLength(0); // no per-user breakdown

    const fleetManager = await dashboards.finesPerUser(principal('FleetManager'), ['FleetManager'], poolNode);
    expect(fleetManager.costVisibility).toBe('masked');
    expect(fleetManager.totalAmount).toBeNull(); // cost hidden
    expect(fleetManager.totalFines).toBe(1); // counts still visible
  });

  it('reports telematics coverage over the scoped fleet', async () => {
    const tile = await dashboards.telematicsCoverage(principal('FleetManager'), poolNode);
    expect(tile.fleetInScope).toBe(1);
    expect(tile.devicesReporting).toBe(0);
    expect(tile.coveragePercent).toBe(0);
  });

  it('serves the real operations overview conforming to the contract (mock retired)', async () => {
    const overview = await dashboards.operationsOverview(principal('FleetManager'), poolNode);
    expect(operationsOverviewSchema.safeParse(overview).success).toBe(true);
    expect(overview.summary.totalVehicles).toBe(1);
  });
});
