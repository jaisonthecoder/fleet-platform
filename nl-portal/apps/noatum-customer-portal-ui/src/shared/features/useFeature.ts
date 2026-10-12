import { useQueryClient } from '@tanstack/react-query';

import type { components } from '../../api/generated/schema';

type CurrentUser = components['schemas']['CurrentUserDto'];

/**
 * Whether an optional capability is switched on.
 *
 * The keys come from `/api/me`, which reads the same catalogue and the same
 * `feature_switch` rows the API's FeatureGuard reads — so a screen cannot disagree with
 * the 403 it would get. Hiding a control is the courtesy; the guard is the control.
 */
export function hasFeature(user: Pick<CurrentUser, 'features'> | undefined, key: string): boolean {
  return Boolean(user?.features?.includes(key));
}

/**
 * The same question without threading the user through props.
 *
 * Reads the cached `/api/me` response rather than refetching. Returns false until the
 * session has loaded, so a control never flashes on before we know it is allowed.
 */
export function useFeature(key: string): boolean {
  const cache = useQueryClient();
  const cached = cache.getQueriesData<CurrentUser>({ queryKey: ['current-user'] });
  const user = cached.find(([, data]) => data)?.[1];
  return hasFeature(user, key);
}
