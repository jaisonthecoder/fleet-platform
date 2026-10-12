import { BadRequestException, Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  AccountActionDto,
  AccountActionResultDto,
  AccountActionSchema,
  CustomerCreateDto,
  CustomerCreateSchema,
  CustomerDetailDto,
  CustomerListDto,
  CustomerQuerySchema,
  CustomerStatusChangeDto,
  CustomerStatusChangeSchema,
  CustomerUpdateDto,
  CustomerUpdateSchema,
  CustomerUserListDto,
  CustomerUserQuerySchema,
  DirectoryListDto,
  OrganisationLinkCreateDto,
  OrganisationLinkCreateSchema,
  OrganisationLinkRemoveDto,
  OrganisationLinkRemoveSchema,
  OrganisationLinkServicingDto,
  OrganisationLinkServicingSchema,
  OrganisationSearchSchema,
  UserAccessUpdateDto,
  UserAccessUpdateSchema,
} from '../../contracts/dto/customer.dto';
import {
  InvitationDto,
  InviteAdministratorDto,
  InviteAdministratorSchema,
} from '../../contracts/dto/invitation.dto';
import { PERMISSIONS } from '../../contracts/permissions';
import { CustomersService } from './customers.service';

function parse<T>(schema: { safeParse: (value: unknown) => { success: boolean; data?: T; error?: { issues: { message: string }[] } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException(result.error?.issues[0]?.message ?? 'Invalid request.');
  return result.data as T;
}

@ApiTags('customers')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
@Controller('admin/customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ADMIN_CUSTOMERS_READ)
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'search', required: false, type: String, maxLength: 200 })
  @ApiQuery({ name: 'status', required: false, enum: ['all', 'draft', 'onboarding', 'active', 'suspended', 'closed'] })
  @ApiQuery({ name: 'countryCode', required: false, type: String })
  @ApiQuery({ name: 'blocked', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiOkResponse({ type: CustomerListDto })
  list(@Query() query: unknown): Promise<CustomerListDto> {
    return this.customers.list(parse(CustomerQuerySchema, query));
  }

  /** The directory search behind the attach drawer. */
  @Get('directory/organisations')
  @RequirePermission(PERMISSIONS.ADMIN_ORGANISATIONS_LINK)
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'search', required: false, type: String, maxLength: 200 })
  @ApiQuery({ name: 'countryCode', required: false, type: String })
  @ApiQuery({ name: 'unlinkedOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiOkResponse({ type: DirectoryListDto })
  directory(@Query() query: unknown): Promise<DirectoryListDto> {
    return this.customers.searchDirectory(parse(OrganisationSearchSchema, query));
  }

  @Post()
  @RequirePermission(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiCreatedResponse({ type: CustomerDetailDto })
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  @ApiBody({ type: CustomerCreateDto })
  create(@Body() body: unknown): Promise<CustomerDetailDto> {
    return this.customers.create(parse(CustomerCreateSchema, body));
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.ADMIN_CUSTOMERS_READ)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: CustomerDetailDto })
  @ApiNotFoundResponse()
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<CustomerDetailDto> {
    return this.customers.detail(id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: CustomerUpdateDto })
  @ApiOkResponse({ type: CustomerDetailDto })
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  @ApiNotFoundResponse()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<CustomerDetailDto> {
    return this.customers.update(id, parse(CustomerUpdateSchema, body));
  }

  /** Refused, not warned, when the customer would be unusable. */
  @Post(':id/go-live')
  @RequirePermission(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: CustomerStatusChangeDto })
  @ApiOkResponse({ type: CustomerDetailDto })
  @ApiConflictResponse({ description: 'Not ready: the response names what is missing.' })
  goLive(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<CustomerDetailDto> {
    return this.customers.changeStatus(id, 'active', parse(CustomerStatusChangeSchema, body));
  }

  @Post(':id/suspend')
  @RequirePermission(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: CustomerStatusChangeDto })
  @ApiOkResponse({ type: CustomerDetailDto })
  @ApiConflictResponse()
  suspend(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<CustomerDetailDto> {
    return this.customers.changeStatus(id, 'suspended', parse(CustomerStatusChangeSchema, body));
  }

  @Post(':id/close')
  @RequirePermission(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: CustomerStatusChangeDto })
  @ApiOkResponse({ type: CustomerDetailDto, description: 'Closing releases the organisation codes for reuse.' })
  @ApiConflictResponse()
  close(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<CustomerDetailDto> {
    return this.customers.changeStatus(id, 'closed', parse(CustomerStatusChangeSchema, body));
  }

  /** POST, not DELETE: these carry a reason, and a DELETE body is unreliable. */
  @Post(':id/discard')
  @RequirePermission(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE)
  @HttpCode(204)
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: CustomerStatusChangeDto })
  @ApiNoContentResponse({ description: 'Only a customer that never went live and has no users.' })
  @ApiConflictResponse()
  discard(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<void> {
    return this.customers.discard(id, parse(CustomerStatusChangeSchema, body));
  }

  @Post(':id/organisations')
  @RequirePermission(PERMISSIONS.ADMIN_ORGANISATIONS_LINK)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: OrganisationLinkCreateDto })
  @ApiCreatedResponse({ type: CustomerDetailDto })
  @ApiConflictResponse({ description: 'Not eligible, or the code already belongs to another customer.' })
  @ApiNotFoundResponse()
  attach(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<CustomerDetailDto> {
    return this.customers.attach(id, parse(OrganisationLinkCreateSchema, body));
  }

  @Post(':id/organisations/:accountId/detach')
  @RequirePermission(PERMISSIONS.ADMIN_ORGANISATIONS_LINK)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'accountId', type: String })
  @ApiBody({ type: OrganisationLinkRemoveDto })
  @ApiOkResponse({ type: CustomerDetailDto })
  @ApiNotFoundResponse()
  detach(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() body: unknown,
  ): Promise<CustomerDetailDto> {
    return this.customers.detach(id, accountId, parse(OrganisationLinkRemoveSchema, body));
  }

  @Post(':id/organisations/:accountId/servicing')
  @RequirePermission(PERMISSIONS.ADMIN_ORGANISATIONS_LINK)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'accountId', type: String })
  @ApiBody({ type: OrganisationLinkServicingDto })
  @ApiOkResponse({ type: CustomerDetailDto })
  @ApiConflictResponse({ description: 'The office is no longer active.' })
  @ApiNotFoundResponse()
  setLinkServicing(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() body: unknown,
  ): Promise<CustomerDetailDto> {
    return this.customers.setLinkServicing(id, accountId, parse(OrganisationLinkServicingSchema, body));
  }

  @Get(':id/invitations')
  @RequirePermission(PERMISSIONS.ADMIN_CUSTOMERS_READ)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: InvitationDto, isArray: true })
  invitations(@Param('id', ParseUUIDPipe) id: string): Promise<InvitationDto[]> {
    return this.customers.invitations(id);
  }

  @Post(':id/invitations')
  @RequirePermission(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: InviteAdministratorDto })
  @ApiOkResponse({ type: InvitationDto })
  @ApiConflictResponse()
  inviteAdministrator(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<InvitationDto> {
    return this.customers.inviteAdministrator(id, parse(InviteAdministratorSchema, body));
  }

  @Post(':id/invitations/:invitationId/resend')
  @RequirePermission(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'invitationId', type: String })
  @ApiBody({ type: AccountActionDto })
  @ApiOkResponse({ type: InvitationDto, description: 'Issues a new link; the previous one stops working.' })
  @ApiConflictResponse({ description: 'The invitation is no longer pending.' })
  resendInvitation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @Body() body: unknown,
  ): Promise<InvitationDto> {
    return this.customers.resendInvitation(id, invitationId, parse(AccountActionSchema, body));
  }

  @Post(':id/invitations/:invitationId/revoke')
  @RequirePermission(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'invitationId', type: String })
  @ApiBody({ type: AccountActionDto })
  @ApiOkResponse({ type: InvitationDto })
  @ApiConflictResponse({ description: 'The invitation is no longer pending.' })
  revokeInvitation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @Body() body: unknown,
  ): Promise<InvitationDto> {
    return this.customers.revokeInvitation(id, invitationId, parse(AccountActionSchema, body));
  }

  @Get(':id/users')
  @RequirePermission(PERMISSIONS.ADMIN_CUSTOMERS_READ)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'search', required: false, type: String, maxLength: 200 })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiOkResponse({ type: CustomerUserListDto })
  users(@Param('id', ParseUUIDPipe) id: string, @Query() query: unknown): Promise<CustomerUserListDto> {
    return this.customers.users(id, parse(CustomerUserQuerySchema, query));
  }

  @Post(':id/users/:userId/password-reset')
  @RequirePermission(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'userId', type: String })
  @ApiBody({ type: AccountActionDto })
  @ApiOkResponse({ type: AccountActionResultDto })
  sendPasswordReset(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: unknown,
  ): Promise<AccountActionResultDto> {
    return this.customers.sendPasswordReset(id, userId, parse(AccountActionSchema, body));
  }

  /** Blocks the password at once: sessions end and unspent links are cancelled. */
  @Post(':id/users/:userId/sign-in/block')
  @RequirePermission(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'userId', type: String })
  @ApiBody({ type: AccountActionDto })
  @ApiOkResponse({ type: AccountActionResultDto })
  blockSignIn(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: unknown,
  ): Promise<AccountActionResultDto> {
    return this.customers.setCredentialDisabled(id, userId, true, parse(AccountActionSchema, body));
  }

  @Post(':id/users/:userId/sign-in/restore')
  @RequirePermission(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'userId', type: String })
  @ApiBody({ type: AccountActionDto })
  @ApiOkResponse({ type: AccountActionResultDto })
  restoreSignIn(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: unknown,
  ): Promise<AccountActionResultDto> {
    return this.customers.setCredentialDisabled(id, userId, false, parse(AccountActionSchema, body));
  }

  /** For a lost phone. Clears the factor and its recovery codes; the next sign-in re-enrols. */
  @Post(':id/users/:userId/mfa/reset')
  @RequirePermission(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'userId', type: String })
  @ApiBody({ type: AccountActionDto })
  @ApiOkResponse({ type: AccountActionResultDto })
  resetUserMfa(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: unknown,
  ): Promise<AccountActionResultDto> {
    return this.customers.resetUserMfa(id, userId, parse(AccountActionSchema, body));
  }

  /** Which of the customer's organisations this person may see. */
  @Post(':id/users/:userId/organisations')
  @RequirePermission(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'userId', type: String })
  @ApiBody({ type: UserAccessUpdateDto })
  @ApiOkResponse({ type: CustomerUserListDto })
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  @ApiNotFoundResponse()
  updateUserAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: unknown,
  ): Promise<CustomerUserListDto> {
    return this.customers.updateUserAccess(id, userId, parse(UserAccessUpdateSchema, body));
  }
}
