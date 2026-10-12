/**
 * The deterministic half of the pricing assistant.
 *
 * Same bargain as the intake side: the model reads what a carrier wrote, and
 * everything that decides WHICH charges a quote needs is a rule we own, applied
 * afterwards. "FOB starts at the port, so there is no pre-carriage line" is a
 * sentence a pricer can check; "the model thought so" is not.
 *
 * Nothing here produces a rate. Not one function returns money.
 *
 * Pure functions, no I/O. Demo scope.
 */

import { scopeOf } from '../shared/incoterm-scope';

/** One charge code as the `charge_code` lookup describes it. */
export interface ChargeCodeOption {
  code: string;
  label: string;
}

/** A scaffolded line: what to charge for, with the amount left to the pricer. */
export interface ScaffoldLine {
  code: string;
  description: string;
  /** One of CHARGE_BASES. A suggestion, and the editor still allows any. */
  basis: string;
  /** Blank unless `fillIndicative` put a demonstration figure here. */
  rate: string;
  quantity: string;
  /** Shown beside the line so the choice is never unexplained. */
  reason: string;
  /** True where the rate is a demonstration figure, not a quoted one. */
  indicative?: boolean;
}

export interface ScaffoldInput {
  mode: string;
  loadType: string | null;
  incoterm: string | null;
  /** Total containers across the request. A per-container charge multiplies by it. */
  containerCount: number;
  hasDangerousGoods: boolean;
  hasTemperatureControl: boolean;
  hasOversize: boolean;
  chargeCodes: readonly ChargeCodeOption[];
  /** What the customer asked for in their own words, where they said so. */
  requestedFreeTimeDays?: number | null;
}

/** Per container where there are containers, otherwise once for the shipment. */
const perUnit = (containerCount: number): { basis: string; quantity: string } =>
  containerCount > 0
    ? { basis: 'Per container', quantity: String(containerCount) }
    : { basis: 'Per shipment', quantity: '1' };

/**
 * The charge lines this lane needs, with every rate blank.
 *
 * Codes are matched against the lookup, so a code that is not configured is
 * silently left out rather than invented into the editor - the same protection
 * the intake side gives container types.
 */
export function scaffoldCharges(input: ScaffoldInput): ScaffoldLine[] {
  const known = new Map(
    input.chargeCodes.map((entry) => [entry.code.trim().toUpperCase(), entry]),
  );
  const lines: ScaffoldLine[] = [];
  const unit = perUnit(input.containerCount);

  const add = (code: string, reason: string, basis?: string, quantity?: string) => {
    const entry = known.get(code);
    if (!entry || lines.some((line) => line.code === entry.code)) return;
    lines.push({
      code: entry.code,
      description: entry.label,
      basis: basis ?? unit.basis,
      quantity: quantity ?? unit.quantity,
      rate: '',
      reason,
    });
  };

  const air = input.mode === 'air';
  const scope = scopeOf(input.incoterm);

  // Air freight is sold on chargeable weight, sea on the box. Same line, and the
  // basis is what makes the rate the pricer types mean the right thing.
  if (air) {
    add('FRT', 'Air freight is the main charge.', 'Per chargeable kg', '1');
  } else {
    add('FRT', 'Ocean freight is the main charge.');
    add('BAF', 'Sea freight is normally quoted with a bunker adjustment.');
  }

  /*
   * Origin handling belongs to us on every term except EXW, where we start at the
   * seller's premises and so also collect. A door term at origin adds the
   * pre-carriage leg; a port term does not, which is the whole point of the rule.
   */
  add('THC', air ? 'Airport handling at origin.' : 'Terminal handling at the port of loading.');
  add('DOC', 'Documentation and the bill of lading.', 'Per shipment', '1');

  if (!air) {
    add('ISPS', 'Port security applies at the loading terminal.', 'Per shipment', '1');
  }

  if (scope?.origin === 'door') {
    add('PCF', `${input.incoterm} starts at the seller's premises, so we collect and carry to the port.`);
  }

  if (scope?.destination === 'door') {
    add('DLV', `${input.incoterm} ends at the final destination, so delivery is ours.`);
    add('CUS', `${input.incoterm} makes the import entry ours.`, 'Per shipment', '1');
  }

  if (input.hasDangerousGoods) {
    add('DGS', 'Dangerous goods were declared on the request.');
  }

  if (input.hasTemperatureControl) {
    add('REF', 'The request asks for temperature control.');
  }

  if (input.hasOversize) {
    add('OOG', 'The request carries out-of-gauge pieces.');
  }

  return lines;
}

