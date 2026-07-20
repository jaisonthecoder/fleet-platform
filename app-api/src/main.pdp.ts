import './common/observability/instrumentation';
import helmet from '@fastify/helmet';
import { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { configureApp } from './common/bootstrap/configure-app';
import { appConfig } from './common/config/app.config';
import { PdpModule } from './pdp.module';

/** Boots the isolated policy decision deployable. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    PdpModule,
    new FastifyAdapter(),
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));

  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  await app.register(helmet);
  configureApp(app);

  await app.listen(config.pdpPort, '0.0.0.0');
}

void bootstrap();
