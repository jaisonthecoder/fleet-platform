import { Select } from './Select';
import type { CSSProperties, ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ChevronsRight, List, ArrowDown, ArrowUp } from 'lucide-react';
import { Checkbox, Tooltip } from './Controls';
import { pipelineTone } from './DataView';
import { Table, TableCaption, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../primitives/table';

export interface TableColumn<Row> {
  key: string;
  label: string;
  render: (row: Row) => ReactNode;
  sortable?: boolean;
  /** `end` for figures. A money column read down its left edge is unreadable. */
  align?: 'start' | 'end';
  /**
   * Share of the row, e.g. "15%". Emitted as a `<col>`, which is the table's
   * equivalent of the mockup's `grid-template-columns`.
   *
   * Without it the browser divides the row by content, and one long cargo line
   * squeezes the reference column until "Q-000001" wraps in the middle. A
   * listing's column widths are a design decision, not an outcome.
   */
  width?: string;
  /**
   * A column whose heading is an empty string still needs a name in the header
   * row, or a screen reader announces the cell with no idea what it is. Put the
   * name here and the heading stays visually blank.
   */
  headerLabelHidden?: boolean;
}

export interface TableSelection<Row> {
  /** Names the checkbox column and the select-all, e.g. "Select quotations". */
  label: string;
  /** Names one row's checkbox, e.g. `(row) => "Select Q-000112"`. */
  rowLabel: (row: Row) => string;
  selected: string[];
  onChange: (keys: string[]) => void;
}

export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  sort,
  onSort,
  rowTone,
  minWidth,
  selection,
}: {
  caption: string;
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  sort?: { key: string; direction: 'ascending' | 'descending' };
  onSort?: (key: string) => void;
  /**
   * The rail down the left of a row: a pipeline tone key. It repeats the status
   * column rather than replacing it - the rail is what lets you find the three
   * rows that need you without reading any of the words.
   */
  rowTone?: (row: Row) => string | undefined;
  /** How wide the grid has to be before it starts scrolling sideways. */
  minWidth?: string;
  /** Checkbox column and select-all. Omit for a listing nothing acts on in bulk. */
  selection?: TableSelection<Row>;
}) {
  const keys = rows.map(rowKey);
  const allSelected = keys.length > 0 && keys.every((key) => selection?.selected.includes(key));
  /*
   * Select-all is select-all-on-this-page, and says so by never claiming more
   * than it did. Selecting 25 rows and offering to act on 3,000 is the oldest
   * bulk-action trap there is.
   */
  const toggleAll = () =>
    selection?.onChange(
      allSelected
        ? selection.selected.filter((key) => !keys.includes(key))
        : [...new Set([...selection.selected, ...keys])],
    );

  const toggleRow = (key: string) =>
    selection?.onChange(
      selection.selected.includes(key)
        ? selection.selected.filter((entry) => entry !== key)
        : [...selection.selected, key],
    );

  return (
    <div className="noa-table-scroll" role="region" aria-label={caption} tabIndex={0}>
      <Table
        className="noa-table"
        style={minWidth ? ({ '--noa-table-min': minWidth } as CSSProperties) : undefined}
      >
        <TableCaption className="noa-visually-hidden">{caption}</TableCaption>
        {/* The row's proportions, stated once. A `col` carries width and nothing
            else, so it cannot affect anything but the geometry. */}
        {columns.some((column) => column.width) && (
          <colgroup>
            {selection && <col className="noa-table-select" />}
            {columns.map((column) => (
              <col key={column.key} style={column.width ? { width: column.width } : undefined} />
            ))}
          </colgroup>
        )}
        <TableHeader>
          <TableRow>
            {selection && (
              <TableHead scope="col" className="noa-table-select">
                <Checkbox
                  label={selection.label}
                  labelHidden
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
            )}
            {columns.map((column) => (
              <TableHead
                key={column.key}
                scope="col"
                data-align={column.align}
                aria-sort={sort?.key === column.key ? sort.direction : undefined}
              >
                {column.sortable && onSort ? (
                  <button onClick={() => onSort(column.key)}>
                    {column.label}
                    {sort?.key === column.key &&
                      (sort.direction === 'ascending' ? (
                        <ArrowUp aria-hidden="true" />
                      ) : (
                        <ArrowDown aria-hidden="true" />
                      ))}
                  </button>
                ) : column.headerLabelHidden ? (
                  <span className="noa-visually-hidden">{column.label}</span>
                ) : (
                  column.label
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const key = rowKey(row);
            const tone = rowTone?.(row);
            return (
              <TableRow
                key={key}
                data-tone={tone}
                style={pipelineTone(tone)}
                data-selected={selection?.selected.includes(key) ? 'true' : undefined}
              >
                {selection && (
                  <TableCell className="noa-table-select">
                    <Checkbox
                      label={selection.rowLabel(row)}
                      labelHidden
                      checked={selection.selected.includes(key)}
                      onCheckedChange={() => toggleRow(key)}
                    />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell key={column.key} data-align={column.align}>
                    {column.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function Pagination({
  label,
  page,
  pageCount,
  previousLabel,
  nextLabel,
  onPageChange,
  rangeLabel,
  pageSize,
  pageSizeLabel,
  pageSizeOptions = [8, 16, 32],
  onPageSizeChange,
  lastLabel,
  navLabel,
}: {
  label: string;
  page: number;
  pageCount: number;
  previousLabel: string;
  nextLabel: string;
  onPageChange: (page: number) => void;
  rangeLabel?: string;
  pageSize?: number;
  pageSizeLabel?: string;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  lastLabel?: string;
  /**
   * Names the nav itself. `label` is the page counter ("Page 3 of 12"), so
   * without this the landmark is announced as its own contents.
   */
  navLabel?: string;
}) {
  return (
    <nav className="noa-pagination" aria-label={navLabel ?? label}>
      {rangeLabel && <span>{rangeLabel}</span>}
      <div className="noa-pagination-controls">
        {pageSize !== undefined && onPageSizeChange && (
          <div className="noa-page-size">
            <List aria-hidden="true" />
            <Select
              label={pageSizeLabel ?? label}
              labelHidden
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
              options={pageSizeOptions.map((size) => ({ value: String(size), label: String(size) }))}
            />
          </div>
        )}
        {/* CH-11: previous, rule, counter, next and last share one outline. */}
        <div className="noa-pagination-group">
          <Tooltip label={previousLabel}>
            <button
              className="noa-icon-button"
              aria-label={previousLabel}
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
          </Tooltip>
          <span className="noa-page-progress" aria-hidden="true">
            <span />
          </span>
          <span className="noa-page-number" aria-live="polite">
            {label}
          </span>
          <Tooltip label={nextLabel}>
            <button
              className="noa-icon-button"
              aria-label={nextLabel}
              disabled={page >= pageCount}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </Tooltip>
          {lastLabel && (
            <Tooltip label={lastLabel}>
              <button
                className="noa-icon-button"
                aria-label={lastLabel}
                disabled={page >= pageCount}
                onClick={() => onPageChange(pageCount)}
              >
                <ChevronsRight aria-hidden="true" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </nav>
  );
}
