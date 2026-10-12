import { Controller, Get, Header } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserDto } from '../../contracts/dto/current-user.dto';

import { AuthenticatedOnly } from '../../common/decorators/authenticated-only.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { FeatureSwitchService } from '../../common/features/feature-switch.service';
import { SettingsService } from '../../common/settings/settings.service';
import type { TenantContextData } from '../../common/tenancy/tenant-context';

@ApiTags('identity')
@ApiBearerAuth()
@Controller('me')
export class IdentityController {
  constructor(
    private readonly switches: FeatureSwitchService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * What the SPA needs to render the shell: who you are, which tenant, what you may do,
   * and which optional capabilities are switched on.
   *
   * Being authenticated is the whole requirement. The SPA uses `permissions` and
   * `features` to hide controls, but every endpoint re-checks server-side.
   */
  @AuthenticatedOnly()
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: CurrentUserDto })
  async me(@CurrentUser() user: TenantContextData): Promise<CurrentUserDto> {
    const resolved = await this.settings.resolveAll(this.settings.scopeOf(user));

    return {
      userId: user.userId,
      displayName: user.displayName ?? '',
      email: user.email ?? '',
      branchCode: user.branchCode ?? null,
      branchName: user.branchName ?? null,
      roleKeys: [...(user.roleKeys ?? [])],
      customerGroupId: user.customerGroupId,
      isInternal: user.isInternal,
      onBehalfOfUserId: user.onBehalfOfUserId ?? null,
      accountIds: user.accountIds,
      permissions: [...user.permissions],
      features: await this.switches.enabledKeys(),
      settings: Object.fromEntries(resolved.map((entry) => [entry.key, entry.value])),
    };
  }

  @Public()
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
