import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import {
  PERMISSIONS,
  ResolvedSettingDto,
  SetSettingDto,
  SettingChangeDto,
  SettingDto,
  type SettingScope,
} from '../../contracts';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';

import { SettingsAdminService } from './settings-admin.service';

/**
 * Platform settings. ADR-010.
 *
 * Reading and changing are separate permissions because seeing that a branch prices
 * differently is a reasonable thing for a manager to do, and changing it is not.
 */
@ApiTags('settings')
@ApiBearerAuth()
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsAdminService) {}

  /** Scope is a query, not the caller's own: Madrid must be able to see Valencia. */
  @RequirePermission(PERMISSIONS.ADMIN_SETTINGS_READ)
  @Get()
  @ApiOkResponse({ type: [SettingDto] })
  list(
    @Query('regionCode') regionCode?: string,
    @Query('branchCode') branchCode?: string,
    @Query('customerGroupId') customerGroupId?: string,
  ) {
    return this.settings.list({
      regionCode: regionCode ?? null,
      branchCode: branchCode ?? null,
      customerGroupId: customerGroupId ?? null,
    });
  }

  @RequirePermission(PERMISSIONS.ADMIN_SETTINGS_READ)
  @Get('history')
  @ApiOkResponse({ type: [SettingChangeDto] })
  history(@Query('take') take?: string) {
    return this.settings.history(take ? Number(take) : undefined);
  }

  @RequirePermission(PERMISSIONS.ADMIN_SETTINGS_MANAGE)
  @Post(':key')
  @ApiBody({ type: SetSettingDto })
  @ApiOkResponse({ type: ResolvedSettingDto })
  set(@Param('key') key: string, @Body() body: unknown) {
    return this.settings.set(key, body);
  }

  @RequirePermission(PERMISSIONS.ADMIN_SETTINGS_MANAGE)
  @Delete(':key')
  @ApiOkResponse({ type: ResolvedSettingDto })
  clear(
    @Param('key') key: string,
    @Query('scope') scope: SettingScope,
    @Query('scopeId') scopeId?: string,
    @Query('reason') reason = '',
  ) {
    return this.settings.clear(key, scope, scopeId ?? null, reason);
  }
}
