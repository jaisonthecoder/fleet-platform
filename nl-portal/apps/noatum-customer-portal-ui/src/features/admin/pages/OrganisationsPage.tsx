import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Building2, Database, Link2, MapPin, RefreshCw } from 'lucide-react';

import {
  Badge, Button, Code, DateValue, Dialog, DialogContent, DialogTitle, DrawerBody, DrawerCard,
  DrawerFooter, DrawerHeader, InfoRibbon, Input, SectionHeading, StatePanel, Tabs, formatDate,
  type DataGridFilterValues,
} from '../../../design-system';
import { Breadcrumb } from '../../../shared/components/Breadcrumb';
import { ListingGrid } from '../../../shared/components/ListingGrid';
import { AdminListing } from '../components/AdminListing';
import { DetailHero } from '../components/DetailHero';
import { errorKey } from '../../../lib/errors';
import { CustomerWriteError } from '../api/customers';
import {
  useImportRuns,
  useOrganisation,
  useOrganisations,
  useRunImport,
  type ImportRun,
  type OrganisationAddress,
  type OrganisationChange,
  type OrganisationRegistration,
  type OrganisationRow,
} from '../api/organisations';
import admin from './AdminPage.module.css';
import customers from './CustomersPage.module.css';
import styles from './OrganisationsPage.module.css';

const PAGE_SIZES = [25, 50, 100];

/** `undefined` is how the grid says "not filtered"; the endpoint spells it "all". */
const asFilter = <Value extends string>(value: string | string[] | undefined, fallback: Value) =>
  (typeof value === 'string' && value ? (value as Value) : fallback);

