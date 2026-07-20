/** DI token for the Drizzle database instance. */
export const DRIZZLE = Symbol('DRIZZLE');

/** DI token for the underlying postgres.js SQL client (lifecycle + health). */
export const PG_CLIENT = Symbol('PG_CLIENT');
