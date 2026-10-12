import { randomUUID } from 'node:crypto';

import type { Params } from 'nestjs-pino';

/**
 * Structured logging. Every line carries the correlation id and the tenant, so a support
 * question about one customer can be answered without reading everyone else's traffic.
 *
 * Redaction is deny-by-default on the usual carriers of secrets and personal data.
 */
export const loggerOptions: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? 'info',
    genReqId: (req) => (req.headers['x-correlation-id'] as string | undefined) ?? randomUUID(),
    autoLogging: {
      ignore: (req) => req.url === '/api/health' || req.url === '/api/health/ready',
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-api-key"]',
        'res.headers["set-cookie"]',
        'req.body.password',
        'req.body.token',
        'req.body.tokenHash',
      ],
      censor: '[redacted]',
    },
    customProps: (req) => {
      const user = (req as { user?: { customerGroupId?: string | null; userId?: string } }).user;
      return {
        customerGroupId: user?.customerGroupId ?? null,
        userId: user?.userId ?? null,
      };
    },
    transport:
      process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'HH:MM:ss' } }
        : undefined,
  },
};
