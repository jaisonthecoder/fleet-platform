import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { identityConfig } from '../config/identity.config';

/** The jose module type (loaded lazily via dynamic import — ESM-only in v6). */
type JoseModule = typeof import('jose');
/** The key/JWKS resolver argument accepted by `jose.jwtVerify` (remote or local set). */
type KeySet = Parameters<JoseModule['jwtVerify']>[1];

/** Minimal claims extracted from a verified Entra token. */
export interface VerifiedClaims {
  oid: string;
  email: string | null;
  name: string | null;
}

/**
 * Verifies Microsoft Entra (OIDC v2) access tokens against the tenant JWKS —
 * signature, issuer, audience and expiry — using `jose`. jose 6 is ESM-only, so
 * it is loaded via a cached dynamic `import()` (the SWC build preserves native
 * dynamic import; jest transforms jose to CJS). The verification core is
 * exposed via {@link verifyWith} so it is unit-testable against a local JWKS
 * without a live tenant.
 */
@Injectable()
export class JwtVerifier {
  private josePromise?: Promise<JoseModule>;
  private keySet?: KeySet;

  constructor(
    @Inject(identityConfig.KEY)
    private readonly config: ConfigType<typeof identityConfig>,
  ) {}

  private loadJose(): Promise<JoseModule> {
    this.josePromise ??= import('jose');
    return this.josePromise;
  }

  /** Verifies a bearer token against the configured Entra tenant JWKS. */
  async verify(token: string): Promise<VerifiedClaims> {
    if (!this.config.entraConfigured || !this.config.jwksUri) {
      throw new UnauthorizedException({
        title: 'Authentication not configured',
        reasons: ['entra-not-configured'],
      });
    }
    const jose = await this.loadJose();
    this.keySet ??= jose.createRemoteJWKSet(new URL(this.config.jwksUri));
    return this.verifyWith(token, this.keySet);
  }

  /** Verifies a token against a provided key set (issuer/audience/expiry/signature). */
  async verifyWith(token: string, keySet: KeySet): Promise<VerifiedClaims> {
    const jose = await this.loadJose();
    let payload: Record<string, unknown>;
    try {
      const result = await jose.jwtVerify(token, keySet, {
        issuer: this.config.issuer,
        audience: this.config.apiAudience ?? this.config.apiClientId,
        algorithms: ['RS256'],
      });
      payload = result.payload as Record<string, unknown>;
    } catch {
      throw new UnauthorizedException({
        title: 'Invalid token',
        reasons: ['token-verification-failed'],
      });
    }
    const oid =
      typeof payload.oid === 'string'
        ? payload.oid
        : typeof payload.sub === 'string'
          ? payload.sub
          : null;
    if (!oid) {
      throw new UnauthorizedException({
        title: 'Invalid token',
        reasons: ['token-missing-subject'],
      });
    }
    const email =
      (typeof payload.preferred_username === 'string'
        ? payload.preferred_username
        : typeof payload.email === 'string'
          ? payload.email
          : null) ?? null;
    const name = typeof payload.name === 'string' ? payload.name : null;
    return { oid, email, name };
  }
}
