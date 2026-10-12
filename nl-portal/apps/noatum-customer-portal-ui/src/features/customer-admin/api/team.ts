import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { components } from '../../../api/generated/schema';
import { authenticatedClient } from '../../auth/api/current-user';

export type AccountUser = components['schemas']['AccountUserDto'];
export type AccountInvitation = components['schemas']['AccountInvitationDto'];
export type AccountRolePreset = components['schemas']['AccountRolePresetDto'];

/* ────────────────────────────────────────────────────────────────────────────
 * The customer's own people.
 *
 * Every call goes to /api/account/*, which takes no customer id: the server
 * reads the tenant from the session. That is deliberate and worth knowing when
 * reading these hooks — there is no group to pass, and adding one would be a
 * hole rather than a convenience.
 * ──────────────────────────────────────────────────────────────────────────── */

const TEAM_KEY = ['account', 'team'] as const;

async function client() {
  return authenticatedClient('customer');
}

/** Raises the API's own message, so a domain refusal reads as a domain refusal. */
function fail(response: Response, error: unknown): never {
  const message =
    typeof error === 'object' && error !== null && typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : `Request failed (${response.status})`;
  throw new Error(message);
}

export function useTeam(enabled = true) {
  return useQuery({
    queryKey: [...TEAM_KEY, 'users'],
    enabled,
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await (await client()).GET('/api/account/users', { signal });
      if (!data) fail(response, error);
      return data;
    },
  });
}

export function useTeamInvitations(enabled = true) {
  return useQuery({
    queryKey: [...TEAM_KEY, 'invitations'],
    enabled,
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await (await client()).GET('/api/account/invitations', { signal });
      if (!data) fail(response, error);
      return data;
    },
  });
}

export function useRolePresets(enabled = true) {
  return useQuery({
    queryKey: [...TEAM_KEY, 'role-presets'],
    enabled,
    // Reference data for the session: the presets do not change while somebody
    // is filling in an invitation.
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await (await client()).GET('/api/account/role-presets', { signal });
      if (!data) fail(response, error);
      return data;
    },
  });
}

/** Everything that changes people invalidates both lists: a person moves between them. */
function useTeamMutation<TVariables, TData>(run: (variables: TVariables) => Promise<TData>) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => cache.invalidateQueries({ queryKey: TEAM_KEY }),
  });
}

export function useInviteColleague() {
  return useTeamMutation(
    async (body: { displayName: string; email: string; roleKeys: string[]; officeAccountId: string | null }) => {
      const { data, error, response } = await (await client()).POST('/api/account/invitations', {
        body: body as never,
      });
      if (!data) fail(response, error);
      return data;
    },
  );
}

export function useResendInvitation() {
  return useTeamMutation(async ({ id, reason }: { id: string; reason: string }) => {
    const { data, error, response } = await (await client()).POST('/api/account/invitations/{id}/resend', {
      params: { path: { id } },
      body: { reason } as never,
    });
    if (!data) fail(response, error);
    return data;
  });
}

export function useRevokeInvitation() {
  return useTeamMutation(async ({ id, reason }: { id: string; reason: string }) => {
    const { data, error, response } = await (await client()).POST('/api/account/invitations/{id}/revoke', {
      params: { path: { id } },
      body: { reason } as never,
    });
    if (!data) fail(response, error);
    return data;
  });
}

export function useChangeRoles() {
  return useTeamMutation(
    async ({
      id,
      roleKeys,
      officeAccountId,
      reason,
    }: {
      id: string;
      roleKeys: string[];
      officeAccountId: string | null;
      reason: string;
    }) => {
      const { data, error, response } = await (await client()).PATCH('/api/account/users/{id}/roles', {
        params: { path: { id } },
        body: { roleKeys, officeAccountId, reason } as never,
      });
      if (!data) fail(response, error);
      return data;
    },
  );
}

export function useSetUserStatus() {
  return useTeamMutation(async ({ id, active, reason }: { id: string; active: boolean; reason: string }) => {
    const path = active ? '/api/account/users/{id}/reactivate' : '/api/account/users/{id}/deactivate';
    const { data, error, response } = await (await client()).POST(path as '/api/account/users/{id}/deactivate', {
      params: { path: { id } },
      body: { reason } as never,
    });
    if (!data) fail(response, error);
    return data;
  });
}
