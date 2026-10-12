import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plane, Ship, Truck } from 'lucide-react';
import {
  Badge,
  Button,
  Checkbox,
  CountedTabs,
  DataTable,
  FilterChip,
  FilterDrawer,
  FilterSection,
  Input,
  ListingToolbar,
  Pagination,
  RouteCell,
  Select,
  StatePanel,
  TabGroup,
  TabPanel,
  type TableColumn,
} from '@/design-system';

const samples = [
  {
    origin: 'CNTAO',
    originName: 'Qingdao',
    destination: 'ESVLC',
    city: 'Valencia',
    mode: 'seaFcl',
    status: 'delivered',
    eta: '2026-08-28',
    progress: 100,
  },
  {
    origin: 'SZX',
    originName: 'Shenzhen',
    destination: 'MAD',
    city: 'Madrid',
    mode: 'air',
    status: 'delivered',
    eta: '2026-09-05',
    progress: 100,
  },
  {
    origin: 'CAN',
    originName: 'Guangzhou',
    destination: 'MAD',
    city: 'Madrid',
    mode: 'air',
    status: 'delivered',
    eta: '2026-09-06',
    progress: 100,
  },
  {
    origin: 'MAPTM',
    originName: 'Tangier',
    destination: 'ESVLC',
    city: 'Valencia',
    mode: 'seaFcl',
    status: 'delivered',
    eta: '2026-09-07',
    progress: 100,
  },
  {
    origin: 'IST',
    originName: 'Istanbul',
    destination: 'MAD',
    city: 'Madrid',
    mode: 'air',
    status: 'inTransit',
    eta: '2026-09-10',
    progress: 40,
  },
  {
    origin: 'DEHAM',
    originName: 'Hamburg',
    destination: 'ESVLC',
    city: 'Valencia',
    mode: 'road',
    status: 'inTransit',
    eta: '2026-09-11',
    progress: 65,
  },
  {
    origin: 'FRA',
    originName: 'Frankfurt',
    destination: 'JFK',
    city: 'New York JFK',
    mode: 'air',
    status: 'customsHold',
    eta: '2026-09-12',
    progress: 80,
  },
  {
    origin: 'PKKHI',
    originName: 'Karachi',
    destination: 'ESVLC',
    city: 'Valencia',
    mode: 'seaFcl',
    status: 'delayed',
    eta: '2026-09-15',
    progress: 55,
  },
] as const;

const rows = Array.from({ length: 16 }, (_, index) => {
  const sample = samples[index % samples.length]!;
  return {
    ...sample,
    id: `DEMO-${String(index + 1).padStart(3, '0')}`,
    reference: `PO-${88190 + index}`,
    container: `DEMO-C${index + 1}`,
    hbl: `DEMO-H${index + 1}`,
    vessel: `DEMO-V${index + 1}`,
    mode: index >= 8 ? (index % 2 === 0 ? 'seaLcl' : 'seaFcl') : sample.mode,
    city: index >= 13 ? 'Barcelona' : sample.city,
    destination: index >= 13 ? 'ESBCN' : sample.destination,
    status: index >= 8 ? (index % 3 === 0 ? 'delayed' : 'inTransit') : sample.status,
    eta: index >= 8 ? `2026-09-${16 + index - 8}` : sample.eta,
    etd: '2026-08-20',
    progress: index >= 8 ? 30 : sample.progress,
  };
});
type SampleRow = (typeof rows)[number];
type Filters = {
  mode: string[];
  city: string[];
  status: string[];
  originName: string[];
  reference: string;
  etaFrom: string;
  etaTo: string;
  etdFrom: string;
  etdTo: string;
};
const blankFilters = (): Filters => ({
  mode: [],
  city: [],
  status: [],
  originName: [],
  reference: '',
  etaFrom: '',
  etaTo: '',
  etdFrom: '',
  etdTo: '',
});
const tabKeys = ['allRecords', 'inTransit', 'needsAttention', 'arrivingWeek', 'delivered'];
const statusTone = (status: string) =>
  status === 'delivered'
    ? 'success'
    : status === 'customsHold'
      ? 'error'
      : status === 'inTransit'
        ? 'info'
        : 'neutral';
const invalidDates = (filters: Filters) =>
  Boolean(
    (filters.etaFrom && filters.etaTo && filters.etaFrom > filters.etaTo) ||
    (filters.etdFrom && filters.etdTo && filters.etdFrom > filters.etdTo),
  );
