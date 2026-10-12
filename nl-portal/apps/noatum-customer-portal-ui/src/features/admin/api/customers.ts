import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { components } from '../../../api/generated/schema';
import { authenticatedClient } from '../../auth/api/current-user';
import { StaffError } from '../../staff/api/staff';

export type CustomerSummary = components['schemas']['CustomerSummaryDto'];
export type CustomerDetail = components['schemas']['CustomerDetailDto'];
export type CustomerLink = components['schemas']['CustomerLinkDto'];
export type CustomerTask = components['schemas']['CustomerTaskDto'];
export type DirectoryOrganisation = components['schemas']['DirectoryOrganisationDto'];

/** Carries the server's reason so a refusal can be explained, not just flagged. */
export class CustomerWriteError extends Error {
  constructor(readonly code: string, message: string, readonly missing: string[] = []) { super(message); }
}

function failure(response: Response): never {
  throw new StaffError(response.status === 401 || response.status === 403 ? 'denied' : 'unavailable');
}

/** openapi-fetch has already consumed the body; never re-read the Response. */
function writeFailure(response: Response, error: unknown): never {
  const body = error as { error?: unknown; details?: { code?: string; missing?: string[] } } | undefined;
  const message = typeof body?.error === 'string' ? body.error : '';
  const code = body?.details?.code ?? (response.status === 403 ? 'DENIED' : 'UNAVAILABLE');
  throw new CustomerWriteError(code, message, body?.details?.missing ?? []);
}

export type CustomerFilters = {
  search: string;
  status: 'all' | 'draft' | 'onboarding' | 'active' | 'suspended' | 'closed';
  page: number;
  pageSize: number;
};

