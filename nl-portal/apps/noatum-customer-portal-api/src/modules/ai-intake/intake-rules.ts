/**
 * The deterministic half of the intake assistant.
 *
 * The model reads the document and reports what it says. Everything in this file
 * is a rule we own, applied afterwards, so the draft can be explained: "the
 * invoice says 19.2 CBM, and 15 to 28 CBM is a twenty-foot container" is
 * checkable, where "the model chose 20GP" is not.
 *
 * Pure functions, no I/O. Demo scope.
 */

import { INCOTERM_SCOPE } from './shared/incoterm-scope';

/** One indicative container type, as the container_type lookup describes it. */
export interface ContainerOption {
  code: string;
  label: string;
  capacityM3?: number;
  maxPayloadKg?: number;
  group?: string;
}

export interface EquipmentProposal {
  containerType: string;
  quantity: number;
  /** Shown to the customer, so the choice is never unexplained. */
  rule: string;
}

export interface IntakeQuestion {
  id: string;
  /** The form field an answer belongs to, so the panel can drop it straight in. */
  field: string;
  ask: string;
}

/**
 * Volume bands for a full container.
 *
 * Indicative only: they ignore stackability, density and pallet footprint, so the
 * proposal is always overridable and the panel says so. Confirm with operations
 * before anyone treats these as the house rule.
 */
const LCL_CEILING_M3 = 15;

export interface EquipmentRuleInput {
  volumeM3?: number | null;
  grossWeightKg?: number | null;
  containers: readonly ContainerOption[];
  /** A container type the document named outright, e.g. "20ft FCL". */
  statedContainerCode?: string | null;
  reefer?: boolean;
}

export interface EquipmentRuleResult {
  loadType: 'FCL' | 'LCL' | null;
  equipment: EquipmentProposal[];
  questions: IntakeQuestion[];
}

/**
 * Turns a volume and a weight into a load type and, where it is a full load, the
 * containers to ask for.
 *
 * Chooses from the container_type lookup by its recorded capacity rather than
 * from hard-coded codes, so a branch that adds a 45ft reefer gets it for free.
 */
