export interface CanonicalPoint {
  vehicleId: string;
  deviceId?: string;
  latitude: number;
  longitude: number;
  speed?: number;
  ignition?: boolean;
  odometer?: number;
  fuelLevel?: number;
  recordedAt: string;
}

export interface TelemetrySource {
  start(onBatch: (points: CanonicalPoint[]) => void): void;
  stop(): void;
}
