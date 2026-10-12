import { createHash, randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RateLimiterService, RateLimitExceeded } from '../../common/rate-limit/rate-limiter.service';
import { EmailAdapter } from '../../contracts/adapters/email.adapter';
import type {
  LocalAccountStatusDto,
  LocalActivationSubjectDto,
  LocalMfaEnrolmentDto,
  LocalSessionDto,
} from '../../contracts/dto/local-auth.dto';

import { LocalAuthRepository, type AccountSecurity, type ChallengePurpose } from './local-auth.repository';
import { MfaService, hashRecoveryCode } from './mfa.service';
import { PasswordService } from './password.service';
import { hashSessionId } from './session-store';

export interface LocalRequest {
  ip?: string;
  sessionID?: string;
  session?: {
    local?: {
      userId: string;
      securityVersion: number;
      assurance: 'pending_mfa' | 'authenticated';
      absoluteExpiresAt: string;
    };
    csrfToken?: string;
    regenerate(callback: (error?: unknown) => void): void;
    destroy(callback: (error?: unknown) => void): void;
    save(callback: (error?: unknown) => void): void;
  };
}

const CHALLENGE_TTL_MINUTES = { password_reset: 60, bootstrap: 60 * 24, activation: 60 * 24 * 7 };

/** Failures tolerated per account in a rolling fifteen minutes before guesses are refused. */
const ACCOUNT_ATTEMPT_BUDGET = 10;

/** One message for every failure, so nobody can probe which addresses exist. */
const SIGN_IN_FAILED = 'Those sign-in details are not correct.';

@Injectable()
export class LocalAuthService {
  private readonly logger = new Logger(LocalAuthService.name);

  /**
   * Counted in PostgreSQL, so the budget holds across every instance. In process
   * memory it did not, and two instances silently doubled what an attacker gets.
   *
   * Only failures count against an account, and the window rolls rather than locking.
   * A hard lock keyed on an email address is a way to shut a customer out of their own
   * account from the outside, which is a worse problem than the one it solves.
   */
  private readonly byAccount = { points: ACCOUNT_ATTEMPT_BUDGET, duration: 900, blockDuration: 0 };
  private readonly byAddress = { points: 40, duration: 900, blockDuration: 900 };

  constructor(
    private readonly repository: LocalAuthRepository,
    private readonly passwords: PasswordService,
    private readonly mfa: MfaService,
    private readonly email: EmailAdapter,
    private readonly config: ConfigService,
    private readonly limiter: RateLimiterService,
  ) {
    const exempt = this.config.get<string[]>('localAuth.passwordOnlyStaff') ?? [];
    if (exempt.length) {
      this.logger.warn(
        `${exempt.length} staff account(s) may sign in without a second factor: ${exempt.join(', ')}. ` +
          'Clear DEMO_STAFF_ACCOUNTS outside a demonstration environment.',
      );
    }
  }

  /**
   * Whether this person must hold a second factor. Internal accounts must, except the
   * few a demonstration environment names in DEMO_STAFF_ACCOUNTS. Decided in one place
   * so sign-in, activation and the account screen cannot disagree about who is exempt.
   */
  private secondFactorRequired(isInternal: boolean, email: string | null | undefined): boolean {
    if (!isInternal) return false;
    const exempt = this.config.get<string[]>('localAuth.passwordOnlyStaff') ?? [];
    return !exempt.includes((email ?? '').toLowerCase());
  }

  /**
   * Whether this account belongs to the tab the attempt came from. The two tabs are two
   * doors, not one door with two labels: a customer may not enter through the employee
   * tab, nor a staff account through the customer tab. No audience means an older client,
   * which is let through unchanged.
   */
  private audienceAllowed(isInternal: boolean, audience: 'customer' | 'staff' | undefined): boolean {
    if (!audience) return true;
    return isInternal === (audience === 'staff');
  }

