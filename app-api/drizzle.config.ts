import 'dotenv/config';
import { type Config, defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit configuration for schema generation and migrations.
 * Business tables are added under `src/common/database/schema.ts` in later
 * phases; running `pnpm db:generate` then emits SQL into `drizzle/migrations`.
 */
const config: Config = defineConfig({
  dialect: 'postgresql',
  schema: './src/common/database/schema.ts',
  out: './drizzle/migrations',
  strict: true,
  verbose: true,
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgres://fleet:fleet@localhost:5432/fleet',
  },
});

export default config;
