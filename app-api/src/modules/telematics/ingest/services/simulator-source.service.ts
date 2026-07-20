import { Injectable } from '@nestjs/common';
import {
  CanonicalPoint,
  TelemetrySource,
} from '../interfaces/telemetry-source.interface';

@Injectable()
export class SimulatorSourceService implements TelemetrySource {
  private timer?: NodeJS.Timeout;
  private odometer = 100_000;

  /** Starts a deterministic simulator heartbeat for the ingest runtime. */
  start(onBatch: (points: CanonicalPoint[]) => void): void {
    if (this.timer) return;
    const emit = (): void => {
      this.odometer += 1;
      onBatch([
        {
          vehicleId: '11111111-1111-4111-8111-111111111111',
          deviceId: 'sim-device-001',
          latitude: 24.5018,
          longitude: 54.3659,
          speed: 42,
          ignition: true,
          odometer: this.odometer,
          fuelLevel: 0.75,
          recordedAt: new Date().toISOString(),
        },
      ]);
    };
    emit();
    this.timer = setInterval(emit, 30000);
  }

  /** Stops the simulator heartbeat and releases its timer. */
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
