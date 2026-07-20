import { registerAs } from '@nestjs/config';
import { validateEnv } from './config.schema';

/** Azure Blob Storage containers (documents, consent WORM store, checkpoints). */
export const storageConfig = registerAs('storage', () => {
  const env = validateEnv(process.env);
  return {
    connectionString: env.STORAGE_CONNECTION_STRING,
    containers: {
      documents: env.STORAGE_CONTAINER_DOCUMENTS,
      consent: env.STORAGE_CONTAINER_CONSENT,
      checkpoints: env.STORAGE_CONTAINER_CHECKPOINTS,
    },
  };
});
