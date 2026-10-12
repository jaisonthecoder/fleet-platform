import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, RotateCcw, Search } from 'lucide-react';
import {
  Badge, Button, Dialog, DialogContent, DialogTitle, DrawerBody, DrawerCard, DrawerFooter, DrawerHeader,
  Input, SectionHeading, Select, StatePanel,
} from '../../../design-system';
import { AccessError } from '../../auth/api/current-user';
import { StaffError } from '../../staff/api/staff';
import type { LookupWriteError } from '../api/lookups';
import { useClearSetting, useSetSetting, useSettings, type Setting } from '../api/settings';
import { Breadcrumb } from '../../../shared/components/Breadcrumb';
import admin from './AdminPage.module.css';
import styles from './SettingsPage.module.css';

function errorKey(error: unknown) {
  return error instanceof StaffError ? error.kind : error instanceof AccessError ? 'denied' : 'unavailable';
}

/** The API label is the fallback, so a missing translation never shows a raw key. */
function useSettingText() {
  const { t } = useTranslation('staff');
  return (entry: Setting) => ({
    name: t(`setting_${entry.key.replaceAll('.', '_')}`, { defaultValue: entry.label }),
    description: t(`settingHint_${entry.key.replaceAll('.', '_')}`, { defaultValue: entry.description }),
  });
}

function display(value: unknown, entry: Setting): string {
  if (entry.type === 'boolean') return String(value === true);
  if (entry.type === 'enum') {
    return entry.options?.find((option) => option.value === value)?.label ?? String(value);
  }
  return entry.unit ? `${String(value)} ${entry.unit}` : String(value);
}

