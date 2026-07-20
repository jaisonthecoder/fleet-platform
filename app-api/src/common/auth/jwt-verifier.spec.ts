import type { ConfigType } from '@nestjs/config';
import type { identityConfig } from '../config/identity.config';
import { JwtVerifier } from './jwt-verifier';

type Jose = typeof import('jose');

const config = {
  issuer: 'https://test.issuer/v2.0',
  apiAudience: 'api://fleet',
  apiClientId: 'client-id',
  entraConfigured: true,
  jwksUri: 'https://example.test/keys',
} as unknown as ConfigType<typeof identityConfig>;

describe('JwtVerifier (real jose crypto)', () => {
  let jose: Jose;
  let privateKey: CryptoKey;
  let keySet: ReturnType<Jose['createLocalJWKSet']>;
  let verifier: JwtVerifier;

  beforeAll(async () => {
    jose = await import('jose');
    const pair = await jose.generateKeyPair('RS256', { extractable: true });
    privateKey = pair.privateKey as CryptoKey;
    const jwk = await jose.exportJWK(pair.publicKey);
    jwk.kid = 'test-key';
    jwk.alg = 'RS256';
    keySet = jose.createLocalJWKSet({ keys: [jwk] });
    verifier = new JwtVerifier(config);
  });

  const sign = (
    claims: Record<string, unknown>,
    opts: { issuer?: string; audience?: string; exp?: string; kid?: string; key?: CryptoKey } = {},
  ) =>
    new jose.SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: opts.kid ?? 'test-key' })
      .setIssuedAt()
      .setIssuer(opts.issuer ?? 'https://test.issuer/v2.0')
      .setAudience(opts.audience ?? 'api://fleet')
      .setExpirationTime(opts.exp ?? '5m')
      .sign(opts.key ?? privateKey);

  it('verifies a valid token and extracts oid/email/name', async () => {
    const token = await sign({ oid: 'user-oid', name: 'Jane', preferred_username: 'jane@x.ae' });
    const claims = await verifier.verifyWith(token, keySet);
    expect(claims).toEqual({ oid: 'user-oid', email: 'jane@x.ae', name: 'Jane' });
  });

  it('rejects a wrong audience', async () => {
    const token = await sign({ oid: 'u' }, { audience: 'api://other' });
    await expect(verifier.verifyWith(token, keySet)).rejects.toThrow();
  });

  it('rejects a wrong issuer', async () => {
    const token = await sign({ oid: 'u' }, { issuer: 'https://evil.test' });
    await expect(verifier.verifyWith(token, keySet)).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const token = await sign({ oid: 'u' }, { exp: '-1m' });
    await expect(verifier.verifyWith(token, keySet)).rejects.toThrow();
  });

  it('rejects a token signed by an unknown key', async () => {
    const other = await jose.generateKeyPair('RS256', { extractable: true });
    const token = await sign({ oid: 'u' }, { kid: 'other', key: other.privateKey as CryptoKey });
    await expect(verifier.verifyWith(token, keySet)).rejects.toThrow();
  });

  it('rejects a token missing a subject/oid', async () => {
    const token = await sign({ name: 'no-subject' });
    await expect(verifier.verifyWith(token, keySet)).rejects.toThrow();
  });
});
