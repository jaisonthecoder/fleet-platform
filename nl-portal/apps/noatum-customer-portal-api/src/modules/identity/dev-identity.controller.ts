import { Controller, Get, Header } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { DevIdentityListDto } from '../../contracts/dto/dev-identity.dto';
import { IdentityService } from './identity.service';

/**
 * Lists the seeded identities the local sign-in picker offers.
 *
 * Public because it is consulted before anyone has signed in, and safe to be so:
 * it reports `enabled: false` with no users unless DEV_AUTH_ENABLED is on, and
 * configuration refuses to boot with that flag set in production.
 */
@ApiTags('identity')
@Controller('dev')
export class DevIdentityController {
  constructor(
    private readonly identity: IdentityService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('users')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Development only: seeded identities for the local sign-in picker' })
  @ApiOkResponse({ type: DevIdentityListDto })
  async users(): Promise<DevIdentityListDto> {
    const enabled = this.config.get<boolean>('identity.devAuthEnabled') ?? false;
    return { enabled, users: enabled ? await this.identity.listDevIdentities() : [] };
  }
}
