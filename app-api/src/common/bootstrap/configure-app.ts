import { type INestApplication, VersioningType } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import type { FastifyInstance } from 'fastify';
import { appConfig } from '../config/app.config';

/**
 * Applies routing conventions shared by the runtime entrypoints and the e2e
 * harness: global `/api` prefix (health probes excluded) and URI versioning
 * (`/api/v1/...`). Keeping this in one place guarantees tests and production
 * resolve identical routes.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  const fastify = app.getHttpAdapter().getInstance() as FastifyInstance;
  for (const contentType of ['image/jpeg', 'image/png']) {
    if (!fastify.hasContentTypeParser(contentType)) {
      fastify.addContentTypeParser(contentType, { parseAs: 'buffer', bodyLimit: 10_485_760 }, (_request, body, done) => done(null, body));
    }
  }
  app.setGlobalPrefix(config.globalPrefix, {
    exclude: ['health', 'health/ready'],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();
}
