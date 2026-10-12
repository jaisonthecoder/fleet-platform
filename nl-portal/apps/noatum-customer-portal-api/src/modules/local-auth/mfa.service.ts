import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from 'node:crypto';

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateSecret, generateURI, verify } from 'otplib';

const PERIOD_SECONDS = 30;
/** One step either side, expressed in seconds: enough for a slow thumb and clock drift. */
const EPOCH_TOLERANCE_SECONDS = 30;
const RECOVERY_CODE_COUNT = 10;
/** Crockford-style: no I, L, O, U, so a code read off paper cannot be mistyped. */
const RECOVERY_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

export interface TotpEnrolment {
  secret: string;
  uri: string;
}

/**
 * Time-based second factor.
 *
 * The shared secret is the one piece of local-auth data that is reversible by design -
 * verifying a code needs the original, not a hash - so it is encrypted at rest under a
 * key held outside the database. A database copy alone yields no working factor.
 */
@Injectable()
export class MfaService {
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const raw = this.config.get<string>('localAuth.mfaEncryptionKey') ?? '';
    const key = raw ? Buffer.from(raw, 'base64') : Buffer.alloc(0);
    if (this.config.get<boolean>('localAuth.enabled') && key.length !== 32) {
      throw new InternalServerErrorException(
        'LOCAL_AUTH_MFA_KEY must be 32 bytes, base64 encoded.',
      );
    }
    this.key = key;
  }

  createEnrolment(email: string): TotpEnrolment {
    const secret = generateSecret();
    return {
      secret,
      uri: generateURI({ issuer: 'Noatum Logistics', label: email, secret }),
    };
  }

  /**
   * Returns the time step a valid code came from, so the caller can refuse a code that
   * has already been spent. Null means the code is wrong.
   */
  async checkCode(secret: string, token: string): Promise<number | null> {
    if (!/^\d{6}$/.test(token)) return null;
    try {
      const result = await verify({
        secret,
        token,
        period: PERIOD_SECONDS,
        epochTolerance: EPOCH_TOLERANCE_SECONDS,
      });
      if (!result.valid) return null;
      const { timeStep } = result as { timeStep?: number };
      return typeof timeStep === 'number' ? timeStep : null;
    } catch {
      return null;
    }
  }

  encryptSecret(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const body = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), body].map((part) => part.toString('base64')).join('.');
  }

  decryptSecret(stored: string): string | null {
    const parts = stored.split('.');
    if (parts.length !== 3) return null;
    try {
      const [iv, tag, body] = parts.map((part) => Buffer.from(part, 'base64'));
      const decipher = createDecipheriv('aes-256-gcm', this.key, iv!);
      decipher.setAuthTag(tag!);
      return Buffer.concat([decipher.update(body!), decipher.final()]).toString('utf8');
    } catch {
      // A key rotation or a tampered row: treat as no factor rather than a 500.
      return null;
    }
  }

  /** Shown once. Only the hashes are kept, so the list cannot be rebuilt from a backup. */
  createRecoveryCodes(): { codes: string[]; hashes: string[] } {
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => {
      const body = Array.from({ length: 10 }, () =>
        RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)],
      ).join('');
      return `${body.slice(0, 5)}-${body.slice(5)}`;
    });
    return { codes, hashes: codes.map((code) => hashRecoveryCode(code)) };
  }
}

/** Random and high-entropy, so a fast digest is the right tool - this is not a password. */
export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase(), 'utf8').digest('hex');
}