export function OrganisationsPage() {
  const { t } = useTranslation('staff');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<DataGridFilterValues>({});
  const [view, setView] = useState<'grid' | 'cards'>('grid');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const organisations = useOrganisations({
    search: search.trim(),
    status: asFilter(filters.status, 'all' as const),
    provenance: asFilter(filters.provenance, 'all' as const),
    linked: asFilter(filters.linked, 'all' as const),
    countryCode: (filters.countryCode as string | undefined)?.trim().toUpperCase() || undefined,
    category: (filters.category as string | undefined)?.trim().toUpperCase() || undefined,
    page,
    pageSize,
  });

  const columns = useMemo(
    () => [
      {
        key: 'code', label: t('orgCode'),
        render: (row: OrganisationRow) => (
          <Link to={`/portal/organisations/${row.id}`}><Code>{row.sourceCode}</Code></Link>
        ),
      },
      { key: 'name', label: t('orgName'), render: (row: OrganisationRow) => row.name },
      {
        key: 'where', label: t('orgLocation'),
        render: (row: OrganisationRow) => [row.city, row.countryCode].filter(Boolean).join(' · ') || '—',
      },
      { key: 'category', label: t('orgCategory'), render: (row: OrganisationRow) => row.category ?? '—' },
      {
        key: 'roles', label: t('orgRoles'),
        render: (row: OrganisationRow) =>
          row.sourceRoles.length === 0 ? '—' : (
            <span className={styles.roles}>
              {row.sourceRoles.map((role) => <span key={role} className={styles.role}>{role.replace(/^Is/, '')}</span>)}
            </span>
          ),
      },
      {
        key: 'provenance', label: t('orgProvenance'),
        render: (row: OrganisationRow) =>
          row.isSourceConfirmed
            ? <Badge tone="neutral">{t(`orgSourceKind_${row.sourceKind}`)}</Badge>
            : <Badge tone="warning">{t('orgProvisional')}</Badge>,
      },
      {
        key: 'status', label: t('orgSourceState'),
        render: (row: OrganisationRow) =>
          row.isActive ? <Badge tone="success">{t('orgActive')}</Badge> : <Badge tone="neutral">{t('orgInactive')}</Badge>,
      },
      { key: 'addresses', label: t('orgAddresses'), render: (row: OrganisationRow) => row.addresses },
      {
        key: 'customer', label: t('orgLinkedCustomer'),
        render: (row: OrganisationRow) =>
          row.linkedCustomerId ? (
            <Link to={`/portal/customers/${row.linkedCustomerId}`}>{row.linkedCustomerName}</Link>
          ) : (
            <span className={styles.unlinked}>{t('orgUnlinked')}</span>
          ),
      },
    ],
    [t],
  );

  /* Anything that changes what is being asked for returns to the first page;
     staying on page 7 of a narrower result set shows an empty table. */
  const restart = <Value,>(apply: (value: Value) => void) => (value: Value) => {
    apply(value);
    setPage(1);
  };

  return (
    <section className={admin.page}>
      <Breadcrumb items={[{ label: t('navGroup_administration') }, { label: t('nav_organisations') }]} />
      <InfoRibbon
        heading={<SectionHeading as="h1" size="lg" title={t('nav_organisations')} />}
        label={t('aboutThisPage')}
        closeLabel={t('hideGuidance')}
      >
        <p>{t('page_organisations')}</p>
        <p>{t('organisationsIntro')}</p>
      </InfoRibbon>

      {/*
        * Three rows of filter buttons became three sections of one drawer.
        *
        * The buttons signalled the selected value only by fill colour, took a
        * whole toolbar row each, and pushed the search field onto its own line
        * below 1100px. The values and what they send are unchanged - the state
        * moved, not the query.
        */}
      <ListingGrid
        caption={t('nav_organisations')}
        columns={columns}
        rows={organisations.data?.items ?? []}
        rowKey={(row: OrganisationRow) => row.id}
        total={organisations.data?.total ?? 0}
        page={page}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZES}
        onPageChange={setPage}
        onPageSizeChange={restart(setPageSize)}
        search={search}
        onSearchChange={restart(setSearch)}
        filters={[
          {
            kind: 'choice', key: 'status', title: t('orgSourceState'),
            options: [
              { value: 'active', label: t('orgActive') },
              { value: 'inactive', label: t('orgInactive') },
            ],
          },
          {
            kind: 'choice', key: 'provenance', title: t('orgProvenance'),
            options: [
              { value: 'confirmed', label: t('orgConfirmed') },
              { value: 'provisional', label: t('orgProvisional') },
            ],
          },
          {
            kind: 'choice', key: 'linked', title: t('orgLinkedCustomer'),
            options: [
              { value: 'linked', label: t('orgLinked') },
              { value: 'unlinked', label: t('orgUnlinked') },
            ],
          },
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
                {/* The name is the target, so the card needs no separate action. */}
                <Link to={`/portal/organisations/${row.id}`}><strong>{row.name}</strong></Link>
                <Code tone="muted">{row.sourceCode}</Code>
              </div>
              {row.isActive
                ? <Badge tone="success">{t('orgActive')}</Badge>
                : <Badge tone="neutral">{t('orgInactive')}</Badge>}
            </header>
            <div className="noa-row">
              <span>{[row.city, row.countryCode].filter(Boolean).join(' · ') || '—'}</span>
              {row.linkedCustomerName ? (
                <Link to={`/portal/customers/${row.linkedCustomerId}`}>{row.linkedCustomerName}</Link>
              ) : (
                <span className={styles.unlinked}>{t('orgUnlinked')}</span>
              )}
            </div>
          </>
        )}
        isPending={organisations.isPending}
        isFetching={organisations.isFetching}
        error={organisations.error}
        onRetry={() => { void organisations.refetch(); }}
        searchLabel={t('orgSearchHint')}
        emptyLabel={t('orgNoResults')}
        errorLabel={organisations.error ? t(errorKey(organisations.error)) : undefined}
      />

      <ImportPanel />
    </section>
  );
}

/**
 * The evidence that the mirror is current. Without it "read-only copy of CargoWise"
 * is a claim rather than something an operator can check.
 */
