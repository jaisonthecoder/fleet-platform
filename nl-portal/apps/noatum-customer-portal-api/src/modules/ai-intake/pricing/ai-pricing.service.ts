import { Injectable } from '@nestjs/common';

import { ReferenceService } from '../../reference/reference.service';
import { GeminiClient, type ModelPart } from '../shared/gemini.client';

import type { AssistInput, PricingAssistDto } from './ai-pricing.dto';
import { MESSAGE_PROMPT, REPLY_PROMPT, coerceReply, type ObservedOffer } from './pricing.prompt';
import {
  fillIndicative,
  matchChargeCode,
  outstandingFor,
  requestedFreeTime,
  scaffoldOptions,
  type ChargeCodeOption,
  type ScaffoldOption,
} from './pricing-rules';

/**
 * An option as it goes to the panel.
 *
 * Separate from `ScaffoldOption` because a scaffolded line guarantees a blank
 * rate, while a line read from a carrier's reply carries the figure the carrier
 * wrote. Keeping them apart is what stops a scaffold ever acquiring a number.
 */
interface ProposedLine {
  code: string;
  description: string;
  basis: string;
  quantity: string;
  rate: string;
  currency: string;
  reason: string;
  indicative: boolean;
}

interface ProposedOption {
  name: string;
  carrierName: string;
  serviceRouting: string;
  transitDaysMin: string;
  transitDaysMax: string;
  nextDepartures: string;
  freeTimeDays: string;
  validUntil: string;
  currency: string;
  notes: string;
  lines: ProposedLine[];
}

/**
 * What the assistant is allowed to know about a quote.
 *
 * Deliberately narrow, and deliberately built by the caller rather than read from
 * the database here: **no cost figure appears in this type**, so no cost can
 * reach a prompt whatever the branch's `costCapture` setting says. The cost split
 * exists because row-level security cannot hide a column; re-joining them at the
 * prompt boundary would undo it.
 */
export interface AssistQuote {
  reference: string;
  mode: string;
  loadType: string | null;
  originCode: string;
  destinationCode: string;
  originName: string | null;
  destinationName: string | null;
  incoterm: string | null;
  readyDate: string | null;
  currency: string;
  customerName: string | null;
  grossWeightKg: number | null;
  volumeM3: number | null;
  chargeableKg: number | null;
  containerCount: number;
  equipmentSummary: string;
  hasDangerousGoods: boolean;
  dangerousGoodsSummary: string;
  hasTemperatureControl: boolean;
  temperatureSummary: string;
  hasOversize: boolean;
  notes: string | null;
  defaultValidityDays: number;
  /** Carriers from the lookup, already filtered to this quote's mode. */
  carrierOptions: string[];
}

@Injectable()
export class AiPricingService {
  constructor(
    private readonly gemini: GeminiClient,
    private readonly reference: ReferenceService,
  ) {}

  isConfigured(): boolean {
    return this.gemini.isConfigured();
  }

  async assist(
    quote: AssistQuote,
    input: AssistInput,
    locale?: string,
  ): Promise<PricingAssistDto> {
    const provenance = {
      source: 'ai' as const,
      provider: 'google-gemini',
      model: this.gemini.configuredModel(),
      generatedAt: new Date().toISOString(),
    };

    switch (input.want) {
      case 'brief':
        return {
          status: 'ready', provenance, say: brief(quote), derived: [],
          options: [], questions: [], target: 'current', indicative: false,
        };
      case 'scaffold':
        return this.scaffold(quote, input, provenance, locale);
      case 'reply':
        return this.readReply(quote, input, provenance, locale);
      case 'message':
        return this.draftMessage(quote, input, provenance);
    }
  }

