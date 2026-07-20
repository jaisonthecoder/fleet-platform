import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import {
  HealthService,
  HealthStatus,
} from '../../health/services/health.service';

@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class PdpHealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Exposes PDP liveness for container health probes. */
  @Get()
  getHealth(): HealthStatus {
    return this.healthService.getStatus('pdp');
  }
}
