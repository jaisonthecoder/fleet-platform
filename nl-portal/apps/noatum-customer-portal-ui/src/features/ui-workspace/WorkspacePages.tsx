import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  PanelRight,
  Save,
  RotateCcw,
  Settings2,
} from 'lucide-react';
import {
  Badge,
  Button,
  Checkbox,
  DataTable,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Input,
  Pagination,
  Select,
  StatePanel,
  Switch,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  Tooltip,
} from '@/design-system';

export function ControlsPreview() {
  const { t } = useTranslation();
  const [saved, setSaved] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [checked, setChecked] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ label: string }>({
    resolver: zodResolver(z.object({ label: z.string().trim().min(1) })),
    defaultValues: { label: '' },
  });
  return (
    <form noValidate onSubmit={handleSubmit(() => setSaved(true))} className="noa-stack">
      <section className="noa-section">
        <h2>{t('actions')}</h2>
        <div className="noa-row">
          <Button type="submit" iconLeft={<Save aria-hidden="true" />}>
            {t('save')}
          </Button>
          <Button
            variant="outline"
            iconLeft={<RotateCcw aria-hidden="true" />}
            onClick={() => {
              reset();
              setSaved(false);
              setEnabled(true);
              setChecked(false);
            }}
          >
            {t('reset')}
          </Button>
          <Button loading>{t('saving')}</Button>
          <Button disabled variant="outline">
            {t('unavailable')}
          </Button>
        </div>
      </section>
      <section className="noa-section">
        <h2>{t('fields')}</h2>
        <div className="noa-field-grid">
          <Input
            label={t('label')}
            placeholder={t('labelPlaceholder')}
            required
            hint={t('labelHint')}
            error={errors.label ? t('labelRequired') : undefined}
            {...register('label', { onChange: () => setSaved(false) })}
          />
          <Select
            label={t('density')}
            options={[
              { value: 'comfortable', label: t('comfortable') },
              { value: 'compact', label: t('compact') },
            ]}
          />
          <Input label={t('readonly')} value={t('example')} readOnly />
          <Input label={t('disabledField')} value={t('unavailable')} disabled />
        </div>
        <div className="noa-field-grid">
          <Checkbox
            label={t('choice')}
            checked={checked}
            onCheckedChange={(value) => setChecked(value === true)}
          />
          <Switch label={t('enabled')} checked={enabled} onCheckedChange={setEnabled} />
        </div>
        <div role="status">{saved ? t('saved') : null}</div>
      </section>
      <section className="noa-section">
        <h2>{t('status')}</h2>
        <div className="noa-row">
          <Badge>{t('neutral')}</Badge>
          <Badge tone="info">{t('information')}</Badge>
          <Badge tone="error">{t('error')}</Badge>
        </div>
      </section>
    </form>
  );
}

