import { Global, Module, type MiddlewareConsumer, type NestModule, RequestMethod } from '@nestjs/common';

import { AnalyticsService } from './analytics/analytics.service';
import { FeatureSwitchService } from './features/feature-switch.service';
import { HealthController } from './health.controller';
import { PrismaService } from './tenancy/prisma.service';
import { RateLimiterService } from './rate-limit/rate-limiter.service';
import { SettingsService } from './settings/settings.service';
import { TenantContext } from './tenancy/tenant-context';
import { TenantRepository } from './tenancy/tenant.repository';
import { TenantContextMiddleware } from './tenancy/tenant-context.middleware';

/**
 * Cross-cutting infrastructure. Global so feature modules get TenantRepository without
 * re-importing it everywhere - which also means there is no excuse for reaching past it
 * to PrismaService.
 *
 * There is deliberately no audit interceptor: an interceptor runs after the response and
 * cannot join the business transaction, so a write could commit with its audit row
 * missing. Services write `auditEvent` inside the same `tx` instead.
 */
@Global()
@Module({
  controllers: [HealthController],
  providers: [PrismaService, TenantContext, TenantRepository, AnalyticsService, FeatureSwitchService, SettingsService, RateLimiterService],
  exports: [PrismaService, TenantContext, TenantRepository, AnalyticsService, FeatureSwitchService, SettingsService, RateLimiterService],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