  async signIn(
    request: LocalRequest,
    input: { email: string; password: string; audience?: 'customer' | 'staff' },
  ): Promise<LocalSessionDto> {
    await this.guardAttempt(input.email, request.ip);

    const candidate = await this.repository.findLoginCandidate(input.email);

    // Every branch below still costs one Argon2 verification.
    if (!candidate?.passwordHash || candidate.credentialDisabled) {
      await this.passwords.verifyDummy();
      await this.recordFailure(input.email);
      await this.audit('auth.local.sign_in.failed', null, null, request.ip, {
        email: input.email,
        reason: candidate ? 'no_credential' : 'unknown_email',
      });
      throw new UnauthorizedException(SIGN_IN_FAILED);
    }

    const correct = await this.passwords.verify(candidate.passwordHash, input.password);
    if (!correct) {
      await this.recordFailure(input.email);
      await this.audit('auth.local.sign_in.failed', candidate.userId, candidate.customerGroupId, request.ip, {
        reason: 'wrong_password',
      });
      throw new UnauthorizedException(SIGN_IN_FAILED);
    }

    // Checked after the password so a wrong tab and a wrong password cost the same and
    // read the same - the tab must not become a way to tell staff addresses from
    // customer ones.
    if (!this.audienceAllowed(candidate.isInternal, input.audience)) {
      await this.recordFailure(input.email);
      await this.audit('auth.local.sign_in.failed', candidate.userId, candidate.customerGroupId, request.ip, {
        reason: 'wrong_audience',
        audience: input.audience,
      });
      throw new UnauthorizedException(SIGN_IN_FAILED);
    }

    // An account that is suspended or still invited must not be told it guessed right.
    if (candidate.status !== 'active' && candidate.status !== 'registered') {
      await this.recordFailure(input.email);
      await this.audit('auth.local.sign_in.failed', candidate.userId, candidate.customerGroupId, request.ip, {
        reason: `status_${candidate.status}`,
      });
      throw new UnauthorizedException(SIGN_IN_FAILED);
    }

    // Suspending or closing a customer locks its people out. Refused here as well as in
    // AuthGuard so the person is told at sign-in rather than after a session is issued.
    if (candidate.customerGroupId) {
      const resolved = await this.repository.resolveIdentityById(candidate.userId);
      if (resolved && !resolved.isInternal && resolved.customerGroupStatus !== 'active') {
        await this.recordFailure(input.email);
        await this.audit('auth.local.sign_in.failed', candidate.userId, candidate.customerGroupId, request.ip, {
          reason: `customer_${resolved.customerGroupStatus ?? 'unknown'}`,
        });
        throw new UnauthorizedException(SIGN_IN_FAILED);
      }
    }

    if (this.passwords.needsRehash(candidate.passwordHash)) {
      // Cost settings moved on; upgrade quietly without disturbing the session.
      const rehashed = await this.passwords.hash(input.password);
      await this.repository.setPassword(candidate.userId, rehashed, false);
    }

    await this.resetAttempts(input.email);

    const needsMfa = candidate.mfaEnrolled;
    const mustEnrol = !candidate.mfaEnrolled && this.secondFactorRequired(candidate.isInternal, input.email);
    const assurance = needsMfa || mustEnrol ? 'pending_mfa' : 'authenticated';

    const identity = await this.startSession(request, candidate.userId, candidate.securityVersion, assurance);

    if (assurance === 'authenticated') await this.repository.recordLogin(candidate.userId);

    await this.audit('auth.local.sign_in.succeeded', candidate.userId, candidate.customerGroupId, request.ip, {
      assurance,
    });

    return {
      state: needsMfa ? 'mfa_required' : mustEnrol ? 'mfa_enrolment_required' : 'authenticated',
      email: identity.email,
      displayName: identity.displayName,
      csrfToken: request.session!.csrfToken!,
    };
  }

  async signOut(request: LocalRequest): Promise<void> {
    const userId = request.session?.local?.userId ?? null;
    if (request.sessionID) await this.repository.destroySession(hashSessionId(request.sessionID));

    await new Promise<void>((resolve) => {
      request.session?.destroy(() => resolve());
      if (!request.session) resolve();
    });

    if (userId) await this.audit('auth.local.sign_out', userId, null, request.ip, {});
  }

