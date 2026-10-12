import { useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Check, Info, Loader2, Trash2 } from 'lucide-react';

import {
  Autocomplete,
  LogisticsIcon,
  Select,
  type AutocompleteOption,
  type LogisticsIconName,
} from '../../../design-system';
import { Popover, PopoverContent, PopoverTrigger } from '../../../design-system/primitives/popover';
import { useFeature } from '../../../shared/features/useFeature';
import { REFERENCE, useReference, useReferenceOptions } from '../../../shared/reference/useReference';
import { portCodeFrom, portLabel, usePortSearch, type Port } from '../../../shared/reference/usePortSearch';
import { useCreateQuote, useSubmitQuote, type CreateQuoteBody } from '../api/quotes';
import type { LookupWriteError } from '../../admin/api/lookups';
import styles from './InstantQuoteStrip.module.css';

/**
 * The short way to ask for a quotation.
 *
 * To REFERENCE/MOCKUP-htmls-page-vice/Noatum Instant Quote.html, hero section: a
 * scope row, then four questions on one strip - where from, where to, what load,
 * what goods - and the request is sent.
 *
 * It is the SAME request the full form makes: the same lookups, the same port
 * directory, the same `POST /api/quotes` followed by a submit. Nothing here is a
 * second rulebook; it is a narrower doorway into the one that exists, and the
 * full request form is untouched.
 *
 * TWO DELIBERATE DEPARTURES FROM THE MOCKUP, both because it draws a platform we
 * do not have:
 *
 * 1. Its button says "Get instant quote". No rate source is configured anywhere
 *    here and every price is typed by a person (CLAUDE.md v4 rule 1), so the
 *    button says what actually happens.
 * 2. Its dangerous-goods path takes a bare UN number. A hazard needs a class, a
 *    packing group and quantities before anybody can price or carry it, and a
 *    lone UN number would put a hazard where nothing can query it. Ticking the
 *    box hands the customer to the full request instead.
 */

type Panel = 'origin' | 'destination' | 'load' | 'goods';
type PlaceKind = 'port' | 'door';
type TransportMode = CreateQuoteBody['mode'];

/** The four scopes, as the request payload spells them. */
const SCOPES = ['door_door', 'door_port', 'port_door', 'port_port'] as const;

/** Which load types mean containers. The same set the full form and the API use. */
const CONTAINERISED = new Set(['FCL', 'FTL']);

const UNLOCODE = /^[A-Z]{2}[A-Z0-9]{3}$/;

/** The kit glyph for each mode, as the full form's service cards use. */
const MODE_ICONS: Record<string, LogisticsIconName> = {
  sea: 'container-ship',
  air: 'air-freight',
  road: 'road-freight',
  rail: 'rail-freight',
};

/** One loose-cargo row, before it becomes a package line. */
interface Line {
  key: string;
  packageType: string;
  /** Only for a pallet: which standard footprint. Rides in the line's description. */
  palletType: string;
  quantity: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  weightKg: string;
}

/**
 * The standard pallet footprints, and the dimensions each one implies.
 *
 * In code rather than in a lookup because they are not ours to maintain: a EUR
 * pallet is 120 x 80 by ISO 6780 and has been for as long as the standard has
 * existed. The chosen one is written into the package line's description, which
 * is where the schema puts detail that has not earned a column.
 */
const PALLETS = [
  { id: 'eur', lengthCm: 120, widthCm: 80 },
  { id: 'standard', lengthCm: 120, widthCm: 100 },
  { id: 'other', lengthCm: null, widthCm: null },
] as const;

/**
 * Which package types are pallets, read from the lookup's WORDING.
 *
 * Never from the code: this lookup spells a pallet `PX`, and a regex over the
 * code is how the pallet row silently never appeared. An administrator renaming
 * or adding one is followed automatically.
 */
const palletCodesFrom = (options: { value: string; label: string }[]) =>
  new Set(options.filter((option) => /pallet/i.test(option.label)).map((option) => option.value));

/** One container load. */
interface Load {
  unitId: string;
  containerType: string;
  quantity: string;
  overweight: boolean;
}