const matchesTab = (row: SampleRow, tab: string) => {
  if (tab === 'allRecords') return true;
  if (tab === 'needsAttention') return ['customsHold', 'delayed'].includes(row.status);
  if (tab === 'arrivingWeek')
    return row.status !== 'delivered' && row.eta >= '2026-09-10' && row.eta <= '2026-09-16';
  return row.status === tab;
};
const matchesFilters = (row: SampleRow, filters: Filters, except?: keyof Filters) => {
  for (const key of ['mode', 'city', 'status', 'originName'] as const) {
    if (key !== except && filters[key].length && !filters[key].includes(row[key])) return false;
  }
  return (
    row.reference.toLowerCase().includes(filters.reference.toLowerCase()) &&
    (!filters.etaFrom || row.eta >= filters.etaFrom) &&
    (!filters.etaTo || row.eta <= filters.etaTo) &&
    (!filters.etdFrom || row.etd >= filters.etdFrom) &&
    (!filters.etdTo || row.etd <= filters.etdTo)
  );
};

export default function ListingPreview() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('allRecords');
  const [view, setView] = useState<'grid' | 'cards'>('grid');
  const [state, setState] = useState('ready');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [sort, setSort] = useState({
    key: 'eta',
    direction: 'ascending' as 'ascending' | 'descending',
  });
  const [filters, setFilters] = useState<Filters>(blankFilters);
  const [draft, setDraft] = useState<Filters>(blankFilters);
  const [open, setOpen] = useState(false);
  const [savedViews, setSavedViews] = useState<
    {
      id: string;
      filters: Filters;
      query: string;
      tab: string;
      view: 'grid' | 'cards';
      pageSize: number;
      sort: typeof sort;
    }[]
  >([]);
  const [savedId, setSavedId] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const filterTrigger = useRef<HTMLButtonElement>(null);
  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00Z`));
  const searched = rows.filter((row) =>
    [
      row.id,
      row.reference,
      row.container,
      row.hbl,
      row.vessel,
      row.origin,
      row.destination,
      row.city,
      row.originName,
    ]
      .join(' ')
      .toLocaleLowerCase(i18n.language)
      .includes(query.trim().toLocaleLowerCase(i18n.language)),
  );
  const filtered = searched.filter((row) => matchesFilters(row, filters));
  const visible = filtered
    .filter((row) => matchesTab(row, tab))
    .sort((first, second) => {
      const firstValue = String(first[sort.key as keyof SampleRow]);
      const secondValue = String(second[sort.key as keyof SampleRow]);
      return (
        firstValue.localeCompare(secondValue, i18n.language) *
        (sort.direction === 'ascending' ? 1 : -1)
      );
    });
  const draftBase = searched.filter((row) => matchesTab(row, tab));
  const draftCount = draftBase.filter((row) => matchesFilters(row, draft)).length;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const filterCount = Object.values(filters).reduce(
    (total, value) => total + (Array.isArray(value) ? value.length : value ? 1 : 0),
    0,
  );
  const changeDraft = <Key extends keyof Filters>(key: Key, value: Filters[Key]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const reset = () => {
    setFilters(blankFilters());
    setQuery('');
    setTab('allRecords');
    setPage(1);
    setState('ready');
    setSavedId('');
  };
  const apply = () => {
    setFilters(draft);
    setPage(1);
    setSavedId('');
    setOpen(false);
  };
  const route = (row: SampleRow) => (
    <RouteCell
      origin={row.origin}
      originLabel={row.originName}
      destination={row.destination}
      destinationLabel={row.city}
      progress={row.progress}
      icon={row.mode === 'air' ? <Plane /> : row.mode === 'road' ? <Truck /> : <Ship />}
    />
  );
  const columns: TableColumn<SampleRow>[] = [
    {
      key: 'id',
      label: t('reference'),
      sortable: true,
      render: (row) => (
        <>
          <strong>{row.id}</strong>
          <small>{row.reference}</small>
        </>
      ),
    },
    { key: 'route', label: t('route'), render: route },
    {
      key: 'mode',
      label: t('mode'),
      sortable: true,
      render: (row) => (
        <>
          <strong>{t(row.mode)}</strong>
          <small>
            {t(
              row.mode === 'air'
                ? 'sampleWeight'
                : row.mode === 'road'
                  ? 'samplePallets'
                  : 'sampleContainers',
            )}
          </small>
        </>
      ),
    },
    {
      key: 'milestone',
      label: t('lastMilestone'),
      render: (row) => (
        <div className="noa-milestone">
          <span
            aria-hidden="true"
            className={`noa-status-dot noa-status-dot-${statusTone(row.status)}`}
          />
          <div>
            {t(row.status)}
            <small>{formatDate(row.etd)} 09:40</small>
          </div>
        </div>
      ),
    },
    {
      key: 'eta',
      label: t('eta'),
      sortable: true,
      render: (row) => (
        <>
          <strong>{formatDate(row.eta)}</strong>
          <small>{t(row.status === 'delivered' ? 'delivered' : 'estimated')}</small>
        </>
      ),
    },
    {
      key: 'status',
      label: t('status'),
      sortable: true,
      render: (row) => <Badge tone={statusTone(row.status)}>{t(row.status)}</Badge>,
    },
  ];
  const checkboxSection = (
    key: 'mode' | 'city' | 'status' | 'originName',
    title: string,
    translate: boolean,
    expanded = false,
  ) => (
    <FilterSection
      key={key}
      title={title}
      summary={draft[key].length ? t('selectedCount', { count: draft[key].length }) : t('any')}
      defaultOpen={expanded}
    >
      {[...new Set(rows.map((row) => row[key]))].map((value) => (
        <div className="noa-filter-option" key={value}>
          <Checkbox
            label={translate ? t(value) : value}
            checked={draft[key].includes(value)}
            onCheckedChange={(checked) =>
              changeDraft(
                key,
                checked ? [...draft[key], value] : draft[key].filter((item) => item !== value),
              )
            }
          />
          <span>
            {
              draftBase.filter((row) => row[key] === value && matchesFilters(row, draft, key))
                .length
            }
          </span>
        </div>
      ))}
    </FilterSection>
  );
  const dateSection = (kind: 'eta' | 'etd') => (
    <FilterSection
      title={t(`${kind}Between`)}
      summary={draft[`${kind}From`] || draft[`${kind}To`] ? t('customRange') : t('anyTime')}
    >
      <Input
        type="date"
        label={t('dateFrom')}
        value={draft[`${kind}From`]}
        onChange={(event) => changeDraft(`${kind}From`, event.target.value)}
      />
      <Input
        type="date"
        label={t('dateTo')}
        value={draft[`${kind}To`]}
        onChange={(event) => changeDraft(`${kind}To`, event.target.value)}
        error={
          draft[`${kind}From`] && draft[`${kind}To`] && draft[`${kind}From`] > draft[`${kind}To`]
            ? t('invalidDateRange')
            : undefined
        }
      />
    </FilterSection>
  );
  return (
    <div className="noa-stack">
      <div className="noa-listing-options">
        <Select
          label={t('state')}
          value={state}
          onValueChange={setState}
          options={['ready', 'loading', 'empty', 'error'].map((value) => ({
            value,
            label: t(value),
          }))}
        />
        {savedViews.length > 0 && (
          <Select
            label={t('savedViews')}
            value={savedId || 'custom'}
            onValueChange={(value) => {
              const saved = savedViews.find((item) => item.id === value);
              setSavedId(value === 'custom' ? '' : value);
              if (saved) {
                setFilters(saved.filters);
                setQuery(saved.query);
                setTab(saved.tab);
                setView(saved.view);
                setPageSize(saved.pageSize);
                setSort(saved.sort);
                setPage(1);
              }
            }}
            options={[
              { value: 'custom', label: t('customView') },
              ...savedViews.map((saved) => ({
                value: saved.id,
                label: t('savedViewName', { number: saved.id }),
              })),
            ]}
          />
        )}
        <Badge>{t('sampleData')}</Badge>
      </div>
      {announcement && <div role="status">{announcement}</div>}
      <section className="noa-listing" aria-label={t('listingPreview')}>
        <ListingToolbar
          query={query}
          onQueryChange={(value) => {
            setQuery(value);
            setPage(1);
            setSavedId('');
          }}
          searchLabel={t('shipmentSearch')}
          filtersLabel={t('filters')}
          filterCount={filterCount}
          filterTriggerRef={filterTrigger}
          onFiltersOpen={() => {
            setDraft({ ...filters });
            setOpen(true);
          }}
          view={view}
          onViewChange={setView}
          viewLabel={t('viewMode')}
          gridLabel={t('grid')}
          cardsLabel={t('cards')}
        />
        {filterCount > 0 && (
          <div className="noa-active-filters">
            {Object.entries(filters).flatMap(([key, value]) =>
              (Array.isArray(value) ? value : value ? [value] : []).map((item) => {
                const label = ['mode', 'status'].includes(key)
                  ? t(item)
                  : key.includes('From') || key.includes('To')
                    ? `${t(key)}: ${formatDate(item)}`
                    : `${t(key)}: ${item}`;
                return (
                  <FilterChip
                    key={`${key}-${item}`}
                    label={label}
                    removeLabel={t('removeFilter', { label })}
                    onRemove={() => {
                      setFilters((current) => ({
                        ...current,
                        [key]: Array.isArray(value) ? value.filter((entry) => entry !== item) : '',
                      }));
                      setPage(1);
                      setSavedId('');
                    }}
                  />
                );
              }),
            )}
            <button
              className="noa-text-action"
              onClick={() => {
                setFilters(blankFilters());
                setPage(1);
                setSavedId('');
              }}
            >
              {t('clearAll')}
            </button>
          </div>
        )}
        <TabGroup
          value={tab}
          onValueChange={(value) => {
            setTab(value);
            setPage(1);
            setSavedId('');
          }}
        >
          <CountedTabs
            label={t('listingTabs')}
            items={tabKeys.map((value) => ({
              value,
              label: t(value),
              count: filtered.filter((row) => matchesTab(row, value)).length,
            }))}
          />
          <TabPanel key={tab} value={tab}>
            {state === 'loading' ? (
              <div role="status" aria-busy="true" className="noa-section">
                <span className="noa-visually-hidden">{t('loading')}</span>
                {Array.from({ length: pageSize }, (_, index) => (
                  <div className="noa-skeleton" key={index} />
                ))}
              </div>
            ) : state === 'error' ? (
              <StatePanel
                title={t('listingLoadFailed')}
                action={
                  <Button variant="outline" onClick={() => setState('ready')}>
                    {t('retry')}
                  </Button>
                }
              />
            ) : state === 'empty' || visible.length === 0 ? (
              <StatePanel
                title={t('listingNoResults')}
                action={
                  <Button variant="outline" onClick={reset}>
                    {t('clearFilters')}
                  </Button>
                }
              />
            ) : (
              <>
                {view === 'grid' ? (
                  <DataTable
                    caption={t('listingPreview')}
                    rows={pageRows}
                    columns={columns}
                    rowKey={(row) => row.id}
                    sort={sort}
                    onSort={(key) => {
                      setSort({
                        key,
                        direction:
                          sort.key === key && sort.direction === 'ascending'
                            ? 'descending'
                            : 'ascending',
                      });
                      setPage(1);
                    }}
                  />
                ) : (
                  <div className="noa-listing-cards">
                    {pageRows.map((row) => (
                      <article className="noa-listing-card" key={row.id} aria-label={row.id}>
                        <header>
                          <div>
                            <strong>{row.id}</strong>
                            <small>{row.reference}</small>
                          </div>
                          <Badge tone={statusTone(row.status)}>{t(row.status)}</Badge>
                        </header>
                        {route(row)}
                        <div className="noa-row">
                          <span>{t(row.mode)}</span>
                          <span>
                            {t('eta')} {formatDate(row.eta)}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                <Pagination
                  label={t('page', { page: currentPage, total: pageCount })}
                  rangeLabel={t('showingRange', {
                    from: (currentPage - 1) * pageSize + 1,
                    to: Math.min(currentPage * pageSize, visible.length),
                    total: visible.length,
                  })}
                  page={currentPage}
                  pageCount={pageCount}
                  onPageChange={setPage}
                  previousLabel={t('previous')}
                  nextLabel={t('next')}
                  lastLabel={t('lastPage')}
                  pageSize={pageSize}
                  pageSizeLabel={t('rowsPerPage')}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                    setSavedId('');
                  }}
                />
              </>
            )}
          </TabPanel>
        </TabGroup>
      </section>
      <FilterDrawer
        open={open}
        onOpenChange={setOpen}
        returnFocus={() => filterTrigger.current?.focus()}
        title={t('filters')}
        description={t('matchingCount', { count: draftCount, total: rows.length })}
        closeLabel={t('close')}
        footer={
          <>
            <button className="noa-text-action" onClick={() => setDraft(blankFilters())}>
              {t('clearAll')}
            </button>
            <button
              className="noa-tool-button"
              disabled={invalidDates(draft)}
              onClick={() => {
                const id = String(savedViews.length + 1);
                setSavedViews([
                  ...savedViews,
                  { id, filters: draft, query, tab, view, pageSize, sort },
                ]);
                apply();
                setSavedId(id);
                setAnnouncement(t('viewSavedSession'));
              }}
            >
              {t('saveAsView')}
            </button>
            <Button disabled={invalidDates(draft)} onClick={apply}>
              {t('showResults', { count: draftCount })}
            </Button>
          </>
        }
      >
        {checkboxSection('mode', t('mode'), true, true)}
        {checkboxSection('city', t('destination'), false, true)}
        {dateSection('eta')}
        {checkboxSection('status', t('status'), true)}
        {checkboxSection('originName', t('origin'), false)}
        <FilterSection title={t('yourReference')} summary={draft.reference || t('any')}>
          <Input
            label={t('yourReference')}
            value={draft.reference}
            onChange={(event) => changeDraft('reference', event.target.value)}
          />
        </FilterSection>
        {dateSection('etd')}
      </FilterDrawer>
    </div>
  );
}
