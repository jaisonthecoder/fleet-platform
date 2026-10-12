import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Badge, Code, InfoRibbon, SectionHeading, type DataGridFilterValues } from '../../../design-system';
import { Breadcrumb } from '../../../shared/components/Breadcrumb';
import { ListingGrid } from '../../../shared/components/ListingGrid';
import { useOrganisations, type OrganisationRow } from '../api/organisations';
import { errorKey } from '../../../lib/errors';
import admin from './AdminPage.module.css';

/**
 * Organisations CargoWise knows about that no customer holds.
 *
 * This is the onboarding worklist: each row is a company Noatum trades with that
 * cannot see anything in the portal. Doc 13 section 6b wants it ranked by actual
 * shipment and invoice traffic — that ordering arrives with the shipment slices,
 * because there is no traffic to rank by yet. Until then it is a plain list, which
 * is still the difference between working from a list and working from memory.
 *
 * The three query values below are what makes this screen this screen: it is a
 * fixed view over the organisations endpoint. They are not filters and must not
 * become ones the operator can change — an unassigned list that can show linked
 * organisations is a different screen.
 */
export function UnassignedPage() {
  const { t } = useTranslation('staff');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<DataGridFilterValues>({});
  const [view, setView] = useState<'grid' | 'cards'>('grid');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const organisations = useOrganisations({
    search: search.trim(),
    status: 'active',
    provenance: 'confirmed',
    linked: 'unlinked',
    countryCode: (filters.countryCode as string | undefined)?.trim().toUpperCase() || undefined,
    category: (filters.category as string | undefined)?.trim().toUpperCase() || undefined,
    page,
    pageSize,
  });

  /* Any change to what is being asked for returns to the first page; staying on
     page 7 of a narrower result set shows an empty table and looks like a fault. */
  const restart = <Value,>(apply: (value: Value) => void) => (value: Value) => {
    apply(value);
    setPage(1);
  };

  const columns = [
    {
      key: 'code',
      label: t('orgCode'),
      render: (row: OrganisationRow) => (
        <Link to={`/portal/organisations/${row.id}`}>
          <Code>{row.sourceCode}</Code>
        </Link>
      ),
    },
    { key: 'name', label: t('orgName'), render: (row: OrganisationRow) => row.name },
    {
      key: 'country',
      label: t('customerCountry'),
      render: (row: OrganisationRow) => row.countryCode ?? '—',
    },
    { key: 'city', label: t('orgCity'), render: (row: OrganisationRow) => row.city ?? '—' },
    {
      key: 'category',
      label: t('orgCategory'),
      render: (row: OrganisationRow) =>
        row.category ? <Badge tone="neutral">{row.category}</Badge> : '—',
    },
    {
      key: 'addresses',
      label: t('orgAddresses'),
      render: (row: OrganisationRow) => row.addresses,
    },
    {
      key: 'action',
      label: t('actions'),
      render: (row: OrganisationRow) => (
        <Link to={`/portal/organisations/${row.id}`}>{t('unassignedReview')}</Link>
      ),
    },
  ];

  return (
    <section className={admin.page}>
      <Breadcrumb items={[{ label: t('navGroup_administration') }, { label: t('nav_unassigned') }]} />
      <InfoRibbon
        heading={<SectionHeading as="h1" size="lg" title={t('nav_unassigned')} />}
        label={t('aboutThisPage')}
        closeLabel={t('hideGuidance')}
      >
        <p>{t('page_unassigned')}</p>
        <p>{t('unassignedIntro')}</p>
      </InfoRibbon>

      <ListingGrid
        caption={t('nav_unassigned')}
        columns={columns}
        rows={organisations.data?.items ?? []}
        rowKey={(row: OrganisationRow) => row.id}
        total={organisations.data?.total ?? 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={restart(setPageSize)}
        search={search}
        onSearchChange={restart(setSearch)}
        /*
         * Country and category are free-text codes rather than pick-lists: the
         * endpoint takes one value each and returns no facet data, so a dropdown
         * here would be a list somebody typed out by hand and left to rot.
         */
        filters={[
          { kind: 'text', key: 'countryCode', title: t('customerCountry') },
          { kind: 'text', key: 'category', title: t('orgCategory') },
        ]}
        filterValues={filters}
        onFilterChange={restart(setFilters)}
        view={view}
        onViewChange={setView}
        renderCard={(row: OrganisationRow) => (
          <>
            <header>
              <div>
                <strong>{row.name}</strong>
                <Code tone="muted">{row.sourceCode}</Code>
              </div>
              {row.category ? <Badge tone="neutral">{row.category}</Badge> : null}
            </header>
            <div className="noa-row">
              <span>{[row.city, row.countryCode].filter(Boolean).join(' · ') || '—'}</span>
              <Link to={`/portal/organisations/${row.id}`}>{t('unassignedReview')}</Link>
            </div>
          </>
        )}
        isPending={organisations.isPending}
        isFetching={organisations.isFetching}
        error={organisations.error}
        onRetry={() => {
          void organisations.refetch();
        }}
        searchLabel={t('orgSearchHint')}
        emptyLabel={t('unassignedEmpty')}
        /* A refusal and an outage are different problems for the operator, and
           the screen said so before the grid existed. It still does. */
        errorLabel={organisations.error ? t(errorKey(organisations.error)) : undefined}
      />
    </section>
  );
}
