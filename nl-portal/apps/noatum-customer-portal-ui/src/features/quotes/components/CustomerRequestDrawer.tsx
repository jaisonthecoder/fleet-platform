import { useTranslation } from 'react-i18next';
import { formatDate } from '../../../design-system';
import { cargoLabelsFrom, DangerousGoodsSummary } from '../../../shared/dangerous-goods/DangerousGoodsSummary';
import { EquipmentSummary } from '../../../shared/equipment/EquipmentSummary';
import { OversizeSummary, TemperatureSummary } from '../../../shared/special-handling/SpecialHandlingSummary';
import { RequestDrawer, type RequestTab } from '../../../shared/quotations/RequestDrawer';
import type { CustomerQuote } from '../api/quotes';
import styles from './CustomerRequestDrawer.module.css';

interface PackageLine {
  lineId?: string;
  quantity?: number;
  packageType?: string;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  weightKg?: number;
}

interface RequestExtras {
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
  data: CustomerQuote;
  onClose: () => void;
}

/**
 * The request as the customer submitted it, for the customer.
 *
 * The same sheet the pricing desk reads, minus the three things that are ours
 * rather than theirs: the CargoWise organisation, which account the request was
 * routed to, and who at Noatum is handling it. A customer checking what they
 * asked for should not have to step over our internal routing to find it.
 */
