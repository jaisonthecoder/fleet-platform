import { randomUUID } from 'node:crypto';
import postgres, { type Sql } from 'postgres';
import { DEFAULT_ORGANIZATION_ID } from '../src/common/database/schema';

/**
 * Independent-connection proof for the structural Dedicated allocation guards.
 * Two real PostgreSQL sessions start together and compete for one Vehicle/range.
 */
describe('Dedicated allocation independent-connection concurrency', () => {
  let setup: Sql;
  let first: Sql;
  let second: Sql;
  const suffix = randomUUID().slice(0, 8);
  const personIds: string[] = [];
  const entitlementIds: string[] = [];
  const bookingIds: string[] = [];
  const bsdWindowIds: string[] = [];
  let vehicleId = '';
  let bookingRaceVehicleId = '';
  let lifecycleRaceVehicleId = '';
  let lifecycleEntitlementId = '';
  let lifecycleAllocationId = '';

  beforeAll(async () => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is required');
    setup = postgres(url, { max: 1, prepare: false });
    first = postgres(url, { max: 1, prepare: false });
    second = postgres(url, { max: 1, prepare: false });

    for (const label of ['requester-a', 'requester-b', 'allocator']) {
      const [row] = await setup<{ id: string }[]>`
        INSERT INTO fleet.person (organization_id, hcm_employee_id, full_name, employment_status)
        VALUES (${DEFAULT_ORGANIZATION_ID}, ${`allocation-${label}-${suffix}`}, ${label}, 'Active')
        RETURNING id
      `;
      personIds.push(row!.id);
    }
    const [vehicle] = await setup<{ id: string }[]>`
      INSERT INTO fleet.vehicle (
        organization_id, plate, chassis_vin, body_type_code, assignment_model,
        lifecycle_status, booking_pool_flag, mulkiya_number, mulkiya_expiry,
        insurance_policy_number, insurance_expiry
      ) VALUES (
        ${DEFAULT_ORGANIZATION_ID}, ${`RACE-${suffix}`}, ${`VIN-RACE-${suffix}`},
        'SEDAN', 'Pool', 'Active', true, ${`REG-${suffix}`}, '2999-12-31',
        ${`INS-${suffix}`}, '2999-12-31'
      ) RETURNING id
    `;
    vehicleId = vehicle!.id;

    for (let index = 0; index < 2; index += 1) {
      const [request] = await setup<{ id: string }[]>`
        INSERT INTO fleet.entitlement_request (
          organization_id, request_type, driver_option, requester_person_id,
          requested_by_person_id, justification_category, justification_text,
          vehicle_category_code, duration_start, duration_end, status
        ) VALUES (
          ${DEFAULT_ORGANIZATION_ID}, 'LongTerm', 'WithoutDriver', ${personIds[index]},
          ${personIds[index]}, 'OPERATIONAL_REQUIREMENT', 'Concurrency proof',
          'SEDAN', '2027-01-01', '2027-06-30', 'AwaitingConsent'
        ) RETURNING id
      `;
      entitlementIds.push(request!.id);
    }

    const vehicles = await setup<{ id: string }[]>`
      INSERT INTO fleet.vehicle (
        organization_id, plate, chassis_vin, body_type_code, assignment_model,
        lifecycle_status, booking_pool_flag, mulkiya_number, mulkiya_expiry,
        insurance_policy_number, insurance_expiry
      ) VALUES
        (
          ${DEFAULT_ORGANIZATION_ID}, ${`BOOK-RACE-${suffix}`}, ${`VIN-BOOK-RACE-${suffix}`},
          'SEDAN', 'Pool', 'Active', true, ${`REG-BOOK-${suffix}`}, '2999-12-31',
          ${`INS-BOOK-${suffix}`}, '2999-12-31'
        ),
        (
          ${DEFAULT_ORGANIZATION_ID}, ${`LIFE-RACE-${suffix}`}, ${`VIN-LIFE-RACE-${suffix}`},
          'SEDAN', 'Dedicated', 'Active', false, ${`REG-LIFE-${suffix}`}, '2999-12-31',
          ${`INS-LIFE-${suffix}`}, '2999-12-31'
        )
      RETURNING id
    `;
    [bookingRaceVehicleId, lifecycleRaceVehicleId] = vehicles.map((row) => row.id);

    const [lifecycleRequest] = await setup<{ id: string }[]>`
      INSERT INTO fleet.entitlement_request (
        organization_id, request_type, driver_option, requester_person_id,
        requested_by_person_id, justification_category, justification_text,
        vehicle_category_code, duration_start, duration_end, status, vehicle_id
      ) VALUES (
        ${DEFAULT_ORGANIZATION_ID}, 'LongTerm', 'WithoutDriver', ${personIds[0]},
        ${personIds[0]}, 'OPERATIONAL_REQUIREMENT', 'Lifecycle concurrency proof',
        'SEDAN', '2027-01-01', '2027-06-30', 'Allocated', ${lifecycleRaceVehicleId}
      ) RETURNING id
    `;
    lifecycleEntitlementId = lifecycleRequest!.id;
    entitlementIds.push(lifecycleEntitlementId);

    const [allocation] = await setup<{ id: string }[]>`
      INSERT INTO fleet.entitlement_allocation (
        organization_id, entitlement_request_id, vehicle_id,
        allocated_by_person_id, effective_start, effective_end,
        preferred_vehicle_id, preference_honoured, qualification_snapshot
      ) VALUES (
        ${DEFAULT_ORGANIZATION_ID}, ${lifecycleEntitlementId}, ${lifecycleRaceVehicleId},
        ${personIds[2]}, '2027-01-01', '2027-06-30', NULL, false,
        ${setup.json({ source: 'lifecycle-independent-connection-test' })}
      ) RETURNING id
    `;
    lifecycleAllocationId = allocation!.id;

    const [window] = await setup<{ id: string }[]>`
      INSERT INTO fleet.bsd_return_window (
        organization_id, entitlement_request_id, vehicle_id,
        window_start, window_end, status, confirmed_by_person_id, confirmed_at_utc
      ) VALUES (
        ${DEFAULT_ORGANIZATION_ID}, ${lifecycleEntitlementId}, ${lifecycleRaceVehicleId},
        '2027-02-01T08:00:00Z', '2027-02-01T18:00:00Z', 'Confirmed',
        ${personIds[2]}, '2027-01-15T08:00:00Z'
      ) RETURNING id
    `;
    bsdWindowIds.push(window!.id);
  });

  afterAll(async () => {
    if (setup) {
      if (bookingIds.length) await setup`DELETE FROM fleet.booking WHERE id IN ${setup(bookingIds)}`;
      if (bsdWindowIds.length) await setup`DELETE FROM fleet.bsd_return_window WHERE id IN ${setup(bsdWindowIds)}`;
      await setup`DELETE FROM fleet.entitlement_allocation WHERE entitlement_request_id IN ${setup(entitlementIds)}`;
      await setup`DELETE FROM fleet.entitlement_request WHERE id IN ${setup(entitlementIds)}`;
      const vehicleIds = [vehicleId, bookingRaceVehicleId, lifecycleRaceVehicleId].filter(Boolean);
      if (vehicleIds.length) await setup`DELETE FROM fleet.vehicle WHERE id IN ${setup(vehicleIds)}`;
      if (personIds.length) await setup`DELETE FROM fleet.person WHERE id IN ${setup(personIds)}`;
    }
    await Promise.all([
      first?.end({ timeout: 5 }),
      second?.end({ timeout: 5 }),
      setup?.end({ timeout: 5 }),
    ]);
  });

  it('commits exactly one allocation when two sessions compete for one Vehicle range', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let ready = 0;

    const compete = (client: Sql, entitlementRequestId: string) => client.begin(async (transaction) => {
      ready += 1;
      if (ready === 2) release();
      await gate;
      await transaction`SELECT id FROM fleet.vehicle WHERE id = ${vehicleId} FOR UPDATE`;
      return transaction`
        INSERT INTO fleet.entitlement_allocation (
          organization_id, entitlement_request_id, vehicle_id,
          allocated_by_person_id, effective_start, effective_end,
          preferred_vehicle_id, preference_honoured, qualification_snapshot
        ) VALUES (
          ${DEFAULT_ORGANIZATION_ID}, ${entitlementRequestId}, ${vehicleId},
          ${personIds[2]}, '2027-01-01', '2027-06-30', NULL, false,
          ${transaction.json({ source: 'independent-connection-test' })}
        ) RETURNING id
      `;
    });

    const results = await Promise.allSettled([
      compete(first, entitlementIds[0]!),
      compete(second, entitlementIds[1]!),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(rejected?.reason).toMatchObject({ code: '23P01', constraint_name: 'entitlement_allocation_no_overlap' });

    const allocations = await setup<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM fleet.entitlement_allocation
      WHERE vehicle_id = ${vehicleId} AND status = 'Active'
    `;
    expect(allocations[0]?.count).toBe(1);
  });

  it('makes a Dedicated allocation attempt observe a Booking committed while it waits for the Vehicle lock', async () => {
    let releaseBooking!: () => void;
    let bookingLocked!: () => void;
    let allocationWaiting!: () => void;
    const allowBookingCommit = new Promise<void>((resolve) => { releaseBooking = resolve; });
    const hasBookingLock = new Promise<void>((resolve) => { bookingLocked = resolve; });
    const hasStartedAllocation = new Promise<void>((resolve) => { allocationWaiting = resolve; });

    const bookingCommit = first.begin(async (transaction) => {
      await transaction`SELECT id FROM fleet.vehicle WHERE id = ${bookingRaceVehicleId} FOR UPDATE`;
      bookingLocked();
      await allowBookingCommit;
      const [row] = await transaction<{ id: string }[]>`
        INSERT INTO fleet.booking (
          organization_id, vehicle_id, driver_person_id, requested_by_person_id,
          status, pickup_at_utc, return_at_utc, reservation_start, reservation_end
        ) VALUES (
          ${DEFAULT_ORGANIZATION_ID}, ${bookingRaceVehicleId}, ${personIds[0]}, ${personIds[0]},
          'PendingApproval', '2027-03-01T09:00:00Z', '2027-03-01T11:00:00Z',
          '2027-03-01T09:00:00Z', '2027-03-01T11:00:00Z'
        ) RETURNING id
      `;
      bookingIds.push(row!.id);
    });

    await hasBookingLock;
    const allocationAttempt = second.begin(async (transaction) => {
      allocationWaiting();
      await transaction`SELECT id FROM fleet.vehicle WHERE id = ${bookingRaceVehicleId} FOR UPDATE`;
      const overlap = await transaction<{ id: string }[]>`
        SELECT id
        FROM fleet.booking
        WHERE vehicle_id = ${bookingRaceVehicleId}
          AND status IN ('PendingApproval', 'Approved', 'Active')
          AND tstzrange(reservation_start, reservation_end)
            && tstzrange('2027-03-01T09:00:00Z'::timestamptz, '2027-03-01T11:00:00Z'::timestamptz)
        LIMIT 1
      `;
      if (overlap.length > 0) throw new Error('vehicle-no-longer-qualified:booking-overlap');
    });

    await hasStartedAllocation;
    releaseBooking();
    await expect(bookingCommit).resolves.toBeUndefined();
    await expect(allocationAttempt).rejects.toThrow('vehicle-no-longer-qualified:booking-overlap');

    const state = await setup<{ bookings: number; allocations: number }[]>`
      SELECT
        (SELECT count(*)::int FROM fleet.booking WHERE vehicle_id = ${bookingRaceVehicleId}) AS bookings,
        (SELECT count(*)::int FROM fleet.entitlement_allocation WHERE vehicle_id = ${bookingRaceVehicleId} AND status = 'Active') AS allocations
    `;
    expect(state[0]).toEqual({ bookings: 1, allocations: 0 });
  });

  it('serializes BSD activation before return and leaves one terminal, Pool-safe final state', async () => {
    let releaseBsd!: () => void;
    let bsdLocked!: () => void;
    let returnWaiting!: () => void;
    const allowBsdCommit = new Promise<void>((resolve) => { releaseBsd = resolve; });
    const hasBsdLock = new Promise<void>((resolve) => { bsdLocked = resolve; });
    const hasStartedReturn = new Promise<void>((resolve) => { returnWaiting = resolve; });

    const activateBsd = first.begin(async (transaction) => {
      await transaction`SELECT id FROM fleet.entitlement_request WHERE id = ${lifecycleEntitlementId} FOR UPDATE`;
      await transaction`SELECT id FROM fleet.bsd_return_window WHERE id = ${bsdWindowIds[0]} FOR UPDATE`;
      await transaction`SELECT id FROM fleet.vehicle WHERE id = ${lifecycleRaceVehicleId} FOR UPDATE`;
      bsdLocked();
      await allowBsdCommit;
      await transaction`
        UPDATE fleet.vehicle
        SET assignment_model = 'Pool', booking_pool_flag = true
        WHERE id = ${lifecycleRaceVehicleId}
      `;
      await transaction`
        UPDATE fleet.bsd_return_window
        SET status = 'Active', activated_at_utc = '2027-02-01T08:00:00Z'
        WHERE id = ${bsdWindowIds[0]}
      `;
    });

    await hasBsdLock;
    const returnVehicle = second.begin(async (transaction) => {
      returnWaiting();
      const [entitlement] = await transaction<{ status: string }[]>`
        SELECT status FROM fleet.entitlement_request WHERE id = ${lifecycleEntitlementId} FOR UPDATE
      `;
      if (entitlement?.status !== 'Allocated') throw new Error('entitlement-state-changed');
      await transaction`SELECT id FROM fleet.entitlement_allocation WHERE id = ${lifecycleAllocationId} FOR UPDATE`;
      await transaction`
        UPDATE fleet.bsd_return_window
        SET status = CASE WHEN status IN ('Active', 'Conflict') THEN 'Completed' ELSE 'Cancelled' END,
            completed_at_utc = CASE WHEN status IN ('Active', 'Conflict') THEN now() ELSE completed_at_utc END
        WHERE entitlement_request_id = ${lifecycleEntitlementId}
          AND status IN ('Proposed', 'Confirmed', 'Active', 'Conflict')
      `;
          await transaction`SELECT id FROM fleet.vehicle WHERE id = ${lifecycleRaceVehicleId} FOR UPDATE`;
      await transaction`
        UPDATE fleet.entitlement_allocation
        SET status = 'Returned', ended_at_utc = now()
        WHERE id = ${lifecycleAllocationId}
      `;
      await transaction`
        UPDATE fleet.vehicle
        SET assignment_model = 'Pool', booking_pool_flag = true,
            assigned_driver_person_id = NULL
        WHERE id = ${lifecycleRaceVehicleId}
      `;
      await transaction`
        UPDATE fleet.entitlement_request
        SET status = 'Returned', revision = revision + 1
        WHERE id = ${lifecycleEntitlementId}
      `;
    });

    await hasStartedReturn;
    releaseBsd();
    await expect(activateBsd).resolves.toBeUndefined();
    await expect(returnVehicle).resolves.toBeUndefined();

    const [state] = await setup<{
      allocationStatus: string;
      entitlementStatus: string;
      windowStatus: string;
      assignmentModel: string;
      bookingPoolFlag: boolean;
    }[]>`
      SELECT
        allocation.status AS "allocationStatus",
        entitlement.status AS "entitlementStatus",
        bsd.status AS "windowStatus",
        vehicle.assignment_model AS "assignmentModel",
        vehicle.booking_pool_flag AS "bookingPoolFlag"
      FROM fleet.entitlement_request entitlement
      JOIN fleet.entitlement_allocation allocation ON allocation.entitlement_request_id = entitlement.id
      JOIN fleet.bsd_return_window bsd ON bsd.entitlement_request_id = entitlement.id
      JOIN fleet.vehicle vehicle ON vehicle.id = entitlement.vehicle_id
      WHERE entitlement.id = ${lifecycleEntitlementId}
    `;
    expect(state).toEqual({
      allocationStatus: 'Returned',
      entitlementStatus: 'Returned',
      windowStatus: 'Completed',
      assignmentModel: 'Pool',
      bookingPoolFlag: true,
    });
  });
});
