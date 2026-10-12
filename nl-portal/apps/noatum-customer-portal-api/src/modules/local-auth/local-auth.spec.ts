import type { ConfigService } from '@nestjs/config';

import { MfaService, hashRecoveryCode } from './mfa.service';
import { PasswordService } from './password.service';
import { hashSessionId } from './session-store';
import { LocalAuthService, createLinkToken, hashToken } from './local-auth.service';

/** Not run by CI on its own; part of `pnpm test` in the API app. */
describe('local auth', () => {
  describe('PasswordService', () => {
    const passwords = new PasswordService();

    beforeAll(async () => {
      await passwords.onModuleInit();
    });

    it('produces an argon2id hash that verifies', async () => {
      const hash = await passwords.hash('correct horse battery staple');
      expect(hash.startsWith('$argon2id$')).toBe(true);
      await expect(passwords.verify(hash, 'correct horse battery staple')).resolves.toBe(true);
    });

    it('refuses the wrong password', async () => {
      const hash = await passwords.hash('correct horse battery staple');
      await expect(passwords.verify(hash, 'correct horse battery stapl')).resolves.toBe(false);
    });

    it('salts, so the same password never yields the same hash', async () => {
      const [first, second] = await Promise.all([passwords.hash('same input'), passwords.hash('same input')]);
      expect(first).not.toEqual(second);
    });

    it('treats a corrupt stored hash as a failed sign-in, not an error', async () => {
      await expect(passwords.verify('not-a-hash', 'anything')).resolves.toBe(false);
    });

    it('spends work even when there is nothing to verify against', async () => {
      await expect(passwords.verifyDummy()).resolves.toBe(false);
    });

    it('does not ask for a rehash of a hash it just made', async () => {
      const hash = await passwords.hash('correct horse battery staple');
      expect(passwords.needsRehash(hash)).toBe(false);
    });
  });

  describe('MfaService', () => {
    const key = Buffer.alloc(32, 7).toString('base64');
    const config = {
      get: (name: string) => (name === 'localAuth.mfaEncryptionKey' ? key : true),
    } as unknown as ConfigService;
    const mfa = new MfaService(config);

    it('issues a scannable enrolment for the signed-in address', () => {
      const enrolment = mfa.createEnrolment('someone@example.test');
      expect(enrolment.secret).toMatch(/^[A-Z2-7]+$/);
      expect(enrolment.uri).toContain('otpauth://totp/');
      expect(enrolment.uri).toContain('Noatum%20Logistics');
    });

    it('round-trips the secret through encryption', () => {
      const stored = mfa.encryptSecret('JBSWY3DPEHPK3PXP');
      expect(stored).not.toContain('JBSWY3DPEHPK3PXP');
      expect(mfa.decryptSecret(stored)).toBe('JBSWY3DPEHPK3PXP');
    });

    it('reports a tampered secret as absent rather than throwing', () => {
      const stored = mfa.encryptSecret('JBSWY3DPEHPK3PXP');
      const tampered = `${stored.slice(0, -4)}AAAA`;
      expect(mfa.decryptSecret(tampered)).toBeNull();
    });

    it('rejects anything that is not six digits without touching the secret', async () => {
      await expect(mfa.checkCode('JBSWY3DPEHPK3PXP', '12345')).resolves.toBeNull();
      await expect(mfa.checkCode('JBSWY3DPEHPK3PXP', 'abcdef')).resolves.toBeNull();
    });

    it('issues ten single-use recovery codes and keeps only their hashes', () => {
      const { codes, hashes } = mfa.createRecoveryCodes();
      expect(codes).toHaveLength(10);
      expect(new Set(codes).size).toBe(10);
      for (const code of codes) expect(code).toMatch(/^[2-9A-HJ-NP-TV-Z]{5}-[2-9A-HJ-NP-TV-Z]{5}$/);
      expect(hashes).toEqual(codes.map((code) => hashRecoveryCode(code)));
    });

    it('accepts a recovery code however the person types it', () => {
      expect(hashRecoveryCode(' abcde-fghjk ')).toEqual(hashRecoveryCode('ABCDE-FGHJK'));
    });
  });

  describe('tokens', () => {
    it('never stores the value that was emailed', () => {
      const { token, tokenHash } = createLinkToken();
      expect(tokenHash).toHaveLength(64);
      expect(tokenHash).not.toContain(token);
      expect(hashToken(token)).toEqual(tokenHash);
    });

    it('hashes the session id, so a database reader cannot replay a session', () => {
      expect(hashSessionId('abc')).toHaveLength(64);
      expect(hashSessionId('abc')).not.toContain('abc');
      expect(hashSessionId('abc')).toEqual(hashSessionId('abc'));
      expect(hashSessionId('abc')).not.toEqual(hashSessionId('abd'));
    });
  });

  describe('who must hold a second factor', () => {
    const ask = (exempt: string[], isInternal: boolean, email: string | null) => {
      const service = new LocalAuthService(
        undefined as never,
        undefined as never,
        undefined as never,
        undefined as never,
        {
          get: (key: string) => (key === 'localAuth.passwordOnlyStaff' ? exempt : undefined),
        } as unknown as ConfigService,
        undefined as never,
      );
      const reach = service as unknown as {
        secondFactorRequired(isInternal: boolean, email: string | null): boolean;
      };
      return reach.secondFactorRequired(isInternal, email);
    };

    it('never asks a customer for one', () => {
      expect(ask([], false, 'someone@customer.test')).toBe(false);
    });

    it('asks every staff account by default', () => {
      expect(ask([], true, 'pricing@adports.ae')).toBe(true);
    });

    it('exempts a named staff account', () => {
      expect(ask(['pricing@adports.ae'], true, 'pricing@adports.ae')).toBe(false);
    });

    it('still asks a staff account the list does not name', () => {
      expect(ask(['pricing@adports.ae'], true, 'ops@adports.ae')).toBe(true);
    });

    it('matches regardless of case, since an address is not case sensitive', () => {
      expect(ask(['pricing@adports.ae'], true, 'Pricing@AdPorts.ae')).toBe(false);
    });

    it('asks when the account has no address to match on', () => {
      expect(ask(['pricing@adports.ae'], true, null)).toBe(true);
    });
  });

  describe('which tab an account may sign in through', () => {
    const allowed = (isInternal: boolean, audience: 'customer' | 'staff' | undefined) => {
      const service = new LocalAuthService(
        undefined as never,
        undefined as never,
        undefined as never,
        undefined as never,
        { get: () => undefined } as unknown as ConfigService,
        undefined as never,
      );
      const reach = service as unknown as {
        audienceAllowed(isInternal: boolean, audience: 'customer' | 'staff' | undefined): boolean;
      };
      return reach.audienceAllowed(isInternal, audience);
    };

    it('lets a customer in through the customer tab', () => {
      expect(allowed(false, 'customer')).toBe(true);
    });

    it('lets a staff account in through the employee tab', () => {
      expect(allowed(true, 'staff')).toBe(true);
    });

    it('refuses a customer on the employee tab', () => {
      expect(allowed(false, 'staff')).toBe(false);
    });

    it('refuses a staff account on the customer tab', () => {
      expect(allowed(true, 'customer')).toBe(false);
    });

    it('lets an older client through, which sends no audience', () => {
      expect(allowed(false, undefined)).toBe(true);
      expect(allowed(true, undefined)).toBe(true);
    });
  });
});
