import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.setGlobalPrefix('api');

  // A fixed hop count, never `true`: trusting every hop lets a caller spoof its own
  // address through X-Forwarded-For and walk past the per-address rate limiter.
  const hops = config.get<number>('trustProxyHops') ?? 0;
  if (hops > 0) {
    (app.getHttpAdapter().getInstance() as { set: (key: string, value: unknown) => void }).set(
      'trust proxy',
      hops,
    );
  }

  app.enableVersioning();
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({
    origin: config.get<string[]>('cors.origins'),
    credentials: true,
  });

  // Swagger is for dev and test only; UAT and prod expose the JSON to APIM instead.
  if (config.get<string>('env') !== 'production') {
    const doc = new DocumentBuilder()
      .setTitle('Noatum Customer Platform API')
      .setDescription('Customer portal REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc));
  }

  // Let in-flight requests and jobs finish on SIGTERM.
  app.enableShutdownHooks();

  // Loud on purpose: anyone who can reach a site running this can act as one of the
  // seeded demonstration accounts without a credential.
  if (config.get<boolean>('identity.devAuthEnabled') && config.get<string>('env') === 'production') {
    app.get(Logger).warn('Header sign-in is ON. This deployment must not hold real data.');
  }

  await app.listen(config.get<number>('port') ?? 43000);
}

void bootstrap();