export function proposeEquipment(input: EquipmentRuleInput): EquipmentRuleResult {
  const { volumeM3, grossWeightKg, containers, statedContainerCode, reefer } = input;
  const questions: IntakeQuestion[] = [];

  const usable = containers.filter((c) => typeof c.capacityM3 === 'number' && c.capacityM3 > 0);

  /*
   * Only ordinary boxes are ever inferred from a volume.
   *
   * Tanks, open tops and flat racks are smaller or larger than a dry box of the
   * same nominal size, so sorting by capacity alone puts a 24 m3 tank ahead of a
   * 33 m3 general purpose - which is how a pallet of silicon wafers gets offered
   * a tank. Special equipment is a deliberate answer to the out-of-gauge or
   * special handling questions, never a guess from cubic metres.
   */
  const inGroup = (c: ContainerOption, group: string) => c.group === group;
  const pool = reefer
    ? usable.filter((c) => inGroup(c, 'reefer'))
    : usable.filter((c) => inGroup(c, 'dry'));

  // A lookup with no groups recorded should still produce something.
  const candidates = (pool.length > 0 ? pool : usable)
    .slice()
    .sort((a, b) => (a.capacityM3 ?? 0) - (b.capacityM3 ?? 0));

  // The document named a container outright, which beats anything we infer.
  if (statedContainerCode) {
    const stated = containers.find(
      (c) => c.code.toLowerCase() === statedContainerCode.toLowerCase(),
    );
    if (stated) {
      return {
        loadType: 'FCL',
        equipment: [
          { containerType: stated.code, quantity: 1, rule: `The document asks for ${stated.label}.` },
        ],
        questions,
      };
    }
  }

  if (typeof volumeM3 !== 'number' || volumeM3 <= 0) {
    questions.push({
      id: 'volume',
      field: 'volumeM3',
      ask: 'How much space does the cargo take up, in cubic metres? It decides whether this is a full or a shared container.',
    });
    return { loadType: null, equipment: [], questions };
  }

  if (volumeM3 < LCL_CEILING_M3) {
    return {
      loadType: 'LCL',
      equipment: [],
      questions,
    };
  }

  if (candidates.length === 0) {
    return { loadType: 'FCL', equipment: [], questions };
  }

  // The smallest container that holds the volume, allowing for the fact that a
  // box is never loaded to its geometric capacity.
  const USABLE_FRACTION = 0.85;
  const fits = candidates.find((c) => (c.capacityM3 ?? 0) * USABLE_FRACTION >= volumeM3);
  const largest = candidates[candidates.length - 1]!;

  if (!fits) {
    const quantity = Math.ceil(volumeM3 / ((largest.capacityM3 ?? 1) * USABLE_FRACTION));
    questions.push({
      id: 'equipment-split',
      field: 'equipment',
      ask: `This volume needs about ${quantity} containers. Is that how you would like it split?`,
    });
    return {
      loadType: 'FCL',
      equipment: [
        {
          containerType: largest.code,
          quantity,
          rule: `${volumeM3} m³ does not fit one container, so ${quantity} × ${largest.label} is proposed.`,
        },
      ],
      questions,
    };
  }

  // Volume fits, but the plate may not take the weight.
  const overPayload =
    typeof grossWeightKg === 'number'
    && typeof fits.maxPayloadKg === 'number'
    && grossWeightKg > fits.maxPayloadKg;

  if (overPayload) {
    const heavier = candidates.find(
      (c) => (c.maxPayloadKg ?? 0) >= (grossWeightKg ?? 0) && c.code !== fits.code,
    );

    if (heavier) {
      return {
        loadType: 'FCL',
        equipment: [
          {
            containerType: heavier.code,
            quantity: 1,
            rule: `${volumeM3} m³ fits a ${fits.label}, but ${grossWeightKg?.toLocaleString()} kg is over its usual payload, so ${heavier.label} is proposed.`,
          },
        ],
        questions,
      };
    }

    questions.push({
      id: 'payload',
      field: 'equipment',
      ask: `The cargo weighs ${grossWeightKg?.toLocaleString()} kg, which is above the usual payload for this container. Should we split it across more than one?`,
    });
  }

  return {
    loadType: 'FCL',
    equipment: [
      {
        containerType: fits.code,
        quantity: 1,
        rule: `${volumeM3} m³ fits one ${fits.label}.`,
      },
    ],
    questions,
  };
}

/**
 * What an Incoterm implies for the service scope, and therefore which addresses
 * we still need. The table itself is shared with the pricing side, which uses the
 * same ends to decide which legs a quote must carry charges for.
 */
export interface ScopeRuleResult {
  scope: string | null;
  rule: string | null;
  questions: IntakeQuestion[];
}

export function proposeScope(
  incoterm: string | null | undefined,
  hasPickupAddress: boolean,
  hasDeliveryAddress: boolean,
): ScopeRuleResult {
  const questions: IntakeQuestion[] = [];
  const term = incoterm?.toUpperCase();

  if (!term || !(term in INCOTERM_SCOPE)) {
    questions.push({
      id: 'incoterm',
      field: 'incoterm',
      ask: 'Which Incoterm applies? It decides where our responsibility starts and ends.',
    });
    return { scope: null, rule: null, questions };
  }

  const ends = INCOTERM_SCOPE[term]!;
  const scope = `${ends.origin === 'door' ? 'door' : 'port'}_${ends.destination === 'door' ? 'door' : 'port'}`;

  if (ends.origin === 'door' && !hasPickupAddress) {
    questions.push({
      id: 'pickup-address',
      field: 'pickupAddress',
      ask: `${term} means we collect from the seller's premises. What is the full pickup address?`,
    });
  }

  if (ends.destination === 'door' && !hasDeliveryAddress) {
    questions.push({
      id: 'delivery-address',
      field: 'deliveryAddress',
      ask: `${term} means we deliver to the final destination. What is the full delivery address?`,
    });
  }

  return {
    scope,
    rule:
      ends.origin === 'port'
        ? `${term} is a port term at origin, so we collect at the port of loading rather than the seller's premises.`
        : `${term} means we collect at the seller's premises.`,
    questions,
  };
}