export function useCustomers(filters: CustomerFilters) {
  return useQuery({
    queryKey: ['customers', filters], retry: false,
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('staff');
      const { data, response } = await client.GET('/api/admin/customers', {
        params: { query: filters },
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}

export function useCustomer(id: string | null) {
  return useQuery({
    queryKey: ['customer', id], retry: false, enabled: Boolean(id),
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('staff');
      const { data, response } = await client.GET('/api/admin/customers/{id}', {
        params: { path: { id: id as string } },
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}

export type DirectoryFilters = { search: string; unlinkedOnly: boolean; page: number; pageSize: number };

export function useDirectory(filters: DirectoryFilters, enabled: boolean) {
  return useQuery({
    queryKey: ['org-directory', filters], retry: false, enabled,
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('staff');
      const { data, response } = await client.GET('/api/admin/customers/directory/organisations', {
        params: { query: filters },
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => { void queryClient.invalidateQueries(); };
}

export function useAttachOrganisation(customerId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { orgId: string; reason: string; servicingBranchId: string | null }) => {
      const client = await authenticatedClient('staff');
      const { data, error, response } = await client.POST('/api/admin/customers/{id}/organisations', {
        params: { path: { id: customerId } },
        body: { orgId: input.orgId, reason: input.reason, servicingBranchId: input.servicingBranchId },
      });
      if (!response.ok) return writeFailure(response, error);
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useDetachOrganisation(customerId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { accountId: string; reason: string }) => {
      const client = await authenticatedClient('staff');
      const { data, error, response } = await client.POST('/api/admin/customers/{id}/organisations/{accountId}/detach', {
        params: { path: { id: customerId, accountId: input.accountId } },
        body: { reason: input.reason },
      });
      if (!response.ok) return writeFailure(response, error);
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useSetLinkServicing(customerId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { accountId: string; servicingBranchId: string | null; reason: string }) => {
      const client = await authenticatedClient('staff');
      const { data, error, response } = await client.POST('/api/admin/customers/{id}/organisations/{accountId}/servicing', {
        params: { path: { id: customerId, accountId: input.accountId } },
        body: { servicingBranchId: input.servicingBranchId, reason: input.reason },
      });
      if (!response.ok) return writeFailure(response, error);
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useCustomerLifecycle(customerId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { action: 'go-live' | 'suspend' | 'close'; updatedAt: string; reason: string }) => {
      const client = await authenticatedClient('staff');
      const params = { path: { id: customerId } };
      const body = { updatedAt: input.updatedAt, reason: input.reason };
      const result =
        input.action === 'go-live'
          ? await client.POST('/api/admin/customers/{id}/go-live', { params, body })
          : input.action === 'suspend'
            ? await client.POST('/api/admin/customers/{id}/suspend', { params, body })
            : await client.POST('/api/admin/customers/{id}/close', { params, body });
      if (!result.response.ok) return writeFailure(result.response, result.error);
      return result.data;
    },
    onSuccess: invalidate,
  });
}

export type CustomerUser = components['schemas']['CustomerUserDto'];
export type Invitation = components['schemas']['InvitationDto'];

export function useInviteAdministrator(customerId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      displayName: string; email: string; domainOverrideReason: string | null; reason: string;
    }) => {
      const client = await authenticatedClient('staff');
      const { data, error, response } = await client.POST('/api/admin/customers/{id}/invitations', {
        params: { path: { id: customerId } },
        body: input,
      });
      if (!response.ok) return writeFailure(response, error);
      return data;
    },
    onSuccess: invalidate,
  });
}

export type CustomerCreateInput = {
  name: string;
  legalName: string | null;
  slug: string;
  countryCode: string | null;
  tier: 'basic' | 'standard' | 'premium';
  emailDomains: string[];
  defaultServicingBranchId: string | null;
  reason: string;
};

export function useCreateCustomer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: CustomerCreateInput) => {
      const client = await authenticatedClient('staff');
      const { data, error, response } = await client.POST('/api/admin/customers', {
        body: { ...input, parentId: null },
      });
      if (!response.ok) return writeFailure(response, error);
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useCustomerUsers(customerId: string | null, page: number) {
  return useQuery({
    queryKey: ['customer-users', customerId, page], retry: false, enabled: Boolean(customerId),
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('staff');
      const { data, response } = await client.GET('/api/admin/customers/{id}/users', {
        params: { path: { id: customerId as string }, query: { page, pageSize: 25 } },
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}

export function useUpdateUserAccess(customerId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { userId: string; scope: 'all' | 'selected'; accountIds: string[]; reason: string }) => {
      const client = await authenticatedClient('staff');
      const { data, error, response } = await client.POST('/api/admin/customers/{id}/users/{userId}/organisations', {
        params: { path: { id: customerId, userId: input.userId } },
        body: { scope: input.scope, accountIds: input.accountIds, reason: input.reason },
      });
      if (!response.ok) return writeFailure(response, error);
      return data;
    },
    onSuccess: invalidate,
  });
}

export type AccountActionResult = components['schemas']['AccountActionResultDto'];
export type CustomerUserSecurity = components['schemas']['CustomerUserSecurityDto'];

/** Send a reset link, block a password, restore it, or clear a lost second factor. */
export type AccountAction = 'password-reset' | 'block' | 'restore' | 'mfa-reset';

export function useAccountAction(customerId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { userId: string; action: AccountAction; reason: string }) => {
      const client = await authenticatedClient('staff');
      const params = { path: { id: customerId, userId: input.userId } };
      const body = { reason: input.reason };
      const result =
        input.action === 'password-reset'
          ? await client.POST('/api/admin/customers/{id}/users/{userId}/password-reset', { params, body })
          : input.action === 'block'
            ? await client.POST('/api/admin/customers/{id}/users/{userId}/sign-in/block', { params, body })
            : input.action === 'restore'
              ? await client.POST('/api/admin/customers/{id}/users/{userId}/sign-in/restore', { params, body })
              : await client.POST('/api/admin/customers/{id}/users/{userId}/mfa/reset', { params, body });
      if (!result.response.ok) return writeFailure(result.response, result.error);
      return result.data as AccountActionResult;
    },
    onSuccess: invalidate,
  });
}

export function useCustomerInvitations(customerId: string | null) {
  return useQuery({
    queryKey: ['customer-invitations', customerId], retry: false, enabled: Boolean(customerId),
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('staff');
      const { data, response } = await client.GET('/api/admin/customers/{id}/invitations', {
        params: { path: { id: customerId as string } },
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}

export function useInvitationAction(customerId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { invitationId: string; action: 'resend' | 'revoke'; reason: string }) => {
      const client = await authenticatedClient('staff');
      const params = { path: { id: customerId, invitationId: input.invitationId } };
      const body = { reason: input.reason };
      const result =
        input.action === 'resend'
          ? await client.POST('/api/admin/customers/{id}/invitations/{invitationId}/resend', { params, body })
          : await client.POST('/api/admin/customers/{id}/invitations/{invitationId}/revoke', { params, body });
      if (!result.response.ok) return writeFailure(result.response, result.error);
      return result.data as Invitation;
    },
    onSuccess: invalidate,
  });
}
