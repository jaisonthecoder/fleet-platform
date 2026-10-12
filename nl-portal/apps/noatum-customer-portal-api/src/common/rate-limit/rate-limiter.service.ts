import { Injectable } from '@nestjs/common';

import { PrismaService } from '../tenancy/prisma.service';

export interface RateLimitState {
  consumedPoints: number;
  expiresAt: Date;
}

export interface RateLimitBudget {
  /** Attempts allowed inside the window. */
  points: number;
  /** Window length in seconds. */
  duration: number;
  /**
   * Seconds to stay locked out once the budget is spent. Zero gives a rolling
   * window, which is what an account budget wants so a third party cannot lock
   * somebody out by guessing at their address.
   */
  blockDuration?: number;
}

/**
 * Sign-in rate limiting, counted in PostgreSQL rather than in one process.
 *
 * `RateLimiterMemory` counts per Node process, so two instances behind a load
 * balancer give an attacker two budgets. Nothing reports that: the application
 * looks healthy while the limit quietly doubles.
 *
 * Reads and writes go through `app.rate_limit_*` SECURITY DEFINER functions
 * because this runs before authentication, where there is no tenant context and
 * TenantRepository cannot be used. The runtime role holds no direct privilege on
 * the table.
 *
 * The three methods mirror `rate-limiter-flexible` deliberately, so call sites
 * read the same and the library can be reinstated by swapping the injection.
 */
@Injectable()
export class RateLimiterService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Count one attempt. Returns the running state, or throws when the budget is
   * spent — matching the library, whose `consume` rejects.
   */
  async consume(key: string, budget: RateLimitBudget): Promise<RateLimitState> {
    const rows = await this.prisma.$queryRaw<Array<{ consumed_points: number; window_expires_at: Date }>>`
      SELECT consumed_points, window_expires_at
        FROM app.rate_limit_consume(
          ${key},
          ${budget.points},
          ${budget.duration},
          ${budget.blockDuration ?? 0}
        )`;

    const row = rows[0];
    const state: RateLimitState = {
      consumedPoints: row?.consumed_points ?? 1,
      expiresAt: row?.window_expires_at ?? new Date(Date.now() + budget.duration * 1000),
    };

    if (state.consumedPoints > budget.points) {
      throw new RateLimitExceeded(state);
    }
    return state;
  }

  /** Current state without spending an attempt. Null when nothing is recorded. */
  async get(key: string): Promise<RateLimitState | null> {
    const rows = await this.prisma.$queryRaw<Array<{ consumed_points: number; window_expires_at: Date }>>`
      SELECT consumed_points, window_expires_at FROM app.rate_limit_get(${key})`;

    const row = rows[0];
    return row ? { consumedPoints: row.consumed_points, expiresAt: row.window_expires_at } : null;
  }

  /** Clear a budget, so one good sign-in wipes the failures before it. */
  async delete(key: string): Promise<void> {
    // Returns void, which $queryRaw cannot deserialize.
    await this.prisma.$executeRaw`SELECT app.rate_limit_delete(${key})`;
  }
}

export class RateLimitExceeded extends Error {
  constructor(readonly state: RateLimitState) {
    super('Rate limit exceeded');
    this.name = 'RateLimitExceeded';
  }

  /** Whole seconds until the budget frees up, for a Retry-After header. */
  get retryAfterSeconds(): number {
    return Math.max(1, Math.ceil((this.state.expiresAt.getTime() - Date.now()) / 1000));
  }
}
