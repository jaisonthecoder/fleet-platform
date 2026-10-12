import { PublicClientApplication, type AuthenticationResult } from '@azure/msal-browser';

export type SignInAudience = 'customer' | 'staff';

const clients = new Map<SignInAudience, Promise<PublicClientApplication>>();
const redirects = new Map<SignInAudience, Promise<AuthenticationResult | null>>();

function configuration(audience: SignInAudience) {
  const clientId = audience === 'customer' ? import.meta.env.VITE_ENTRA_CUSTOMER_CLIENT_ID : import.meta.env.VITE_ENTRA_STAFF_CLIENT_ID;
  const authority = audience === 'customer' ? import.meta.env.VITE_ENTRA_CUSTOMER_AUTHORITY : import.meta.env.VITE_ENTRA_STAFF_AUTHORITY;
  const scope = audience === 'customer' ? import.meta.env.VITE_ENTRA_CUSTOMER_API_SCOPE : import.meta.env.VITE_ENTRA_STAFF_API_SCOPE;
  // Must match a redirect URI registered on the application. Defaults to the
  // audience callback path; override when the registration lists a bare origin.
  const configuredRedirect = audience === 'customer' ? import.meta.env.VITE_ENTRA_CUSTOMER_REDIRECT_URI : import.meta.env.VITE_ENTRA_STAFF_REDIRECT_URI;
  if (!clientId || !authority || !scope) return null;
  try {
    const url = new URL(authority);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const redirectUri = redirect(configuredRedirect) ?? `${window.location.origin}/login/${audience}`;
    return { clientId, authority, scope, hostname: url.hostname, redirectUri };
  } catch {
    return null;
  }
}

/** Accepts a same-origin redirect URI only, so a stray value cannot send codes elsewhere. */
function redirect(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim(), window.location.origin);
    return url.origin === window.location.origin ? url.href : null;
  } catch {
    return null;
  }
}

export function isSignInConfigured(audience: SignInAudience): boolean {
  return configuration(audience) !== null;
}

async function clientFor(audience: SignInAudience): Promise<PublicClientApplication> {
  const config = configuration(audience);
  if (!config) throw new Error('Sign-in configuration is unavailable.');
  let client = clients.get(audience);
  if (!client) {
    const instance = new PublicClientApplication({
      auth: {
        clientId: config.clientId,
        authority: config.authority,
        knownAuthorities: [config.hostname],
        redirectUri: config.redirectUri,
        postLogoutRedirectUri: `${window.location.origin}/login`,
      },
      cache: { cacheLocation: 'sessionStorage' },
    });
    client = instance.initialize().then(() => instance).catch((error: unknown) => {
      clients.delete(audience);
      throw error;
    });
    clients.set(audience, client);
  }
  return client;
}

export async function signIn(
  audience: SignInAudience,
  email?: string,
  options?: { chooseAccount?: boolean },
): Promise<void> {
  const client = await clientFor(audience);
  const config = configuration(audience);
  if (!config) throw new Error('Sign-in configuration is unavailable.');
  await client.loginRedirect({
    scopes: [config.scope],
    ...(email ? { loginHint: email.trim() } : {}),
    // Without this Microsoft reuses whoever is already signed in, which is the
    // opposite of what someone asking for another account wants.
    ...(options?.chooseAccount ? { prompt: 'select_account' as const } : {}),
  });
}

export async function completeSignIn(audience: SignInAudience): Promise<AuthenticationResult | null> {
  const client = await clientFor(audience);
  let redirectResult = redirects.get(audience);
  if (!redirectResult) {
    redirectResult = client.handleRedirectPromise().then((result) => {
      if (result?.account) client.setActiveAccount(result.account);
      return result;
    });
    redirects.set(audience, redirectResult);
  }
  return redirectResult;
}

/**
 * Whether this audience already has a session, after any pending redirect has been
 * processed. The login screen uses it to show access status instead of the form,
 * which keeps the flow working when the registered redirect URI is the bare origin.
 */
export async function hasSession(audience: SignInAudience): Promise<boolean> {
  if (!isSignInConfigured(audience)) return false;
  try {
    await completeSignIn(audience);
    const client = await clientFor(audience);
    return Boolean(client.getActiveAccount() ?? client.getAllAccounts()[0]);
  } catch {
    return false;
  }
}

export async function accessToken(audience: SignInAudience): Promise<string> {
  await completeSignIn(audience);
  const client = await clientFor(audience);
  const account = client.getActiveAccount() ?? client.getAllAccounts()[0];
  const config = configuration(audience);
  if (!account || !config) throw new Error('Microsoft sign-in is required.');
  const result = await client.acquireTokenSilent({ account, scopes: [config.scope] });
  return result.accessToken;
}

export async function signOut(audience: SignInAudience): Promise<void> {
  const client = await clientFor(audience);
  await completeSignIn(audience);
  await client.logoutRedirect({ account: client.getActiveAccount() });
}
