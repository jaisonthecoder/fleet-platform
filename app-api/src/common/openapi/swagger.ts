import { Logger, type INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { openapiConfig } from '../config/openapi.config';

/**
 * Mounts the OpenAPI/Swagger UI when enabled (non-production only). Declares
 * Entra bearer auth so the "Authorize" button issues authenticated requests.
 *
 * Swagger UI is a developer convenience — it must never take the API down. If
 * mounting fails (e.g. the optional `@fastify/static` package needed to serve
 * the UI assets is not installed), we log and continue booting the API.
 */
export function setupSwagger(
  app: INestApplication,
  config: ConfigType<typeof openapiConfig>,
): void {
  if (!config.enabled) {
    return;
  }

  const document = new DocumentBuilder()
    .setTitle(config.title)
    .setDescription(config.description)
    .setVersion(config.version)
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'entra',
    )
    .build();

  try {
    SwaggerModule.setup(
      config.path,
      app,
      SwaggerModule.createDocument(app, document),
      { swaggerOptions: { persistAuthorization: true } },
    );
  } catch (error) {
    new Logger('Swagger').warn(
      `Swagger UI could not be mounted at "/${config.path}" — continuing without it. ` +
        `Ensure "@fastify/static" is installed to enable the docs UI. ` +
        `(${error instanceof Error ? error.message : String(error)})`,
    );
  }
}
