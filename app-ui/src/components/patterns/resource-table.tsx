import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'
import { TableRowsSkeleton } from '@/components/patterns/skeletons'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface ResourceTableProps<T> {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  searchPlaceholder?: string
  emptyText?: string
  /** Actions/filters rendered above the table (title, buttons, view toggles…). */
  toolbar?: ReactNode
  pageSize?: number
}

/**
 * List surface for every resource screen: an optional toolbar, then one of the
 * four states — loading (skeleton), error (retry), empty (via `emptyText`) or a
 * populated {@link DataTable} (search + sort + pagination). Domain-agnostic.
 */
export function ResourceTable<T>({
  columns,
  data,
  isLoading,
  isError,
  onRetry,
  searchPlaceholder,
  emptyText,
  toolbar,
  pageSize,
}: ResourceTableProps<T>) {
  const { t } = useTranslation()
  return (
    <div className="space-y-3">
      {toolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {toolbar}
        </div>
      ) : null}

      {isError ? (
        <Alert tone="danger">
          <AlertTriangle />
          <AlertTitle>{t('error.title')}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            {t('error.body')}
            {onRetry ? (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                {t('common.retry')}
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="overflow-hidden rounded-[3px] border border-border">
          <TableRowsSkeleton rows={6} cols={columns.length || 4} />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data}
          searchPlaceholder={searchPlaceholder}
          emptyText={emptyText}
          pageSize={pageSize}
        />
      )}
    </div>
  )
}
