import {
  Global,
  Module,
  type OnApplicationShutdown,
  Inject,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import { databaseConfig } from '../config/database.config';
import { DRIZZLE, PG_CLIENT } from './database.constants';
import * as schema from './schema';

/** Fully-typed Drizzle database bound to the platform schema. */
export type DrizzleDatabase = PostgresJsDatabase<typeof schema>;

/**
 * Global database module. Provides a lazily-connecting postgres.js client and
 * a Drizzle instance; no connection is opened until the first query, so the
 * app boots (and tests run) without a live database.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_CLIENT,
      inject: [databaseConfig.KEY],
      /** Creates the postgres.js client from validated database config. */
      useFactory: (config: ConfigType<typeof databaseConfig>): Sql =>
        postgres(config.url, {
          max: config.maxConnections,
          ssl: config.ssl ? 'require' : false,
          prepare: false,
        }),
    },
    {
      provide: DRIZZLE,
      inject: [PG_CLIENT],
      /** Wraps the SQL client in a typed Drizzle instance. */
      useFactory: (client: Sql): DrizzleDatabase =>
        drizzle(client, { schema }),
    },
  ],
  exports: [DRIZZLE, PG_CLIENT],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_CLIENT) private readonly client: Sql) {}

  /** Closes the pooled database connections on graceful shutdown. */
  async onApplicationShutdown(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}
