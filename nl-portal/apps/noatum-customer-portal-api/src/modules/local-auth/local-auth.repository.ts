import { Injectable } from '@nestjs/common';

import type { ResolvedIdentity } from '../../common/guards/auth.guard';
import { PrismaService } from '../../common/tenancy/prisma.service';

export type ChallengePurpose = 'activation' | 'password_reset' | 'mfa_enrolment' | 'bootstrap';
export type SessionAssurance = 'pending_mfa' | 'authenticated';

export interface LoginCandidate {
  userId: string;
  status: string;
  isInternal: boolean;
  customerGroupId: string | null;
  passwordHash: string | null;
  securityVersion: number;
  credentialDisabled: boolean;
  mfaEnrolled: boolean;
}

export interface StoredSession {
  userId: string;
  assurance: SessionAssurance;
  data: Record<string, unknown>;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
}

export interface ChallengeSubject {
  challengeId: string;
  userId: string;
  invitationId: string | null;
  email: string;
  displayName: string;
}

export interface PasswordSetResult {
  userId: string;
  securityVersion: number;
  email: string;
  mfaEnrolled: boolean;
}

export interface MfaFactor {
  secretEncrypted: string;
  confirmed: boolean;
  lastUsedStep: number | null;
}

/** What a staff screen may know about someone's sign-in. Never the hash or the secret. */
export interface AccountSecurity {
  hasPassword: boolean;
  credentialDisabled: boolean;
  passwordSetAt: string | null;
  mfaEnrolled: boolean;
  recoveryCodesLeft: number;
  activeSessions: number;
  pendingActivationLink: boolean;
  /** When the live invitation or reset link runs out, so a screen can say so. */
  pendingLinkExpiresAt: string | null;
}

interface IdentityRow {
  user_id: string;
  customer_group_id: string | null;
  customer_group_status: string | null;
  is_internal: boolean;
  status: string;
  display_name: string;
  email: string;
  branch_code: string | null;
  branch_name: string | null;
  region_code: string | null;
  region_name: string | null;
  role_keys: string[] | null;
  permissions: string[] | null;
  account_ids: string[] | null;
}

/**
 * The only door to the local_* tables.
 *
 * portal_app holds no privilege on any of them, so every call here goes through an
 * app.local_* SECURITY DEFINER function that answers one question. There is no
 * general read, and nothing in this file can be widened into one without a migration.
 */
