import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AuthModule } from './common/auth/auth.module';
import { CoreConfigModule } from './common/config/config.module';
import { DatabaseModule } from './common/database/database.module';
import { EscalationModule } from './common/escalation/escalation.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { LoggingModule } from './common/logging/logging.module';
import { MessagingModule } from './common/messaging/messaging.module';
import { NotificationsModule } from './common/notifications/notifications.module';
import { RedisModule } from './common/redis/redis.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { ConfigModule } from './modules/config/config.module';
import { DashboardsModule } from './modules/dashboards/dashboards.module';
import { EntitlementsModule } from './modules/entitlements/entitlements.module';
import { FinesModule } from './modules/fines/fines.module';
import { HandoverModule } from './modules/handover/handover.module';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { MigrationModule } from './modules/migration/migration.module';
import { OrganizationAdministrationModule } from './modules/organization-administration/organization-administration.module';
import { PlatformModule } from './modules/platform/platform.module';
import { PolicyAdministrationModule } from './modules/policy-administration/policy-administration.module';
import { TelematicsDomainModule } from './modules/telematics-domain/telematics-domain.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { WorkflowModule } from './modules/workflow/workflow.module';

@Module({
  imports: [
    CoreConfigModule,
    LoggingModule,
    DatabaseModule,
    RedisModule,
    EscalationModule,
    MessagingModule,
    NotificationsModule,
    PlatformModule,
    OrganizationAdministrationModule,
    ConfigModule,
    IdentityModule,
    AuthModule,
    PolicyAdministrationModule,
    WorkflowModule,
    VehiclesModule,
    MigrationModule,
    TelematicsDomainModule,
    ComplianceModule,
    BookingsModule,
    HandoverModule,
    EntitlementsModule,
    FinesModule,
    DashboardsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class AppModule {}
