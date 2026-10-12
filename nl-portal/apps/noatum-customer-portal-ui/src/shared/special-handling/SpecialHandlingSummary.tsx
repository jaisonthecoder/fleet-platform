import { useTranslation } from 'react-i18next';

import { Badge } from '../../design-system';
import { REFERENCE, useReferenceLabelMap } from '../reference/useReference';

import styles from './SpecialHandlingSummary.module.css';

/** Mirrors `TemperatureControlDto`. */
export interface TemperatureControl {
  id: string;
  setPointCelsius: number;
  toleranceCelsius: number | null;
  ventilation: string | null;
  controlledAtmosphere: boolean;
  preCoolingRequired: boolean;
  dataLogger: string | null;
  notes: string | null;
}

/** Mirrors `OversizeItemDto`. */
export interface OversizeItem {
  id: string;
  position: number;
  description: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number;
  liftingMethod: string | null;
  notes: string | null;
}

/**
 * Reefer settings, read only.
 *
 * The pricer needs them: a reefer carries its own surcharge and a road leg needs
 * a genset. The customer needs them to check what they asked for.
 */
export function TemperatureSummary({ value }: { value: TemperatureControl | null }) {
  const { t } = useTranslation();
  // Resolved from the lookup rather than duplicated into i18n, so a label an
  // administrator changes changes here too.
  const ventilationLabel = useReferenceLabelMap(REFERENCE.reeferVentilation);
  const loggerLabel = useReferenceLabelMap(REFERENCE.reeferDataLogger);

  if (value === null) return null;

  return (
    <div className={styles.block}>
      <div className={styles.badges}>
        <Badge tone="info">
          {t('tempSumSetPoint')}: {value.setPointCelsius} °C
          {value.toleranceCelsius !== null ? ` ± ${value.toleranceCelsius}` : ''}
        </Badge>
        {value.controlledAtmosphere && <Badge tone="warning">{t('tempControlledAtmosphere')}</Badge>}
        {value.preCoolingRequired && <Badge tone="warning">{t('tempPreCooling')}</Badge>}
      </div>

      <dl className={styles.facts}>
        <Fact label={t('tempSumVentilation')} value={ventilationLabel(value.ventilation)} />
        <Fact label={t('tempSumLogger')} value={loggerLabel(value.dataLogger)} />
      </dl>

      {value.notes && <p className={styles.notes}>{value.notes}</p>}
    </div>
  );
}

/** Every oversized piece. Lifting equipment is quoted from each one. */
export function OversizeSummary({ entries }: { entries: OversizeItem[] }) {
  const { t } = useTranslation();
  const liftingLabel = useReferenceLabelMap(REFERENCE.liftingMethod);

  if (entries.length === 0) return null;

  return (
    <div className={styles.list}>
      {entries.map((item) => (
        <div key={item.id} className={styles.entry}>
          <span className={styles.name}>{item.description}</span>
          <dl className={styles.facts}>
            <Fact
              label={t('oogSumDimensions')}
              value={`${item.lengthCm} × ${item.widthCm} × ${item.heightCm} cm`}
            />
            <Fact label={t('oogSumWeight')} value={`${item.weightKg.toLocaleString()} kg`} />
            <Fact label={t('oogSumLifting')} value={liftingLabel(item.liftingMethod)} />
          </dl>
          {item.notes && <p className={styles.notes}>{item.notes}</p>}
        </div>
      ))}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (value === null || value === '') return null;

  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
