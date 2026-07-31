import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Principal } from '../../../common/auth/principal';
import { ScopeAuthorizationService } from '../../platform/services/scope-authorization.service';
import { VehicleService } from '../../vehicles/services/vehicle.service';
import { AlertService } from '../services/alert.service';
import { DeviceService } from '../services/device.service';
import { LiveMapService } from '../services/live-map.service';
import { TripService } from '../services/trip.service';
import { TelematicsController } from './telematics.controller';

const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const VEHICLE_ID = '10000000-0000-4000-8000-000000000001';
const SCOPE_ID = '20000000-0000-4000-8000-000000000001';
const principal: Principal = { organizationId: ORGANIZATION_ID, userId: null, personId: '30000000-0000-4000-8000-000000000001', entraObjectId: null, email: null, roles: [{ role: 'FleetManager', scopeNodeId: SCOPE_ID }], isDevLogin: true };

describe('TelematicsController Vehicle read authorization', () => {
  const devices = { getVehicleDevice: jest.fn() };
  const trips = { listForVehicle: jest.fn() };
  const alerts = { listForVehicle: jest.fn() };
  const liveMap = { getLive: jest.fn() };
  const scope = { assertRolesAtScope: jest.fn(), assertRootRole: jest.fn() };
  const vehicles = { organizationOf: jest.fn(), activeScope: jest.fn() };
  let controller: TelematicsController;

  beforeEach(() => {
    jest.clearAllMocks();
    vehicles.organizationOf.mockResolvedValue(ORGANIZATION_ID);
    vehicles.activeScope.mockResolvedValue(SCOPE_ID);
    scope.assertRolesAtScope.mockResolvedValue(undefined);
    liveMap.getLive.mockResolvedValue({ vehicleId: VEHICLE_ID });
    controller = new TelematicsController(devices as unknown as DeviceService, trips as unknown as TripService, alerts as unknown as AlertService, liveMap as unknown as LiveMapService, scope as unknown as ScopeAuthorizationService, vehicles as unknown as VehicleService);
  });

  it('checks organization and current scope before returning live telemetry', async () => {
    await controller.live(VEHICLE_ID, principal);
    expect(scope.assertRolesAtScope).toHaveBeenCalledWith(principal, expect.arrayContaining(['FleetManager']), SCOPE_ID);
    expect(liveMap.getLive).toHaveBeenCalledWith(VEHICLE_ID, ORGANIZATION_ID, principal.personId);
  });

  it.each(['live', 'vehicleDevice', 'vehicleAlerts', 'vehicleTrips'] as const)('rejects cross-organization %s reads before accessing data', async (method) => {
    vehicles.organizationOf.mockResolvedValueOnce('00000000-0000-4000-8000-000000000099');
    await expect(controller[method](VEHICLE_ID, principal)).rejects.toBeInstanceOf(BadRequestException);
    expect(liveMap.getLive).not.toHaveBeenCalled();
    expect(devices.getVehicleDevice).not.toHaveBeenCalled();
    expect(alerts.listForVehicle).not.toHaveBeenCalled();
    expect(trips.listForVehicle).not.toHaveBeenCalled();
  });

  it.each(['live', 'vehicleDevice', 'vehicleAlerts', 'vehicleTrips'] as const)('rejects sibling-scope %s reads before accessing data', async (method) => {
    scope.assertRolesAtScope.mockRejectedValueOnce(new ForbiddenException({ reasons: ['hierarchy-scope-not-authorized'] }));
    await expect(controller[method](VEHICLE_ID, principal)).rejects.toBeInstanceOf(ForbiddenException);
    expect(liveMap.getLive).not.toHaveBeenCalled();
    expect(devices.getVehicleDevice).not.toHaveBeenCalled();
    expect(alerts.listForVehicle).not.toHaveBeenCalled();
    expect(trips.listForVehicle).not.toHaveBeenCalled();
  });
});