import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth/auth.decorators';
import type { Principal } from '../../../common/auth/principal';
import {
  endTripSchema,
  pairDeviceSchema,
  raiseAlertSchema,
  registerDeviceSchema,
  startTripSchema,
} from '../../../contracts/telematics.contract';
import { AlertService } from '../services/alert.service';
import { DeviceService } from '../services/device.service';
import { LiveMapService } from '../services/live-map.service';
import { TripService } from '../services/trip.service';
import { ScopeAuthorizationService } from '../../platform/services/scope-authorization.service';

const actorRef = (p?: Principal): string => p?.personId ?? p?.entraObjectId ?? 'system';
const FLEET_ROLES = ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead', 'SystemAdmin'] as const;

const parse = <T>(schema: { safeParse: (b: unknown) => { success: boolean; data?: T; error?: { issues: { message: string }[] } } }, body: unknown): T => {
  const r = schema.safeParse(body);
  if (!r.success) {
    throw new BadRequestException({ title: 'Invalid telematics payload', reasons: r.error!.issues.map((i) => i.message) });
  }
  return r.data!;
};

/** Telematics domain API (M10): device registry/pairing, trips, live map, alerts. */
@Controller({ version: '1' })
export class TelematicsController {
  constructor(
    private readonly devices: DeviceService,
    private readonly trips: TripService,
    private readonly alerts: AlertService,
    private readonly liveMap: LiveMapService,
    private readonly scope: ScopeAuthorizationService,
  ) {}

  @Get('devices')
  listDevices() {
    return this.devices.list();
  }

  @Roles(...FLEET_ROLES)
  @Post('devices')
  register(@Body() body: unknown, @CurrentUser() p: Principal) {
    return this.devices.register(parse(registerDeviceSchema, body), actorRef(p));
  }

  @Roles(...FLEET_ROLES)
  @Post('devices/pair')
  pair(@Body() body: unknown, @CurrentUser() p: Principal) {
    return this.devices.pair(parse(pairDeviceSchema, body), actorRef(p));
  }

  @Roles(...FLEET_ROLES)
  @Post('devices/:id/unpair')
  unpair(@Param('id') id: string, @CurrentUser() p: Principal) {
    return this.devices.unpair(id, actorRef(p));
  }

  @Roles(...FLEET_ROLES)
  @Post('trips')
  startTrip(@Body() body: unknown) {
    return this.trips.startTrip(parse(startTripSchema, body));
  }

  @Roles(...FLEET_ROLES)
  @Post('trips/:id/end')
  endTrip(@Param('id') id: string, @Body() body: unknown, @CurrentUser() p: Principal) {
    return this.trips.endTrip(id, parse(endTripSchema, body), actorRef(p));
  }

  @Get('vehicles/:id/telemetry/live')
  live(@Param('id') id: string, @CurrentUser() p: Principal) {
    return this.liveMap.getLive(id, actorRef(p));
  }

  @Roles(...FLEET_ROLES)
  @Get('telematics/live')
  async fleetLive(@CurrentUser() p: Principal) {
    const [authorizedNodeIds, includeUnassigned] = await Promise.all([
      this.scope.authorizedDescendantIds(p, FLEET_ROLES),
      this.scope.hasRootRole(p, FLEET_ROLES),
    ]);
    return this.liveMap.getFleetLive(
      p.organizationId,
      authorizedNodeIds,
      includeUnassigned,
      actorRef(p),
    );
  }

  @Get('vehicles/:id/device')
  async vehicleDevice(@Param('id') id: string) {
    return { device: await this.devices.getVehicleDevice(id) };
  }

  @Get('vehicles/:id/alerts')
  vehicleAlerts(@Param('id') id: string) {
    return this.alerts.listForVehicle(id);
  }

  @Get('vehicles/:id/trips')
  vehicleTrips(@Param('id') id: string) {
    return this.trips.listForVehicle(id);
  }

  @Get('telematics/alerts')
  listAlerts() {
    return this.alerts.list();
  }

  @Roles(...FLEET_ROLES)
  @Post('telematics/alerts')
  raiseAlert(@Body() body: unknown) {
    return this.alerts.raiseAlert(parse(raiseAlertSchema, body));
  }

  @Roles(...FLEET_ROLES)
  @Post('telematics/alerts/:id/ack')
  ackAlert(@Param('id') id: string) {
    return this.alerts.acknowledge(id);
  }
}
