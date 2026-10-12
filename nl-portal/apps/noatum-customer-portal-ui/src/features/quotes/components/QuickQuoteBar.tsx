import { useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';

import {
  Autocomplete,
  Button,
  Checkbox,
  DateField,
  FilterPills,
  Input,
  Select,
  dateParts,
  type AutocompleteOption,
  type DateParts,
} from '../../../design-system';
import { Popover, PopoverContent, PopoverTrigger } from '../../../design-system/primitives/popover';
import { useFeature } from '../../../shared/features/useFeature';
import { REFERENCE, useReference, useReferenceLabels, useReferenceOptions } from '../../../shared/reference/useReference';
import { portCodeFrom, portLabel, usePortSearch, type Port } from '../../../shared/reference/usePortSearch';
import { equipmentGrossWeight, toEquipmentInput, type EquipmentDraft } from './EquipmentPicker';
import { useCreateQuote, useSubmitQuote, type CreateQuoteBody } from '../api/quotes';
import type { LookupWriteError } from '../../admin/api/lookups';
import styles from './QuickQuoteBar.module.css';

/**
 * The short way to ask for a quote.
 *
 * Four questions on one strip — where from, where to, what load, what goods —
 * and the request is sent. It is the SAME request as the full form: the same
 * lookups, the same port directory, the same `POST /api/quotes` followed by a
 * submit. Nothing here is a second rulebook; it is a narrower doorway into the
 * one that exists.
 *
 * What it deliberately does not ask: Incoterm and named place, direction,
 * shipper and consignee, additional services, HS code, temperature, oversize.
 * Those are the full form's, and a pricing specialist can ask for them. What it
 * refuses to half-ask is dangerous goods — a hazard needs a UN number, a class
 * and a packing group before anybody can price or accept it, so ticking the box
 * hands the customer to the full request rather than sending a flag with nothing
 * behind it.
 *
 * The full request form is untouched. This is an additional door, not a
 * replacement, and the two write identical payloads apart from
 * `payload.source`, which says which door was used.
 */

type Panel = 'origin' | 'destination' | 'load' | 'goods';

type TransportMode = CreateQuoteBody['mode'];

/** One loose-cargo row, before it becomes a package line. */
interface LoadLine {
  key: string;
  quantity: string;
  packageType: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  weightKg: string;
}

/** Which load types mean containers. The same set the full form and API use. */
const CONTAINERISED = new Set(['FCL', 'FTL']);

/** The shortcuts the cargo ready calendar offers, in days from today. */
const READY_SHORTCUTS = [0, 3, 7, 14] as const;

const UNLOCODE = /^[A-Z]{2}[A-Z0-9]{3}$/;

const num = (value: string) => {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const isoDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

const addDays = (from: Date, days: number): Date => {
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next;
};

const emptyLoad = (packageType: string): LoadLine => ({
  key: crypto.randomUUID(),
  quantity: '1',
  packageType,
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  weightKg: '',
});

/**
 * Keeps the strip open while a list inside it is being used.
 *
 * The port field, the selects and the calendar each open their own layer, and
 * every one of them is portalled to the body — which is "outside" as far as this
 * popover is concerned, so choosing a container type would close the panel it
 * was chosen in. Anything that happens inside another floating layer is treated
 * as happening inside this one.
 */
type InteractOutside = NonNullable<ComponentProps<typeof PopoverContent>['onInteractOutside']>;
const keepNestedOpen: InteractOutside = (event) => {
  const target = event.detail.originalEvent.target as HTMLElement | null;
  if (target?.closest?.('[data-radix-popper-content-wrapper]')) event.preventDefault();
};

export interface QuickQuoteBarProps {
  /**
   * Called with the new quotation's id once it has been created and submitted.
   * Left out, the strip opens the quotation it just made.
   */
  onSubmitted?: (id: string) => void;
  /** Where the full request lives, for the link out and the hazard path. */
  fullFormHref?: string;
}

export function QuickQuoteBar({
  onSubmitted,
  fullFormHref = '/app/quotations/new',
}: QuickQuoteBarProps = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const create = useCreateQuote();
  const submit = useSubmitQuote();
  const mayDeclareHazards = useFeature('quotations.dangerous_goods');

  const [panel, setPanel] = useState<Panel | null>(null);

  const [originText, setOriginText] = useState('');
  const [originCode, setOriginCode] = useState('');
  const [originPort, setOriginPort] = useState<Port | null>(null);
  const [originDoor, setOriginDoor] = useState(false);
  const [pickupAddress, setPickupAddress] = useState('');

  const [destinationText, setDestinationText] = useState('');
  const [destinationCode, setDestinationCode] = useState('');
  const [destinationPort, setDestinationPort] = useState<Port | null>(null);
  const [destinationDoor, setDestinationDoor] = useState(true);
  const [deliveryAddress, setDeliveryAddress] = useState('');

  const [service, setService] = useState('');
  const [containers, setContainers] = useState<EquipmentDraft[]>([]);
  const [loads, setLoads] = useState<LoadLine[]>([]);

  const [commodity, setCommodity] = useState('');
  const [cargoValue, setCargoValue] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [readyDate, setReadyDate] = useState('');
  const [hazardous, setHazardous] = useState(false);

  /*
   * Every option list is the lookups' — the same rows the full form reads, so a
   * mode retired on the Lookups screen disappears from both doors at once.
   */
  const modeItems = useReference(REFERENCE.transportMode, { audience: 'customer' });
  const loadTypeItems = useReference(REFERENCE.loadType, { audience: 'customer' });
  const containerItems = useReference(REFERENCE.containerType, { audience: 'customer' });
  const packagingOptions = useReferenceLabels(REFERENCE.packageType, { audience: 'customer' });
  const commodityOptions = useReferenceLabels(REFERENCE.commodityGroup, { audience: 'customer' });
  const currencyOptions = useReferenceOptions(REFERENCE.currency, { audience: 'customer' });

  /*
   * "Sea FCL", "Sea LCL", "Air" — mode and load type as one choice, exactly as
   * the full form's service cards present them. The request still carries the
   * two fields separately, because that is what the contract and CargoWise
   * expect; joining them is presentation, and it is what lets one pill decide
   * whether this load is containers or packages.
   */
  const services = useMemo(() => {
    const modes = modeItems.data ?? [];
    const types = loadTypeItems.data ?? [];
    return modes.flatMap((item) => {
      const forMode = types.filter((load) => {
        const scoped = (load.metadata as { modes?: unknown } | null)?.modes;
        return !Array.isArray(scoped) || scoped.length === 0 || scoped.includes(item.code);
      });
      if (forMode.length === 0) {
        return [{ key: `${item.code}:`, mode: item.code, loadType: undefined as string | undefined, label: item.label }];
      }
      return forMode.map((load) => ({
        key: `${item.code}:${load.code}`,
        mode: item.code,
        loadType: load.code as string | undefined,
        label: `${item.label} ${load.code}`,
      }));
    });
  }, [modeItems.data, loadTypeItems.data]);

  const chosen = services.find((item) => item.key === service);
  const mode = (chosen?.mode ?? '') as TransportMode;
  const loadType = chosen?.loadType;
  const containerised = Boolean(loadType && CONTAINERISED.has(loadType));

  const originSearch = usePortSearch(originText, { mode });
  const destinationSearch = usePortSearch(destinationText, { mode });

  const asOptions = (ports: Port[]): AutocompleteOption[] =>
    ports.map((port) => ({
      value: portLabel(port),
      label: portLabel(port),
      hint: port.countryName ?? port.countryCode,
    }));

  const containerOptions = (containerItems.data ?? []).map((item) => ({
    value: item.code,
    label: item.label,
  }));
  const packageOptions = packagingOptions.map((label) => ({ value: label, label }));
  const defaultPackage = packagingOptions[0] ?? 'Pallets';

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const readyParts: DateParts | null = useMemo(
    () =>
      dateParts(readyDate, {
        today,
        formatRelative: (days) => (days === 0 ? t('reqDateToday') : t('reqDateInDays', { count: days })),
      }),
    [readyDate, today, t],
  );

  const weight = containerised
    ? equipmentGrossWeight(containers)
    : loads.reduce((sum, line) => {
        const each = num(line.weightKg);
        const units = num(line.quantity);
        return sum + (each !== null && units !== null ? each * units : 0);
      }, 0);

  const volume = containerised
    ? 0
    : loads.reduce((sum, line) => {
        const l = num(line.lengthCm);
        const w = num(line.widthCm);
        const h = num(line.heightCm);
        const q = num(line.quantity);
        if (l === null || w === null || h === null || q === null) return sum;
        return sum + (l * w * h * q) / 1_000_000;
      }, 0);

  const scope = `${originDoor ? 'door' : 'port'}_${destinationDoor ? 'door' : 'port'}`;

  /*
   * What the server will accept, asked here so the strip does not offer a button
   * that fails. Origin, destination, commodity and a weight are the contract's
   * own required set; the rest are this doorway's: a service, because mode is
   * required and a container load with no container prices nothing, and an
   * address wherever the customer asked for a door.
   */
  const okRoute =
    UNLOCODE.test(originCode)
    && UNLOCODE.test(destinationCode)
    && (!originDoor || pickupAddress.trim() !== '')
    && (!destinationDoor || deliveryAddress.trim() !== '');
  const okLoad = Boolean(mode) && weight > 0 && (!containerised || containers.length > 0);
  const okGoods = commodity.trim() !== '' && readyDate !== '';
  const ready = okRoute && okLoad && okGoods && !hazardous;

  const sending = create.isPending || submit.isPending;
  const failure = (create.error ?? submit.error) as LookupWriteError | null;

  const send = async () => {
    const created = (await create.mutateAsync({
      mode,
      loadType,
      originCode,
      destinationCode,
      commodity: commodity.trim(),
      grossWeightKg: weight,
      volumeM3: volume > 0 ? volume : undefined,
      currency,
      readyDate,
      packages: containerised
        ? undefined
        : loads
            .filter((line) => num(line.quantity) !== null && num(line.weightKg) !== null)
            .map((line) => ({
              lineId: line.key,
              quantity: num(line.quantity)!,
              packageType: line.packageType,
              lengthCm: num(line.lengthCm) ?? undefined,
              widthCm: num(line.widthCm) ?? undefined,
              heightCm: num(line.heightCm) ?? undefined,
              weightKg: num(line.weightKg)!,
            })),
      equipment: containerised ? containers.map(toEquipmentInput) : undefined,
      /*
       * `source` is the point of this key. A request that arrives without an
       * Incoterm or a consignee is not an incomplete full request; it came
       * through the short door, and whoever prices it should be able to see
       * that rather than guess it.
       */
      payload: {
        source: 'quick_request',
        scope,
        pickupAddress: pickupAddress.trim() || null,
        deliveryAddress: deliveryAddress.trim() || null,
        cargoValue: num(cargoValue),
      },
    })) as { id: string } | undefined;

    if (created?.id) {
      await submit.mutateAsync(created.id);
      if (onSubmitted) onSubmitted(created.id);
      else navigate(`/app/quotations/${created.id}`);
    }
  };

  /* --- what each cell reads when it is closed ----------------------------- */

  const placeSummary = (code: string, port: Port | null) => {
    if (code === '') return null;
    const country = port?.countryName ?? port?.countryCode;
    return port ? `${code} · ${port.name}${country ? `, ${country}` : ''}` : code;
  };

  const loadSummary = () => {
    if (!chosen) return null;
    if (containerised) {
      if (containers.length === 0) return chosen.label;
      return `${chosen.label} · ${containers.map((unit) => `${unit.quantity} × ${unit.containerType}`).join(' + ')}`;
    }
    const units = loads.reduce((sum, line) => sum + (num(line.quantity) ?? 0), 0);
    if (units === 0) return chosen.label;
    return `${chosen.label} · ${t('quickUnitCount', { count: units })}`;
  };

  const goodsSummary = () => {
    if (commodity.trim() === '') return null;
    return readyDate ? `${commodity.trim()} · ${readyParts?.numeric ?? readyDate}` : commodity.trim();
  };

  const cell = (
    id: Panel,
    label: string,
    value: string | null,
    placeholder: string,
    content: ReactNode,
  ) => (
    <Popover open={panel === id} onOpenChange={(next) => setPanel(next ? id : null)}>
      <PopoverTrigger asChild>
        <button type="button" className={styles.cell} data-filled={value ? 'true' : undefined}>
          <span className={styles.cellLabel}>{label}</span>
          <span className={styles.cellValue}>{value ?? placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={10}
        className={styles.panel}
        onInteractOutside={keepNestedOpen}
      >
        <div className={styles.panelBody}>{content}</div>
        <div className={styles.panelFoot}>
          <Button size="sm" variant="outline" onClick={() => setPanel(null)}>
            {t('quickDone')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <section className={styles.bar} aria-label={t('quickTitle')}>
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>{t('quickTitle')}</h2>
          <p className={styles.intro}>{t('quickIntro')}</p>
        </div>
        <Link className={styles.full} to={fullFormHref}>
          {t('quickFullForm')}
        </Link>
      </header>

      <div className={styles.strip}>
        {cell(
          'origin',
          t('quickOrigin'),
          placeSummary(originCode, originPort),
          t('quickOriginEmpty'),
          <>
            <FilterPills
              label={t('quickCollection')}
              options={[
                { value: 'port', label: t('quickAtTerminal') },
                { value: 'door', label: t('quickAtDoor') },
              ]}
              value={originDoor ? 'door' : 'port'}
              onValueChange={(value) => setOriginDoor(value === 'door')}
            />
            <Autocomplete
              label={t('reqOrigin')}
              required
              placeholder={t('reqPortPh')}
              hint={t('reqUnlocodeHint')}
              minQuery={2}
              promptHint={t('reqPortPrompt')}
              emptyHint={t('reqPortNoMatch')}
              loading={originSearch.isFetching}
              value={originText || originCode}
              options={asOptions(originSearch.data ?? [])}
              onQueryChange={setOriginText}
              error={originCode !== '' && !UNLOCODE.test(originCode) ? t('reqUnlocodeError') : undefined}
              onValueChange={(next) => {
                setOriginText(next);
                const code = portCodeFrom(next);
                setOriginCode(code);
                setOriginPort((originSearch.data ?? []).find((port) => port.code === code) ?? null);
              }}
            />
            {originDoor && (
              <Input
                label={t('reqPickupAddress')}
                required
                placeholder={t('reqAddressPh')}
                maxLength={300}
                value={pickupAddress}
                onChange={(event) => setPickupAddress(event.target.value)}
              />
            )}
          </>,
        )}

        {cell(
          'destination',
          t('quickDestination'),
          placeSummary(destinationCode, destinationPort),
          t('quickDestinationEmpty'),
          <>
            <FilterPills
              label={t('quickDelivery')}
              options={[
                { value: 'port', label: t('quickAtTerminal') },
                { value: 'door', label: t('quickAtDoor') },
              ]}
              value={destinationDoor ? 'door' : 'port'}
              onValueChange={(value) => setDestinationDoor(value === 'door')}
            />
            <Autocomplete
              label={t('reqDestination')}
              required
              placeholder={t('reqPortPh')}
              hint={t('reqUnlocodeHint')}
              minQuery={2}
              promptHint={t('reqPortPrompt')}
              emptyHint={t('reqPortNoMatch')}
              loading={destinationSearch.isFetching}
              value={destinationText || destinationCode}
              options={asOptions(destinationSearch.data ?? [])}
              onQueryChange={setDestinationText}
              error={
                destinationCode !== '' && !UNLOCODE.test(destinationCode)
                  ? t('reqUnlocodeError')
                  : undefined
              }
              onValueChange={(next) => {
                setDestinationText(next);
                const code = portCodeFrom(next);
                setDestinationCode(code);
                setDestinationPort(
                  (destinationSearch.data ?? []).find((port) => port.code === code) ?? null,
                );
              }}
            />
            {destinationDoor && (
              <Input
                label={t('reqDeliveryAddress')}
                required
                placeholder={t('reqAddressPh')}
                maxLength={300}
                value={deliveryAddress}
                onChange={(event) => setDeliveryAddress(event.target.value)}
              />
            )}
          </>,
        )}

        {cell(
          'load',
          t('quickLoad'),
          loadSummary(),
          t('quickLoadEmpty'),
          <>
            {/* The service decides everything below it: a full container load is
                described as containers, anything else as packages. */}
            <FilterPills
              label={t('quickService')}
              options={services.map((item) => ({ value: item.key, label: item.label }))}
              value={service}
              onValueChange={(value) => {
                setService(value);
                const next = services.find((item) => item.key === value);
                const isContainers = Boolean(next?.loadType && CONTAINERISED.has(next.loadType));
                if (isContainers && containers.length === 0) {
                  const first = containerOptions[0]?.value;
                  if (first) {
                    setContainers([
                      { unitId: crypto.randomUUID(), containerType: first, quantity: 1, grossWeightPerUnitKg: '' },
                    ]);
                  }
                } else if (!isContainers && loads.length === 0) {
                  setLoads([emptyLoad(defaultPackage)]);
                }
              }}
            />

            {chosen && containerised && (
              <div className={styles.rows}>
                {containers.map((unit, index) => (
                  <div className={styles.row} key={unit.unitId}>
                    <Input
                      className={styles.units}
                      label={t('quickUnits')}
                      labelHidden={index > 0}
                      type="number"
                      min={1}
                      max={1000}
                      value={String(unit.quantity)}
                      onChange={(event) =>
                        setContainers((current) =>
                          current.map((entry) =>
                            entry.unitId === unit.unitId
                              ? { ...entry, quantity: Math.max(1, Number(event.target.value) || 1) }
                              : entry,
                          ),
                        )
                      }
                    />
                    <Select
                      className={styles.grow}
                      label={t('quickContainerType')}
                      labelHidden={index > 0}
                      options={containerOptions}
                      value={unit.containerType}
                      onValueChange={(value) =>
                        setContainers((current) =>
                          current.map((entry) =>
                            entry.unitId === unit.unitId ? { ...entry, containerType: value } : entry,
                          ),
                        )
                      }
                    />
                    <Input
                      className={styles.weight}
                      label={t('quickWeightPerContainer')}
                      labelHidden={index > 0}
                      type="number"
                      min={0}
                      inputMode="decimal"
                      value={unit.grossWeightPerUnitKg}
                      onChange={(event) =>
                        setContainers((current) =>
                          current.map((entry) =>
                            entry.unitId === unit.unitId
                              ? { ...entry, grossWeightPerUnitKg: event.target.value }
                              : entry,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      className={styles.drop}
                      aria-label={t('quickRemove')}
                      disabled={containers.length === 1}
                      onClick={() =>
                        setContainers((current) => current.filter((entry) => entry.unitId !== unit.unitId))
                      }
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const first = containerOptions[0]?.value;
                    if (!first) return;
                    setContainers((current) => [
                      ...current,
                      { unitId: crypto.randomUUID(), containerType: first, quantity: 1, grossWeightPerUnitKg: '' },
                    ]);
                  }}
                >
                  <Plus size={14} aria-hidden="true" /> {t('quickAddContainer')}
                </Button>
              </div>
            )}

            {chosen && !containerised && (
              <div className={styles.rows}>
                {loads.map((line, index) => (
                  <div className={styles.row} key={line.key}>
                    <Input
                      className={styles.units}
                      label={t('quickUnits')}
                      labelHidden={index > 0}
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(event) =>
                        setLoads((current) =>
                          current.map((entry) =>
                            entry.key === line.key ? { ...entry, quantity: event.target.value } : entry,
                          ),
                        )
                      }
                    />
                    <Select
                      className={styles.grow}
                      label={t('quickPackageType')}
                      labelHidden={index > 0}
                      options={packageOptions}
                      value={line.packageType}
                      onValueChange={(value) =>
                        setLoads((current) =>
                          current.map((entry) =>
                            entry.key === line.key ? { ...entry, packageType: value } : entry,
                          ),
                        )
                      }
                    />
                    {(['lengthCm', 'widthCm', 'heightCm'] as const).map((axis) => (
                      <Input
                        key={axis}
                        className={styles.size}
                        label={t(`quick_${axis}`)}
                        labelHidden={index > 0}
                        type="number"
                        min={0}
                        inputMode="decimal"
                        value={line[axis]}
                        onChange={(event) =>
                          setLoads((current) =>
                            current.map((entry) =>
                              entry.key === line.key ? { ...entry, [axis]: event.target.value } : entry,
                            ),
                          )
                        }
                      />
                    ))}
                    <Input
                      className={styles.weight}
                      label={t('quickWeightEach')}
                      labelHidden={index > 0}
                      type="number"
                      min={0}
                      inputMode="decimal"
                      value={line.weightKg}
                      onChange={(event) =>
                        setLoads((current) =>
                          current.map((entry) =>
                            entry.key === line.key ? { ...entry, weightKg: event.target.value } : entry,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      className={styles.drop}
                      aria-label={t('quickRemove')}
                      disabled={loads.length === 1}
                      onClick={() => setLoads((current) => current.filter((entry) => entry.key !== line.key))}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLoads((current) => [...current, emptyLoad(defaultPackage)])}
                >
                  <Plus size={14} aria-hidden="true" /> {t('quickAddLoad')}
                </Button>
              </div>
            )}

            {weight > 0 && (
              <p className={styles.total}>
                {t('quickTotalWeight', { weight: weight.toLocaleString() })}
              </p>
            )}
          </>,
        )}

        {cell(
          'goods',
          t('quickGoods'),
          goodsSummary(),
          t('quickGoodsEmpty'),
          <>
            <Autocomplete
              label={t('reqCommodity')}
              required
              placeholder={t('reqCommodityPh')}
              maxLength={200}
              value={commodity}
              options={commodityOptions.map((option) => ({ value: option, label: option }))}
              emptyHint={t('reqComboFreeText')}
              onValueChange={setCommodity}
            />

            <DateField
              label={t('reqReadyDate')}
              required
              date={readyParts ?? undefined}
              placeholder={t('reqReadyDateEmpty')}
              selected={readyDate ? new Date(`${readyDate}T00:00:00Z`) : undefined}
              onSelect={(date) => setReadyDate(date ? isoDate(date) : '')}
              calendar={{
                calendarLabel: t('reqReadyDate'),
                today,
                startMonth: today,
                disabled: { before: today },
                shortcutsLabel: t('reqDateShortcuts'),
                shortcuts: READY_SHORTCUTS.map((days) => ({
                  id: `in-${days}`,
                  label: t('reqDateInDays', { count: days }),
                  date: addDays(today, days),
                })),
                legend: {
                  chosen: t('reqDateLegendChosen'),
                  sailing: t('reqDateLegendSailing'),
                  today: t('reqDateLegendToday'),
                  past: t('reqDateLegendPast'),
                },
              }}
            />

            <div className={styles.pair}>
              <Input
                label={t('reqCargoValue')}
                hint={t('reqOptional')}
                type="number"
                min={0}
                inputMode="decimal"
                value={cargoValue}
                onChange={(event) => setCargoValue(event.target.value)}
              />
              <Select
                label={t('reqCurrency')}
                options={currencyOptions}
                value={currency}
                onValueChange={setCurrency}
              />
            </div>

            {/* A hazard cannot be declared in a strip. Ticking this does not send
                a flag with nothing behind it - it says where the request has to
                be made instead. */}
            {mayDeclareHazards && (
              <div className={styles.hazard}>
                <Checkbox
                  label={t('quickHazardous')}
                  checked={hazardous}
                  onCheckedChange={(value) => setHazardous(value === true)}
                />
                {hazardous && (
                  <p className={styles.hazardNote}>
                    {t('quickHazardousNote')}{' '}
                    <Link to={fullFormHref}>{t('quickFullForm')}</Link>
                  </p>
                )}
              </div>
            )}
          </>,
        )}

        <div className={styles.act}>
          {hazardous ? (
            <Button onClick={() => navigate(fullFormHref)}>{t('quickFullForm')}</Button>
          ) : (
            // The rejection is already held on the mutation and shown in the
            // footnote below; catching it here only stops it being reported a
            // second time as an unhandled promise.
            <Button
              onClick={() => void send().catch(() => undefined)}
              disabled={!ready || sending}
            >
              {sending ? t('quickSending') : t('quickSubmit')}
            </Button>
          )}
        </div>
      </div>

      <p className={styles.foot} role={failure ? 'alert' : undefined}>
        {failure ? (failure.message || t('quickFailed')) : t('quickFootnote')}
      </p>
    </section>
  );
}
