import { registerAs } from '@nestjs/config';
import { validateEnv } from './config.schema';

/** OpenAPI/Swagger document configuration (served in non-production). */
export const openapiConfig = registerAs('openapi', () => {
  const env = validateEnv(process.env);
  return {
    enabled: env.SWAGGER_ENABLED && env.NODE_ENV !== 'production',
    path: env.SWAGGER_PATH,
    title: 'Fleet Management Platform API',
    description:
      'Group-wide fleet inventory, booking, entitlement, compliance and accountability API.',
    version: 'v1',
  };
});
