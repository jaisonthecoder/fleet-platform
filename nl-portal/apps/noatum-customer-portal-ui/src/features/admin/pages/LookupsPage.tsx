import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Pencil, Plus, Search, Tag } from 'lucide-react';
import {
  Badge, Button, Checkbox, DataTable, Dialog, DialogContent, DialogTitle,
  DrawerBody, DrawerCard, DrawerFooter, DrawerHeader,
  Input, Pagination, SectionHeading, Select, StatePanel,
} from '../../../design-system';
import { AccessError } from '../../auth/api/current-user';
import { StaffError } from '../../staff/api/staff';
import {
  useCreateLookupCategory, useCreateLookupItem, useLookupCategories,
  useLookupItems, useLookupParentOptions, useUpdateLookupCategory, useUpdateLookupItem,
  type LookupCategory, type LookupItem, type LookupItemFilters, type LookupTranslation,
  type LookupWriteError,
} from '../api/lookups';
import { Breadcrumb } from '../../../shared/components/Breadcrumb';
import { useFeature } from '../../../shared/features/useFeature';
import admin from './AdminPage.module.css';
import styles from './LookupsPage.module.css';

const EN = 'en-US' as const;
const ES = 'es-ES' as const;
const SELF = '__self__';

function errorKey(error: unknown) {
  return error instanceof StaffError ? error.kind : error instanceof AccessError ? 'denied' : 'unavailable';
}

const labelIn = (item: LookupItem, locale: string) =>
  item.translations.find((entry) => entry.locale === locale)?.label ?? '';
const descriptionIn = (item: LookupItem, locale: string) =>
  item.translations.find((entry) => entry.locale === locale)?.description ?? '';

/**
 * The notes field accepts JSON or prose. Prose is wrapped so the column stays
 * a JSON object, and unwrapped again when the record is reopened.
 */
function parseNotes(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch { /* not JSON, so it is a note */ }
  return { note: trimmed };
}

function formatNotes(metadata: Record<string, unknown> | null | undefined): string {
  if (!metadata) return '';
  const keys = Object.keys(metadata);
  if (keys.length === 1 && keys[0] === 'note' && typeof metadata.note === 'string') return metadata.note;
  return JSON.stringify(metadata, null, 2);
}

