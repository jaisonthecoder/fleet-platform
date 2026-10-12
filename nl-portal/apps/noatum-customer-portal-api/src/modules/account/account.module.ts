import { Module } from '@nestjs/common';

import { AccountController } from './account.controller';
import { AccountService } from './account.service';

/**
 * Customer self-service administration.
 *
 * The other half of customer onboarding: Noatum appoints the first Customer
 * Admin through the customers module, and from there the customer runs its own
 * people. Nothing here is reachable by a Noatum user acting on a customer's
 * behalf — that is what the customers module is for.
 */
@Module({
  controllers: [AccountController],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}
