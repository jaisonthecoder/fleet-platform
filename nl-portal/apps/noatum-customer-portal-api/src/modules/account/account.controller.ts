import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  AccountActionReasonDto,
  AccountInvitationDto,
  AccountOverviewDto,
  AccountRolePresetDto,
  AccountUserDto,
  ChangeRolesDto,
  InviteColleagueDto,
  PERMISSIONS,
} from '../../contracts';

import { AccountService } from './account.service';

/**
 * The customer's own account, as seen from inside it.
 *
 * Not one route takes a customer id. The tenant comes from the session, which is
 * the difference that makes these routes safe to hand to a customer at all —
 * `/customers/:id/...` is the Noatum-side equivalent and is guarded by
 * internal-only permissions for exactly that reason.
 */
@ApiTags('account')
@ApiBearerAuth()
@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('overview')
  @RequirePermission(PERMISSIONS.DASHBOARD_READ)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: AccountOverviewDto })
  overview(): Promise<AccountOverviewDto> {
    return this.account.overview();
  }

  @Get('users')
  @RequirePermission(PERMISSIONS.USERS_READ)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: AccountUserDto, isArray: true })
  users(): Promise<AccountUserDto[]> {
    return this.account.users();
  }

  @Get('role-presets')
  @RequirePermission(PERMISSIONS.USERS_READ)
  @ApiOkResponse({ type: AccountRolePresetDto, isArray: true })
  rolePresets(): Promise<AccountRolePresetDto[]> {
    return this.account.rolePresets();
  }

  @Get('invitations')
  @RequirePermission(PERMISSIONS.USERS_READ)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: AccountInvitationDto, isArray: true })
  invitations(): Promise<AccountInvitationDto[]> {
    return this.account.invitations();
  }

  @Post('invitations')
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: AccountInvitationDto })
  @ApiBody({ type: InviteColleagueDto })
  invite(@Body() body: unknown): Promise<AccountInvitationDto> {
    return this.account.invite(body);
  }

  @Post('invitations/:id/resend')
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: AccountInvitationDto, description: 'Issues a new link; the previous one stops working.' })
  @ApiBody({ type: AccountActionReasonDto })
  resend(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<AccountInvitationDto> {
    return this.account.resend(id, body);
  }

  @Post('invitations/:id/revoke')
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: AccountInvitationDto })
  @ApiBody({ type: AccountActionReasonDto })
  revoke(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<AccountInvitationDto> {
    return this.account.revoke(id, body);
  }

  @Patch('users/:id/roles')
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: AccountUserDto })
  @ApiBody({ type: ChangeRolesDto })
  changeRoles(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<AccountUserDto> {
    return this.account.changeRoles(id, body);
  }

  @Post('users/:id/deactivate')
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: AccountUserDto })
  @ApiBody({ type: AccountActionReasonDto })
  deactivate(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<AccountUserDto> {
    return this.account.setStatus(id, false, body);
  }

  @Post('users/:id/reactivate')
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: AccountUserDto })
  @ApiBody({ type: AccountActionReasonDto })
  reactivate(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<AccountUserDto> {
    return this.account.setStatus(id, true, body);
  }
}
