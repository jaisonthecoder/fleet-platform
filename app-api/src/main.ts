import './common/observability/instrumentation';
import helmet from '@fastify/helmet';
import { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './common/bootstrap/configure-app';
import { appConfig } from './common/config/app.config';
import { openapiConfig } from './common/config/openapi.config';
import { setupSwagger } from './common/openapi/swagger';

/** Boots the user-facing API deployable. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));

  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  await app.register(helmet, {
    contentSecurityPolicy: config.isProduction ? undefined : false,
  });
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });
  configureApp(app);
  setupSwagger(
    app,
    app.get<ConfigType<typeof openapiConfig>>(openapiConfig.KEY),
  );

  await app.listen(config.apiPort, '0.0.0.0');
}

void bootstrap();
