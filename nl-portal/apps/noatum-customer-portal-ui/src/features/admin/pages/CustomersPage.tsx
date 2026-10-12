import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { AlertTriangle, Building2, CalendarClock, ChevronRight, KeyRound, Link2, Mail, Network, Plus, Trash2, UserPlus } from 'lucide-react';
import type { components } from '../../../api/generated/schema';

import {
  Badge, Button, Code, DateValue, Dialog, DialogContent, DialogDescription, DialogTitle, DrawerBody,
  DrawerCard, DrawerFooter, DrawerHeader, DrawerWide, DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, InfoRibbon, Input, Pagination,
  SectionHeading, Select, StatePanel, Tabs, type DataGridFilterValues,
} from '../../../design-system';
import { Breadcrumb } from '../../../shared/components/Breadcrumb';
import { ListingGrid } from '../../../shared/components/ListingGrid';
import { errorKey } from '../../../lib/errors';
import { AdminListing } from '../components/AdminListing';
import { useBranches } from '../api/operating';
import { DetailHero } from '../components/DetailHero';
import { StepRibbon } from '../components/StepRibbon';
import { SummaryGrid } from '../components/SummaryGrid';
import {
  CustomerWriteError,
  useAccountAction,
  useAttachOrganisation,
  useCreateCustomer,
  useCustomer,
  useCustomerInvitations,
  useCustomerLifecycle,
  useSetLinkServicing,
  useCustomers,
  useCustomerUsers,
  useDetachOrganisation,
  useDirectory,
  useInvitationAction,
  useInviteAdministrator,
  useUpdateUserAccess,
  type AccountAction,
  type AccountActionResult,
  type CustomerFilters,
  type CustomerLink,
  type CustomerSummary,
  type CustomerUser,
  type CustomerUserSecurity,
  type DirectoryOrganisation,
  type Invitation,
} from '../api/customers';
import admin from './AdminPage.module.css';
import styles from './CustomersPage.module.css';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral' | 'info'> = {
  active: 'success', suspended: 'warning', draft: 'neutral', onboarding: 'info', closed: 'neutral',
};

const formatDate = (value: string) => new Date(value).toLocaleDateString('en-GB').replaceAll('/', '.');

/** Radix reserves the empty string, so "follow the customer default" needs a name. */
const INHERIT_BRANCH = 'inherit';

/** The office catalogue, for the pickers. Read-only, so the whole list is fine. */
function useServicingOffices(enabled: boolean) {
  return useBranches({ search: '', status: 'active', mapped: 'all', page: 1, pageSize: 100 }, enabled);
}