export function OverlaysPreview() {
  const { t } = useTranslation();
  const [applied, setApplied] = useState(false);
  return (
    <div className="noa-stack">
      <section className="noa-section">
        <h2>{t('overlays')}</h2>
        <div className="noa-row">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline">{t('actions')}</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => setApplied(true)}>{t('apply')}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setApplied(false)}>{t('reset')}</DropdownMenuItem>
              <DropdownMenuItem disabled>{t('unavailable')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {(['dialog', 'panel'] as const).map((kind) => (
            <Dialog key={kind}>
              <DialogTrigger asChild>
                <Button
                  variant={kind === 'dialog' ? 'primary' : 'outline'}
                  iconLeft={<PanelRight aria-hidden="true" />}
                >
                  {t(kind === 'dialog' ? 'openDialog' : 'openPanel')}
                </Button>
              </DialogTrigger>
              <DialogContent side={kind === 'panel' ? 'right' : undefined} closeLabel={t('close')}>
                <DialogTitle>{t('preferences')}</DialogTitle>
                <DialogDescription>{t('development')}</DialogDescription>
                <TabGroup defaultValue="appearance">
                  <TabList aria-label={t('preferences')}>
                    <Tab value="appearance">{t('appearance')}</Tab>
                    <Tab value="details">{t('details')}</Tab>
                  </TabList>
                  <TabPanel value="appearance" className="noa-section">
                    <Select
                      label={t('density')}
                      options={[
                        { value: 'comfortable', label: t('comfortable') },
                        { value: 'compact', label: t('compact') },
                      ]}
                    />
                  </TabPanel>
                  <TabPanel value="details" className="noa-section">
                    <Checkbox label={t('enabled')} defaultChecked />
                  </TabPanel>
                </TabGroup>
                <div className="noa-row">
                  <DialogClose asChild>
                    <Button onClick={() => setApplied(true)}>{t('apply')}</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="outline">{t('cancel')}</Button>
                  </DialogClose>
                </div>
              </DialogContent>
            </Dialog>
          ))}
          <Tooltip label={t('preferences')}>
            <button
              className="noa-icon-button"
              aria-label={t('preferences')}
              onClick={() => setApplied(false)}
            >
              <Settings2 aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </section>
      <div role="status">{applied ? t('applied') : null}</div>
    </div>
  );
}

const catalogue = [
  { id: 'button', category: 'form' },
  { id: 'input', category: 'form' },
  { id: 'select', category: 'form' },
  { id: 'checkbox', category: 'form' },
  { id: 'switch', category: 'form' },
  { id: 'dialog', category: 'overlay' },
  { id: 'panel', category: 'overlay' },
  { id: 'tooltip', category: 'overlay' },
  { id: 'tabs', category: 'display' },
  { id: 'table', category: 'display' },
  { id: 'badge', category: 'display' },
];

export function DataPreview() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [state, setState] = useState('ready');
  const [page, setPage] = useState(1);
  const [ascending, setAscending] = useState(true);
  const filtered = catalogue
    .filter(
      (item) =>
        (category === 'all' || item.category === category) &&
        t(item.id)
          .toLocaleLowerCase(i18n.language)
          .includes(query.toLocaleLowerCase(i18n.language)),
    )
    .sort(
      (first, second) =>
        t(first.id).localeCompare(t(second.id), i18n.language) * (ascending ? 1 : -1),
    );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 4));
  const reset = () => {
    setQuery('');
    setCategory('all');
    setState('ready');
    setPage(1);
  };
  return (
    <div className="noa-stack">
      <div className="noa-field-grid">
        <Input
          label={t('search')}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
        <Select
          label={t('category')}
          value={category}
          onValueChange={(value) => {
            setCategory(value);
            setPage(1);
          }}
          options={['all', 'form', 'overlay', 'display'].map((value) => ({
            value,
            label: t(value),
          }))}
        />
      </div>
      <Select
        label={t('state')}
        value={state}
        onValueChange={setState}
        options={['ready', 'loading', 'empty', 'error'].map((value) => ({
          value,
          label: t(value),
        }))}
      />
      {state === 'loading' ? (
        <div role="status" aria-busy="true">
          <span className="noa-visually-hidden">{t('loading')}</span>
          {[1, 2, 3, 4].map((value) => (
            <div key={value} className="noa-skeleton" />
          ))}
        </div>
      ) : state === 'error' ? (
        <StatePanel
          title={t('loadFailed')}
          action={
            <Button variant="outline" onClick={() => setState('ready')}>
              {t('retry')}
            </Button>
          }
        />
      ) : state === 'empty' || filtered.length === 0 ? (
        <StatePanel
          title={t('noResults')}
          action={
            <Button variant="outline" onClick={reset}>
              {t('clearFilters')}
            </Button>
          }
        />
      ) : (
        <>
          <DataTable
            caption={t('catalogue')}
            rows={filtered.slice((page - 1) * 4, page * 4)}
            rowKey={(row) => row.id}
            sort={{ key: 'name', direction: ascending ? 'ascending' : 'descending' }}
            onSort={() => {
              setAscending(!ascending);
              setPage(1);
            }}
            columns={[
              { key: 'name', label: t('name'), sortable: true, render: (row) => t(row.id) },
              { key: 'category', label: t('category'), render: (row) => t(row.category) },
              {
                key: 'status',
                label: t('status'),
                render: () => <Badge tone="info">{t('ready')}</Badge>,
              },
            ]}
          />
          <Pagination
            label={t('page', { page, total: totalPages })}
            page={page}
            pageCount={totalPages}
            onPageChange={setPage}
            previousLabel={t('previous')}
            nextLabel={t('next')}
          />
        </>
      )}
    </div>
  );
}

export function FoundationPreview() {
  const { t } = useTranslation();
  return (
    <>
      <section className="noa-section">
        <h2>{t('colors')}</h2>
        <div className="noa-swatch-list">
          {['primary', 'navy', 'text', 'body', 'surface', 'border'].map((color) => (
            <div className="noa-swatch" key={color}>
              <div className={`noa-swatch-color noa-swatch-${color}`} />
              <strong>{t(color)}</strong>
            </div>
          ))}
        </div>
      </section>
      <section className="noa-section">
        <h2>{t('typography')}</h2>
        <div className="noa-stack">
          <p className="noa-display-sample">{t('typeSample')}</p>
          <p>{t('typeSample')}</p>
        </div>
      </section>
    </>
  );
}

