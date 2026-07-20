import { Global, Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { LoggerModule } from 'nestjs-pino';
import type { IncomingMessage } from 'node:http';
import { loggingConfig } from '../config/logging.config';

/**
 * Global structured-logging module (pino). Emits JSON in every environment,
 * optionally pretty-printed locally, with a per-request correlation id and
 * redaction of sensitive headers.
 */
@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [loggingConfig.KEY],
      /** Builds pino-http options from validated logging config. */
      useFactory: (config: ConfigType<typeof loggingConfig>) => ({
        pinoHttp: {
          level: config.level,
          name: config.serviceName,
          genReqId: (req: IncomingMessage): string => {
            const header = req.headers['x-correlation-id'];
            return (Array.isArray(header) ? header[0] : header) ?? randomUUID();
          },
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
            ],
            remove: true,
          },
          transport: config.pretty
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        },
      }),
    }),
  ],
})
export class LoggingModule {}
