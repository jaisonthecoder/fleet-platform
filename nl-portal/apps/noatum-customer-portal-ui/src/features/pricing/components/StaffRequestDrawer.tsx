import { useTranslation } from 'react-i18next';
import { formatDate } from '../../../design-system';
import { cargoLabelsFrom, DangerousGoodsSummary } from '../../../shared/dangerous-goods/DangerousGoodsSummary';
import { EquipmentSummary } from '../../../shared/equipment/EquipmentSummary';
import { OversizeSummary, TemperatureSummary } from '../../../shared/special-handling/SpecialHandlingSummary';
import { RequestDrawer, type RequestTab } from '../../../shared/quotations/RequestDrawer';
import type { PricingQuote } from '../api/pricing';
import styles from './StaffRequestDrawer.module.css';

/** One package line, as the request form submitted it. */
interface PackageLine {
  lineId?: string;
  quantity?: number;
  packageType?: string;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  weightKg?: number;
}

/** The long tail of the request, kept in `payload` until a field earns a column. */
export interface RequestExtras {
  direction?: string;
  scope?: string;
  namedPlace?: string | null;
  pickupAddress?: string | null;
  deliveryAddress?: string | null;
  latestDeliveryDate?: string | null;
  countryOfOrigin?: string | null;
  hsCode?: string | null;
  commodity?: string | null;
  cargoValue?: number | null;
  freightPayable?: string | null;
  costCentre?: string | null;
  shipper?: string | null;
  consignee?: string | null;
  additionalServices?: string[];
  specialHandling?: string[];
  dateFlexibility?: string | null;
  packages?: PackageLine[];
}

interface Props {
  data: PricingQuote;
  extra: RequestExtras;
  /** The request form's own labels, from the default namespace. */
  common: (key: string, options?: Record<string, unknown>) => string;
  onClose: () => void;
}

/**
 * The request as the customer submitted it, for a pricer.
 *
 * The shell is shared with the customer's own copy; what goes in it is not. A
 * pricer sees the CargoWise organisation, which account raised it and who at the
 * customer sent it - three things the customer has no use for on their own
 * screen and one they should not have to think about.
 *
 * Read only on purpose: this is the evidence a quotation is argued from, and a
 * field that looks editable invites somebody to "correct" the customer's words.
 */
