import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { LoggerModule } from 'nestjs-pino';

import { CommonModule } from './common/common.module';
import { AuthGuard } from './common/guards/auth.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { FeatureGuard } from './common/guards/feature.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { loggerOptions } from './common/logging/logger.options';
import { configuration } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { AddressBookModule } from './modules/address-book/address-book.module';
import { AdminModule } from './modules/admin/admin.module';
import { ApiManagementModule } from './modules/api-management/api-management.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthzModule } from './modules/authz/authz.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { ClaimsModule } from './modules/claims/claims.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { FinanceModule } from './modules/finance/finance.module';
import { FeaturesModule } from './modules/features/features.module';
import { IdentityModule } from './modules/identity/identity.module';
import { IntegrationModule } from './integration/integration.module';
import { LocalAuthModule } from './modules/local-auth/local-auth.module';
import { LookupsModule } from './modules/lookups/lookups.module';
import { AccountModule } from './modules/account/account.module';
import { CustomersModule } from './modules/customers/customers.module';
import { OperatingModule } from './modules/operating/operating.module';
import { OrganisationsModule } from './modules/organisations/organisations.module';
import { NewsModule } from './modules/news/news.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { AiIntakeModule } from './modules/ai-intake/ai-intake.module';
import { PortsModule } from './modules/ports/ports.module';
import { ReferenceModule } from './modules/reference/reference.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      ignoreEnvFile: true,
      load: [configuration],
      validate: validateEnv,
    }),
    LoggerModule.forRoot(loggerOptions),
    TerminusModule,
    CommonModule,

    // Platform
    IdentityModule,
    LocalAuthModule.forRoot(),
    TenancyModule,
    AuthzModule,
    UsersModule,
    AuditModule,
    IntegrationModule,

    // Phase 1
    DashboardModule,
    // The customer's own administration: its people, its access, its setup.
    AccountModule,
    QuotesModule,
    AiIntakeModule,
    PortsModule,
    ReferenceModule,
    PricingModule,
    SettingsModule,
    TemplatesModule,
    AddressBookModule,
    NewsModule,

    // Phase 2
    ShipmentsModule,
    DocumentsModule,
    FinanceModule,

    // Phase 3
    BookingsModule,
    ClaimsModule,

    // Cross-cutting
    NotificationsModule,
    ReportsModule,
    AdminModule,
    FeaturesModule,
    LookupsModule,
    CustomersModule,
    OrganisationsModule,
    OperatingModule,
    ApiManagementModule,
  ],
  providers: [
    // Order matters: authenticate, then resolve the tenant, then check permissions.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    // After PermissionGuard: a caller is told what they lack before what is switched off.
    { provide: APP_GUARD, useClass: FeatureGuard },
  ],
})
export class AppModule {}
