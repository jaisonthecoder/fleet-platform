import { Fragment, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ExpandedState,
  type OnChangeFn,
  type Row,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]

  /** Placeholder for the search box. Omitting it (in client mode) hides the box. */
  searchPlaceholder?: string
  /** Empty-state message when there are no rows. */
  emptyText?: string
  /** Client-mode rows per page (ignored in manual mode — use `pageSize`). */
  pageSize?: number

  // ── Server / manual mode ────────────────────────────────────────────────
  /** Drive pagination/sorting/filtering from props (server-side). */
  manual?: boolean
  /** Total row count across all pages (manual mode). */
  total?: number
  /** Current 1-based page (manual mode). */
  page?: number
  /** Called with the next 1-based page. */
  onPageChange?: (page: number) => void
  /** Called with the next page size. */
  onPageSizeChange?: (pageSize: number) => void
  /** Controlled sorting (manual mode). */
  sorting?: SortingState
  onSortingChange?: OnChangeFn<SortingState>
  /** Controlled search value (manual mode). */
  search?: string
  onSearchChange?: (value: string) => void
  /** Extra filter controls rendered in the toolbar, next to the search box. */
  toolbar?: React.ReactNode
  /** Page-size choices offered in the footer selector. */
  pageSizeOptions?: number[]
  /** Renders skeleton rows instead of data while loading. */
  isLoading?: boolean

  // ── Interaction ──────────────────────────────────────────────────────────
  /** Makes each row activatable (click / Enter / Space). */
  onRowClick?: (row: TData) => void
  /** When a row can expand, TanStack calls this; pair with `renderSubRow`. */
  getRowCanExpand?: (row: Row<TData>) => boolean
  /** Renders the expanded sub-row content (tree children, detail panel…). */
  renderSubRow?: (row: Row<TData>) => React.ReactNode
  /** Enables the internal row-selection model. */
  enableRowSelection?: boolean
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

/** Builds a compact page list with ellipsis markers around the current page. */
function pageWindow(current: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const pages: (number | 'gap')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(totalPages - 1, current + 1)
  if (start > 2) pages.push('gap')
  for (let p = start; p <= end; p += 1) pages.push(p)
  if (end < totalPages - 1) pages.push('gap')
  pages.push(totalPages)
  return pages
}

