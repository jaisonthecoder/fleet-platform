import {
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Redis } from 'ioredis';
import { redisConfig } from '../config/redis.config';
import { REDIS } from './redis.constants';

/**
 * Global Redis module. The client uses `lazyConnect` so no socket is opened
 * until the first command, keeping boot and tests independent of a live Redis.
 * `maxRetriesPerRequest: null` keeps the client compatible with BullMQ.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [redisConfig.KEY],
      /** Creates a lazily-connecting ioredis client from validated config. */
      useFactory: (config: ConfigType<typeof redisConfig>): Redis =>
        new Redis(config.url, {
          lazyConnect: true,
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
          tls: config.tls ? {} : undefined,
        }),
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly client: Redis) {}

  /** Disconnects the Redis client on graceful shutdown. */
  async onApplicationShutdown(): Promise<void> {
    if (this.client.status !== 'end') {
      this.client.disconnect();
    }
  }
}