/**
 * Air or sea, from what the document is rather than what we hope it is.
 *
 * The model reports the mode it read; this only sanitises that answer and falls
 * back to the words on the page. Sea is the last resort because it is the common
 * case, and the customer can change the card in one click either way.
 */
export function detectMode(freeText: string, stated: string | null | undefined): string {
  const said = stated?.trim().toLowerCase();
  if (said === 'air' || said === 'sea' || said === 'road') return said;

  if (/\bair\s?waybill\b|\bawb\b|\bflight\b|\bairport\b|\bby air\b/i.test(freeText)) return 'air';
  if (/\bbill of lading\b|\bb\/l\b|\bvessel\b|\bcontainer\b|\bfcl\b|\blcl\b|\bby sea\b/i.test(freeText)) {
    return 'sea';
  }

  return 'sea';
}

/** Words that mean "ask about dangerous goods", never "classify as". */
const HAZARD_HINTS = [
  'lithium',
  'battery',
  'batteries',
  'aerosol',
  'flammable',
  'corrosive',
  'explosive',
  'hazmat',
  'dangerous goods',
  'toxic',
];

export interface HazardRuleResult {
  dangerousGoods: boolean;
  unNumber: string | null;
  hazardClass: string | null;
  properShippingName: string | null;
  packingGroup: string | null;
  technicalName: string | null;
  flashpointCelsius: number | null;
  packagingType: string | null;
  packageCount: number | null;
  netQuantityPerPackage: number | null;
  quantityUnit: string | null;
  questions: IntakeQuestion[];
}

/** Stated dangerous goods detail, straight from the declaration. */
export interface StatedHazard {
  unNumber?: string | null;
  hazardClass?: string | null;
  properShippingName?: string | null;
  packingGroup?: string | null;
  technicalName?: string | null;
  flashpointCelsius?: number | null;
  packagingType?: string | null;
  packageCount?: number | null;
  netQuantityPerPackage?: number | null;
  quantityUnit?: string | null;
}

/**
 * A stated UN number or class is taken; a keyword only raises the flag.
 *
 * Guessing a class from the word "battery" is the shape of a misdeclaration, and
 * the portal never makes a dangerous goods declaration — it captures data for
 * pricing and the shipper certifies the rest.
 */
