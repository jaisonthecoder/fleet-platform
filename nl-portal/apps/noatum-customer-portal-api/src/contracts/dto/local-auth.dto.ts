import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;
/** Bounded so a multi-megabyte body cannot turn one sign-in into a denial of service. */
export const PASSWORD_MAX_LENGTH = 200;

/**
 * Eight characters with all four character classes, so "P@ssw0rd" is accepted.
 *
 * Worth knowing what this trades away: NIST SP 800-63B advises length over composition,
 * because a short password forced through a composition rule lands on the handful of
 * shapes people already use. Accepting eight characters makes a blocked-password list
 * the thing that actually protects these accounts, and there is not one yet - see
 * docs/gaps.md.
 */
const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH)
  .refine(
    (value) =>
      /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value),
    'Use an upper-case letter, a lower-case letter, a number and a symbol.',
  );

const email = z.string().trim().toLowerCase().email().max(254);

/** Which sign-in tab the attempt came from. A staff account may not enter through the
 * customer tab, nor a customer through the employee tab. */
export const SignInAudienceSchema = z.enum(['customer', 'staff']);
export type SignInAudience = z.infer<typeof SignInAudienceSchema>;

export const LocalLoginSchema = z.strictObject({
  email,
  // Not length-checked on the way in: an old password that no longer meets the rule
  // must still be able to sign in and be asked to change.
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  // Optional so an older client keeps working; when absent no audience rule applies.
  audience: SignInAudienceSchema.optional(),
});
export type LocalLogin = z.infer<typeof LocalLoginSchema>;

export const LocalMfaVerifySchema = z
  .strictObject({
    code: z.string().trim().regex(/^\d{6}$/).optional(),
    recoveryCode: z.string().trim().min(8).max(20).optional(),
  })
  .refine((value) => Boolean(value.code) !== Boolean(value.recoveryCode), {
    message: 'Give either a six-digit code or one recovery code.',
  });
export type LocalMfaVerify = z.infer<typeof LocalMfaVerifySchema>;

export const LocalActivateSchema = z.strictObject({
  token: z.string().trim().min(20).max(200),
  password,
});
export type LocalActivate = z.infer<typeof LocalActivateSchema>;

export const LocalPasswordResetRequestSchema = z.strictObject({ email });
export type LocalPasswordResetRequest = z.infer<typeof LocalPasswordResetRequestSchema>;

export const LocalPasswordChangeSchema = z.strictObject({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  newPassword: password,
});
export type LocalPasswordChange = z.infer<typeof LocalPasswordChangeSchema>;

export const LocalMfaConfirmSchema = z.strictObject({
  code: z.string().trim().regex(/^\d{6}$/),
});
export type LocalMfaConfirm = z.infer<typeof LocalMfaConfirmSchema>;

/** Re-entering the password is what makes weakening your own protection a deliberate act. */
export const LocalPasswordConfirmSchema = z.strictObject({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});
export type LocalPasswordConfirm = z.infer<typeof LocalPasswordConfirmSchema>;

export class LocalPasswordConfirmDto {
  @ApiProperty() currentPassword!: string;
}

/** What the signed-in person may know about their own sign-in. */
export class LocalAccountStatusDto {
  @ApiProperty() email!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() hasPassword!: boolean;
  @ApiProperty({ type: String, nullable: true }) passwordSetAt!: string | null;
  @ApiProperty() mfaEnrolled!: boolean;
  @ApiProperty({ description: 'Unused recovery codes left. Below three is worth acting on.' })
  recoveryCodesLeft!: number;
  @ApiProperty({ description: 'Including this one.' }) activeSessions!: number;
  @ApiProperty({ description: 'True when a second factor cannot be removed, only replaced.' })
  mfaRequired!: boolean;
  @ApiProperty() csrfToken!: string;
}

export class LocalLoginDto {
  @ApiProperty() email!: string;
  @ApiProperty() password!: string;
  @ApiProperty({ required: false, enum: ['customer', 'staff'] }) audience?: 'customer' | 'staff';
}

export class LocalActivateDto {
  @ApiProperty() token!: string;
  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH }) password!: string;
}

export class LocalMfaVerifyDto {
  @ApiProperty({ required: false }) code?: string;
  @ApiProperty({ required: false }) recoveryCode?: string;
}

export class LocalMfaConfirmDto {
  @ApiProperty() code!: string;
}

export class LocalPasswordChangeDto {
  @ApiProperty() currentPassword!: string;
  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH }) newPassword!: string;
}

export class LocalPasswordResetRequestDto {
  @ApiProperty() email!: string;
}

/**
 * The single answer every sign-in step gives, so the SPA has one thing to branch on
 * rather than inferring state from status codes.
 */
export class LocalSessionDto {
  @ApiProperty({
    enum: ['authenticated', 'mfa_required', 'mfa_enrolment_required'],
    description:
      'authenticated: done. mfa_required: a code is needed. mfa_enrolment_required: a second factor must be set up before anything else.',
  })
  state!: 'authenticated' | 'mfa_required' | 'mfa_enrolment_required';

  @ApiProperty() email!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ description: 'Send this in x-csrf-token on every state-changing request.' })
  csrfToken!: string;
}

export class LocalActivationSubjectDto {
  @ApiProperty() email!: string;
  @ApiProperty() displayName!: string;
}

export class LocalMfaEnrolmentDto {
  @ApiProperty({ description: 'Base32 secret, for keying in by hand.' }) secret!: string;
  @ApiProperty({ description: 'otpauth:// URI for the QR code.' }) uri!: string;
}

export class LocalRecoveryCodesDto {
  @ApiProperty({
    type: [String],
    description: 'Shown once. Only hashes are kept, so this list cannot be re-issued.',
  })
  codes!: string[];
}

export class LocalSignOutEverywhereDto {
  @ApiProperty({
    description:
      'Sessions ended besides the one that asked. Zero is a normal answer, not a failure: it means this was the only session.',
  })
  revoked!: number;
}
