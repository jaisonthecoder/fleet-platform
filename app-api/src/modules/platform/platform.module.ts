import { Module } from '@nestjs/common';
import { AuditController } from './controllers/audit.controller';
import { IdentityController } from './controllers/identity.controller';
import { HCM_SOURCE } from './internal/hcm';
import { PlatformRepository } from './repositories/platform.repository';
import { AccessService } from './services/access.service';
import { AuditService } from './services/audit.service';
import { DelegationService } from './services/delegation.service';
import { HcmSyncService, StubHcmSource } from './services/hcm-sync.service';
import { HierarchyService } from './services/hierarchy.service';
import { SodGuardService } from './services/sod-guard.service';
import { ScopeAuthorizationService } from './services/scope-authorization.service';

/**
 * Platform foundation (M1): identity/authorization primitives — hierarchy,
 * RBAC access, delegation, the SoD guard, the tamper-evident audit service, and
 * HCM person sync + freshness. HCM_SOURCE is the stub adapter in dev/test; the
 * Oracle Fusion adapter replaces it when configured.
 */
@Module({
  controllers: [IdentityController, AuditController],
  providers: [
    PlatformRepository,
    AccessService,
    HierarchyService,
    DelegationService,
    SodGuardService,
    ScopeAuthorizationService,
    AuditService,
    HcmSyncService,
    StubHcmSource,
    { provide: HCM_SOURCE, useExisting: StubHcmSource },
  ],
  exports: [SodGuardService, ScopeAuthorizationService, AuditService, AccessService, HierarchyService, HcmSyncService],
})
export class PlatformModule {}