/** "a, b and c" — a comma before the last item reads as a missing word. */
function formatList(items: string[], conjunction: string): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`;
}

export function CustomersPage() {
  const { t, i18n } = useTranslation('staff');
  const actor = useOutletContext<components['schemas']['CurrentUserDto']>();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<DataGridFilterValues>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [creating, setCreating] = useState(false);

  const status = (typeof filters.status === 'string' && filters.status
    ? filters.status
    : 'all') as CustomerFilters['status'];

  const customers = useCustomers({ search: search.trim(), status, page, pageSize });
  const canCreate = actor.permissions.includes('admin.customers.manage');

  /* Anything that changes what is being asked for returns to the first page. */
  const restart = <Value,>(apply: (value: Value) => void) => (value: Value) => {
    apply(value);
    setPage(1);
  };

  if (customers.error) {
    return (
      <section className={admin.page}>
        <SectionHeading as="h1" size="lg" title={t('nav_customers')} description={t('page_customers')} />
        <div className={admin.panel} role="alert"><StatePanel title={t(errorKey(customers.error))} /></div>
      </section>
    );
  }

  const rows = [...(customers.data?.items ?? [])].sort((left, right) =>
    left.name.localeCompare(right.name, i18n.language, { sensitivity: 'base' }),
  );

  return (
    <section className={admin.page}>
      <Breadcrumb items={[{ label: t('navGroup_administration') }, { label: t('nav_customers') }]} />
      <InfoRibbon
        heading={<SectionHeading as="h1" size="lg" title={t('nav_customers')} />}
        label={t('aboutThisPage')}
        closeLabel={t('hideGuidance')}
      >
        <p>{t('page_customers')}</p>
        <p>{t('customersIntro')}</p>
      </InfoRibbon>

      {/*
        * Six status buttons became one filter section.
        *
        * They signalled the selected value by fill colour alone, with no
        * aria-pressed, and together with the search field and the create action
        * they wrapped onto three lines on a laptop. Same values, same query.
        */}
      <div className={styles.customerDirectory}>
        <ListingGrid
          caption={t('nav_customers')}
          columns={[
            {
              key: 'name', label: t('customerName'),
              render: (row: CustomerSummary) => (
                <Link to={`/portal/customers/${row.id}`} className={styles.nameLink}>
                  <span className={styles.name}>{row.name}</span>
                  <Code tone="muted">{row.slug}</Code>
                </Link>
              ),
            },
            { key: 'country', label: t('customerCountry'), render: (row: CustomerSummary) => row.countryCode ?? '—' },
            {
              key: 'status', label: t('customerStatusColumn'),
              render: (row: CustomerSummary) => (
                <span className={styles.statusCell}>
                  <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>{t(`customerStatus_${row.status}`)}</Badge>
                  {row.blocked ? (
                    <span className={styles.blocked}><AlertTriangle aria-hidden size={13} />{t('customerBlocked')}</span>
                  ) : null}
                </span>
              ),
            },
            { key: 'orgs', label: t('customerOrganisations'), render: (row: CustomerSummary) => row.linkedOrganisations },
            { key: 'users', label: t('customerUsers'), render: (row: CustomerSummary) => row.users },
            { key: 'parent', label: t('customerParent'), render: (row: CustomerSummary) => row.parentName ?? '—' },
          ]}
        rows={rows}
        rowKey={(row: CustomerSummary) => row.id}
        total={customers.data?.total ?? 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={restart(setPageSize)}
        search={search}
        onSearchChange={restart(setSearch)}
        filters={[
          {
            kind: 'choice', key: 'status', title: t('customerStatusFilter'),
            options: (['draft', 'onboarding', 'active', 'suspended', 'closed'] as const).map(
              (value) => ({ value, label: t(`customerStatus_${value}`) }),
            ),
          },
        ]}
        filterValues={filters}
        onFilterChange={restart(setFilters)}
        view="cards"
        showViewSwitcher={false}
        renderCard={(row: CustomerSummary) => (
          <div className={styles.customerCard}>
            <header className={styles.customerCardHeader}>
              <div className={styles.customerIdentity}>
                <span className={styles.customerIcon} aria-hidden="true"><Building2 /></span>
                <div>
                  <Link to={`/portal/customers/${row.id}`} className={styles.customerName}>{row.name}</Link>
                  <Code tone="muted">{row.slug}</Code>
                </div>
              </div>
              <span className={styles.customerCardStatus}>
                <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>{t(`customerStatus_${row.status}`)}</Badge>
                {row.blocked ? <span className={styles.blocked}><AlertTriangle aria-hidden />{t('customerBlocked')}</span> : null}
              </span>
            </header>
            <dl className={styles.customerFacts}>
              <div><dt>{t('customerCountry')}</dt><dd>{row.countryCode ?? '—'}</dd></div>
              <div><dt>{t('customerOrganisations')}</dt><dd>{t('customerOrgCount', { count: row.linkedOrganisations })}</dd></div>
              <div><dt>{t('customerUsers')}</dt><dd>{t('customerUserCount', { count: row.users })}</dd></div>
              <div><dt>{t('customerParent')}</dt><dd>{row.parentName ?? '—'}</dd></div>
            </dl>
            <Link to={`/portal/customers/${row.id}`} className={styles.customerOpen} aria-label={row.name}>
              <ChevronRight aria-hidden="true" />
            </Link>
          </div>
        )}
        isPending={customers.isPending}
        isFetching={customers.isFetching}
        actions={canCreate ? (
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden size={14} />{t('customerCreate')}
          </Button>
        ) : undefined}
        searchLabel={t('customerSearch')}
        emptyLabel={t('customersEmpty')}
        />
      </div>

      <CreateCustomerDrawer open={creating} onClose={() => setCreating(false)} />
    </section>
  );
}

/** Matches the server's SlugSchema so the field cannot produce a value it rejects. */
function toSlug(value: string): string {
  return value
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Creating a customer: one short form, not a wizard.
 *
 * The mockup opened on an Organisations step. That step is gone on purpose — a
 * genuinely new customer often has no CargoWise organisation yet, so starting
 * there dead-ends the operator and their escape is to invent a code, which is
 * exactly what the link gate exists to prevent.
 *
 * Only the name, the short name and a reason are required. Everything else has a
 * default or can be filled in later, so the form never blocks on a fact nobody
 * has on day one; the card at the end says what still has to happen afterwards.
 */
function CreateCustomerDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('staff');
  const navigate = useNavigate();
  const branches = useServicingOffices(open);
  const create = useCreateCustomer();

  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [countryCode, setCountryCode] = useState('');
  const [tier, setTier] = useState<'basic' | 'standard' | 'premium'>('standard');
  const [domains, setDomains] = useState('');
  const [branchId, setBranchId] = useState('');
  const [reason, setReason] = useState('');

  const applyName = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(toSlug(value));
  };

  const domainList = domains.split(/[,\s]+/).map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  const filled = [name.trim().length > 0, slug.trim().length > 0, reason.trim().length > 0].filter(Boolean).length;
  const ready = filled === 3;

  const close = () => {
    setName(''); setLegalName(''); setSlug(''); setSlugTouched(false);
    setCountryCode(''); setTier('standard'); setDomains(''); setBranchId(''); setReason('');
    create.reset();
    onClose();
  };

  const submit = () => {
    create.mutate(
      {
        name: name.trim(),
        legalName: legalName.trim() === '' ? null : legalName.trim(),
        slug: slug.trim(),
        countryCode: countryCode.trim() === '' ? null : countryCode.trim().toUpperCase(),
        tier,
        emailDomains: domainList,
        defaultServicingBranchId: branchId === '' ? null : branchId,
        reason: reason.trim(),
      },
      { onSuccess: (created) => { close(); if (created?.id) navigate(`/portal/customers/${created.id}`); } },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent side="right" closeLabel={t('close')}>
        <DrawerHeader>
          <DialogTitle>{t('customerCreate')}</DialogTitle>
          <p className={styles.drawerNote}>{t('createIntro')}</p>
        </DrawerHeader>

        <DrawerBody>
          <DrawerCard title={t('createSectionIdentity')} columns={2}>
            <Input
              label={t('customerName')} value={name} required
              hint={t('createNameHint')}
              onChange={(event) => applyName(event.target.value)}
            />
            <Input
              label={t('customerSlug')} value={slug} required hint={t('customerSlugHint')}
              onChange={(event) => { setSlugTouched(true); setSlug(toSlug(event.target.value)); }}
            />
            <Input
              label={optional(t('customerRegisteredName'), t('optional'))} value={legalName}
              hint={t('createLegalNameHint')}
              onChange={(event) => setLegalName(event.target.value)}
            />
            <Input
              label={optional(t('customerCountry'), t('optional'))} value={countryCode} maxLength={2}
              hint={t('customerCountryHint')}
              onChange={(event) => setCountryCode(event.target.value.toUpperCase())}
            />
          </DrawerCard>

          <DrawerCard title={t('createSectionAccess')}>
            <Input
              label={optional(t('customerDomains'), t('optional'))} value={domains}
              hint={t('createDomainsHint')}
              onChange={(event) => setDomains(event.target.value)}
            />
          </DrawerCard>

          <DrawerCard title={t('createSectionDefaults')} columns={2}>
            <DrawerWide>
              <p className={styles.drawerNote}>{t('createDefaultsNote')}</p>
            </DrawerWide>
            <Select
              label={optional(t('customerServicing'), t('optional'))} value={branchId}
              placeholder={t('createChooseLater')} onValueChange={setBranchId}
              options={(branches.data?.items ?? []).map((entry) => ({ value: entry.id, label: `${entry.code} · ${entry.name}` }))}
            />
            <Select
              label={optional(t('customerTierLabel'), t('optional'))} value={tier}
              onValueChange={(value) => setTier(value as 'basic' | 'standard' | 'premium')}
              options={[
                { value: 'basic', label: t('customerTier_basic') },
                { value: 'standard', label: t('customerTier_standard') },
                { value: 'premium', label: t('customerTier_premium') },
              ]}
            />
          </DrawerCard>

          <DrawerCard title={t('createSectionNext')}>
            <ul className={styles.checkList}>
              <li>{t('createNextOrganisation')}</li>
              <li>{t('createNextAdministrator')}</li>
              <li>{t('createNextGoLive')}</li>
            </ul>
            <Input label={t('reason')} value={reason} required onChange={(event) => setReason(event.target.value)} />
            {create.error instanceof CustomerWriteError ? (
              <p className={styles.formError} role="alert">{create.error.message || t('unavailable')}</p>
            ) : null}
          </DrawerCard>
        </DrawerBody>

        <DrawerFooter>
          <Button variant="outline" onClick={close}>{t('cancel')}</Button>
          <Button loading={create.isPending} disabled={!ready || create.isPending} onClick={submit}>
            {t('createSubmit')}
          </Button>
        </DrawerFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Marks a field the operator may leave for later, in the label itself. */
function optional(label: string, word: string): string {
  return `${label} · ${word}`;
}

export function CustomerDetailPage() {
  const { t } = useTranslation('staff');
  const { id = '' } = useParams();
  const customer = useCustomer(id);
  const [tab, setTab] = useState('overview');
  const [attaching, setAttaching] = useState(false);
  const [servicingFor, setServicingFor] = useState<CustomerLink | null>(null);
  const [linkPage, setLinkPage] = useState(1);
  const [confirming, setConfirming] = useState<'go-live' | 'suspend' | 'close' | null>(null);
  const [reason, setReason] = useState('');
  const lifecycle = useCustomerLifecycle(id);
  const detach = useDetachOrganisation(id);

  if (customer.error) {
    return (
      <section className={admin.page}>
        <div className={admin.panel} role="alert"><StatePanel title={t(errorKey(customer.error))} /></div>
      </section>
    );
  }
  if (!customer.data) {
    return <section className={admin.page}><div className={admin.panel}><StatePanel title={t('loading')} /></div></section>;
  }

  const detail = customer.data;
  const canGoLive = detail.goLiveMissing.length === 0 && detail.allowedTransitions.includes('active');

  const runLifecycle = () => {
    if (!confirming) return;
    lifecycle.mutate(
      { action: confirming, updatedAt: detail.updatedAt, reason: reason.trim() },
      { onSuccess: () => { setConfirming(null); setReason(''); } },
    );
  };

  const activeLinks = detail.links.filter((link) => link.sourceActive).length;
  const addresses = detail.links.reduce((total, link) => total + link.addresses, 0);
  const administrator = detail.tasks.find((task) => task.key === 'administrator');

  return (
    <section className={admin.page}>
      <DetailHero
        breadcrumb={[
          { label: t('navGroup_administration') },
          { label: t('nav_customers'), to: '/portal/customers' },
          { label: detail.name },
        ]}
        eyebrow={t('customerHeroEyebrow')}
        title={detail.name}
        status={<Badge tone={STATUS_TONE[detail.status] ?? 'neutral'}>{t(`customerStatus_${detail.status}`)}</Badge>}
        subline={detail.slug}
        chips={[
          t(`customerTier_${detail.tier}`),
          detail.defaultServicingBranchCode,
        ]}
        columns={[
          {
            icon: <Building2 />,
            label: t('customerRegisteredName'),
            value: detail.legalName ?? detail.name,
            lines: [detail.countryCode ? t('customerRegisteredIn', { country: detail.countryCode }) : null],
          },
          {
            icon: <Mail />,
            label: t('customerDomains'),
            value: detail.emailDomains.length > 0 ? detail.emailDomains.join(' · ') : t('customerNoDomains'),
          },
          {
            icon: <Network />,
            label: t('customerHierarchy'),
            value: detail.parentName ?? t('customerNoParent'),
          },
          {
            icon: <CalendarClock />,
            label: t('customerUpdated'),
            value: formatDate(detail.updatedAt),
          },
        ]}
        actions={
          <>
            {detail.allowedTransitions.includes('active') ? (
              <Button
                disabled={!canGoLive}
                title={canGoLive ? undefined : t('goLiveNeeds', { missing: formatList(detail.goLiveMissing, t('listAnd')) })}
                onClick={() => setConfirming('go-live')}
              >
                {detail.status === 'suspended' ? t('customerReactivate') : t('customerGoLive')}
              </Button>
            ) : null}
            {detail.allowedTransitions.includes('suspended') ? (
              <Button variant="outline" onClick={() => setConfirming('suspend')}>{t('customerSuspend')}</Button>
            ) : null}
            {detail.allowedTransitions.includes('closed') ? (
              <Button variant="outline" onClick={() => setConfirming('close')}>{t('customerClose')}</Button>
            ) : null}
          </>
        }
        footnote={
          detail.goLiveMissing.length > 0 && detail.allowedTransitions.includes('active')
            ? t('goLiveNeeds', { missing: formatList(detail.goLiveMissing, t('listAnd')) })
            : undefined
        }
      />

      {detail.allowedTransitions.includes('active') && detail.tasks.some((task) => !task.done) ? (
        <StepRibbon
          title={t('customerOnboardingTitle', {
            done: detail.tasks.filter((task) => task.done).length,
            total: detail.tasks.length,
          })}
          note={t('customerOnboardingNote')}
          steps={detail.tasks.map((task) => ({
            id: task.key,
            label: t(`customerTask_${task.key}`),
            done: task.done,
            note: task.blockedReason,
          }))}
        />
      ) : null}

      <div className={admin.panel}>
        <Tabs
          ariaLabel={t('nav_customers')}
          value={tab}
          onChange={setTab}
          items={[
            {
              id: 'overview',
              label: t('customerTabOverview'),
              content: (
                <SummaryGrid
                  columns={3}
                  facts={[
                    {
                      label: t('customerLinkedOrganisations'),
                      value: t('customerOrgCount', { count: detail.links.length }),
                      hint: t('customerOrgSummary', { active: activeLinks, addresses }),
                    },
                    {
                      label: t('customerServicing'),
                      value: detail.defaultServicingBranchCode ?? t('customerNoServicing'),
                      hint: t('customerServicingHint'),
                    },
                    {
                      label: t('customerFirstAdmin'),
                      value: administrator?.done ? t('customerAdminInPlace') : t('customerAdminMissing'),
                      hint: administrator?.blockedReason ?? undefined,
                    },
                    {
                      label: t('customerUsersTitle'),
                      value: t('customerUserCount', { count: detail.users }),
                      hint: t('customerUsersHint'),
                    },
                    {
                      label: t('customerIdentity'),
                      value: t('customerSignIn'),
                      hint: t('customerIdentityHint'),
                    },
                    {
                      label: t('customerLifecycle'),
                      value: t(`customerStatus_${detail.status}`),
                      hint: t('customerLifecycleHint'),
                    },
                  ]}
                />
              ),
            },
            {
              id: 'organisations',
              label: t('customerLinkedOrganisations'),
              badge: detail.links.length || undefined,
              content: (
                <div className={styles.tabBody}>
                  <div className={styles.tabIntro}>
                    <InfoRibbon label={t('aboutThisSection')} closeLabel={t('hideGuidance')} className={styles.grow}>
                      {t('customerLinksHelp')}
                    </InfoRibbon>
                    <Button size="sm" onClick={() => setAttaching(true)}>
                      <Link2 aria-hidden size={14} />{t('customerAttach')}
                    </Button>
                  </div>
                  <AdminListing
                    caption={t('customerLinkedOrganisations')}
                    columns={[
                      {
                        key: 'code', label: t('orgCode'),
                        render: (row: CustomerLink) => (
                          <Link to={`/portal/organisations/${row.orgId}`} className={styles.code}>{row.sourceCode}</Link>
                        ),
                      },
                      { key: 'name', label: t('orgName'), render: (row: CustomerLink) => row.name },
                      { key: 'city', label: t('orgCity'), render: (row: CustomerLink) => row.city ?? '—' },
                      {
                        key: 'servicing', label: t('linkServicing'),
                        render: (row: CustomerLink) =>
                          row.effectiveServicingBranchCode === null ? (
                            <span className={styles.muted}>{t('customerNoServicing')}</span>
                          ) : (
                            <span className={styles.servicingCell}>
                              {row.effectiveServicingBranchCode}
                              {row.servicingInherited ? <span className={styles.inherited}>{t('linkServicingInherited')}</span> : null}
                            </span>
                          ),
                      },
                      { key: 'addresses', label: t('orgAddresses'), render: (row: CustomerLink) => row.addresses },
                      {
                        key: 'source', label: t('orgSourceState'),
                        render: (row: CustomerLink) =>
                          row.sourceActive ? <Badge tone="success">{t('orgActive')}</Badge> : <Badge tone="warning">{t('orgInactive')}</Badge>,
                      },
                      { key: 'linked', label: t('orgLinkedAt'), render: (row: CustomerLink) => (row.linkedAt ? formatDate(row.linkedAt) : '—') },
                      { key: 'reason', label: t('orgReason'), render: (row: CustomerLink) => row.justification ?? '—' },
                      {
                        key: 'actions', label: t('actions'),
                        render: (row: CustomerLink) => (
                          <span className={styles.rowActions}>
                            <Button size="sm" variant="quiet" onClick={() => setServicingFor(row)}>
                              <Building2 aria-hidden size={13} />{t('linkServicingChange')}
                            </Button>
                            <Button
                              size="sm" variant="quiet"
                              onClick={() => detach.mutate({ accountId: row.id, reason: t('orgDetachReason') })}
                            >
                              <Trash2 aria-hidden size={13} />{t('orgDetach')}
                            </Button>
                          </span>
                        ),
                      },
                    ]}
                    rows={detail.links.slice((linkPage - 1) * 10, linkPage * 10)}
                    rowKey={(row: CustomerLink) => row.id}
                    total={detail.links.length}
                    page={linkPage}
                    pageSize={10}
                    onPageChange={setLinkPage}
                    emptyLabel={t('customerNoLinks')}
                  />
                </div>
              ),
            },
            {
              id: 'users',
              label: t('customerTabUsers'),
              badge: detail.users || undefined,
              content: <UsersPanel customerId={id} links={detail.links} />,
            },
          ]}
        />
      </div>

      <AttachDrawer
        customerId={id}
        open={attaching}
        onClose={() => setAttaching(false)}
        defaultBranchCode={detail.defaultServicingBranchCode}
      />

      <ServicingDrawer
        customerId={id}
        link={servicingFor}
        defaultBranchCode={detail.defaultServicingBranchCode}
        onClose={() => setServicingFor(null)}
      />

      <Dialog open={confirming !== null} onOpenChange={(next) => { if (!next) { setConfirming(null); setReason(''); } }}>
        <DialogContent side="right" closeLabel={t('close')}>
          <DrawerHeader>
            <DialogTitle>{confirming ? t(`customerConfirm_${confirming.replace('-', '_')}`) : ''}</DialogTitle>
          </DrawerHeader>
          <DrawerBody>
            <DrawerCard>
              {confirming === 'close' ? <p className={styles.warning}>{t('customerCloseWarning')}</p> : null}
              <Input label={t('reason')} value={reason} onChange={(event) => setReason(event.target.value)} />
              {lifecycle.error instanceof CustomerWriteError ? (
                <p className={styles.formError} role="alert">{lifecycle.error.message}</p>
              ) : null}
            </DrawerCard>
          </DrawerBody>
          <DrawerFooter>
            <Button variant="outline" onClick={() => { setConfirming(null); setReason(''); }}>{t('cancel')}</Button>
            <Button disabled={reason.trim().length === 0 || lifecycle.isPending} onClick={runLifecycle}>{t('confirm')}</Button>
          </DrawerFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/**
 * Moving one link to a different Noatum office.
 *
 * Separate from attaching because the office changes far more often than the
 * link does — an account moves desk without the organisation changing at all.
 */
function ServicingDrawer({ customerId, link, defaultBranchCode, onClose }: {
  customerId: string;
  link: CustomerLink | null;
  defaultBranchCode: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('staff');
  const branches = useServicingOffices(link !== null);
  const save = useSetLinkServicing(customerId);
  const [branchId, setBranchId] = useState(INHERIT_BRANCH);
  const [reason, setReason] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Re-seed when a different row opens the drawer, not on every render.
  if (link && loadedFor !== link.id) {
    setLoadedFor(link.id);
    setBranchId(link.servicingBranchCode === null
      ? INHERIT_BRANCH
      : (branches.data?.items ?? []).find((entry) => entry.code === link.servicingBranchCode)?.id ?? INHERIT_BRANCH);
    setReason('');
    save.reset();
  }

  const close = () => { setLoadedFor(null); onClose(); };

  return (
    <Dialog open={link !== null} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent side="right" closeLabel={t('close')}>
        <DrawerHeader>
          <DialogTitle>{t('linkServicingTitle', { code: link?.sourceCode ?? '' })}</DialogTitle>
          <p className={styles.drawerNote}>{t('linkServicingHint')}</p>
        </DrawerHeader>
        <DrawerBody>
          <DrawerCard>
            <Select
              label={t('linkServicing')}
              value={branchId}
              onValueChange={setBranchId}
              options={[
                {
                  value: INHERIT_BRANCH,
                  label: defaultBranchCode
                    ? t('linkServicingInheritCode', { code: defaultBranchCode })
                    : t('linkServicingInheritNone'),
                },
                ...(branches.data?.items ?? []).map((entry) => ({ value: entry.id, label: `${entry.code} · ${entry.name}` })),
              ]}
            />
            <Input label={t('reason')} value={reason} required onChange={(event) => setReason(event.target.value)} />
            {save.error instanceof CustomerWriteError ? (
              <p className={styles.formError} role="alert">{save.error.message}</p>
            ) : null}
          </DrawerCard>
        </DrawerBody>
        <DrawerFooter>
          <Button variant="outline" onClick={close}>{t('cancel')}</Button>
          <Button
            loading={save.isPending}
            disabled={reason.trim().length === 0 || save.isPending}
            onClick={() => link && save.mutate(
              {
                accountId: link.id,
                servicingBranchId: branchId === INHERIT_BRANCH ? null : branchId,
                reason: reason.trim(),
              },
              { onSuccess: close },
            )}
          >
            {t('userAccessSave')}
          </Button>
        </DrawerFooter>
      </DialogContent>
    </Dialog>
  );
}

function AttachDrawer({ customerId, open, onClose, defaultBranchCode }: {
  customerId: string; open: boolean; onClose: () => void; defaultBranchCode: string | null;
}) {
  const { t } = useTranslation('staff');
  const [search, setSearch] = useState('');
  const [unlinkedOnly, setUnlinkedOnly] = useState(true);
  const [selected, setSelected] = useState<DirectoryOrganisation | null>(null);
  const [reason, setReason] = useState('');
  const [branchId, setBranchId] = useState(INHERIT_BRANCH);
  const [page, setPage] = useState(1);
  const directory = useDirectory({ search: search.trim(), unlinkedOnly, page, pageSize: 10 }, open);
  const branches = useServicingOffices(open);
  const attach = useAttachOrganisation(customerId);

  const results = useMemo(() => directory.data?.items ?? [], [directory.data]);

  const close = () => { setSelected(null); setReason(''); setSearch(''); setBranchId(INHERIT_BRANCH); setPage(1); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent side="right" closeLabel={t('close')}>
        <DrawerHeader>
          <DialogTitle>{t('customerAttach')}</DialogTitle>
          <p className={styles.drawerNote}>{t('customerAttachHelp')}</p>
        </DrawerHeader>
        <DrawerBody>
          <DrawerCard title={t('orgSearch')}>
            <Input
              label={t('orgSearch')} labelHidden placeholder={t('orgSearchHint')}
              value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            />
            <Button size="sm" variant={unlinkedOnly ? 'primary' : 'outline'} onClick={() => { setUnlinkedOnly((value) => !value); setPage(1); }}>
              {t('orgUnlinkedOnly')}
            </Button>

          {directory.isPending ? (
            <StatePanel title={t('loading')} />
          ) : results.length === 0 ? (
            <StatePanel title={t('orgNoResults')} />
          ) : (
            <ul className={styles.results}>
              {results.map((organisation) => {
                const blocked = organisation.blockedReason !== null;
                return (
                  <li key={organisation.id}>
                    <button
                      type="button" className={selected?.id === organisation.id ? styles.resultSelected : styles.result}
                      disabled={blocked} aria-disabled={blocked}
                      onClick={() => setSelected(organisation)}
                    >
                      <span className={styles.resultMain}>
                        <span className={styles.code}>{organisation.sourceCode}</span>
                        <span className={styles.resultName}>{organisation.name}</span>
                      </span>
                      <span className={styles.resultMeta}>
                        {[organisation.city, organisation.countryCode].filter(Boolean).join(' · ')}
                        {organisation.category ? ` · ${organisation.category}` : ''}
                      </span>
                      {blocked ? <span className={styles.resultBlocked}>{organisation.blockedReason}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {(directory.data?.total ?? 0) > 10 ? (
            <Pagination
              label={t('page', { page, count: Math.ceil((directory.data?.total ?? 0) / 10) })}
              page={page}
              pageCount={Math.ceil((directory.data?.total ?? 0) / 10)}
              previousLabel={t('previous')}
              nextLabel={t('next')}
              onPageChange={setPage}
            />
          ) : null}
          </DrawerCard>

          {selected ? (
            <DrawerCard title={t('customerAttach')}>
              <Select
                label={t('linkServicing')}
                value={branchId}
                onValueChange={setBranchId}
                hint={t('linkServicingHint')}
                options={[
                  {
                    value: INHERIT_BRANCH,
                    label: defaultBranchCode
                      ? t('linkServicingInheritCode', { code: defaultBranchCode })
                      : t('linkServicingInheritNone'),
                  },
                  ...(branches.data?.items ?? []).map((entry) => ({ value: entry.id, label: `${entry.code} · ${entry.name}` })),
                ]}
              />
              <Input label={t('reason')} value={reason} onChange={(event) => setReason(event.target.value)} />
              {attach.error instanceof CustomerWriteError ? (
                <p className={styles.formError} role="alert">{attach.error.message}</p>
              ) : null}
            </DrawerCard>
          ) : null}
        </DrawerBody>
        <DrawerFooter>
          <Button variant="outline" onClick={close}>{t('cancel')}</Button>
          <Button
            disabled={!selected || reason.trim().length === 0 || attach.isPending}
            onClick={() => selected && attach.mutate(
              { orgId: selected.id, reason: reason.trim(), servicingBranchId: branchId === INHERIT_BRANCH ? null : branchId },
              { onSuccess: close },
            )}
          >
            {t('customerAttach')}
          </Button>
        </DrawerFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Who inside the customer sees which organisations.
 *
 * The stored form is a restriction — no rows means every organisation — which
 * reads backwards to anyone looking at the screen. The panel therefore states
 * the effect ("all" or a named list) rather than the mechanism.
 */
function UsersPanel({ customerId, links }: { customerId: string; links: CustomerLink[] }) {
  const { t } = useTranslation('staff');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<CustomerUser | null>(null);
  const [inviting, setInviting] = useState(false);
  const [accountAction, setAccountAction] = useState<{ user: CustomerUser; action: AccountAction } | null>(null);
  const users = useCustomerUsers(customerId, page);

  const names = useMemo(
    () => new Map(links.map((link) => [link.id, `${link.sourceCode} · ${link.name}`])),
    [links],
  );

  return (
    <div className={styles.tabBody}>
      <div className={styles.tabIntro}>
        <InfoRibbon label={t('aboutThisSection')} closeLabel={t('hideGuidance')} className={styles.grow}>
          {t('customerUsersHelp')}
        </InfoRibbon>
        <Button size="sm" onClick={() => setInviting(true)}>
          <UserPlus aria-hidden size={14} />{t('customerInvite')}
        </Button>
      </div>

      {users.error ? (
        <StatePanel title={t(errorKey(users.error))} />
      ) : (
        <AdminListing
          caption={t('customerUsersTitle')}
          columns={[
            { key: 'name', label: t('userName'), render: (row: CustomerUser) => row.displayName },
            { key: 'email', label: t('userEmail'), render: (row: CustomerUser) => row.email },
            {
              key: 'status', label: t('customerStatusColumn'),
              render: (row: CustomerUser) => <Badge tone={row.status === 'active' ? 'success' : 'neutral'}>{t(`userStatus_${row.status}`)}</Badge>,
            },
            {
              key: 'signIn', label: t('userSignIn'),
              render: (row: CustomerUser) => <SignInState security={row.security} />,
            },
            {
              key: 'access', label: t('userAccess'),
              render: (row: CustomerUser) =>
                row.seesAllOrganisations ? (
                  <Badge tone="info">{t('userAccessAll')}</Badge>
                ) : (
                  <span className={styles.accessList}>
                    {row.accountIds.map((accountId) => names.get(accountId) ?? accountId).join(', ')}
                  </span>
                ),
            },
            {
              key: 'actions', label: t('actions'),
              render: (row: CustomerUser) => (
                <div className={styles.rowActions}>
                  <Button size="sm" variant="quiet" onClick={() => setEditing(row)}>{t('userAccessChange')}</Button>
                  {row.security && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="quiet" aria-label={t('userSignInActions', { name: row.displayName })}>
                          <KeyRound aria-hidden size={14} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>{t('userSignInActionsLabel')}</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => setAccountAction({ user: row, action: 'password-reset' })}>
                          {t('userSendReset')}
                        </DropdownMenuItem>
                        {row.security.credentialDisabled ? (
                          <DropdownMenuItem onSelect={() => setAccountAction({ user: row, action: 'restore' })}>
                            {t('userRestoreSignIn')}
                          </DropdownMenuItem>
                        ) : (
                          // Nothing to block before a password exists; withdrawing the
                          // invitation is the action that actually stops them getting in.
                          row.security.hasPassword && (
                            <DropdownMenuItem onSelect={() => setAccountAction({ user: row, action: 'block' })}>
                              {t('userBlockSignIn')}
                            </DropdownMenuItem>
                          )
                        )}
                        {row.security.mfaEnrolled && (
                          <DropdownMenuItem onSelect={() => setAccountAction({ user: row, action: 'mfa-reset' })}>
                            {t('userResetMfa')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ),
            },
          ]}
          rows={users.data?.items ?? []}
          rowKey={(row: CustomerUser) => row.id}
          total={users.data?.total ?? 0}
          page={page}
          pageSize={25}
          onPageChange={setPage}
          isPending={users.isPending}
          emptyLabel={t('customerUsersEmpty')}
        />
      )}

      <InvitationsPanel customerId={customerId} />

      <AccessDrawer customerId={customerId} links={links} user={editing} onClose={() => setEditing(null)} />
      <InviteDrawer customerId={customerId} open={inviting} onClose={() => setInviting(false)} />
      {/* Keyed on the subject: a new decision gets a new dialog rather than an
          old one with its fields cleared one by one. */}
      <AccountActionDialog
        key={accountAction ? `${accountAction.user.id}:${accountAction.action}` : 'none'}
        customerId={customerId}
        request={accountAction}
        onClose={() => setAccountAction(null)}
      />
    </div>
  );
}

/** What an administrator needs at a glance: can this person get in, and how well protected. */
function SignInState({ security }: { security: CustomerUserSecurity | null }) {
  const { t } = useTranslation('staff');
  if (!security) return <span className={styles.muted}>{t('userSignInUnmanaged')}</span>;
  if (security.credentialDisabled) return <Badge tone="error">{t('userSignInBlocked')}</Badge>;
  if (!security.hasPassword) {
    return (
      <Badge tone={security.pendingActivationLink ? 'warning' : 'neutral'}>
        {t(security.pendingActivationLink ? 'userSignInInvited' : 'userSignInNone')}
      </Badge>
    );
  }
  return (
    <span className={styles.rowActions}>
      <Badge tone="success">{t('userSignInActive')}</Badge>
      <Badge tone={security.mfaEnrolled ? 'info' : 'neutral'}>
        {t(security.mfaEnrolled ? 'userMfaOn' : 'userMfaOff')}
      </Badge>
    </span>
  );
}

/**
 * Every one of these acts on somebody else's access, so each asks for a reason before
 * it runs and each writes that reason to the audit trail.
 */
function AccountActionDialog({
  customerId,
  request,
  onClose,
}: {
  customerId: string;
  request: { user: CustomerUser; action: AccountAction } | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('staff');
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<AccountActionResult | null>(null);
  const run = useAccountAction(customerId);

  // A new subject means a new decision. The caller keys this component on the
  // subject, so a change remounts it and the state below starts empty.

  if (!request) return null;
  const { user, action } = request;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent closeLabel={t('close')}>
        <DialogTitle>{t(`userAction_${action}`)}</DialogTitle>
        <DialogDescription>{t(`userActionHelp_${action}`, { name: user.displayName, email: user.email })}</DialogDescription>
        {result ? (
          <div className={styles.drawerBody}>
            <p className={styles.help}>{t(`userActionDone_${action}`, { email: user.email })}</p>
            {result.link && (
              <Input label={t('inviteLink')} value={result.link} readOnly hint={t('inviteLinkHint')} />
            )}
            {result.emailStatus === 'sent' && <p className={styles.help}>{t('inviteEmailSent')}</p>}
            <Button onClick={onClose}>{t('close')}</Button>
          </div>
        ) : (
          <form
            className={styles.drawerBody}
            onSubmit={(event) => {
              event.preventDefault();
              run.mutate(
                { userId: user.id, action, reason },
                { onSuccess: (value) => setResult(value) },
              );
            }}
          >
            <Input
              label={t('reason')}
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              hint={t('reasonHint')}
            />
            {run.error && (
              <p role="alert" className={styles.warning}>
                {run.error instanceof CustomerWriteError && run.error.message ? run.error.message : t('actionFailed')}
              </p>
            )}
            <div className={styles.drawerActions}>
              <Button type="button" variant="outline" onClick={onClose}>{t('cancel')}</Button>
              <Button type="submit" loading={run.isPending}>{t(`userAction_${action}`)}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Invitations that have been sent but not yet acted on, and the two things to do about them. */
function InvitationsPanel({ customerId }: { customerId: string }) {
  const { t } = useTranslation('staff');
  const invitations = useCustomerInvitations(customerId);
  const [pending, setPending] = useState<{ invitation: Invitation; action: 'resend' | 'revoke' } | null>(null);

  const rows = invitations.data ?? [];
  if (!invitations.isPending && rows.length === 0) return null;

  return (
    <>
      <AdminListing
        caption={t('invitationsTitle')}
        columns={[
          { key: 'email', label: t('userEmail'), render: (row: Invitation) => row.email },
          {
            key: 'status', label: t('customerStatusColumn'),
            render: (row: Invitation) => (
              <Badge tone={row.status === 'pending' ? 'warning' : row.status === 'accepted' ? 'success' : 'neutral'}>
                {t(`invitationStatus_${row.status}`)}
              </Badge>
            ),
          },
          {
            key: 'expires', label: t('invitationExpires'),
            render: (row: Invitation) => <DateValue value={row.expiresAt} />,
          },
          {
            key: 'actions', label: t('actions'),
            render: (row: Invitation) =>
              row.status === 'pending' ? (
                <div className={styles.rowActions}>
                  <Button size="sm" variant="quiet" onClick={() => setPending({ invitation: row, action: 'resend' })}>
                    {t('invitationResend')}
                  </Button>
                  <Button size="sm" variant="quiet" onClick={() => setPending({ invitation: row, action: 'revoke' })}>
                    {t('invitationRevoke')}
                  </Button>
                </div>
              ) : null,
          },
        ]}
        rows={rows}
        rowKey={(row: Invitation) => row.id}
        total={rows.length}
        page={1}
        pageSize={rows.length || 1}
        onPageChange={() => undefined}
        isPending={invitations.isPending}
        emptyLabel={t('invitationsEmpty')}
      />
      <InvitationActionDialog
        key={pending ? `${pending.invitation.id}:${pending.action}` : 'none'}
        customerId={customerId}
        request={pending}
        onClose={() => setPending(null)}
      />
    </>
  );
}

function InvitationActionDialog({
  customerId,
  request,
  onClose,
}: {
  customerId: string;
  request: { invitation: Invitation; action: 'resend' | 'revoke' } | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('staff');
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<Invitation | null>(null);
  const run = useInvitationAction(customerId);

  // Keyed by the caller, as above: a new invitation is a new dialog.

  if (!request) return null;
  const { invitation, action } = request;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent closeLabel={t('close')}>
        <DialogTitle>{t(`invitationAction_${action}`)}</DialogTitle>
        <DialogDescription>{t(`invitationActionHelp_${action}`, { email: invitation.email })}</DialogDescription>
        {result ? (
          <div className={styles.drawerBody}>
            <p className={styles.help}>{t(`invitationActionDone_${action}`, { email: invitation.email })}</p>
            {result.inviteLink && (
              <Input label={t('inviteLink')} value={result.inviteLink} readOnly hint={t('inviteLinkHint')} />
            )}
            <Button onClick={onClose}>{t('close')}</Button>
          </div>
        ) : (
          <form
            className={styles.drawerBody}
            onSubmit={(event) => {
              event.preventDefault();
              run.mutate(
                { invitationId: invitation.id, action, reason },
                { onSuccess: (value) => setResult(value) },
              );
            }}
          >
            <Input
              label={t('reason')}
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              hint={t('reasonHint')}
            />
            {run.error && (
              <p role="alert" className={styles.warning}>
                {run.error instanceof CustomerWriteError && run.error.message ? run.error.message : t('actionFailed')}
              </p>
            )}
            <div className={styles.drawerActions}>
              <Button type="button" variant="outline" onClick={onClose}>{t('cancel')}</Button>
              <Button type="submit" loading={run.isPending}>{t(`invitationAction_${action}`)}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Inviting the first administrator.
 *
 * The link is shown on screen when no email transport is configured. That is
 * deliberate and temporary: it keeps onboarding unblocked without pretending a
 * message was delivered.
 */
function InviteDrawer({ customerId, open, onClose }: { customerId: string; open: boolean; onClose: () => void }) {
  const { t } = useTranslation('staff');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [override, setOverride] = useState('');
  const [reason, setReason] = useState('');
  const [issued, setIssued] = useState<Invitation | null>(null);
  const invite = useInviteAdministrator(customerId);

  const close = () => {
    setDisplayName(''); setEmail(''); setOverride(''); setReason(''); setIssued(null);
    onClose();
  };

  const domainRefused = invite.error instanceof CustomerWriteError && invite.error.code === 'DOMAIN_NOT_ALLOWED';
  const ready = displayName.trim() !== '' && email.trim() !== '' && reason.trim() !== ''
    && (!domainRefused || override.trim() !== '');

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent side="right" closeLabel={t('close')}>
        <DrawerHeader>
          <DialogTitle>{t('customerInvite')}</DialogTitle>
          <p className={styles.drawerNote}>{issued ? t('inviteIssued', { email: issued.email }) : t('inviteHelp')}</p>
        </DrawerHeader>

        {issued ? (
          <>
            <DrawerBody>
              <DrawerCard>
                {issued.emailStatus === 'sent' ? (
                  <p className={styles.help}>{t('inviteEmailSent')}</p>
                ) : (
                  <>
                    <p className={styles.warning} role="status">{t('inviteEmailPending')}</p>
                    <Input label={t('inviteLink')} value={issued.inviteLink ?? ''} readOnly hint={t('inviteLinkHint')} />
                  </>
                )}
              </DrawerCard>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={close}>{t('close')}</Button>
            </DrawerFooter>
          </>
        ) : (
          <>
            <DrawerBody>
              <DrawerCard columns={2}>
                <Input label={t('userName')} value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
                <Input label={t('userEmail')} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                {domainRefused ? (
                  <DrawerWide>
                    <Input
                      label={t('inviteOverride')} value={override} hint={t('inviteOverrideHint')}
                      onChange={(event) => setOverride(event.target.value)}
                    />
                  </DrawerWide>
                ) : null}
                <DrawerWide>
                  <Input label={t('reason')} value={reason} onChange={(event) => setReason(event.target.value)} required />
                </DrawerWide>
                {invite.error instanceof CustomerWriteError ? (
                  <DrawerWide>
                    <p className={styles.formError} role="alert">{invite.error.message || t('unavailable')}</p>
                  </DrawerWide>
                ) : null}
              </DrawerCard>
            </DrawerBody>
            <DrawerFooter>
              <Button variant="outline" onClick={close}>{t('cancel')}</Button>
              <Button
                loading={invite.isPending}
                disabled={!ready || invite.isPending}
                onClick={() =>
                  invite.mutate(
                    {
                      displayName: displayName.trim(),
                      email: email.trim().toLowerCase(),
                      domainOverrideReason: override.trim() === '' ? null : override.trim(),
                      reason: reason.trim(),
                    },
                    { onSuccess: (result) => setIssued(result ?? null) },
                  )
                }
              >
                {t('customerInvite')}
              </Button>
            </DrawerFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AccessDrawer({
  customerId, links, user, onClose,
}: { customerId: string; links: CustomerLink[]; user: CustomerUser | null; onClose: () => void }) {
  const { t } = useTranslation('staff');
  // Keyed on the user so opening a different person resets the form.
  const [scope, setScope] = useState<'all' | 'selected'>('all');
  const [chosen, setChosen] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const update = useUpdateUserAccess(customerId);

  if (user && loadedFor !== user.id) {
    setLoadedFor(user.id);
    setScope(user.seesAllOrganisations ? 'all' : 'selected');
    setChosen(user.accountIds);
    setReason('');
  }

  const close = () => { setLoadedFor(null); onClose(); };
  const incomplete = scope === 'selected' && chosen.length === 0;

  return (
    <Dialog open={user !== null} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent side="right" closeLabel={t('close')}>
        <DrawerHeader>
          <DialogTitle>{t('userAccessTitle', { name: user?.displayName ?? '' })}</DialogTitle>
          <p className={styles.drawerNote}>{t('userAccessHelp')}</p>
        </DrawerHeader>
        <DrawerBody>
          <DrawerCard title={t('userAccess')}>
            <fieldset className={styles.fieldset}>
              <legend className={styles.srOnly}>{t('userAccess')}</legend>
            <label className={styles.choice}>
              <input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} />
              <span>
                <span className={styles.choiceName}>{t('userAccessAll')}</span>
                <span className={styles.choiceHint}>{t('userAccessAllHint')}</span>
              </span>
            </label>
            <label className={styles.choice}>
              <input type="radio" name="scope" checked={scope === 'selected'} onChange={() => setScope('selected')} />
              <span>
                <span className={styles.choiceName}>{t('userAccessSelected')}</span>
                <span className={styles.choiceHint}>{t('userAccessSelectedHint')}</span>
              </span>
            </label>
            </fieldset>

          {scope === 'selected' ? (
            links.length === 0 ? (
              <StatePanel title={t('customerNoLinks')} />
            ) : (
              <ul className={styles.checkList}>
                {links.map((link) => (
                  <li key={link.id}>
                    <label className={styles.checkItem}>
                      <input
                        type="checkbox"
                        checked={chosen.includes(link.id)}
                        onChange={(event) =>
                          setChosen((current) =>
                            event.target.checked ? [...current, link.id] : current.filter((value) => value !== link.id),
                          )
                        }
                      />
                      <span>
                        <span className={styles.code}>{link.sourceCode}</span>
                        <span className={styles.resultName}>{link.name}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {incomplete ? <p className={styles.warning} role="status">{t('userAccessNeedsOne')}</p> : null}
          </DrawerCard>

          <DrawerCard>
            <Input label={t('reason')} value={reason} onChange={(event) => setReason(event.target.value)} />
            {update.error instanceof CustomerWriteError ? (
              <p className={styles.formError} role="alert">{update.error.message}</p>
            ) : null}
          </DrawerCard>
        </DrawerBody>
        <DrawerFooter>
          <Button variant="outline" onClick={close}>{t('cancel')}</Button>
          <Button
            disabled={!user || incomplete || reason.trim().length === 0 || update.isPending}
            onClick={() =>
              user &&
              update.mutate(
                { userId: user.id, scope, accountIds: scope === 'selected' ? chosen : [], reason: reason.trim() },
                { onSuccess: close },
              )
            }
          >
            {t('userAccessSave')}
          </Button>
        </DrawerFooter>
      </DialogContent>
    </Dialog>
  );
}
