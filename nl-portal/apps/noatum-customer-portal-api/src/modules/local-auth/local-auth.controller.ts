import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import {
  LocalAccountStatusDto,
  LocalActivateDto,
  LocalActivateSchema,
  LocalActivationSubjectDto,
  LocalLoginDto,
  LocalLoginSchema,
  LocalMfaConfirmDto,
  LocalMfaConfirmSchema,
  LocalMfaEnrolmentDto,
  LocalMfaVerifyDto,
  LocalMfaVerifySchema,
  LocalPasswordChangeDto,
  LocalPasswordChangeSchema,
  LocalPasswordConfirmDto,
  LocalPasswordConfirmSchema,
  LocalPasswordResetRequestDto,
  LocalPasswordResetRequestSchema,
  LocalRecoveryCodesDto,
  LocalSessionDto,
  LocalSignOutEverywhereDto,
} from '../../contracts/dto/local-auth.dto';

import { LocalAuthService, type LocalRequest } from './local-auth.service';

function parse<T>(schema: { safeParse: (value: unknown) => { success: boolean; data?: T; error?: { issues: { message: string }[] } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException(result.error?.issues[0]?.message ?? 'Invalid request.');
  return result.data as T;
}

/**
 * Portal-managed sign-in for invited customers and the bootstrap administrator.
 *
 * Every route is @Public because none of them can present a bearer token - they are
 * how a session comes to exist. Authorisation is the session itself: the service
 * refuses anything that needs one, and the rate limiter guards the rest. Staff sign-in
 * is untouched and still goes through Entra.
 */
@ApiTags('auth')
@Controller('auth/local')
export class LocalAuthController {
  constructor(private readonly auth: LocalAuthService) {}

  @Post('sign-in')
  @Public()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: LocalSessionDto })
  @ApiUnauthorizedResponse({ description: 'Wrong details, or too many attempts.' })
  signIn(@Req() request: LocalRequest, @Body() body: LocalLoginDto): Promise<LocalSessionDto> {
    return this.auth.signIn(request, parse(LocalLoginSchema, body));
  }

  @Post('sign-out')
  @Public()
  @HttpCode(204)
  signOut(@Req() request: LocalRequest): Promise<void> {
    return this.auth.signOut(request);
  }

  @Post('sign-out-everywhere')
  @Public()
  @HttpCode(200)
  @ApiOkResponse({ type: LocalSignOutEverywhereDto, description: 'Number of other sessions ended.' })
  async signOutEverywhere(@Req() request: LocalRequest): Promise<LocalSignOutEverywhereDto> {
    return { revoked: await this.auth.signOutEverywhere(request) };
  }

  @Post('mfa/verify')
  @Public()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: LocalSessionDto })
  verifyMfa(@Req() request: LocalRequest, @Body() body: LocalMfaVerifyDto): Promise<LocalSessionDto> {
    return this.auth.verifyMfa(request, parse(LocalMfaVerifySchema, body));
  }

  @Post('mfa/enrolment')
  @Public()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: LocalMfaEnrolmentDto })
  beginMfaEnrolment(@Req() request: LocalRequest): Promise<LocalMfaEnrolmentDto> {
    return this.auth.beginMfaEnrolment(request);
  }

  @Post('mfa/enrolment/confirm')
  @Public()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: LocalRecoveryCodesDto })
  async confirmMfaEnrolment(
    @Req() request: LocalRequest,
    @Body() body: LocalMfaConfirmDto,
  ): Promise<LocalRecoveryCodesDto> {
    const { code } = parse(LocalMfaConfirmSchema, body);
    return { codes: await this.auth.confirmMfaEnrolment(request, code) };
  }

  @Get('account')
  @Public()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: LocalAccountStatusDto })
  @ApiUnauthorizedResponse({ description: 'No session, or the second factor is still outstanding.' })
  accountStatus(@Req() request: LocalRequest): Promise<LocalAccountStatusDto> {
    return this.auth.accountStatus(request);
  }

  @Post('mfa/recovery-codes')
  @Public()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: LocalRecoveryCodesDto, description: 'Retires the previous set.' })
  async regenerateRecoveryCodes(@Req() request: LocalRequest): Promise<LocalRecoveryCodesDto> {
    return { codes: await this.auth.regenerateRecoveryCodes(request) };
  }

  /** Changing phones: confirms the password, then starts a fresh enrolment. */
  @Post('mfa/replace')
  @Public()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: LocalPasswordConfirmDto })
  @ApiOkResponse({ type: LocalMfaEnrolmentDto })
  replaceMfa(@Req() request: LocalRequest, @Body() body: LocalPasswordConfirmDto): Promise<LocalMfaEnrolmentDto> {
    const { currentPassword } = parse(LocalPasswordConfirmSchema, body);
    return this.auth.replaceMfa(request, currentPassword);
  }

  @Post('mfa/remove')
  @Public()
  @HttpCode(204)
  @ApiBody({ type: LocalPasswordConfirmDto })
  @ApiConflictResponse({ description: 'Noatum accounts must keep a second factor.' })
  removeMfa(@Req() request: LocalRequest, @Body() body: LocalPasswordConfirmDto): Promise<void> {
    const { currentPassword } = parse(LocalPasswordConfirmSchema, body);
    return this.auth.removeMfa(request, currentPassword);
  }

  @Get('activation/:token')
  @Public()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: LocalActivationSubjectDto })
  @ApiBadRequestResponse({ description: 'Expired or already used.' })
  activationSubject(@Param('token') token: string): Promise<LocalActivationSubjectDto> {
    return this.auth.activationSubject(token);
  }

  @Post('activation')
  @Public()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: LocalSessionDto })
  activate(@Req() request: LocalRequest, @Body() body: LocalActivateDto): Promise<LocalSessionDto> {
    const input = parse(LocalActivateSchema, body);
    return this.auth.activate(request, input.token, input.password);
  }

  @Post('bootstrap')
  @Public()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: LocalSessionDto, description: 'Completes first-administrator setup.' })
  completeBootstrap(@Req() request: LocalRequest, @Body() body: LocalActivateDto): Promise<LocalSessionDto> {
    const input = parse(LocalActivateSchema, body);
    return this.auth.completeBootstrap(request, input.token, input.password);
  }

  @Post('password/reset-request')
  @Public()
  @HttpCode(202)
  @ApiOkResponse({ description: 'Always accepted, whether or not the address is known.' })
  async requestPasswordReset(
    @Req() request: LocalRequest,
    @Body() body: LocalPasswordResetRequestDto,
  ): Promise<void> {
    const { email } = parse(LocalPasswordResetRequestSchema, body);
    await this.auth.requestPasswordReset(email, request.ip);
  }

  @Post('password/reset')
  @Public()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: LocalSessionDto })
  completeReset(@Req() request: LocalRequest, @Body() body: LocalActivateDto): Promise<LocalSessionDto> {
    const input = parse(LocalActivateSchema, body);
    return this.auth.completeReset(request, input.token, input.password);
  }

  @Post('password/change')
  @Public()
  @HttpCode(204)
  @ApiUnauthorizedResponse({ description: 'No session, or the current password is wrong.' })
  changePassword(@Req() request: LocalRequest, @Body() body: LocalPasswordChangeDto): Promise<void> {
    return this.auth.changePassword(request, parse(LocalPasswordChangeSchema, body));
  }
}
