import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { Public } from '../../../common/auth/auth.decorators';
import { HealthService, HealthStatus } from '../services/health.service';

@Public()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Exposes API liveness for container health probes. */
  @Get()
  getHealth(): HealthStatus {
    return this.healthService.getStatus('api');
  }
}
