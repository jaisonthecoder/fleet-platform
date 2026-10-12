import { useTranslation } from 'react-i18next';

import { DataTable, Pagination, StatePanel, type TableColumn } from '../../../design-system';

/**
 * One listing, one shape. Every administration grid goes through here so the
 * pagination, the empty state and the error state cannot be forgotten or drift
 * apart between screens.
 *
 * Pass `total` for server-side paging; pass nothing and the footer only appears
 * once the rows outgrow a page.
 */
export function AdminListing<Row>({
  caption,
  columns,
  rows,
  rowKey,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
  isPending = false,
  error,
  emptyLabel,
}: {
  caption: string;
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  isPending?: boolean;
  error?: unknown;
  emptyLabel: string;
}) {
  const { t } = useTranslation('staff');

  if (error) return <div role="alert"><StatePanel title={emptyLabel} /></div>;
  if (isPending) return <div role="status"><StatePanel title={t('loading')} /></div>;
  if (rows.length === 0) return <StatePanel title={emptyLabel} />;

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  return (
    <>
      <DataTable caption={caption} columns={columns} rows={rows} rowKey={rowKey} />
      {total > pageSize || onPageSizeChange ? (
        <Pagination
          label={t('page', { page, count: pageCount })}
          rangeLabel={t('listingShowing', { first, last, count: total })}
          page={page}
          pageCount={Math.min(10_000, pageCount)}
          previousLabel={t('previous')}
          nextLabel={t('next')}
          onPageChange={onPageChange}
          {...(onPageSizeChange
            ? { pageSize, pageSizeLabel: t('rows'), pageSizeOptions: pageSizeOptions ?? [25, 50, 100], onPageSizeChange }
            : {})}
        />
      ) : null}
    </>
  );
}
