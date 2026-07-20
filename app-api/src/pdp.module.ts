import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { CoreConfigModule } from './common/config/config.module';
import { DatabaseModule } from './common/database/database.module';
import { EscalationModule } from './common/escalation/escalation.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { LoggingModule } from './common/logging/logging.module';
import { RedisModule } from './common/redis/redis.module';
import { PolicyModule } from './modules/policy/policy.module';

@Module({
  imports: [
    CoreConfigModule,
    LoggingModule,
    DatabaseModule,
    RedisModule,
    EscalationModule,
    PolicyModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class PdpModule {}
