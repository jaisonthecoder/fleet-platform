import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Principal } from '../../../common/auth/principal';
import { ScopeAuthorizationService } from '../../platform/services/scope-authorization.service';
import { DocumentVaultService } from '../services/document-vault.service';
import { TransferService } from '../services/transfer.service';
import { VehicleService } from '../services/vehicle.service';
import { VehicleController } from './vehicle.controller';

const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000002';
const VEHICLE_ID = '10000000-0000-4000-8000-000000000001';

const principal: Principal = {
  organizationId: ORGANIZATION_ID,
  userId: '20000000-0000-4000-8000-000000000001',
  personId: '30000000-0000-4000-8000-000000000001',
  entraObjectId: '40000000-0000-4000-8000-000000000001',
  email: 'fleet@example.test',
  roles: [
    {
      role: 'FleetManager',
      scopeNodeId: '50000000-0000-4000-8000-000000000001',
    },
  ],
  isDevLogin: false,
};

describe('VehicleController organization read boundary', () => {
  const vehicles = {
    organizationOf: jest.fn(),
    activeScope: jest.fn(),
    list: jest.fn(),
    count: jest.fn(),
    get: jest.fn(),
    history: jest.fn(),
  };
  const scopeAuthorization = {
    authorizedDescendantIds: jest.fn(),
    hasRootRole: jest.fn(),
    assertRolesAtScope: jest.fn(),
    assertRootRole: jest.fn(),
  };
  let controller: VehicleController;

  beforeEach(() => {
    jest.clearAllMocks();
    vehicles.organizationOf.mockResolvedValue(ORGANIZATION_ID);
    vehicles.activeScope.mockResolvedValue(
      '50000000-0000-4000-8000-000000000002',
    );
    vehicles.list.mockResolvedValue([]);
    vehicles.count.mockResolvedValue(0);
    vehicles.get.mockResolvedValue({ id: VEHICLE_ID });
    vehicles.history.mockResolvedValue([]);
    scopeAuthorization.authorizedDescendantIds.mockResolvedValue([
      '50000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000002',
    ]);
    scopeAuthorization.hasRootRole.mockResolvedValue(false);
    scopeAuthorization.assertRolesAtScope.mockResolvedValue(undefined);
    scopeAuthorization.assertRootRole.mockResolvedValue(undefined);
    controller = new VehicleController(
      vehicles as unknown as VehicleService,
      {} as DocumentVaultService,
      {} as TransferService,
      scopeAuthorization as unknown as ScopeAuthorizationService,
    );
  });

  it('limits collection reads to the principal authorized hierarchy closure', async () => {
    await expect(controller.list(principal, '25', '5')).resolves.toEqual({
      items: [],
      total: 0,
      page: 25,
      pageSize: 5,
    });
    expect(scopeAuthorization.authorizedDescendantIds).toHaveBeenCalledWith(
      principal,
      expect.arrayContaining([
        'FleetManager',
        'ClusterFleetLead',
        'GroupFleetLead',
      ]),
    );
    expect(vehicles.list).toHaveBeenCalledWith(
      5,
      120,
      ORGANIZATION_ID,
      [
        '50000000-0000-4000-8000-000000000001',
        '50000000-0000-4000-8000-000000000002',
      ],
      false,
      undefined,
      undefined,
    );
  });

  it('includes unassigned vehicles for a principal with an organization root role', async () => {
    scopeAuthorization.hasRootRole.mockResolvedValue(true);

    await expect(controller.list(principal)).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
    });
    expect(scopeAuthorization.hasRootRole).toHaveBeenCalledWith(
      principal,
      expect.arrayContaining([
        'FleetManager',
        'ClusterFleetLead',
        'GroupFleetLead',
      ]),
    );
    expect(vehicles.list).toHaveBeenCalledWith(
      25,
      0,
      ORGANIZATION_ID,
      [
        '50000000-0000-4000-8000-000000000001',
        '50000000-0000-4000-8000-000000000002',
      ],
      true,
      undefined,
      undefined,
    );
  });

  it('returns vehicle detail inside the principal organization', async () => {
    await expect(controller.get(VEHICLE_ID, principal)).resolves.toEqual({
      id: VEHICLE_ID,
    });
    expect(vehicles.get).toHaveBeenCalledWith(VEHICLE_ID);
  });

  it('returns vehicle history inside the principal organization', async () => {
    await expect(controller.history(VEHICLE_ID, principal)).resolves.toEqual(
      [],
    );
    expect(vehicles.history).toHaveBeenCalledWith(VEHICLE_ID);
  });

  it.each(['get', 'history'] as const)(
    'rejects cross-organization %s access',
    async (method) => {
      vehicles.organizationOf.mockResolvedValue(OTHER_ORGANIZATION_ID);

      try {
        await controller[method](VEHICLE_ID, principal);
        throw new Error('expected cross-organization access to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toMatchObject({
          reasons: ['vehicle-organization-mismatch'],
        });
      }
      expect(vehicles[method]).not.toHaveBeenCalled();
    },
  );

  it.each(['get', 'history'] as const)(
    'rejects out-of-scope %s access',
    async (method) => {
      scopeAuthorization.assertRolesAtScope.mockRejectedValueOnce(
        new ForbiddenException({ reasons: ['hierarchy-scope-not-authorized'] }),
      );

      await expect(
        controller[method](VEHICLE_ID, principal),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(vehicles[method]).not.toHaveBeenCalled();
    },
  );
});

