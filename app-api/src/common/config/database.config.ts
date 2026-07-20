import { registerAs } from '@nestjs/config';
import { validateEnv } from './config.schema';

/** PostgreSQL + TimescaleDB connection configuration for Drizzle. */
export const databaseConfig = registerAs('database', () => {
  const env = validateEnv(process.env);
  return {
    url: env.DATABASE_URL,
    ssl: env.DATABASE_SSL,
    maxConnections: env.DATABASE_MAX_CONNECTIONS,
  };
});