@Injectable()
export class LocalAuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns a row for a known email whether or not a credential exists, so the caller
   * can spend the same time on a dummy verification and not leak who is enrolled.
   */
  async findLoginCandidate(email: string): Promise<LoginCandidate | null> {
    const rows = await this.prisma.$queryRaw<
      {
        user_id: string;
        status: string;
        is_internal: boolean;
        customer_group_id: string | null;
        password_hash: string | null;
        security_version: number;
        credential_disabled: boolean;
        mfa_enrolled: boolean;
      }[]
    >`SELECT user_id, status, is_internal, customer_group_id, password_hash,
             security_version, credential_disabled, mfa_enrolled
        FROM app.local_credential_for_login(${email})`;

    const row = rows[0];
    if (!row) return null;

    return {
      userId: row.user_id,
      status: row.status,
      isInternal: row.is_internal,
      customerGroupId: row.customer_group_id,
      passwordHash: row.password_hash,
      securityVersion: Number(row.security_version),
      credentialDisabled: row.credential_disabled,
      mfaEnrolled: row.mfa_enrolled,
    };
  }

  /** Returns the security version now in force, which pins any session issued next. */
  async setPassword(userId: string, passwordHash: string, bumpVersion = true): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ local_credential_set: number }[]>`
      SELECT app.local_credential_set(${userId}::uuid, ${passwordHash}, ${bumpVersion})`;
    return Number(rows[0]?.local_credential_set ?? 0);
  }

  async loadSession(tokenHash: string): Promise<StoredSession | null> {
    const rows = await this.prisma.$queryRaw<
      {
        user_id: string;
        assurance: SessionAssurance;
        data: Record<string, unknown>;
        idle_expires_at: Date;
        absolute_expires_at: Date;
      }[]
    >`SELECT user_id, assurance, data, idle_expires_at, absolute_expires_at
        FROM app.local_session_load(${tokenHash})`;

    const row = rows[0];
    if (!row) return null;

    return {
      userId: row.user_id,
      assurance: row.assurance,
      data: row.data ?? {},
      idleExpiresAt: row.idle_expires_at,
      absoluteExpiresAt: row.absolute_expires_at,
    };
  }

  /** False when the row was revoked or has expired: a late write must not revive it. */
  async saveSession(input: {
    tokenHash: string;
    userId: string;
    assurance: SessionAssurance;
    securityVersion: number;
    data: Record<string, unknown>;
    idleExpiresAt: Date;
    absoluteExpiresAt: Date;
  }): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ local_session_save: boolean }[]>`
      SELECT app.local_session_save(
        ${input.tokenHash},
        ${input.userId}::uuid,
        ${input.assurance},
        ${input.securityVersion},
        ${JSON.stringify(input.data)}::jsonb,
        ${input.idleExpiresAt},
        ${input.absoluteExpiresAt}
      )`;
    return rows[0]?.local_session_save ?? false;
  }

  async touchSession(tokenHash: string, idleExpiresAt: Date): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ local_session_touch: boolean }[]>`
      SELECT app.local_session_touch(${tokenHash}, ${idleExpiresAt})`;
    return rows[0]?.local_session_touch ?? false;
  }

  async destroySession(tokenHash: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ local_session_destroy: boolean }[]>`
      SELECT app.local_session_destroy(${tokenHash})`;
    return rows[0]?.local_session_destroy ?? false;
  }

  async revokeUserSessions(userId: string, exceptTokenHash?: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ local_session_revoke_user: number }[]>`
      SELECT app.local_session_revoke_user(${userId}::uuid, ${exceptTokenHash ?? null})`;
    return Number(rows[0]?.local_session_revoke_user ?? 0);
  }

  async issueChallenge(input: {
    userId: string;
    purpose: ChallengePurpose;
    tokenHash: string;
    expiresAt: Date;
    invitationId?: string | null;
    supersede?: boolean;
  }): Promise<string> {
    const rows = await this.prisma.$queryRaw<{ local_challenge_issue: string }[]>`
      SELECT app.local_challenge_issue(
        ${input.userId}::uuid,
        ${input.purpose},
        ${input.tokenHash},
        ${input.expiresAt},
        ${input.invitationId ?? null}::uuid,
        ${input.supersede ?? true}
      )`;
    return rows[0]!.local_challenge_issue;
  }

  /** Checks a link without spending it, so an email scanner cannot burn an invitation. */
  async peekChallenge(
    purpose: ChallengePurpose,
    tokenHash: string,
  ): Promise<ChallengeSubject | null> {
    const rows = await this.prisma.$queryRaw<
      {
        challenge_id: string;
        user_id: string;
        invitation_id: string | null;
        email: string;
        display_name: string;
      }[]
    >`SELECT challenge_id, user_id, invitation_id, email, display_name
        FROM app.local_challenge_peek(${purpose}, ${tokenHash})`;

    const row = rows[0];
    if (!row) return null;

    return {
      challengeId: row.challenge_id,
      userId: row.user_id,
      invitationId: row.invitation_id,
      email: row.email,
      displayName: row.display_name,
    };
  }

  /** Atomic: two simultaneous activations of one link cannot both win. */
  async consumeChallenge(
    purpose: ChallengePurpose,
    tokenHash: string,
  ): Promise<{ challengeId: string; userId: string; invitationId: string | null } | null> {
    const rows = await this.prisma.$queryRaw<
      { challenge_id: string; user_id: string; invitation_id: string | null }[]
    >`SELECT challenge_id, user_id, invitation_id
        FROM app.local_challenge_consume(${purpose}, ${tokenHash})`;

    const row = rows[0];
    if (!row) return null;

    return { challengeId: row.challenge_id, userId: row.user_id, invitationId: row.invitation_id };
  }

  /**
   * Same projection app.resolve_identity gives a staff token, keyed on the portal user
   * id a local session carries. Both sign-in paths therefore read one set of roles.
   */
  async resolveIdentityById(userId: string): Promise<ResolvedIdentity | null> {
    const rows = await this.prisma.$queryRaw<IdentityRow[]>`
      SELECT user_id, customer_group_id, customer_group_status, is_internal, status, display_name, email,
             branch_code, branch_name, region_code, region_name, role_keys, permissions, account_ids
        FROM app.resolve_identity_by_id(${userId}::uuid)`;

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.user_id,
      customerGroupId: row.customer_group_id,
      customerGroupStatus: row.customer_group_status,
      displayName: row.display_name,
      email: row.email,
      branchCode: row.branch_code,
      branchName: row.branch_name,
      regionCode: row.region_code,
      regionName: row.region_name,
      roleKeys: row.role_keys ?? [],
      isInternal: row.is_internal,
      status: row.status,
      accountIds: row.account_ids ?? [],
      permissions: row.permissions ?? [],
    };
  }

  async cleanup(retainDays = 30): Promise<{ sessions: number; challenges: number }> {
    const rows = await this.prisma.$queryRaw<
      { sessions_removed: number; challenges_removed: number }[]
    >`SELECT sessions_removed, challenges_removed FROM app.local_auth_cleanup(${retainDays})`;

    return {
      sessions: Number(rows[0]?.sessions_removed ?? 0),
      challenges: Number(rows[0]?.challenges_removed ?? 0),
    };
  }

  /**
   * Spends the challenge and brings the password into force in one statement, so a
   * failure can never leave a burnt link with no password behind it.
   */
  async setPasswordFromChallenge(
    purpose: ChallengePurpose,
    tokenHash: string,
    passwordHash: string,
  ): Promise<PasswordSetResult | null> {
    const rows = await this.prisma.$queryRaw<
      { user_id: string; security_version: number; email: string; mfa_enrolled: boolean }[]
    >`SELECT user_id, security_version, email, mfa_enrolled
        FROM app.local_password_set_from_challenge(
          ${purpose}::local_challenge_purpose, ${tokenHash}, ${passwordHash})`;

    const row = rows[0];
    if (!row) return null;

    return {
      userId: row.user_id,
      securityVersion: Number(row.security_version),
      email: row.email,
      mfaEnrolled: row.mfa_enrolled,
    };
  }

  async provisionBootstrapAdmin(input: {
    email: string;
    displayName: string;
    roleKey: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<{ userId: string; created: boolean; roleGranted: boolean }> {
    const rows = await this.prisma.$queryRaw<
      { user_id: string; created: boolean; role_granted: boolean }[]
    >`SELECT user_id, created, role_granted
        FROM app.local_bootstrap_admin(
          ${input.email}, ${input.displayName}, ${input.roleKey},
          ${input.tokenHash}, ${input.expiresAt})`;

    const row = rows[0]!;
    return { userId: row.user_id, created: row.created, roleGranted: row.role_granted };
  }

  async beginMfaEnrolment(userId: string, secretEncrypted: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ local_mfa_begin: boolean }[]>`
      SELECT app.local_mfa_begin(${userId}::uuid, ${secretEncrypted})`;
    return rows[0]?.local_mfa_begin ?? false;
  }

  async mfaFactor(userId: string): Promise<MfaFactor | null> {
    const rows = await this.prisma.$queryRaw<
      { secret_encrypted: string; confirmed: boolean; last_used_step: bigint | null }[]
    >`SELECT secret_encrypted, confirmed, last_used_step FROM app.local_mfa_factor_get(${userId}::uuid)`;

    const row = rows[0];
    if (!row) return null;

    return {
      secretEncrypted: row.secret_encrypted,
      confirmed: row.confirmed,
      lastUsedStep: row.last_used_step === null ? null : Number(row.last_used_step),
    };
  }

  /** False when that time step has already been spent, which is a replayed code. */
  async useMfaStep(userId: string, step: number, confirm = false): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ local_mfa_use_step: boolean }[]>`
      SELECT app.local_mfa_use_step(${userId}::uuid, ${BigInt(step)}, ${confirm})`;
    return rows[0]?.local_mfa_use_step ?? false;
  }

  async replaceRecoveryCodes(userId: string, hashes: string[]): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ local_recovery_codes_replace: number }[]>`
      SELECT app.local_recovery_codes_replace(${userId}::uuid, ${hashes})`;
    return Number(rows[0]?.local_recovery_codes_replace ?? 0);
  }

  async useRecoveryCode(userId: string, codeHash: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ local_recovery_code_use: boolean }[]>`
      SELECT app.local_recovery_code_use(${userId}::uuid, ${codeHash})`;
    return rows[0]?.local_recovery_code_use ?? false;
  }

  async recoveryCodesRemaining(userId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ local_recovery_codes_remaining: number }[]>`
      SELECT app.local_recovery_codes_remaining(${userId}::uuid)`;
    return Number(rows[0]?.local_recovery_codes_remaining ?? 0);
  }

  async resetMfa(userId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ local_mfa_reset: boolean }[]>`
      SELECT app.local_mfa_reset(${userId}::uuid)`;
    return rows[0]?.local_mfa_reset ?? false;
  }

  /** Clears the factor without ending sessions, for someone changing their own phone. */
  async restartMfa(userId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ local_mfa_restart: boolean }[]>`
      SELECT app.local_mfa_restart(${userId}::uuid)`;
    return rows[0]?.local_mfa_restart ?? false;
  }

  async promoteSession(tokenHash: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ local_session_promote: boolean }[]>`
      SELECT app.local_session_promote(${tokenHash})`;
    return rows[0]?.local_session_promote ?? false;
  }

  async recordLogin(userId: string): Promise<void> {
    // $executeRaw, not $queryRaw: the function returns void, which has no Prisma type.
    await this.prisma.$executeRaw`SELECT app.local_record_login(${userId}::uuid)`;
  }

  /**
   * Sign-in happens before there is a tenant context, and audit_event is behind RLS,
   * so the row goes in through a definer function that accepts auth.* actions only.
   */
  async auditAuthEvent(
    action: string,
    userId: string | null,
    customerGroupId: string | null,
    metadata: Record<string, unknown>,
    ip: string | null,
  ): Promise<void> {
    await this.prisma.$executeRaw`
      SELECT app.local_auth_audit(
        ${action},
        ${userId}::uuid,
        ${customerGroupId}::uuid,
        ${userId},
        ${JSON.stringify(metadata)}::jsonb,
        ${ip}
      )`;
  }

  /** Disabling also ends live sessions and cancels unspent links, or it achieves nothing. */
  async disableCredential(userId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ local_credential_disable: boolean }[]>`
      SELECT app.local_credential_disable(${userId}::uuid)`;
    return rows[0]?.local_credential_disable ?? false;
  }

  async enableCredential(userId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ local_credential_enable: boolean }[]>`
      SELECT app.local_credential_enable(${userId}::uuid)`;
    return rows[0]?.local_credential_enable ?? false;
  }

  async revokeChallenges(userId: string, purpose: ChallengePurpose): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ local_challenge_revoke: number }[]>`
      SELECT app.local_challenge_revoke(${userId}::uuid, ${purpose}::local_challenge_purpose)`;
    return Number(rows[0]?.local_challenge_revoke ?? 0);
  }

  /** One round trip for a page of users; never returns a hash or a secret. */
  async accountSecurity(userIds: string[]): Promise<Map<string, AccountSecurity>> {
    if (userIds.length === 0) return new Map();

    const rows = await this.prisma.$queryRaw<
      {
        user_id: string;
        has_password: boolean;
        credential_disabled: boolean;
        password_set_at: Date | null;
        mfa_enrolled: boolean;
        recovery_codes_left: number;
        active_sessions: number;
        pending_activation_link: boolean;
        pending_link_expires_at: Date | null;
      }[]
    >`SELECT user_id, has_password, credential_disabled, password_set_at, mfa_enrolled,
             recovery_codes_left, active_sessions, pending_activation_link, pending_link_expires_at
        FROM app.local_account_security(${userIds}::uuid[])`;

    return new Map(
      rows.map((row) => [
        row.user_id,
        {
          hasPassword: row.has_password,
          credentialDisabled: row.credential_disabled,
          passwordSetAt: row.password_set_at?.toISOString() ?? null,
          mfaEnrolled: row.mfa_enrolled,
          recoveryCodesLeft: Number(row.recovery_codes_left),
          activeSessions: Number(row.active_sessions),
          pendingActivationLink: row.pending_activation_link,
          pendingLinkExpiresAt: row.pending_link_expires_at?.toISOString() ?? null,
        },
      ]),
    );
  }
}
