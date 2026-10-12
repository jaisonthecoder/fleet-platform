import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { components } from '../../../api/generated/schema';
import { authenticatedClient } from '../../auth/api/current-user';
import { StaffError } from '../../staff/api/staff';
import { CustomerWriteError } from './customers';

export type Region = components['schemas']['RegionDto'];
export type Branch = components['schemas']['BranchDto'];
export type RegionCreate = components['schemas']['RegionCreateDto'];
export type RegionUpdate = components['schemas']['RegionUpdateDto'];
export type BranchCreate = components['schemas']['BranchCreateDto'];
export type BranchUpdate = components['schemas']['BranchUpdateDto'];
export type CargoWiseBranch = components['schemas']['CargoWiseBranchDto'];

function failure(response: Response): never {
  throw new StaffError(response.status === 401 || response.status === 403 ? 'denied' : 'unavailable');
}

/** openapi-fetch has already read the body, so carry the server's reason code across. */
function writeFailure(response: Response, error: unknown): never {
  const body = error as { error?: unknown; details?: { code?: string } } | undefined;
  const message = typeof body?.error === 'string' ? body.error : '';
  const code = body?.details?.code ?? (response.status === 403 ? 'DENIED' : 'UNAVAILABLE');
  throw new CustomerWriteError(code, message);
}

const invalidateOperating = (cache: ReturnType<typeof useQueryClient>) => {
  void cache.invalidateQueries({ queryKey: ['operating-regions'] });
  void cache.invalidateQueries({ queryKey: ['operating-branches'] });
  void cache.invalidateQueries({ queryKey: ['operating-cargowise'] });
};

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

export type RegionFilters = { search: string; status: 'all' | 'active' | 'inactive'; page: number; pageSize: number };

export function useRegions(filters: RegionFilters) {
  return useQuery({
    queryKey: ['operating-regions', filters],
    retry: false,
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('staff');
      const { data, response } = await client.GET('/api/admin/operating/regions', {
        params: { query: filters },
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}

export function useCreateRegion() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async (body: RegionCreate) => {
      const client = await authenticatedClient('staff');
      const { data, error, response } = await client.POST('/api/admin/operating/regions', { body, signal: AbortSignal.timeout(15000) });
      if (!response.ok || !data) return writeFailure(response, error);
      return data;
    },
    onSuccess: () => invalidateOperating(cache),
  });
}

export function useUpdateRegion() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: RegionUpdate }) => {
      const client = await authenticatedClient('staff');
      const { data, error, response } = await client.PATCH('/api/admin/operating/regions/{id}', {
        params: { path: { id } },
        body,
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok || !data) return writeFailure(response, error);
      return data;
    },
    onSuccess: () => invalidateOperating(cache),
  });
}

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

export type BranchFilters = {
  search: string;
  regionId?: string;
  status: 'all' | 'active' | 'inactive';
  mapped: 'all' | 'mapped' | 'unmapped';
  page: number;
  pageSize: number;
};

export function useBranches(filters: BranchFilters, enabled = true) {
  return useQuery({
    queryKey: ['operating-branches', filters],
    enabled,
    retry: false,
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('staff');
      const { data, response } = await client.GET('/api/admin/operating/branches', {
        params: { query: filters },
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}

export function useCreateBranch() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async (body: BranchCreate) => {
      const client = await authenticatedClient('staff');
      const { data, error, response } = await client.POST('/api/admin/operating/branches', { body, signal: AbortSignal.timeout(15000) });
      if (!response.ok || !data) return writeFailure(response, error);
      return data;
    },
    onSuccess: () => invalidateOperating(cache),
  });
}

export function useUpdateBranch() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: BranchUpdate }) => {
      const client = await authenticatedClient('staff');
      const { data, error, response } = await client.PATCH('/api/admin/operating/branches/{id}', {
        params: { path: { id } },
        body,
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok || !data) return writeFailure(response, error);
      return data;
    },
    onSuccess: () => invalidateOperating(cache),
  });
}

// ---------------------------------------------------------------------------
// CargoWise ControllingBranch discovery
// ---------------------------------------------------------------------------

export function useCargoWiseBranches(mapped: 'all' | 'mapped' | 'unmapped') {
  return useQuery({
    queryKey: ['operating-cargowise', mapped],
    retry: false,
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('staff');
      const { data, response } = await client.GET('/api/admin/operating/cargowise-branches', {
        params: { query: { mapped } },
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}
