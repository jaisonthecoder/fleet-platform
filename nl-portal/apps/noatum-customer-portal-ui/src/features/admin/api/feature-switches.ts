import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '../../../api/generated/schema';
import { authenticatedClient } from '../../auth/api/current-user';
import { StaffError } from '../../staff/api/staff';
import { LookupWriteError } from './lookups';

export type FeatureSwitch = components['schemas']['FeatureSwitchDto'];
export type ProtectedCapability = components['schemas']['ProtectedCapabilityDto'];
export type FeatureSwitchUpdate = components['schemas']['FeatureSwitchUpdateDto'];

function failure(response: Response): never {
  throw new StaffError(response.status === 401 || response.status === 403 ? 'denied' : 'unavailable');
}

/** Matches the API exception filter: message in `error`, machine code in `details`. */
function writeFailure(response: Response, error: unknown): never {
  const body = error as { error?: unknown; details?: { code?: string } } | undefined;
  const message = typeof body?.error === 'string' ? body.error : '';
  const code = body?.details?.code ?? (response.status === 403 ? 'DENIED' : 'UNAVAILABLE');
  throw new LookupWriteError(code, message);
}

export function useFeatureSwitches() {
  return useQuery({
    queryKey: ['feature-switches'], retry: false,
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('staff');
      const { data, response } = await client.GET('/api/admin/feature-switches', {
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}

export function useUpdateFeatureSwitch() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, body }: { key: string; body: FeatureSwitchUpdate }) => {
      const client = await authenticatedClient('staff');
      const { data, error, response } = await client.PATCH('/api/admin/feature-switches/{key}', {
        params: { path: { key } }, body, signal: AbortSignal.timeout(10000),
      });
      if (!response.ok || !data) return writeFailure(response, error);
      return data;
    },
    // A switch changes what other screens may do, so clear everything rather than
    // guessing which caches a capability touches.
    onSuccess: () => cache.invalidateQueries(),
  });
}
