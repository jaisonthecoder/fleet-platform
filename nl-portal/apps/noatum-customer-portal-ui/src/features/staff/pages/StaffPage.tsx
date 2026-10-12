import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useOutletContext } from 'react-router-dom';
import { KeyRound, RefreshCw, Save, UserRoundCog } from 'lucide-react';
import type { components } from '../../../api/generated/schema';
import { staffRoleFormSchema } from '../../../api/generated/staff-role-form';
import {
  Badge, Button, Checkbox, Code, Dialog, DialogContent, DialogDescription, DialogTitle,
  DrawerBody, DrawerCard, DrawerFooter, DrawerHeader,
  Input, SectionHeading, Select,
} from '../../../design-system';
import { Breadcrumb } from '../../../shared/components/Breadcrumb';
import { ListingGrid } from '../../../shared/components/ListingGrid';
import { errorKey } from '../../../lib/errors';
import { useAssignStaffRoles, useIssueStaffAccessLink, useStaff, useStaffBranches, useStaffPresets, type StaffBranch, type StaffRolePreset, type StaffRoleUpdate, type StaffUser } from '../api/staff';
import { initials, roleLabels } from '../role-labels';
import styles from './StaffPage.module.css';

const permissionLabels: Record<string, string> = {
  'dashboard.read': 'dashboardRead',
  'quotes.read': 'quotesRead',
  'quotes.create': 'quotesCreate',
  'quotes.submit': 'quotesSubmit',
  'quotes.accept': 'quotesAccept',
  'quotes.cancel': 'quotesCancel',
  'templates.read': 'templatesRead',
  'templates.manage': 'templatesManage',
  'address_book.read': 'addressBookRead',
  'address_book.manage': 'addressBookManage',
  'pricing.queue.read': 'pricingQueueRead',
  'pricing.claim': 'pricingClaim',
  'pricing.claim.release': 'pricingClaimRelease',
  'pricing.price': 'pricingPrice',
  'pricing.approve': 'pricingApprove',
  'pricing.cross_branch': 'pricingCrossBranch',
  'pricing.cost.view': 'pricingCostView',
  'shipments.read': 'shipmentsRead',
  'shipments.export': 'shipmentsExport',
  'documents.read': 'documentsRead',
  'documents.download': 'documentsDownload',
  'documents.upload': 'documentsUpload',
  'invoices.read': 'invoicesRead',
  'invoices.download': 'invoicesDownload',
  'bookings.read': 'bookingsRead',
  'bookings.create': 'bookingsCreate',
  'bookings.cancel': 'bookingsCancel',
  'claims.read': 'claimsRead',
  'claims.create': 'claimsCreate',
  'claims.comment': 'claimsComment',
  'reports.read': 'reportsRead',
  'reports.export': 'reportsExport',
  'reports.assign': 'reportsAssign',
  'notifications.manage': 'notificationsManage',
  'users.read': 'usersRead',
  'users.manage': 'usersManage',
  'api_keys.manage': 'apiKeysManage',
  'admin.staff.read': 'staffRead',
  'admin.staff.roles.manage': 'staffManage',
  'admin.customers.read': 'customersRead',
  'admin.customers.manage': 'customersManage',
  'admin.accounts.manage': 'accountsManage',
  'admin.organisations.link': 'organisationsLink',
  'admin.flags.manage': 'flagsManage',
  'admin.lookups.manage': 'lookupsManage',
  'admin.settings.read': 'settingsRead',
  'admin.settings.manage': 'settingsManage',
  'admin.news.manage': 'newsManage',
  'admin.impersonate': 'impersonate',
  'admin.audit.read': 'auditRead',
  'admin.integration.read': 'integrationRead',
};

const statusTone: Record<string, 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  registered: 'warning',
  invited: 'warning',
  suspended: 'neutral',
  disabled: 'neutral',
};

function accessLabel(t: TFunction<'staff'>, labels: Record<string, string>, key: string, fallback: string) {
  return t(Object.hasOwn(labels, key) ? labels[key] ?? fallback : fallback);
}

