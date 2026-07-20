import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  type HealthCheckResult,
} from '@nestjs/terminus';
import { DatabaseHealthIndicator } from '../services/database.health';
import { RedisHealthIndicator } from '../services/redis.health';
import { Public } from '../../../common/auth/auth.decorators';

@Public()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class ReadinessController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  /** Deep readiness probe: verifies database and Redis connectivity. */
  @Get('ready')
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.database.isHealthy('database'),
      () => this.redis.isHealthy('redis'),
    ]);
  }
}
