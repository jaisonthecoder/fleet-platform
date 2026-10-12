import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';

import { Input, Select } from '../../../design-system';
import { REFERENCE, useReferenceOptions } from '../../../shared/reference/useReference';

import styles from './SpecialHandlingEditors.module.css';

/* ── temperature control ──────────────────────────────────────────────────── */

export interface TemperatureDraft {
  setPointCelsius: string;
  toleranceCelsius: string;
  ventilation: string;
  controlledAtmosphere: boolean;
  preCoolingRequired: boolean;
  dataLogger: string;
}

export function emptyTemperature(): TemperatureDraft {
  return {
    setPointCelsius: '',
    toleranceCelsius: '',
    ventilation: 'CLOSED',
    controlledAtmosphere: false,
    preCoolingRequired: false,
    dataLogger: 'NONE',
  };
}

/** Accepts a negative, unlike the positive-only parser the cargo lines use. */
const signed = (value: string): number | null => {
  // `Number('')` is 0, not NaN. Without this guard an untouched reefer draft
  // passes the completeness gate and ships "keep it at 0 degrees", and a blank
  // tolerance becomes the much stricter "plus or minus nothing".
  const text = value.trim();
  if (text === '') return null;

  const parsed = Number(text.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const positive = (value: string): number | null => {
  const parsed = signed(value);
  return parsed !== null && parsed > 0 ? parsed : null;
};

export interface TemperatureControlEditorProps {
  value: TemperatureDraft;
  onChange: (next: TemperatureDraft) => void;
}

/**
 * Reefer settings for the request.
 *
 * The set point is the only required figure. Everything else has a sensible
 * default and a customer who has not decided yet still gets a price - the
 * specialist confirms ventilation and pre-cooling against the commodity anyway.
 */
export function TemperatureControlEditor({ value, onChange }: TemperatureControlEditorProps) {
  const { t } = useTranslation();

  const ventilations = useReferenceOptions(REFERENCE.reeferVentilation, { audience: 'customer' });
  const loggers = useReferenceOptions(REFERENCE.reeferDataLogger, { audience: 'customer' });

  const patch = (change: Partial<TemperatureDraft>) => onChange({ ...value, ...change });

  return (
    <div className={styles.panel} data-tone="info">
      <h3 className={styles.title}>{t('tempTitle')}</h3>
      <p className={styles.intro}>{t('tempIntro')}</p>

      <div className={styles.fields}>
        <Input
          label={t('tempSetPoint')} required inputMode="text"
          placeholder={t('tempSetPointPlaceholder')}
          hint={t('tempSetPointHint')}
          value={value.setPointCelsius}
          onChange={(event) => patch({ setPointCelsius: event.target.value })}
        />
        <Input
          label={t('tempTolerance')} inputMode="decimal"
          placeholder={t('tempTolerancePlaceholder')}
          hint={t('tempToleranceHint')}
          value={value.toleranceCelsius}
          onChange={(event) => patch({ toleranceCelsius: event.target.value })}
        />
        <Select
          label={t('tempVentilation')} value={value.ventilation}
          options={ventilations.length > 0 ? ventilations : [{ value: 'CLOSED', label: 'Closed' }]}
          onValueChange={(next) => patch({ ventilation: next })}
        />

        {/*
          Selects, not checkboxes, and in the same row as the rest.
          "Not required" stated is a different answer from a box nobody ticked -
          the first is the customer telling us, the second is silence we would
          have to chase. Both are settings of the same reefer, so they belong
          beside the set point rather than in a separate row of flags.
        */}
        <Select
          label={t('tempControlledAtmosphere')}
          value={value.controlledAtmosphere ? 'yes' : 'no'}
          options={[
            { value: 'no', label: t('tempNotRequired') },
            { value: 'yes', label: t('tempRequired') },
          ]}
          onValueChange={(next) => patch({ controlledAtmosphere: next === 'yes' })}
        />
        <Select
          label={t('tempPreCooling')}
          value={value.preCoolingRequired ? 'yes' : 'no'}
          options={[
            { value: 'no', label: t('tempNotRequired') },
            { value: 'yes', label: t('tempPreCoolRequired') },
          ]}
          onValueChange={(next) => patch({ preCoolingRequired: next === 'yes' })}
        />
        <Select
          label={t('tempDataLogger')} value={value.dataLogger}
          options={loggers.length > 0 ? loggers : [{ value: 'NONE', label: '—' }]}
          onValueChange={(next) => patch({ dataLogger: next })}
        />
      </div>
    </div>
  );
}

export function temperatureComplete(value: TemperatureDraft): boolean {
  const setPoint = signed(value.setPointCelsius);
  return setPoint !== null && setPoint >= -70 && setPoint <= 40;
}

/** Null when incomplete, so the gate and the payload cannot disagree. */
export function toTemperatureInput(value: TemperatureDraft) {
  if (!temperatureComplete(value)) return undefined;

  const tolerance = signed(value.toleranceCelsius);

  return {
    setPointCelsius: signed(value.setPointCelsius)!,
    // Zero is a real answer, so only an unparseable value is omitted.
    toleranceCelsius: tolerance !== null && tolerance >= 0 ? tolerance : undefined,
    ventilation: value.ventilation || undefined,
    controlledAtmosphere: value.controlledAtmosphere,
    preCoolingRequired: value.preCoolingRequired,
    dataLogger: value.dataLogger || undefined,
  };
}

/* ── out of gauge ─────────────────────────────────────────────────────────── */

export interface OversizeDraft {
  key: string;
  description: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  weightKg: string;
  liftingMethod: string;
}

export function emptyOversize(): OversizeDraft {
  return {
    key: crypto.randomUUID(),
    description: '', lengthCm: '', widthCm: '', heightCm: '', weightKg: '',
    liftingMethod: '',
  };
}

export interface OversizeEditorProps {
  entries: OversizeDraft[];
  onChange: (entries: OversizeDraft[]) => void;
}

/**
 * Every oversized or heavy piece, one row each.
 *
 * Not the longest and the heaviest: lifting equipment is quoted per piece, so a
 * summary is how a second crane goes unbooked.
 */
export function OversizeEditor({ entries, onChange }: OversizeEditorProps) {
  const { t } = useTranslation();
  const methods = useReferenceOptions(REFERENCE.liftingMethod, { audience: 'customer' });

  const patch = (key: string, change: Partial<OversizeDraft>) =>
    onChange(entries.map((entry) => (entry.key === key ? { ...entry, ...change } : entry)));

  const heaviest = entries.reduce((max, e) => Math.max(max, positive(e.weightKg) ?? 0), 0);
  const longest = entries.reduce((max, e) => Math.max(max, positive(e.lengthCm) ?? 0), 0);

  return (
    <div className={styles.panel} data-tone="warning">
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>{t('oogTitle')}</h3>
          <p className={styles.intro}>{t('oogIntro')}</p>
        </div>
      </div>

      {entries.length === 0 && <p className={styles.empty}>{t('oogEmpty')}</p>}

      {/*
        The same grid the cargo lines use, for the same reason.
        Each piece used to be a card of six labelled fields, so five pieces meant
        thirty labels and no way to compare one length against another. A table
        names each column once and puts the values under it - which is how anybody
        reading these actually uses them.
      */}
      {entries.length > 0 && (
        <div className={styles.lineScroll} data-scroll="compact">
          <div className={styles.lineGrid} role="table" aria-label={t('oogTitle')}>
            <div className={styles.lineHead} role="row">
              <span role="columnheader">{t('oogDescription')}</span>
              <span role="columnheader">{t('oogLength')}</span>
              <span role="columnheader">{t('oogWidth')}</span>
              <span role="columnheader">{t('oogHeight')}</span>
              <span role="columnheader">{t('oogWeight')}</span>
              <span role="columnheader">{t('oogLifting')}</span>
              <span role="columnheader" className="noa-visually-hidden">{t('oogRemove')}</span>
            </div>

            {entries.map((entry, index) => (
              <div key={entry.key} className={styles.line} role="row">
                {/* Every field names its own row, so a screen reader hears
                    "Length, piece 2" rather than a wall of unnamed boxes. */}
                <Input
                  label={t('oogDescriptionOn', { piece: index + 1 })} labelHidden
                  placeholder={t('oogDescriptionPlaceholder')}
                  required maxLength={240} value={entry.description}
                  onChange={(event) => patch(entry.key, { description: event.target.value })}
                />
                <Input
                  label={t('oogLengthOn', { piece: index + 1 })} labelHidden
                  placeholder={t('oogCmPlaceholder')}
                  required inputMode="decimal" value={entry.lengthCm}
                  onChange={(event) => patch(entry.key, { lengthCm: event.target.value })}
                />
                <Input
                  label={t('oogWidthOn', { piece: index + 1 })} labelHidden
                  placeholder={t('oogCmPlaceholder')}
                  required inputMode="decimal" value={entry.widthCm}
                  onChange={(event) => patch(entry.key, { widthCm: event.target.value })}
                />
                <Input
                  label={t('oogHeightOn', { piece: index + 1 })} labelHidden
                  placeholder={t('oogCmPlaceholder')}
                  required inputMode="decimal" value={entry.heightCm}
                  onChange={(event) => patch(entry.key, { heightCm: event.target.value })}
                />
                <Input
                  label={t('oogWeightOn', { piece: index + 1 })} labelHidden
                  placeholder={t('oogKgPlaceholder')}
                  required inputMode="decimal" value={entry.weightKg}
                  onChange={(event) => patch(entry.key, { weightKg: event.target.value })}
                />
                <Select
                  label={t('oogLiftingOn', { piece: index + 1 })} labelHidden
                  value={entry.liftingMethod}
                  options={[{ value: '', label: t('oogLiftingUnknown') }, ...methods]}
                  onValueChange={(next) => patch(entry.key, { liftingMethod: next })}
                />
                <button
                  type="button" className={styles.remove}
                  aria-label={t('oogRemoveOn', { piece: index + 1 })}
                  onClick={() => onChange(entries.filter((e) => e.key !== entry.key))}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button" className={styles.add}
        onClick={() => onChange([...entries, emptyOversize()])}
      >
        {t('oogAdd')}
      </button>

      {/*
        A totals band, not a sentence.
        The three figures a pricer reads off this panel are how many pieces, the
        heaviest and the longest - the first decides how many lifts, the other two
        decide whether the equipment on site can do them at all. As prose they had
        to be parsed; as a row they are read.
      */}
      {entries.length > 0 && (
        <dl className={styles.totals}>
          <div>
            <dt>{t('oogTotalItems')}</dt>
            <dd>{entries.length.toLocaleString()}</dd>
          </div>
          <div>
            <dt>{t('oogHeaviest')}</dt>
            <dd>{t('reqKg', { kg: heaviest.toLocaleString() })}</dd>
          </div>
          <div>
            <dt>{t('oogLongest')}</dt>
            {/* Drawn in the accent because length is what strands a piece at a
                gate: a crane can be hired, a bend in the road cannot. */}
            <dd className={styles.totalLead}>{t('oogCm', { cm: longest.toLocaleString() })}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

export function oversizeComplete(entries: OversizeDraft[]): boolean {
  return entries.length > 0 && entries.every((entry) => toOversizeInput(entry) !== null);
}

/** Null when incomplete. One function decides both the gate and the payload. */
export function toOversizeInput(entry: OversizeDraft) {
  const lengthCm = positive(entry.lengthCm);
  const widthCm = positive(entry.widthCm);
  const heightCm = positive(entry.heightCm);
  const weightKg = positive(entry.weightKg);

  if (
    entry.description.trim() === ''
    || lengthCm === null || widthCm === null || heightCm === null || weightKg === null
  ) {
    return null;
  }

  return {
    description: entry.description.trim(),
    lengthCm,
    widthCm,
    heightCm,
    weightKg,
    liftingMethod: entry.liftingMethod || undefined,
  };
}
