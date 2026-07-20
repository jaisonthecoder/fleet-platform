import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './controllers/health.controller';
import { ReadinessController } from './controllers/readiness.controller';
import { DatabaseHealthIndicator } from './services/database.health';
import { HealthService } from './services/health.service';
import { RedisHealthIndicator } from './services/redis.health';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController, ReadinessController],
  providers: [HealthService, DatabaseHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