  /** No model at all: the lane and the Incoterm decide, and both are ours. */
  private async scaffold(
    quote: AssistQuote,
    input: AssistInput,
    provenance: Record<string, unknown>,
    locale?: string,
  ): Promise<PricingAssistDto> {
    const existing = input.existing ?? 0;
    const addingNew = input.target === 'new';
    const chargeCodes = await this.chargeCodes(locale);
    const requestedFreeTimeDays = requestedFreeTime(quote.notes);

    const built = scaffoldOptions(
      {
        mode: quote.mode,
        loadType: quote.loadType,
        incoterm: quote.incoterm,
        containerCount: quote.containerCount,
        hasDangerousGoods: quote.hasDangerousGoods,
        hasTemperatureControl: quote.hasTemperatureControl,
        hasOversize: quote.hasOversize,
        chargeCodes,
        requestedFreeTimeDays,
      },
      input.count ?? 1,
      addingNew ? existing : 0,
    );

    /*
     * A different carrier per option, so a demo does not show the same name three
     * times. Real data - the carrier lookup filtered to this mode - even though
     * the figures beside it are not.
     */
    const options = input.fill
      ? built.map((option, index) =>
          fillIndicative(option, quote.mode, quote.carrierOptions[(existing + index) % Math.max(quote.carrierOptions.length, 1)] ?? null),
        )
      : built;

    // The reasons are worth saying once, not again on every option.
    const first = existing === 0 || !addingNew;
    const derived = first
      ? [
          ...(options[0]?.lines ?? []).map((line) => ({ rule: line.code, text: line.reason })),
          ...(requestedFreeTimeDays === null
            ? []
            : [{
                rule: 'freetime',
                text: `The customer asked for ${requestedFreeTimeDays} free days, so I have put that in. Change it if we cannot hold it.`,
              }]),
          ...(input.fill
            ? [{
                rule: 'indicative',
                text: 'The rates are indicative figures to get you started. Replace them with the real ones before you send.',
              }]
            : []),
        ]
      : [];

    const name = options[0]?.name ?? '';

    return {
      status: 'ready',
      provenance: { ...provenance, source: input.fill ? 'sample' : 'rules' },
      say: [this.scaffoldSay(addingNew, name, Boolean(input.fill))],
      derived,
      options: options.map((option) => this.fromScaffold(option, quote)),
      questions: outstandingFor(options),
      target: addingNew ? 'new' : 'current',
      indicative: Boolean(input.fill),
    };
  }

  private scaffoldSay(addingNew: boolean, name: string, filled: boolean): string {
    if (addingNew) {
      return filled
        ? `Here is a new ${name} option, filled in the same way. Check every figure.`
        : `Here is the ${name} option, with the same charges. Every rate is blank.`;
    }
    return filled
      ? `I have filled this option in: the charges this lane needs, a carrier, a transit band and indicative rates. Check every figure before you send.`
      : `I have set up this option with the charges this lane needs. Every rate is blank - those are yours.`;
  }

  /** The model reads the carrier's words; the codes are matched to our lookup. */
  private async readReply(
    quote: AssistQuote,
    input: AssistInput,
    provenance: Record<string, unknown>,
    locale?: string,
  ): Promise<PricingAssistDto> {
    const parts: ModelPart[] = [{ text: REPLY_PROMPT }];

    if (input.file) {
      parts.push({
        inline_data: { mime_type: input.file.mimeType, data: input.file.dataBase64 },
      });
    }
    if (input.text) {
      parts.push({ text: `Carrier reply:\n${input.text}` });
    }

    const result = await this.gemini.json(parts, 'Pricing reply');

    if (result.status !== 'ok') {
      return {
        status: result.status === 'not-configured' ? 'not-configured' : 'unreadable',
        detail: result.detail,
        provenance,
        say: [],
        derived: [],
        options: [],
        questions: [],
        target: 'new',
        indicative: false,
      };
    }

    const chargeCodes = await this.chargeCodes(locale);
    const reply = coerceReply(result.json);

    if (reply.offers.length === 0) {
      return {
        status: 'unreadable',
        provenance: { ...provenance, model: result.model ?? provenance.model },
        say: [],
        derived: [],
        options: [],
        questions: [],
        target: 'new',
        indicative: false,
      };
    }

    const options = reply.offers.map((offer) => this.fromOffer(offer, quote, chargeCodes));

    return {
      status: 'ready',
      provenance: { ...provenance, model: result.model ?? provenance.model },
      say: [summarise(reply.offers)],
      derived: reply.offers.flatMap((offer, index) => describe(offer, index, reply.offers.length)),
      options,
      questions: outstandingFor(options),
      // A carrier's reply is a new offer, never a rewrite of what the pricer typed.
      target: 'new',
      indicative: false,
    };
  }

  /** Prose, in the customer's own language, for a person to edit and send. */
  private async draftMessage(
    quote: AssistQuote,
    input: AssistInput,
    provenance: Record<string, unknown>,
  ): Promise<PricingAssistDto> {
    const result = await this.gemini.json(
      [{ text: MESSAGE_PROMPT }, { text: messageContext(quote, input) }],
      'Pricing message',
    );

    if (result.status !== 'ok') {
      return {
        status: result.status === 'not-configured' ? 'not-configured' : 'unreadable',
        detail: result.detail,
        provenance,
        say: [],
        derived: [],
        options: [],
        questions: [],
        target: 'current',
        indicative: false,
      };
    }

    const message = typeof (result.json as { message?: unknown })?.message === 'string'
      ? ((result.json as { message: string }).message).trim()
      : '';

    if (message === '') {
      return {
        status: 'unreadable',
        provenance,
        say: [],
        derived: [],
        options: [],
        questions: [],
        target: 'current',
        indicative: false,
      };
    }

    return {
      status: 'ready',
      provenance: { ...provenance, model: result.model ?? provenance.model },
      say: ['Here is a covering note. Read it before you publish - it goes out in your name.'],
      derived: [],
      options: [],
      questions: [],
      target: 'current',
      indicative: false,
      message,
    };
  }

