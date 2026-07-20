import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { IdentityModule } from '../../modules/identity/identity.module';
import { PlatformModule } from '../../modules/platform/platform.module';
import { AuthGuard } from './auth.guard';
import { JwtVerifier } from './jwt-verifier';
import { RolesGuard } from './roles.guard';

/**
 * Global authentication + RBAC. Registers the {@link AuthGuard} (Entra JWT /
 * dev-login) and then the {@link RolesGuard} as application-wide guards — in
 * that order, so the principal is set before roles are checked. Imports the
 * platform + identity modules for role loading and JIT provisioning.
 */
@Global()
@Module({
  imports: [PlatformModule, IdentityModule],
  providers: [
    JwtVerifier,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtVerifier],
})
export class AuthModule {}
