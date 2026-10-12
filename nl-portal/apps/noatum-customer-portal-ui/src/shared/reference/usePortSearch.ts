import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { authenticatedClient } from '../../features/auth/api/current-user';
import type { components } from '../../api/generated/schema';

export type Port = components['schemas']['PortDto'];

/**
 * How many rows an unsearched list opens with.
 *
 * The field used to show nothing until two characters were typed, which reads as
 * a broken box: there is no way to tell "keep typing" from "there is nothing
 * here". It now opens on the first page in name order, and typing narrows it.
 */
const BROWSE_LIMIT = 50;

/**
 * Typing pause before a search is sent.
 *
 * 250ms is roughly the gap between words rather than between keystrokes, so a
 * six-letter port costs one request instead of six. The directory is ~100k rows;
 * the point of the pause is the server's work, not the network's.
 */
const DEBOUNCE_MS = 250;

/**
 * Port autocomplete, against the directory rather than a lookup.
 *
 * Deliberately NOT `useReference`: that fetches a whole category once and caches
 * it for an hour, which is right for fifteen package types and impossible for the
 * UN/LOCODE directory. Here every keystroke-pause is its own query, cached by the
 * text that produced it, so going back a character is instant.
 */
export function usePortSearch(query: string, options: { mode?: string; country?: string } = {}) {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  const [settled, setSettled] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Sea and air are the only modes the directory distinguishes. Anything else
  // narrows nothing rather than returning nothing, because a road or rail leg can
  // begin at either kind of location.
  const mode = options.mode === 'sea' || options.mode === 'air' ? options.mode : undefined;
  const trimmed = settled.trim();

  return useQuery({
    queryKey: ['ports', trimmed, mode ?? '', options.country ?? '', locale],
    enabled: true,
    retry: false,
    // A port's name does not change while the form is open.
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }): Promise<Port[]> => {
      const client = await authenticatedClient('customer');
      const { data, response } = await client.GET('/api/ports/search', {
        params: {
          query: {
            /* One character filters worse than none - "a" matches most of the
               directory - so anything shorter than two browses instead. */
            ...(trimmed.length >= 2 ? { q: trimmed } : { limit: BROWSE_LIMIT }),
            locale,
            ...(mode ? { mode } : {}),
            ...(options.country ? { country: options.country } : {}),
          },
        },
        signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      });
      if (!response.ok || !Array.isArray(data)) return [];
      return data;
    },
  });
}

/** "ESVLC — Valencia", the one string the field shows and matches against. */
export function portLabel(port: Port): string {
  return `${port.code} — ${port.name}`;
}

/**
 * The UN/LOCODE inside whatever the field currently holds.
 *
 * The field accepts a typed code as readily as a picked suggestion, so this reads
 * both: "ESVLC — Valencia" and a bare "ESVLC" answer the same.
 */
export function portCodeFrom(value: string): string {
  const [head] = value.trim().toUpperCase().split(/[\s—-]+/);
  return head ?? '';
}
