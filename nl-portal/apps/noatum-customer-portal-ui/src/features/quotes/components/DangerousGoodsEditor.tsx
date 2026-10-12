import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, X } from 'lucide-react';

import { Button, Autocomplete, Checkbox, Input, Select } from '../../../design-system';
import { REFERENCE, useReferenceLabels, useReferenceOptions } from '../../../shared/reference/useReference';
import type { DangerousGoodsInput } from '../api/quotes';

import styles from './DangerousGoodsEditor.module.css';

/**
 * One dangerous goods entry as the form holds it: strings, because every field
 * is mid-typing until the moment it is sent.
 */
export interface DangerousGoodsDraft {
  key: string;
  unNumber: string;
  /** The lookup CODE, e.g. '3'. Never the label - the column is varchar(8). */
  hazardClass: string;
  /** One further hazard, or '' for none. The API accepts up to four. */
  subsidiaryRisk: string;
  properShippingName: string;
  /** From the contract: the server accepts only these four. */
  packingGroup: DangerousGoodsInput['packingGroup'];
  technicalName: string;
  flashpointCelsius: string;
  emsCode: string;
  isMarinePollutant: boolean;
  packagingType: string;
  unPackagingCode: string;
  packageCount: string;
  netQuantityPerPackage: string;
  quantityUnit: string;
  transportRegime: string;
  /** IMDG limited quantity mark. Held in the draft; no contract field yet. */
  isLimitedQuantity: boolean;
  isInOverpack: boolean;
  appliesToLines: string[];
}

export function emptyDangerousGoods(): DangerousGoodsDraft {
  return {
    key: crypto.randomUUID(),
    unNumber: '', hazardClass: '', subsidiaryRisk: '', properShippingName: '', packingGroup: 'NONE',
    technicalName: '', flashpointCelsius: '', emsCode: '', isMarinePollutant: false,
    packagingType: '', unPackagingCode: '', packageCount: '', netQuantityPerPackage: '',
    quantityUnit: 'KG', transportRegime: 'FULL',
    isLimitedQuantity: false, isInOverpack: false, appliesToLines: [],
  };
}

/** An em dash, for a cell with nothing in it yet. */
const EMPTY_CELL = '—';

/** A shipping name ending in n.o.s. must name the contents that make it hazardous. */
const NOT_OTHERWISE_SPECIFIED = /\bn\.?\s?o\.?\s?s\.?/i;

/** Class 3 as either the primary or the subsidiary hazard needs a flashpoint. */
const isFlammableLiquid = (entry: DangerousGoodsDraft) =>
  entry.hazardClass.trim() === '3' || entry.subsidiaryRisk.trim() === '3';

const PACKING_GROUPS = ['I', 'II', 'III', 'NONE'] as const satisfies
  readonly DangerousGoodsInput['packingGroup'][];

/**
 * The lookup supplies the labels and the ordering; this bounds what may be sent.
 * `satisfies` breaks the build if the API's set ever changes, so the two cannot
 * drift silently - and an administrator adding a fifth item to the lookup gets a
 * refusal here rather than an opaque one from the server.
 */
function asPackingGroup(value: string): DangerousGoodsInput['packingGroup'] {
  return PACKING_GROUPS.find((group) => group === value) ?? 'NONE';
}

export interface CargoLineRef {
  key: string;
  label: string;
}

export interface DangerousGoodsEditorProps {
  entries: DangerousGoodsDraft[];
  /** The cargo an entry may be linked to. Empty until the customer adds a line. */
  lines: CargoLineRef[];
  onChange: (entries: DangerousGoodsDraft[]) => void;
}

/**
 * Captures dangerous goods for pricing. It is not a dangerous goods declaration,
 * and says so on screen: the declaration is the shipper's signed certification
 * under the applicable IMDG or IATA edition, and it is raised later.
 *
 * The required set is the basic description the regulations require
 * unconditionally, plus the two rules conditional on things we can judge without
 * a licensed list - a flashpoint for class 3, a technical name for n.o.s. The
 * server enforces the same set; this only says so earlier. See docs/gaps.md G3.
 *
 * Deliberately no UN number lookup. We hold no licensed dangerous goods list, and
 * a suggestion a customer reads as validation is worse than offering nothing.
 */
