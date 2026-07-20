import { appConfig } from './app.config';
import { databaseConfig } from './database.config';
import { identityConfig } from './identity.config';
import { loggingConfig } from './logging.config';
import { messagingConfig } from './messaging.config';
import { observabilityConfig } from './observability.config';
import { openapiConfig } from './openapi.config';
import { redisConfig } from './redis.config';
import { storageConfig } from './storage.config';
import { telematicsConfig } from './telematics.config';

export { validateEnv, envSchema, NODE_ENVS } from './config.schema';
export type { Env } from './config.schema';
export { appConfig } from './app.config';
export { databaseConfig } from './database.config';
export { redisConfig } from './redis.config';
export { messagingConfig } from './messaging.config';
export { storageConfig } from './storage.config';
export { identityConfig } from './identity.config';
export { loggingConfig } from './logging.config';
export { observabilityConfig } from './observability.config';
export { telematicsConfig } from './telematics.config';
export { openapiConfig } from './openapi.config';

/** Every namespaced configuration factory, loaded by the ConfigModule. */
export const configurations = [
  appConfig,
  databaseConfig,
  redisConfig,
  messagingConfig,
  storageConfig,
  identityConfig,
  loggingConfig,
  observabilityConfig,
  telematicsConfig,
  openapiConfig,
];
