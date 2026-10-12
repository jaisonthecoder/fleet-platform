import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { components } from '../../../api/generated/schema';
import { authenticatedClient } from '../../auth/api/current-user';
import { StaffError } from '../../staff/api/staff';
import { CustomerWriteError } from './customers';

export type OrganisationRow = components['schemas']['OrganisationRowDto'];
export type OrganisationDetail = components['schemas']['OrganisationDetailDto'];
export type OrganisationAddress = components['schemas']['OrganisationAddressDto'];
export type OrganisationRegistration = components['schemas']['OrganisationRegistrationDto'];
export type OrganisationChange = components['schemas']['OrganisationChangeDto'];
export type ImportRun = components['schemas']['ImportRunDto'];

function failure(response: Response): never {
  throw new StaffError(response.status === 401 || response.status === 403 ? 'denied' : 'unavailable');
}

export type OrganisationFilters = {
  search: string;
  status: 'all' | 'active' | 'inactive';
  provenance: 'all' | 'confirmed' | 'provisional';
  linked: 'all' | 'linked' | 'unlinked';
  /** ISO 3166-1 alpha-2. The endpoint accepts one value, not a list. */
  countryCode?: string;
  /** CargoWise organisation category code, up to three characters. */
  category?: string;
  page: number;
  pageSize: number;
};

export function useOrganisations(filters: OrganisationFilters) {
  return useQuery({
    queryKey: ['organisations', filters], retry: false,
    /*
     * Paging and searching are server round trips, so without this the rows
     * vanish and the skeleton flashes between every page. Holding the previous
     * page until the next one lands keeps the table still; `isFetching` is what
     * a caller should read if it wants to show that work is in progress.
     */
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('staff');
      const { data, response } = await client.GET('/api/admin/organisations', {
        // The query schema is strict, so an empty optional filter has to be
        // absent rather than an empty string, which it would reject.
        params: { query: withoutBlanks(filters) },
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}

/** Drops keys the user has not filled in, so the strict query schema accepts them. */
function withoutBlanks<Filters extends Record<string, unknown>>(filters: Filters): Filters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
  ) as Filters;
}

export function useOrganisation(id: string | null) {
  return useQuery({
    queryKey: ['organisation', id], retry: false, enabled: Boolean(id),
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('staff');
      const { data, response } = await client.GET('/api/admin/organisations/{id}', {
        params: { path: { id: id as string } },
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}

export function useImportRuns(enabled: boolean) {
  return useQuery({
    queryKey: ['org-import-runs'], retry: false, enabled,
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('staff');
      const { data, response } = await client.GET('/api/admin/organisations/imports/runs', {
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}

export function useRunImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { authoritative: boolean; reason: string }) => {
      const client = await authenticatedClient('staff');
      // Synchronous by design: the operator needs the counts to judge the mirror.
      const { data, error, response } = await client.POST('/api/admin/organisations/imports/runs', {
        body: input,
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) {
        const body = error as { error?: unknown; details?: { code?: string } } | undefined;
        throw new CustomerWriteError(
          body?.details?.code ?? (response.status === 403 ? 'DENIED' : 'UNAVAILABLE'),
          typeof body?.error === 'string' ? body.error : '',
        );
      }
      return data;
    },
    onSuccess: () => { void queryClient.invalidateQueries(); },
  });
}