export function detectHazard(
  freeText: string,
  stated: StatedHazard,
  knownClasses: readonly string[],
): HazardRuleResult {
  const questions: IntakeQuestion[] = [];
  const text = freeText.toLowerCase();

  const unMatch = stated.unNumber?.match(/\d{4}/)?.[0]
    ?? freeText.match(/\bUN\s?(\d{4})\b/i)?.[1]
    ?? null;

  const statedClass = stated.hazardClass?.match(/\d(?:\.\d)?/)?.[0] ?? null;
  const hazardClass = statedClass && knownClasses.includes(statedClass) ? statedClass : null;

  const hinted = HAZARD_HINTS.some((word) => text.includes(word));
  const dangerousGoods = Boolean(unMatch || hazardClass || hinted);

  const clean = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };

  // Only I, II or III mean anything to the form; anything else is not a group.
  const group = clean(stated.packingGroup)?.toUpperCase().replace(/[^IV]/g, '') ?? null;
  const packingGroup = group === 'I' || group === 'II' || group === 'III' ? group : null;

  const properShippingName = clean(stated.properShippingName);
  const packagingType = clean(stated.packagingType);
  const quantityUnit = clean(stated.quantityUnit)?.toUpperCase() ?? null;

  const result: HazardRuleResult = {
    dangerousGoods,
    unNumber: unMatch,
    hazardClass,
    properShippingName,
    packingGroup,
    technicalName: clean(stated.technicalName),
    flashpointCelsius: typeof stated.flashpointCelsius === 'number' ? stated.flashpointCelsius : null,
    packagingType,
    packageCount: typeof stated.packageCount === 'number' ? stated.packageCount : null,
    netQuantityPerPackage:
      typeof stated.netQuantityPerPackage === 'number' ? stated.netQuantityPerPackage : null,
    quantityUnit,
    questions,
  };

  if (!dangerousGoods) return result;

  /*
   * The order matters: these are asked one at a time, and a declaration is
   * refused without any of them. None is ever guessed on the customer's behalf.
   */
  if (!hazardClass) {
    questions.push({
      id: 'hazard-class',
      field: 'hazardClass',
      ask: 'This looks like it may be dangerous goods. Which hazard class applies?',
    });
  }

  if (!unMatch) {
    questions.push({ id: 'un-number', field: 'unNumber', ask: 'What is the UN number for this cargo?' });
  }

  if (!properShippingName) {
    questions.push({
      id: 'shipping-name',
      field: 'properShippingName',
      ask: 'What is the proper shipping name, exactly as it appears on the declaration?',
    });
  }

  if (!packingGroup) {
    questions.push({
      id: 'packing-group',
      field: 'packingGroup',
      ask: 'Which packing group applies — I, II or III?',
    });
  }

  if (!packagingType) {
    questions.push({
      id: 'dg-packaging',
      field: 'dgPackagingType',
      ask: 'How is it packed? For example drums, jerricans or fibreboard boxes.',
    });
  }

  if (result.packageCount === null) {
    questions.push({
      id: 'dg-package-count',
      field: 'dgPackageCount',
      ask: 'How many packages of the dangerous goods are there?',
    });
  }

  if (result.netQuantityPerPackage === null) {
    questions.push({
      id: 'dg-net-quantity',
      field: 'netQuantityPerPackage',
      ask: 'What is the net quantity in each package?',
    });
  }

  if (!quantityUnit) {
    questions.push({
      id: 'dg-unit',
      field: 'quantityUnit',
      ask: 'What unit is that net quantity in — for example L or KG?',
    });
  }

  return result;
}

/** Temperature control asked for in words, with no set point given, is an unanswered flag. */
export function detectTemperature(freeText: string, setPoint: number | null | undefined) {
  const wants = /reefer|refrigerat|temperature[- ]controll|chilled|frozen|cold chain|temperature monitoring/i
    .test(freeText);

  const questions: IntakeQuestion[] = [];
  if (wants && (setPoint === null || setPoint === undefined)) {
    questions.push({
      id: 'set-point',
      field: 'temperatureSetPoint',
      ask: 'This cargo needs temperature control. What set point in Celsius should we carry it at?',
    });
  }

  return { temperature: wants, questions };
}

/**
 * The questions every intake asks when the document simply does not carry the
 * answer. A commercial invoice has no cargo ready date and no delivery postcode,
 * so these are the normal case rather than a failure.
 */
export function missingEssentials(draft: {
  originCode?: string | null;
  destinationCode?: string | null;
  readyDate?: string | null;
  commodity?: string | null;
}): IntakeQuestion[] {
  const questions: IntakeQuestion[] = [];

  if (!draft.originCode) {
    questions.push({
      id: 'origin',
      field: 'originCode',
      ask: 'Where does the cargo ship from? A port or city name is enough.',
    });
  }

  if (!draft.destinationCode) {
    questions.push({
      id: 'destination',
      field: 'destinationCode',
      ask: 'Where should it go?',
    });
  }

  // Deliberately never taken from the invoice date: they are different things.
  if (!draft.readyDate) {
    questions.push({
      id: 'ready-date',
      field: 'readyDate',
      ask: 'When will the cargo be ready to collect?',
    });
  }

  if (!draft.commodity) {
    questions.push({
      id: 'commodity',
      field: 'commodity',
      ask: 'What are we shipping?',
    });
  }

  return questions;
}