  private async chargeCodes(locale?: string): Promise<ChargeCodeOption[]> {
    const items = await this.reference.items('charge_code', { locale });
    return items.map((item) => ({ code: item.code, label: item.label }));
  }

  /**
   * One carrier offer becomes one option.
   *
   * A carrier writes "Ocean freight", not "FRT", so a line with no code is matched
   * on its wording against the lookup's own labels. Where that is ambiguous the
   * code stays blank and the description survives: nothing the carrier quoted is
   * dropped, and the pricer picks the code from the list.
   */
  private fromOffer(
    offer: ObservedOffer,
    quote: AssistQuote,
    chargeCodes: readonly ChargeCodeOption[],
  ): ProposedOption {
    const known = new Map(chargeCodes.map((entry) => [entry.code.toUpperCase(), entry]));

    return {
      name: offer.serviceName ?? '',
      carrierName: offer.carrierName ?? '',
      serviceRouting: offer.serviceRouting ?? '',
      transitDaysMin: offer.transitDaysMin === null ? '' : String(offer.transitDaysMin),
      transitDaysMax: offer.transitDaysMax === null ? '' : String(offer.transitDaysMax),
      nextDepartures: offer.nextDepartures ?? '',
      freeTimeDays: offer.freeTimeDays === null ? '' : String(offer.freeTimeDays),
      validUntil: offer.validUntil ?? '',
      currency: offer.currency ?? quote.currency,
      notes: offer.notes ?? '',
      lines: offer.charges.map((charge) => {
        const stated = charge.code ? known.get(charge.code) : undefined;
        const code = stated?.code ?? matchChargeCode(charge.description, chargeCodes);
        return {
          code,
          description: charge.description ?? stated?.label ?? '',
          basis: matchBasis(charge.basis, quote.containerCount),
          quantity:
            charge.quantity === null
              ? String(Math.max(quote.containerCount, 1))
              : String(charge.quantity),
          rate: charge.rate === null ? '' : String(charge.rate),
          currency: charge.currency ?? offer.currency ?? quote.currency,
          reason:
            charge.rate === null
              ? 'The reply did not give a rate for this line.'
              : 'Read from the carrier reply. Check it before you save.',
          indicative: false,
        };
      }),
    };
  }

  /** A scaffolded option, which by construction carries no rate at all. */
  private fromScaffold(option: ScaffoldOption, quote: AssistQuote): ProposedOption {
    return {
      name: option.name,
      carrierName: option.carrierName,
      serviceRouting: option.serviceRouting,
      transitDaysMin: option.transitDaysMin,
      transitDaysMax: option.transitDaysMax,
      nextDepartures: '',
      freeTimeDays: option.freeTimeDays,
      validUntil: '',
      currency: quote.currency,
      notes: option.notes,
      lines: option.lines.map((line) => ({
        code: line.code,
        description: line.description,
        basis: line.basis,
        quantity: line.quantity,
        rate: line.rate,
        currency: quote.currency,
        reason: line.reason,
        indicative: line.indicative === true,
      })),
    };
  }
}

/** The lane and the awkward parts, from data we already hold. No model. */
function brief(quote: AssistQuote): string[] {
  const lane = `${quote.originName ?? quote.originCode} to ${quote.destinationName ?? quote.destinationCode}`;
  const service = [quote.mode, quote.loadType].filter(Boolean).join(' ');

  const lines = [`${quote.reference}: ${lane}, ${service}${quote.incoterm ? `, ${quote.incoterm}` : ''}.`];

  const cargo = [
    quote.equipmentSummary,
    quote.grossWeightKg ? `${quote.grossWeightKg.toLocaleString()} kg` : null,
    quote.volumeM3 ? `${quote.volumeM3} m³` : null,
    quote.chargeableKg ? `${quote.chargeableKg.toLocaleString()} chargeable kg` : null,
  ].filter(Boolean);

  if (cargo.length > 0) lines.push(cargo.join(', ') + '.');

  const watch: string[] = [];
  if (quote.hasDangerousGoods) watch.push(quote.dangerousGoodsSummary || 'dangerous goods declared');
  if (quote.hasTemperatureControl) watch.push(quote.temperatureSummary || 'temperature controlled');
  if (quote.hasOversize) watch.push('out-of-gauge pieces');
  if (watch.length > 0) lines.push(`Watch: ${watch.join('; ')}.`);

  if (quote.notes) lines.push(`The customer wrote: "${quote.notes}"`);

  lines.push(
    'Paste the carrier reply and I will turn it into options, or ask me to set the charges up and you type the rates.',
  );

  return lines;
}

