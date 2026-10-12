import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import {
  Autocomplete, DateField, dateParts, Input, Select, Textarea,
  type AutocompleteOption, type SelectOption,
} from '../../../design-system';
import type { ReferenceItem } from '../../../shared/reference/useReference';
import { formatMoney, fromMinorUnits, parseQuantity, toMinorUnits } from '../money';
import styles from './OptionEditor.module.css';

/** The editing shape. Minor units throughout; nothing here holds a float. */
export interface DraftLine {
  key: string;
  code: string;
  description: string;
  basis: string;
  quantity: string;
  rate: string;
  /** Per line, because one option can carry a USD freight and EUR local charges. */
  currency: string;
  cost: string;
}

export interface DraftOption {
  key: string;
  name: string;
  carrierName: string;
  serviceRouting: string;
  transitDaysMin: string;
  transitDaysMax: string;
  nextDepartures: string;
  freeTimeDays: string;
  validUntil: string;
  isRecommended: boolean;
  notes: string;
  termsIncluded: string;
  termsExcluded: string;
  termsPayment: string;
  termsSubjectTo: string;
  currency: string;
  lines: DraftLine[];
}

export function emptyLine(currency: string): DraftLine {
  return {
    key: crypto.randomUUID(),
    code: '', description: '', basis: '', quantity: '1', rate: '', currency, cost: '',
  };
}

export function emptyOption(currency: string, validUntil: string): DraftOption {
  return {
    key: crypto.randomUUID(),
    name: '', carrierName: '', serviceRouting: '',
    transitDaysMin: '', transitDaysMax: '', nextDepartures: '', freeTimeDays: '',
    validUntil, isRecommended: false, notes: '',
    termsIncluded: '', termsExcluded: '', termsPayment: '', termsSubjectTo: '',
    currency, lines: [emptyLine(currency)],
  };
}

/** Local calendar date, not UTC: the picker hands back midnight where the user is. */
const isoDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

function lineAmount(line: DraftLine): number | null {
  const quantity = parseQuantity(line.quantity);
  const rate = toMinorUnits(line.rate);
  if (quantity === null || rate === null) return null;
  return Math.trunc((Math.round(quantity * 1000) * rate) / 1000);
}

function lineCost(line: DraftLine): number | null {
  const quantity = parseQuantity(line.quantity);
  const cost = toMinorUnits(line.cost);
  if (quantity === null || cost === null) return null;
  return Math.trunc((Math.round(quantity * 1000) * cost) / 1000);
}

/**
 * The option total, for the screen only.
 *
 * The API recomputes every line and every total on save, and the stored figure is
 * the API's. This exists so a pricer sees the sum move as they type - it is a
 * preview, and it is deliberately the only arithmetic in this file.
 */
export function optionTotal(option: DraftOption): number {
  return option.lines.reduce((sum, line) => sum + (lineAmount(line) ?? 0), 0);
}

export function optionCost(option: DraftOption): number | null {
  let any = false;
  const total = option.lines.reduce((sum, line) => {
    const cost = lineCost(line);
    if (cost === null) return sum;
    any = true;
    return sum + cost;
  }, 0);
  return any ? total : null;
}

/**
 * The charge families the mix bar groups by.
 *
 * The codes come from the `charge_code` lookup, so an administrator can add one
 * without a deployment - but which FAMILY a code belongs to is a presentation
 * decision, not data, and an unknown code falls through to "delivery and other"
 * rather than being dropped from a bar that claims to add up to the whole price.
 */
const FAMILIES: { key: string; codes: string[]; swatch: string }[] = [
  { key: 'freight', codes: ['FRT', 'BAF', 'CAF', 'GRI', 'PSS', 'WRS'], swatch: styles.family1 },
  { key: 'origin', codes: ['THC', 'DOC', 'ISPS', 'EXP', 'PCF'], swatch: styles.family2 },
  { key: 'customs', codes: ['CUS', 'DGS', 'VET'], swatch: styles.family3 },
  { key: 'delivery', codes: [], swatch: styles.family4 },
];