export function StaffRequestDrawer({ data, extra, common, onClose }: Props) {
  const { t } = useTranslation('staff');

  const cargoLineLabels = cargoLabelsFrom(data.payload);
  const packages = extra.packages ?? [];

  // DD.MM.YYYY and a 24-hour clock, as everything customer-facing is written.
  const submitted = `${formatDate(data.createdAt)} ${new Date(data.createdAt)
    .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`;

  const kg = (value: number | null) =>
    value === null ? null : t('heroKg', { kg: value.toLocaleString() });

  const tabs: RequestTab[] = [
    {
      id: 'shipment',
      label: t('fullRequestTab_shipment'),
      sections: [{
        title: t('fullRequestTab_shipment'),
        keys: t('fullRequestKeys_shipment'),
        facts: [
          { label: t('reqMode'), value: t(`mode_${data.mode}`, { defaultValue: data.mode }) },
          { label: t('reqLoadType'), value: data.loadType },
          {
            label: t('reqDirection'),
            value: extra.direction
              ? common(`reqDirection_${extra.direction}`, { defaultValue: extra.direction })
              : null,
          },
          {
            label: t('reqIncoterm'),
            value: data.incoterm ? [data.incoterm, extra.namedPlace].filter(Boolean).join(' · ') : null,
          },
          {
            label: t('reqScopeLabel'),
            value: extra.scope ? common(`reqScope_${extra.scope}`, { defaultValue: extra.scope }) : null,
          },
          { label: t('reqService'), value: data.serviceLevel },
          { label: t('reqQuoteCurrency'), value: data.currency },
          { label: t('reqCw1Org'), value: data.cw1OrgCode },
        ],
      }],
    },
    {
      id: 'route',
      label: t('fullRequestTab_route'),
      sections: [{
        title: t('fullRequestTab_route'),
        keys: t('fullRequestKeys_route'),
        facts: [
          { label: t('reqOrigin'), value: [data.originCode, data.originName].filter(Boolean).join(' — ') },
          {
            label: t('reqDestination'),
            value: [data.destinationCode, data.destinationName].filter(Boolean).join(' — '),
          },
          { label: t('reqPickup'), value: extra.pickupAddress, wide: true },
          { label: t('reqDelivery'), value: extra.deliveryAddress, wide: true },
          { label: t('reqReady'), value: data.readyDate ? formatDate(data.readyDate) : null },
          {
            label: t('reqLatestDelivery'),
            value: extra.latestDeliveryDate ? formatDate(extra.latestDeliveryDate) : null,
          },
          {
            label: t('reqFlexibility'),
            value: extra.dateFlexibility
              ? common(`reqFlexibility_${extra.dateFlexibility}`, { defaultValue: extra.dateFlexibility })
              : null,
          },
        ],
      }],
    },
    {
      id: 'cargo',
      label: t('fullRequestTab_cargo'),
      sections: [
        {
          title: t('fullRequestTab_cargo'),
          keys: t('fullRequestKeys_cargo'),
          facts: [
            { label: t('reqCommodity'), value: extra.commodity, wide: true },
            { label: t('reqHsCode'), value: extra.hsCode },
            { label: t('reqCountryOfOrigin'), value: extra.countryOfOrigin },
            { label: t('reqGross'), value: kg(data.grossWeightKg) },
            {
              label: t('reqVolume'),
              value: data.volumeM3 === null ? null : t('heroM3', { m3: data.volumeM3.toLocaleString() }),
            },
            { label: t('reqChargeable'), value: kg(data.chargeableKg) },
            {
              label: t('reqCargoValue'),
              value: extra.cargoValue ? `${data.currency} ${extra.cargoValue.toLocaleString()}` : null,
            },
          ],
          body: (
            <>
              {data.equipment.length > 0 && (
                <>
                  <p className={styles.blockTitle}>{t('eqTitle')}</p>
                  <EquipmentSummary entries={data.equipment} />
                </>
              )}

              {/* Containers and package lines are alternatives, so only one of
                  these two ever appears. */}
              {packages.length > 0 && (
                <div className={styles.lines}>
                  <p className={styles.blockTitle}>{t('reqPackageLines')}</p>
                  <div className={styles.lineGrid}>
                    <div className={`${styles.lineRow} ${styles.lineHead}`}>
                      <span>{t('reqPieces')}</span>
                      <span>{t('reqPackaging')}</span>
                      <span>{t('reqDimensions')}</span>
                      <span className={styles.numeric}>{t('reqGrossEach')}</span>
                    </div>
                    {packages.map((line, index) => {
                      const dims = [line.lengthCm, line.widthCm, line.heightCm];
                      const sized = dims.every((value) => typeof value === 'number');
                      return (
                        <div className={styles.lineRow} key={line.lineId ?? index}>
                          <span>{line.quantity ?? '—'}</span>
                          <span>{line.packageType || '—'}</span>
                          <span>
                            {sized
                              ? t('reqDimsCm', { l: line.lengthCm, w: line.widthCm, h: line.heightCm })
                              : '—'}
                          </span>
                          <span className={styles.numeric}>
                            {line.weightKg ? kg(line.weightKg) : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ),
        },
        ...(data.dangerousGoods.length > 0 ? [{
          title: t('dgTitle'),
          keys: t('fullRequestKeys_dangerous'),
          body: <DangerousGoodsSummary entries={data.dangerousGoods} lineLabels={cargoLineLabels} />,
        }] : []),
        ...(data.temperatureControl !== null ? [{
          title: t('tempSumTitle'),
          keys: t('fullRequestKeys_temperature'),
          body: <TemperatureSummary value={data.temperatureControl} />,
        }] : []),
        ...(data.oversizeItems.length > 0 ? [{
          title: t('oogSumTitle'),
          keys: t('fullRequestKeys_oversize'),
          body: <OversizeSummary entries={data.oversizeItems} />,
        }] : []),
      ],
    },
    {
      id: 'services',
      label: t('fullRequestTab_services'),
      sections: [{
        title: t('fullRequestTab_services'),
        keys: t('fullRequestKeys_services'),
        body: (
          <>
            <p className={styles.blockTitle}>{t('reqAdditionalServices')}</p>
            {extra.additionalServices && extra.additionalServices.length > 0 ? (
              <ul className={styles.chips}>
                {extra.additionalServices.map((service) => (
                  <li key={service}>{common(`reqService_${service}`, { defaultValue: service })}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>{t('fullRequestNoServices')}</p>
            )}

            <p className={`${styles.blockTitle} ${styles.spaced}`}>{t('reqSpecialHandling')}</p>
            {extra.specialHandling && extra.specialHandling.length > 0 ? (
              <ul className={styles.chips}>
                {extra.specialHandling.map((handling) => (
                  <li key={handling}>{common(`reqHandling_${handling}`, { defaultValue: handling })}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>{t('fullRequestNoHandling')}</p>
            )}
          </>
        ),
      }],
    },
    {
      id: 'parties',
      label: t('fullRequestTab_parties'),
      sections: [{
        title: t('fullRequestTab_parties'),
        keys: t('fullRequestKeys_parties'),
        facts: [
          { label: t('reqShipper'), value: extra.shipper, wide: true },
          { label: t('reqConsignee'), value: extra.consignee, wide: true },
          { label: t('queueCustomer'), value: data.customerName },
          { label: t('reqAccount'), value: data.accountName },
          { label: t('reqRequestedBy'), value: data.requestedByName },
          { label: t('reqCw1Org'), value: data.cw1OrgCode },
        ],
      }],
    },
    {
      id: 'references',
      label: t('fullRequestTab_references'),
      sections: [{
        title: t('fullRequestTab_references'),
        keys: t('fullRequestKeys_references'),
        facts: [
          { label: t('reqQuoteReference'), value: data.reference },
          { label: t('reqCustomerRef'), value: data.customerReference },
          { label: t('reqCostCentre'), value: extra.costCentre },
          {
            label: t('reqFreightPayable'),
            value: extra.freightPayable
              ? common(`reqPayable_${extra.freightPayable}`, { defaultValue: extra.freightPayable })
              : null,
          },
          { label: t('reqSubmittedAt'), value: submitted },
        ],
        body: data.notes ? (
          <>
            <p className={styles.blockTitle}>{t('reqCustomerNotes')}</p>
            <p className={styles.note}>{data.notes}</p>
          </>
        ) : undefined,
      }],
    },
  ];

  return (
    <RequestDrawer
      eyebrow={t('fullRequestEyebrow')}
      title={data.reference}
      provenance={
        <>
          {t('fullRequestSubmitted', { when: submitted })}{' '}
          {data.requestedByName && (
            <>
              {t('fullRequestBy')} <strong>{data.requestedByName}</strong>{' '}
            </>
          )}
          · {[data.customerName, data.accountName].filter(Boolean).join(', ')}
          {data.cw1OrgCode && ` · ${data.cw1OrgCode}`}
          {' · '}
          <span className={styles.readOnly}>{t('fullRequestReadOnly')}</span>
        </>
      }
      tabs={tabs}
      closeLabel={t('close')}
      sectionsLabel={t('fullRequestSections')}
      onClose={onClose}
    />
  );
}
