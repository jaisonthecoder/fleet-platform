import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../../common/database/database.module';
import { telemetry } from '../../../../common/database/schema';
import type { CanonicalPoint } from '../interfaces/telemetry-source.interface';

@Injectable()
export class TelemetryWriterService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  /**
   * Persists a batch of canonical points to the Timescale hypertable in a
   * single multi-row insert (one round trip). This is the dumb, fast pipe —
   * no business logic. (COPY is a Phase-1 throughput optimisation.)
   */
  async write(points: CanonicalPoint[]): Promise<number> {
    if (points.length === 0) {
      return 0;
    }
    await this.db.insert(telemetry).values(
      points.map((p) => ({
        time: new Date(p.recordedAt),
        vehicleId: p.vehicleId,
        deviceId: p.deviceId ?? null,
        lat: p.latitude,
        lon: p.longitude,
        speed: p.speed ?? null,
        ignition: p.ignition ?? null,
        odometer: p.odometer ?? null,
        fuelLevel: p.fuelLevel ?? null,
      })),
    );
    return points.length;
  }
}
