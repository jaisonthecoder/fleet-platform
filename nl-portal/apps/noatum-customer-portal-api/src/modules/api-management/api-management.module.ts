import { Module } from '@nestjs/common';

/**
 * Cross-cutting module.
 *
 * Customer-facing API keys and APIM subscription surface.
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
export class ApiManagementModule {}
