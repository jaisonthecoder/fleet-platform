import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { LookupAdminController } from './controllers/lookup-admin.controller';
import { LookupController } from './controllers/lookup.controller';
import { LookupRepository } from './repositories/lookup.repository';
import { LookupCacheService } from './services/lookup-cache.service';
import { LookupService } from './services/lookup.service';
import { LookupUsageService } from './services/lookup-usage.service';

/**
 * Configuration module (ADR-009): the lookup / reference-data engine that backs
 * every dropdown — bilingual, code-keyed, parent-child, Redis-cached with
 * invalidation. Imports PlatformModule for the audit service.
 */
@Module({
  imports: [PlatformModule],
  controllers: [LookupController, LookupAdminController],
  providers: [LookupRepository, LookupCacheService, LookupService, LookupUsageService],
  exports: [LookupService],
})
export class ConfigModule {}