/**
 * One reusable data table (TanStack Table). In client mode it filters, sorts
 * and paginates the given `data` in the browser (back-compatible default). In
 * `manual` mode it becomes a controlled shell driven by props (server-side
 * pagination/sorting/filtering). Supports a toolbar filter slot, page-size
 * selector, sortable + sticky headers, skeleton loading, empty state, row
 * click, expandable sub-rows and row selection.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder,
  emptyText = 'No results.',
  pageSize = 8,
  manual = false,
  total,
  page = 1,
  onPageChange,
  onPageSizeChange,
  sorting,
  onSortingChange,
  search,
  onSearchChange,
  toolbar,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  isLoading = false,
  onRowClick,
  getRowCanExpand,
  renderSubRow,
  enableRowSelection = false,
}: DataTableProps<TData, TValue>) {
  const [clientSorting, setClientSorting] = useState<SortingState>([])
  const [clientFilter, setClientFilter] = useState('')
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const activeSorting = manual ? (sorting ?? []) : clientSorting

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting: activeSorting,
      globalFilter: manual ? undefined : clientFilter,
      expanded,
      rowSelection,
    },
    onSortingChange: manual ? onSortingChange : setClientSorting,
    onGlobalFilterChange: manual ? undefined : setClientFilter,
    onExpandedChange: setExpanded,
    onRowSelectionChange: setRowSelection,
    getRowCanExpand,
    enableRowSelection,
    manualPagination: manual,
    manualSorting: manual,
    manualFiltering: manual,
    pageCount: manual
      ? Math.max(1, Math.ceil((total ?? 0) / Math.max(1, pageSize)))
      : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manual ? undefined : getSortedRowModel(),
    getFilteredRowModel: manual ? undefined : getFilteredRowModel(),
    getPaginationRowModel: manual ? undefined : getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    initialState: manual ? undefined : { pagination: { pageSize } },
  })

  const showSearch = Boolean(searchPlaceholder) || Boolean(onSearchChange)
  const searchValue = manual ? (search ?? '') : clientFilter
  const setSearch = (value: string) => {
    if (manual) onSearchChange?.(value)
    else setClientFilter(value)
  }

  // Row/page maths for the footer count + navigation.
  const currentPageSize = manual
    ? pageSize
    : table.getState().pagination.pageSize
  const currentPage = manual ? page : table.getState().pagination.pageIndex + 1
  const totalRows = manual
    ? (total ?? 0)
    : table.getFilteredRowModel().rows.length
  const totalPages = manual
    ? Math.max(1, Math.ceil(totalRows / Math.max(1, currentPageSize)))
    : Math.max(1, table.getPageCount())
  const firstRow = totalRows === 0 ? 0 : (currentPage - 1) * currentPageSize + 1
  const lastRow = Math.min(totalRows, currentPage * currentPageSize)

  const goToPage = (next: number) => {
    const clamped = Math.min(totalPages, Math.max(1, next))
    if (manual) onPageChange?.(clamped)
    else table.setPageIndex(clamped - 1)
  }

  const changePageSize = (next: number) => {
    if (manual) onPageSizeChange?.(next)
    else table.setPageSize(next)
  }

  const rows = table.getRowModel().rows
  const canPrev = currentPage > 1
  const canNext = currentPage < totalPages

  return (
    <div className="space-y-3">
      {showSearch || toolbar ? (
        <div className="flex flex-wrap items-center gap-3">
          {showSearch ? (
            <div className="relative min-w-[16rem] flex-1 sm:max-w-xs">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={searchValue}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder ?? 'Search…'}
                className="ps-9"
                aria-label={searchPlaceholder ?? 'Search'}
              />
            </div>
          ) : null}
          {toolbar ? (
            <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[3px] border border-border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-surface-2">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="-mx-1 inline-flex items-center gap-1 rounded-[3px] px-1 uppercase outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {sorted === 'asc' ? (
                            <ArrowUp className="size-3" aria-hidden="true" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="size-3" aria-hidden="true" />
                          ) : (
                            <ChevronsUpDown
                              className="size-3 opacity-50"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, rowIndex) => (
                <TableRow
                  key={`skeleton-${rowIndex}`}
                  className="hover:bg-transparent"
                >
                  {columns.map((_column, colIndex) => (
                    <TableCell key={`skeleton-${rowIndex}-${colIndex}`}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length ? (
              rows.map((row) => {
                const clickable = Boolean(onRowClick)
                return (
                  <Fragment key={row.id}>
                    <TableRow
                      data-state={row.getIsSelected() ? 'selected' : undefined}
                      className={cn(
                        row.getIsSelected() && 'bg-signal/5',
                        clickable &&
                          'cursor-pointer focus-visible:bg-muted focus-visible:outline-none',
                      )}
                      tabIndex={clickable ? 0 : undefined}
                      role={clickable ? 'button' : undefined}
                      onClick={
                        clickable ? () => onRowClick?.(row.original) : undefined
                      }
                      onKeyDown={
                        clickable
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                onRowClick?.(row.original)
                              }
                            }
                          : undefined
                      }
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    {renderSubRow && row.getIsExpanded() ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={row.getVisibleCells().length}
                          className="bg-surface-2/40 p-0"
                        >
                          {renderSubRow(row)}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                )
              })
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="font-data">
            {firstRow.toLocaleString()}–{lastRow.toLocaleString()} of{' '}
            {totalRows.toLocaleString()}
          </span>
          <span className="hidden items-center gap-2 sm:flex">
            <span>Rows</span>
            <Select
              value={String(currentPageSize)}
              onValueChange={(v) => changePageSize(Number(v))}
            >
              <SelectTrigger
                className="h-8 w-[4.5rem]"
                aria-label="Rows per page"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </span>
        </div>

        <Pagination className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => goToPage(currentPage - 1)}
                disabled={!canPrev}
              />
            </PaginationItem>
            {pageWindow(currentPage, totalPages).map((entry, index) =>
              entry === 'gap' ? (
                <PaginationItem key={`gap-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={entry}>
                  <PaginationLink
                    isActive={entry === currentPage}
                    onClick={() => goToPage(entry)}
                  >
                    {entry}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                onClick={() => goToPage(currentPage + 1)}
                disabled={!canNext}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  )
}
