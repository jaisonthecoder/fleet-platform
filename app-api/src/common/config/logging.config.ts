import { registerAs } from '@nestjs/config';
import { validateEnv } from './config.schema';

/** Structured logging (pino) configuration. */
export const loggingConfig = registerAs('logging', () => {
  const env = validateEnv(process.env);
  return {
    level: env.LOG_LEVEL,
    pretty: env.LOG_PRETTY,
    serviceName: env.OTEL_SERVICE_NAME,
  };
});
