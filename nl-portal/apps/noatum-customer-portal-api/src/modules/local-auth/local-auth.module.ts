import {
  Global,
  Module,
  RequestMethod,
  type DynamicModule,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import session from 'express-session';

import { LocalSessionResolver } from '../../common/guards/auth.guard';
import { IntegrationModule } from '../../integration/integration.module';

import { LocalAuthController } from './local-auth.controller';
import { LocalAuthRepository } from './local-auth.repository';
import { LocalAuthService } from './local-auth.service';
import { LocalSessionIdentityResolver } from './local-session.resolver';
import { MfaService } from './mfa.service';
import { PasswordService } from './password.service';
import { PostgresSessionStore } from './session-store';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Portal-managed password sign-in for invited customers and the bootstrap
 * administrator (ADR-006).
 *
 * Plug and play on purpose. With LOCAL_AUTH_ENABLED unset, no controller is mounted,
 * no middleware runs and no secret is required; all that remains is a resolver that
 * answers null. Deleting this folder and its single line in AppModule removes the
 * whole approach. Staff Entra SSO passes through none of it either way.
 */
@Global()
@Module({})
export class LocalAuthModule implements NestModule {
  constructor(
    private readonly config: ConfigService,
    private readonly repository: LocalAuthRepository,
  ) {}

  static forRoot(): DynamicModule {
    // Read before ConfigService exists: this decides what is built, not how it behaves.
    const enabled = process.env.LOCAL_AUTH_ENABLED === 'true';

    return {
      module: LocalAuthModule,
      imports: enabled ? [IntegrationModule] : [],
      controllers: enabled ? [LocalAuthController] : [],
      providers: [
        LocalAuthRepository,
        { provide: LocalSessionResolver, useClass: LocalSessionIdentityResolver },
        ...(enabled ? [PasswordService, MfaService, LocalAuthService] : []),
      ],
      exports: [LocalSessionResolver, LocalAuthRepository, ...(enabled ? [LocalAuthService] : [])],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    if (!this.config.get<boolean>('localAuth.enabled')) return;

    const idleMs = this.config.getOrThrow<number>('localAuth.idleMinutes') * 60_000;
    const absoluteMs = this.config.getOrThrow<number>('localAuth.absoluteHours') * 3_600_000;

    const sessions = session({
      name: this.config.getOrThrow<string>('localAuth.cookieName'),
      secret: this.config.getOrThrow<string>('localAuth.sessionSecret'),
      // saveUninitialized false is what keeps unauthenticated traffic out of the table;
      // rolling keeps the cookie's life in step with the idle clock the store enforces.
      resave: false,
      saveUninitialized: false,
      rolling: true,
      store: new PostgresSessionStore(this.repository, idleMs, absoluteMs),
      cookie: {
        httpOnly: true,
        secure: this.config.getOrThrow<boolean>('localAuth.cookieSecure'),
        // Lax already stops a cross-site form post carrying this cookie. It only needs
        // to become 'none' if the SPA is ever served from a different site to the API.
        sameSite: this.config.getOrThrow<'lax' | 'strict' | 'none'>('localAuth.cookieSameSite'),
        path: '/',
        maxAge: idleMs,
      },
    });

    consumer
      .apply(sessions, csrfForSessionRequests)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}

/**
 * Double-submit check, applied only where a request actually carries a portal session.
 * Staff requests authenticate with a bearer token and never reach the comparison.
 */
function csrfForSessionRequests(
  request: {
    method: string;
    path?: string;
    session?: { local?: unknown; csrfToken?: string };
    headers: Record<string, unknown>;
  },
  response: { status: (code: number) => { json: (body: unknown) => void } },
  next: (error?: unknown) => void,
): void {
  if (!request.session?.local || SAFE_METHODS.has(request.method)) {
    next();
    return;
  }

  // Signing out must work even when the token is stale, or a half-broken session
  // becomes one nobody can end.
  if (request.path?.endsWith('/auth/local/sign-out')) {
    next();
    return;
  }

  const expected = request.session.csrfToken;
  const presented = request.headers['x-csrf-token'];
  if (expected && typeof presented === 'string' && presented === expected) {
    next();
    return;
  }

  response.status(403).json({ statusCode: 403, message: 'Missing or invalid CSRF token.' });
}
