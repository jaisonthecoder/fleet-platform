import { registerAs } from '@nestjs/config';
import { validateEnv } from './config.schema';

/** Redis connection configuration (PDP cache, BullMQ, Socket.IO adapter). */
export const redisConfig = registerAs('redis', () => {
  const env = validateEnv(process.env);
  return {
    url: env.REDIS_URL,
    tls: env.REDIS_TLS,
  };
});
