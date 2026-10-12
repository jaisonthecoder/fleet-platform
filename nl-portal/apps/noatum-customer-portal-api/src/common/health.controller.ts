import { Controller, Get, Header, ServiceUnavailableException, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';

import { Public } from './decorators/public.decorator';
import { PrismaService } from './tenancy/prisma.service';

@ApiTags('health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ description: 'Process is responding.' })
  live() {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ description: 'Database is reachable.' })
  @ApiServiceUnavailableResponse({ description: 'Database readiness check failed.' })
  async ready() {
    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`SET LOCAL statement_timeout = '1000ms'`;
        await transaction.$queryRaw`SELECT 1`;
      }, { maxWait: 1000, timeout: 2000 });
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('Service unavailable');
    }
  }
}