  /** Signs every other session out - the honest answer to "was that you?". */
  async signOutEverywhere(request: LocalRequest): Promise<number> {
    const userId = this.requireAuthenticated(request);
    const keep = request.sessionID ? hashSessionId(request.sessionID) : undefined;
    const revoked = await this.repository.revokeUserSessions(userId, keep);
    await this.audit('auth.local.sessions.revoked', userId, null, request.ip, { revoked });
    return revoked;
  }

  // ---------------------------------------------------------------- second factor

  async beginMfaEnrolment(request: LocalRequest): Promise<LocalMfaEnrolmentDto> {
    const userId = this.requireUser(request);
    const identity = await this.repository.resolveIdentityById(userId);
    if (!identity) throw new UnauthorizedException(SIGN_IN_FAILED);

    const existing = await this.repository.mfaFactor(userId);
    if (existing?.confirmed) {
      throw new ConflictException('A second factor is already set up. Remove it before adding another.');
    }

    const enrolment = this.mfa.createEnrolment(identity.email);
    await this.repository.beginMfaEnrolment(userId, this.mfa.encryptSecret(enrolment.secret));
    return enrolment;
  }

  /** Proves the authenticator was actually set up, and only then turns the factor on. */
  async confirmMfaEnrolment(request: LocalRequest, code: string): Promise<string[]> {
    const userId = this.requireUser(request);
    const factor = await this.repository.mfaFactor(userId);
    if (!factor || factor.confirmed) {
      throw new BadRequestException('Start setting up a second factor first.');
    }

    const secret = this.mfa.decryptSecret(factor.secretEncrypted);
    const step = secret ? await this.mfa.checkCode(secret, code) : null;
    if (step === null) throw new UnauthorizedException('That code is not correct.');

    await this.repository.useMfaStep(userId, step, true);

    const { codes, hashes } = this.mfa.createRecoveryCodes();
    await this.repository.replaceRecoveryCodes(userId, hashes);

    await this.promote(request);
    await this.audit('auth.local.mfa.enrolled', userId, null, request.ip, {});
    return codes;
  }

  async verifyMfa(
    request: LocalRequest,
    input: { code?: string; recoveryCode?: string },
  ): Promise<LocalSessionDto> {
    const userId = this.requireUser(request);
    await this.guardAttempt(`mfa:${userId}`, request.ip);

    const accepted = input.recoveryCode
      ? await this.repository.useRecoveryCode(userId, hashRecoveryCode(input.recoveryCode))
      : await this.verifyTotp(userId, input.code ?? '');

    if (!accepted) {
      await this.recordFailure(`mfa:${userId}`);
      await this.audit('auth.local.mfa.failed', userId, null, request.ip, {
        method: input.recoveryCode ? 'recovery_code' : 'totp',
      });
      throw new UnauthorizedException('That code is not correct.');
    }

    await this.resetAttempts(`mfa:${userId}`);
    await this.promote(request);
    await this.repository.recordLogin(userId);

    const identity = await this.repository.resolveIdentityById(userId);
    await this.audit('auth.local.mfa.succeeded', userId, identity?.customerGroupId ?? null, request.ip, {
      method: input.recoveryCode ? 'recovery_code' : 'totp',
      remaining: input.recoveryCode ? await this.repository.recoveryCodesRemaining(userId) : undefined,
    });

    return {
      state: 'authenticated',
      email: identity?.email ?? '',
      displayName: identity?.displayName ?? '',
      csrfToken: request.session?.csrfToken ?? '',
    };
  }

  private async verifyTotp(userId: string, code: string): Promise<boolean> {
    const factor = await this.repository.mfaFactor(userId);
    if (!factor?.confirmed) return false;

    const secret = this.mfa.decryptSecret(factor.secretEncrypted);
    const step = secret ? await this.mfa.checkCode(secret, code) : null;
    if (step === null) return false;

    // False here means the step was already spent: a replayed code, not a valid one.
    return this.repository.useMfaStep(userId, step);
  }

