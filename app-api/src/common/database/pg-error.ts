import { BadRequestException, ConflictException } from '@nestjs/common';

/** Unwraps the underlying postgres error (drizzle wraps it in DrizzleQueryError.cause). */
function pgError(
  error: unknown,
  depth = 0,
): { code?: string; constraint_name?: string } | undefined {
  if (!error || depth > 5) {
    return undefined;
  }
  const e = error as { code?: string; constraint_name?: string; cause?: unknown };
  if (typeof e.code === 'string') {
    return e;
  }
  return pgError(e.cause, depth + 1);
}

/**
 * Maps a Postgres constraint violation to the correct HTTP error at the system
 * boundary (never leak a raw DrizzleQueryError as a 500). Returns the original
 * error for anything not recognised so genuine failures still surface.
 */
export function toDbException(error: unknown): Error {
  const pg = pgError(error);
  const constraint = pg?.constraint_name ?? 'unknown';
  switch (pg?.code) {
    case '23505': // unique_violation
      return new ConflictException({
        title: 'Duplicate identifier',
        reasons: [`unique-violation:${constraint}`],
      });
    case '23P01': // exclusion_violation
      return new ConflictException({
        title: 'Overlapping assignment',
        reasons: [`exclusion-violation:${constraint}`],
      });
    case '23503': // foreign_key_violation — a referenced entity does not exist
      return new BadRequestException({
        title: 'Unknown referenced entity',
        reasons: [`fk-violation:${constraint}`],
      });
    case '23514': // check_violation
      return new BadRequestException({
        title: 'Constraint violation',
        reasons: [`check-violation:${constraint}`],
      });
    case '40001': // serialization_failure — concurrent transactions collided
    case '40P01': // deadlock_detected — concurrent contention on the same rows/index
      return new ConflictException({
        title: 'Concurrent update conflict',
        reasons: [`concurrency-conflict:${pg?.code}`, 'retryable'],
      });
    default:
      return error as Error;
  }
}
