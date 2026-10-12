import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '../../../api/generated/schema';
import { authenticatedClient } from '../../auth/api/current-user';
import { StaffError } from '../../staff/api/staff';
import { LookupWriteError } from './lookups';

export type Setting = components['schemas']['SettingDto'];
export type SettingOverride = components['schemas']['SettingOverrideDto'];
export type SetSetting = components['schemas']['SetSettingDto'];
export type SettingChange = components['schemas']['SettingChangeDto'];

/** Which layer of the hierarchy the screen is looking at. */
export interface SettingScopeQuery {
  regionCode?: string | null;
  branchCode?: string | null;
  customerGroupId?: string | null;
}

function failure(response: Response): never {
  throw new StaffError(response.status === 401 || response.status === 403 ? 'denied' : 'unavailable');
}

function writeFailure(response: Response, error: unknown): never {
  const body = error as { error?: unknown; details?: { code?: string } } | undefined;
  const message = typeof body?.error === 'string' ? body.error : '';
  const code = body?.details?.code ?? (response.status === 403 ? 'DENIED' : 'UNAVAILABLE');
  throw new LookupWriteError(code, message);
}

export function useSettings(scope: SettingScopeQuery) {
  return useQuery({
    // The scope is part of the key: looking at Valencia must not serve Madrid's answer.
    queryKey: ['settings', scope.regionCode ?? '', scope.branchCode ?? '', scope.customerGroupId ?? ''],
    retry: false,
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('staff');
      const query: Record<string, string> = {};
      if (scope.regionCode) query.regionCode = scope.regionCode;
      if (scope.branchCode) query.branchCode = scope.branchCode;
      if (scope.customerGroupId) query.customerGroupId = scope.customerGroupId;

      const { data, response } = await client.GET('/api/admin/settings', {
        params: { query: query as never },
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}

export function useSettingHistory() {
  return useQuery({
    queryKey: ['settings-history'],
    retry: false,
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('staff');
      const { data, response } = await client.GET('/api/admin/settings/history', {
        params: { query: { take: '50' } },
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}

export function useSetSetting() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, body }: { key: string; body: SetSetting }) => {
      const client = await authenticatedClient('staff');
      const { data, error, response } = await client.POST('/api/admin/settings/{key}', {
        params: { path: { key } }, body, signal: AbortSignal.timeout(10000),
      });
      if (!response.ok || !data) return writeFailure(response, error);
      return data;
    },
    // A setting changes what other screens may do, and `/api/me` carries the
    // resolved values, so clear everything rather than guessing the blast radius.
    onSuccess: () => cache.invalidateQueries(),
  });
}

export function useClearSetting() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async ({
      key, scope, scopeId, reason,
    }: { key: string; scope: string; scopeId: string | null; reason: string }) => {
      const client = await authenticatedClient('staff');
      const { data, error, response } = await client.DELETE('/api/admin/settings/{key}', {
        params: { path: { key }, query: { scope, scopeId: scopeId ?? '', reason } as never },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok || !data) return writeFailure(response, error);
      return data;
    },
    onSuccess: () => cache.invalidateQueries(),
  });
}
