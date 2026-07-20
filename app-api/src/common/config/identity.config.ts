import { registerAs } from '@nestjs/config';
import { validateEnv } from './config.schema';

/** Microsoft Entra ID (OIDC/JWT) identity configuration. */
export const identityConfig = registerAs('identity', () => {
  const env = validateEnv(process.env);
  const isHigherEnv = env.NODE_ENV === 'uat' || env.NODE_ENV === 'production';
  const tenantId = env.ENTRA_TENANT_ID;
  const apiClientId = env.ENTRA_API_CLIENT_ID;

  // Accept both the App ID URI (`api://<id>`) and the bare client id as the
  // audience, plus any explicit override — Azure issues one or the other
  // depending on the API app's `accessTokenAcceptedVersion`.
  const audiences = new Set<string>();
  if (env.ENTRA_API_AUDIENCE) audiences.add(env.ENTRA_API_AUDIENCE);
  if (apiClientId) {
    audiences.add(apiClientId);
    audiences.add(`api://${apiClientId}`);
  }

  // Accept both the v2 and v1 issuers for the tenant (the token version varies).
  const issuer = env.ENTRA_ISSUER
    ? [env.ENTRA_ISSUER]
    : tenantId
      ? [
          `https://login.microsoftonline.com/${tenantId}/v2.0`,
          `https://sts.windows.net/${tenantId}/`,
        ]
      : undefined;

  return {
    tenantId,
    apiClientId,
    apiAudience: audiences.size > 0 ? [...audiences] : undefined,
    issuer,
    /** Entra v2 JWKS endpoint used to verify token signatures (keys serve v1+v2). */
    jwksUri: tenantId
      ? `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`
      : undefined,
    /** True once real Entra JWT validation can be enforced. */
    entraConfigured: Boolean(tenantId && apiClientId),
    /**
     * The `x-dev-person-id` dev-login stand-in. Enabled only in lower
     * environments; structurally impossible to switch on in uat/production even
     * if the flag is set (P0-R2-4 — dev-login must never leak to a higher env).
     */
    devLoginEnabled: env.AUTH_DEV_LOGIN && !isHigherEnv,
  };
});
