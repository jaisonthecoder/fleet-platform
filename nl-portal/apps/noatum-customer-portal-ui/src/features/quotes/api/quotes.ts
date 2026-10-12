import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components, paths } from '../../../api/generated/schema';
import { authenticatedClient } from '../../auth/api/current-user';
import { StaffError } from '../../staff/api/staff';
import { LookupWriteError } from '../../admin/api/lookups';

export type QuoteSummary = components['schemas']['CustomerQuoteSummaryDto'];
export type CustomerQuote = components['schemas']['CustomerQuoteDto'];
export type CustomerQuoteOption = components['schemas']['CustomerQuoteOptionDto'];

export interface QuoteListParams {
  search: string;
  /** A pipeline segment key, or '' for every state. */
  segment: string;
  /** A saved view: 'all', 'needs_decision' or 'accepted'. */
  view: string;
  /** Transport mode, or '' for every mode. */
  mode: string;
  /** ISO dates from the drawer's range, inclusive. '' for open-ended. */
  requestedFrom: string;
  requestedTo: string;
  page: number;
  pageSize: number;
}

function failure(response: Response): never {
  throw new StaffError(response.status === 401 || response.status === 403 ? 'denied' : 'unavailable');
}

/**
 * Keeps the server's sentence.
 *
 * A 409 here is not noise: "this quote has been re-priced since you opened it"
 * is the whole explanation for why the button did nothing, and replacing it with
 * a generic failure would leave the customer with no idea what to do next.
 */
function writeFailure(response: Response, error: unknown): never {
  const body = error as { error?: unknown; message?: unknown; details?: { code?: string } } | undefined;
  const message =
    typeof body?.error === 'string' ? body.error : typeof body?.message === 'string' ? body.message : '';
  const code =
    body?.details?.code ??
    (response.status === 409 ? 'CONFLICT' : response.status === 403 ? 'DENIED' : 'UNAVAILABLE');
  throw new LookupWriteError(code, message);
}

export function useQuotes(params: QuoteListParams) {
  return useQuery({
    queryKey: [
      'quotes',
      params.search,
      params.segment,
      params.view,
      params.mode,
      params.requestedFrom,
      params.requestedTo,
      params.page,
      params.pageSize,
    ],
    retry: false,
    // The page stays on screen while a filter change is answered, so the grid
    // does not blink back to skeletons every time a segment is picked.
    placeholderData: (previous) => previous,
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('customer');
      const query: Record<string, string> = {
        page: String(params.page),
        pageSize: String(params.pageSize),
      };
      if (params.search) query.search = params.search;
      if (params.segment) query.segment = params.segment;
      if (params.view && params.view !== 'all') query.view = params.view;
      if (params.mode) query.mode = params.mode;
      if (params.requestedFrom) query.requestedFrom = params.requestedFrom;
      if (params.requestedTo) query.requestedTo = params.requestedTo;

      const { data, response } = await client.GET('/api/quotes', {
        params: { query: query as never },
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}

export function useQuote(id: string | undefined) {
  return useQuery({
    queryKey: ['quote', id],
    enabled: Boolean(id),
    retry: false,
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('customer');
      const { data, response } = await client.GET('/api/quotes/{id}', {
        params: { path: { id: id! } },
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data as CustomerQuote;
    },
  });
}

function useQuoteMutation<TArgs>(
  send: (
    client: Awaited<ReturnType<typeof authenticatedClient>>,
    args: TArgs,
  ) => Promise<{ data?: unknown; error?: unknown; response: Response }>,
) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async (args: TArgs) => {
      const client = await authenticatedClient('customer');
      const { data, error, response } = await send(client, args);
      if (!response.ok) return writeFailure(response, error);
      return data;
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['quotes'] });
      void cache.invalidateQueries({ queryKey: ['quote'] });
    },
  });
}

/**
 * The request body, taken from the generated client rather than hand-written.
 *
 * This is the guard that was missing. The route used to emit no requestBody, so
 * the generated type was `never` and every caller cast it away - which is how a
 * lookup label reached a code column with nothing to catch it.
 */
export type CreateQuoteBody = NonNullable<
  paths['/api/quotes']['post']['requestBody']
>['content']['application/json'];

/** One dangerous goods entry as the API accepts it. */
export type DangerousGoodsInput = NonNullable<CreateQuoteBody['dangerousGoods']>[number];

export function useCreateQuote() {
  return useQuoteMutation<CreateQuoteBody>((client, body) =>
    client.POST('/api/quotes', { body, signal: AbortSignal.timeout(15000) }),
  );
}

export function useSubmitQuote() {
  return useQuoteMutation<string>((client, id) =>
    client.POST('/api/quotes/{id}/submit', {
      params: { path: { id } },
      signal: AbortSignal.timeout(10000),
    }),
  );
}

export function useAcceptQuote() {
  return useQuoteMutation<{ id: string; optionId: string; version: number }>(
    (client, { id, optionId, version }) =>
      client.POST('/api/quotes/{id}/accept', {
        params: { path: { id } },
        body: { optionId, version },
        signal: AbortSignal.timeout(10000),
      }),
  );
}

export function useDeclineQuote() {
  return useQuoteMutation<{ id: string; reason: string }>((client, { id, reason }) =>
    client.POST('/api/quotes/{id}/decline', {
      params: { path: { id } },
      body: { reason: reason.trim() === '' ? null : reason.trim() },
      signal: AbortSignal.timeout(10000),
    }),
  );
}

export function useCancelQuote() {
  return useQuoteMutation<string>((client, id) =>
    client.POST('/api/quotes/{id}/cancel', {
      params: { path: { id } },
      signal: AbortSignal.timeout(10000),
    }),
  );
}
