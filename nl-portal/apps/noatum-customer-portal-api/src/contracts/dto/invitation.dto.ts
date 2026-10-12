import { createHash, randomBytes } from 'node:crypto';

import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const InviteAdministratorSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(254),
  /** Set only when the address is outside the customer's domains, and recorded. */
  domainOverrideReason: z.string().trim().max(400).nullable().default(null),
  reason: z.string().trim().min(1).max(400),
});
export type InviteAdministrator = z.infer<typeof InviteAdministratorSchema>;

export class InviteAdministratorDto {
  @ApiProperty() displayName!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ type: String, nullable: true }) domainOverrideReason!: string | null;
  @ApiProperty() reason!: string;
}

export class InvitationDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: ['pending', 'accepted', 'expired', 'revoked'] }) status!: string;
  @ApiProperty() expiresAt!: string;
  @ApiProperty({ type: String, nullable: true }) acceptedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) invitedByName!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ enum: ['sent', 'queued', 'not-configured', 'failed'] })
  emailStatus!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'The single-use link, returned ONLY on creation and only while no email transport is configured, so staff can pass it on themselves.',
  })
  inviteLink!: string | null;
}

/**
 * Invitation tokens.
 *
 * The raw token is shown once and never stored; only its SHA-256 hash is kept, so a
 * database leak cannot be turned into a working invitation.
 */
export function createInvitationToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Seven days: long enough for a holiday, short enough to matter. */
export const INVITATION_TTL_DAYS = 7;
