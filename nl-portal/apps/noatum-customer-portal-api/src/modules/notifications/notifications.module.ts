import { Module } from '@nestjs/common';

/**
 * Cross-cutting module.
 *
 * Email and in-app notifications, and per-user preferences.
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
export class NotificationsModule {}