function summarise(offers: readonly ObservedOffer[]): string {
  if (offers.length === 1) {
    const only = offers[0]!;
    return `I read one offer${only.carrierName ? ` from ${only.carrierName}` : ''}.`;
  }
  const names = offers.map((offer) => offer.carrierName).filter(Boolean);
  return names.length > 0
    ? `I read ${offers.length} offers: ${names.join(', ')}.`
    : `I read ${offers.length} offers.`;
}

function describe(
  offer: ObservedOffer,
  index: number,
  total: number,
): { rule: string; text: string }[] {
  const who = offer.carrierName ?? (total > 1 ? `Offer ${index + 1}` : 'The carrier');
  const parts: { rule: string; text: string }[] = [];

  const transit = offer.transitDaysMin === null && offer.transitDaysMax === null
    ? null
    : offer.transitDaysMin === offer.transitDaysMax
      ? `${offer.transitDaysMin} days`
      : `${offer.transitDaysMin ?? '?'} to ${offer.transitDaysMax ?? '?'} days`;

  if (transit) parts.push({ rule: 'transit', text: `${who}: ${transit} in transit.` });
  if (offer.freeTimeDays !== null) {
    parts.push({ rule: 'freetime', text: `${who}: ${offer.freeTimeDays} free days.` });
  }
  if (offer.validUntil) {
    parts.push({ rule: 'validity', text: `${who}: the rate is valid until ${offer.validUntil}.` });
  }
  parts.push({
    rule: 'charges',
    text: `${who}: ${offer.charges.length} charge ${offer.charges.length === 1 ? 'line' : 'lines'} read from the reply.`,
  });

  return parts;
}

/** A basis the carrier wrote, mapped onto one of ours, or our best default. */
function matchBasis(stated: string | null, containerCount: number): string {
  const text = (stated ?? '').toLowerCase();
  if (text.includes('container') || text.includes('box') || /\b(teu|feu|20|40)\b/.test(text)) {
    return 'Per container';
  }
  if (text.includes('chargeable')) return 'Per chargeable kg';
  if (text.includes('kg') || text.includes('kilo')) return 'Per kg';
  if (text.includes('cbm') || text.includes('m3')) return 'Per CBM';
  if (text.includes('w/m') || text.includes('weight or measure')) return 'Per W/M';
  if (text.includes('b/l') || text.includes('bill of lading')) return 'Per B/L';
  if (text.includes('document')) return 'Per document';
  if (text.includes('pallet')) return 'Per pallet';
  if (text.includes('shipment') || text.includes('consignment')) return 'Per shipment';
  return containerCount > 0 ? 'Per container' : 'Per shipment';
}

/** Only what the note may mention. No cost, no margin, no internal remark. */
function messageContext(quote: AssistQuote, input: AssistInput): string {
  const options = (input.draft ?? []).map((option, index) => ({
    name: option.name || `Option ${index + 1}`,
    carrier: option.carrierName || null,
    transitDays:
      option.transitDaysMin || option.transitDaysMax
        ? [option.transitDaysMin, option.transitDaysMax].filter((value) => value != null).join('-')
        : null,
    freeTimeDays: option.freeTimeDays ?? null,
    validUntil: option.validUntil || null,
    total: option.total ?? null,
    currency: option.currency || quote.currency,
  }));

  return JSON.stringify({
    locale: input.locale ?? 'en-US',
    customerName: quote.customerName,
    reference: quote.reference,
    origin: quote.originName ?? quote.originCode,
    destination: quote.destinationName ?? quote.destinationCode,
    mode: quote.mode,
    loadType: quote.loadType,
    incoterm: quote.incoterm,
    readyDate: quote.readyDate,
    dangerousGoods: quote.hasDangerousGoods ? quote.dangerousGoodsSummary : null,
    temperatureControl: quote.hasTemperatureControl ? quote.temperatureSummary : null,
    customerNotes: quote.notes,
    options,
  });
}