export function SettingsPage() {
  const { t } = useTranslation('staff');
  const text = useSettingText();
  const [scopeKind, setScopeKind] = useState<'global' | 'region' | 'branch'>('global');
  const [scopeId, setScopeId] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Setting | null>(null);

  // An empty scope id means "show me the global answer", never "show me everything":
  // the resolver simply skips a layer it has no id for.
  const scope = useMemo(
    () => ({
      regionCode: scopeKind === 'region' && scopeId ? scopeId : null,
      branchCode: scopeKind === 'branch' && scopeId ? scopeId : null,
    }),
    [scopeKind, scopeId],
  );

  const settings = useSettings(scope);
  const term = query.trim().toLowerCase();

  const groups = useMemo(() => {
    const rows = (settings.data ?? []).filter((entry) => {
      if (!term) return true;
      const { name, description } = text(entry);
      return [entry.key, name, description].some((value) => value.toLowerCase().includes(term));
    });
    const byGroup = new Map<string, Setting[]>();
    for (const entry of rows) {
      byGroup.set(entry.group, [...(byGroup.get(entry.group) ?? []), entry]);
    }
    return [...byGroup.entries()];
  }, [settings.data, term, text]);

  if (settings.error) {
    return (
      <section className={admin.page}>
        <SectionHeading as="h1" size="lg" title={t('nav_settings')} description={t('page_settings')} />
        <div className={admin.panel} role="alert"><StatePanel title={t(errorKey(settings.error))} /></div>
      </section>
    );
  }

  return (
    <section className={admin.page}>
      <Breadcrumb items={[{ label: t('navGroup_administration') }, { label: t('nav_settings') }]} />
      <SectionHeading as="h1" size="lg" title={t('nav_settings')} description={t('page_settings')} />

      <div className={admin.panel}>
        <div className={styles.scopeBar}>
          <Layers size={16} aria-hidden="true" />
          <Select
            label={t('settingScope')}
            value={scopeKind}
            options={[
              { value: 'global', label: t('settingScope_global') },
              { value: 'region', label: t('settingScope_region') },
              { value: 'branch', label: t('settingScope_branch') },
            ]}
            onValueChange={(next) => {
              setScopeKind(next as typeof scopeKind);
              setScopeId('');
            }}
          />
          {scopeKind !== 'global' && (
            <Input
              label={t(scopeKind === 'region' ? 'settingRegionCode' : 'settingBranchCode')}
              maxLength={64}
              value={scopeId}
              onChange={(event) => setScopeId(event.target.value.toUpperCase())}
            />
          )}
          <p className={styles.scopeHint}>{t('settingScopeHint')}</p>
        </div>

        <div className={admin.toolbar}>
          <Search size={16} aria-hidden="true" />
          <Input
            className={admin.searchField}
            label={t('settingSearch')}
            labelHidden
            type="search"
            maxLength={200}
            placeholder={t('settingSearch')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {settings.isPending ? (
          <div role="status"><StatePanel title={t('loading')} /></div>
        ) : groups.length === 0 ? (
          <StatePanel title={t('noMatches')} />
        ) : (
          <div className={styles.groups}>
            {groups.map(([group, entries]) => (
              <div key={group} className={styles.group}>
                <span className={styles.groupTitle}>{t(`settingGroup_${group}`)}</span>
                <div>
                  {entries.map((entry) => {
                    const { name, description } = text(entry);
                    const inherited = entry.effective.source === 'default';
                    return (
                      <div key={entry.key} className={styles.row}>
                        <div className={styles.rowText}>
                          <span className={styles.rowName}>{name}</span>
                          <span className={styles.rowKey}>{entry.key}</span>
                          <span className={styles.rowDescription}>{description}</span>
                          <span className={styles.rowMeta}>
                            {inherited
                              ? t('settingFromDefault')
                              : t('settingFromLayer', {
                                  layer: t(`settingScope_${entry.effective.source}`),
                                  id: entry.effective.sourceId ?? '',
                                })}
                          </span>
                          {entry.overrides.some((override) => !override.valid) && (
                            <span className={styles.rowInvalid}>{t('settingInvalidOverride')}</span>
                          )}
                        </div>
                        <div className={styles.state}>
                          {entry.requiresSwitch && (
                            <Badge tone="info">{t('settingNeedsSwitch')}</Badge>
                          )}
                          <Badge tone={inherited ? 'neutral' : 'success'}>
                            {display(entry.effective.value, entry)}
                          </Badge>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setEditing(entry)}>
                          {t('settingChange')}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <ChangeDrawer
          entry={editing}
          scopeKind={scopeKind}
          scopeId={scopeId}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function ChangeDrawer({
  entry, scopeKind, scopeId, onClose,
}: {
  entry: Setting;
  scopeKind: 'global' | 'region' | 'branch';
  scopeId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation('staff');
  const text = useSettingText();
  const save = useSetSetting();
  const clear = useClearSetting();
  const failure = (save.error ?? clear.error) as LookupWriteError | null;

  const [value, setValue] = useState(String(entry.effective.value));
  const [reason, setReason] = useState('');
  const { name } = text(entry);

  const atThisLayer = entry.overrides.find(
    (override) => override.scope === scopeKind && (override.scopeId ?? '') === scopeId,
  );

  const parse = (): boolean | number | string => {
    if (entry.type === 'boolean') return value === 'true';
    if (entry.type === 'number') return Number(value);
    return value;
  };

  const submit = async () => {
    await save.mutateAsync({
      key: entry.key,
      body: { scope: scopeKind, scopeId: scopeKind === 'global' ? null : scopeId, value: parse(), reason },
    });
    onClose();
  };

  const remove = async () => {
    await clear.mutateAsync({
      key: entry.key,
      scope: scopeKind,
      scopeId: scopeKind === 'global' ? null : scopeId,
      reason,
    });
    onClose();
  };

  const reasonTooShort = reason.trim().length < 3;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent side="right" closeLabel={t('close')}>
        <DrawerHeader>
          <DialogTitle>{t('settingChangeTitle', { name })}</DialogTitle>
          <p className={styles.rowKey}>{entry.key}</p>
        </DrawerHeader>

        <DrawerBody>
          <DrawerCard>
            <p className={styles.drawerScope}>
              {t('settingApplyingAt', {
                layer: t(`settingScope_${scopeKind}`),
                id: scopeKind === 'global' ? '' : scopeId,
              })}
            </p>

            {entry.type === 'boolean' && (
              <Select
                label={t('settingValue')}
                value={value}
                options={[
                  { value: 'true', label: t('featureOn') },
                  { value: 'false', label: t('featureOff') },
                ]}
                onValueChange={setValue}
              />
            )}

            {entry.type === 'enum' && (
              <Select
                label={t('settingValue')}
                value={value}
                options={(entry.options ?? []).map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                onValueChange={setValue}
              />
            )}

            {entry.type === 'number' && (
              <Input
                label={`${t('settingValue')}${entry.unit ? ` (${entry.unit})` : ''}`}
                type="number"
                min={entry.min ?? undefined}
                max={entry.max ?? undefined}
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            )}

            <Input
              label={t('settingReason')}
              hint={t('settingReasonHint')}
              maxLength={400}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />

            {failure && <p role="alert" className={styles.error}>{failure.message || t('unavailable')}</p>}
          </DrawerCard>
        </DrawerBody>

        <DrawerFooter>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
          {atThisLayer && (
            <Button
              variant="outline"
              onClick={remove}
              disabled={reasonTooShort || clear.isPending}
            >
              <RotateCcw size={14} aria-hidden="true" /> {t('settingClear')}
            </Button>
          )}
          <Button onClick={submit} disabled={reasonTooShort || save.isPending}>
            {t('settingSave')}
          </Button>
        </DrawerFooter>
      </DialogContent>
    </Dialog>
  );
}
