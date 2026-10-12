import { useTranslation } from 'react-i18next';

import { DataGrid, type DataGridLabels, type DataGridProps } from '../../design-system';

/**
 * The listing, wired to the shared vocabulary.
 *
 * `DataGrid` in the design system takes every string as a prop, because it has
 * to serve feature areas that do not share an i18n namespace. This fills in the
 * chrome — filters, paging, the view switch, the empty and error states — from
 * the default namespace, and leaves each screen to pass only the words that are
 * its own: what its rows are called, and what it means when there are none.
 *
 * It lives in `shared/` rather than under a feature because both the
 * administration screens and the staff directory use it, and a page reaching
 * into another feature's folder is how a second copy gets made.
 *
 * Use this on every list screen. Do not compose a toolbar by hand.
 */
export type ListingGridProps<Row> = Omit<DataGridProps<Row>, 'labels'> & {
  /** Placeholder and accessible name for the search field, e.g. "Search organisations". */
  searchLabel: string;
  /** Shown when the list is genuinely empty, before any filter is applied. */
  emptyLabel: string;
  /** Shown when a search or filter excluded everything. Defaults to the shared copy. */
  emptyFilteredLabel?: string;
  /** Shown when the request failed. Pass the reason; defaults to the shared copy. */
  errorLabel?: string;
};

export function ListingGrid<Row>({
  searchLabel,
  emptyLabel,
  emptyFilteredLabel,
  errorLabel,
  ...rest
}: ListingGridProps<Row>) {
  const { t } = useTranslation();

  const labels: DataGridLabels = {
    search: searchLabel,
    filters: t('filters'),
    filterTitle: t('filterTitle'),
    filterDescription: t('filterDescription'),
    apply: t('apply'),
    clearAll: t('clearAll'),
    close: t('close'),
    any: t('any'),
    selectedCount: (count) => t('selectedCount', { count }),
    removeFilter: (label) => t('removeFilter', { label }),
    customRange: t('customRange'),
    dateFrom: t('dateFrom'),
    dateTo: t('dateTo'),
    invalidDateRange: t('invalidDateRange'),
    view: t('viewMode'),
    grid: t('grid'),
    cards: t('cards'),
    loading: t('loading'),
    empty: emptyLabel,
    emptyFiltered: emptyFilteredLabel ?? t('listingNoResults'),
    error: errorLabel ?? t('listingLoadFailed'),
    retry: t('retry'),
    previous: t('previous'),
    next: t('next'),
    lastPage: t('lastPage'),
    rows: t('rowsPerPage'),
    page: (page, count) => t('page', { page, total: count }),
    showing: (first, last, total) => t('showingRange', { from: first, to: last, total }),
    resultCount: (total) => t('resultCount', { count: total }),
    views: t('savedViews'),
    selectedRows: (count) => t('selectedRows', { count }),
    clearSelection: t('clearSelection'),
  };

  return <DataGrid {...rest} labels={labels} />;
}
