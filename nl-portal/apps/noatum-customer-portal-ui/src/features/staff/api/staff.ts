import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '../../../api/generated/schema';
import { authenticatedClient } from '../../auth/api/current-user';

export type StaffUser = components['schemas']['StaffUserDto'];
export type StaffRolePreset = components['schemas']['StaffRolePresetDto'];
export type StaffRoleUpdate = components['schemas']['StaffRoleUpdateDto'];
export type StaffBranch = components['schemas']['StaffBranchDto'];

export class StaffError extends Error {
  constructor(readonly kind: 'denied' | 'conflict' | 'unavailable') { super(kind); }
}

function failure(response: Response): never {
  throw new StaffError(response.status === 401 || response.status === 403 ? 'denied' : response.status === 409 ? 'conflict' : 'unavailable');
}

export function useStaff(search: string, page: number, pageSize: number) {
  return useQuery({
    queryKey: ['staff', search, page, pageSize], retry: false, staleTime: 0, gcTime: 0,
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('staff');
      const { data, response } = await client.GET('/api/users/staff', {
        params: { query: { search, page, pageSize } },
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}

export function useStaffPresets() {
  return useQuery({
    queryKey: ['staff-presets'], retry: false, staleTime: 0, gcTime: 0,
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('staff');
      const { data, response } = await client.GET('/api/users/staff/role-presets', {
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}

export function useStaffBranches() {
  return useQuery({
    queryKey: ['staff-branches'], retry: false, staleTime: 0, gcTime: 0,
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('staff');
      const { data, response } = await client.GET('/api/users/staff/branches', {
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}

export function useIssueStaffAccessLink() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const client = await authenticatedClient('staff');
      const { data, response } = await client.POST('/api/users/staff/{id}/access-link', {
        params: { path: { id } }, body: { reason }, signal: AbortSignal.timeout(15000),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
    onSettled: async () => { await cache.invalidateQueries({ queryKey: ['staff'] }); },
  });
}

export function useAssignStaffRoles() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: StaffRoleUpdate }) => {
      const client = await authenticatedClient('staff');
      const { data, response } = await client.PUT('/api/users/staff/{id}/roles', {
        params: { path: { id } }, body, signal: AbortSignal.timeout(10000),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
    onSettled: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['staff'] }),
        cache.invalidateQueries({ queryKey: ['current-user', 'staff'] }),
      ]);
    },
  });
}
