import { Module } from '@nestjs/common';

/**
 * Phase 1 module.
 *
 * Saved quote templates, private or shared within the group.
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
export class TemplatesModule {}
