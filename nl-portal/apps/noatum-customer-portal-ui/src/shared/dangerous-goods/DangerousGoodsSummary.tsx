import { useTranslation } from 'react-i18next';

import { Badge } from '../../design-system';
import { REFERENCE, useReferenceLabelMap } from '../reference/useReference';

import styles from './DangerousGoodsSummary.module.css';

/** Mirrors `DangerousGoodsEntryDto`. Both audiences see the same fields. */
export interface DangerousGoodsEntry {
  id: string;
  position: number;
  unNumber: string;
  hazardClass: string;
  properShippingName: string;
  subsidiaryRisks: string[];
  packingGroup: string | null;
  technicalName: string | null;
  flashpointCelsius: number | null;
  emsCode: string | null;
  isMarinePollutant: boolean;
  packagingType: string | null;
  unPackagingCode: string | null;
  packageCount: number | null;
  netQuantityPerPackage: number | null;
  quantityUnit: string | null;
  transportRegime: string | null;
  isInOverpack: boolean;
  appliesToLines: string[];
  notes: string | null;
}

export interface DangerousGoodsSummaryProps {
  entries: DangerousGoodsEntry[];
  /** Cargo line labels keyed by lineId, so the link reads as cargo, not as a uuid. */
  lineLabels?: Record<string, string>;
}

/**
 * What the customer declared, read only.
 *
 * The same component serves the pricing screen and the customer's own quote,
 * which is safe here where it would not be for the quote itself: there is
 * nothing internal on a hazard. Both audiences must see exactly what was
 * declared - a pricer working from a summary that quietly dropped a field is
 * the difference between a priced shipment and a refused one.
 *
 * Renders nothing when there is nothing to show: an empty "Dangerous goods"
 * heading on an ordinary request reads as a question rather than an answer.
 */
export function DangerousGoodsSummary({ entries, lineLabels = {} }: DangerousGoodsSummaryProps) {
  const { t } = useTranslation();
  // From the lookup, not from i18n: duplicating a maintained list is how the two
  // drift apart.
  const regimeLabel = useReferenceLabelMap(REFERENCE.dgTransportRegime);

  if (entries.length === 0) return null;

  const quantity = (entry: DangerousGoodsEntry) =>
    entry.packageCount === null || entry.netQuantityPerPackage === null
      ? null
      : `${entry.packageCount} × ${entry.netQuantityPerPackage} ${entry.quantityUnit ?? ''}`.trim();

  return (
    <div className={styles.list}>
      {entries.map((entry) => (
        <article key={entry.id} className={styles.entry}>
          <header className={styles.head}>
            <span className={styles.name}>
              UN {entry.unNumber} · {entry.properShippingName}
            </span>
            <div className={styles.badges}>
              <Badge tone="error">{t('dgSumClass', { value: entry.hazardClass })}</Badge>
              {entry.subsidiaryRisks.map((risk) => (
                <Badge key={risk} tone="warning">{t('dgSumSubsidiary', { value: risk })}</Badge>
              ))}
              {entry.packingGroup !== null && entry.packingGroup !== 'NONE' && (
                <Badge tone="neutral">{t('dgSumPackingGroup', { value: entry.packingGroup })}</Badge>
              )}
              {entry.isMarinePollutant && <Badge tone="warning">{t('dgSumMarinePollutant')}</Badge>}
              {entry.transportRegime !== null && entry.transportRegime !== 'FULL' && (
                <Badge tone="info">{regimeLabel(entry.transportRegime)}</Badge>
              )}
            </div>
          </header>

          <dl className={styles.facts}>
            <Fact label={t('dgTechnicalName')} value={entry.technicalName} />
            <Fact
              label={t('dgFlashpoint')}
              value={entry.flashpointCelsius === null ? null : `${entry.flashpointCelsius} °C`}
            />
            <Fact label={t('dgEms')} value={entry.emsCode} />
            <Fact label={t('dgPackagingType')} value={entry.packagingType} />
            <Fact label={t('dgUnPackagingCode')} value={entry.unPackagingCode} />
            <Fact label={t('dgSumQuantity')} value={quantity(entry)} />
            <Fact
              label={t('dgSumOverpack')}
              value={entry.isInOverpack ? t('yes') : null}
            />
            <Fact
              label={t('dgAppliesTo')}
              value={
                entry.appliesToLines.length === 0
                  ? null
                  : entry.appliesToLines.map((id) => lineLabels[id] ?? id).join(', ')
              }
            />
          </dl>

          {entry.notes && <p className={styles.notes}>{entry.notes}</p>}
        </article>
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

interface CargoLineShape {
  lineId?: unknown;
  quantity?: unknown;
  packageType?: unknown;
}

/**
 * Builds lineId -> readable label from the submitted request.
 *
 * `payload` is untyped by contract, so every field is checked rather than
 * asserted: a malformed line must degrade to showing the raw id, never throw on
 * a screen a pricer is waiting on.
 */
export function cargoLabelsFrom(payload: unknown): Record<string, string> {
  const packages = (payload as { packages?: unknown } | null | undefined)?.packages;
  if (!Array.isArray(packages)) return {};

  const labels: Record<string, string> = {};
  packages.forEach((line: CargoLineShape, index) => {
    if (typeof line?.lineId !== 'string') return;
    const quantity = typeof line.quantity === 'number' ? line.quantity : '';
    const type = typeof line.packageType === 'string' ? line.packageType : '';
    labels[line.lineId] = `${index + 1} · ${quantity} ${type}`.trim();
  });

  return labels;
}