  // ------------------------------------------------------------------- activation

  /** Reads the link without spending it, so a mail scanner cannot burn an invitation. */
  async activationSubject(token: string): Promise<LocalActivationSubjectDto> {
    const subject = await this.repository.peekChallenge('activation', hashToken(token));
    if (!subject) throw new BadRequestException('This link has expired or has already been used.');

    return { email: subject.email, displayName: subject.displayName };
  }

  async activate(request: LocalRequest, token: string, password: string): Promise<LocalSessionDto> {
    return this.setPasswordFromLink(request, 'activation', token, password, 'auth.local.activated');
  }

  async completeBootstrap(request: LocalRequest, token: string, password: string): Promise<LocalSessionDto> {
    return this.setPasswordFromLink(request, 'bootstrap', token, password, 'auth.local.bootstrap.completed');
  }

  async completeReset(request: LocalRequest, token: string, password: string): Promise<LocalSessionDto> {
    return this.setPasswordFromLink(request, 'password_reset', token, password, 'auth.local.password.reset');
  }

  private async setPasswordFromLink(
    request: LocalRequest,
    purpose: ChallengePurpose,
    token: string,
    password: string,
    action: string,
  ): Promise<LocalSessionDto> {
    await this.guardAttempt(`link:${hashToken(token).slice(0, 16)}`, request.ip);

    const hash = await this.passwords.hash(password);
    const result = await this.repository.setPasswordFromChallenge(purpose, hashToken(token), hash);
    if (!result) {
      await this.recordFailure(`link:${hashToken(token).slice(0, 16)}`);
      throw new BadRequestException('This link has expired or has already been used.');
    }

    const identity = await this.repository.resolveIdentityById(result.userId);
    const mustEnrol = !result.mfaEnrolled && this.secondFactorRequired(identity?.isInternal ?? false, result.email);
    const assurance = result.mfaEnrolled || mustEnrol ? 'pending_mfa' : 'authenticated';

    await this.startSession(request, result.userId, result.securityVersion, assurance);
    await this.audit(action, result.userId, identity?.customerGroupId ?? null, request.ip, {});

    return {
      state: result.mfaEnrolled ? 'mfa_required' : mustEnrol ? 'mfa_enrolment_required' : 'authenticated',
      email: identity?.email ?? result.email,
      displayName: identity?.displayName ?? '',
      csrfToken: request.session?.csrfToken ?? '',
    };
  }

  // -------------------------------------------------------------------- passwords

  /**
   * Always reports success. Whether an address has an account is not something an
   * unauthenticated caller gets to learn.
   */
  async requestPasswordReset(email: string, ip?: string): Promise<void> {
    try {
      await this.limiter.consume(`addr:${ip ?? 'unknown'}`, this.byAddress);
    } catch {
      return;
    }

    const candidate = await this.repository.findLoginCandidate(email);
    if (!candidate || candidate.credentialDisabled) return;

    const { token, tokenHash } = createLinkToken();
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MINUTES.password_reset * 60_000);
    await this.repository.issueChallenge({
      userId: candidate.userId,
      purpose: 'password_reset',
      tokenHash,
      expiresAt,
    });

    await this.send(
      email,
      'Reset your Noatum Logistics portal password',
      [
        'Hello,',
        '',
        'We received a request to reset the password for your Noatum Logistics customer portal account.',
        '',
        `Set a new password here: ${this.link('reset-password', token)}`,
        '',
        'The link can be used once and expires in one hour. If this was not you, no action is needed.',
        '',
        'Noatum Logistics',
      ].join('\n'),
    );

