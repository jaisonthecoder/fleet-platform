import { Module } from '@nestjs/common';

import { UserResolver } from '../../common/guards/auth.guard';

import { DevIdentityController } from './dev-identity.controller';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';

/**
 * Platform module.
 *
 * Validates the Entra token subject against our own user table and serves /me.
 *
 * Exports UserResolver so AuthGuard can resolve a token to a user without the common
 * layer importing a feature module.
 */
@Module({
  controllers: [IdentityController, DevIdentityController],
  providers: [IdentityService, { provide: UserResolver, useExisting: IdentityService }],
  exports: [UserResolver, IdentityService],
})
export class IdentityModule {}
