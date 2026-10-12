import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '../../../api/generated/schema';
import { authenticatedClient } from '../../auth/api/current-user';
import { StaffError } from '../../staff/api/staff';
import { LookupWriteError } from '../../admin/api/lookups';

export type QueueEntry = components['schemas']['PricingQueueEntryDto'];
export type QuotationRow = components['schemas']['PricingQuotationDto'];
export type PricingQuote = components['schemas']['PricingQuoteDto'];
export type PricingOption = components['schemas']['QuoteOptionDto'];
export type PricingChargeLine = components['schemas']['QuoteChargeLineDto'];
export type PriceQuoteBody = components['schemas']['PriceQuoteDto'];

function failure(response: Response): never {
  throw new StaffError(response.status === 401 || response.status === 403 ? 'denied' : 'unavailable');
}

/**
 * Matches the API exception filter. A 409 carries the name of whoever holds the
 * claim, which is the difference between walking to a colleague's desk and filing
 * a ticket - so the message is kept, not replaced with a generic one.
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

export function usePricingQueue() {
  return useQuery({
    queryKey: ['pricing-queue'],
    retry: false,
    // A queue two people are working is stale the moment it is drawn. Refetching on
    // focus is what stops someone claiming a request a colleague took minutes ago.
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('staff');
      const { data, response } = await client.GET('/api/pricing/queue', {
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}

export interface QuotationListParams {
  search: string;
  /** A pipeline segment key, or '' for every state. */
  segment: string;
  /** A saved view: 'all', 'unclaimed', 'mine' or 'expiring'. */
  view: string;
  /** Transport mode, or '' for every mode. */
  mode: string;
  /** ISO dates from the drawer's range, inclusive. '' for open-ended. */
  requestedFrom: string;
  requestedTo: string;
  page: number;
  pageSize: number;
}

/**
 * The branch's quotations, paged by the server.
 *
 * Separate from `usePricingQueue`, which is the work list behind the sidebar
 * count. This one carries settled quotes too, because the pipeline band has to
 * be able to say how many were accepted and how many lapsed.
 */
export function usePricingQuotations(params: QuotationListParams) {
  return useQuery({
    queryKey: [
      'pricing-quotations',
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
    // A list two people are working is stale the moment it is drawn. Refetching
    // on focus is what stops someone re-pricing a quote a colleague just sent.
    refetchOnWindowFocus: true,
    placeholderData: (previous) => previous,
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('staff');
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

      const { data, response } = await client.GET('/api/pricing/quotations', {
        params: { query: query as never },
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}

export function usePricingQuote(id: string | undefined) {
  return useQuery({
    queryKey: ['pricing-quote', id],
    enabled: Boolean(id),
    retry: false,
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('staff');
      const { data, response } = await client.GET('/api/pricing/quotes/{id}', {
        params: { path: { id: id! } },
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      });
      if (!response.ok || !data) return failure(response);
      return data;
    },
  });
}

function useQuoteMutation<TArgs>(
  send: (client: Awaited<ReturnType<typeof authenticatedClient>>, args: TArgs) => Promise<{
    data?: unknown;
    error?: unknown;
    response: Response;
  }>,
) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async (args: TArgs) => {
      const client = await authenticatedClient('staff');
      const { data, error, response } = await send(client, args);
      if (!response.ok) return writeFailure(response, error);
      return data;
    },
    // Both the queue and the open quote change on every one of these, and the queue
    // is what another specialist is looking at.
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['pricing-queue'] });
      void cache.invalidateQueries({ queryKey: ['pricing-quote'] });
    },
  });
}

export function useClaimQuote() {
  return useQuoteMutation<string>((client, id) =>
    client.POST('/api/pricing/quotes/{id}/claim', {
      params: { path: { id } },
      signal: AbortSignal.timeout(10000),
    }),
  );
}

export function useReleaseQuote() {
  return useQuoteMutation<string>((client, id) =>
    client.POST('/api/pricing/quotes/{id}/release', {
      params: { path: { id } },
      signal: AbortSignal.timeout(10000),
    }),
  );
}

export function useForceReleaseQuote() {
  return useQuoteMutation<{ id: string; reason: string }>((client, { id, reason }) =>
    client.POST('/api/pricing/quotes/{id}/force-release', {
      params: { path: { id } },
      body: { reason },
      signal: AbortSignal.timeout(10000),
    }),
  );
}

export function usePriceQuote() {
  return useQuoteMutation<{ id: string; body: PriceQuoteBody }>((client, { id, body }) =>
    client.POST('/api/pricing/quotes/{id}/price', {
      params: { path: { id } },
      body,
      signal: AbortSignal.timeout(20000),
    }),
  );
}

export function useApproveQuote() {
  return useQuoteMutation<string>((client, id) =>
    client.POST('/api/pricing/quotes/{id}/approve', {
      params: { path: { id } },
      signal: AbortSignal.timeout(10000),
    }),
  );
}

export function useSendBackQuote() {
  return useQuoteMutation<{ id: string; reason: string }>((client, { id, reason }) =>
    client.POST('/api/pricing/quotes/{id}/send-back', {
      params: { path: { id } },
      body: { reason },
      signal: AbortSignal.timeout(10000),
    }),
  );
}

export function usePublishQuote() {
  return useQuoteMutation<string>((client, id) =>
    client.POST('/api/pricing/quotes/{id}/publish', {
      params: { path: { id } },
      signal: AbortSignal.timeout(15000),
    }),
  );
}
