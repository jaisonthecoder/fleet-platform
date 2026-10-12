import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { AlertCircle, Check, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';

import {
  Autocomplete,
  Button,
  ChipToggles,
  ComboInput,
  type AutocompleteOption,
  dateParts,
  type DateParts,
  DateField,
  FilterPills,
  formatDate,
  HeroBand,
  HeroChip,
  Input,
  ModeCards,
  PartyCard,
  RadioCards,
  RouteBreadcrumb,
  RouteLoader,
  Select,
  SelectedStrip,
  StatePanel,
  type LogisticsIconName,
} from '../../../design-system';
import { CustomerMeasure } from '../../../shared/layouts/customer-shell';
import { useFeature } from '../../../shared/features/useFeature';
import { IntakePanel } from '../../ai-assistant/IntakePanel';
import type { IntakeDraft } from '../../ai-assistant/api/aiIntake';
import { REFERENCE, useReference, useReferenceLabels, useReferenceOptions } from '../../../shared/reference/useReference';
import { portCodeFrom, portLabel, usePortSearch, type Port } from '../../../shared/reference/usePortSearch';
import {
  DangerousGoodsEditor,
  dangerousGoodsComplete,
  emptyDangerousGoods,
  toDangerousGoodsInput,
  type DangerousGoodsDraft,
} from '../components/DangerousGoodsEditor';
import {
  EquipmentPicker,
  equipmentGrossWeight,
  toEquipmentInput,
  type EquipmentDraft,
} from '../components/EquipmentPicker';
import {
  emptyOversize,
  emptyTemperature,
  OversizeEditor,
  oversizeComplete,
  TemperatureControlEditor,
  temperatureComplete,
  toOversizeInput,
  toTemperatureInput,
  type OversizeDraft,
  type TemperatureDraft,
} from '../components/SpecialHandlingEditors';
import {
  RequestProgress,
  RequestStages,
  RequestSummary,
  type JourneyStage,
  type SummaryRow,
} from '../components/RequestAside';
import type { LookupWriteError } from '../../admin/api/lookups';
import type { CustomerSession } from '../../../app/layouts/CustomerPortalLayout';
import { useCreateQuote, useSubmitQuote, type CreateQuoteBody } from '../api/quotes';
import styles from './QuoteRequestPage.module.css';

// Taken from the generated contract, not restated. If the API adds a mode or
// retires an Incoterm, this stops compiling rather than sending a value the
// server will refuse.
type TransportMode = CreateQuoteBody['mode'];
type Incoterm = NonNullable<CreateQuoteBody['incoterm']>;

const DIRECTIONS = ['import', 'export'] as const;

/**
 * The kit icon for each mode.
 *
 * Presentation, so it stays in code — an administrator maintains the list of
 * modes and their wording, not the iconography. A mode with no icon recorded
 * falls back to the generic routing glyph rather than breaking the card.
 */
const MODE_ICONS: Record<string, LogisticsIconName> = {
  sea: 'container-ship',
  air: 'air-freight',
  road: 'truck',
  rail: 'rail-freight',
};

/**
 * Which load types mean containers rather than package lines.
 *
 * Deliberately NOT lookup data: the API already refuses an FCL or FTL request
 * that carries no container, so a second administrator-editable copy of the
 * same rule would drift from the one the server enforces.
 */
const CONTAINERISED = new Set(['FCL', 'FTL']);

/**
 * Incoterms 2020, and which are sea-only.
 *
 * The `incoterm` lookup supplies the list; this set is the RULE about it, which
 * is not the lookup's to hold - FAS, FOB, CFR and CIF being sea and inland
 * waterway only is ICC's rule, not a Noatum preference an administrator may edit.
 */
const SEA_ONLY = new Set(['FAS', 'FOB', 'CFR', 'CIF']);

/**
 * Incoterms the API will accept. The lookup supplies the labels and ordering;
 * this bounds what may be sent, and `satisfies` breaks the build if the two ever
 * disagree - so an administrator adding a code the contract does not know is
 * refused here rather than by an opaque server error.
 */
const INCOTERMS = [
  'EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF',
] as const satisfies readonly Incoterm[];

const asIncoterm = (value: string): Incoterm | undefined =>
  INCOTERMS.find((term) => term === value);

const SCOPES = ['door_door', 'door_port', 'port_door', 'port_port'] as const;

const ADD_ONS = ['customs', 'insurance', 'warehousing', 'inspection', 'fumigation'] as const;
const HANDLING = ['dangerousGoods', 'temperature', 'outOfGauge', 'notStackable'] as const;
const EMPTY = '—';

/** ISO date strings compare correctly as text, so no parsing is needed to order them. */
const deliveryAfterReady = (ready: string, latest: string) =>
  ready === '' || latest === '' || latest >= ready;

/** The shortcuts DT-03 offers on a cargo ready date, in days from today. */
const READY_SHORTCUTS = [0, 3, 7, 14] as const;

/** How far a cargo ready date may move, as the pricing team reads it. */
const FLEXIBILITY = ['fixed', 'few_days', 'flexible'] as const;
type Flexibility = (typeof FLEXIBILITY)[number];

/**
 * What the shipment passes through between the two ends, by mode.
 *
 * Stages only — no durations, on purpose. We hold no sailing schedule, no
 * carrier feed and no completed shipments to measure, so every number here
 * would be invented; and the platform already answers "how long" properly,
 * as a transit range a pricing specialist types onto each option.
 *
 * The two ends are not in this table because the customer decides them: the
 * scope says whether there is a collection and a delivery, which is why the
 * old version contradicted the form by showing pre-carriage on a port-to-port
 * request.
 *
 * `dwell` marks the cargo standing still rather than moving.
 */
const MIDDLE: Record<string, readonly { id: string; dwell?: boolean }[]> = {
  sea: [
    { id: 'originDwell', dwell: true },
    { id: 'mainCarriage' },
    { id: 'destinationDwell', dwell: true },
  ],
  air: [
    { id: 'originHandling', dwell: true },
    { id: 'flight' },
    { id: 'customs', dwell: true },
  ],
  road: [{ id: 'mainCarriage' }],
  rail: [
    { id: 'originDwell', dwell: true },
    { id: 'mainCarriage' },
    { id: 'destinationDwell', dwell: true },
  ],
};

/** A shared load is consolidated at both ends; a full container is not. */
const GROUPAGE: readonly { id: string; dwell?: boolean }[] = [
  { id: 'consolidation', dwell: true },
  { id: 'mainCarriage' },
  { id: 'deconsolidation', dwell: true },
];

/**
 * A bare YYYY-MM-DD, pinned to UTC.
 *
 * The picker hands back a local Date. Formatting it with the local calendar
 * would send yesterday's date west of Greenwich, which is how a ready date
 * arrives a day before the cargo does.
 */

/**
 * How urgent a date reads.
 *
 * Without a tone, DateDisplay falls back to 'action', which is brand red - and the
 * brand reserves red for actions and errors, with status carried by the extension
 * colours. A cargo date is status: comfortable lead time is green, a few days out
 * is amber, and today or the past is neither.
 */
const leadTone = (days: number | undefined): DateParts['relativeTone'] => {
  if (days === undefined) return 'muted';
  if (days <= 0) return 'muted';
  return days <= 3 ? 'attention' : 'success';
};

const isoDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

/**
 * "Valencia, Spain" — the quiet line under a UN/LOCODE.
 *
 * Falls back to the ISO code when the country lookup has no row for it, and to
 * the port name alone when it has neither. Nothing is invented: a port we hold
 * no record for gets no line at all, and the band shows the code by itself.
 */
const placeOf = (port: Port | null): string | undefined => {
  if (!port) return undefined;
  const country = port.countryName ?? port.countryCode;
  return country ? `${port.name}, ${country}` : port.name;
};

const addDays = (from: Date, days: number): Date => {
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next;
};

interface CargoLine {
  key: string;
  quantity: string;
  packageType: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  weightKg: string;
}

function emptyLine(): CargoLine {
  return {
    key: crypto.randomUUID(),
    quantity: '1', packageType: 'Pallets',
    lengthCm: '', widthCm: '', heightCm: '', weightKg: '',
  };
}

const num = (value: string) => {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/**
 * Two decimals, except when that would say zero about something that is not.
 *
 * A 4 × 5 × 5 cm carton is 0.000025 m³, which `toFixed(2)` renders as "0.00" —
 * indistinguishable from an empty row, and the reason the totals looked broken.
 * Below a hundredth of a cubic metre the honest answer is a bound, not a zero.
 */
export function formatVolume(m3: number): string {
  if (m3 > 0 && m3 < 0.005) return '< 0.01';
  return m3.toFixed(2);
}

/** cm³ to m³. The server recomputes chargeable weight; this is the running total. */
function lineVolume(line: CargoLine): number {
  const l = num(line.lengthCm); const w = num(line.widthCm); const h = num(line.heightCm);
  const q = num(line.quantity);
  if (l === null || w === null || h === null || q === null) return 0;
  return (l * w * h * q) / 1_000_000;
}

export function QuoteRequestPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const session = useOutletContext<CustomerSession>();

  const create = useCreateQuote();
  const submit = useSubmitQuote();

  /*
   * Which of the four sections is on screen.
   *
   * The form is four decisions, not one wall: a customer who cannot tell which
   * answer is still missing scrolls a page of fields looking for it. Every
   * section stays reachable by its own node on the rail - nothing is locked
   * behind the one before it - but only one is asked at a time.
   */
  const [step, setStep] = useState(0);

  /* Which steps have been pressed past. A required field says nothing until the
     customer has tried to leave it: an untouched form covered in red is noise. */
  const [attempted, setAttempted] = useState<Record<number, boolean>>({});

  const [selectedMode, setSelectedMode] = useState<string>('');
  const [selectedLoadType, setSelectedLoadType] = useState<string>('');
  const [direction, setDirection] = useState<string>('import');
  const [incoterm, setIncoterm] = useState<Incoterm>('FOB');
  const [namedPlace, setNamedPlace] = useState('');
  const [scope, setScope] = useState<string>('port_door');
  const [addOns, setAddOns] = useState<Record<string, boolean>>({ customs: true });

  const [originCode, setOriginCode] = useState('');
  const [destinationCode, setDestinationCode] = useState('');
  /*
   * What the route fields SHOW, which is not what they submit.
   *
   * The code stays the single value everything else reads - the hero, the summary,
   * the request - while these hold whatever is in the box, "ESVLC — Valencia" after
   * picking a suggestion or a bare code after typing one. Falling back to the code
   * keeps a value set from elsewhere, an AI intake draft or a restored request,
   * visible without a second write.
   */
  const [originText, setOriginText] = useState('');
  const [destinationText, setDestinationText] = useState('');
  /*
   * The port behind the chosen code, kept so the hero can name the place.
   *
   * The field itself only ever reports a string, and the search results it came
   * from are dropped as soon as the query changes — so without this the band
   * could show ESVLC but never "Valencia, Spain". The request still carries the
   * code and nothing else; this is presentation.
   */
  const [originPort, setOriginPort] = useState<Port | null>(null);
  const [destinationPort, setDestinationPort] = useState<Port | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [readyDate, setReadyDate] = useState('');
  const [latestDelivery, setLatestDelivery] = useState('');
  const [flexibility, setFlexibility] = useState<Flexibility>('few_days');

  const [commodity, setCommodity] = useState('');
  const [hsCode, setHsCode] = useState('');
  const [measurements, setMeasurements] = useState('estimated');
  const [lines, setLines] = useState<CargoLine[]>([emptyLine()]);
  const [equipment, setEquipment] = useState<EquipmentDraft[]>([]);
  /** Container card the rail should show, when the choice was made elsewhere. */
  const [focusContainer, setFocusContainer] = useState<{ code: string; at: number } | null>(null);
  const [handling, setHandling] = useState<Record<string, boolean>>({});
  const [dangerousGoods, setDangerousGoods] = useState<DangerousGoodsDraft[]>([]);
  const [temperature, setTemperature] = useState<TemperatureDraft>(emptyTemperature);
  const [oversize, setOversize] = useState<OversizeDraft[]>([]);

  const [cargoValue, setCargoValue] = useState('');
  const [countryOfOrigin, setCountryOfOrigin] = useState('');
  const [batteries, setBatteries] = useState('none');

  const [shipper, setShipper] = useState('');
  const [consignee, setConsignee] = useState('');
  const [customerReference, setCustomerReference] = useState('');
  const [costCentre, setCostCentre] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [freightPayable, setFreightPayable] = useState('prepaid');
  const [notes, setNotes] = useState('');

  const failure = (create.error ?? submit.error) as LookupWriteError | null;
  const mayCreate = Boolean(session?.permissions.includes('quotes.create'));

  // Which modes exist, how they are worded, and which load types belong to each
  // are all maintained on the Lookups screen. Nothing about the offer is in this
  // file: deactivating a mode there removes its card, with no release.
  const modeItems = useReference(REFERENCE.transportMode, { audience: 'customer' });
  const modes = useMemo(
    () => (modeItems.data ?? []).filter((item) => item.code in MODE_ICONS),
    [modeItems.data],
  );

  // Every load type, unfiltered, because the cards below offer all modes at once
  // and each one needs its own. `metadata.modes` says which modes a load type
  // belongs to; the grouping that used to be a mode-scoped request is done here
  // instead, so choosing a card costs no round trip.
  const loadTypeItems = useReference(REFERENCE.loadType, { audience: 'customer' });
  const allLoadTypes = useMemo(() => loadTypeItems.data ?? [], [loadTypeItems.data]);

  const loadTypesFor = useCallback(
    (modeCode: string) =>
      allLoadTypes.filter((item) => {
        const scoped = (item.metadata as { modes?: unknown } | null)?.modes;
        // No modes recorded means it applies everywhere - the same reading the
        // API's own matchesMode() uses, so the two never disagree.
        return !Array.isArray(scoped) || scoped.length === 0 || scoped.includes(modeCode);
      }),
    [allLoadTypes],
  );

  /*
   * One card per thing a customer can actually ask for: "Sea FCL", "Sea LCL",
   * "Air". A mode with load types contributes one card each, a mode without them
   * contributes itself.
   *
   * This is presentation only. The request still carries mode and loadType as two
   * fields, because that is what CargoWise and the quote contract expect - the
   * card just stops the customer having to assemble them from two separate rows,
   * where the load type was preselected and easy to miss.
   */
  const services = useMemo(
    () =>
      modes.flatMap((item) => {
        const forMode = loadTypesFor(item.code);
        if (forMode.length === 0) {
          return [{
            key: `${item.code}:`,
            mode: item.code,
            loadType: undefined as string | undefined,
            label: item.label,
            description: item.description ?? undefined,
          }];
        }
        return forMode.map((load) => ({
          key: `${item.code}:${load.code}`,
          mode: item.code,
          loadType: load.code as string | undefined,
          // "Sea FCL" - the mode's wording and the load type's code, both from
          // the lookups, matching the chip the summary already draws.
          label: `${item.label} ${load.code}`,
          description: load.description ?? item.description ?? undefined,
        }));
      }),
    [modes, loadTypesFor],
  );

  // Nothing is chosen until the customer chooses. The previous default silently
  // submitted the first mode and the first load type - a groupage request left as
  // FCL because that row was never looked at.
  const selectedService = `${selectedMode}:${selectedLoadType}`;
  const service = services.find((item) => item.key === selectedService);
  const mode = (service?.mode ?? '') as TransportMode;
  const loadType = service?.loadType;

  const containerised = Boolean(loadType && CONTAINERISED.has(loadType));

  // "Sea FCL" — the mode and, where it has one, the load type. Both come from
  // the lookups, so this is never a translated string of our own.
  const serviceLabel = [
    modes.find((item) => item.code === mode)?.label,
    loadType,
  ]
    .filter(Boolean)
    .join(' ') || EMPTY;

  // The API refuses a request carrying dangerous goods when this is off. Hiding
  // the option is the courtesy that stops a customer filling the whole form and
  // meeting a 403 at the end.
  const mayDeclareDangerousGoods = useFeature('quotations.dangerous_goods');
  const handlingOptions = HANDLING.filter(
    (key) => key !== 'dangerousGoods' || mayDeclareDangerousGoods,
  );
  const declaringDangerousGoods = Boolean(handling.dangerousGoods) && mayDeclareDangerousGoods;

  const aiIntakeEnabled = useFeature('quotations.ai_intake');

  /**
   * Fills the form from a bag of fields.
   *
   * Two things arrive this way and neither is trusted over the customer: an
   * assistant draft, and the instant strip's handoff when somebody decides their
   * shipment needs more said about it. Only what is still empty is filled - a
   * customer who has started typing must never have their own answer replaced.
   */
  const applyFields = (f: Record<string, unknown>) => {
    const str = (key: string) => (typeof f[key] === 'string' ? (f[key] as string).trim() : '');
    const nbr = (key: string) => (typeof f[key] === 'number' ? (f[key] as number) : null);

    const fill = (current: string, next: string, set: (v: string) => void) => {
      if (current.trim() === '' && next !== '') set(next);
    };

    fill(originCode, str('originCode').toUpperCase(), setOriginCode);
    fill(destinationCode, str('destinationCode').toUpperCase(), setDestinationCode);

    /*
     * A document says "Ningbo", not "CNNGB". Without the place name in the box
     * the field simply stays on its placeholder, so the name is put in to drive
     * the port search and the customer confirms the exact port from it.
     */
    const seedPlace = (code: string, text: string, current: string, set: (v: string) => void) => {
      if (current.trim() !== '' || code !== '') return;
      if (text !== '') set(text);
    };

    seedPlace(str('originCode'), str('originText'), originText || originCode, setOriginText);
    seedPlace(
      str('destinationCode'),
      str('destinationText'),
      destinationText || destinationCode,
      setDestinationText,
    );

    fill(pickupAddress, str('pickupAddress'), setPickupAddress);
    fill(deliveryAddress, str('deliveryAddress'), setDeliveryAddress);
    fill(commodity, str('commodity'), setCommodity);
    fill(hsCode, str('hsCode'), setHsCode);
    fill(namedPlace, str('namedPlace'), setNamedPlace);
    fill(shipper, str('shipper'), setShipper);
    fill(consignee, str('consignee'), setConsignee);
    fill(customerReference, str('customerReference'), setCustomerReference);
    fill(readyDate, str('readyDate'), setReadyDate);
    fill(notes, str('notes'), setNotes);

    const value = nbr('cargoValue');
    if (cargoValue.trim() === '' && value !== null) setCargoValue(String(value));

    const currencyCode = str('cargoValueCurrency').toUpperCase();
    if (currencyCode !== '') setCurrency(currencyCode);

    const term = str('incoterm').toUpperCase();
    if (term !== '' && INCOTERMS.some((i) => i === term)) setIncoterm(term as Incoterm);

    const nextScope = str('scope');
    if (nextScope !== '' && SCOPES.some((s) => s === nextScope)) setScope(nextScope);

    /*
     * A service card is one choice made of two fields. Setting the load type on
     * its own leaves no card selected and the Service section unfinished, so the
     * pair is resolved against the cards the lookups actually offer.
     */
    const nextMode = str('mode').toLowerCase();
    const nextLoadType = str('loadType');
    if (selectedMode === '' && nextMode !== '') {
      const card =
        services.find((item) => item.mode === nextMode && (item.loadType ?? '') === nextLoadType)
        ?? services.find((item) => item.mode === nextMode);

      if (card) {
        setSelectedMode(card.mode);
        setSelectedLoadType(card.loadType ?? '');
      }
    }

    // Containers the rules proposed, as ordinary draft rows the customer edits.
    const proposed = Array.isArray(f.equipment) ? (f.equipment as { containerType: string; quantity: number }[]) : [];
    const totalGross = nbr('grossWeightKg');

    /*
     * The cargo a hazard sits in has to be nameable, so the ids are minted here
     * and reused for the declaration's link rather than read back from state.
     */
    let hazardCarriers: string[] = [];

    if (equipment.length === 0 && proposed.length > 0) {
      const units = proposed.reduce((sum, unit) => sum + unit.quantity, 0);
      // The headline weight of a full load is what the boxes carry, so without a
      // per-unit figure the Cargo section can never finish.
      const perUnit = totalGross !== null && units > 0 ? Math.round(totalGross / units) : null;

      const rows = proposed.map((unit) => ({
        unitId: crypto.randomUUID(),
        containerType: unit.containerType,
        quantity: unit.quantity,
        grossWeightPerUnitKg: perUnit === null ? '' : String(perUnit),
      }));

      hazardCarriers = rows.map((row) => row.unitId);
      setEquipment(rows);
      // The rail hides most of twelve types, so the agent's choice is scrolled to.
      const first = rows[0];
      setFocusContainer(first ? { code: first.containerType, at: Date.now() } : null);
    } else if (equipment.length > 0) {
      hazardCarriers = equipment.map((unit) => unit.unitId);
    }

    /*
     * A shared load is weighed on its lines instead. Only the untouched opening
     * line is written to, so nothing the customer typed is overwritten.
     */
    const packageCount = nbr('packageCount');
    const opening = lines[0];
    const untouched = lines.length === 1 && opening !== undefined && opening.weightKg.trim() === '';

    /*
     * Lines that arrive already described - the instant strip collects a
     * quantity, a packaging, dimensions and a weight per row - are taken as they
     * are. Reducing them to a count and a total, which is all the assistant can
     * offer, would throw away measurements the customer has already given.
     */
    const described = Array.isArray(f.packages)
      ? (f.packages as { quantity: number; packageType: string; lengthCm?: number; widthCm?: number; heightCm?: number; weightKg: number }[])
      : [];

    if (proposed.length === 0 && described.length > 0 && untouched) {
      const rows = described.map((line) => ({
        key: crypto.randomUUID(),
        quantity: String(line.quantity),
        packageType: line.packageType,
        lengthCm: line.lengthCm === undefined ? '' : String(line.lengthCm),
        widthCm: line.widthCm === undefined ? '' : String(line.widthCm),
        heightCm: line.heightCm === undefined ? '' : String(line.heightCm),
        weightKg: String(line.weightKg),
      }));
      setLines(rows);
      hazardCarriers = rows.map((row) => row.key);
    } else if (proposed.length === 0 && untouched && totalGross !== null) {
      const count = packageCount !== null && packageCount > 0 ? packageCount : 1;
      setLines([
        {
          ...opening,
          quantity: String(count),
          packageType: str('packageType') || opening.packageType,
          weightKg: String(Math.round((totalGross / count) * 100) / 100),
        },
      ]);
      hazardCarriers = [opening.key];
    } else if (proposed.length === 0 && opening !== undefined) {
      hazardCarriers = [opening.key];
    }

    if (f.temperature === true) {
      setHandling((current) => ({ ...current, temperature: true }));

      const setPoint = nbr('temperatureSetPointCelsius');
      if (setPoint !== null && temperature.setPointCelsius.trim() === '') {
        setTemperature((current) => ({ ...current, setPointCelsius: String(setPoint) }));
      }
    }

    /*
     * A declaration, not a tick. The entry carries whatever the document stated
     * and the agent asks for the rest, because the form refuses an incomplete one.
     */
    if (f.dangerousGoods === true && mayDeclareDangerousGoods) {
      setHandling((current) => ({ ...current, dangerousGoods: true }));

      if (dangerousGoods.length === 0) {
        const dgCount = nbr('dgPackageCount');
        const netQuantity = nbr('netQuantityPerPackage');
        const flashpoint = nbr('flashpointCelsius');
        const group = str('packingGroup').toUpperCase();

        setDangerousGoods([
          {
            ...emptyDangerousGoods(),
            unNumber: str('unNumber'),
            hazardClass: str('hazardClass'),
            properShippingName: str('properShippingName'),
            packingGroup: (group === 'I' || group === 'II' || group === 'III'
              ? group
              : '') as DangerousGoodsDraft['packingGroup'],
            technicalName: str('technicalName'),
            flashpointCelsius: flashpoint === null ? '' : String(flashpoint),
            packagingType: str('dgPackagingType'),
            packageCount: dgCount === null ? '' : String(dgCount),
            netQuantityPerPackage: netQuantity === null ? '' : String(netQuantity),
            quantityUnit: str('quantityUnit'),
            appliesToLines: hazardCarriers,
          },
        ]);
      }
    }
  };

  /**
   * The assistant's draft, and the instant strip's handoff, are the same job:
   * a bag of fields to fill what is still empty. One implementation, so the two
   * doors can never drift apart.
   */
  const applyIntakeDraft = (draft: IntakeDraft) => applyFields(draft.fields);

  /*
   * What the instant strip was carrying when the customer asked for the detailed
   * form instead.
   *
   * It travels in router state rather than storage: it belongs to this one
   * navigation, and it should not survive a refresh or reappear in another tab.
   * Applied once - the ref, not the state, is what guards that, because applying
   * it sets state and would otherwise run again on the render that follows - and
   * then cleared from history so a back-and-forward does not re-apply it over
   * edits the customer has since made.
   */
  const handedOff = useRef(false);

  useEffect(() => {
    if (handedOff.current) return;
    const prefill = (location.state as { prefill?: Record<string, unknown> } | null)?.prefill;
    if (!prefill) return;

    handedOff.current = true;
    applyFields(prefill);
    navigate(location.pathname, { replace: true, state: null });
    // applyFields closes over every field on the form and changes identity each
    // render; the ref above is the guard, so it is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, navigate]);

  /** An answer to one of the assistant's questions goes straight into its field. */
  const applyIntakeAnswer = (question: { field: string }, answer: string) => {
    /*
     * The agent asks for a place in words, but the form holds a UN/LOCODE. Only a
     * real code is accepted; anything else seeds the port search so the customer
     * picks the exact port from the directory.
     */
    const place = (code: (v: string) => void, query: (v: string) => void) => (v: string) => {
      const candidate = v.trim().toUpperCase();
      if (/^[A-Z]{5}$/.test(candidate)) {
        code(candidate);
        query(candidate);
      } else {
        query(v.trim());
      }
    };

    /** Answers are typed the way they are displayed, DD.MM.YYYY, not as ISO. */
    const asIsoDate = (v: string) => {
      const dmy = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(v.trim());
      if (dmy) {
        const [, d, m, y] = dmy;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      return /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : '';
    };

    /** Every hazard answer edits the one declaration the draft opened. */
    const updateHazard = (change: (entry: DangerousGoodsDraft) => DangerousGoodsDraft) =>
      setDangerousGoods((current) => {
        const first = current[0];
        return first ? [change(first), ...current.slice(1)] : current;
      });

    const setters: Record<string, (v: string) => void> = {
      originCode: place(setOriginCode, setOriginText),
      destinationCode: place(setDestinationCode, setDestinationText),
      commodity: setCommodity,
      readyDate: (v) => {
        const iso = asIsoDate(v);
        if (iso !== '') setReadyDate(iso);
      },
      pickupAddress: setPickupAddress,
      deliveryAddress: setDeliveryAddress,
      volumeM3: () => undefined,
      incoterm: (v) => {
        const term = v.toUpperCase();
        if (INCOTERMS.some((i) => i === term)) setIncoterm(term as Incoterm);
      },
      namedPlace: setNamedPlace,
      shipper: setShipper,
      consignee: setConsignee,

      /*
       * A full load is weighed per container and a shared one per line, so the
       * same answer lands in whichever the request is actually using.
       */
      grossWeightKg: (v) => {
        const total = num(v);
        if (total === null || total <= 0) return;

        if (equipment.length > 0) {
          const units = equipment.reduce((sum, unit) => sum + unit.quantity, 0);
          const perUnit = units > 0 ? Math.round(total / units) : total;
          setEquipment((current) =>
            current.map((unit) => ({ ...unit, grossWeightPerUnitKg: String(perUnit) })),
          );
          return;
        }

        setLines((current) => {
          const first = current[0];
          if (!first) return current;
          const count = num(first.quantity) ?? 1;
          const per = Math.round((total / (count > 0 ? count : 1)) * 100) / 100;
          return [{ ...first, weightKg: String(per) }, ...current.slice(1)];
        });
      },

      temperatureSetPointCelsius: (v) => {
        const point = num(v);
        // Outside this band it is not a set point, and a silent bad value would
        // leave the Cargo section blocked with no explanation.
        if (point === null || point < -70 || point > 40) return;
        setTemperature((current) => ({ ...current, setPointCelsius: String(point) }));
      },

      unNumber: (v) => updateHazard((entry) => ({ ...entry, unNumber: v.replace(/\D/g, '').slice(0, 4) })),
      hazardClass: (v) => updateHazard((entry) => ({ ...entry, hazardClass: v.trim() })),
      properShippingName: (v) => updateHazard((entry) => ({ ...entry, properShippingName: v.trim() })),
      technicalName: (v) => updateHazard((entry) => ({ ...entry, technicalName: v.trim() })),
      dgPackagingType: (v) => updateHazard((entry) => ({ ...entry, packagingType: v.trim() })),
      quantityUnit: (v) => updateHazard((entry) => ({ ...entry, quantityUnit: v.trim().toUpperCase() })),
      packingGroup: (v) => {
        const group = v.toUpperCase().replace(/[^IV]/g, '');
        if (group !== 'I' && group !== 'II' && group !== 'III') return;
        updateHazard((entry) => ({ ...entry, packingGroup: group }));
      },
      dgPackageCount: (v) => {
        const count = num(v);
        if (count === null || !Number.isInteger(count) || count <= 0) return;
        updateHazard((entry) => ({ ...entry, packageCount: String(count) }));
      },
      netQuantityPerPackage: (v) => {
        const quantity = num(v);
        if (quantity === null || quantity <= 0) return;
        updateHazard((entry) => ({ ...entry, netQuantityPerPackage: String(quantity) }));
      },
    };

    setters[question.field]?.(answer);
  };

  // Every option list below is maintained on the Lookups screen, not in this file.
  const packagingOptions = useReferenceLabels(REFERENCE.packageType, { audience: 'customer' });
  const commodityOptions = useReferenceLabels(REFERENCE.commodityGroup, { audience: 'customer' });
  const countryOptions = useReferenceLabels(REFERENCE.country, { audience: 'customer' });

  /*
   * Route suggestions come from the port directory, not a lookup: it is ~100k rows
   * on a twice-yearly release cycle, so it is searched a few characters at a time
   * rather than fetched whole. Narrowed by mode, because an air quote has no
   * business offering a location that only handles ships.
   */
  const originSearch = usePortSearch(originText, { mode });
  const destinationSearch = usePortSearch(destinationText, { mode });

  /*
   * The field keeps "ESVLC — Valencia" after a pick, not the bare code.
   *
   * Someone who chose Valencia from a list and then watched the box collapse to
   * five letters has no way to tell whether the right thing was taken. The code is
   * still what the request carries - `portCodeFrom` reads it back off the front of
   * the label, and off a typed code just the same.
   */
  /*
   * A code can also arrive without anyone picking it: restored from a draft, or
   * filled in by the intake panel. The directory search runs on that code as its
   * query, so the record is usually already in hand — this reads it back rather
   * than leaving the band with a bare code it could have named.
   */
  const originPlace = originPort ?? (originSearch.data ?? []).find((p) => p.code === originCode) ?? null;
  const destinationPlace =
    destinationPort ?? (destinationSearch.data ?? []).find((p) => p.code === destinationCode) ?? null;

  const asOptions = (ports: Port[]): AutocompleteOption[] =>
    ports.map((port) => ({
      value: portLabel(port),
      label: portLabel(port),
      // The country, spelled out. Typing "Spain" is how most of these are found,
      // so the row has to show which country it answered with.
      hint: port.countryName ?? port.countryCode,
    }));
  const currencyOptions = useReferenceOptions(REFERENCE.currency, { audience: 'customer' });
  const allIncoterms = useReferenceOptions(REFERENCE.incoterm, { audience: 'customer' });

  // Sea-only Incoterms are removed rather than shown and refused. The server
  // enforces the same rule; offering an invalid choice only to reject it wastes
  // the customer's time.
  const incotermOptions = useMemo(
    () => allIncoterms.filter((term) => mode === 'sea' || !SEA_ONLY.has(term.value)),
    [allIncoterms, mode],
  );

  // Only correct once the list has arrived. Correcting against an empty list
  // would reset the customer's choice on every first render.
  if (incoterm && incotermOptions.length > 0
      && !incotermOptions.some((term) => term.value === incoterm)) {
    setIncoterm(mode === 'sea' ? 'FOB' : 'FCA');
  }

  const needsPickup = scope === 'door_door' || scope === 'door_port';
  const needsDelivery = scope === 'door_door' || scope === 'port_door';

  // Read once per mount rather than per render, so the picker's disabled range
  // and the relative line cannot disagree halfway through filling the form.
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  // The relative line is translated here; dateParts refuses to invent English.
  const readyParts = useMemo(() => {
    const parts = dateParts(readyDate, {
      today,
      formatRelative: (days) =>
        days === 0 ? t('reqDateToday') : t('reqDateInDays', { count: days }),
    });
    // The tone is set here rather than left to default, which is brand red.
    return parts ? { ...parts, relativeTone: leadTone(parts.relativeDays ?? undefined) } : parts;
  }, [readyDate, today, t]);

  /** The delivery deadline, read the same way as the ready date above it. */
  const latestParts = useMemo(() => {
    const parts = dateParts(latestDelivery, {
      today,
      formatRelative: (days) =>
        days === 0 ? t('reqDateToday') : t('reqDateInDays', { count: days }),
    });
    // The tone is set here rather than left to default, which is brand red.
    return parts ? { ...parts, relativeTone: leadTone(parts.relativeDays ?? undefined) } : parts;
  }, [latestDelivery, today, t]);

  const totals = useMemo(() => {
    if (containerised) {
      // The headline weight is what the containers carry; there are no lines.
      return { weight: equipmentGrossWeight(equipment), volume: 0 };
    }

    const weight = lines.reduce((sum, line) => {
      const kg = num(line.weightKg); const q = num(line.quantity);
      return sum + (kg !== null && q !== null ? kg * q : 0);
    }, 0);
    const volume = lines.reduce((sum, line) => sum + lineVolume(line), 0);
    return { weight, volume };
  }, [containerised, equipment, lines]);

  const unlocode = /^[A-Z]{2}[A-Z0-9]{3}$/;
  /*
   * An Incoterm without its named place is not a term of sale. "FOB" alone does
   * not say where cost and risk pass, and DAP to a quay is a different quote from
   * DAP to a warehouse 300km inland - so the request is not priceable without it.
   * The form always has an Incoterm set, so this is always asked.
   */
  const okService = Boolean(mode && scope && (!incoterm || namedPlace.trim() !== ''));
  const okRoute =
    unlocode.test(originCode) && unlocode.test(destinationCode) && Boolean(readyDate)
    && deliveryAfterReady(readyDate, latestDelivery)
    && (!needsPickup || pickupAddress.trim() !== '')
    && (!needsDelivery || deliveryAddress.trim() !== '');
  const okCargo =
    commodity.trim() !== '' && totals.weight > 0
    // A full-load request describes nothing to price without a container.
    && (!containerised || equipment.length > 0)
    && (!declaringDangerousGoods || (dangerousGoods.length > 0 && dangerousGoodsComplete(dangerousGoods)))
    // Each flag must be answered, not merely ticked. A flag with nothing behind
    // it is what the old "a specialist will call" note papered over.
    && (!handling.temperature || temperatureComplete(temperature))
    && (!handling.outOfGauge || oversizeComplete(oversize));
  const okParties = shipper.trim() !== '' && consignee.trim() !== '';
  const ready = okService && okRoute && okCargo && okParties;

  if (!mayCreate) {
    return (
      <CustomerMeasure>
        <StatePanel title={t('accessDenied')} />
      </CustomerMeasure>
    );
  }

  /*
   * One list, not three.
   *
   * A finished step states what it holds; an unfinished one states what is
   * missing, in the words the old blocker panel used. Saying it here rather
   * than in a second panel keeps the answer in the place the customer is
   * already looking, and the step is already a link to its own card — which
   * was the only thing that panel added.
   */
  const steps = [
    { id: 'card-service', label: t('reqStepService'), done: okService, note: okService ? serviceLabel : t('reqBlocked_card-service') },
    { id: 'card-route', label: t('reqStepRoute'), done: okRoute, note: okRoute ? `${originCode} → ${destinationCode}` : t('reqBlocked_card-route') },
    { id: 'card-cargo', label: t('reqStepCargo'), done: okCargo, note: okCargo ? `${totals.weight.toLocaleString()} kg` : t('reqBlocked_card-cargo') },
    { id: 'card-parties', label: t('reqStepParties'), done: okParties, note: okParties ? consignee : t('reqBlocked_card-parties') },
  ];

  /*
   * The rail, and what each node is allowed to say about itself.
   *
   * `done` is the section's own validation - the same expression the send button
   * reads - so the rail can never claim a step is finished while the request is
   * refused. `blocked` only becomes true once somebody has tried to move past
   * it; before that an unanswered section is "not started", not an error.
   */
  const sections = steps.map((section, index) => ({
    ...section,
    index,
    current: index === step,
    blocked: Boolean(attempted[index]) && !section.done,
    state: section.done
      ? ('done' as const)
      : index === step
        ? ('current' as const)
        : ('todo' as const),
  }));

  const active = sections[step] ?? sections[0];
  const lastStep = sections.length - 1;

  /**
   * A required field's message, once its step has been pressed past.
   *
   * Nothing before that: an untouched form covered in red tells a customer they
   * have done something wrong when all they have done is arrive. After a refused
   * Continue, every field actually holding the step up says so itself - so "what
   * is missing" is answered where the answer goes, not only in a sentence at the
   * foot of the card.
   */
  const required = (index: number, missing: boolean, message?: string) =>
    attempted[index] && missing ? (message ?? t('reqFieldRequired')) : undefined;

  /**
   * Leaves a step, or refuses to.
   *
   * Refusing is the point: the blocker beneath the button names what is missing,
   * and `attempted` is what turns the rail node red. Moving BACK is always
   * allowed - a customer re-reading what they typed is not an error.
   */
  const goToStep = (next: number) => {
    if (next > step && !active.done) {
      setAttempted((current) => ({ ...current, [step]: true }));
      return;
    }
    setStep(Math.max(0, Math.min(lastStep, next)));
  };

  const pieces = lines.reduce((sum, line) => sum + (num(line.quantity) ?? 0), 0);
  const cargoLine = containerised
    ? equipment.map((unit) => `${unit.quantity} × ${unit.containerType}`).join(' + ')
    : t('reqSummaryPieces', { count: pieces });

  // Built here rather than inside the card so the card stays a presenter and the
  // rules that decide a value live beside the rules that validate it. `attention`
  // marks a contradiction the customer must resolve, never a field they have yet
  // to reach - brand red is for errors, not for an untouched form.
  /*
   * What the request says that is NOT already on the screen.
   *
   * Route and service used to be the first two rows; both are in the hero band
   * at the top of this same page, in larger type, permanently. A summary that
   * repeats the banner above it is not a summary.
   */
  const summaryRows: SummaryRow[] = [
    { key: 'cargo', label: t('reqSummaryCargo'), value: cargoLine || EMPTY },
    { key: 'gross', label: t('reqSummaryGross'), value: totals.weight > 0 ? `${totals.weight.toLocaleString()} kg` : EMPTY },
    { key: 'ready', label: t('reqSummaryReady'), value: formatDate(readyDate) ?? EMPTY },
    {
      key: 'services',
      label: t('reqSummaryServices'),
      value: ADD_ONS.filter((key) => addOns[key]).map((key) => t(`reqService_${key}`)).join(', ')
        || t('reqSummaryFreightOnly'),
    },
    { key: 'currency', label: t('reqSummaryCurrency'), value: `${currency} · ${t(`reqPayable_${freightPayable}`)}` },
  ];

  // Optional, so it earns a row only once it is set — or once it contradicts
  // the ready date, which is the one time an empty one would matter.
  if (latestDelivery || !deliveryAfterReady(readyDate, latestDelivery)) {
    summaryRows.push({
      key: 'latest',
      label: t('reqSummaryLatest'),
      value: formatDate(latestDelivery) ?? EMPTY,
      attention: !deliveryAfterReady(readyDate, latestDelivery),
    });
  }

  if (num(cargoValue) !== null) {
    summaryRows.push({
      key: 'value',
      label: t('reqSummaryDeclaredValue'),
      value: `${currency} ${num(cargoValue)!.toLocaleString()}`,
    });
  }

  if (batteries !== 'none') {
    summaryRows.push({
      key: 'batteries',
      label: t('reqSummaryBatteries'),
      value: t(`reqBatteries_${batteries}`),
    });
  }

  if (declaringDangerousGoods) {
    const linked = dangerousGoods.length > 0 && dangerousGoodsComplete(dangerousGoods);
    summaryRows.push({
      key: 'dg',
      label: t('reqSummaryDg'),
      value: linked
        ? t('reqSummaryDgCount', { count: dangerousGoods.length })
        : t('reqSummaryDgIncomplete'),
      attention: !linked,
    });
  }

  if (handling.temperature) {
    summaryRows.push({
      key: 'temp',
      label: t('reqSummaryTemperature'),
      value: temperatureComplete(temperature)
        ? `${temperature.setPointCelsius} °C`
        : t('reqSummaryNotSet'),
      attention: !temperatureComplete(temperature),
    });
  }

  if (handling.outOfGauge) {
    summaryRows.push({
      key: 'oog',
      label: t('reqSummaryOversize'),
      value: oversizeComplete(oversize)
        ? t('reqSummaryOversizeCount', { count: oversize.length })
        : t('reqSummaryNotSet'),
      attention: !oversizeComplete(oversize),
    });
  }

  const summaryChips = [
    measurements === 'estimated' ? t('reqSummaryEstimated') : null,
    handling.notStackable ? t('reqHandling_notStackable') : null,
  ].filter((chip): chip is string => chip !== null);

  // The mode chip is solid and leads; the rest are ghosts. A hazard is drawn in
  // the action colour, because it changes what may legally be carried.
  const heroChips: { label: string; tone: 'solid' | 'ghost' | 'alert' }[] = [
    { label: serviceLabel, tone: 'solid' as const },
    { label: t(`reqDirection_${direction}`), tone: 'ghost' as const },
    { label: namedPlace.trim() ? `${incoterm} ${namedPlace.trim()}` : incoterm, tone: 'ghost' as const },
    { label: t(`reqScope_${scope}`, { defaultValue: scope }), tone: 'ghost' as const },
    ...(declaringDangerousGoods
      ? [{ label: t('reqHandling_dangerousGoods'), tone: 'alert' as const }]
      : []),
    ...(handling.temperature
      ? [{ label: t('reqHandling_temperature'), tone: 'ghost' as const }]
      : []),
  ].filter((chip) => Boolean(chip.label));

  /*
   * The journey, read off the request itself.
   *
   * Only rendered once a mode we recognise is chosen: an unknown mode used to
   * fall back silently to sea, so adding "barge" to the lookup would have shown
   * a river barge going through an ocean terminal.
   */
  const groupage = !containerised && (mode === 'sea' || mode === 'road');
  const middle = mode in MIDDLE ? (groupage ? GROUPAGE : MIDDLE[mode]) : undefined;
  const stages: JourneyStage[] = middle
    ? [
        ...(needsPickup ? [{ id: 'pickup' }] : []),
        ...middle,
        ...(needsDelivery ? [{ id: 'delivery' }] : []),
      ].map((stage) => ({ ...stage, label: t(`reqLeg_${stage.id}`) }))
    : [];


  const send = async () => {
    const created = (await create.mutateAsync({
      mode,
      loadType,
      originCode,
      destinationCode,
      commodity: commodity.trim(),
      grossWeightKg: totals.weight,
      volumeM3: totals.volume > 0 ? totals.volume : undefined,
      currency,
      incoterm: incoterm || undefined,
      readyDate: readyDate || undefined,
      customerReference: customerReference.trim() || undefined,
      notes: notes.trim() || undefined,
      // Containers and package lines are alternatives, never both: sending the
      // default empty line alongside containers would describe cargo twice.
      packages: containerised
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
            })),
      equipment: containerised ? equipment.map(toEquipmentInput) : undefined,
      temperatureControl: handling.temperature ? toTemperatureInput(temperature) : undefined,
      oversizeItems: handling.outOfGauge
        ? oversize
            .map(toOversizeInput)
            .filter((item): item is NonNullable<typeof item> => item !== null)
        : undefined,
      // Its own table, not the payload: ops must be able to ask which live quotes
      // carry a given class, and a hazard inside a JSON blob is a hazard nobody
      // can query.
      dangerousGoods: declaringDangerousGoods
        ? dangerousGoods
            .map(toDangerousGoodsInput)
            .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        : undefined,
      // The long tail of the request. `payload` is exactly where the schema says
      // a field lives until it earns a column by being filtered, sorted or sent
      // to another system - so special handling, customs and parties go here.
      payload: {
        direction,
        namedPlace: namedPlace.trim() || null,
        scope,
        additionalServices: ADD_ONS.filter((key) => addOns[key]),
        pickupAddress: pickupAddress.trim() || null,
        deliveryAddress: deliveryAddress.trim() || null,
        latestDeliveryDate: latestDelivery || null,
        hsCode: hsCode.trim() || null,
        measurements,
        specialHandling: HANDLING.filter((key) => handling[key]),
        cargoValue: num(cargoValue),
        countryOfOrigin: countryOfOrigin.trim() || null,
        batteries,
        shipper: shipper.trim(),
        consignee: consignee.trim(),
        costCentre: costCentre.trim() || null,
        freightPayable,
        dateFlexibility: flexibility,
      },
    })) as { id: string; reference?: string } | undefined;

    if (created?.id) {
      await submit.mutateAsync(created.id);
      navigate(`/app/quotations/${created.id}`);
    }
  };

  const setLine = (key: string, patch: Partial<CargoLine>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const sending = create.isPending || submit.isPending;

  // LD-02. Sending is two calls — create then submit — so the wait is long
  // enough to need saying what is happening, and which of the two it is on.
  if (sending) {
    return (
      <CustomerMeasure>
        <RouteLoader
          eyebrow={t('reqSendingEyebrow', {
            mode: serviceLabel,
            direction: t(`reqDirection_${direction}`),
          })}
          estimate={t('reqSendingEstimate')}
          originCode={originCode}
          destinationCode={destinationCode}
          modeIcon={MODE_ICONS[mode] ?? 'routing'}
          message={create.isPending ? t('reqSendingCreate') : t('reqSendingSubmit')}
          doneLabel={t('reqSendingDone')}
          currentLabel={t('reqSendingCurrent')}
          steps={[
            {
              id: 'create',
              label: t('reqSendingCreate'),
              state: create.isPending ? 'current' : 'done',
            },
            {
              id: 'submit',
              label: t('reqSendingSubmit'),
              state: create.isPending ? 'waiting' : 'current',
            },
          ]}
        />
      </CustomerMeasure>
    );
  }

  const cardState = {
    doneLabel: t('reqCardComplete'),
    todoLabel: t('reqCardInProgress'),
  };

  /*
   * The step controls, as the card header draws them.
   *
   * Built once and handed to whichever card is on screen: the last one sends
   * instead of continuing, and that is the only difference between them.
   */
  const cardNav = (index: number) => ({
    back: index > 0 ? () => goToStep(index - 1) : undefined,
    backLabel: t('reqStepBackTo', { name: sections[index - 1]?.label ?? '' }),
    next: index < lastStep ? () => goToStep(index + 1) : send,
    nextLabel:
      index < lastStep
        ? t('reqStepContinue', { name: sections[index + 1]?.label ?? '' })
        : ready
          ? t('reqSend')
          : t('reqSendBlocked'),
    nextDisabled: index === lastStep && (!ready || create.isPending || submit.isPending),
  });

  return (
    <div className={styles.page}>
      {/* The page title lives in the breadcrumb, where the mockup puts it. It is
          still an h1, because a page with no h1 is a page a screen reader user
          cannot orient in. */}
      <h1 className="noa-visually-hidden">{t('reqTitle')}</h1>

      <HeroBand
        rise
        eyebrow={[
          t(`reqDirection_${direction}`),
          serviceLabel,
          t(`reqScope_${scope}`, { defaultValue: scope }),
        ].join(' · ').toUpperCase()}
        breadcrumb={
          <RouteBreadcrumb
            label={t('breadcrumb')}
            homeHref="/app/dashboard"
            homeLabel={t('customerNav_dashboard')}
            onHomeNavigate={() => navigate('/app/dashboard')}
            steps={[
              {
                id: 'quotations',
                label: t('customerNav_quotations'),
                href: '/app/quotations/list',
                onNavigate: () => navigate('/app/quotations/list'),
              },
              { id: 'new', label: t('reqBreadcrumbCurrent') },
            ]}
          />
        }
        route={{
          fromCode: originCode || t('reqHeroFrom'),
          fromLabel: placeOf(originPlace),
          toCode: destinationCode || t('reqHeroTo'),
          toLabel: placeOf(destinationPlace),
          icon: MODE_ICONS[mode] ?? 'routing',
          // Spoken as the places, not the codes: "Valencia, Spain to Ningbo,
          // China" is the sentence, and the codes are shorthand for it.
          label: t('reqHeroRoute', {
            from: placeOf(originPlace) ?? originCode ?? t('reqHeroFrom'),
            to: placeOf(destinationPlace) ?? destinationCode ?? t('reqHeroTo'),
          }),
        }}
        chips={heroChips.map((chip) => (
          <HeroChip key={chip.label} tone={chip.tone}>{chip.label}</HeroChip>
        ))}
      />

      <div className={styles.body}>
      <div className={styles.layout}>
        <div className={styles.form}>

          {/* STEP n OF 4, and the rail. Above the card rather than beside it:
              the question being asked and where you are in the form are one
              thought, and splitting them across two columns is what made the
              side list easy to miss. */}
          <div className={styles.rail}>
            <div className={styles.railHead}>
              <div className={styles.railLede}>
                <span className={styles.railStep}>
                  {t('reqStepOf', {
                    number: step + 1,
                    total: sections.length,
                    name: active.label.toUpperCase(),
                  })}
                </span>
                <span className={styles.railHint}>{t(`reqHint_${active.id}`)}</span>
              </div>

            </div>

            <ol className={styles.railNodes}>
              {sections.map((section) => (
                <li
                  key={section.id}
                  className={styles.railNode}
                  data-state={section.state}
                  data-blocked={section.blocked || undefined}
                >
                  <button
                    type="button"
                    className={styles.railMark}
                    aria-current={section.current ? 'step' : undefined}
                    onClick={() => goToStep(section.index)}
                  >
                    {section.done ? <Check size={14} aria-hidden="true" /> : section.index + 1}
                  </button>
                  <span className={styles.railLabel}>{section.label}</span>
                  <span className={styles.railState}>
                    {section.done
                      ? t('reqStepComplete')
                      : section.current
                        ? t('reqStepInProgress')
                        : t('reqStepNotStarted')}
                  </span>
                </li>
              ))}
            </ol>

            {/* The verdict, beside the button that refused. Every field holding
                the step up is marked in the card below as well; this is the
                sentence that says why nothing happened. */}
            {active.blocked && (
              <p className={styles.railBlocked} role="alert">
                <AlertCircle size={15} aria-hidden="true" />
                {t(`reqBlocked_${active.id}`)}
              </p>
            )}
          </div>

          <div className={styles.step} hidden={step !== 0}>
          <Card id="card-service" nav={cardNav(0)} number={1} lifted done={okService} {...cardState}
            title={t('reqStepService')} hint={t('reqServiceHint')}>
            {/* SE-01. One card per service that can actually be asked for, so
                "Sea FCL" is a single decision rather than a mode plus a load
                type on a separate row that was preselected and easy to miss.
                This choice decides which Incoterms and which cargo shape the
                rest of the form offers, so it is drawn large. */}
            <ModeCards
              label={t('reqMode')}
              showLabel
              options={services.map((item) => ({
                value: item.key,
                label: item.label,
                description: item.description,
                icon: MODE_ICONS[item.mode] ?? 'routing',
              }))}
              value={selectedService}
              onValueChange={(next) => {
                const [nextMode = '', nextLoadType = ''] = next.split(':');
                // Changing the mode changes which Incoterms apply, so it also
                // resets the conventional one. The correction further up only
                // fires when the current term becomes invalid, and FCA stays
                // valid for sea - without this, picking Sea after Air would
                // quote FCA where the trade expects FOB. Switching between
                // FCL and LCL leaves the mode alone, so a deliberate choice
                // there survives.
                if (nextMode !== mode) setIncoterm(nextMode === 'sea' ? 'FOB' : 'FCA');
                setSelectedMode(nextMode);
                setSelectedLoadType(nextLoadType);
              }}
            />

            {/* SE-02. Scope is what the customer is buying — the quieter cards
                keep it readable as four alternatives rather than a dropdown
                whose options are only seen one at a time. */}
            <RadioCards
              label={t('reqScope')}
              showLabel
              options={SCOPES.map((value) => ({ value, label: t(`reqScope_${value}`) }))}
              value={scope}
              onValueChange={setScope}
            />

            <div className={styles.grid}>
              <Select
                label={t('reqIncoterm')}
                value={incoterm}
                options={incotermOptions.length > 0 ? incotermOptions : [{ value: incoterm, label: incoterm }]}
                onValueChange={(value) => setIncoterm(asIncoterm(value) ?? incoterm)}
              />
              {/* Required, because an Incoterm is always set and one without a
                  named place cannot be priced: it does not say where cost and risk
                  pass, nor which legs are being asked for. */}
              <Input
                label={t('reqNamedPlace')} placeholder={t('reqNamedPlacePh')}
                hint={t('reqNamedPlaceHint')}
                maxLength={120}
                required
                error={required(0, namedPlace.trim() === '', t('reqNeedNamedPlace'))}
                value={namedPlace}
                onChange={(event) => setNamedPlace(event.target.value)}
              />
              {/* Import or export is a property of the Incoterm, not a separate
                  question: it belongs in this row, at field height, rather than
                  as two loose pills above it. */}
              <Segmented
                label={t('reqDirection')}
                options={DIRECTIONS.map((value) => ({ value, label: t(`reqDirection_${value}`) }))}
                value={direction}
                onValueChange={setDirection}
              />
            </div>

            {/* SE-03. Multi-select, so chips rather than a column of checkboxes. */}
            <ChipToggles
              label={t('reqAdditionalServices')}
              showLabel
              options={ADD_ONS.map((value) => ({ value, label: t(`reqService_${value}`) }))}
              values={ADD_ONS.filter((key) => addOns[key])}
              onValuesChange={(next) =>
                setAddOns(Object.fromEntries(ADD_ONS.map((key) => [key, next.includes(key)])))
              }
            />
          </Card>
          </div>

          <div className={styles.step} hidden={step !== 1}>
          <Card id="card-route" nav={cardNav(1)} number={2} done={okRoute} {...cardState}
            title={t('reqStepRoute')} hint={t('reqRouteHint')}>
            <div className={styles.grid}>
              {/* RT-01. The directory, not a typed code: nobody outside the trade
                  knows Valencia is ESVLC. Autocomplete rather than ComboInput
                  because here the list IS the answer, so the field has to look
                  like one - it still takes a typed code for a location the
                  directory has not loaded, and the regex decides what is valid. */}
              <Autocomplete
                label={t('reqOrigin')} required
                placeholder={t('reqPortPh')}
                hint={t('reqUnlocodeHint')}
                moreHint={t('reqPortMore')}
                emptyHint={t('reqPortNoMatch')}
                loading={originSearch.isFetching}
                value={originText || originCode}
                options={asOptions(originSearch.data ?? [])}
                // The directory does the filtering, so the field must not filter again:
                // typing "spain" returns ports whose labels contain no "spain".
                onQueryChange={setOriginText}
                error={
                  originCode !== '' && !unlocode.test(originCode)
                    ? t('reqUnlocodeError')
                    : required(1, !unlocode.test(originCode), t('reqNeedPort'))
                }
                onValueChange={(next) => {
                  setOriginText(next);
                  const code = portCodeFrom(next);
                  setOriginCode(code);
                  // Null for a typed code we have no record of, which is the
                  // honest answer: the band then shows the code alone.
                  setOriginPort((originSearch.data ?? []).find((p) => p.code === code) ?? null);
                }}
              />
              <Autocomplete
                label={t('reqDestination')} required
                placeholder={t('reqPortPh')}
                hint={t('reqUnlocodeHint')}
                moreHint={t('reqPortMore')}
                emptyHint={t('reqPortNoMatch')}
                loading={destinationSearch.isFetching}
                value={destinationText || destinationCode}
                options={asOptions(destinationSearch.data ?? [])}
                // The directory does the filtering, so the field must not filter again:
                // typing "spain" returns ports whose labels contain no "spain".
                onQueryChange={setDestinationText}
                error={
                  destinationCode !== '' && !unlocode.test(destinationCode)
                    ? t('reqUnlocodeError')
                    : required(1, !unlocode.test(destinationCode), t('reqNeedPort'))
                }
                onValueChange={(next) => {
                  setDestinationText(next);
                  const code = portCodeFrom(next);
                  setDestinationCode(code);
                  setDestinationPort((destinationSearch.data ?? []).find((p) => p.code === code) ?? null);
                }}
              />
              {needsPickup && (
                <Input label={t('reqPickupAddress')} required={needsPickup} placeholder={t('reqAddressPh')} maxLength={300} value={pickupAddress}
                  error={required(1, pickupAddress.trim() === '')}
                  onChange={(event) => setPickupAddress(event.target.value)} />
              )}
              {needsDelivery && (
                <Input label={t('reqDeliveryAddress')} required={needsDelivery} placeholder={t('reqAddressPh')} maxLength={300} value={deliveryAddress}
                  error={required(1, deliveryAddress.trim() === '')}
                  onChange={(event) => setDeliveryAddress(event.target.value)} />
              )}
            </div>

            <fieldset className={styles.fieldset}>
              {/* The group holds both dates, so it is not named after one of them. */}
              <legend>{t('reqTiming')}</legend>

              <div className={styles.grid}>
                {/* DT-01 D. A date field is a disclosure, not a permanently open
                    calendar: the grid is portalled to the body, closes on outside
                    click, Escape and on choosing a date. DT-03 on its own stays
                    the bare grid for surfaces that want it always visible. */}
                <DateField
                  label={t('reqReadyDate')} required
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

                {/* How far the ready date may move is a pricing question, not a
                    calendar one: a lane with a week of slack is quoted against
                    different sailings than one pinned to a day. */}
                <Segmented
                  label={t('reqFlexibility')}
                  options={FLEXIBILITY.map((value) => ({
                    value,
                    label: t(`reqFlexibility_${value}`),
                  }))}
                  value={flexibility}
                  onValueChange={(value) => setFlexibility(value as Flexibility)}
                />

                {/* The same control as the ready date. It was a bare `type="date"`,
                    which draws the browser's own dd/mm/yyyy widget - a different
                    shape, a different calendar and a different date format sitting
                    beside ours. Two dates on one card have to be picked the same way. */}
                <DateField
                  label={t('reqLatestDelivery')}
                  date={latestParts ?? undefined}
                  placeholder={t('reqLatestDeliveryEmpty')}
                  hint={t('reqOptional')}
                  selected={latestDelivery ? new Date(`${latestDelivery}T00:00:00Z`) : undefined}
                  // No `error` prop, and none needed: the calendar below disables
                  // every day before the ready date, so the picker cannot produce
                  // the mistake the old message described. A bad value arriving from
                  // elsewhere - an intake draft - still fails `okRoute`, so the step
                  // stays open rather than passing silently.
                  onSelect={(date) => setLatestDelivery(date ? isoDate(date) : '')}
                  calendar={{
                    calendarLabel: t('reqLatestDelivery'),
                    today,
                    startMonth: today,
                    // Cargo cannot be delivered before it is collected, so the
                    // calendar refuses it rather than the error message doing so.
                    disabled: { before: readyDate ? new Date(`${readyDate}T00:00:00Z`) : today },
                    legend: {
                      chosen: t('reqDateLegendChosen'),
                      sailing: t('reqDateLegendSailing'),
                      today: t('reqDateLegendToday'),
                      past: t('reqDateLegendPast'),
                    },
                  }}
                />
              </div>
            </fieldset>
          </Card>
          </div>

          <div className={styles.step} hidden={step !== 2}>
          <Card id="card-cargo" nav={cardNav(2)} number={3} done={okCargo} {...cardState}
            title={t('reqStepCargo')} hint={t('reqCargoHint')}>
            <div className={styles.grid}>
              {/* The same control as the route fields: 21 HS sections is a list
                  worth showing, and nobody recites them from memory. Still free
                  text - "anodised aluminium brackets" is a better description of
                  the cargo than the section it falls under. */}
              <Autocomplete
                label={t('reqCommodity')} required placeholder={t('reqCommodityPh')}
                sort
                moreHint={t('reqListMore')}
                maxLength={200}
                error={required(2, commodity.trim() === '')}
                value={commodity}
                options={commodityOptions.map((option) => ({ value: option, label: option }))}
                emptyHint={t('reqComboFreeText')}
                onValueChange={setCommodity}
              />
              <Input label={t('reqHsCode')} placeholder={t('reqHsCodePh')} hint={t('reqOptional')} maxLength={20} value={hsCode}
                onChange={(event) => setHsCode(event.target.value)} />
            </div>

            <PillGroup label={t('reqMeasurements')}>
              <FilterPills
                label={t('reqMeasurements')}
                options={[
                  { value: 'estimated', label: t('reqMeasured_estimated') },
                  { value: 'confirmed', label: t('reqMeasured_confirmed') },
                ]}
                value={measurements}
                onValueChange={setMeasurements}
              />
            </PillGroup>

            {containerised ? (
              <fieldset className={styles.fieldset}>
                {/* The mockup puts the running total beside the heading, not under the grid. */}
                <legend className={styles.legendRow}>
                  <span>{t('reqEquipment')}</span>
                  <span className={styles.legendTotal}>
                    {totals.weight > 0
                      ? t('reqTotalGross', { kg: totals.weight.toLocaleString() })
                      : equipment.length > 0
                        ? t('reqEquipmentNoWeight')
                        : t('reqEquipmentEmpty')}
                  </span>
                </legend>
                <EquipmentPicker entries={equipment} onChange={setEquipment} focus={focusContainer} />
                {/* SE-05. A read-back of what was chosen, so the customer is not
                    scrolling the grid to remember how many of what they asked for. */}
                <SelectedStrip
                  label={t('reqEquipmentSelected', { count: equipment.length })}
                  items={equipment.map((unit) => ({
                    id: unit.unitId,
                    title: `${unit.quantity} × ${unit.containerType}`,
                    detail: unit.grossWeightPerUnitKg
                      ? t('eqKg', { kg: unit.grossWeightPerUnitKg })
                      : undefined,
                  }))}
                  select={{
                    onSelect: (id) => {
                      const unit = equipment.find((entry) => entry.unitId === id);
                      if (unit) setFocusContainer({ code: unit.containerType, at: Date.now() });
                    },
                    label: (item) => t('reqEquipmentShow', { type: item.title }),
                  }}
                  remove={{
                    onRemove: (id) =>
                      setEquipment((current) => current.filter((unit) => unit.unitId !== id)),
                    label: (item) => t('reqEquipmentRemove', { type: item.title }),
                  }}
                  empty={t('reqEquipmentEmpty')}
                />
              </fieldset>
            ) : (
            <div className={styles.lines}>
              {/* The row is wider than a phone and than the sidebar leaves here,
                  so it scrolls rather than collapsing: six columns squeezed into
                  320px is six fields nobody can read the heading of. */}
              <div className={styles.lineScroll} data-scroll="compact">
                <div className={styles.lineGrid} role="table" aria-label={t('reqCargoLines')}>
                  <div className={styles.lineHead} role="row">
                    <span role="columnheader">{t('reqPieces')}</span>
                    <span role="columnheader">{t('reqPackaging')}</span>
                    <span role="columnheader">{t('reqDimensions')}</span>
                    <span role="columnheader">{t('reqGrossEach')}</span>
                    <span role="columnheader" className={styles.numeric}>{t('reqVolume')}</span>
                    <span role="columnheader" className="noa-visually-hidden">{t('reqRemoveLine')}</span>
                  </div>

                  {lines.map((line, index) => (
                    <div key={line.key} className={styles.line} role="row">
                      {/* Each field names its own row, so a screen reader hears
                          "Pieces, line 2" rather than eighteen unnamed boxes. */}
                      <Input label={t('reqPiecesOn', { line: index + 1 })} labelHidden required placeholder={t('reqPiecesPlaceholder')} inputMode="numeric" value={line.quantity}
                        onChange={(event) => setLine(line.key, { quantity: event.target.value })} />
                      {/* Autocomplete, not ComboInput: fifteen package types is a
                          list worth showing, and a bare text box gave no sign one
                          existed - which is how the same pallet gets typed four
                          ways. It brings the search glyph, the chevron and a clear
                          control, and still accepts a type nobody has added. */}
                      <Autocomplete
                        label={t('reqPackagingOn', { line: index + 1 })} labelHidden
                placeholder={t('reqPackagingPh')}
                        value={line.packageType}
                        options={packagingOptions.map((option) => ({ value: option, label: option }))}
                        emptyHint={t('reqComboFreeText')}
                        onValueChange={(next) => setLine(line.key, { packageType: next })}
                      />
                      <div className={styles.dims}>
                        <Input label={t('reqLengthOn', { line: index + 1 })} labelHidden placeholder={t('reqCmPlaceholder')} inputMode="decimal" value={line.lengthCm}
                          onChange={(event) => setLine(line.key, { lengthCm: event.target.value })} />
                        <span aria-hidden="true">×</span>
                        <Input label={t('reqWidthOn', { line: index + 1 })} labelHidden placeholder={t('reqCmPlaceholder')} inputMode="decimal" value={line.widthCm}
                          onChange={(event) => setLine(line.key, { widthCm: event.target.value })} />
                        <span aria-hidden="true">×</span>
                        <Input label={t('reqHeightOn', { line: index + 1 })} labelHidden placeholder={t('reqCmPlaceholder')} inputMode="decimal" value={line.heightCm}
                          onChange={(event) => setLine(line.key, { heightCm: event.target.value })} />
                      </div>
                      <Input label={t('reqGrossEachOn', { line: index + 1 })} labelHidden required placeholder={t('reqKgPlaceholder')} inputMode="decimal" value={line.weightKg}
                        onChange={(event) => setLine(line.key, { weightKg: event.target.value })} />
                      {/* Calculated, so it is drawn as a figure rather than as a
                          disabled field somebody will try to type into. */}
                      <span className={styles.vol} role="cell">
                        {formatVolume(lineVolume(line))}
                      </span>
                      <button
                        type="button"
                        className={styles.lineRemove}
                        aria-label={t('reqRemoveLineOn', { line: index + 1 })}
                        disabled={lines.length === 1}
                        onClick={() => setLines((c) => c.filter((l) => l.key !== line.key))}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.lineActions}>
                <button type="button" className={styles.addLine}
                  onClick={() => setLines((c) => [...c, emptyLine()])}>
                  <Plus size={14} aria-hidden="true" /> {t('reqAddLine')}
                </button>
                <span className={styles.lineNote}>{t('reqVolumeCalculated')}</span>
              </div>

              {/* The figures a pricer reads first, so they are not a caption in
                  the corner of the card. */}
              <div className={styles.lineTotals}>
                <div>
                  <span className={styles.totalLabel}>{t('reqTotalPiecesLabel')}</span>
                  <strong className={styles.totalValue}>{pieces.toLocaleString()}</strong>
                  <span className={styles.totalNote}>{t('reqLineCount', { count: lines.length })}</span>
                </div>
                <div>
                  <span className={styles.totalLabel}>{t('reqTotalVolumeLabel')}</span>
                  <strong className={styles.totalValue}>{t('reqM3', { m3: formatVolume(totals.volume) })}</strong>
                </div>
                <div className={styles.totalLead}>
                  <span className={styles.totalLabel}>{t('reqTotalGrossLabel')}</span>
                  <strong className={styles.totalValue}>{t('reqKg', { kg: totals.weight.toLocaleString() })}</strong>
                </div>
              </div>
            </div>
            )}

            <ChipToggles
              label={t('reqSpecialHandling')}
              showLabel
              options={handlingOptions.map((value) => ({
                value,
                label: t(`reqHandling_${value}`),
              }))}
              values={handlingOptions.filter((key) => handling[key])}
              onValuesChange={(next) => {
                setHandling(
                  Object.fromEntries(handlingOptions.map((key) => [key, next.includes(key)])),
                );
                // Open with one empty piece rather than an empty panel that
                // reads as "nothing to fill in here".
                if (next.includes('outOfGauge') && oversize.length === 0) {
                  setOversize([emptyOversize()]);
                }
              }}
            />

            {handling.temperature && (
              <TemperatureControlEditor value={temperature} onChange={setTemperature} />
            )}

            {handling.outOfGauge && (
              <OversizeEditor entries={oversize} onChange={setOversize} />
            )}

            {declaringDangerousGoods && (
              <DangerousGoodsEditor
                entries={dangerousGoods}
                onChange={setDangerousGoods}
                // On a full-load request the cargo a hazard sits in is a
                // container, not a package line. Same id namespace, so the link
                // needs no second shape.
                lines={containerised
                  ? equipment.map((unit) => ({
                      key: unit.unitId,
                      label: `${unit.quantity} × ${unit.containerType}`,
                    }))
                  : lines
                      .filter((line) => num(line.quantity) !== null && num(line.weightKg) !== null)
                      .map((line, index) => ({
                        key: line.key,
                        label: `${index + 1} · ${line.quantity} ${line.packageType}`,
                      }))}
              />
            )}

            <div className={styles.grid}>
              <Input label={t('reqCargoValue')} placeholder={t('reqCargoValuePh')} inputMode="decimal" value={cargoValue}
                hint={t('reqCargoValueHint')}
                onChange={(event) => setCargoValue(event.target.value)} />
              <ComboInput
                label={t('reqCountryOfOrigin')} placeholder={t('reqCountryOfOriginPh')}
                hint={t('reqCountryOfOriginHint')}
                maxLength={80}
                value={countryOfOrigin}
                options={countryOptions}
                emptyHint={t('reqComboFreeText')}
                onChange={(event) => setCountryOfOrigin(event.target.value)}
              />
              <Select
                label={t('reqBatteries')}
                value={batteries}
                options={['none', 'with_equipment', 'in_equipment', 'alone'].map((value) => ({
                  value, label: t(`reqBatteries_${value}`),
                }))}
                onValueChange={setBatteries}
              />
            </div>
          </Card>
          </div>

          <div className={styles.step} hidden={step !== 3}>
          <Card id="card-parties" nav={cardNav(3)} number={4} done={okParties} {...cardState}
            title={t('reqStepParties')} hint={t('reqPartiesHint')}>
            {/* SP-08. Shipper and consignee are the two roles the request cannot
                be priced without, so they are drawn as cards rather than two
                more inputs in the grid. Navy marks the receiving side. */}
            <div className={styles.parties}>
              <PartyCard role={t('reqShipper')} tone="action">
                <Input
                  label={t('reqShipper')}
                  required
                  labelHidden
                  placeholder={t('reqShipperPh')}
                  maxLength={200}
                  value={shipper}
                  error={required(3, shipper.trim() === '')}
                  onChange={(event) => setShipper(event.target.value)}
                />
              </PartyCard>
              <PartyCard role={t('reqConsignee')} tone="navy">
                <Input
                  label={t('reqConsignee')}
                  required
                  labelHidden
                  placeholder={t('reqConsigneePh')}
                  maxLength={200}
                  value={consignee}
                  error={required(3, consignee.trim() === '')}
                  onChange={(event) => setConsignee(event.target.value)}
                />
              </PartyCard>
            </div>

            <div className={styles.grid}>
              <Input label={t('reqCustomerReference')} placeholder={t('reqCustomerReferencePh')} hint={t('reqCustomerReferenceHint')} maxLength={60}
                value={customerReference} onChange={(event) => setCustomerReference(event.target.value)} />
              <Input label={t('reqCostCentre')} placeholder={t('reqCostCentrePh')} maxLength={60} value={costCentre}
                onChange={(event) => setCostCentre(event.target.value)} />
              <Select
                label={t('reqCurrency')} value={currency}
                options={currencyOptions.length > 0 ? currencyOptions : [{ value: currency, label: currency }]}
                onValueChange={setCurrency}
              />
              <Select
                label={t('reqFreightPayable')} value={freightPayable}
                options={['prepaid', 'collect'].map((value) => ({ value, label: t(`reqPayable_${value}`) }))}
                onValueChange={setFreightPayable}
              />
            </div>
            <Input label={t('reqNotes')} placeholder={t('reqNotesPh')} hint={t('reqNotesHint')} maxLength={2000} value={notes}
              onChange={(event) => setNotes(event.target.value)} />
          </Card>
          </div>

          {failure && <p role="alert" className={styles.error}>{failure.message || t('accessUnavailable')}</p>}
        </div>

        <aside className={styles.side}>
          {/* The ring answers "how much is left", which four nodes on a rail do
              not: it is the figure, not a second copy of the steps. */}
          <RequestProgress steps={steps} listSteps={false} />
          <RequestSummary rows={summaryRows} chips={summaryChips} />
          <RequestStages stages={stages} />

          {/* The send button lives on the last step's foot now, where the
              customer is looking when they finish. Repeating it here would be
              two buttons for one action, disagreeing about where to press. */}
          {ready && <p className={styles.submitNote}>{t('reqSendNote')}</p>}
        </aside>
      </div>
      </div>

      {/*
        The agent, docked bottom right by the dock it shares with the pricing
        desk. Out of the column it used to share with the form: it is a helper
        you turn to, not a step you pass through, and in the rail it pushed the
        section being answered off the top of the screen.
      */}
      {aiIntakeEnabled && (
        <IntakePanel
          onDraft={applyIntakeDraft}
          onAnswer={applyIntakeAnswer}
          outstanding={steps.filter((section) => !section.done).map((section) => section.label)}
        />
      )}
    </div>
  );
}

/**
 * A visible caption over a pill group.
 *
 * FilterPills carries its label as `aria-label` only, which is right when the
 * group sits under a heading that already names it. Two groups side by side
 * have no such heading, so without this a sighted user sees four pills and no
 * clue which two are direction and which two are load type.
 */
function PillGroup({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className={styles.pillGroup}>
      {/* Hidden from assistive technology: the group is already named by the
          control's own aria-label, and naming it twice reads it twice. */}
      <span className={styles.pillCaption} aria-hidden="true">{label}</span>
      {children}
      {hint && <span className={styles.pillHint} aria-hidden="true">{hint}</span>}
    </div>
  );
}

/**
 * IN-03 · A short single choice at field height.
 *
 * Two or three options that are really one answer — import or export, how far a
 * date may move. Drawn as one control the width of a field so the row lines up
 * with the fields beside it, rather than as loose pills floating above them.
 *
 * Buttons with `aria-pressed`, not a radio group: there is always an answer,
 * and the control is the answer.
 */
function Segmented({
  label, options, value, onValueChange,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className={styles.field}>
      <span className="noa-label">{label}</span>
      <div className={styles.segmented} role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={styles.segment}
            aria-pressed={value === option.value}
            onClick={() => onValueChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Card({
  id, number, title, hint, done, doneLabel, todoLabel, lifted, nav, children,
}: {
  id: string;
  number: number;
  title: string;
  hint: string;
  /** Drives the state chip in the card's own header. */
  done: boolean;
  doneLabel: string;
  todoLabel: string;
  /** The card that rises into the hero band carries the deeper shadow. */
  lifted?: boolean;
  /** The step controls, drawn either side of the status chip. */
  nav?: {
    back?: () => void;
    backLabel: string;
    next: () => void;
    nextLabel: string;
    nextDisabled?: boolean;
  };
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={lifted ? `${styles.card} ${styles.lifted}` : styles.card}
      aria-label={title}
    >
      <header className={styles.cardHead}>
        <div className={styles.cardIdentity}>
          <span className={styles.cardNumber} aria-hidden="true">{number}</span>
          <div>
            <h2 className={styles.cardTitle}>{title}</h2>
            <p className={styles.cardHint}>{hint}</p>
          </div>
        </div>
        {/*
          The state, with the way out of the step either side of it.

          Icons rather than words: the label is a whole sentence — "Continue to
          Route and timing" — and spelling that out in a card header pushes the
          heading onto a second line. The tooltip and the accessible name carry
          it, so nothing is lost to anyone reading with a screen reader or
          hovering to check.
        */}
        <div className={styles.cardNav}>
          {nav?.back && (
            <button
              type="button"
              className={styles.cardStep}
              aria-label={nav.backLabel}
              title={nav.backLabel}
              onClick={nav.back}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
          )}

          <span className={styles.cardState} data-done={done ? 'true' : 'false'}>
            {done ? doneLabel : todoLabel}
          </span>

          {nav && (
            <button
              type="button"
              className={styles.cardStep}
              data-lead="true"
              aria-label={nav.nextLabel}
              title={nav.nextLabel}
              disabled={nav.nextDisabled}
              onClick={nav.next}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>
      <div className={styles.cardBody}>{children}</div>
    </section>
  );
}
