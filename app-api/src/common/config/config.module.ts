import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configurations } from './index';
import { validateEnv } from './config.schema';

const nodeEnv = process.env.NODE_ENV ?? 'local';

/**
 * Loads, validates and exposes environment configuration process-wide.
 * Env file precedence: `.env.<NODE_ENV>` > `.env.local` > `.env`.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: [`.env.${nodeEnv}`, '.env.local', '.env'],
      load: configurations,
      validate: validateEnv,
    }),
  ],
})
export class CoreConfigModule {}