function ImportPanel() {
  const { t } = useTranslation('staff');
  const [open, setOpen] = useState(false);
  const [authoritative, setAuthoritative] = useState(false);
  const [reason, setReason] = useState('');
  const runs = useImportRuns(true);
  const runImport = useRunImport();

  const close = () => { setOpen(false); setReason(''); setAuthoritative(false); };
  const latest = runs.data?.items?.[0];

  return (
    <div className={admin.panel}>
      <div className={customers.sectionHeader}>
        <h2 className={customers.sectionTitle}>{t('orgImportTitle')}</h2>
        <InfoRibbon label={t('aboutThisSection')} closeLabel={t('hideGuidance')} className={customers.grow}>
          {t('orgImportHelp')}
        </InfoRibbon>
        <Button size="sm" onClick={() => setOpen(true)}>
          <RefreshCw aria-hidden size={14} />{t('orgImportRun')}
        </Button>
      </div>

      {runs.error ? (
        <StatePanel title={t(errorKey(runs.error))} />
      ) : (
        <AdminListing
          caption={t('orgImportTitle')}
          columns={[
            {
              key: 'started', label: t('orgImportStarted'),
              render: (row: ImportRun) => (
                <span className={styles.runWhen}>
                  <strong><DateValue value={row.startedAt} withTime /></strong>
                  <small>{row.startedByName ?? t('orgImportScheduled')}</small>
                </span>
              ),
            },
            {
              key: 'outcome', label: t('orgImportOutcome'),
              render: (row: ImportRun) => {
                if (row.outcome === 'failed') return <Badge tone="warning">{t('orgImportFailed')}</Badge>;
                if (row.outcome === 'aborted') return <Badge tone="warning">{t('orgImportRefused')}</Badge>;
                if (row.outcome === 'running') return <Badge tone="info">{t('orgImportRunning')}</Badge>;
                if (row.rowsRejected > 0 || hasErrors(row.errors)) return <Badge tone="warning">{t('orgImportPartial')}</Badge>;
                return <Badge tone="success">{t('orgImportSucceeded')}</Badge>;
              },
            },
            { key: 'read', label: t('orgImportRead'), render: (row: ImportRun) => row.rowsRead },
            { key: 'created', label: t('orgImportCreated'), render: (row: ImportRun) => row.rowsCreated },
            { key: 'updated', label: t('orgImportUpdated'), render: (row: ImportRun) => row.rowsUpdated },
            { key: 'unchanged', label: t('orgImportUnchanged'), render: (row: ImportRun) => row.rowsUnchanged },
            {
              key: 'deactivated', label: t('orgImportDeactivated'),
              render: (row: ImportRun) =>
                row.outcome === 'aborted'
                  ? <span className={customers.warning}>{t('orgImportBrake')}</span>
                  : row.rowsDeactivated,
            },
            {
              key: 'scope', label: t('orgImportScope'),
              render: (row: ImportRun) => (row.isAuthoritative ? t('orgImportAuthoritative') : t('orgImportAdditive')),
            },
          ]}
          rows={runs.data?.items ?? []}
          rowKey={(row: ImportRun) => row.id}
          total={runs.data?.total ?? 0}
          page={1}
          pageSize={Math.max(1, runs.data?.items?.length ?? 1)}
          onPageChange={() => undefined}
          isPending={runs.isPending}
          emptyLabel={t('orgImportNever')}
        />
      )}

      {latest && latest.outcome === 'aborted' ? (
        <p className={customers.warning} role="status">{t('orgImportBrakeExplained')}</p>
      ) : null}

      <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
        <DialogContent side="right" closeLabel={t('close')}>
          <DrawerHeader>
            <DialogTitle>{t('orgImportRun')}</DialogTitle>
            <p className={customers.drawerNote}>{t('orgImportDrawerHelp')}</p>
          </DrawerHeader>
          <DrawerBody>
            <DrawerCard title={t('orgImportScope')}>
              <fieldset className={customers.fieldset}>
                <legend className={customers.srOnly}>{t('orgImportScope')}</legend>
                <label className={customers.choice}>
                  <input type="radio" name="scope" checked={!authoritative} onChange={() => setAuthoritative(false)} />
                  <span>
                    <span className={customers.choiceName}>{t('orgImportAdditive')}</span>
                    <span className={customers.choiceHint}>{t('orgImportAdditiveHint')}</span>
                  </span>
                </label>
                <label className={customers.choice}>
                  <input type="radio" name="scope" checked={authoritative} onChange={() => setAuthoritative(true)} />
                  <span>
                    <span className={customers.choiceName}>{t('orgImportAuthoritative')}</span>
                    <span className={customers.choiceHint}>{t('orgImportAuthoritativeHint')}</span>
                  </span>
                </label>
              </fieldset>
            </DrawerCard>

            <DrawerCard>
              <Input label={t('reason')} value={reason} onChange={(event) => setReason(event.target.value)} />
              {runImport.error instanceof CustomerWriteError ? (
                <p className={customers.formError} role="alert">{runImport.error.message || t('unavailable')}</p>
              ) : null}
            </DrawerCard>
          </DrawerBody>
          <DrawerFooter>
            <Button variant="outline" onClick={close}>{t('cancel')}</Button>
            <Button
              loading={runImport.isPending}
              disabled={reason.trim().length === 0 || runImport.isPending}
              onClick={() => runImport.mutate({ authoritative, reason: reason.trim() }, { onSuccess: close })}
            >
              {t('orgImportRun')}
            </Button>
          </DrawerFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Any recorded error means the run was not clean, whatever its status says. */
function hasErrors(errors: unknown): boolean {
  return Array.isArray(errors) && errors.length > 0;
}

export function OrganisationDetailPage() {
  const { t } = useTranslation('staff');
  const { id = '' } = useParams();
  const organisation = useOrganisation(id);
  const [tab, setTab] = useState('overview');
  const [addressPage, setAddressPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  if (organisation.error) {
    return (
      <section className={admin.page}>
        <div className={admin.panel} role="alert"><StatePanel title={t(errorKey(organisation.error))} /></div>
      </section>
    );
  }
  if (!organisation.data) {
    return <section className={admin.page}><div className={admin.panel}><StatePanel title={t('loading')} /></div></section>;
  }

  const detail = organisation.data;
  const pageSize = 10;
  const addresses = detail.addressList.slice((addressPage - 1) * pageSize, addressPage * pageSize);
  const history = detail.history.slice((historyPage - 1) * pageSize, historyPage * pageSize);

  return (
    <section className={admin.page}>
      <DetailHero
        breadcrumb={[
          { label: t('navGroup_administration') },
          { label: t('nav_organisations'), to: '/portal/organisations' },
          { label: detail.name },
        ]}
        eyebrow={t('orgHeroEyebrow')}
        title={detail.name}
        status={
          detail.isActive
            ? <Badge tone="success">{t('orgActive')}</Badge>
            : <Badge tone="neutral">{t('orgInactive')}</Badge>
        }
        subline={`${detail.sourceCode} · ${detail.sourceInstance}`}
        chips={[
          detail.category,
          ...detail.sourceRoles,
        ]}
        columns={[
          {
            icon: <MapPin />,
            label: t('orgLocation'),
            value: [detail.city, detail.countryCode].filter(Boolean).join(', ') || '—',
            lines: [[detail.state, detail.postcode].filter(Boolean).join(' ') || null],
          },
          {
            icon: <Building2 />,
            label: t('orgTabAddresses'),
            value: t('orgAddressCount', { count: detail.addressList.length }),
          },
          {
            icon: <Link2 />,
            label: t('orgTabCustomer'),
            value: detail.linkedCustomerName ?? t('orgNotLinkedYet'),
            lines: [detail.linkedAt ? formatDate(detail.linkedAt) : null, detail.linkJustification],
          },
          {
            icon: <Database />,
            label: t('orgSourceState'),
            value: detail.isSourceConfirmed ? t(`orgSourceKind_${detail.sourceKind}`) : t('orgProvisional'),
            lines: [
              detail.lastSeenAt ? t('orgLastSeenAt', { date: formatDate(detail.lastSeenAt) }) : null,
            ],
          },
        ]}
        footnote={detail.isSourceConfirmed ? undefined : t('orgProvisionalNotice')}
      />

      <div className={admin.panel}>
        <Tabs
          ariaLabel={t('nav_organisations')}
          value={tab}
          onChange={setTab}
          items={[
            {
              id: 'overview',
              label: t('orgTabOverview'),
              content: (
                <dl className={styles.facts}>
                  <Fact label={t('orgLegalName')} value={detail.legalName ?? '—'} />
                  <Fact label={t('orgRoles')} value={detail.sourceRoles.join(', ') || '—'} hint={t('orgRolesHint')} />
                  <Fact label={t('orgSourceBranch')} value={detail.sourceBranchCode ?? '—'} hint={t('orgSourceBranchHint')} />
                  <Fact label={t('orgControllingCustomer')} value={detail.sourceControllingCustomerCode ?? '—'} hint={t('orgControllingCustomerHint')} />
                  <Fact label={t('orgFirstSeen')} value={detail.firstSeenAt ? formatDate(detail.firstSeenAt) : '—'} />
                  <Fact label={t('orgLastSeen')} value={detail.lastSeenAt ? formatDate(detail.lastSeenAt) : '—'} hint={t('orgLastSeenHint')} />
                </dl>
              ),
            },
            {
              id: 'addresses',
              label: t('orgTabAddresses'),
              badge: detail.addressList.length || undefined,
              content: (
                <>
                  <p className={styles.tabNote}>{t('orgAddressesNote')}</p>
                  <AdminListing
                    caption={t('orgTabAddresses')}
                    columns={[
                      { key: 'code', label: t('orgAddressCode'), render: (row: OrganisationAddress) => <Code>{row.sourceAddressCode}</Code> },
                      {
                        key: 'purposes', label: t('orgAddressPurposes'),
                        render: (row: OrganisationAddress) => (
                          <span className={styles.roles}>
                            {row.purposes.map((purpose) => (
                              <span key={purpose.code} className={styles.role} title={purpose.code}>
                                {purpose.label ?? purpose.code}
                              </span>
                            ))}
                            {row.isPrimary ? <span className={styles.primary}>{t('orgAddressMain')}</span> : null}
                          </span>
                        ),
                      },
                      { key: 'name', label: t('orgAddressTradingName'), render: (row: OrganisationAddress) => row.companyNameOverride ?? '—' },
                      {
                        key: 'address', label: t('orgAddress'),
                        render: (row: OrganisationAddress) => [row.addressLine1, row.city, row.postcode, row.countryCode].filter(Boolean).join(', ') || '—',
                      },
                      { key: 'port', label: t('orgAddressPort'), render: (row: OrganisationAddress) => row.relatedPortCode ?? '—' },
                      {
                        key: 'status', label: t('orgSourceState'),
                        render: (row: OrganisationAddress) => (row.isActive ? t('orgActive') : t('orgInactive')),
                      },
                    ]}
                    rows={addresses}
                    rowKey={(row: OrganisationAddress) => row.id}
                    total={detail.addressList.length}
                    page={addressPage}
                    pageSize={pageSize}
                    onPageChange={setAddressPage}
                    emptyLabel={t('orgNoAddresses')}
                  />
                </>
              ),
            },
            {
              id: 'identifiers',
              label: t('orgTabIdentifiers'),
              badge: detail.registrations.length || undefined,
              content: (
                <AdminListing
                  caption={t('orgTabIdentifiers')}
                  columns={[
                    { key: 'scheme', label: t('orgIdScheme'), render: (row: OrganisationRegistration) => row.scheme },
                    { key: 'description', label: t('orgIdDescription'), render: (row: OrganisationRegistration) => row.schemeDescription ?? '—' },
                    { key: 'value', label: t('orgIdValue'), render: (row: OrganisationRegistration) => <Code>{row.value}</Code> },
                    { key: 'jurisdiction', label: t('orgIdJurisdiction'), render: (row: OrganisationRegistration) => row.jurisdiction ?? '—' },
                    { key: 'default', label: t('orgIdDefault'), render: (row: OrganisationRegistration) => (row.isCountryDefault ? t('yes') : '—') },
                  ]}
                  rows={detail.registrations}
                  rowKey={(row: OrganisationRegistration) => row.id}
                  total={detail.registrations.length}
                  page={1}
                  pageSize={Math.max(1, detail.registrations.length)}
                  onPageChange={() => undefined}
                  emptyLabel={t('orgNoIdentifiers')}
                />
              ),
            },
            {
              id: 'customer',
              label: t('orgTabCustomer'),
              content: detail.linkedCustomerId ? (
                <div className={styles.tabBody}>
                  <dl className={styles.facts}>
                    <Fact label={t('orgLinkedCustomer')} value={<Link to={`/portal/customers/${detail.linkedCustomerId}`}>{detail.linkedCustomerName}</Link>} />
                    <Fact label={t('orgLinkedAt')} value={detail.linkedAt ? formatDate(detail.linkedAt) : '—'} />
                    <Fact
                      label={t('linkServicing')}
                      value={detail.linkServicingBranchCode ?? t('customerNoServicing')}
                      hint={detail.linkServicingInherited ? t('orgLinkServicingInherited') : undefined}
                    />
                    <Fact
                      label={t('orgLinkCovers')}
                      value={t('orgLinkCoversValue', { count: detail.addressList.length })}
                      hint={t('orgLinkCoversHint')}
                    />
                    <Fact label={t('orgReason')} value={detail.linkJustification ?? '—'} />
                  </dl>
                </div>
              ) : (
                <StatePanel title={t('orgNotLinkedYet')} />
              ),
            },
            {
              id: 'history',
              label: t('orgTabHistory'),
              content: (
                <AdminListing
                  caption={t('orgTabHistory')}
                  columns={[
                    { key: 'when', label: t('orgHistoryWhen'), render: (row: OrganisationChange) => <DateValue value={row.createdAt} /> },
                    { key: 'what', label: t('orgHistoryWhat'), render: (row: OrganisationChange) => t(`orgChange_${row.changeType}`, { defaultValue: row.changeType }) },
                    { key: 'via', label: t('orgHistoryVia'), render: (row: OrganisationChange) => (row.runKind ? t(`orgSourceKind_${row.runKind}`) : '—') },
                    { key: 'file', label: t('orgHistoryFile'), render: (row: OrganisationChange) => row.runFileName ?? '—' },
                  ]}
                  rows={history}
                  rowKey={(row: OrganisationChange) => row.id}
                  total={detail.history.length}
                  page={historyPage}
                  pageSize={pageSize}
                  onPageChange={setHistoryPage}
                  emptyLabel={t('orgNoHistory')}
                />
              ),
            },
          ]}
        />
      </div>
    </section>
  );
}

function Fact({ label, value, hint, mono }: { label: string; value: React.ReactNode; hint?: string; mono?: boolean }) {
  return (
    <div className={styles.fact}>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={mono ? styles.factValueMono : styles.factValue}>{value}</dd>
      {hint ? <dd className={styles.factHint}>{hint}</dd> : null}
    </div>
  );
}
