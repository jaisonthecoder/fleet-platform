import jwt, { type JwtPayload } from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';

/** The identity and profile claims we lift off a verified Entra token. */
export interface EntraClaims {
  /** The `iss` claim, stored as `user.idp_issuer`. */
  issuer: string;
  /**
   * The identity anchor, stored as `user.idp_subject`.
   *
   * Entra's `oid` is stable for a person across app registrations; `sub` is
   * pairwise and changes if the API's registration changes. We prefer `oid` so
   * moving to Noatum's own registration does not orphan every account, and fall
   * back to `sub` only when a token carries no `oid`.
   */
  subject: string;
  tenantId?: string;
  email?: string;
  name?: string;
}

export type TokenVerifier = (token: string) => Promise<EntraClaims>;

export interface EntraVerifierConfig {
  tenantId: string;
  audience: string;
}

/**
 * Both issuer spellings a tenant can stamp. v2 tokens use the `login.microsoftonline.com`
 * form; v1 tokens use `sts.windows.net`, which is what an app registration still set to
 * token version 1 emits. Accepting both means validation does not silently depend on a
 * setting in someone else's app registration.
 */
export function issuersFor(tenantId: string): [string, ...string[]] {
  return [
    `https://login.microsoftonline.com/${tenantId}/v2.0`,
    `https://sts.windows.net/${tenantId}/`,
  ];
}

/**
 * Both audience spellings. A configured value may be the bare API client id or its
 * Application ID URI, and the token may carry either.
 */
export function audiencesFor(audience: string): [string, ...string[]] {
  const prefix = 'api://';
  if (audience.startsWith(prefix)) {
    const bare = audience.slice(prefix.length).split('/')[0];
    return bare && bare !== audience ? [audience, bare] : [audience];
  }
  return [audience, `${prefix}${audience}`];
}

export function jwksUriFor(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;
}

export function toClaims(payload: JwtPayload): EntraClaims {
  const claims = payload as JwtPayload & Record<string, unknown>;
  const objectId = typeof claims.oid === 'string' ? claims.oid : undefined;
  const subject = objectId ?? (typeof claims.sub === 'string' ? claims.sub : '');
  const issuer = typeof claims.iss === 'string' ? claims.iss : '';

  if (!issuer || !subject) {
    throw new Error('Token carries no usable issuer or subject.');
  }

  const email =
    typeof claims.preferred_username === 'string'
      ? claims.preferred_username
      : typeof claims.upn === 'string'
        ? claims.upn
        : typeof claims.email === 'string'
          ? claims.email
          : undefined;

  return {
    issuer,
    subject,
    tenantId: typeof claims.tid === 'string' ? claims.tid : undefined,
    email,
    name: typeof claims.name === 'string' ? claims.name : undefined,
  };
}

/** Resolves the signing key for a token's `kid`. Swappable so tests need no network. */
export type SigningKeyResolver = (kid: string) => Promise<string>;

export function createJwksResolver(tenantId: string): SigningKeyResolver {
  const client = new JwksClient({
    jwksUri: jwksUriFor(tenantId),
    cache: true,
    cacheMaxAge: 12 * 60 * 60 * 1000,
    rateLimit: true,
  });
  return async (kid) => (await client.getSigningKey(kid)).getPublicKey();
}

/**
 * Builds a verifier that checks signature, issuer, audience and expiry, then projects
 * the payload onto {@link EntraClaims}. Roles and tenancy are never read from the
 * token - the claims identify the person and nothing more.
 */
export function createEntraVerifier(
  config: EntraVerifierConfig,
  resolveKey: SigningKeyResolver = createJwksResolver(config.tenantId),
): TokenVerifier {
  const issuer = issuersFor(config.tenantId);
  const audience = audiencesFor(config.audience);

  return async function verify(token: string): Promise<EntraClaims> {
    const decoded = jwt.decode(token, { complete: true });
    const kid = decoded?.header.kid;
    if (!kid) throw new Error('Token has no key id.');

    const key = await resolveKey(kid);
    const payload = jwt.verify(token, key, {
      algorithms: ['RS256'],
      audience,
      issuer,
      clockTolerance: 30,
    });

    if (typeof payload === 'string') throw new Error('Unexpected token payload.');
    return toClaims(payload);
  };
}
