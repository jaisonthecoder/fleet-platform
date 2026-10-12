import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { components } from '../../api/generated/schema';
import { authenticatedClient } from '../../features/auth/api/current-user';

export type ReferenceItem = components['schemas']['ReferenceItemDto'];

/**
 * The lookup categories a screen may read.
 *
 * Mirrors REFERENCE_CATEGORIES in the API contracts. Named here so a screen
 * cannot pass an invented string and get a silently empty dropdown.
 */
export const REFERENCE = {
  carrier: 'carrier',
  chargeBasis: 'charge_basis',
  packageType: 'package_type',
  containerType: 'container_type',
  loadType: 'load_type',
  incoterm: 'incoterm',
  currency: 'currency',
  transportMode: 'transport_mode',
  serviceLevel: 'service_level',
  commodityGroup: 'commodity_group',
  hazardClass: 'hazard_class',
  dgPackingGroup: 'dg_packing_group',
  dgPackagingType: 'dg_packaging_type',
  dgTransportRegime: 'dg_transport_regime',
  dgQuantityUnit: 'dg_quantity_unit',
  reeferVentilation: 'reefer_ventilation',
  reeferDataLogger: 'reefer_data_logger',
  liftingMethod: 'lifting_method',
  country: 'country',
  weightUnit: 'weight_unit',
  volumeUnit: 'volume_unit',
  dimensionUnit: 'dimension_unit',
} as const;

export type ReferenceCategory = (typeof REFERENCE)[keyof typeof REFERENCE];

export interface UseReferenceOptions {
  /** Narrows by `metadata.modes` - an air quote should not offer MSC. */
  mode?: string;
  /** Which audience is asking. Staff and customer share the endpoint. */
  audience?: 'staff' | 'customer';
  enabled?: boolean;
}

/**
 * One way to read an option list, for every screen.
 *
 * Before this, each screen hard-coded its own array - so `package_type` existed
 * in the database AND in three TypeScript files, and adding a packaging type
 * meant a deployment. The values are data, maintained on the Lookups screen; the
 * category names are code.
 *
 * Cached for an hour and never refetched on focus: reference data changes when an
 * administrator edits it, which is rare, and a dropdown that re-requests every
 * time a window regains focus is pure traffic.
 *
 * Fails to an EMPTY LIST, never an error. A missing category must not take a form
 * down - the fields it feeds all accept free text or have a sensible default, so
 * an empty list degrades to typing rather than to a blank screen.
 */
export function useReference(category: ReferenceCategory, options: UseReferenceOptions = {}) {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  const audience = options.audience ?? 'staff';

  return useQuery({
    queryKey: ['reference', category, options.mode ?? '', locale, audience],
    enabled: options.enabled ?? true,
    retry: false,
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }): Promise<ReferenceItem[]> => {
      const client = await authenticatedClient(audience);

      const { data, response } = await client.GET('/api/reference/{category}', {
        params: {
          path: { category },
          query: options.mode ? { locale, mode: options.mode } : { locale },
        },
        signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      });

      if (!response.ok || !Array.isArray(data)) return [];
      return data;
    },
  });
}

/** The labels alone, for a ComboInput or a datalist. */
export function useReferenceLabels(
  category: ReferenceCategory,
  options: UseReferenceOptions = {},
): string[] {
  const query = useReference(category, options);
  return (query.data ?? []).map((item) => item.label);
}

/** Shaped for a Select, which wants `{ value, label }`. */
export function useReferenceOptions(
  category: ReferenceCategory,
  options: UseReferenceOptions = {},
): { value: string; label: string }[] {
  const query = useReference(category, options);
  return (query.data ?? []).map((item) => ({ value: item.code, label: item.label }));
}

/**
 * Code to label, for rendering a stored code.
 *
 * A read-only screen holds the code it saved, and showing 'FRESH_AIR' where
 * "Fresh air, fully open" belongs is the same defect as storing a label. Falls
 * back to the code, so a retired item still reads as something.
 */
export function useReferenceLabelMap(
  category: ReferenceCategory,
  options: UseReferenceOptions = {},
): (code: string | null) => string | null {
  const query = useReference(category, options);
  const items = query.data ?? [];

  return (code) => {
    if (code === null || code === '') return null;
    return items.find((item) => item.code === code)?.label ?? code;
  };
}