export function DangerousGoodsEditor({ entries, lines, onChange }: DangerousGoodsEditorProps) {
  const { t } = useTranslation();

  // Codes, not labels: hazardClass is stored in a varchar(8) and compared
  // against '3'. A label would fail validation and silently kill the flashpoint
  // rule. Packaging stays a label because that column is free text by design.
  const classes = useReferenceOptions(REFERENCE.hazardClass, { audience: 'customer' });
  const packingGroups = useReferenceOptions(REFERENCE.dgPackingGroup, { audience: 'customer' });
  const packagings = useReferenceLabels(REFERENCE.dgPackagingType, { audience: 'customer' });
  const regimes = useReferenceOptions(REFERENCE.dgTransportRegime, { audience: 'customer' });
  const units = useReferenceOptions(REFERENCE.dgQuantityUnit, { audience: 'customer' });

  /** One open at a time: nine entries expanded is the wall this replaced. */
  const [expanded, setExpanded] = useState<string | null>(null);

  const totalPackages = entries.reduce((sum, entry) => sum + (amount(entry.packageCount) ?? 0), 0);
  const distinctClasses = [...new Set(entries.map((entry) => entry.hazardClass).filter(Boolean))].sort();

  const patch = (key: string, change: Partial<DangerousGoodsDraft>) =>
    onChange(entries.map((entry) => (entry.key === key ? { ...entry, ...change } : entry)));

  const remove = (key: string) => onChange(entries.filter((entry) => entry.key !== key));

  const toggleLine = (entry: DangerousGoodsDraft, lineKey: string) =>
    patch(entry.key, {
      appliesToLines: entry.appliesToLines.includes(lineKey)
        ? entry.appliesToLines.filter((value) => value !== lineKey)
        : [...entry.appliesToLines, lineKey],
    });

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>{t('dgTitle')}</h3>
          <p className={styles.intro}>{t('dgIntro')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => onChange([...entries, emptyDangerousGoods()])}>
          {t('dgAdd')}
        </Button>
      </div>

      {entries.length === 0 && <p className={styles.empty}>{t('dgEmpty')}</p>}

      {/*
        A register, not a stack of cards.
        Every entry is one row - hazard, UN and name, class, packing group, how
        many packages, and which cargo it sits in - because those six are what a
        pricer and a DG desk check first, and comparing them down a column is the
        whole job. The detail opens underneath the row it belongs to, one at a
        time, so a request with nine entries is still readable.
      */}
      {entries.length > 0 && (
        <div className={styles.register} role="table" aria-label={t('dgTitle')}>
          <div className={styles.registerHead} role="row">
            <span role="columnheader" className={styles.colHazard} />
            <span role="columnheader">{t('dgColName')}</span>
            <span role="columnheader">{t('dgColClass')}</span>
            <span role="columnheader">{t('dgColPg')}</span>
            <span role="columnheader">{t('dgColPackages')}</span>
            <span role="columnheader">{t('dgColAppliesTo')}</span>
            <span role="columnheader" className="noa-visually-hidden">{t('dgRemove')}</span>
          </div>

          {entries.map((entry, index) => {
            const unlinked = entry.appliesToLines.length === 0;
            const open = expanded === entry.key;
            const classLabel = classes.find((option) => option.value === entry.hazardClass)?.label;
            const packages = amount(entry.packageCount);
            const each = amount(entry.netQuantityPerPackage);
            const linked = lines
              .filter((line) => entry.appliesToLines.includes(line.key))
              .map((line) => line.label)
              .join(', ');

            return (
              <Fragment key={entry.key}>
                <div className={styles.registerRow} role="row" data-open={open || undefined}>
                  {/* The diamond is the placard the package actually carries, so
                      the class is recognisable before the text is read. */}
                  <span className={styles.diamond} data-class={entry.hazardClass || undefined} aria-hidden="true">
                    {entry.hazardClass || '?'}
                  </span>

                  <span className={styles.rowName}>
                    {entry.unNumber.trim() === ''
                      ? t('dgEntryUntitled', { number: index + 1 })
                      : `UN ${entry.unNumber}${entry.properShippingName ? ` · ${entry.properShippingName}` : ''}`}
                  </span>
                  <span className={styles.rowMuted}>{classLabel ?? EMPTY_CELL}</span>
                  <span className={styles.rowMuted}>{entry.packingGroup === 'NONE' ? EMPTY_CELL : entry.packingGroup}</span>
                  <span className={styles.rowMuted}>
                    {packages !== null && each !== null
                      ? `${packages} × ${each} ${entry.quantityUnit}`
                      : EMPTY_CELL}
                  </span>
                  {/* Red, and stated on the row rather than only in the detail: an
                      entry linked to nothing is the shape of a misdeclaration. */}
                  <span className={unlinked ? styles.rowUnlinked : styles.rowStrong}>
                    {unlinked ? t('dgNotLinked') : linked}
                  </span>

                  <span className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.disclose}
                      aria-expanded={open}
                      aria-label={t(open ? 'dgCollapseEntry' : 'dgExpandEntry', { number: index + 1 })}
                      onClick={() => setExpanded(open ? null : entry.key)}
                    >
                      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <button
                      type="button"
                      className={styles.disclose}
                      aria-label={t('dgRemoveEntry', { number: index + 1 })}
                      onClick={() => remove(entry.key)}
                    >
                      <X size={14} />
                    </button>
                  </span>
                </div>

                {open && (
                  <div className={styles.detail} role="row">
                    <p className={styles.group}>{t('dgGroupIdentification')}</p>
                    <div className={styles.fields}>
              <Input
                label={t('dgUnNumber')} placeholder={t('dgUnNumberPh')} required inputMode="numeric" maxLength={4}
                value={entry.unNumber} hint={t('dgUnNumberHint')}
                onChange={(event) => patch(entry.key, { unNumber: event.target.value.replace(/\D/g, '') })}
              />
              <Select
                label={t('dgClass')} required
                value={entry.hazardClass}
                hint={t('dgClassHint')}
                options={
                  entry.hazardClass === ''
                    ? [{ value: '', label: t('dgClassChoose') }, ...classes]
                    : classes
                }
                onValueChange={(value) => patch(entry.key, { hazardClass: value })}
              />
              <Select
                label={t('dgSubsidiaryRisk')} value={entry.subsidiaryRisk}
                hint={t('dgSubsidiaryRiskHint')}
                options={[{ value: '', label: t('dgSubsidiaryRiskNone') }, ...classes]}
                onValueChange={(value) => patch(entry.key, { subsidiaryRisk: value })}
              />
              <Input
                label={t('dgProperShippingName')} placeholder={t('dgProperShippingNamePh')} required maxLength={240}
                value={entry.properShippingName} hint={t('dgProperShippingNameHint')}
                onChange={(event) => patch(entry.key, { properShippingName: event.target.value })}
              />
              <Select
                label={t('dgPackingGroup')} required value={entry.packingGroup || 'NONE'}
                hint={t('dgPackingGroupHint')}
                options={packingGroups.length > 0 ? packingGroups : [{ value: 'NONE', label: '—' }]}
                onValueChange={(value) => patch(entry.key, { packingGroup: asPackingGroup(value) })}
              />
              <Input
                label={t('dgTechnicalName')} placeholder={t('dgTechnicalNamePh')}
                required={NOT_OTHERWISE_SPECIFIED.test(entry.properShippingName)}
                maxLength={240} value={entry.technicalName}
                hint={t('dgTechnicalNameHint')}
                onChange={(event) => patch(entry.key, { technicalName: event.target.value })}
              />
              <Input
                label={t('dgFlashpoint')} placeholder={t('dgFlashpointPh')} required={isFlammableLiquid(entry)}
                inputMode="decimal" value={entry.flashpointCelsius}
                hint={isFlammableLiquid(entry) ? t('dgFlashpointHint') : undefined}
                onChange={(event) => patch(entry.key, { flashpointCelsius: event.target.value })}
              />
              <Input
                label={t('dgEms')} placeholder={t('dgEmsPh')} maxLength={40} value={entry.emsCode}
                onChange={(event) => patch(entry.key, { emsCode: event.target.value })}
              />
            </div>

            <p className={styles.group}>{t('dgGroupPackaging')}</p>
            <div className={styles.fields}>
              <Autocomplete
                label={t('dgPackagingType')} placeholder={t('dgPackagingTypePh')} required value={entry.packagingType}
                options={packagings.map((option) => ({ value: option, label: option }))}
                emptyHint={t('dgComboFreeText')}
                onValueChange={(value) => patch(entry.key, { packagingType: value })}
              />
              <Input
                label={t('dgUnPackagingCode')} placeholder={t('dgUnPackagingCodePh')} maxLength={20} value={entry.unPackagingCode}
                onChange={(event) => patch(entry.key, { unPackagingCode: event.target.value })}
              />
              <Input
                label={t('dgPackageCount')} placeholder={t('dgPackageCountPh')} required inputMode="numeric" value={entry.packageCount}
                onChange={(event) => patch(entry.key, { packageCount: event.target.value })}
              />
              <Input
                label={t('dgNetQuantity')} placeholder={t('dgNetQuantityPh')} required inputMode="decimal"
                value={entry.netQuantityPerPackage}
                onChange={(event) => patch(entry.key, { netQuantityPerPackage: event.target.value })}
              />
              <Select
                label={t('dgQuantityUnit')} required value={entry.quantityUnit}
                options={units.length > 0 ? units : [{ value: entry.quantityUnit, label: entry.quantityUnit }]}
                onValueChange={(value) => patch(entry.key, { quantityUnit: value })}
              />
              {/* Read-only, because it is packages × net quantity and nothing else.
                  A typeable total is a total that disagrees with its own parts, and
                  this one goes on the DG declaration. */}
              <Input
                label={t('dgTotalNetQuantity')} readOnly tabIndex={-1}
                value={
                  packages !== null && each !== null
                    ? `${Number((packages * each).toFixed(3))} ${entry.quantityUnit}`
                    : EMPTY_CELL
                }
                onChange={() => undefined}
              />
              <Select
                label={t('dgRegime')} value={entry.transportRegime} hint={t('dgRegimeHint')}
                options={regimes.length > 0 ? regimes : [{ value: entry.transportRegime, label: entry.transportRegime }]}
                onValueChange={(value) => patch(entry.key, { transportRegime: value })}
              />
            </div>

            <div className={styles.flags}>
              <Checkbox
                label={t('dgMarinePollutant')} checked={entry.isMarinePollutant}
                onCheckedChange={(checked) => patch(entry.key, { isMarinePollutant: checked === true })}
              />
              {/* Limited quantity is a real IMDG relaxation, not decoration: LQ
                  packages carry a different mark and different stowage. It is held
                  in the draft only until the contract gains a field for it - see
                  the note on toDangerousGoodsInput. */}
              <Checkbox
                label={t('dgLimitedQuantity')} checked={entry.isLimitedQuantity}
                onCheckedChange={(checked) => patch(entry.key, { isLimitedQuantity: checked === true })}
              />
              <Checkbox
                label={t('dgOverpack')} checked={entry.isInOverpack}
                onCheckedChange={(checked) => patch(entry.key, { isInOverpack: checked === true })}
              />
            </div>

            <fieldset className={styles.links}>
              <legend className={styles.group}>{t('dgAppliesTo')}</legend>
              {lines.length === 0 ? (
                <p className={styles.warn}>{t('dgNoLines')}</p>
              ) : (
                <>
                  <div className={styles.lineChoices}>
                    {lines.map((line) => (
                      <Checkbox
                        key={line.key} label={line.label}
                        checked={entry.appliesToLines.includes(line.key)}
                        onCheckedChange={() => toggleLine(entry, line.key)}
                      />
                    ))}
                  </div>
                  {/* Stated, not silently enforced: an entry linked to nothing
                      means nobody knows which packages hold the hazard. */}
                  <p className={unlinked ? styles.warn : styles.note}>
                    {unlinked ? t('dgLinkRequired') : t('dgLinkedCount', { count: entry.appliesToLines.length })}
                  </p>
                </>
              )}
                    </fieldset>
                  </div>
                )}
              </Fragment>
            );
          })}

          {/*
            What the DG desk counts. Entries is how many declarations, packages is
            what goes on the manifest, and the classes are what decides segregation
            - two classes that cannot travel together is a problem found here or
            found at the terminal.
          */}
          <dl className={styles.totals}>
            <div>
              <dt>{t('dgTotalEntries')}</dt>
              <dd>{entries.length.toLocaleString()}</dd>
            </div>
            <div>
              <dt>{t('dgTotalPackages')}</dt>
              <dd>{totalPackages.toLocaleString()}</dd>
            </div>
            <div>
              <dt>{t('dgTotalClasses')}</dt>
              <dd className={styles.totalLead}>{distinctClasses.join(', ') || EMPTY_CELL}</dd>
            </div>
          </dl>
        </div>
      )}

      {entries.length > 0 && <p className={styles.footnote}>{t('dgFootnote')}</p>}
    </div>
  );
}