/** Brand format: DD.MM.YYYY, rendered in the viewer's timezone. */
function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** A sign-in link can expire the same day it is issued, so the hour has to show. */
function formatDateTime(value: string | null): string {
  const day = formatDate(value);
  if (!day || !value) return '—';
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Pricing is branch scoped, so these cannot be granted without a branch. */
const BRANCH_SCOPED = ['pricing', 'pricing_approver'];

function RoleDrawer({ user, presets, branches, actorId, close, saved }: { user: StaffUser; presets: StaffRolePreset[]; branches: StaffBranch[]; actorId: string; close: () => void; saved: () => void }) {
  const { t } = useTranslation('staff');
  const mutation = useAssignStaffRoles();
  const form = useForm<StaffRoleUpdate>({
    resolver: zodResolver(staffRoleFormSchema),
    defaultValues: {
      roleKeys: presets.filter((preset) => user.roleKeys.includes(preset.key)).map((preset) => preset.key),
      branchId: user.branch?.id ?? null,
      updatedAt: user.updatedAt,
      reason: '',
    },
  });
  const self = user.id === actorId;
  const selected = useWatch({ control: form.control, name: 'roleKeys' });
  const branchId = useWatch({ control: form.control, name: 'branchId' });
  const retained = user.roleKeys.filter((key) => !presets.some((preset) => preset.key === key));
  const needsBranch = selected.some((key) => BRANCH_SCOPED.includes(key));

  // Shown live so the administrator sees the consequence of the change, not just its name.
  const effective = [...new Set(presets.filter((preset) => selected.includes(preset.key)).flatMap((preset) => preset.permissions))].sort();

  return (
    <form
      className={styles.drawerForm}
      onSubmit={form.handleSubmit(async (body) => {
        await mutation.mutateAsync({ id: user.id, body }).then(saved, () => undefined);
      })}
      aria-busy={mutation.isPending}
    >
      <DrawerBody>
        <fieldset disabled={mutation.isPending || mutation.isError} className={styles.drawerFields}>
          <legend className="noa-visually-hidden">{t('assignRoles')}</legend>

          <DrawerCard title={t('branch')}>
            <Controller
              control={form.control}
              name="branchId"
              render={({ field }) => (
                <Select
                  label={t('branch')}
                  labelHidden
                  hint={t('branchHint')}
                  value={field.value ?? 'none'}
                  onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                  options={[
                    { value: 'none', label: t('branchNone') },
                    ...branches.map((branch) => ({
                      value: branch.id,
                      label: `${branch.code} - ${branch.name}`,
                    })),
                  ]}
                />
              )}
            />
            {needsBranch && !branchId && <p role="alert" className={styles.error}>{t('branchRequired')}</p>}
          </DrawerCard>

          <DrawerCard title={t('roles')}>
            <Controller
              control={form.control}
              name="roleKeys"
              render={({ field }) => (
                <div className={styles.roleList}>
                  {presets.map((preset) => {
                    const checked = field.value.includes(preset.key);
                    const locked = self && user.roleKeys.includes(preset.key);
                    return (
                      <div key={preset.key} className={`${styles.roleRow} ${checked ? styles.roleRowOn : ''}`}>
                        <Checkbox
                          label={accessLabel(t, roleLabels, preset.key, 'unknownRole')}
                          checked={checked}
                          disabled={locked}
                          onCheckedChange={(next) =>
                            field.onChange(next === true
                              ? [...field.value, preset.key]
                              : field.value.filter((key) => key !== preset.key))
                          }
                        />
                        <p>{t(`desc_${preset.key}`)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            />
            {self && <p className={styles.callout}>{t('selfProtection')}</p>}
            {retained.length > 0 && (
              <p className={styles.callout}>
                {t('unchangedRoles')}: {retained.map((key) => accessLabel(t, roleLabels, key, 'unknownRole')).join(', ')}
              </p>
            )}
          </DrawerCard>

          <DrawerCard title={`${t('effective')} (${effective.length})`}>
            {effective.length === 0 ? (
              <p className={styles.muted}>{t('none')}</p>
            ) : (
              <ul className={styles.chips}>
                {effective.map((permission) => (
                  <li key={permission}>{accessLabel(t, permissionLabels, permission, 'unknownPermission')}</li>
                ))}
              </ul>
            )}
          </DrawerCard>

          <DrawerCard>
            <Input label={t('reason')} maxLength={400} required {...form.register('reason')} />
            {Object.keys(form.formState.errors).length > 0 && <p role="alert" className={styles.error}>{t('validation')}</p>}
            {mutation.error && <p role="alert" className={styles.error}>{t(errorKey(mutation.error))}</p>}
          </DrawerCard>
        </fieldset>
      </DrawerBody>

      <DrawerFooter>
        <Button type="button" variant="outline" disabled={mutation.isPending} onClick={close}>{t('cancel')}</Button>
        <Button type="submit" iconLeft={<Save aria-hidden="true" size={16} />} loading={mutation.isPending} disabled={!form.formState.isDirty || mutation.isError || (needsBranch && !branchId)}>
          {t(mutation.isPending ? 'saving' : 'save')}
        </Button>
      </DrawerFooter>
    </form>
  );
}

/**
 * Hands someone a one-time link to choose a password, for staff the company's Microsoft
 * sign-in does not cover. The link is shown once and never stored, so losing it means
 * issuing another - which is why this stays available after the first one.
 */
function AccessLinkDialog({ user, close }: { user: StaffUser; close: () => void }) {
  const { t } = useTranslation('staff');
  const mutation = useIssueStaffAccessLink();
  const [reason, setReason] = useState('');
  const [copied, setCopied] = useState(false);
  const issued = mutation.data;

  return (
    <form
      className={styles.drawerForm}
      onSubmit={(event) => {
        event.preventDefault();
        void mutation.mutateAsync({ id: user.id, reason }).catch(() => undefined);
      }}
      aria-busy={mutation.isPending}
    >
      <DrawerBody>
        <DrawerCard>
          <p>{t('accessLinkIntro', { name: user.displayName })}</p>
          {issued ? (
            <>
              <p>{t(issued.link ? 'accessLinkReady' : 'accessLinkEmailed')}</p>
              {issued.link ? (
                <>
                  <Code>{issued.link}</Code>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { void navigator.clipboard.writeText(issued.link ?? '').then(() => setCopied(true)); }}
                  >
                    {t(copied ? 'accessLinkCopied' : 'accessLinkCopy')}
                  </Button>
                </>
              ) : null}
              <p className={styles.muted}>{t('accessLinkExpires', { date: formatDateTime(issued.expiresAt) })}</p>
            </>
          ) : (
            <Input
              label={t('accessLinkReason')}
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
          {mutation.isError ? <p className={styles.error}>{t(errorKey(mutation.error))}</p> : null}
        </DrawerCard>
      </DrawerBody>

      <DrawerFooter>
        <Button type="button" variant="outline" onClick={close}>{t(issued ? 'close' : 'cancel')}</Button>
        {issued ? null : (
          <Button type="submit" iconLeft={<KeyRound aria-hidden="true" size={16} />} loading={mutation.isPending} disabled={reason.trim().length === 0}>
            {t('accessLinkCreate')}
          </Button>
        )}
      </DrawerFooter>
    </form>
  );
}

export default function StaffPage() {
  const { t } = useTranslation('staff');
  const actor = useOutletContext<components['schemas']['CurrentUserDto']>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<StaffUser | null>(null);
  const [access, setAccess] = useState<StaffUser | null>(null);
  const [saved, setSaved] = useState(false);
  const staff = useStaff(search, page, pageSize);
  const presets = useStaffPresets();
  const branches = useStaffBranches();
  const canManage = actor.permissions.includes('admin.staff.roles.manage');


  const items = staff.data?.items ?? [];
  const total = staff.data?.total ?? 0;

  const columns = [
    {
      key: 'person',
      label: t('person'),
      render: (user: StaffUser) => (
        <div className={styles.personCell}>
          <span
            className={`${styles.avatar} ${user.permissions.includes('admin.staff.roles.manage') ? styles.avatarAdmin : ''}`}
            aria-hidden="true"
          >
            {initials(user.displayName, user.email)}
          </span>
          <div className={styles.person}>
            <strong>{user.displayName}</strong>
            <span>{user.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'roles',
      label: t('roles'),
      render: (user: StaffUser) => (
        <div className={styles.badges}>
          {user.roleKeys.length > 0
            ? user.roleKeys.map((key) => <Badge key={key}>{accessLabel(t, roleLabels, key, 'unknownRole')}</Badge>)
            : <span className={styles.muted}>{t('none')}</span>}
        </div>
      ),
    },
    {
      key: 'branch',
      label: t('branch'),
      render: (user: StaffUser) => user.branch ? (
        <div className={styles.person}>
          <strong>{user.branch.code}</strong>
          <span>{user.branch.city ?? user.branch.name}</span>
        </div>
      ) : <span className={styles.muted}>{t('branchNone')}</span>,
    },
    {
      key: 'status',
      label: t('status'),
      render: (user: StaffUser) => <Badge tone={statusTone[user.status] ?? 'neutral'}>{t(user.status)}</Badge>,
    },
    {
      key: 'lastLogin',
      label: t('lastSignIn'),
      render: (user: StaffUser) => (
        <span className={styles.muted}>{formatDate(user.lastLoginAt) ?? t('never')}</span>
      ),
    },
    {
      key: 'signIn',
      label: t('signInMethod'),
      render: (user: StaffUser) => {
        // Microsoft first: most staff use it, and they need nothing from this screen.
        if (user.usesSso) return <Badge tone="info">{t('signInSso')}</Badge>;
        if (user.security?.hasPassword) return <Badge tone="success">{t('signInPassword')}</Badge>;
        if (user.security?.pendingActivationLink) {
          return (
            <div className={styles.person}>
              <Badge tone="warning">{t('signInLinkPending')}</Badge>
              <span className={styles.muted}>{t('accessLinkExpires', { date: formatDateTime(user.security.pendingLinkExpiresAt) })}</span>
            </div>
          );
        }
        return <span className={styles.muted}>{t('signInNone')}</span>;
      },
    },
    {
      key: 'actions',
      label: t('actions'),
      render: (user: StaffUser) => canManage ? (
        <div className={styles.rowActions}>
          <Button
            variant="quiet"
            size="sm"
            aria-label={t('editPerson', { name: user.displayName })}
            iconLeft={<UserRoundCog aria-hidden="true" size={16} />}
            disabled={!presets.data?.length || staff.isFetching}
            onClick={() => { setSelected(user); setSaved(false); }}
          >
            {t('edit')}
          </Button>
          {/* Microsoft accounts need no password, so the link is not offered for them. */}
          {user.security && !user.usesSso ? (
            <Button
              variant="quiet"
              size="sm"
              aria-label={t('accessLinkFor', { name: user.displayName })}
              iconLeft={<KeyRound aria-hidden="true" size={16} />}
              disabled={staff.isFetching}
              onClick={() => setAccess(user)}
            >
              {t(user.security.hasPassword ? 'accessLinkReset' : 'accessLinkInvite')}
            </Button>
          ) : null}
        </div>
      ) : null,
    },
  ];

  return (
    <section className={styles.page}>
      <Breadcrumb items={[{ label: t('navGroup_operating') }, { label: t('nav_staff') }]} />
      <SectionHeading as="h1" size="lg" title={t('nav_staff')} description={t('description')} />

      <div className={styles.panel}>
        {saved && <p role="status" className={styles.saved}>{t('saved')}</p>}

        {/*
          * The staff directory carries no filters: its endpoint accepts a search
          * term and a page, nothing else. The Filters button stays, disabled, so
          * the toolbar keeps the same shape as every other list in the product.
          */}
        <ListingGrid
          caption={t('title')}
          columns={columns}
          rows={items}
          rowKey={(user: StaffUser) => user.id}
          total={total}
          page={page}
          pageSize={pageSize}
          /* This endpoint caps the page at 50, unlike the others at 100. */
          pageSizeOptions={[10, 25, 50]}
          onPageChange={(next) => { setSelected(null); setPage(next); }}
          onPageSizeChange={(size) => { setSelected(null); setPageSize(size); setPage(1); }}
          search={search}
          onSearchChange={(value) => { setSearch(value.trim()); setPage(1); }}
          renderCard={(user: StaffUser) => (
            <>
              <header>
                <div>
                  <strong>{user.displayName}</strong>
                  <Code tone="muted">{user.email}</Code>
                </div>
                {user.branch ? <Badge tone="neutral">{user.branch.code}</Badge> : null}
              </header>
              <div className="noa-row">
                <span>{user.roleKeys.map((role) => t(roleLabels[role] ?? 'unknownRole')).join(' · ') || '—'}</span>
                {canManage ? (
                  <Button size="sm" variant="quiet" onClick={() => setSelected(user)}>{t('edit')}</Button>
                ) : null}
              </div>
            </>
          )}
          isPending={staff.isPending || presets.isPending}
          isFetching={staff.isFetching}
          error={staff.error ?? presets.error}
          onRetry={() => { setSelected(null); void staff.refetch(); void presets.refetch(); void branches.refetch(); }}
          actions={
            <Button
              variant="outline"
              iconLeft={<RefreshCw aria-hidden="true" size={16} />}
              onClick={() => { setSelected(null); void staff.refetch(); void presets.refetch(); void branches.refetch(); }}
            >
              {t('retry')}
            </Button>
          }
          searchLabel={t('search')}
          emptyLabel={t('empty')}
          emptyFilteredLabel={t('noMatches')}
          errorLabel={
            staff.error || presets.error ? t(errorKey(staff.error ?? presets.error)) : undefined
          }
        />
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        {selected && (
          <DialogContent side="right" closeLabel={t('close')}>
            <DrawerHeader>
              <DialogTitle>{t('rolesFor', { name: selected.displayName })}</DialogTitle>
              <DialogDescription>{selected.email} · {t('rolesNote')}</DialogDescription>
            </DrawerHeader>
            <RoleDrawer
              key={`${selected.id}:${selected.updatedAt}`}
              user={selected}
              presets={presets.data ?? []}
              branches={branches.data ?? []}
              actorId={actor.userId}
              close={() => setSelected(null)}
              saved={() => { setSelected(null); setSaved(true); }}
            />
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={access !== null} onOpenChange={(open) => { if (!open) setAccess(null); }}>
        {access && (
          <DialogContent side="right" closeLabel={t('close')}>
            <DrawerHeader>
              <DialogTitle>{t(access.security?.hasPassword ? 'accessLinkResetTitle' : 'accessLinkInviteTitle', { name: access.displayName })}</DialogTitle>
              <DialogDescription>{access.email}</DialogDescription>
            </DrawerHeader>
            <AccessLinkDialog key={access.id} user={access} close={() => setAccess(null)} />
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