function familyOf(code: string): string {
  const upper = code.trim().toUpperCase();
  return FAMILIES.find((family) => family.codes.includes(upper))?.key ?? 'delivery';
}

/** Below 5% is thin, below 10% worth a look. Tone only; no policy is enforced. */
function marginTone(percent: number | null): string {
  if (percent === null) return 'none';
  return percent < 5 ? 'low' : percent < 10 ? 'mid' : 'ok';
}

/** A lookup item as the Autocomplete wants it: the code is stored, the label explains it. */
function codeOptions(items: ReferenceItem[]): AutocompleteOption[] {
  return items.map((item) => ({ value: item.code, label: item.code, hint: item.label }));
}

interface Props {
  option: DraftOption;
  index: number;
  canRecordCost: boolean;
  /** Labels from the `charge_basis` lookup. */
  chargeBases: string[];
  /** Names from the `carrier` lookup, already scoped to this quote's mode. */
  carrierOptions: string[];
  /** Codes and meanings from the `charge_code` lookup. */
  chargeCodes: ReferenceItem[];
  /** Codes from the `currency` lookup. */
  currencyOptions: ReferenceItem[];
  onChange: (next: DraftOption) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onRecommend: () => void;
  removable: boolean;
}

export function OptionEditor({
  option, index, canRecordCost, chargeBases, carrierOptions, chargeCodes, currencyOptions,
  onChange, onDuplicate, onRemove, onRecommend, removable,
}: Props) {
  const { t } = useTranslation('staff');
  const set = (patch: Partial<DraftOption>) => onChange({ ...option, ...patch });

  const setLine = (key: string, patch: Partial<DraftLine>) =>
    set({ lines: option.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)) });

  const sell = optionTotal(option);
  const cost = canRecordCost ? optionCost(option) : null;
  const profit = cost === null ? null : sell - cost;
  const margin = cost === null || sell === 0 ? null : Math.round(((sell - cost) / sell) * 1000) / 10;

  const codes = codeOptions(chargeCodes);
  const carriers: AutocompleteOption[] = carrierOptions.map((name) => ({ value: name, label: name }));
  const bases: AutocompleteOption[] = chargeBases.map((basis) => ({ value: basis, label: basis }));

  // A currency the option already carries but the lookup does not - a retired
  // code on an old quote - still has to be selectable, or re-opening it would
  // silently rewrite the price into another currency.
  const currencies: SelectOption[] = [
    ...currencyOptions.map((item) => ({ value: item.code, label: `${item.code} · ${item.label}` })),
    ...option.lines
      .map((line) => line.currency)
      .filter((code) => code !== '' && !currencyOptions.some((item) => item.code === code))
      .map((code) => ({ value: code, label: code })),
  ].filter((entry, at, all) => all.findIndex((other) => other.value === entry.value) === at);

  const priced = option.lines
    .map((line) => ({ line, amount: lineAmount(line) ?? 0 }))
    .filter((entry) => entry.amount > 0);
  const mixTotal = priced.reduce((sum, entry) => sum + entry.amount, 0);
  const mix = FAMILIES
    .map((family) => ({
      family,
      value: priced
        .filter((entry) => familyOf(entry.line.code) === family.key)
        .reduce((sum, entry) => sum + entry.amount, 0),
    }))
    .filter((band) => band.value > 0);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // UTC midnight, the same way the request form reads a stored date: a local
  // parse turns 2026-10-13 into the 12th for anyone west of Greenwich.
  const validUntil = option.validUntil === ''
    ? undefined
    : new Date(`${option.validUntil}T00:00:00Z`);

  return (
    <div className={styles.work}>
      {/* --- service details --- */}
      <section className={styles.card} aria-label={t('serviceDetails')}>
        <div className={styles.cardHead}>
          <span>
            <span className={styles.tick} aria-hidden="true" />
            <span className={styles.eyebrow}>{t('serviceDetailsOf', { number: index + 1 })}</span>
          </span>
          <div className={styles.headActions}>
            <button type="button" className={styles.linkAction} onClick={onDuplicate}>
              {t('optionDuplicate')}
            </button>
            {removable && (
              <button type="button" className={styles.linkAction} data-quiet="true" onClick={onRemove}>
                {t('optionRemove')}
              </button>
            )}
          </div>
        </div>

        {/*
          What the option IS, on its own row and marked as such: the name is what
          the customer reads first on the quotation, and the carrier decides the
          transit, the free time and half the cost. Everything below is detail
          hung off these two.
        */}
        <div className={styles.identity}>
          <Input
            label={t('optionName')}
            placeholder={t('optionNamePlaceholder')}
            hint={t('optionNameHint')}
            maxLength={120}
            value={option.name}
            onChange={(event) => set({ name: event.target.value })}
          />

          {/*
            The carrier lookup, scoped to this quote's mode by the API, in the
            same Autocomplete the request form uses for packaging and ports. It
            still accepts a carrier nobody has added: a pricer must never be held
            up at 17:40 waiting for an administrator.
          */}
          <Autocomplete
            label={t('optionCarrier')}
            placeholder={t('optionCarrierPlaceholder')}
            hint={t('optionCarrierHint')}
            emptyHint={t('freeTextHint')}
            maxLength={160}
            options={carriers}
            value={option.carrierName}
            onValueChange={(next) => set({ carrierName: next })}
          />
        </div>

        <div className={styles.fields}>
          <Input
            label={t('optionRouting')}
            placeholder={t('optionRoutingPlaceholder')}
            maxLength={240}
            value={option.serviceRouting}
            onChange={(event) => set({ serviceRouting: event.target.value })}
          />

          <div className={styles.pairField}>
            <span className={styles.pairLabel}>{t('optionTransit')}</span>
            <div className={styles.pair}>
              <Input
                label={t('optionTransitMin')} labelHidden
                placeholder={t('optionDaysPlaceholder')}
                inputMode="numeric"
                value={option.transitDaysMin}
                onChange={(event) => set({ transitDaysMin: event.target.value })}
              />
              <span className={styles.dash} aria-hidden="true">–</span>
              <Input
                label={t('optionTransitMax')} labelHidden
                placeholder={t('optionDaysPlaceholder')}
                inputMode="numeric"
                value={option.transitDaysMax}
                onChange={(event) => set({ transitDaysMax: event.target.value })}
              />
            </div>
          </div>

          <Input
            label={t('optionDepartures')}
            placeholder={t('optionDeparturesPlaceholder')}
            hint={t('optionDeparturesHint')}
            maxLength={120}
            value={option.nextDepartures}
            onChange={(event) => set({ nextDepartures: event.target.value })}
          />

          <Input
            label={t('optionFreeTime')}
            placeholder={t('optionDaysPlaceholder')}
            hint={t('optionFreeTimeHint')}
            inputMode="numeric"
            value={option.freeTimeDays}
            onChange={(event) => set({ freeTimeDays: event.target.value })}
          />

          {/* The kit's date field, in the same treatment the request form uses for
              cargo ready and latest delivery. */}
          <DateField
            label={t('optionValidUntil')}
            placeholder={t('optionValidUntilPlaceholder')}
            date={dateParts(option.validUntil) ?? undefined}
            selected={validUntil}
            onSelect={(next) => set({ validUntil: next ? isoDate(next) : '' })}
            calendar={{
              calendarLabel: t('optionValidUntil'),
              today,
              startMonth: today,
              // An offer cannot be valid until yesterday. The check panel says the
              // same thing in words for a date already stored in the past.
              disabled: { before: today },
            }}
          />

          <div className={styles.pairField}>
            <span className={styles.pairLabel}>{t('optionRecommendField')}</span>
            <button
              type="button"
              className={styles.recommend}
              data-on={option.isRecommended ? 'true' : undefined}
              aria-pressed={option.isRecommended}
              onClick={onRecommend}
            >
              <span className={styles.recommendBox} aria-hidden="true" />
              {option.isRecommended ? t('optionRecommended') : t('optionNotRecommended')}
            </button>
          </div>
        </div>
      </section>

      {/* --- charge lines --- */}
      <section className={styles.card} aria-label={t('chargeLines')}>
        <div className={styles.cardHead}>
          <span>
            <span className={styles.tick} aria-hidden="true" />
            <span className={styles.eyebrow}>{t('chargeLinesSelling')}</span>
          </span>
          {canRecordCost && <span className={styles.headNote}>{t('costNeverShown')}</span>}
        </div>

        <div className={styles.lines}>
          <div className={styles.lineScroll}>
            <div className={styles.lineGrid}>
            <div className={styles.lineHead} role="row" data-cost={canRecordCost ? 'true' : 'false'}>
              <span>{t('lineCode')}</span>
              <span>{t('lineDescription')}</span>
              <span>{t('lineBasis')}</span>
              <span>{t('lineQty')}</span>
              <span>{t('lineRate')}</span>
              <span>{t('lineCurrency')}</span>
              <span className={styles.numeric}>{t('lineAmount')}</span>
              {canRecordCost && (
                <>
                  <span className={styles.internal}>{t('lineCostInternal')}</span>
                  <span className={styles.numeric}>{t('lineMargin')}</span>
                </>
              )}
              <span />
            </div>

            {option.lines.map((line, position) => {
              const amount = lineAmount(line);
              const lineCostValue = canRecordCost ? lineCost(line) : null;
              const percent = lineCostValue === null || amount === null || amount === 0
                ? null
                : Math.round(((amount - lineCostValue) / amount) * 100);
              const on = { line: position + 1 };

              return (
                <div key={line.key} className={styles.line} role="row" data-cost={canRecordCost ? 'true' : 'false'}>
                  {/*
                    Each field names its own row, so a screen reader hears
                    "Charge code, line 2" rather than ten unnamed boxes.
                  */}
                  <Autocomplete
                    label={t('lineCodeOn', on)} labelHidden
                    placeholder={t('lineCodePlaceholder')}
                    emptyHint={t('freeTextHint')}
                    maxLength={40}
                    options={codes}
                    value={line.code}
                    onValueChange={(next) => setLine(line.key, { code: next.toUpperCase() })}
                  />
                  <Input
                    label={t('lineDescriptionOn', on)} labelHidden
                    placeholder={t('lineDescriptionPlaceholder')}
                    maxLength={240}
                    value={line.description}
                    onChange={(event) => setLine(line.key, { description: event.target.value })}
                  />
                  <Autocomplete
                    label={t('lineBasisOn', on)} labelHidden
                    placeholder={t('lineBasisPlaceholder')}
                    emptyHint={t('freeTextHint')}
                    maxLength={60}
                    options={bases}
                    value={line.basis}
                    onValueChange={(next) => setLine(line.key, { basis: next })}
                  />
                  <Input
                    label={t('lineQtyOn', on)} labelHidden
                    placeholder={t('lineQtyPlaceholder')}
                    inputMode="decimal"
                    error={line.quantity !== '' && parseQuantity(line.quantity) === null
                      ? t('lineBadNumber') : undefined}
                    value={line.quantity}
                    onChange={(event) => setLine(line.key, { quantity: event.target.value })}
                  />
                  <Input
                    label={t('lineRateOn', on)} labelHidden
                    placeholder={t('lineRatePlaceholder')}
                    inputMode="decimal"
                    error={line.rate !== '' && toMinorUnits(line.rate) === null
                      ? t('lineBadNumber') : undefined}
                    value={line.rate}
                    onChange={(event) => setLine(line.key, { rate: event.target.value })}
                  />
                  {/* A select, not free text: a mistyped currency is a mispriced
                      quote, and the list is short enough to pick from. */}
                  <Select
                    label={t('lineCurrencyOn', on)} labelHidden
                    placeholder={t('lineCurrencyPlaceholder')}
                    options={currencies}
                    value={line.currency}
                    onValueChange={(next) => setLine(line.key, { currency: next })}
                  />
                  <span className={styles.amount}>{formatMoney(amount, line.currency)}</span>
                  {canRecordCost && (
                    <>
                      <Input
                        label={t('lineCostOn', on)} labelHidden
                        placeholder={t('lineRatePlaceholder')}
                        inputMode="decimal"
                        value={line.cost}
                        onChange={(event) => setLine(line.key, { cost: event.target.value })}
                      />
                      <span className={styles.lineMargin} data-tone={marginTone(percent)}>
                        {percent === null ? '—' : `${percent}%`}
                      </span>
                    </>
                  )}
                  <button
                    type="button" className={styles.lineRemove}
                    aria-label={t('lineRemoveOn', on)} disabled={option.lines.length === 1}
                    onClick={() => set({ lines: option.lines.filter((l) => l.key !== line.key) })}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
            </div>
          </div>

          {/* Inside the block's border, as the cargo grid closes: the action that
              adds a row and the band that totals them. */}
          <div className={styles.lineActions}>
            <button
              type="button" className={styles.linkAction}
              onClick={() => set({ lines: [...option.lines, emptyLine(option.currency)] })}
            >
              {t('lineAdd')}
            </button>

            <dl className={styles.totals}>
            <div>
              <dt>{t('sellTotalOf', { currency: option.currency })}</dt>
              <dd className={styles.sell}>{formatMoney(sell, option.currency)}</dd>
            </div>
            {canRecordCost && (
              <>
                <div>
                  <dt>{t('costTotal')}</dt>
                  <dd>{formatMoney(cost, option.currency)}</dd>
                </div>
                <div>
                  <dt>{t('profit')}</dt>
                  <dd className={styles.profit}>{formatMoney(profit, option.currency)}</dd>
                </div>
                <div>
                  <dt>{t('margin')}</dt>
                  <dd data-tone={marginTone(margin)}>
                    {margin === null ? '—' : `${margin.toFixed(1)} %`}
                  </dd>
                </div>
              </>
            )}
            </dl>
          </div>
        </div>
      </section>

      {/* --- where the sell price sits --- */}
      <section className={styles.card} aria-label={t('mixTitle')}>
        <span className={styles.tick} aria-hidden="true" />
        <span className={styles.eyebrow}>{t('mixTitle')}</span>

        {mix.length === 0 ? (
          <p className={styles.empty}>{t('mixEmpty')}</p>
        ) : (
          <>
            {/* Decorative: every band is repeated as a row below it. */}
            <div className={styles.mixBar} role="img" aria-label={t('mixChartLabel')}>
              {mix.map((band) => (
                <span
                  key={band.family.key}
                  className={band.family.swatch}
                  style={{ width: `${(band.value / mixTotal) * 100}%` }}
                />
              ))}
            </div>
            <ul className={styles.mixRows}>
              {mix.map((band) => (
                <li key={band.family.key} className={styles.mixRow}>
                  <span className={`${styles.swatch} ${band.family.swatch}`} aria-hidden="true" />
                  <span className={styles.mixLabel}>{t(`mixFamily_${band.family.key}`)}</span>
                  <span className={styles.mixAmount}>{formatMoney(band.value, option.currency)}</span>
                  <span className={styles.mixShare}>
                    {Math.round((band.value / mixTotal) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* --- terms --- */}
      <section className={styles.card} aria-label={t('quotationTerms')}>
        <span className={styles.tick} aria-hidden="true" />
        <span className={styles.eyebrow}>{t('quotationTermsOf', { number: index + 1 })}</span>

        <div className={styles.termsGrid}>
          <Textarea
            label={t('termsIncluded')}
            placeholder={t('termsIncludedPlaceholder')}
            rows={3}
            maxLength={4000}
            value={option.termsIncluded}
            onChange={(event) => set({ termsIncluded: event.target.value })}
          />
          <Textarea
            label={t('termsExcluded')}
            placeholder={t('termsExcludedPlaceholder')}
            rows={3}
            maxLength={4000}
            value={option.termsExcluded}
            onChange={(event) => set({ termsExcluded: event.target.value })}
          />
          <div className={styles.stack}>
            <Input
              label={t('termsPayment')}
              placeholder={t('termsPaymentPlaceholder')}
              maxLength={400}
              value={option.termsPayment}
              onChange={(event) => set({ termsPayment: event.target.value })}
            />
            <Input
              label={t('termsSubjectTo')}
              placeholder={t('termsSubjectToPlaceholder')}
              maxLength={400}
              value={option.termsSubjectTo}
              onChange={(event) => set({ termsSubjectTo: event.target.value })}
            />
          </div>
        </div>

        <div className={styles.stacked}>
          <Textarea
            label={t('optionNotes')}
            placeholder={t('optionNotesPlaceholder')}
            hint={t('optionNotesHint')}
            rows={2}
            maxLength={4000}
            value={option.notes}
            onChange={(event) => set({ notes: event.target.value })}
          />
        </div>
      </section>
    </div>
  );
}

/** Turns the editing shape back into the API shape. Null, never empty string. */
export function toApiOption(option: DraftOption) {
  const blank = (value: string) => (value.trim() === '' ? null : value.trim());
  const num = (value: string) => (value.trim() === '' ? null : Number(value));

  return {
    name: blank(option.name),
    carrierName: blank(option.carrierName),
    serviceRouting: blank(option.serviceRouting),
    transitDaysMin: num(option.transitDaysMin),
    transitDaysMax: num(option.transitDaysMax),
    nextDepartures: blank(option.nextDepartures),
    freeTimeDays: num(option.freeTimeDays),
    validUntil: option.validUntil ? new Date(option.validUntil).toISOString() : null,
    isRecommended: option.isRecommended,
    notes: blank(option.notes),
    termsIncluded: blank(option.termsIncluded),
    termsExcluded: blank(option.termsExcluded),
    termsPayment: blank(option.termsPayment),
    termsSubjectTo: blank(option.termsSubjectTo),
    chargeLines: option.lines
      // A blank row is a row the pricer started and abandoned, not a zero charge.
      .filter((line) => line.description.trim() !== '')
      .map((line) => ({
        code: blank(line.code),
        description: line.description.trim(),
        basis: blank(line.basis),
        quantity: parseQuantity(line.quantity) ?? 1,
        rateMinorUnits: toMinorUnits(line.rate) ?? 0,
        currency: (line.currency || option.currency).toUpperCase(),
        costMinorUnits: toMinorUnits(line.cost),
      })),
  };
}

/** Turns an API option back into the editing shape, for re-pricing. */
export function fromApiOption(option: {
  name: string | null; carrierName: string | null; serviceRouting: string | null;
  transitDaysMin: number | null; transitDaysMax: number | null; nextDepartures: string | null;
  freeTimeDays: number | null; validUntil: string | null; isRecommended: boolean;
  notes: string | null; termsIncluded: string | null; termsExcluded: string | null;
  termsPayment: string | null; termsSubjectTo: string | null; currency: string | null;
  chargeLines: { code: string | null; description: string; basis: string | null; quantity: number;
    rateMinorUnits: number; currency?: string | null; costMinorUnits: number | null }[];
}): DraftOption {
  const currency = option.currency ?? 'EUR';

  return {
    key: crypto.randomUUID(),
    name: option.name ?? '',
    carrierName: option.carrierName ?? '',
    serviceRouting: option.serviceRouting ?? '',
    transitDaysMin: option.transitDaysMin?.toString() ?? '',
    transitDaysMax: option.transitDaysMax?.toString() ?? '',
    nextDepartures: option.nextDepartures ?? '',
    freeTimeDays: option.freeTimeDays?.toString() ?? '',
    validUntil: option.validUntil ? option.validUntil.slice(0, 10) : '',
    isRecommended: option.isRecommended,
    notes: option.notes ?? '',
    termsIncluded: option.termsIncluded ?? '',
    termsExcluded: option.termsExcluded ?? '',
    termsPayment: option.termsPayment ?? '',
    termsSubjectTo: option.termsSubjectTo ?? '',
    currency,
    lines: option.chargeLines.length === 0
      ? [emptyLine(currency)]
      : option.chargeLines.map((line) => ({
          key: crypto.randomUUID(),
          code: line.code ?? '',
          description: line.description,
          basis: line.basis ?? '',
          quantity: String(line.quantity),
          rate: fromMinorUnits(line.rateMinorUnits),
          currency: line.currency ?? currency,
          cost: fromMinorUnits(line.costMinorUnits),
        })),
  };
}