/** Left rail: every list, with the one being edited marked. */
function TypeRail({
  categories, selected, onSelect, onCreate,
}: {
  categories: LookupCategory[];
  selected: string | null;
  onSelect: (code: string) => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation('staff');
  // Same key the API's @RequireFeature enforces, so the button cannot offer a 403.
  const canCreateType = useFeature('lookups.type_creation');
  return (
    <nav className={styles.rail} aria-label={t('lookupTypes')}>
      <div className={styles.railHeader}>
        <span className={styles.railTitle}>{t('lookupTypes')}</span>
        {canCreateType ? (
          <Button variant="outline" size="sm" iconLeft={<Plus aria-hidden="true" size={14} />} onClick={onCreate}>
            {t('lookupNewType')}
          </Button>
        ) : null}
      </div>
      <ul className={styles.railList}>
        {categories.map((category) => (
          <li key={category.id} className={styles.railItem}>
            <button
              type="button"
              className={styles.railButton}
              aria-current={category.code === selected}
              onClick={() => onSelect(category.code)}
            >
              <Tag aria-hidden="true" size={14} />
              <span className={styles.railName}>{category.name}</span>
              {/* Says which lists can be maintained before the pane is opened,
                  rather than leaving a disabled screen to explain itself. */}
              {!category.isActive ? (
                <span className={styles.railFlag}>{t('inactive')}</span>
              ) : !category.canEditContent ? (
                <span className={styles.railFlag} title={t(`lookupOwnership_${category.ownership}`)}>
                  {category.ownership === 'source' ? t('lookupFlagSrc') : t('lookupFlagSys')}
                </span>
              ) : null}
              <span className={styles.railCode}>{category.code}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const DEFAULT_FILTERS: LookupItemFilters = { search: '', status: 'all', visibility: 'all', page: 1, pageSize: 50 };

export function LookupsPage() {
  const { t } = useTranslation('staff');
  const [params, setParams] = useSearchParams();
  const categories = useLookupCategories();

  const selected = params.get('category');
  const [filters, setFilters] = useState<LookupItemFilters>(DEFAULT_FILTERS);
  const [typeDrawer, setTypeDrawer] = useState<'create' | 'edit' | null>(null);
  const [valueDrawer, setValueDrawer] = useState<{ mode: 'create' } | { mode: 'edit'; item: LookupItem } | null>(null);

  // Open on a list that can actually be maintained. Landing on a source-owned
  // list shows a screen where every control is correctly disabled, which reads
  // as a broken page rather than as a rule.
  useEffect(() => {
    if (selected || !categories.data?.length) return;
    const opening = categories.data.find((entry) => entry.canEditContent) ?? categories.data[0];
    if (opening) setParams({ category: opening.code }, { replace: true });
  }, [selected, categories.data, setParams]);

  const items = useLookupItems(selected, filters);
  const category = items.data?.category;
  const update = (change: Partial<LookupItemFilters>) =>
    setFilters((current) => ({ ...current, page: 1, ...change }));

  const selectCategory = (code: string) => {
    setFilters(DEFAULT_FILTERS);
    setParams({ category: code });
  };

  const total = items.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
  const first = total === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1;
  const last = Math.min(total, filters.page * filters.pageSize);
  const nextSortOrder = (items.data?.items.at(-1)?.sortOrder ?? 0) + 10;

  const columns = useMemo(() => [
    {
      key: 'code',
      label: t('lookupCode'),
      render: (item: LookupItem) => (
        <span className={styles.codeCell}>
          {item.code}
          {category && !category.canEditContent && (
            <span className={styles.ownerFlag} title={t(`lookupOwnership_${category.ownership}`)}>
              {category.ownership === 'source' ? t('lookupFlagSrc') : t('lookupFlagSys')}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'label',
      label: t('lookupLabel'),
      render: (item: LookupItem) => labelIn(item, EN) || <span className={styles.missing}>{t('lookupNoLabel')}</span>,
    },
    {
      key: 'descriptionEn',
      label: t('lookupDescriptionEn'),
      render: (item: LookupItem) => descriptionIn(item, EN) || <span className={styles.missing}>—</span>,
    },
    {
      key: 'labelEs',
      label: t('lookupLabelEs'),
      render: (item: LookupItem) => labelIn(item, ES) || <span className={styles.missing}>{t('lookupNoLabel')}</span>,
    },
    {
      key: 'parent',
      label: t('lookupParent'),
      render: (item: LookupItem) => item.parentLabel ?? <span className={styles.missing}>—</span>,
    },
    {
      key: 'status',
      label: t('branchStatus'),
      render: (item: LookupItem) => (
        <Badge tone={item.isActive ? 'success' : 'neutral'}>{t(item.isActive ? 'active' : 'inactive')}</Badge>
      ),
    },
    {
      key: 'reach',
      label: t('lookupVisibility'),
      render: (item: LookupItem) => (
        <Badge tone={item.isCustomerVisible ? 'info' : 'neutral'}>
          {t(item.isCustomerVisible ? 'lookupVisible_customer' : 'lookupVisible_internal')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: t('actions'),
      render: (item: LookupItem) => (
        <div className={styles.rowActions}>
          <Button
            variant="outline"
            size="sm"
            aria-label={t('lookupEditValue', { code: item.code })}
            iconLeft={<Pencil aria-hidden="true" size={14} />}
            onClick={() => setValueDrawer({ mode: 'edit', item })}
          />
        </div>
      ),
    },
  ], [t, category]);

  if (categories.error) {
    return (
      <section className={admin.page}>
        <SectionHeading as="h1" size="lg" title={t('nav_lookups')} description={t('page_lookups')} />
        <div className={admin.panel} role="alert"><StatePanel title={t(errorKey(categories.error))} /></div>
      </section>
    );
  }

  return (
    <section className={admin.page}>
      <Breadcrumb items={[{ label: t('navGroup_administration') }, { label: t('nav_lookups') }]} />
      <SectionHeading as="h1" size="lg" title={t('nav_lookups')} description={t('page_lookups')} />

      <div className={styles.workbench}>
        {categories.isPending ? (
          <div className={styles.rail} role="status"><StatePanel title={t('loading')} /></div>
        ) : (
          <TypeRail
            categories={categories.data}
            selected={selected}
            onSelect={selectCategory}
            onCreate={() => setTypeDrawer('create')}
          />
        )}

        <div className={styles.pane}>
          <div className={styles.paneHeader}>
            <div className={styles.paneTitle}>
              <h2>{category?.name ?? t('lookupSelectType')}</h2>
              <p>{category ? t('lookupSelectedType', { code: category.code }) : ''}</p>
            </div>
            {category && (
              <div className={styles.paneActions}>
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={<Pencil aria-hidden="true" size={14} />}
                  disabled={!category.canEditContent && !category.canRetire}
                  onClick={() => setTypeDrawer('edit')}
                >
                  {t('lookupEditType')}
                </Button>
                <Button
                  size="sm"
                  iconLeft={<Plus aria-hidden="true" size={14} />}
                  disabled={!category.canEditContent}
                  onClick={() => setValueDrawer({ mode: 'create' })}
                >
                  {t('lookupNewValue')}
                </Button>
              </div>
            )}
          </div>

          {category && !category.canEditContent ? (
            <p className={styles.notice}>
              {t(category.canRetire ? 'lookupSourceRetirableNotice' : 'lookupSourceNotice', {
                owner: category.sourceSystem ?? t(`lookupOwnership_${category.ownership}`),
              })}
            </p>
          ) : <span />}

          <div className={admin.toolbar}>
            <Search size={16} aria-hidden="true" />
            <Input
              className={admin.searchField}
              label={t('lookupSearchItems')}
              labelHidden
              type="search"
              maxLength={200}
              placeholder={t('lookupSearchItems')}
              value={filters.search}
              onChange={(event) => update({ search: event.target.value })}
            />
            <Select
              label={t('branchStatus')}
              labelHidden
              value={filters.status}
              onValueChange={(value) => update({ status: value as LookupItemFilters['status'] })}
              options={[
                { value: 'all', label: t('lookupAllStatuses') },
                { value: 'active', label: t('active') },
                { value: 'inactive', label: t('inactive') },
              ]}
            />
            <Select
              label={t('lookupVisibility')}
              labelHidden
              value={filters.visibility}
              onValueChange={(value) => update({ visibility: value as LookupItemFilters['visibility'] })}
              options={[
                { value: 'all', label: t('lookupAllReach') },
                { value: 'customer', label: t('lookupVisible_customer') },
                { value: 'internal', label: t('lookupVisible_internal') },
              ]}
            />
          </div>

          <div className={styles.tableScroll}>
            {items.error ? (
              <div role="alert"><StatePanel title={t(errorKey(items.error))} /></div>
            ) : !selected || items.isPending ? (
              <div role="status"><StatePanel title={t('loading')} /></div>
            ) : items.data.items.length === 0 ? (
              <StatePanel title={filters.search ? t('noMatches') : t('lookupNoValues')} />
            ) : (
              <DataTable
                caption={category?.name ?? ''}
                rows={items.data.items}
                rowKey={(item) => item.id}
                columns={columns}
              />
            )}
          </div>

          {items.data && items.data.items.length > 0 && (
            <Pagination
              label={t('page', { page: filters.page, count: pageCount })}
              rangeLabel={t('lookupShowing', { first, last, count: total })}
              page={filters.page}
              pageCount={Math.min(10000, pageCount)}
              previousLabel={t('previous')}
              nextLabel={t('next')}
              onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
              pageSize={filters.pageSize}
              pageSizeLabel={t('rows')}
              pageSizeOptions={[50, 100]}
              onPageSizeChange={(pageSize) => update({ pageSize })}
            />
          )}
        </div>
      </div>

      {typeDrawer && (
        <TypeDrawer
          mode={typeDrawer}
          category={typeDrawer === 'edit' ? category ?? null : null}
          categories={categories.data ?? []}
          onClose={() => setTypeDrawer(null)}
          onCreated={(code) => { setTypeDrawer(null); selectCategory(code); }}
        />
      )}

      {valueDrawer && category && (
        <ValueDrawer
          category={category}
          item={valueDrawer.mode === 'edit' ? valueDrawer.item : null}
          nextSortOrder={nextSortOrder}
          onClose={() => setValueDrawer(null)}
        />
      )}
    </section>
  );
}

/** Create or rename a list, in a right drawer. */
function TypeDrawer({
  mode, category, categories, onClose, onCreated,
}: {
  mode: 'create' | 'edit';
  category: LookupCategory | null;
  categories: LookupCategory[];
  onClose: () => void;
  onCreated: (code: string) => void;
}) {
  const { t } = useTranslation('staff');
  const create = useCreateLookupCategory();
  const edit = useUpdateLookupCategory();
  const pending = create.isPending || edit.isPending;
  const failure = (create.error ?? edit.error) as LookupWriteError | null;

  const [code, setCode] = useState(category?.code ?? '');
  const [name, setName] = useState(category?.name ?? '');
  const [parentType, setParentType] = useState(
    category?.parentCategoryCode === category?.code && category?.parentCategoryCode ? SELF : category?.parentCategoryCode ?? '',
  );
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0));
  const [descriptionEn, setDescriptionEn] = useState(category?.description ?? '');
  const [descriptionEs, setDescriptionEs] = useState('');
  const [notes, setNotes] = useState(formatNotes(category?.metadata));
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [reason, setReason] = useState('');

  // A list owned elsewhere keeps its wording and structure; activation and order stay ours.
  const typeLocked = mode === 'edit' && category ? !category.canEditContent : false;

  const parentOptions = [
    { value: '', label: t('lookupParentNone') },
    { value: SELF, label: t('lookupSelfNesting') },
    ...categories
      .filter((entry) => entry.code !== category?.code)
      .map((entry) => ({ value: entry.code, label: entry.name })),
  ];

  const submit = async () => {
    const parent = parentType === SELF ? (mode === 'create' ? code : category?.code ?? null) : parentType || null;
    const shared = {
      name,
      description: descriptionEn || null,
      parentCategoryCode: parent,
      sortOrder: Number(sortOrder) || 0,
      metadata: parseNotes(notes),
      reason,
    };
    if (mode === 'create') {
      const saved = await create.mutateAsync({ ...shared, code });
      onCreated(saved.code);
    } else if (category) {
      await edit.mutateAsync({ code: category.code, body: { ...shared, isActive } });
      onClose();
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent side="right" closeLabel={t('close')}>
        <DrawerHeader>
          <DialogTitle>{mode === 'create' ? t('lookupNewTypeTitle') : t('lookupEditTypeTitle', { name: category?.name })}</DialogTitle>
          <p className={styles.hint}>{mode === 'create' ? t('lookupNewTypeHint') : t('lookupSelectedType', { code: category?.code })}</p>
        </DrawerHeader>

        <DrawerBody>
          <DrawerCard>
            {failure && <p className={styles.error} role="alert">{failure.message || t('unavailable')}</p>}

            <div className={styles.formRow}>
              <Input
                label={t('lookupCode')}
                value={code}
                disabled={mode === 'edit'}
                maxLength={60}
                hint={mode === 'edit' ? t('lookupCodeLocked') : t('lookupCodeHint')}
                onChange={(event) => setCode(event.target.value)}
              />
              <Input label={t('lookupTypeName')} value={name} maxLength={120} disabled={typeLocked} onChange={(event) => setName(event.target.value)} />
            </div>

            <div className={styles.formRowSort}>
              <Select
                label={t('lookupParentType')}
                value={parentType}
                onValueChange={setParentType}
                options={parentOptions}
                disabled={typeLocked}
              />
              <Input
                label={t('lookupSort')}
                type="number"
                min={0}
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              />
            </div>

            <div className={styles.formRow}>
              <Input label={t('lookupDescriptionEn')} value={descriptionEn} maxLength={400} disabled={typeLocked} onChange={(event) => setDescriptionEn(event.target.value)} />
              <Input
                label={t('lookupDescriptionEs')}
                value={descriptionEs}
                maxLength={400}
                hint={t('lookupTypeDescriptionEsHint')}
                disabled
                onChange={(event) => setDescriptionEs(event.target.value)}
              />
            </div>

            <div>
              <span className={styles.fieldsetTitle}>{t('lookupMetadata')}</span>
              <textarea
                className={styles.notes}
                value={notes}
                placeholder={t('lookupMetadataTypePlaceholder')}
                aria-label={t('lookupMetadata')}
                disabled={typeLocked}
                onChange={(event) => setNotes(event.target.value)}
              />
              <p className={styles.hint}>{t('lookupMetadataHint')}</p>
            </div>

            <Input label={t('reason')} value={reason} maxLength={400} onChange={(event) => setReason(event.target.value)} />

            {mode === 'edit' && (
              <div className={styles.checks}>
                <Checkbox label={t('lookupActive')} checked={isActive} onCheckedChange={(value) => setIsActive(value === true)} />
              </div>
            )}
          </DrawerCard>
        </DrawerBody>

        <DrawerFooter>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
          <Button
            disabled={pending || !name.trim() || !reason.trim() || (mode === 'create' && !code.trim())}
            iconLeft={<Check aria-hidden="true" size={16} />}
            onClick={() => { void submit(); }}
          >
            {t('lookupSaveType')}
          </Button>
        </DrawerFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Create or edit one value, in both languages, in a right drawer. */
function ValueDrawer({
  category, item, nextSortOrder, onClose,
}: {
  category: LookupCategory;
  item: LookupItem | null;
  nextSortOrder: number;
  onClose: () => void;
}) {
  const { t } = useTranslation('staff');
  const create = useCreateLookupItem();
  const edit = useUpdateLookupItem();
  const pending = create.isPending || edit.isPending;
  const failure = (create.error ?? edit.error) as LookupWriteError | null;

  const hierarchical = Boolean(category.parentCategoryCode);
  const parents = useLookupParentOptions(category.code, hierarchical);

  const [code, setCode] = useState(item?.code ?? '');
  const [labelEn, setLabelEn] = useState(item ? labelIn(item, EN) : '');
  const [labelEs, setLabelEs] = useState(item ? labelIn(item, ES) : '');
  const [descriptionEn, setDescriptionEn] = useState(item ? descriptionIn(item, EN) : '');
  const [descriptionEs, setDescriptionEs] = useState(item ? descriptionIn(item, ES) : '');
  const [parentCode, setParentCode] = useState(item?.parentCode ?? '');
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? nextSortOrder));
  const [notes, setNotes] = useState(formatNotes(item?.metadata));
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [isCustomerVisible, setIsCustomerVisible] = useState(item?.isCustomerVisible ?? true);
  const [reason, setReason] = useState('');

  // Source and system lists own their words; only reach and order are ours.
  const contentLocked = !category.canEditContent;
  const owner = category.sourceSystem ?? t(`lookupOwnership_${category.ownership}`);

  const submit = async () => {
    const translations = [
      { locale: EN, label: labelEn.trim(), description: descriptionEn.trim() || null },
      ...(labelEs.trim() ? [{ locale: ES, label: labelEs.trim(), description: descriptionEs.trim() || null }] : []),
    ] satisfies LookupTranslation[];

    const shared = {
      parentCode: parentCode || null,
      sortOrder: Number(sortOrder) || 0,
      isActive,
      isCustomerVisible,
      metadata: parseNotes(notes),
      reason,
      translations,
    };

    if (item) {
      await edit.mutateAsync({ id: item.id, body: { ...shared, version: item.version } });
    } else {
      await create.mutateAsync({ code: category.code, body: { ...shared, code: code.trim() } });
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent side="right" closeLabel={t('close')}>
        <DrawerHeader>
          <DialogTitle>
            {item ? t('lookupEditValueTitle', { code: item.code }) : t('lookupNewValueTitle', { name: category.name })}
          </DialogTitle>
          <p className={styles.hint}>{t('lookupValueHint')}</p>
        </DrawerHeader>

        <DrawerBody>
          <DrawerCard>
            {failure && <p className={styles.error} role="alert">{failure.message || t('unavailable')}</p>}
            {contentLocked && (
              <p className={styles.notice}>
                {t(category.canRetire ? 'lookupLockedRetirableNotice' : 'lookupLockedNotice')}
              </p>
            )}

            <div className={styles.formRow3}>
              <Input
                label={t('lookupCode')}
                value={code}
                disabled={Boolean(item)}
                maxLength={80}
                hint={item ? t('lookupCodeLocked') : t('lookupValueCodeHint')}
                onChange={(event) => setCode(event.target.value)}
              />
              <Input label={t('lookupOwner')} value={owner} disabled hint={t('lookupOwnerHint')} onChange={() => undefined} />
              <Input label={t('lookupSort')} type="number" min={0} value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
            </div>

            <div className={styles.formRow}>
              <Input label={t('lookupLabelEn')} value={labelEn} disabled={contentLocked} maxLength={240} onChange={(event) => setLabelEn(event.target.value)} />
              <Input label={t('lookupLabelEs')} value={labelEs} disabled={contentLocked} maxLength={240} onChange={(event) => setLabelEs(event.target.value)} />
            </div>

            <div className={styles.formRow}>
              <Input label={t('lookupDescriptionEn')} value={descriptionEn} disabled={contentLocked} maxLength={600} onChange={(event) => setDescriptionEn(event.target.value)} />
              <Input label={t('lookupDescriptionEs')} value={descriptionEs} disabled={contentLocked} maxLength={600} onChange={(event) => setDescriptionEs(event.target.value)} />
            </div>

            {hierarchical && (
              <Select
                label={t('lookupParent')}
                value={parentCode}
                disabled={contentLocked}
                onValueChange={setParentCode}
                options={[
                  { value: '', label: t('lookupNoParent') },
                  ...(parents.data ?? [])
                    .filter((option) => option.id !== item?.id)
                    .map((option) => ({ value: option.code, label: `${option.code} · ${labelIn(option, EN)}` })),
                ]}
              />
            )}

            <div>
              <span className={styles.fieldsetTitle}>{t('lookupMetadata')}</span>
              <textarea
                className={styles.notes}
                value={notes}
                placeholder={t('lookupMetadataValuePlaceholder')}
                aria-label={t('lookupMetadata')}
                onChange={(event) => setNotes(event.target.value)}
              />
              <p className={styles.hint}>{t('lookupMetadataHint')}</p>
            </div>

            <Input label={t('reason')} value={reason} maxLength={400} onChange={(event) => setReason(event.target.value)} />

            <div className={styles.checks}>
              <Checkbox
                label={t('lookupActive')}
                checked={isActive}
                disabled={!category.canRetire}
                onCheckedChange={(value) => {
                  setIsActive(value === true);
                  if (value !== true) setIsCustomerVisible(false);
                }}
              />
              <Checkbox
                label={t('lookupCustomerVisibleField')}
                checked={isCustomerVisible}
                disabled={!isActive}
                onCheckedChange={(value) => setIsCustomerVisible(value === true)}
              />
            </div>
            {!category.canRetire && <p className={styles.hint}>{t('lookupRetireLocked')}</p>}
            <p className={styles.hint}>{t('lookupCustomerVisibleHint')}</p>
          </DrawerCard>
        </DrawerBody>

        <DrawerFooter>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
          <Button
            disabled={pending || !reason.trim() || !labelEn.trim() || (!item && !code.trim())}
            iconLeft={<Check aria-hidden="true" size={16} />}
            onClick={() => { void submit(); }}
          >
            {t('lookupSaveValue')}
          </Button>
        </DrawerFooter>
      </DialogContent>
    </Dialog>
  );
}
