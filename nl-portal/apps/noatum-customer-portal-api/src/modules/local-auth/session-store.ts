import { createHash } from 'node:crypto';

import { Store, type SessionData } from 'express-session';

import type { LocalAuthRepository, SessionAssurance } from './local-auth.repository';

declare module 'express-session' {
  interface SessionData {
    /**
     * Set only once a password (and, when enrolled, a second factor) has been accepted.
     * Permissions are deliberately absent: they are resolved per request, so a revoked
     * grant cannot survive inside a cookie.
     */
    local?: {
      userId: string;
      securityVersion: number;
      assurance: SessionAssurance;
      /** Fixed at sign-in. Activity extends the idle clock, never this one. */
      absoluteExpiresAt: string;
    };
    csrfToken?: string;
  }
}

/** The cookie value never reaches the database; only this digest does. */
export function hashSessionId(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex');
}

/**
 * express-session's Store, backed by the local_session table.
 *
 * Two departures from a stock store, both deliberate:
 *
 *  - only the digest of the session id is stored, so a database reader cannot replay
 *    a live session;
 *  - an anonymous session is never written. Sessions begin at sign-in, which keeps
 *    unauthenticated traffic from filling the table.
 */
export class PostgresSessionStore extends Store {
  constructor(
    private readonly repository: LocalAuthRepository,
    private readonly idleMs: number,
    private readonly absoluteMs: number,
  ) {
    super();
  }

  get(
    sessionId: string,
    callback: (error: unknown, session?: SessionData | null) => void,
  ): void {
    this.repository
      .loadSession(hashSessionId(sessionId))
      .then((stored) => {
        if (!stored) return callback(null, null);

        const data = stored.data as {
          cookie?: Record<string, unknown>;
          csrfToken?: string;
          securityVersion?: number;
        };

        // A row we cannot pin to a credential version is one we cannot trust to end
        // when the password changes, so it does not come back to life.
        if (typeof data.securityVersion !== 'number') return callback(null, null);

        callback(null, {
          cookie: this.reviveCookie(data.cookie, stored.idleExpiresAt),
          csrfToken: data.csrfToken,
          local: {
            userId: stored.userId,
            securityVersion: data.securityVersion,
            assurance: stored.assurance,
            absoluteExpiresAt: stored.absoluteExpiresAt.toISOString(),
          },
        } as SessionData);
      })
      .catch((error: unknown) => callback(error));
  }

  set(sessionId: string, session: SessionData, callback?: (error?: unknown) => void): void {
    const local = session.local;
    if (!local?.userId) {
      // Anonymous: nothing worth persisting, and writing it would create a row that
      // no sign-in ever claims.
      callback?.();
      return;
    }

    const now = Date.now();
    const absoluteExpiresAt = local.absoluteExpiresAt
      ? new Date(local.absoluteExpiresAt)
      : new Date(now + this.absoluteMs);

    this.repository
      .saveSession({
        tokenHash: hashSessionId(sessionId),
        userId: local.userId,
        assurance: local.assurance,
        securityVersion: local.securityVersion,
        data: {
          cookie: this.serialiseCookie(session),
          csrfToken: session.csrfToken,
          securityVersion: local.securityVersion,
        },
        idleExpiresAt: new Date(now + this.idleMs),
        absoluteExpiresAt,
      })
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error));
  }

  override touch(sessionId: string, _session: SessionData, callback?: (error?: unknown) => void): void {
    this.repository
      .touchSession(hashSessionId(sessionId), new Date(Date.now() + this.idleMs))
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error));
  }

  destroy(sessionId: string, callback?: (error?: unknown) => void): void {
    this.repository
      .destroySession(hashSessionId(sessionId))
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error));
  }

  /** Explicit allow-list: whatever else a middleware hangs on the cookie stays out. */
  private serialiseCookie(session: SessionData): Record<string, unknown> {
    const cookie = session.cookie;
    return {
      originalMaxAge: cookie?.originalMaxAge ?? this.idleMs,
      expires: cookie?.expires ?? undefined,
      httpOnly: cookie?.httpOnly ?? true,
      path: cookie?.path ?? '/',
      sameSite: cookie?.sameSite ?? 'lax',
      secure: cookie?.secure ?? false,
    };
  }

  /**
   * JSON has no date type, so `expires` comes back as a string. express-session compares
   * it with a Date, and a string silently makes every session look unexpired.
   */
  private reviveCookie(
    stored: Record<string, unknown> | undefined,
    idleExpiresAt: Date,
  ): SessionData['cookie'] {
    const expires = stored?.['expires'];
    return {
      originalMaxAge: typeof stored?.['originalMaxAge'] === 'number' ? stored['originalMaxAge'] : this.idleMs,
      expires: typeof expires === 'string' || expires instanceof Date ? new Date(expires) : idleExpiresAt,
      httpOnly: stored?.['httpOnly'] !== false,
      path: typeof stored?.['path'] === 'string' ? stored['path'] : '/',
      sameSite: (stored?.['sameSite'] ?? 'lax') as SessionData['cookie']['sameSite'],
      secure: stored?.['secure'] === true,
    } as SessionData['cookie'];
  }
}
