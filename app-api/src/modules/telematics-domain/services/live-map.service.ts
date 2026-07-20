import { Injectable } from '@nestjs/common';
import type { LivePositionDto } from '../../../contracts/telematics.contract';
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

  async getLive(vehicleId: string, actorRef = 'system'): Promise<LivePositionDto> {
    const latest = await this.repo.latestTelemetry(vehicleId);
    // D4: location-data access is always logged.
    await this.audit.record({
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
      at: at ? at.toISOString() : null,
      online,
    };
  }
}
