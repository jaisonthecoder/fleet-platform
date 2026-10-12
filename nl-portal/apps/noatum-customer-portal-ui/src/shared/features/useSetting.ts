import { useQueryClient } from '@tanstack/react-query';

import type { components } from '../../api/generated/schema';

type CurrentUser = components['schemas']['CurrentUserDto'];

type SettingValue = boolean | number | string;

/**
 * A scoped setting, already resolved for this user. ADR-010.
 *
 * The values come from `/api/me`, resolved through the same global → region → branch →
 * customer hierarchy the API walks — so a screen cannot show a four-hour countdown
 * while the branch is actually running a day.
 *
 * Distinct from `useFeature`: a switch is binary and fails closed with a 403, a setting
 * always resolves to a value. There is no 403 for "the threshold is 15,000".
 */
export function getSetting<T extends SettingValue>(
  user: Pick<CurrentUser, 'settings'> | undefined,
  key: string,
  fallback: T,
): T {
  const value = user?.settings?.[key];
  // Falls back when the session has not loaded or the key is unknown to this build,
  // which keeps an older SPA working against a newer API rather than rendering blank.
  return (typeof value === typeof fallback ? (value as T) : fallback);
}

/** The same question without threading the user through props. */
export function useSetting<T extends SettingValue>(key: string, fallback: T): T {
  const cache = useQueryClient();
  const cached = cache.getQueriesData<CurrentUser>({ queryKey: ['current-user'] });
  const user = cached.find(([, data]) => data)?.[1];
  return getSetting(user, key, fallback);
}