/*
 * ---------------------------------------------------------------------------
 * DEMONSTRATION FIGURES ONLY.
 *
 * There is no rate source in this organisation (v4 rule 1), so these are not a
 * price and must never be treated as one. They exist so a demo can show a filled
 * option without a pricer typing twelve numbers on stage. Every one of them is
 * labelled "indicative" on the way out, and the pricer overwrites them.
 *
 * Delete this block and `fillIndicative` the day a real rate source arrives.
 * ---------------------------------------------------------------------------
 */
const INDICATIVE_RATES: Record<string, { sea: number; air: number }> = {
  FRT: { sea: 1450, air: 3.85 },
  BAF: { sea: 180, air: 0.35 },
  CAF: { sea: 60, air: 0.1 },
  THC: { sea: 165, air: 95 },
  DOC: { sea: 55, air: 45 },
  ISPS: { sea: 25, air: 18 },
  PCF: { sea: 320, air: 210 },
  DLV: { sea: 380, air: 240 },
  CUS: { sea: 90, air: 90 },
  DGS: { sea: 185, air: 260 },
  REF: { sea: 240, air: 310 },
  OOG: { sea: 450, air: 520 },
};

/** Indicative transit band by mode. Not a schedule: there is no schedule source. */
const INDICATIVE_TRANSIT: Record<string, { min: number; max: number }> = {
  sea: { min: 28, max: 34 },
  air: { min: 2, max: 4 },
  road: { min: 3, max: 6 },
  rail: { min: 16, max: 22 },
};

/**
 * Fills an option with plausible figures so a demo has something to look at.
 *
 * `carrier` comes from the carrier lookup filtered to this mode, so that part is
 * real data. The numbers are not.
 */
export function fillIndicative(
  option: ScaffoldOption,
  mode: string,
  carrier: string | null,
): ScaffoldOption {
  const air = mode === 'air';
  const band = INDICATIVE_TRANSIT[mode] ?? INDICATIVE_TRANSIT.sea!;

  // A faster shape costs more and takes less time, which is the whole reason a
  // customer is being offered a choice.
  const express = /express/i.test(option.name);
  const economy = /economy/i.test(option.name);
  const factor = express ? 1.22 : economy ? 0.88 : 1;
  const shift = express ? -6 : economy ? 5 : 0;

  return {
    ...option,
    carrierName: option.carrierName || carrier || '',
    serviceRouting: option.serviceRouting || (express ? 'Direct' : 'Via hub'),
    transitDaysMin: option.transitDaysMin || String(Math.max(1, band.min + shift)),
    transitDaysMax: option.transitDaysMax || String(Math.max(2, band.max + shift)),
    lines: option.lines.map((line) => {
      const base = INDICATIVE_RATES[line.code]?.[air ? 'air' : 'sea'];
      if (base === undefined) return line;
      const rate = air ? Math.round(base * factor * 100) / 100 : Math.round(base * factor);
      return { ...line, rate: String(rate), indicative: true };
    }),
  };
}

/** What a scaffolded option looks like before a pricer touches it. */
export interface ScaffoldOption {
  name: string;
  carrierName: string;
  serviceRouting: string;
  transitDaysMin: string;
  transitDaysMax: string;
  freeTimeDays: string;
  notes: string;
  lines: ScaffoldLine[];
}

/**
 * The shapes a customer is usually choosing between, in the order a pricer
 * reaches for them: the usual service first, then a faster one, then a cheaper
 * one.
 *
 * Names only. They carry no rate, no carrier and no transit, because none of
 * those are ours to assume - they are the questions the panel then asks.
 */
const SHAPES = [
  { name: 'Standard', note: 'The usual service on this lane.' },
  { name: 'Express', note: 'Fastest available, premium.' },
  { name: 'Economy', note: 'Slower routing, lowest cost.' },
] as const;

/** How many shapes the assistant knows, so a caller can stop offering more. */
export const MAX_SHAPES = SHAPES.length;

/**
 * Builds options one at a time.
 *
 * `from` is how many the assistant has already built, so the second one is
 * "Express" and not a second "Standard". Asking for more than the shapes we have
 * simply stops.
 */
export function scaffoldOptions(
  input: ScaffoldInput,
  count: number,
  from = 0,
): ScaffoldOption[] {
  const lines = scaffoldCharges(input);
  const first = Math.min(Math.max(from, 0), SHAPES.length);
  const wanted = Math.min(Math.max(count, 1), SHAPES.length - first);
  // Proposed, not decided: the pricer may not be able to hold it, and can clear it.
  const freeTime = input.requestedFreeTimeDays;

  return SHAPES.slice(first, first + wanted).map((shape) => ({
    name: shape.name,
    carrierName: '',
    serviceRouting: '',
    transitDaysMin: '',
    transitDaysMax: '',
    freeTimeDays: freeTime === null || freeTime === undefined ? '' : String(freeTime),
    notes: shape.note,
    lines: lines.map((line) => ({ ...line })),
  }));
}