export function CustomerRequestDrawer({ data, onClose }: Props) {
  const { t } = useTranslation();

  const extra = (data.payload ?? {}) as RequestExtras;
  const packages = extra.packages ?? [];
  const cargoLineLabels = cargoLabelsFrom(data.payload);

  const submitted = `${formatDate(data.createdAt)} ${new Date(data.createdAt)
    .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`;

  const kg = (value: number | null) =>
    value === null ? null : t('optKg', { kg: value.toLocaleString() });

  const tabs: RequestTab[] = [
    {
      id: 'shipment',
      label: t('optReqTab_shipment'),
      sections: [{
        title: t('optReqTab_shipment'),
        keys: t('optReqKeys_shipment'),
        facts: [
          { label: t('optReqMode'), value: t(`mode_${data.mode}`, { defaultValue: data.mode }) },
          { label: t('optReqLoadType'), value: data.loadType },
          {
            label: t('optReqDirection'),
            value: extra.direction
              ? t(`reqDirection_${extra.direction}`, { defaultValue: extra.direction })
              : null,
          },
          {
            label: t('optReqIncoterm'),
            value: data.incoterm ? [data.incoterm, extra.namedPlace].filter(Boolean).join(' · ') : null,
          },
          {
            label: t('optReqScope'),
            value: extra.scope ? t(`reqScope_${extra.scope}`, { defaultValue: extra.scope }) : null,
          },
          { label: t('optReqServiceLevel'), value: data.serviceLevel },
          { label: t('optReqCurrency'), value: data.currency },
        ],
      }],
    },
    {
      id: 'route',
      label: t('optReqTab_route'),
      sections: [{
        title: t('optReqTab_route'),
        keys: t('optReqKeys_route'),
        facts: [
          { label: t('optReqOrigin'), value: data.originCode },
          { label: t('optReqDestination'), value: data.destinationCode },
          { label: t('optReqPickup'), value: extra.pickupAddress, wide: true },
          { label: t('optReqDelivery'), value: extra.deliveryAddress, wide: true },
          { label: t('optReqReady'), value: data.readyDate ? formatDate(data.readyDate) : null },
          {
            label: t('optReqLatestDelivery'),
            value: extra.latestDeliveryDate ? formatDate(extra.latestDeliveryDate) : null,
          },
          {
            label: t('optReqFlexibility'),
            value: extra.dateFlexibility
              ? t(`reqFlexibility_${extra.dateFlexibility}`, { defaultValue: extra.dateFlexibility })
              : null,
          },
        ],
      }],
    },
    {
      id: 'cargo',
      label: t('optReqTab_cargo'),
      sections: [
        {
          title: t('optReqTab_cargo'),
          keys: t('optReqKeys_cargo'),
          facts: [
            { label: t('optReqCommodity'), value: extra.commodity, wide: true },
            { label: t('optReqHsCode'), value: extra.hsCode },
            { label: t('optReqCountryOfOrigin'), value: extra.countryOfOrigin },
            { label: t('optReqGross'), value: kg(data.grossWeightKg) },
            {
              label: t('optReqVolume'),
              value: data.volumeM3 === null ? null : t('optM3', { m3: data.volumeM3.toLocaleString() }),
            },
            { label: t('optReqChargeable'), value: kg(data.chargeableKg) },
            {
              label: t('optReqCargoValue'),
              value: extra.cargoValue ? `${data.currency} ${extra.cargoValue.toLocaleString()}` : null,
            },
          ],
          body: (
            <>
              {data.equipment.length > 0 && (
                <>
                  <p className={styles.blockTitle}>{t('optReqEquipment')}</p>
                  <EquipmentSummary entries={data.equipment} />
                </>
              )}

              {packages.length > 0 && (
                <div className={styles.lines}>
                  <p className={styles.blockTitle}>{t('optReqPackageLines')}</p>
                  <div className={styles.lineGrid}>
                    <div className={`${styles.lineRow} ${styles.lineHead}`}>
                      <span>{t('optReqPieces')}</span>
                      <span>{t('optReqPackaging')}</span>
                      <span>{t('optReqDimensions')}</span>
                      <span className={styles.numeric}>{t('optReqGrossEach')}</span>
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
                              ? t('optReqDimsCm', { l: line.lengthCm, w: line.widthCm, h: line.heightCm })
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
          title: t('optReqDangerous'),
          keys: t('optReqKeys_dangerous'),
          body: <DangerousGoodsSummary entries={data.dangerousGoods} lineLabels={cargoLineLabels} />,
        }] : []),
        ...(data.temperatureControl !== null ? [{
          title: t('optReqTemperature'),
          keys: t('optReqKeys_temperature'),
          body: <TemperatureSummary value={data.temperatureControl} />,
        }] : []),
        ...(data.oversizeItems.length > 0 ? [{
          title: t('optReqOversize'),
          keys: t('optReqKeys_oversize'),
          body: <OversizeSummary entries={data.oversizeItems} />,
        }] : []),
      ],
    },
    {
      id: 'services',
      label: t('optReqTab_services'),
      sections: [{
        title: t('optReqTab_services'),
        keys: t('optReqKeys_services'),
        body: (
          <>
            <p className={styles.blockTitle}>{t('optReqAdditionalServices')}</p>
            {extra.additionalServices && extra.additionalServices.length > 0 ? (
              <ul className={styles.chips}>
                {extra.additionalServices.map((service) => (
                  <li key={service}>{t(`reqService_${service}`, { defaultValue: service })}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>{t('optReqNoServices')}</p>
            )}

            <p className={`${styles.blockTitle} ${styles.spaced}`}>{t('optReqSpecialHandling')}</p>
            {extra.specialHandling && extra.specialHandling.length > 0 ? (
              <ul className={styles.chips}>
                {extra.specialHandling.map((handling) => (
                  <li key={handling}>{t(`reqHandling_${handling}`, { defaultValue: handling })}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>{t('optReqNoHandling')}</p>
            )}
          </>
        ),
      }],
    },
    {
      id: 'parties',
      label: t('optReqTab_parties'),
      sections: [{
        title: t('optReqTab_parties'),
        keys: t('optReqKeys_parties'),
        facts: [
          { label: t('optReqShipper'), value: extra.shipper, wide: true },
          { label: t('optReqConsignee'), value: extra.consignee, wide: true },
        ],
      }],
    },
    {
      id: 'references',
      label: t('optReqTab_references'),
      sections: [{
        title: t('optReqTab_references'),
        keys: t('optReqKeys_references'),
        facts: [
          { label: t('optReqQuoteReference'), value: data.reference },
          { label: t('optReqYourReference'), value: data.customerReference },
          { label: t('optReqCostCentre'), value: extra.costCentre },
          {
            label: t('optReqFreightPayable'),
            value: extra.freightPayable
              ? t(`reqPayable_${extra.freightPayable}`, { defaultValue: extra.freightPayable })
              : null,
          },
          { label: t('optReqSubmittedAt'), value: submitted },
        ],
        body: data.notes ? (
          <>
            <p className={styles.blockTitle}>{t('optReqYourRemarks')}</p>
            <p className={styles.note}>{data.notes}</p>
          </>
        ) : undefined,
      }],
    },
  ];

  return (
    <RequestDrawer
      eyebrow={t('optReqEyebrow')}
      title={data.reference}
      provenance={
        <>
          {t('optReqSubmitted', { when: submitted })}
          {' · '}
          <span className={styles.readOnly}>{t('optReqReadOnly')}</span>
        </>
      }
      tabs={tabs}
      closeLabel={t('close')}
      sectionsLabel={t('optReqSections')}
      onClose={onClose}
    />
  );
}
