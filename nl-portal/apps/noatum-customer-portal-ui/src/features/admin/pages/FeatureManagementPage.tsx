import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Search, ShieldCheck } from 'lucide-react';
import {
  Badge, Button, Dialog, DialogContent, DialogTitle, DrawerBody, DrawerCard, DrawerFooter, DrawerHeader,
  Input, SectionHeading, StatePanel,
} from '../../../design-system';
import { AccessError } from '../../auth/api/current-user';
import { StaffError } from '../../staff/api/staff';
import type { LookupWriteError } from '../api/lookups';
import { useFeatureSwitches, useUpdateFeatureSwitch, type FeatureSwitch } from '../api/feature-switches';
import { Breadcrumb } from '../../../shared/components/Breadcrumb';
import admin from './AdminPage.module.css';
import styles from './FeatureManagementPage.module.css';

function errorKey(error: unknown) {
  return error instanceof StaffError ? error.kind : error instanceof AccessError ? 'denied' : 'unavailable';
}

/** The API label is the fallback, so a missing translation never shows a raw key. */
function useSwitchText() {
  const { t } = useTranslation('staff');
  return (entry: FeatureSwitch) => ({
    name: t(`switch_${entry.key.replaceAll('.', '_')}`, { defaultValue: entry.label }),
    description: t(`switchHint_${entry.key.replaceAll('.', '_')}`, { defaultValue: entry.description }),
  });
}

export function FeatureManagementPage() {
  const { t } = useTranslation('staff');
  const text = useSwitchText();
  const switches = useFeatureSwitches();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<FeatureSwitch | null>(null);

  const term = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const rows = (switches.data?.switches ?? []).filter((entry) => {
      if (!term) return true;
      const { name, description } = text(entry);
      return [entry.key, name, description].some((value) => value.toLowerCase().includes(term));
    });
    const byCategory = new Map<string, FeatureSwitch[]>();
    for (const entry of rows) {
      byCategory.set(entry.category, [...(byCategory.get(entry.category) ?? []), entry]);
    }
    return [...byCategory.entries()];
  }, [switches.data, term, text]);

  if (switches.error) {
    return (
      <section className={admin.page}>
        <SectionHeading as="h1" size="lg" title={t('nav_features')} description={t('page_features')} />
        <div className={admin.panel} role="alert"><StatePanel title={t(errorKey(switches.error))} /></div>
      </section>
    );
  }

  return (
    <section className={admin.page}>
      <Breadcrumb items={[{ label: t('navGroup_administration') }, { label: t('nav_features') }]} />
      <SectionHeading as="h1" size="lg" title={t('nav_features')} description={t('page_features')} />

      <div className={admin.panel}>
        <div className={admin.toolbar}>
          <Search size={16} aria-hidden="true" />
          <Input
            className={admin.searchField}
            label={t('featureSearch')}
            labelHidden
            type="search"
            maxLength={200}
            placeholder={t('featureSearch')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {switches.isPending ? (
          <div role="status"><StatePanel title={t('loading')} /></div>
        ) : groups.length === 0 ? (
          <StatePanel title={t('noMatches')} />
        ) : (
          <div className={styles.groups}>
            {groups.map(([category, entries]) => (
              <div key={category} className={styles.group}>
                <span className={styles.groupTitle}>{t(`featureCategory_${category}`)}</span>
                <div>
                  {entries.map((entry) => {
                    const { name, description } = text(entry);
                    return (
                      <div key={entry.key} className={styles.switchRow} data-enabled={entry.enabled}>
                        <div className={styles.switchText}>
                          <span className={styles.switchName}>{name}</span>
                          <span className={styles.switchKey}>{entry.key}</span>
                          <span className={styles.switchDescription}>{description}</span>
                          <span className={styles.switchMeta}>
                            {entry.overridden && entry.updatedBy
                              ? t('featureChangedBy', { name: entry.updatedBy })
                              : t('featureAtDefault', { value: t(entry.defaultEnabled ? 'featureOn' : 'featureOff') })}
                          </span>
                        </div>
                        <div className={styles.state}>
                          {entry.requiresApproval && <Badge tone="warning">{t('featureNeedsApproval')}</Badge>}
                          <Badge tone={entry.enabled ? 'success' : 'neutral'}>
                            {t(entry.enabled ? 'featureOn' : 'featureOff')}
                          </Badge>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setEditing(entry)}>
                          {t(entry.enabled ? 'featureTurnOff' : 'featureTurnOn')}
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

      {switches.data && (
        <div className={admin.panel}>
          <SectionHeading as="h2" size="sm" title={t('featureProtected')} />
          <div className={styles.protectedPanel}>
            <p className={styles.protectedIntro}>{t('featureProtectedIntro')}</p>
            <ul className={styles.protectedList}>
              {switches.data.protected.map((entry) => (
                <li key={entry.id} className={styles.protectedItem}>
                  <span className={styles.protectedLabel}>
                    <ShieldCheck aria-hidden="true" size={14} /> {t(`protected_${entry.id}`, { defaultValue: entry.label })}
                  </span>
                  <span className={styles.protectedReason}>
                    {t(`protectedReason_${entry.id}`, { defaultValue: entry.reason })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {editing && <ChangeDrawer entry={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function ChangeDrawer({ entry, onClose }: { entry: FeatureSwitch; onClose: () => void }) {
  const { t } = useTranslation('staff');
  const text = useSwitchText();
  const save = useUpdateFeatureSwitch();
  const failure = save.error as LookupWriteError | null;

  const next = !entry.enabled;
  const [reason, setReason] = useState('');
  const [approvalReference, setApprovalReference] = useState(entry.approvalReference ?? '');
  const needsApproval = next && entry.requiresApproval;
  const { name } = text(entry);

  const submit = async () => {
    await save.mutateAsync({
      key: entry.key,
      body: { enabled: next, reason, approvalReference: approvalReference.trim() || null },
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent side="right" closeLabel={t('close')}>
        <DrawerHeader>
          <DialogTitle>{t(next ? 'featureTurnOnTitle' : 'featureTurnOffTitle', { name })}</DialogTitle>
          <p className={styles.switchKey}>{entry.key}</p>
        </DrawerHeader>

        <DrawerBody>
          <DrawerCard>
            {failure && <p className={styles.error} role="alert">{failure.message || t('unavailable')}</p>}

            <p className={styles.consequence}>
              {t(next ? 'featureConsequenceOn' : 'featureConsequenceOff')}
            </p>

            {needsApproval && (
              <Input
                label={t('featureApprovalReference')}
                value={approvalReference}
                maxLength={200}
                hint={t('featureApprovalHint')}
                onChange={(event) => setApprovalReference(event.target.value)}
              />
            )}

            <Input
              label={t('reason')}
              value={reason}
              maxLength={400}
              onChange={(event) => setReason(event.target.value)}
            />
          </DrawerCard>
        </DrawerBody>

        <DrawerFooter>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
          <Button
            disabled={save.isPending || !reason.trim() || (needsApproval && !approvalReference.trim())}
            iconLeft={<Check aria-hidden="true" size={16} />}
            onClick={() => { void submit(); }}
          >
            {t(next ? 'featureTurnOn' : 'featureTurnOff')}
          </Button>
        </DrawerFooter>
      </DialogContent>
    </Dialog>
  );
}
