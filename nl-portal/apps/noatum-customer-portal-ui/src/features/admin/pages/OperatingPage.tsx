import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Plus } from 'lucide-react';

import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  DrawerBody,
  DrawerCard,
  DrawerFooter,
  DrawerHeader,
  DrawerWide,
  InfoRibbon,
  Input,
  SectionHeading,
  Select,
  Tabs,
} from '../../../design-system';
import { AccessError } from '../../auth/api/current-user';
import { StaffError } from '../../staff/api/staff';
import { CustomerWriteError } from '../api/customers';
import { AdminListing } from '../components/AdminListing';
import {
  useBranches,
  useCargoWiseBranches,
  useCreateBranch,
  useCreateRegion,
  useRegions,
  useUpdateBranch,
  useUpdateRegion,
  type Branch,
  type CargoWiseBranch,
  type Region,
} from '../api/operating';
import { Breadcrumb } from '../../../shared/components/Breadcrumb';
import admin from './AdminPage.module.css';
import customers from './CustomersPage.module.css';
import styles from './OperatingPage.module.css';

function errorKey(error: unknown) {
  return error instanceof StaffError ? error.kind : error instanceof AccessError ? 'denied' : 'unavailable';
}

/** Radix reserves the empty string, so "any" and "none" need names of their own. */
const ALL_REGIONS = 'all';
const NO_REGION = 'none';

/** A refusal carries a code; turn it into a sentence rather than a raw status. */
function writeMessage(t: TFunction<'staff'>, error: unknown): string {
  if (error instanceof CustomerWriteError) {
    const map: Record<string, string> = {
      REGION_CODE_TAKEN: 'opErrCodeTaken',
      BRANCH_CODE_TAKEN: 'opErrCodeTaken',
      BRANCH_IN_USE: 'opErrInUse',
      STALE_REGION: 'opErrStale',
      STALE_BRANCH: 'opErrStale',
      REGION_UNAVAILABLE: 'opErrRegion',
      DENIED: 'denied',
    };
    const key = map[error.code];
    return key ? t(key) : error.message || t('unavailable');
  }
  return t('unavailable');
}

function FilterGroup<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: [T, string][];
}) {
  return (
    <div className={customers.filters} role="group" aria-label={label}>
      {options.map(([option, text]) => (
        <Button key={option} size="sm" variant={value === option ? 'primary' : 'outline'} onClick={() => onChange(option)}>
          {text}
        </Button>
      ))}
    </div>
  );
}

