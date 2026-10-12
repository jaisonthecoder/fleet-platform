import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

/**
 * Platform module.
 *
 * User administration and invitations within a customer group.
 *
 * All customer data access goes through TenantRepository (provided globally by
 * CommonModule). Every controller endpoint carries @RequirePermission.
 */
@Module({
  imports: [],
  controllers: [UsersController],
  providers: [UsersRepository, UsersService],
  exports: [],
})
export class UsersModule {}
