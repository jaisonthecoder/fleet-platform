/**
 * The locally picked identity, for use with the API's development header bypass.
 *
 * Only active when the SPA is built for development AND VITE_DEV_AUTH is on; the
 * API applies the same rule independently and refuses to boot with its own flag
 * set in production, so a stray build flag alone grants nothing.
 *
 * Kept in sessionStorage rather than localStorage so closing the tab ends it.
 */
export interface DevIdentity {
  subject: string;
  email: string;
  displayName: string;
}

const STORAGE_KEY = 'noatum.dev-identity';

/**
 * Whether to offer the seeded demo accounts. Built in, so a bundle without it cannot
 * be talked into showing them.
 *
 * Deliberately not tied to a development build: a demonstration site is a real build.
 * This only decides whether to ask - the API refuses the header sign-in unless it was
 * switched on there too, and reports no accounts, so the picker stays empty anyway.
 */
export const devAuthEnabled = import.meta.env.VITE_DEV_AUTH === 'true';

function read(): DevIdentity | null {
  if (!devAuthEnabled) return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<DevIdentity>;
    return value.subject && value.email && value.displayName
      ? { subject: value.subject, email: value.email, displayName: value.displayName }
      : null;
  } catch {
    return null;
  }
}

// Held in a module variable so useSyncExternalStore sees a stable snapshot.
let current: DevIdentity | null = read();
const listeners = new Set<() => void>();

export function getDevIdentity(): DevIdentity | null {
  return current;
}

export function setDevIdentity(identity: DevIdentity | null): void {
  if (!devAuthEnabled) return;
  current = identity;
  try {
    if (identity) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // A blocked storage write only costs persistence across reloads.
  }
  for (const listener of listeners) listener();
}

export function subscribeDevIdentity(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
