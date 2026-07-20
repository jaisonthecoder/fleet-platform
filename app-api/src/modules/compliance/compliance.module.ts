import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { PolicyCoreModule } from '../policy/policy-core.module';
import { ComplianceController } from './controllers/compliance.controller';
import { ComplianceRepository } from './repositories/compliance.repository';
import { ComplianceService } from './services/compliance.service';
import { EligibilityService } from './services/eligibility.service';

/**
 * Compliance + eligibility gate (M7 — built before booking). Imports the PDP
 * core (in-process PEP) for the driver-eligibility-gate rule and PlatformModule
 * for audit. The `EligibilityService` is the single truth every booking checks.
 */
@Module({
  imports: [PlatformModule, PolicyCoreModule],
  controllers: [ComplianceController],
  providers: [ComplianceRepository, EligibilityService, ComplianceService],
  exports: [EligibilityService, ComplianceService],
})
export class ComplianceModule {}
