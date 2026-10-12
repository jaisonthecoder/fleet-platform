import { Module } from '@nestjs/common';

/**
 * Platform module.
 *
 * Roles, permissions and the role-to-permission assignment surface.
 *
 * All customer data access goes through TenantRepository (provided globally by
 * CommonModule). Every controller endpoint carries @RequirePermission.
 */
@Module({
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
})
export class AuthzModule {}