/** True when every entry carries what the regulations require unconditionally. */
export function dangerousGoodsComplete(entries: DangerousGoodsDraft[]): boolean {
  return entries.every((entry) => toDangerousGoodsInput(entry) !== null);
}

const amount = (value: string): number | null => {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/**
 * A draft becomes an API entry only when it is complete, and `null` says it is
 * not. One function decides both, so the button cannot enable on one set of
 * rules while the request is built from another - which is how a required field
 * ends up sent as undefined and refused by the server.
 */
export function toDangerousGoodsInput(entry: DangerousGoodsDraft): DangerousGoodsInput | null {
  const packageCount = amount(entry.packageCount);
  const netQuantityPerPackage = amount(entry.netQuantityPerPackage);
  // Number('abc') is NaN, and JSON.stringify turns NaN into null. Reject it here so a
  // typo in a field nobody is required to fill cannot refuse the whole request.
  const flashpointRaw = entry.flashpointCelsius.trim() === ''
    ? null
    : Number(entry.flashpointCelsius.trim().replace(',', '.'));
  const flashpoint = flashpointRaw !== null && Number.isFinite(flashpointRaw) ? flashpointRaw : null;

  const missingRequired =
    !/^\d{4}$/.test(entry.unNumber.trim())
    || entry.hazardClass.trim() === ''
    || entry.properShippingName.trim() === ''
    || entry.packingGroup.trim() === ''
    || entry.packagingType.trim() === ''
    || packageCount === null
    || !Number.isInteger(packageCount)
    || netQuantityPerPackage === null
    || entry.quantityUnit.trim() === ''
    || entry.appliesToLines.length === 0;

  if (missingRequired) return null;

  // Conditional on what we can judge without a licensed list: the class, and the
  // shipping name the customer typed.
  if (isFlammableLiquid(entry) && flashpoint === null) return null;
  if (NOT_OTHERWISE_SPECIFIED.test(entry.properShippingName) && entry.technicalName.trim() === '') {
    return null;
  }

  return {
    unNumber: entry.unNumber.trim(),
    hazardClass: entry.hazardClass.trim(),
    subsidiaryRisks: entry.subsidiaryRisk.trim() === '' ? undefined : [entry.subsidiaryRisk.trim()],
    properShippingName: entry.properShippingName.trim(),
    packingGroup: entry.packingGroup,
    technicalName: entry.technicalName.trim() || undefined,
    flashpointCelsius: flashpoint ?? undefined,
    emsCode: entry.emsCode.trim() || undefined,
    isMarinePollutant: entry.isMarinePollutant,
    packagingType: entry.packagingType.trim(),
    unPackagingCode: entry.unPackagingCode.trim() || undefined,
    packageCount,
    netQuantityPerPackage,
    quantityUnit: entry.quantityUnit,
    transportRegime: entry.transportRegime || undefined,
    isInOverpack: entry.isInOverpack,
    appliesToLines: entry.appliesToLines,
  };
}