/** A question the panel asks, answered straight into the option it names. */
export interface PricingQuestion {
  id: string;
  /** The option this belongs to, by index. -1 where it is about the quote. */
  optionIndex: number;
  field: string;
  ask: string;
}

/** Only what an outstanding check needs, so a scaffold and a read offer both fit. */
export interface OutstandingOption {
  name: string;
  carrierName: string;
  transitDaysMin: string;
  transitDaysMax: string;
  freeTimeDays: string;
}

/**
 * What the editor still needs before the send checks can go green.
 *
 * Deliberately the same list `useChecks` enforces on screen, asked one at a time
 * instead of shown all at once - so the assistant never says it is finished while
 * the panel beside it is still red.
 */
export function outstandingFor(options: readonly OutstandingOption[]): PricingQuestion[] {
  const questions: PricingQuestion[] = [];
  const many = options.length > 1;

  options.forEach((option, index) => {
    const which = many ? `${option.name || `option ${index + 1}`}: ` : '';

    if (option.carrierName.trim() === '') {
      questions.push({
        id: `carrier-${index}`,
        optionIndex: index,
        field: 'carrierName',
        ask: `${which}which carrier is this?`,
      });
    }

    if (option.transitDaysMin === '' && option.transitDaysMax === '') {
      questions.push({
        id: `transit-${index}`,
        optionIndex: index,
        field: 'transitDaysMin',
        ask: `${which}how many days in transit? A range is fine.`,
      });
    }

    if (option.freeTimeDays === '') {
      questions.push({
        id: `freetime-${index}`,
        optionIndex: index,
        field: 'freeTimeDays',
        ask: `${which}how many free days at destination?`,
      });
    }
  });

  return questions;
}

/** Two digits in a row, as "28-32 days" or "about 30". */
export function parseTransit(answer: string): { min: string; max: string } | null {
  const range = /(\d{1,3})\s*(?:-|–|to)\s*(\d{1,3})/.exec(answer);
  if (range) return { min: range[1]!, max: range[2]! };

  const single = /(\d{1,3})/.exec(answer);
  return single ? { min: single[1]!, max: single[1]! } : null;
}

/*
 * How a customer writes a free-time request, in either language. Asking for a
 * figure the customer already put in their own request is the fastest way to
 * look like the assistant has not read it.
 */
const FREE_TIME_PATTERNS = [
  /free\s*time\s*(?:of\s*)?(\d{1,3})\s*days?/,
  /(\d{1,3})\s*free\s*days?/,
  /(\d{1,3})\s*days?\s*(?:of\s*)?free\s*time/,
  /tiempo\s*libre\s*(?:de\s*)?(\d{1,3})\s*d[ií]as?/,
  /(\d{1,3})\s*d[ií]as?\s*(?:libres?|de\s*tiempo\s*libre)/,
];

/** The free time the customer asked for in their own words, if they did. */
export function requestedFreeTime(notes: string | null | undefined): number | null {
  if (!notes) return null;
  const text = notes.toLowerCase();

  for (const pattern of FREE_TIME_PATTERNS) {
    const days = Number(pattern.exec(text)?.[1]);
    if (Number.isInteger(days) && days >= 0 && days <= 365) return days;
  }

  return null;
}

/*
 * Words that carry no meaning when matching a charge description, so "Terminal
 * handling at origin" and "Terminal handling" are the same charge.
 */
const NOISE = new Set([
  'and', 'or', 'the', 'of', 'to', 'at', 'for', 'per', 'a', 'an', 'in', 'on',
  'origin', 'destination', 'charge', 'charges', 'fee', 'fees', 'surcharge',
  'y', 'o', 'de', 'del', 'la', 'el', 'los', 'las', 'en', 'por',
]);

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9áéíóúñü]+/i)
    .filter((word) => word.length > 1 && !NOISE.has(word));

/**
 * The lookup code a carrier's wording means, or nothing.
 *
 * Scored against the lookup's OWN labels rather than a table of codes in this
 * file, so a branch that adds a charge code gets it matched for free and a
 * translated label matches a translated reply. A tie leaves the code blank: the
 * pricer picks from the list, which is a better outcome than a confident guess
 * putting freight money against a customs line.
 */
export function matchChargeCode(
  description: string | null,
  codes: readonly ChargeCodeOption[],
): string {
  const wanted = words(description ?? '');
  if (wanted.length === 0) return '';

  let best = { code: '', score: 0 };
  let runnerUp = 0;

  for (const entry of codes) {
    const label = new Set(words(entry.label));
    const score = wanted.reduce((sum, word) => sum + (label.has(word) ? 1 : 0), 0);

    if (score > best.score) {
      runnerUp = best.score;
      best = { code: entry.code, score };
    } else if (score > runnerUp) {
      runnerUp = score;
    }
  }

  return best.score > 0 && best.score > runnerUp ? best.code : '';
}
