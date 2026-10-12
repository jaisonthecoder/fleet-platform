import { useTranslation } from 'react-i18next';

import { Badge } from '../../design-system';

import styles from './EquipmentSummary.module.css';

/** Mirrors `QuoteEquipmentDto`. */
export interface QuoteEquipment {
  id: string;
  position: number;
  unitId: string;
  containerType: string;
  quantity: number;
  grossWeightPerUnitKg: number | null;
  notes: string | null;
}

/**
 * The containers a request asked for, read only.
 *
 * Shared by the pricing screen and the customer's own quote. The pricer needs it
 * to price: `PER_CONTAINER` is the first charge basis in the catalogue, and it
 * multiplies by the count shown here.
 */
export function EquipmentSummary({ entries }: { entries: QuoteEquipment[] }) {
  const { t } = useTranslation();

  if (entries.length === 0) return null;

  const totalUnits = entries.reduce((sum, entry) => sum + entry.quantity, 0);

  return (
    <div className={styles.list}>
      {entries.map((entry) => (
        <div key={entry.id} className={styles.entry}>
          <span className={styles.name}>
            {entry.quantity} × {entry.containerType}
          </span>
          {entry.grossWeightPerUnitKg !== null && (
            <Badge tone="neutral">
              {t('eqSumGross')}: {entry.grossWeightPerUnitKg.toLocaleString()} kg
            </Badge>
          )}
          {entry.notes && <span className={styles.notes}>{entry.notes}</span>}
        </div>
      ))}
      <p className={styles.total}>{t('eqCount', { count: totalUnits })}</p>
    </div>
  );
}