export function OperatingPage() {
  const { t } = useTranslation('staff');
  const [tab, setTab] = useState('regions');

  return (
    <section className={admin.page}>
      <Breadcrumb items={[{ label: t('navGroup_operating') }, { label: t('nav_branches') }]} />
      <InfoRibbon
        heading={<SectionHeading as="h1" size="lg" title={t('nav_branches')} />}
        label={t('aboutThisPage')}
        closeLabel={t('hideGuidance')}
      >
        <p>{t('opIntro')}</p>
        <p>{t('opIntro2')}</p>
      </InfoRibbon>

      <div className={admin.panel}>
        <Tabs
          ariaLabel={t('nav_branches')}
          value={tab}
          onChange={setTab}
          items={[
            { id: 'regions', label: t('opTabRegions'), content: <RegionsPanel /> },
            { id: 'branches', label: t('opTabBranches'), content: <BranchesPanel /> },
            { id: 'cargowise', label: t('cwTab'), content: <CargoWisePanel /> },
          ]}
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

function RegionsPanel() {
  const { t } = useTranslation('staff');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [drawer, setDrawer] = useState<Region | 'new' | null>(null);
  const regions = useRegions({ search: search.trim(), status, page, pageSize });

  const columns = useMemo(
    () => [
      { key: 'code', label: t('opCode'), render: (row: Region) => <span className={styles.code}>{row.code}</span> },
      { key: 'name', label: t('opName'), render: (row: Region) => row.name },
      { key: 'branches', label: t('opRegionBranches'), render: (row: Region) => row.branchCount },
      {
        key: 'status',
        label: t('opStatus'),
        render: (row: Region) =>
          row.isActive ? <Badge tone="success">{t('opActiveLabel')}</Badge> : <Badge tone="neutral">{t('opInactiveLabel')}</Badge>,
      },
      {
        key: 'actions',
        label: t('opActions'),
        render: (row: Region) => (
          <Button variant="outline" size="sm" onClick={() => setDrawer(row)}>
            {t('opEdit')}
          </Button>
        ),
      },
    ],
    [t],
  );

  return (
    <>
      <div className={customers.toolbar}>
        <Input
          label={t('opSearch')}
          labelHidden
          type="search"
          placeholder={t('opRegionSearchHint')}
          maxLength={200}
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          className={customers.search}
        />
        <FilterGroup
          label={t('opStatus')}
          value={status}
          onChange={(value) => { setStatus(value); setPage(1); }}
          options={[['all', t('opStatusAll')], ['active', t('opActiveLabel')], ['inactive', t('opInactiveLabel')]]}
        />
        <Button iconLeft={<Plus aria-hidden size={16} />} onClick={() => setDrawer('new')}>
          {t('opNewRegion')}
        </Button>
      </div>
      <AdminListing
        caption={t('opTabRegions')}
        columns={columns}
        rows={regions.data?.items ?? []}
        rowKey={(row: Region) => row.id}
        total={regions.data?.total ?? 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        isPending={regions.isPending}
        error={regions.error}
        emptyLabel={regions.error ? t(errorKey(regions.error)) : t('opRegionsEmpty')}
      />
      <RegionDrawer
        key={drawer === 'new' ? 'new' : drawer?.id ?? 'closed'}
        open={drawer !== null}
        region={drawer === 'new' ? null : drawer}
        onClose={() => setDrawer(null)}
      />
    </>
  );
}

function RegionDrawer({ open, region, onClose }: { open: boolean; region: Region | null; onClose: () => void }) {
  const { t } = useTranslation('staff');
  const create = useCreateRegion();
  const update = useUpdateRegion();
  const [code, setCode] = useState(region?.code ?? '');
  const [name, setName] = useState(region?.name ?? '');
  const [isActive, setIsActive] = useState(region?.isActive ?? true);
  const mutation = region ? update : create;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (region) await update.mutateAsync({ id: region.id, body: { name: name.trim(), isActive, updatedAt: region.updatedAt } });
      else await create.mutateAsync({ code: code.trim().toUpperCase(), name: name.trim() });
      onClose();
    } catch {
      // Surfaced through mutation.error below.
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent side="right" closeLabel={t('opClose')}>
        <DrawerHeader>
          <DialogTitle>{region ? t('opEditRegion') : t('opNewRegion')}</DialogTitle>
          <p className={styles.hint}>{t('opRegionFormHint')}</p>
        </DrawerHeader>
        <form className={styles.drawerForm} onSubmit={submit} aria-busy={mutation.isPending}>
          <DrawerBody>
            <DrawerCard columns={2}>
              {region ? (
                <DrawerWide>
                  <p className={styles.hint}>{t('opCodeReadonly')}: <span className={styles.code}>{region.code}</span></p>
                </DrawerWide>
              ) : (
                <Input label={t('opCode')} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={20} required />
              )}
              <Input label={t('opName')} value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
              {region ? (
                <DrawerWide>
                  <Checkbox label={t('opActive')} checked={isActive} onCheckedChange={(checked) => setIsActive(checked === true)} />
                </DrawerWide>
              ) : null}
              {mutation.error ? (
                <DrawerWide>
                  <p role="alert" className={styles.error}>{writeMessage(t, mutation.error)}</p>
                </DrawerWide>
              ) : null}
            </DrawerCard>
          </DrawerBody>
          <DrawerFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('opCancel')}</Button>
            <Button type="submit" loading={mutation.isPending}>{region ? t('opSave') : t('opCreate')}</Button>
          </DrawerFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

function BranchesPanel() {
  const { t } = useTranslation('staff');
  const [search, setSearch] = useState('');
  const [regionId, setRegionId] = useState(ALL_REGIONS);
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [mapped, setMapped] = useState<'all' | 'mapped' | 'unmapped'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [drawer, setDrawer] = useState<Branch | 'new' | null>(null);

  const regions = useRegions({ search: '', status: 'active', page: 1, pageSize: 100 });
  const regionOptions = regions.data?.items ?? [];
  const branches = useBranches({ search: search.trim(), regionId: regionId === ALL_REGIONS ? undefined : regionId, status, mapped, page, pageSize });

  const columns = useMemo(
    () => [
      { key: 'code', label: t('opCode'), render: (row: Branch) => <span className={styles.code}>{row.code}</span> },
      { key: 'name', label: t('opName'), render: (row: Branch) => row.name },
      { key: 'region', label: t('opBranchRegion'), render: (row: Branch) => (row.regionName ? <Badge>{row.regionName}</Badge> : '—') },
      { key: 'where', label: t('opBranchCountry'), render: (row: Branch) => [row.city, row.countryCode].filter(Boolean).join(' · ') || '—' },
      {
        key: 'mapping',
        label: t('opBranchMapping'),
        render: (row: Branch) => <span className={styles.mapping}>{row.sourceBranchCode ?? t('opUnmapped')}</span>,
      },
      { key: 'staff', label: t('opBranchStaff'), render: (row: Branch) => row.staffCount },
      {
        key: 'status',
        label: t('opStatus'),
        render: (row: Branch) =>
          row.isActive ? <Badge tone="success">{t('opActiveLabel')}</Badge> : <Badge tone="neutral">{t('opInactiveLabel')}</Badge>,
      },
      {
        key: 'actions',
        label: t('opActions'),
        render: (row: Branch) => (
          <Button variant="outline" size="sm" onClick={() => setDrawer(row)}>
            {t('opEdit')}
          </Button>
        ),
      },
    ],
    [t],
  );

  return (
    <>
      <div className={customers.toolbar}>
        <Input
          label={t('opSearch')}
          labelHidden
          type="search"
          placeholder={t('opBranchSearchHint')}
          maxLength={200}
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          className={customers.search}
        />
        <Select
          label={t('opRegion')}
          value={regionId}
          onValueChange={(value) => { setRegionId(value); setPage(1); }}
          options={[{ value: ALL_REGIONS, label: t('opRegionAll') }, ...regionOptions.map((region) => ({ value: region.id, label: `${region.code} — ${region.name}` }))]}
        />
        <FilterGroup
          label={t('opStatus')}
          value={status}
          onChange={(value) => { setStatus(value); setPage(1); }}
          options={[['all', t('opStatusAll')], ['active', t('opActiveLabel')], ['inactive', t('opInactiveLabel')]]}
        />
        <FilterGroup
          label={t('opBranchMapping')}
          value={mapped}
          onChange={(value) => { setMapped(value); setPage(1); }}
          options={[['all', t('opStatusAll')], ['mapped', t('opMapped')], ['unmapped', t('opUnmapped')]]}
        />
        <Button iconLeft={<Plus aria-hidden size={16} />} onClick={() => setDrawer('new')}>
          {t('opNewBranch')}
        </Button>
      </div>
      <AdminListing
        caption={t('opTabBranches')}
        columns={columns}
        rows={branches.data?.items ?? []}
        rowKey={(row: Branch) => row.id}
        total={branches.data?.total ?? 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        isPending={branches.isPending}
        error={branches.error}
        emptyLabel={branches.error ? t(errorKey(branches.error)) : t('opBranchesEmpty')}
      />
      <BranchDrawer
        key={drawer === 'new' ? 'new' : drawer?.id ?? 'closed'}
        open={drawer !== null}
        branch={drawer === 'new' ? null : drawer}
        regions={regionOptions}
        onClose={() => setDrawer(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// CargoWise ControllingBranch discovery
// ---------------------------------------------------------------------------

function CargoWisePanel() {
  const { t } = useTranslation('staff');
  const [mapped, setMapped] = useState<'all' | 'mapped' | 'unmapped'>('all');
  const [seed, setSeed] = useState<{ code: string; sourceBranchCode: string } | null>(null);

  const discovery = useCargoWiseBranches(mapped);
  const regions = useRegions({ search: '', status: 'active', page: 1, pageSize: 100 });
  const regionOptions = regions.data?.items ?? [];

  const columns = useMemo(
    () => [
      { key: 'code', label: t('cwCode'), render: (row: CargoWiseBranch) => <span className={styles.code}>{row.cw1Code}</span> },
      { key: 'orgs', label: t('cwOrgCount'), render: (row: CargoWiseBranch) => row.organisationCount },
      {
        key: 'mapped',
        label: t('cwPortalBranch'),
        render: (row: CargoWiseBranch) =>
          row.mappedBranchId ? <Badge tone="success">{row.mappedBranchCode}</Badge> : <Badge tone="warning">{t('cwUnmappedLabel')}</Badge>,
      },
      {
        key: 'actions',
        label: t('opActions'),
        render: (row: CargoWiseBranch) =>
          row.mappedBranchId ? (
            <span className={styles.mapping}>{row.mappedBranchName}</span>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setSeed({ code: row.cw1Code, sourceBranchCode: row.cw1Code })}>
              {t('cwCreateBranch')}
            </Button>
          ),
      },
    ],
    [t],
  );

  return (
    <>
      <p className={styles.hint}>{t('cwIntro')}</p>
      <div className={customers.toolbar}>
        <FilterGroup
          label={t('opBranchMapping')}
          value={mapped}
          onChange={setMapped}
          options={[['all', t('opStatusAll')], ['mapped', t('opMapped')], ['unmapped', t('opUnmapped')]]}
        />
      </div>
      <AdminListing
        caption={t('cwTab')}
        columns={columns}
        rows={discovery.data?.items ?? []}
        rowKey={(row: CargoWiseBranch) => row.cw1Code}
        total={discovery.data?.total ?? 0}
        page={1}
        pageSize={100}
        onPageChange={() => undefined}
        isPending={discovery.isPending}
        error={discovery.error}
        emptyLabel={discovery.error ? t(errorKey(discovery.error)) : t('cwEmpty')}
      />
      <BranchDrawer
        key={seed?.sourceBranchCode ?? 'closed'}
        open={seed !== null}
        branch={null}
        seed={seed ?? undefined}
        regions={regionOptions}
        onClose={() => setSeed(null)}
      />
    </>
  );
}

function BranchDrawer({ open, branch, regions, seed, onClose }: { open: boolean; branch: Branch | null; regions: Region[]; seed?: { code?: string; sourceBranchCode?: string }; onClose: () => void }) {
  const { t } = useTranslation('staff');
  const create = useCreateBranch();
  const update = useUpdateBranch();
  const [code, setCode] = useState(branch?.code ?? seed?.code ?? '');
  const [name, setName] = useState(branch?.name ?? '');
  const [city, setCity] = useState(branch?.city ?? '');
  const [countryCode, setCountryCode] = useState(branch?.countryCode ?? '');
  const [regionId, setRegionId] = useState(branch?.regionId ?? NO_REGION);
  const [sourceBranchCode, setSourceBranchCode] = useState(branch?.sourceBranchCode ?? seed?.sourceBranchCode ?? '');
  const [isActive, setIsActive] = useState(branch?.isActive ?? true);
  const mutation = branch ? update : create;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const shared = {
      name: name.trim(),
      city: city.trim() || null,
      countryCode: countryCode.trim().toUpperCase() || null,
      regionId: regionId === NO_REGION ? null : regionId,
      sourceBranchCode: sourceBranchCode.trim() || null,
    };
    try {
      if (branch) await update.mutateAsync({ id: branch.id, body: { ...shared, isActive, updatedAt: branch.updatedAt } });
      else await create.mutateAsync({ code: code.trim().toUpperCase(), ...shared });
      onClose();
    } catch {
      // Surfaced through mutation.error below.
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent side="right" closeLabel={t('opClose')}>
        <DrawerHeader>
          <DialogTitle>{branch ? t('opEditBranch') : t('opNewBranch')}</DialogTitle>
          <p className={styles.hint}>{t('opBranchFormHint')}</p>
        </DrawerHeader>
        <form className={styles.drawerForm} onSubmit={submit} aria-busy={mutation.isPending}>
          <DrawerBody>
            <DrawerCard title={t('opIdentity')} columns={2}>
              {branch ? (
                <DrawerWide>
                  <p className={styles.hint}>{t('opCodeReadonly')}: <span className={styles.code}>{branch.code}</span></p>
                </DrawerWide>
              ) : (
                <Input label={t('opCode')} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={40} required />
              )}
              <Input label={t('opName')} value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required />
              <Input label={t('opCity')} value={city} onChange={(event) => setCity(event.target.value)} maxLength={120} />
              <Input label={t('opCountry')} value={countryCode} onChange={(event) => setCountryCode(event.target.value.toUpperCase())} maxLength={2} />
            </DrawerCard>

            <DrawerCard title={t('opPlacement')} columns={2}>
              <Select
                label={t('opRegion')}
                value={regionId}
                onValueChange={setRegionId}
                options={[{ value: NO_REGION, label: t('opNoRegion') }, ...regions.map((region) => ({ value: region.id, label: `${region.code} — ${region.name}` }))]}
              />
              <Input label={t('opSourceBranch')} value={sourceBranchCode} onChange={(event) => setSourceBranchCode(event.target.value)} maxLength={40} hint={t('opSourceBranchHint')} />
              {branch ? (
                <DrawerWide>
                  <Checkbox label={t('opActive')} checked={isActive} onCheckedChange={(checked) => setIsActive(checked === true)} />
                </DrawerWide>
              ) : null}
              {mutation.error ? (
                <DrawerWide>
                  <p role="alert" className={styles.error}>{writeMessage(t, mutation.error)}</p>
                </DrawerWide>
              ) : null}
            </DrawerCard>
          </DrawerBody>
          <DrawerFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('opCancel')}</Button>
            <Button type="submit" loading={mutation.isPending}>{branch ? t('opSave') : t('opCreate')}</Button>
          </DrawerFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