const num = (value: string) => {
  const parsed = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const isoDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const newLine = (packageType: string, pallet = false): Line => ({
  key: crypto.randomUUID(),
  packageType,
  palletType: pallet ? 'eur' : '',
  quantity: '1',
  // A EUR pallet's footprint is known the moment it is chosen; only the height
  // and the weight are the customer's to give.
  lengthCm: pallet ? '120' : '',
  widthCm: pallet ? '80' : '',
  heightCm: '',
  weightKg: '',
});

const newLoad = (containerType: string): Load => ({
  unitId: crypto.randomUUID(),
  containerType,
  quantity: '1',
  overweight: false,
});

/**
 * Keeps a panel open while a list inside it is being used.
 *
 * The port field and the selects each open their own layer, portalled to the
 * body - which is "outside" as far as this popover is concerned, so choosing a
 * country would close the panel it was chosen in.
 */
type InteractOutside = NonNullable<ComponentProps<typeof PopoverContent>['onInteractOutside']>;
const keepNestedOpen: InteractOutside = (event) => {
  const target = event.detail.originalEvent.target as HTMLElement | null;
  if (target?.closest?.('[data-radix-popper-content-wrapper]')) event.preventDefault();
  if (target?.closest?.('[data-instant-strip]')) event.preventDefault();
};

export interface InstantQuoteStripProps {
  /** Called with the new quotation's id once it has been created and submitted. */
  onSubmitted: (id: string) => void;
  /** Where the full request lives, for the link out and the hazard path. */
  fullFormHref: string;
}

export function InstantQuoteStrip({ onSubmitted, fullFormHref }: InstantQuoteStripProps) {
  const { t } = useTranslation();

  const create = useCreateQuote();
  const submit = useSubmitQuote();
  const mayDeclareHazards = useFeature('quotations.dangerous_goods');

  const [panel, setPanel] = useState<Panel | null>(null);
  const [tried, setTried] = useState(false);

  const [scope, setScope] = useState<string>('port_door');
  const originKind: PlaceKind = scope.startsWith('door') ? 'door' : 'port';
  const destinationKind: PlaceKind = scope.endsWith('door') ? 'door' : 'port';

  const [originCountry, setOriginCountry] = useState('');
  const [originText, setOriginText] = useState('');
  const [originCode, setOriginCode] = useState('');
  const [originPort, setOriginPort] = useState<Port | null>(null);
  const [originCity, setOriginCity] = useState('');
  const [originZip, setOriginZip] = useState('');
  const [originStreet, setOriginStreet] = useState('');
  const [originDock, setOriginDock] = useState(false);

  const [destinationCountry, setDestinationCountry] = useState('');
  const [destinationText, setDestinationText] = useState('');
  const [destinationCode, setDestinationCode] = useState('');
  const [destinationPort, setDestinationPort] = useState<Port | null>(null);
  const [destinationCity, setDestinationCity] = useState('');
  const [destinationZip, setDestinationZip] = useState('');
  const [destinationStreet, setDestinationStreet] = useState('');
  const [destinationDock, setDestinationDock] = useState(false);

  const [service, setService] = useState('');
  const [loads, setLoads] = useState<Load[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [editing, setEditing] = useState(0);
  const [byTotal, setByTotal] = useState(false);
  const [totalPieces, setTotalPieces] = useState('');
  const [totalVolume, setTotalVolume] = useState('');
  const [totalWeight, setTotalWeight] = useState('');

  const [commodity, setCommodity] = useState('');
  const [cargoValue, setCargoValue] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [incoterm, setIncoterm] = useState('');
  const [hazardous, setHazardous] = useState(false);
  const [readiness, setReadiness] = useState('now');
  const [readyDate, setReadyDate] = useState('');

  // --- lookups ------------------------------------------------------------

  const modeItems = useReference(REFERENCE.transportMode, { audience: 'customer' });
  const loadTypeItems = useReference(REFERENCE.loadType, { audience: 'customer' });
  const containerItems = useReference(REFERENCE.containerType, { audience: 'customer' });
  const packageOptions = useReferenceOptions(REFERENCE.packageType, { audience: 'customer' });
  const palletCodes = useMemo(() => palletCodesFrom(packageOptions), [packageOptions]);
  const isPallet = (code: string) => palletCodes.has(code);
  const currencyOptions = useReferenceOptions(REFERENCE.currency, { audience: 'customer' });
  const countryOptions = useReferenceOptions(REFERENCE.country, { audience: 'customer' });
  const incotermOptions = useReferenceOptions(REFERENCE.incoterm, { audience: 'customer' });

  /*
   * "Sea LCL", "Sea FCL", "Air" - mode and load type as one choice, built from
   * `metadata.modes` exactly as the full form builds its service cards, so a
   * service retired on the Lookups screen disappears from both doors at once.
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
        return [{
          key: `${item.code}:`,
          mode: item.code,
          loadType: undefined as string | undefined,
          label: item.label,
        }];
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

  const containerOptions = useMemo(
    () =>
      (containerItems.data ?? []).map((item) => ({
        value: item.code,
        label: item.label,
        teu: Number((item.metadata as { teu?: unknown } | null)?.teu ?? 0) || 0,
      })),
    [containerItems.data],
  );

  const originSearch = usePortSearch(originText, { mode, country: originCountry || undefined });
  const destinationSearch = usePortSearch(destinationText, {
    mode,
    country: destinationCountry || undefined,
  });

  const asOptions = (ports: Port[]): AutocompleteOption[] =>
    ports.map((port) => ({
      value: portLabel(port),
      label: portLabel(port),
      hint: port.countryName ?? port.countryCode,
    }));

  /* The cell's prompt names the country once one is chosen - "Port or airport in
     Hong Kong" - so the strip reads as a sentence rather than a form. */
  const countryName = (code: string) =>
    countryOptions.find((option) => option.value === code)?.label ?? t('instAnywhere');

  // --- totals -------------------------------------------------------------

  const counted = useMemo(() => {
    if (containerised) {
      const count = loads.reduce((sum, load) => sum + (num(load.quantity) ?? 0), 0);
      const teu = loads.reduce((sum, load) => {
        const type = containerOptions.find((option) => option.value === load.containerType);
        return sum + (num(load.quantity) ?? 0) * (type?.teu ?? 0);
      }, 0);
      return { pieces: count, teu, volume: 0, weight: 0 };
    }
    if (byTotal) {
      return {
        pieces: num(totalPieces) ?? 0,
        teu: 0,
        volume: num(totalVolume) ?? 0,
        weight: num(totalWeight) ?? 0,
      };
    }
    return lines.reduce(
      (sum, line) => {
        const quantity = num(line.quantity) ?? 0;
        const each = num(line.weightKg) ?? 0;
        const l = num(line.lengthCm);
        const w = num(line.widthCm);
        const h = num(line.heightCm);
        return {
          pieces: sum.pieces + quantity,
          teu: 0,
          volume: sum.volume + (l && w && h ? (l * w * h * quantity) / 1_000_000 : 0),
          weight: sum.weight + quantity * each,
        };
      },
      { pieces: 0, teu: 0, volume: 0, weight: 0 },
    );
  }, [byTotal, containerised, containerOptions, lines, loads, totalPieces, totalVolume, totalWeight]);

  /*
   * The chargeable figure, as an INDICATION only.
   *
   * The server computes the binding one when the request is stored and the
   * quotation carries that, so this exists to let a customer see why a light,
   * bulky shipment costs what it does - not to be quoted back. LCL is billed on
   * weight-or-measure, whichever is greater; air converts volume at the IATA
   * 1:6000 factor. Recorded in docs/gaps.md: it is a second implementation of a
   * rule the API already owns, and it belongs behind an endpoint.
   */
  const chargeable = useMemo(() => {
    if (containerised) return null;
    if (mode === 'air') {
      const volumetric = counted.volume * 166.67;
      return t('instKgValue', {
        kg: Math.max(counted.weight, volumetric).toFixed(0),
      });
    }
    return t('instWm', { wm: Math.max(counted.weight / 1000, counted.volume).toFixed(2) });
  }, [containerised, counted.volume, counted.weight, mode, t]);

  // --- readiness ----------------------------------------------------------

  /* A door still needs a port: the lane is what gets priced, and a street
     address alone does not say which terminal the cargo moves through. */
  const originReady =
    UNLOCODE.test(originCode)
    && (originKind === 'port' || (originCity.trim() !== '' && originStreet.trim() !== ''));
  const destinationReady =
    UNLOCODE.test(destinationCode)
    && (destinationKind === 'port'
      || (destinationCity.trim() !== '' && destinationStreet.trim() !== ''));

  const loadReady =
    Boolean(mode)
    && (containerised
      ? loads.length > 0
        && loads.every((load) => load.containerType !== '' && num(load.quantity) !== null)
      : counted.weight > 0 && counted.pieces > 0);

  const goodsReady = commodity.trim() !== '' && (readiness !== 'date' || readyDate !== '');

  const ready = originReady && destinationReady && loadReady && goodsReady && !hazardous;
  const sending = create.isPending || submit.isPending;
  const failure = (create.error ?? submit.error) as LookupWriteError | null;

  /**
   * What the full request form is handed when somebody decides their shipment
   * needs more said about it.
   *
   * The SAME bag of fields the assistant's draft uses, because the form has one
   * routine for filling itself and two doors into it. Only what has actually
   * been answered is included: the form fills what is empty and leaves the rest
   * alone, so an absent key is the honest way to say "not asked here".
   */
  const detailedHandoff = (): Record<string, unknown> => {
    const address = (street: string, zip: string, city: string) =>
      [street.trim(), zip.trim(), city.trim()].filter(Boolean).join(', ');

    const entries: [string, unknown][] = [
      ['scope', scope],
      ['mode', mode],
      ['loadType', loadType],
      ['originCode', originCode],
      ['destinationCode', destinationCode],
      ['pickupAddress', originKind === 'door' ? address(originStreet, originZip, originCity) : ''],
      [
        'deliveryAddress',
        destinationKind === 'door'
          ? address(destinationStreet, destinationZip, destinationCity)
          : '',
      ],
      ['commodity', commodity.trim()],
      ['incoterm', incoterm],
      ['cargoValue', num(cargoValue)],
      ['cargoValueCurrency', currency],
      [
        'readyDate',
        readiness === 'now' ? isoDate(new Date()) : readiness === 'date' ? readyDate : '',
      ],
      // Containers and package lines are alternatives, exactly as they are in
      // the request itself.
      [
        'equipment',
        containerised
          ? loads
              .filter((load) => load.containerType !== '')
              .map((load) => ({ containerType: load.containerType, quantity: num(load.quantity) ?? 1 }))
          : null,
      ],
      [
        'packages',
        containerised || byTotal
          ? null
          : lines
              .filter((line) => num(line.quantity) !== null && num(line.weightKg) !== null)
              .map((line) => ({
                quantity: num(line.quantity)!,
                packageType: line.packageType,
                lengthCm: num(line.lengthCm) ?? undefined,
                widthCm: num(line.widthCm) ?? undefined,
                heightCm: num(line.heightCm) ?? undefined,
                weightKg: num(line.weightKg)!,
              })),
      ],
      // Only meaningful for a total-shipment description, where there are no
      // lines to carry the figures.
      ['grossWeightKg', !containerised && byTotal ? num(totalWeight) : null],
      ['packageCount', !containerised && byTotal ? num(totalPieces) : null],
    ];

    return Object.fromEntries(
      entries.filter(([, value]) =>
        value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0),
      ),
    );
  };

  // --- sending ------------------------------------------------------------

  const send = async () => {
    if (!ready || sending) {
      setTried(true);
      setPanel(
        !originReady ? 'origin' : !destinationReady ? 'destination' : !loadReady ? 'load' : 'goods',
      );
      return;
    }

    const address = (street: string, zip: string, city: string) =>
      [street.trim(), zip.trim(), city.trim()].filter(Boolean).join(', ') || null;

    const created = (await create.mutateAsync({
      mode,
      loadType,
      originCode,
      destinationCode,
      commodity: commodity.trim(),
      /*
       * A full container load carries no gross weight here. The contract needs a
       * positive figure, and asking a customer to add up six containers is
       * asking for a number they do not have - so the containers carry the
       * description and this is a placeholder the pricer ignores.
       */
      grossWeightKg: containerised ? 1 : counted.weight,
      volumeM3: counted.volume > 0 ? counted.volume : undefined,
      currency,
      incoterm: incoterm || undefined,
      readyDate:
        readiness === 'now'
          ? isoDate(new Date())
          : readiness === 'date'
            ? readyDate
            : undefined,
      // Containers and package lines are alternatives, never both.
      packages:
        containerised || byTotal
          ? undefined
          : lines
              .filter((line) => num(line.quantity) !== null && num(line.weightKg) !== null)
              .map((line) => ({
                lineId: line.key,
                quantity: num(line.quantity)!,
                packageType: line.packageType,
                lengthCm: num(line.lengthCm) ?? undefined,
                widthCm: num(line.widthCm) ?? undefined,
                heightCm: num(line.heightCm) ?? undefined,
                weightKg: num(line.weightKg)!,
                // The pallet footprint, where one was chosen. `description` is
                // where the schema puts detail that has not earned a column.
                description: line.palletType ? t(`instPallet_${line.palletType}`) : undefined,
              })),
      equipment: containerised
        ? loads.map((load) => ({
            unitId: load.unitId,
            containerType: load.containerType,
            quantity: num(load.quantity) ?? 1,
          }))
        : undefined,
      /*
       * `source` is the point of this key. A request that arrives without an
       * Incoterm or a consignee is not an incomplete full request; it came
       * through the short door, and whoever prices it should see that rather
       * than guess it.
       */
      payload: {
        source: 'instant_request',
        scope,
        pickupAddress:
          originKind === 'door' ? address(originStreet, originZip, originCity) : null,
        deliveryAddress:
          destinationKind === 'door'
            ? address(destinationStreet, destinationZip, destinationCity)
            : null,
        cargoValue: num(cargoValue),
        loadingDockOrigin: originKind === 'door' ? originDock : null,
        loadingDockDestination: destinationKind === 'door' ? destinationDock : null,
        overweightLoads: containerised ? loads.filter((load) => load.overweight).length : 0,
        measurements: 'estimated',
        additionalServices: [],
        specialHandling: [],
      },
    })) as { id: string } | undefined;

    if (created?.id) {
      await submit.mutateAsync(created.id);
      onSubmitted(created.id);
    }
  };

  // --- what each cell reads when it is closed -----------------------------

  const placeSummary = (kind: PlaceKind, code: string, port: Port | null, city: string) => {
    if (kind === 'door') {
      if (city.trim() === '') return null;
      return [city.trim(), port?.countryName ?? null].filter(Boolean).join(', ');
    }
    if (!UNLOCODE.test(code)) return null;
    return port ? `${code} · ${port.name}` : code;
  };

  const loadSummary = () => {
    if (!chosen) return null;
    if (containerised) {
      if (loads.length === 0) return null;
      return loads
        .filter((load) => load.containerType !== '')
        .map((load) => t('instTimes', { count: num(load.quantity) ?? 1, type: load.containerType }))
        .join(', ');
    }
    if (counted.pieces === 0) return null;
    return t('instLoose', { pieces: counted.pieces, weight: counted.weight.toLocaleString() });
  };

  // --- the strip ----------------------------------------------------------

  /**
   * One question on the strip.
   *
   * A plain button, not a popover trigger: the four of them share ONE panel,
   * anchored to the strip rather than to the cell, which is what makes it drop
   * from the strip's left edge and stay there as the customer moves between the
   * questions - exactly as the mockup draws it.
   */
  /**
   * One question on the strip, with the panel it opens.
   *
   * The panel is anchored to THIS cell, left edge to left edge, which is what
   * the mockup's own `measure()` does: `left = segment.left`, clamped so the
   * last cell's panel does not run off the window. A panel anchored to the whole
   * strip drops from the far left whichever question you are answering, which is
   * not where you are looking.
   */
  const cell = (
    id: Panel,
    label: string,
    qualifier: string | null,
    value: string | null,
    placeholder: string,
    ok: boolean,
    content: ReactNode,
    width: 'place' | 'load' | 'goods',
    wide?: boolean,
  ) => (
    <Popover
      key={id}
      open={panel === id}
      onOpenChange={(next) => {
        setPanel(next ? id : null);
        if (next) setTried(false);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={styles.cell}
          data-wide={wide ? 'true' : undefined}
          data-open={panel === id ? 'true' : undefined}
          data-filled={value ? 'true' : undefined}
          data-missing={tried && !ok ? 'true' : undefined}
        >
          <span className={styles.cellLabel}>
            <span className={styles.cellName}>{qualifier ? `${label} · ${qualifier}` : label}</span>
            {ok && <Check size={11} className={styles.tick} aria-hidden="true" />}
            {tried && !ok && <span className={styles.warn} aria-hidden="true">!</span>}
          </span>
          <span className={styles.cellValue}>{value ?? placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={10}
        /* 8px from the window edge, as the mockup clamps to. */
        collisionPadding={8}
        className={styles.panel}
        data-width={width}
        onInteractOutside={keepNestedOpen}
      >
        {content}
      </PopoverContent>
    </Popover>
  );

  /** One end of the route. The two ends differ only in their wording. */
  const placePanel = (which: 'origin' | 'destination') => {
    const isOrigin = which === 'origin';
    const kind = isOrigin ? originKind : destinationKind;
    const country = isOrigin ? originCountry : destinationCountry;
    const setCountry = isOrigin ? setOriginCountry : setDestinationCountry;
    const text = isOrigin ? originText : destinationText;
    const setText = isOrigin ? setOriginText : setDestinationText;
    const code = isOrigin ? originCode : destinationCode;
    const setCode = isOrigin ? setOriginCode : setDestinationCode;
    const port = isOrigin ? originPort : destinationPort;
    const setPort = isOrigin ? setOriginPort : setDestinationPort;
    const search = isOrigin ? originSearch : destinationSearch;
    const city = isOrigin ? originCity : destinationCity;
    const setCity = isOrigin ? setOriginCity : setDestinationCity;
    const zip = isOrigin ? originZip : destinationZip;
    const setZip = isOrigin ? setOriginZip : setDestinationZip;
    const street = isOrigin ? originStreet : destinationStreet;
    const setStreet = isOrigin ? setOriginStreet : setDestinationStreet;
    const dock = isOrigin ? originDock : destinationDock;
    const setDock = isOrigin ? setOriginDock : setDestinationDock;
    const done = isOrigin ? originReady : destinationReady;

    const portField = (label: string, hint: string) => (
      <Autocomplete
        label={label}
        required
        placeholder={t('instPortPh')}
        hint={hint}
        moreHint={t('reqPortMore')}
        promptHint={t('reqPortPrompt')}
        emptyHint={t('reqPortNoMatch')}
        loading={search.isFetching}
        value={text || code}
        options={asOptions(search.data ?? [])}
        onQueryChange={setText}
        error={code !== '' && !UNLOCODE.test(code) ? t('reqUnlocodeError') : undefined}
        onValueChange={(next) => {
          setText(next);
          const picked = portCodeFrom(next);
          setCode(picked);
          setPort((search.data ?? []).find((item) => item.code === picked) ?? null);
        }}
      />
    );

    return (
      <>
        <div className={styles.panelBody}>
          <div className={styles.panelHead}>
            <h3 className={styles.panelTitle}>
              {t(isOrigin ? 'instOriginTitle' : 'instDestinationTitle')}
            </h3>
            <span className={styles.scopeTag}>{t(`reqScope_${scope}`)}</span>
          </div>

          <div className={styles.grid}>
            {/* The type is the scope, said at this end. Changing it here changes
                the pills above, because they are one answer, not two. */}
            <Select
              label={t('instType')}
              value={kind}
              onValueChange={(next) =>
                setScope(isOrigin ? `${next}_${destinationKind}` : `${originKind}_${next}`)
              }
              options={[
                { value: 'port', label: t('instTypePort') },
                { value: 'door', label: t('instTypeDoor') },
              ]}
            />
            <Select
              label={t('instCountry')}
              value={country}
              onValueChange={setCountry}
              placeholder={t('instAnyCountry')}
              options={countryOptions}
              searchable
            />

            {kind === 'port' ? (
              portField(t('instPortField'), t('reqUnlocodeHint'))
            ) : (
              <div className={styles.cityZip}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{t('instCity')}</span>
                  <input
                    className={styles.input}
                    value={city}
                    maxLength={80}
                    onChange={(event) => setCity(event.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{t('instPostalCode')}</span>
                  <input
                    className={styles.input}
                    value={zip}
                    maxLength={16}
                    onChange={(event) => setZip(event.target.value)}
                  />
                </label>
              </div>
            )}
          </div>

          {kind === 'door' && (
            <>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{t('instStreet')}</span>
                <input
                  className={styles.input}
                  placeholder={t('instStreetPh')}
                  value={street}
                  maxLength={200}
                  onChange={(event) => setStreet(event.target.value)}
                />
              </label>

              {portField(t('instViaPort'), t('instViaPortHint'))}

              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={dock}
                  onChange={(event) => setDock(event.target.checked)}
                />
                <span>
                  {t('instDock')} <span className={styles.aside}>{t('instDockNote')}</span>
                </span>
              </label>
            </>
          )}
        </div>

        <div className={styles.panelFoot}>
          <span className={styles.footNote} data-missing={!done || undefined}>
            {done ? placeSummary(kind, code, port, city) ?? '' : t('instNothingYet')}
          </span>
          <button
            type="button"
            className={styles.go}
            disabled={!done}
            onClick={() => setPanel(isOrigin ? 'destination' : 'load')}
          >
            {t(isOrigin ? 'instDestination' : 'instLoad')}
            <ArrowRight size={13} aria-hidden="true" />
          </button>
        </div>
      </>
    );
  };

  /** A compact row for a load that is not the one being edited. */
  const collapsedRow = (key: string, index: number, label: string, text: string) => (
    <button type="button" className={styles.rowLine} key={key} onClick={() => setEditing(index)}>
      <span className={styles.rowIndex}>{label}</span>
      <span className={styles.rowText}>{text}</span>
    </button>
  );

  const stepper = (
    value: string,
    onChange: (next: string) => void,
  ) => (
    <div className={styles.stepper}>
      <button
        type="button"
        aria-label={t('instFewer')}
        onClick={() => onChange(String(Math.max(1, (num(value) ?? 1) - 1)))}
      >
        −
      </button>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button type="button" aria-label={t('instMore')} onClick={() => onChange(String((num(value) ?? 1) + 1))}>
        +
      </button>
    </div>
  );

  const loadPanel = (
    <>
      <div className={styles.panelBody}>
        <h3 className={styles.panelTitle}>{t('instLoadTitle')}</h3>

        <div className={styles.tabs} role="tablist" aria-label={t('instService')}>
          {services.map((item) => (
            <button
              type="button"
              role="tab"
              key={item.key}
              className={styles.tab}
              aria-selected={service === item.key}
              onClick={() => {
                setService(item.key);
                setEditing(0);
                const isContainers = Boolean(item.loadType && CONTAINERISED.has(item.loadType));
                if (isContainers && loads.length === 0 && containerOptions[0]) {
                  setLoads([newLoad(containerOptions[0].value)]);
                }
                if (!isContainers && lines.length === 0 && packageOptions[0]) {
                  setLines([newLine(packageOptions[0].value, isPallet(packageOptions[0].value))]);
                }
              }}
            >
              <LogisticsIcon name={MODE_ICONS[item.mode] ?? 'routing'} size={15} aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </div>

        {!chosen && <p className={styles.hint}>{t('instServicePrompt')}</p>}

        {chosen && containerised && (
          <>
            {originKind === 'door' || destinationKind === 'door' ? (
              <p className={styles.notice}>
                <Info size={15} aria-hidden="true" />
                {t('instDoorContainerNote')}
              </p>
            ) : null}

            {loads.map((load, index) =>
              index === editing ? (
                <div className={styles.editor} key={load.unitId}>
                  <div className={styles.editorHead}>
                    <span className={styles.editorTitle}>
                      {t('instLoadNumber', { number: index + 1 })}
                    </span>
                    {loads.length > 1 && (
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label={t('instRemove')}
                        onClick={() => {
                          setLoads((current) => current.filter((item) => item.unitId !== load.unitId));
                          setEditing(0);
                        }}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  <div className={styles.editorGrid}>
                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>{t('instContainers')}</span>
                      {stepper(load.quantity, (next) =>
                        setLoads((current) =>
                          current.map((item) =>
                            item.unitId === load.unitId ? { ...item, quantity: next } : item,
                          ),
                        ),
                      )}
                    </div>

                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>{t('instEquipment')}</span>
                      <div className={styles.picks}>
                        {containerOptions.map((option) => (
                          <button
                            type="button"
                            key={option.value}
                            className={styles.pick}
                            aria-pressed={load.containerType === option.value}
                            title={option.label}
                            onClick={() =>
                              setLoads((current) =>
                                current.map((item) =>
                                  item.unitId === load.unitId
                                    ? { ...item, containerType: option.value }
                                    : item,
                                ),
                              )
                            }
                          >
                            {option.value}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={load.overweight}
                      onChange={(event) =>
                        setLoads((current) =>
                          current.map((item) =>
                            item.unitId === load.unitId
                              ? { ...item, overweight: event.target.checked }
                              : item,
                          ),
                        )
                      }
                    />
                    <span>
                      {t('instOverweight')}{' '}
                      <span className={styles.aside}>{t('instOverweightNote')}</span>
                    </span>
                  </label>
                </div>
              ) : (
                collapsedRow(
                  load.unitId,
                  index,
                  t('instLoadNumber', { number: index + 1 }),
                  `${t('instTimes', { count: num(load.quantity) ?? 1, type: load.containerType })}${
                    load.overweight ? ` · ${t('instOverweight')}` : ''
                  }`,
                )
              ),
            )}

            <div className={styles.strap}>
              <div>
                <span className={styles.strapLabel}>{t('instStatContainers')}</span>
                <span className={styles.strapValue}>{counted.pieces}</span>
              </div>
              <div>
                <span className={styles.strapLabel}>{t('instStatTeu')}</span>
                <span className={styles.strapValue}>{counted.teu}</span>
              </div>
              <div>
                <span className={styles.strapLabel}>{t('instStatLoads')}</span>
                <span className={styles.strapValue}>{loads.length}</span>
              </div>
            </div>
          </>
        )}

        {chosen && !containerised && (
          <>
            <div className={styles.radios} role="radiogroup" aria-label={t('instHowToCount')}>
              {[
                { value: false, label: t('instByUnit') },
                { value: true, label: t('instByTotal') },
              ].map((option) => (
                <button
                  type="button"
                  role="radio"
                  key={String(option.value)}
                  aria-checked={byTotal === option.value}
                  className={styles.radio}
                  onClick={() => setByTotal(option.value)}
                >
                  <span className={styles.ring} aria-hidden="true" />
                  {option.label}
                </button>
              ))}
            </div>

            {byTotal ? (
              <div className={styles.threeUp}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{t('instPackages')}</span>
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    value={totalPieces}
                    onChange={(event) => setTotalPieces(event.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{t('instTotalVolume')}</span>
                  <input
                    className={styles.input}
                    type="number"
                    min={0}
                    value={totalVolume}
                    onChange={(event) => setTotalVolume(event.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{t('instTotalGross')}</span>
                  <input
                    className={styles.input}
                    type="number"
                    min={0}
                    value={totalWeight}
                    onChange={(event) => setTotalWeight(event.target.value)}
                  />
                </label>
              </div>
            ) : (
              lines.map((line, index) =>
                index === editing ? (
                  <div className={styles.editor} key={line.key}>
                    <div className={styles.editorHead}>
                      <span className={styles.editorTitle}>
                        {t('instLineNumber', { number: index + 1 })}
                      </span>
                      {lines.length > 1 && (
                        <button
                          type="button"
                          className={styles.iconButton}
                          aria-label={t('instRemove')}
                          onClick={() => {
                            setLines((current) => current.filter((item) => item.key !== line.key));
                            setEditing(0);
                          }}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    <div className={styles.editorGrid}>
                      <div className={styles.field}>
                        <span className={styles.fieldLabel}>{t('instPackageType')}</span>
                        {/* Every type the lookup offers, not the first handful:
                            slicing the list is how Pallet - the commonest of
                            them - disappeared off the end of it. */}
                        <div className={styles.picks}>
                          {packageOptions.map((option) => (
                            <button
                              type="button"
                              key={option.value}
                              className={styles.pick}
                              aria-pressed={line.packageType === option.value}
                              onClick={() =>
                                setLines((current) =>
                                  current.map((item) =>
                                    item.key === line.key
                                      ? {
                                          ...newLine(option.value, isPallet(option.value)),
                                          key: item.key,
                                          quantity: item.quantity,
                                        }
                                      : item,
                                  ),
                                )
                              }
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className={styles.field}>
                        <span className={styles.fieldLabel}>{t('instPackages')}</span>
                        {stepper(line.quantity, (next) =>
                          setLines((current) =>
                            current.map((item) =>
                              item.key === line.key ? { ...item, quantity: next } : item,
                            ),
                          ),
                        )}
                      </div>
                    </div>

                    {isPallet(line.packageType) && (
                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>{t('instPalletType')}</span>
                        <select
                          className={styles.input}
                          value={line.palletType}
                          onChange={(event) => {
                            const pallet = PALLETS.find((item) => item.id === event.target.value);
                            setLines((current) =>
                              current.map((item) =>
                                item.key === line.key
                                  ? {
                                      ...item,
                                      palletType: event.target.value,
                                      lengthCm: pallet?.lengthCm ? String(pallet.lengthCm) : '',
                                      widthCm: pallet?.widthCm ? String(pallet.widthCm) : '',
                                    }
                                  : item,
                              ),
                            );
                          }}
                        >
                          {PALLETS.map((pallet) => (
                            <option key={pallet.id} value={pallet.id}>
                              {t(`instPallet_${pallet.id}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <div className={styles.editorGrid}>
                      <div className={styles.field}>
                        <span className={styles.fieldLabel}>
                          {t('instDimensions')}{' '}
                          <span className={styles.aside}>{t('instPerPackage')}</span>
                        </span>
                        <div className={styles.dims}>
                          {(['lengthCm', 'widthCm', 'heightCm'] as const).map((axis) => (
                            <input
                              key={axis}
                              type="number"
                              min={0}
                              placeholder={t(`instAxis_${axis}`)}
                              aria-label={t(`instAxis_${axis}`)}
                              value={line[axis]}
                              onChange={(event) =>
                                setLines((current) =>
                                  current.map((item) =>
                                    item.key === line.key
                                      ? { ...item, [axis]: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                            />
                          ))}
                          <span className={styles.unit}>{t('instCm')}</span>
                        </div>
                      </div>

                      <div className={styles.field}>
                        <span className={styles.fieldLabel}>
                          {t('instGross')} <span className={styles.aside}>{t('instEach')}</span>
                        </span>
                        <div className={styles.dims}>
                          <input
                            type="number"
                            min={0}
                            aria-label={t('instGross')}
                            value={line.weightKg}
                            onChange={(event) =>
                              setLines((current) =>
                                current.map((item) =>
                                  item.key === line.key
                                    ? { ...item, weightKg: event.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                          <span className={styles.unit}>{t('instKg')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  collapsedRow(
                    line.key,
                    index,
                    t('instLineNumber', { number: index + 1 }),
                    t('instLineText', {
                      count: num(line.quantity) ?? 1,
                      type: line.packageType,
                      weight: (num(line.weightKg) ?? 0).toLocaleString(),
                    }),
                  )
                ),
              )
            )}

            <div className={styles.strap} data-four="true">
              <div>
                <span className={styles.strapLabel}>{t('instStatPackages')}</span>
                <span className={styles.strapValue}>{counted.pieces}</span>
              </div>
              <div>
                <span className={styles.strapLabel}>{t('instStatVolume')}</span>
                <span className={styles.strapValue}>
                  {t('instM3', { m3: counted.volume.toFixed(2) })}
                </span>
              </div>
              <div>
                <span className={styles.strapLabel}>{t('instStatGross')}</span>
                <span className={styles.strapValue}>
                  {t('instKgValue', { kg: counted.weight.toLocaleString() })}
                </span>
              </div>
              {/*
               * An indication, and labelled as one. The binding figure is the
               * server's - it computes chargeable weight when the request is
               * stored, and the quotation carries that - so this is shown in the
               * accent colour beside the facts rather than among them.
               */}
              <div data-lead="true">
                <span className={styles.strapLabel}>{t('instStatChargeable')}</span>
                <span className={styles.strapValue}>{chargeable}</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className={styles.panelFoot} data-end="true">
        {chosen && !byTotal && (
          <button
            type="button"
            className={styles.add}
            onClick={() => {
              if (containerised && containerOptions[0]) {
                setLoads((current) => [...current, newLoad(containerOptions[0].value)]);
                setEditing(loads.length);
              } else if (!containerised && packageOptions[0]) {
                setLines((current) => [...current, newLine(packageOptions[0].value, isPallet(packageOptions[0].value))]);
                setEditing(lines.length);
              }
            }}
          >
            {t(containerised ? 'instAddLoad' : 'instAddLine')}
          </button>
        )}
        <button
          type="button"
          className={styles.go}
          disabled={!loadReady}
          onClick={() => setPanel('goods')}
        >
          {t('instConfirm')}
        </button>
      </div>
    </>
  );

  const goodsPanel = (
    <>
      <div className={styles.panelBody}>
        <h3 className={styles.panelTitle}>{t('instGoodsTitle')}</h3>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('instCommodity')}</span>
          <input
            className={styles.input}
            placeholder={t('reqCommodityPh')}
            value={commodity}
            maxLength={200}
            onChange={(event) => setCommodity(event.target.value)}
          />
        </label>

        <div className={styles.valueRow}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              {t('instValue')} <span className={styles.aside}>{t('reqOptional')}</span>
            </span>
            <div className={styles.dims}>
              <input
                type="number"
                min={0}
                aria-label={t('instValue')}
                value={cargoValue}
                onChange={(event) => setCargoValue(event.target.value)}
              />
              <select
                className={styles.unitSelect}
                aria-label={t('reqCurrency')}
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              >
                {currencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.value}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Select
            label={t('instIncoterm')}
            value={incoterm}
            onValueChange={setIncoterm}
            placeholder={t('reqOptional')}
            options={incotermOptions}
          />
        </div>

        {mayDeclareHazards && (
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={hazardous}
              onChange={(event) => setHazardous(event.target.checked)}
            />
            <span>{t('instHazardous')}</span>
          </label>
        )}

        {hazardous && (
          <p className={styles.warning}>
            <AlertTriangle size={15} aria-hidden="true" />
            <span>
              {t('instHazardousNote')}{' '}
              <Link to={fullFormHref} state={{ prefill: detailedHandoff() }}>
                {t('instFullForm')}
              </Link>
            </span>
          </p>
        )}

        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t('instReady')}</span>
          <select
            className={styles.input}
            value={readiness}
            onChange={(event) => setReadiness(event.target.value)}
          >
            <option value="now">{t('instReady_now')}</option>
            <option value="date">{t('instReady_date')}</option>
            <option value="planning">{t('instReady_planning')}</option>
          </select>
          {readiness === 'date' && (
            <input
              className={styles.input}
              type="date"
              aria-label={t('instReady_date')}
              value={readyDate}
              min={isoDate(new Date())}
              onChange={(event) => setReadyDate(event.target.value)}
            />
          )}
        </div>

        <p className={styles.notice}>
          <Info size={15} aria-hidden="true" />
          {t('instValidityNote')}
        </p>
      </div>

      <div className={styles.panelFoot} data-end="true">
        <button
          type="button"
          className={styles.go}
          disabled={!goodsReady}
          onClick={() => setPanel(null)}
        >
          {t('instConfirm')}
        </button>
      </div>
    </>
  );

  return (
    <div className={styles.bar}>
      <div className={styles.scopes} role="radiogroup" aria-label={t('instScope')}>
        <span className={styles.scopeLabel}>{t('instScope')}</span>
        {SCOPES.map((value) => (
          <button
            type="button"
            role="radio"
            key={value}
            aria-checked={scope === value}
            className={styles.scope}
            onClick={() => setScope(value)}
          >
            <span className={styles.ring} aria-hidden="true" />
            {t(`reqScope_${value}`)}
          </button>
        ))}
      </div>

      <div className={styles.strip} data-instant-strip="true">
        {cell(
          'origin',
          t('instOrigin'),
          t(`instKind_${originKind}`),
          placeSummary(originKind, originCode, originPort, originCity),
          originKind === 'port'
            ? t('instOriginEmptyPort', { country: countryName(originCountry) })
            : t('instOriginEmptyDoor', { country: countryName(originCountry) }),
          originReady,
          placePanel('origin'),
          'place',
        )}
        {cell(
          'destination',
          t('instDestination'),
          t(`instKind_${destinationKind}`),
          placeSummary(destinationKind, destinationCode, destinationPort, destinationCity),
          destinationKind === 'port'
            ? t('instDestinationEmptyPort', { country: countryName(destinationCountry) })
            : t('instDestinationEmptyDoor', { country: countryName(destinationCountry) }),
          destinationReady,
          placePanel('destination'),
          'place',
        )}
        {cell(
          'load',
          t('instLoad'),
          chosen?.label ?? null,
          loadSummary(),
          t('instLoadEmpty'),
          loadReady,
          loadPanel,
          'load',
          true,
        )}
        {cell(
          'goods',
          t('instGoods'),
          null,
          commodity.trim() || null,
          t('instGoodsEmpty'),
          goodsReady,
          goodsPanel,
          'goods',
        )}

        {hazardous ? (
          <Link className={styles.submit} to={fullFormHref} state={{ prefill: detailedHandoff() }}>
            {t('instFullForm')}
          </Link>
        ) : (
          <>
            <button
              type="button"
              className={styles.submit}
              onClick={() => void send()}
              disabled={sending}
            >
              {sending && <Loader2 size={15} className={styles.spin} aria-hidden="true" />}
              {sending ? t('instSending') : t('instSubmit')}
            </button>

            {/* The other door, on the strip itself rather than only at the foot
                of the page. Outlined, because the short request is the one being
                offered - this is for the shipment that needs more said about it,
                and it keeps whatever has been filled in nowhere: the full form
                starts clean, which is why it is a link and not a hand-off. */}
            <Link
              className={styles.detailed}
              to={fullFormHref}
              state={{ prefill: detailedHandoff() }}
            >
              {t('instDetailed')}
            </Link>
          </>
        )}
      </div>

      <p className={styles.foot} role={failure ? 'alert' : undefined}>
        {failure ? failure.message || t('instFailed') : t('instFootnote')}
      </p>
    </div>
  );
}