    await this.audit('auth.local.password.reset_requested', candidate.userId, candidate.customerGroupId, ip, {});
  }

  async changePassword(
    request: LocalRequest,
    input: { currentPassword: string; newPassword: string },
  ): Promise<void> {
    // confirmPassword requires a fully authenticated session, so a session that has
    // only cleared the password step cannot replace the password and walk past its
    // own second factor. It also throttles the guesses.
    const userId = await this.confirmPassword(request, input.currentPassword);
    const identity = await this.repository.resolveIdentityById(userId);
    if (!identity) throw new UnauthorizedException(SIGN_IN_FAILED);

    const hash = await this.passwords.hash(input.newPassword);
    const version = await this.repository.setPassword(userId, hash);

    // Every other session dies with the old password; this one is re-pinned so the
    // person changing it is not signed out of the screen they are looking at.
    await this.repository.revokeUserSessions(userId, request.sessionID ? hashSessionId(request.sessionID) : undefined);
    if (request.session?.local) request.session.local.securityVersion = version;
    await this.saveSession(request);

    await this.audit('auth.local.password.changed', userId, identity.customerGroupId, request.ip, {});
  }

  // ---------------------------------------------------------------- self service

  /** Everything the account screen shows, for the person signed in right now. */
  async accountStatus(request: LocalRequest): Promise<LocalAccountStatusDto> {
    const userId = this.requireAuthenticated(request);
    const identity = await this.repository.resolveIdentityById(userId);
    if (!identity) throw new UnauthorizedException(SIGN_IN_FAILED);

    const security = (await this.repository.accountSecurity([userId])).get(userId);

    return {
      email: identity.email,
      displayName: identity.displayName,
      hasPassword: security?.hasPassword ?? false,
      passwordSetAt: security?.passwordSetAt ?? null,
      mfaEnrolled: security?.mfaEnrolled ?? false,
      recoveryCodesLeft: security?.recoveryCodesLeft ?? 0,
      activeSessions: security?.activeSessions ?? 0,
      // Staff carry a branch and real reach, so their factor may be replaced, never dropped.
      mfaRequired: this.secondFactorRequired(identity.isInternal, identity.email),
      csrfToken: request.session?.csrfToken ?? '',
    };
  }

  /**
   * A new set of recovery codes, which silently retires the old set. No password is
   * asked for: this only ever raises the person's protection.
   */
  async regenerateRecoveryCodes(request: LocalRequest): Promise<string[]> {
    const userId = this.requireAuthenticated(request);

    const factor = await this.repository.mfaFactor(userId);
    if (!factor?.confirmed) {
      throw new BadRequestException('Set up a second factor before asking for recovery codes.');
    }

    const { codes, hashes } = this.mfa.createRecoveryCodes();
    await this.repository.replaceRecoveryCodes(userId, hashes);
    await this.audit('auth.local.recovery_codes.reissued', userId, null, request.ip, {});
    return codes;
  }

  /**
   * Moving to a new phone. The old factor goes and a fresh enrolment starts, but the
   * session survives - signing someone out halfway through leaves them with no factor
   * and no way back in.
   */
  async replaceMfa(request: LocalRequest, currentPassword: string): Promise<LocalMfaEnrolmentDto> {
    const userId = await this.confirmPassword(request, currentPassword);
    const identity = await this.repository.resolveIdentityById(userId);
    if (!identity) throw new UnauthorizedException(SIGN_IN_FAILED);

    await this.repository.restartMfa(userId);

    const enrolment = this.mfa.createEnrolment(identity.email);
    await this.repository.beginMfaEnrolment(userId, this.mfa.encryptSecret(enrolment.secret));
    await this.audit('auth.local.mfa.replacement_started', userId, identity.customerGroupId, request.ip, {});
    return enrolment;
  }

  /** Turning a second factor off entirely. Refused for staff, who must keep one. */
  async removeMfa(request: LocalRequest, currentPassword: string): Promise<void> {
    const userId = await this.confirmPassword(request, currentPassword);
    const identity = await this.repository.resolveIdentityById(userId);
    if (!identity) throw new UnauthorizedException(SIGN_IN_FAILED);

    if (this.secondFactorRequired(identity.isInternal, identity.email)) {
      throw new ConflictException(
        'Noatum accounts must keep a second factor. Replace it instead of removing it.',
      );
    }

    await this.repository.restartMfa(userId);
    await this.audit('auth.local.mfa.removed', userId, identity.customerGroupId, request.ip, {});
  }

  /** Proves the person at the keyboard is the account holder, not someone at their desk. */
  private async confirmPassword(request: LocalRequest, currentPassword: string): Promise<string> {
    const userId = this.requireAuthenticated(request);
    // Holding a session must not buy unlimited guesses at the password behind it.
    await this.guardAttempt(`confirm:${userId}`, request.ip);

    const identity = await this.repository.resolveIdentityById(userId);
    if (!identity) throw new UnauthorizedException(SIGN_IN_FAILED);

    const candidate = await this.repository.findLoginCandidate(identity.email);
    if (!candidate?.passwordHash || !(await this.passwords.verify(candidate.passwordHash, currentPassword))) {
      await this.recordFailure(`confirm:${userId}`);
      throw new UnauthorizedException('Your current password is not correct.');
    }

    await this.resetAttempts(`confirm:${userId}`);
    return userId;
  }

  // ------------------------------------------------------------------- invitation

  /**
   * Turns an invitation into an activation link. Called by the invitation flow so the
   * customer's email carries one token that both records acceptance and sets a password.
   */
  async issueActivationChallenge(input: {
    userId: string;
    invitationId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.repository.issueChallenge({
      userId: input.userId,
      purpose: 'activation',
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      invitationId: input.invitationId,
    });
  }

  // ------------------------------------------------- administrative account control
  //
  // Called by staff screens, which supply their own audit rows through the tenant
  // context. Nothing here decides whether the caller is allowed to do it - that is the
  // controller's @RequirePermission and the customers service.

  /**
   * Issues a reset link on someone's behalf and emails it. The link comes back only
   * while no transport is configured, so an operator can pass it on rather than being
   * told an email was sent that never was.
   */
  async issuePasswordResetFor(input: {
    userId: string;
    email: string;
    displayName: string;
  }): Promise<{ link: string | null; emailStatus: string }> {
    const { token, tokenHash } = createLinkToken();
    await this.repository.issueChallenge({
      userId: input.userId,
      purpose: 'password_reset',
      tokenHash,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MINUTES.password_reset * 60_000),
    });

    const link = this.link('reset-password', token);
    const delivery = await this.send(
      input.email,
      'Set a new password for the Noatum Logistics customer portal',
      [
        `Hello ${input.displayName},`,
        '',
        'We have been asked to help you back into the Noatum Logistics customer portal.',
        '',
        `Set a new password here: ${link}`,
        '',
        'The link can be used once and expires in one hour.',
        '',
        'Noatum Logistics',
      ].join('\n'),
    );

    return { link: delivery === 'sent' ? null : link, emailStatus: delivery };
  }

  /** Replaces an unaccepted invitation's link with a fresh one of the same standing. */
  async reissueActivation(input: {
    userId: string;
    invitationId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    // issueChallenge supersedes any live link for this purpose, so the old one dies here.
    await this.issueActivationChallenge(input);
  }

  /**
   * A way into the portal for a Noatum account that has no Microsoft identity - the
   * first administrator, and the fictional staff a demonstration environment carries.
   *
   * Someone with no password is being invited, so the link lives a week and says so.
   * Someone who has one is being helped back in, and that link lasts an hour, because
   * it can take an account over. Either way the previous link stops working, so the
   * newest one an operator holds is always the live one.
   *
   * The link comes back only while no email transport is configured. Once one is, this
   * returns null and the person receives it themselves, with no change here.
   */
  async issueStaffAccessLink(input: {
    userId: string;
    email: string;
    displayName: string;
    hasPassword: boolean;
  }): Promise<{ link: string | null; emailStatus: string; expiresAt: string }> {
    const purpose = input.hasPassword ? 'password_reset' : 'activation';
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MINUTES[purpose] * 60_000);
    const { token, tokenHash } = createLinkToken();
    await this.repository.issueChallenge({ userId: input.userId, purpose, tokenHash, expiresAt });

    const link = this.link(input.hasPassword ? 'reset-password' : 'invitation', token);
    const lifetime = input.hasPassword ? 'one hour' : 'seven days';
    const delivery = await this.send(
      input.email,
      input.hasPassword
        ? 'Set a new password for the Noatum Logistics portal'
        : 'Your access to the Noatum Logistics portal',
      [
        `Hello ${input.displayName},`,
        '',
        input.hasPassword
          ? 'We have been asked to help you back into the portal.'
          : 'An administrator has set up your access to the portal.',
        '',
        `${input.hasPassword ? 'Set a new password here' : 'Choose your password here'}: ${link}`,
        '',
        `The link can be used once and expires in ${lifetime}.`,
        '',
        'Noatum Logistics',
      ].join('\n'),
    );

    return {
      link: delivery === 'sent' ? null : link,
      emailStatus: delivery,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async cancelActivation(userId: string): Promise<number> {
    return this.repository.revokeChallenges(userId, 'activation');
  }

  async disableCredential(userId: string): Promise<boolean> {
    return this.repository.disableCredential(userId);
  }

  async enableCredential(userId: string): Promise<boolean> {
    return this.repository.enableCredential(userId);
  }

  /** For a lost phone. Sessions go with it, so the next sign-in has to re-enrol. */
  async resetMfaFor(userId: string): Promise<boolean> {
    return this.repository.resetMfa(userId);
  }

  async accountSecurity(userIds: string[]): Promise<Map<string, AccountSecurity>> {
    return this.repository.accountSecurity(userIds);
  }

  /** Sends the invitation email for a reissued link. */
  async sendActivationEmail(input: {
    email: string;
    displayName: string;
    customerName: string;
    link: string;
  }): Promise<string> {
    return this.send(
      input.email,
      'Your access to the Noatum Logistics customer portal',
      [
        `Hello ${input.displayName},`,
        '',
        `You have been invited to administer ${input.customerName} on the Noatum Logistics customer portal.`,
        '',
        `Accept the invitation and set your password here: ${input.link}`,
        '',
        'The link can be used once.',
        '',
        'Noatum Logistics',
      ].join('\n'),
    );
  }

  /** The link an operator hands over when no email transport is configured. */
  activationLink(token: string): string {
    return this.link('invitation', token);
  }

  // ----------------------------------------------------------------------- helpers

  private async startSession(
    request: LocalRequest,
    userId: string,
    securityVersion: number,
    assurance: 'pending_mfa' | 'authenticated',
  ) {
    const identity = await this.repository.resolveIdentityById(userId);
    if (!identity) throw new UnauthorizedException(SIGN_IN_FAILED);

    // New session id, so a cookie planted before sign-in cannot become the signed-in one.
    await new Promise<void>((resolve, reject) => {
      request.session?.regenerate((error) => (error ? reject(error as Error) : resolve()));
      if (!request.session) reject(new Error('Session support is not enabled.'));
    });

    const absoluteExpiresAt = new Date(
      Date.now() + this.config.getOrThrow<number>('localAuth.absoluteHours') * 3_600_000,
    ).toISOString();

    request.session!.local = { userId, securityVersion, assurance, absoluteExpiresAt };
    request.session!.csrfToken = randomBytes(32).toString('base64url');
    await this.saveSession(request);

    return identity;
  }

  private async promote(request: LocalRequest): Promise<void> {
    if (request.session?.local) request.session.local.assurance = 'authenticated';
    await this.saveSession(request);
    if (request.sessionID) await this.repository.promoteSession(hashSessionId(request.sessionID));
  }

  private saveSession(request: LocalRequest): Promise<void> {
    return new Promise((resolve, reject) => {
      request.session?.save((error) => (error ? reject(error as Error) : resolve()));
      if (!request.session) resolve();
    });
  }

  private requireUser(request: LocalRequest): string {
    const userId = request.session?.local?.userId;
    if (!userId) throw new UnauthorizedException('Sign in first.');
    return userId;
  }

  /** For anything that changes credentials: half a sign-in does not qualify. */
  private requireAuthenticated(request: LocalRequest): string {
    const userId = this.requireUser(request);
    if (request.session?.local?.assurance !== 'authenticated') {
      throw new UnauthorizedException('Finish signing in first.');
    }
    return userId;
  }

  private async guardAttempt(key: string, ip?: string): Promise<void> {
    try {
      await this.limiter.consume(`addr:${ip ?? 'unknown'}`, this.byAddress);
    } catch (error) {
      // A bare 429 tells the client nothing; retryAfterSeconds makes it actionable.
      const seconds = error instanceof RateLimitExceeded ? error.retryAfterSeconds : 900;
      throw new HttpException(
        {
          message: 'Too many attempts. Wait fifteen minutes and try again.',
          details: { code: 'THROTTLED', retryAfterSeconds: seconds },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const account = await this.limiter.get(`acct:${this.budgetKey(key)}`);
    if (account && account.consumedPoints >= ACCOUNT_ATTEMPT_BUDGET) {
      // Same answer as a wrong password: a distinct one would confirm the account exists.
      throw new UnauthorizedException(SIGN_IN_FAILED);
    }
  }

  private async recordFailure(key: string): Promise<void> {
    await this.limiter.consume(`acct:${this.budgetKey(key)}`, this.byAccount).catch((error: unknown) => {
      // Silence here means failures stop being counted and nobody is told.
      this.logger.warn({ err: error }, 'Could not record a failed sign-in attempt.');
    });
  }

  /**
   * Clears the ACCOUNT budget only.
   *
   * The per-address budget deliberately survives a success. Clearing it would let
   * an attacker holding one valid account interleave a sign-in every few guesses
   * and get unlimited attempts from a single address — which is the exact thing
   * the address budget exists to stop.
   */
  private async resetAttempts(key: string): Promise<void> {
    await this.limiter.delete(`acct:${this.budgetKey(key)}`);
  }

  /** Budgets are keyed on a digest: an email address is PII and this table is operational. */
  private budgetKey(value: string): string {
    return hashToken(value.toLowerCase());
  }

  private link(path: string, token: string): string {
    const base = (this.config.get<string>('email.portalBaseUrl') ?? '').replace(/\/+$/, '');
    return `${base}/${path}/${token}`;
  }

  /** Delivery is best effort: a transport problem must not undo the thing that caused it. */
  private async send(address: string, subject: string, text: string): Promise<string> {
    try {
      const result = await this.email.send({ to: [{ address }], subject, text });
      return result.status;
    } catch (error) {
      this.logger.warn(
        { err: error instanceof Error ? error.message : 'unknown' },
        'Local auth email failed',
      );
      return 'failed';
    }
  }

  private async audit(
    action: string,
    userId: string | null,
    groupId: string | null,
    ip: string | undefined,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    // Every refusal answers "Those sign-in details are not correct.", deliberately, so
    // nobody can probe which accounts exist. That leaves the real reason in audit_event
    // and nowhere else, which makes a local sign-in failure undiagnosable without SQL.
    // Outside production, say it in the log as well. The HTTP response is untouched, so
    // this reveals nothing to a caller - only to whoever runs the server.
    if (action.endsWith('.failed') && this.config.get<string>('env') !== 'production') {
      this.logger.warn(
        { action, userId, reason: metadata.reason ?? 'unspecified' },
        'Local sign-in refused',
      );
    }

    try {
      await this.repository.auditAuthEvent(action, userId, groupId, metadata, ip ?? null);
    } catch (error) {
      // A missing audit row must never be the reason a sign-in fails.
      this.logger.error(
        { err: error instanceof Error ? error.message : 'unknown', action },
        'Local auth audit write failed',
      );
    }
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token.trim(), 'utf8').digest('hex');
}

export function createLinkToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

export { CHALLENGE_TTL_MINUTES };
