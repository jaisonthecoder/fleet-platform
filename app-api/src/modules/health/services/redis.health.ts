import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import type { Redis } from 'ioredis';
import { REDIS } from '../../../common/redis/redis.constants';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly indicatorService: HealthIndicatorService,
  ) {}

  /** Reports Redis readiness by issuing a PING (connects lazily on first call). */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.indicatorService.check(key);
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG'
        ? indicator.up()
        : indicator.down({ message: `unexpected reply: ${pong}` });
    } catch (error) {
      return indicator.down({
        message: error instanceof Error ? error.message : 'unreachable',
      });
    }
  }
}