describe('VehicleController write authorization', () => {
  const HOME_NODE_ID = '60000000-0000-4000-8000-000000000001';
  const CURRENT_SCOPE_ID = '50000000-0000-4000-8000-000000000002';
  const TARGET_NODE_ID = '70000000-0000-4000-8000-000000000001';

  const vehicles = {
    organizationOf: jest.fn(),
    activeScope: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const transfers = { transfer: jest.fn() };
  const scopeAuthorization = {
    assertRolesAtScope: jest.fn(),
    assertRootRole: jest.fn(),
  };
  let controller: VehicleController;

  beforeEach(() => {
    jest.clearAllMocks();
    vehicles.organizationOf.mockResolvedValue(ORGANIZATION_ID);
    vehicles.activeScope.mockResolvedValue(CURRENT_SCOPE_ID);
    vehicles.create.mockResolvedValue({ id: VEHICLE_ID });
    vehicles.update.mockResolvedValue({ id: VEHICLE_ID });
    transfers.transfer.mockResolvedValue({ id: VEHICLE_ID });
    scopeAuthorization.assertRolesAtScope.mockResolvedValue(undefined);
    scopeAuthorization.assertRootRole.mockResolvedValue(undefined);
    controller = new VehicleController(
      vehicles as unknown as VehicleService,
      {} as DocumentVaultService,
      transfers as unknown as TransferService,
      scopeAuthorization as unknown as ScopeAuthorizationService,
    );
  });

  it('checks the target home scope before creating a vehicle', async () => {
    await controller.create(
      {
        plate: 'AD 30001',
        chassisVin: 'VIN-CREATE-1',
        bodyTypeCode: 'SUV',
        homeNodeId: HOME_NODE_ID,
      },
      principal,
    );

    expect(scopeAuthorization.assertRolesAtScope).toHaveBeenCalledWith(
      principal,
      expect.arrayContaining(['FleetManager']),
      HOME_NODE_ID,
    );
    expect(vehicles.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a create when the target home scope is not authorized', async () => {
    scopeAuthorization.assertRolesAtScope.mockRejectedValueOnce(
      new ForbiddenException({ reasons: ['hierarchy-scope-not-authorized'] }),
    );

    await expect(
      controller.create(
        {
          plate: 'AD 30002',
          chassisVin: 'VIN-CREATE-2',
          bodyTypeCode: 'SUV',
          homeNodeId: HOME_NODE_ID,
        },
        principal,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(vehicles.create).not.toHaveBeenCalled();
  });

  it('checks the current vehicle scope before updating', async () => {
    await controller.update(VEHICLE_ID, { colour: 'White' }, principal);

    expect(scopeAuthorization.assertRolesAtScope).toHaveBeenCalledWith(
      principal,
      expect.arrayContaining(['FleetManager']),
      CURRENT_SCOPE_ID,
    );
    expect(vehicles.update).toHaveBeenCalledTimes(1);
  });

  it('rejects an update when the current vehicle scope is not authorized', async () => {
    scopeAuthorization.assertRolesAtScope.mockRejectedValueOnce(
      new ForbiddenException({ reasons: ['hierarchy-scope-not-authorized'] }),
    );

    await expect(
      controller.update(VEHICLE_ID, { colour: 'White' }, principal),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(vehicles.update).not.toHaveBeenCalled();
  });

  it('checks the current and target scopes before transferring', async () => {
    await controller.transfer(
      VEHICLE_ID,
      { toNodeId: TARGET_NODE_ID },
      principal,
    );

    expect(scopeAuthorization.assertRolesAtScope).toHaveBeenNthCalledWith(
      1,
      principal,
      expect.arrayContaining(['FleetManager']),
      CURRENT_SCOPE_ID,
    );
    expect(scopeAuthorization.assertRolesAtScope).toHaveBeenNthCalledWith(
      2,
      principal,
      expect.arrayContaining(['FleetManager']),
      TARGET_NODE_ID,
    );
    expect(transfers.transfer).toHaveBeenCalledTimes(1);
  });

  it('rejects a transfer when the target scope is not authorized', async () => {
    scopeAuthorization.assertRolesAtScope
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(
        new ForbiddenException({ reasons: ['hierarchy-scope-not-authorized'] }),
      );

    await expect(
      controller.transfer(VEHICLE_ID, { toNodeId: TARGET_NODE_ID }, principal),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transfers.transfer).not.toHaveBeenCalled();
  });
});
