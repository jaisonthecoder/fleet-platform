import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '../../../api/generated/schema';
import { authenticatedClient } from '../../auth/api/current-user';
import { StaffError } from '../../staff/api/staff';

export type LookupCategory = components['schemas']['LookupCategoryDto'];
export type LookupItem = components['schemas']['LookupItemDto'];
export type LookupTranslation = components['schemas']['LookupTranslationDto'];
export type LookupCategoryCreate = components['schemas']['LookupCategoryCreateDto'];
export type LookupCategoryUpdate = components['schemas']['LookupCategoryUpdateDto'];
export type LookupItemCreate = components['schemas']['LookupItemCreateDto'];
export type LookupItemUpdate = components['schemas']['LookupItemUpdateDto'];

/** Carries the server's reason so a conflict can be explained, not just flagged. */
export class LookupWriteError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

function failure(response: Response): never {
  throw new StaffError(response.status === 401 || response.status === 403 ? 'denied' : 'unavailable');
}

/**
 * Builds a write error from the body openapi-fetch has already parsed.
 *
 * The API's exception filter emits `{ statusCode, error, details, correlationId,
 * path }`, so the human message is `error` and any machine code is `details.code`.
 * Do not re-read the Response: openapi-fetch consumes the stream, so a second
 * read yields nothing and every server message is lost.
 */
function writeFailure(response: Response, error: unknown): never {
  const body = error as { error?: unknown; details?: { code?: string } } | undefined;
  const message = typeof body?.error === 'string' ? body.error : '';
  const code = body?.details?.code ?? (response.status === 403 ? 'DENIED' : 'UNAVAILABLE');
  throw new LookupWriteError(code, message);
}

export function useLookupCategories() {
  return useQuery({
    queryKey: ['lookup-categories'], retry: false,
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('staff');
      const { data, response } = await client.GET('/api/admin/lookups/categories', {
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}

export type LookupItemFilters = {
  search: string;
  status: 'all' | 'active' | 'inactive';
  visibility: 'all' | 'customer' | 'internal';
  page: number;
  pageSize: number;
};

export function useLookupItems(code: string | null, filters: LookupItemFilters) {
  return useQuery({
    queryKey: ['lookup-items', code, filters], retry: false, enabled: Boolean(code),
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('staff');
      const { data, response } = await client.GET('/api/admin/lookups/categories/{code}/items', {
        params: { path: { code: code as string }, query: filters },
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}

/** Empty for a flat list, which is how the form knows to hide the parent field. */
export function useLookupParentOptions(code: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['lookup-parents', code], retry: false, enabled: Boolean(code) && enabled,
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('staff');
      const { data, response } = await client.GET('/api/admin/lookups/categories/{code}/parent-options', {
        params: { path: { code: code as string } },
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}

function useLookupMutation<TVariables, TResult>(run: (client: Awaited<ReturnType<typeof authenticatedClient>>, variables: TVariables) => Promise<{ data?: TResult; error?: unknown; response: Response }>) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async (variables: TVariables) => {
      const client = await authenticatedClient('staff');
      const { data, error, response } = await run(client, variables);
      if (!response.ok || !data) return writeFailure(response, error);
      return data;
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['lookup-categories'] });
      await cache.invalidateQueries({ queryKey: ['lookup-items'] });
      await cache.invalidateQueries({ queryKey: ['lookup-parents'] });
    },
  });
}

export function useCreateLookupCategory() {
  return useLookupMutation<LookupCategoryCreate, LookupCategory>((client, body) =>
    client.POST('/api/admin/lookups/categories', { body, signal: AbortSignal.timeout(10000) }),
  );
}

export function useUpdateLookupCategory() {
  return useLookupMutation<{ code: string; body: LookupCategoryUpdate }, LookupCategory>((client, { code, body }) =>
    client.PATCH('/api/admin/lookups/categories/{code}', {
      params: { path: { code } }, body, signal: AbortSignal.timeout(10000),
    }),
  );
}

export function useCreateLookupItem() {
  return useLookupMutation<{ code: string; body: LookupItemCreate }, LookupItem>((client, { code, body }) =>
    client.POST('/api/admin/lookups/categories/{code}/items', {
      params: { path: { code } }, body, signal: AbortSignal.timeout(10000),
    }),
  );
}

export function useUpdateLookupItem() {
  return useLookupMutation<{ id: string; body: LookupItemUpdate }, LookupItem>((client, { id, body }) =>
    client.PATCH('/api/admin/lookups/items/{id}', {
      params: { path: { id } }, body, signal: AbortSignal.timeout(10000),
    }),
  );
}
