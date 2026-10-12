import { Module } from '@nestjs/common';

/**
 * Phase 1 module.
 *
 * Customer address book, optionally linked to CW1 organisations.
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
export class AddressBookModule {}
