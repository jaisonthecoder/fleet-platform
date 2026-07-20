import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { DevAuthController } from './controllers/dev-auth.controller';
import { UserAdminController } from './controllers/user-admin.controller';
import { IdentityRepository } from './repositories/identity.repository';
import { AccessReviewService } from './services/access-review.service';
import { UserAdminService } from './services/user-admin.service';
import { UserProvisioningService } from './services/user-provisioning.service';

/**
 * Identity / access management (1A₂): JIT SSO provisioning, admin role
 * assignment with SoD-at-assignment, and access-review export. Imports
 * PlatformModule for the SoD guard + audit service. Admin endpoints are
 * RBAC-gated (System Admin) by the global roles guard; the dev-login user list
 * is public but disabled outside lower environments.
 */
@Module({
  imports: [PlatformModule],
  controllers: [UserAdminController, DevAuthController],
  providers: [
    IdentityRepository,
    UserProvisioningService,
    UserAdminService,
    AccessReviewService,
  ],
  exports: [UserProvisioningService, UserAdminService, AccessReviewService],
})
export class IdentityModule {}
