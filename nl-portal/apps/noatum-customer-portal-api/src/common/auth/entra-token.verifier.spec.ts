import { generateKeyPairSync } from 'node:crypto';

import jwt from 'jsonwebtoken';

import {
  audiencesFor,
  createEntraVerifier,
  issuersFor,
  toClaims,
} from './entra-token.verifier';

const tenantId = '3b618463-9352-4fa4-a67c-112da2837c29';
const audience = '272ad497-0dd0-43a7-bc71-b92e94da1e47';
const [issuerV2, issuerV1] = issuersFor(tenantId);

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

function sign(payload: Record<string, unknown>, options: jwt.SignOptions = {}): string {
  return jwt.sign({ tid: tenantId, ...payload }, privateKey, {
    algorithm: 'RS256',
    keyid: 'test-key',
    issuer: issuerV2,
    audience,
    expiresIn: '5m',
    ...options,
  });
}

const verify = createEntraVerifier({ tenantId, audience }, async () => pem);

describe('Entra issuer and audience spellings', () => {
  it('accepts both issuer forms a tenant can stamp', () => {
    expect(issuersFor(tenantId)).toEqual([
      `https://login.microsoftonline.com/${tenantId}/v2.0`,
      `https://sts.windows.net/${tenantId}/`,
    ]);
  });

  it('accepts an audience configured either as a bare id or an application id uri', () => {
    expect(audiencesFor(audience)).toEqual([audience, `api://${audience}`]);
    expect(audiencesFor(`api://${audience}/user_impersonation`)).toEqual([
      `api://${audience}/user_impersonation`,
      audience,
    ]);
  });
});

describe('claim projection', () => {
  it('anchors on the object id, which survives a change of app registration', () => {
    expect(toClaims({ iss: issuerV2, oid: 'object-id', sub: 'pairwise-subject' }).subject).toBe(
      'object-id',
    );
  });

  it('falls back to the subject only when no object id is present', () => {
    expect(toClaims({ iss: issuerV2, sub: 'pairwise-subject' }).subject).toBe('pairwise-subject');
  });

  it('reads the email from whichever claim carries it', () => {
    expect(toClaims({ iss: issuerV2, oid: 'o', upn: 'upn@test' }).email).toBe('upn@test');
    expect(toClaims({ iss: issuerV2, oid: 'o', preferred_username: 'pu@test' }).email).toBe(
      'pu@test',
    );
  });

  it('refuses a token with no usable identity', () => {
    expect(() => toClaims({ iss: issuerV2 })).toThrow();
  });
});

describe('token verification', () => {
  it('accepts a correctly signed v2 token', async () => {
    await expect(verify(sign({ oid: 'oid-1', preferred_username: 'staff@adports.ae' }))).resolves
      .toMatchObject({ issuer: issuerV2, subject: 'oid-1', email: 'staff@adports.ae' });
  });

  it('accepts a v1 token, so validation does not depend on the registration token version', async () => {
    await expect(verify(sign({ oid: 'oid-1' }, { issuer: issuerV1 }))).resolves.toMatchObject({
      issuer: issuerV1,
    });
  });

  it('accepts the application id uri spelling of the audience', async () => {
    await expect(verify(sign({ oid: 'oid-1' }, { audience: `api://${audience}` }))).resolves
      .toMatchObject({ subject: 'oid-1' });
  });

  it('rejects a token from another tenant', async () => {
    const foreign = 'https://login.microsoftonline.com/11111111-1111-1111-1111-111111111111/v2.0';
    await expect(verify(sign({ oid: 'oid-1' }, { issuer: foreign }))).rejects.toThrow();
  });

  it('rejects a token minted for another audience', async () => {
    await expect(verify(sign({ oid: 'oid-1' }, { audience: 'some-other-api' }))).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    await expect(verify(sign({ oid: 'oid-1' }, { expiresIn: '-1h' }))).rejects.toThrow();
  });

  it('rejects a token signed by a different key', async () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const forged = jwt.sign({ oid: 'oid-1', tid: tenantId }, other.privateKey, {
      algorithm: 'RS256',
      keyid: 'test-key',
      issuer: issuerV2,
      audience,
      expiresIn: '5m',
    });
    await expect(verify(forged)).rejects.toThrow();
  });

  it('rejects a token with no key id, so the signing key cannot be chosen by the caller', async () => {
    const anonymous = jwt.sign({ oid: 'oid-1', tid: tenantId }, privateKey, {
      algorithm: 'RS256',
      issuer: issuerV2,
      audience,
      expiresIn: '5m',
    });
    await expect(verify(anonymous)).rejects.toThrow('Token has no key id.');
  });
});
