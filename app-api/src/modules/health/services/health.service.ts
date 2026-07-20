import { Injectable } from '@nestjs/common';

export interface HealthStatus {
  status: 'ok';
  service: string;
  timestamp: string;
}

@Injectable()
export class HealthService {
  /** Returns a lightweight liveness response for the active deployable. */
  getStatus(service: string): HealthStatus {
    return { status: 'ok', service, timestamp: new Date().toISOString() };
  }
}
