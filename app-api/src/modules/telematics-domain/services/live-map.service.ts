import { Injectable } from '@nestjs/common';
import type {
  LiveFleetPositionDto,
  LivePositionDto,
} from '../../../contracts/telematics.contract';
import { AuditService } from '../../platform/services/audit.service';
import { TelematicsRepository } from '../repositories/telematics.repository';

/** A vehicle is "online" if its last telemetry point is within this window. */
const FRESHNESS_MS = 5 * 60 * 1000;

/**
 * Live map read model. Returns the latest known position + an online/offline
 * freshness flag for a vehicle. Every access is audited (D4 privacy — location
 * access is logged). Off-shift masking is applied by the caller/policy.
 */
@Injectable()
export class LiveMapService {
  constructor(
    private readonly repo: TelematicsRepository,
    private readonly audit: AuditService,
  ) {}

  async getLive(vehicleId: string, organizationId: string, actorRef = 'system'): Promise<LivePositionDto> {
    const latest = await this.repo.latestTelemetry(vehicleId);
    // D4: location-data access is always logged.
    await this.audit.record({
      organizationId,
      actorRef,
      action: 'TELEMATICS_LIVE_ACCESS',
      entityRef: `vehicle:${vehicleId}`,
    });
    const at = latest?.time ?? null;
    const online = at ? Date.now() - at.getTime() < FRESHNESS_MS : false;
    return {
      vehicleId,
      lat: latest?.lat ?? null,
      lon: latest?.lon ?? null,
      speed: latest?.speed ?? null,
      ignition: latest?.ignition ?? null,
      odometer: latest?.odometer ?? null,
      fuelLevel: latest?.fuelLevel ?? null,
      dtcCodes: latest?.dtcCodes ?? null,
      deviceHealth: latest?.deviceHealth ?? null,
      at: at ? at.toISOString() : null,
      online,
    };
  }

  /** Latest position per scoped vehicle for the fleet live map (bulk, audited). */
  async getFleetLive(
    organizationId: string | undefined,
    authorizedNodeIds: string[] | undefined,
    includeUnassigned: boolean,
    actorRef = 'system',
  ): Promise<LiveFleetPositionDto[]> {
    const rows = await this.repo.latestPerVehicle(
      organizationId,
      authorizedNodeIds,
      includeUnassigned,
    );
    // D4: bulk location access is logged once per read.
    await this.audit.record({
      organizationId: organizationId!,
      actorRef,
      action: 'TELEMATICS_LIVE_FLEET_ACCESS',
      entityRef: 'fleet',
    });
    const nowMs = Date.now();
    return rows.map((row) => ({
      vehicleId: row.vehicleId,
      plate: row.plate,
      lat: row.lat,
      lon: row.lon,
      speed: row.speed,
      at: row.time ? row.time.toISOString() : null,
      online: row.time ? nowMs - row.time.getTime() < FRESHNESS_MS : false,
    }));
  }
}
