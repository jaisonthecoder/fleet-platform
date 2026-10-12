import { BadRequestException, Body, Controller, Get, Header, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConflictResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiQuery, ApiServiceUnavailableResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../contracts/permissions';
import { StaffAccessLinkDto, StaffAccessLinkResultDto, StaffAccessLinkSchema, StaffBranchDto, StaffListDto, StaffListQuerySchema, StaffRolePresetDto, StaffRoleUpdateDto, StaffRoleUpdateSchema, StaffUserDto } from '../../contracts/dto/staff.dto';
import { UsersService } from './users.service';

@ApiTags('staff')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
@Controller('users/staff')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ADMIN_STAFF_READ)
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'search', required: false, type: String, maxLength: 200 })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1, maximum: 10000 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, minimum: 1, maximum: 50 })
  @ApiOkResponse({ type: StaffListDto })
  @ApiBadRequestResponse()
  list(@Query() query: unknown): Promise<StaffListDto> {
    const parsed = StaffListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException('Invalid staff list query.');
    return this.users.list(parsed.data);
  }

  @Get('role-presets')
  @RequirePermission(PERMISSIONS.ADMIN_STAFF_READ)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: StaffRolePresetDto, isArray: true })
  presets(): Promise<StaffRolePresetDto[]> { return this.users.presets(); }

  @Get('branches')
  @RequirePermission(PERMISSIONS.ADMIN_STAFF_READ)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: StaffBranchDto, isArray: true })
  branches(): Promise<StaffBranchDto[]> { return this.users.branches(); }

  @Put(':id/roles')
  @RequirePermission(PERMISSIONS.ADMIN_STAFF_ROLES_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: StaffRoleUpdateDto })
  @ApiOkResponse({ type: StaffUserDto })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  updateRoles(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<StaffUserDto> {
    const parsed = StaffRoleUpdateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Invalid staff role assignment.');
    return this.users.updateRoles(id, parsed.data);
  }

  /** For staff the company's Microsoft sign-in does not cover. SSO accounts need none. */
  @Post(':id/access-link')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSIONS.ADMIN_STAFF_ROLES_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: StaffAccessLinkDto })
  @ApiOkResponse({ type: StaffAccessLinkResultDto })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiServiceUnavailableResponse()
  accessLink(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<StaffAccessLinkResultDto> {
    const parsed = StaffAccessLinkSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Give a reason for issuing the link.');
    return this.users.issueAccessLink(id, parsed.data);
  }
}
